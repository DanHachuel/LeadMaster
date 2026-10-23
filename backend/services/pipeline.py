"""Motor do pipeline de vídeos faceless.

Cada job atravessa 5 etapas:
    roteiro → thumbnail → wide (16:9) → shorts (9:16) → upload

- Cada etapa roda em uma thread própria do job, com checkpoints de PAUSAR/PARAR
  entre etapas e persistência imediata no `pipeline.json`.
- Falhas sempre viram mensagens acionáveis + botão Repetir no frontend.
- O agendador publica vídeos (não listado → público) após 1h do upload.
"""

import threading
import time
import uuid
from datetime import datetime, timedelta

from . import agents, llm, moneyprinter, openmontage, short_video_maker, storage, youtube_upload

ETAPAS = ["roteiro", "thumbnail", "wide", "shorts", "upload"]
ETAPA_LABELS = {
    "roteiro": "Roteiro",
    "thumbnail": "Thumbnail/Título",
    "wide": "Produção Wide (16:9)",
    "shorts": "Produção Shorts (9:16)",
    "upload": "Upload YouTube",
}
STATUS_JOB = ["rascunho", "em_andamento", "pausado", "concluido", "erro", "cancelado"]


class _Parada(Exception):
    """Sinal interno: o usuário pediu parar/cancelar o job."""


def progresso(job: dict) -> int:
    """Progresso 0–100 (etapas puladas contam como concluídas)."""
    etapas = job.get("etapas", [])
    if not etapas:
        return 0
    feitas = sum(1 for e in etapas if e["status"] in ("concluida", "pulada"))
    em_curso = sum(0.5 for e in etapas if e["status"] == "em_andamento")
    return int(round((feitas + em_curso) / len(etapas) * 100))


def _hora() -> str:
    return datetime.now().strftime("%H:%M:%S")


class PipelineEngine:
    def __init__(self):
        self._pausas: dict[str, threading.Event] = {}
        self._paradas: dict[str, threading.Event] = {}
        self._threads: dict[str, threading.Thread] = {}

    # ------------------------------------------------------------------
    # Criação e consulta
    # ------------------------------------------------------------------

    def criar_job(self, dados: dict) -> dict:
        tema = (dados.get("tema") or "").strip()
        if not tema:
            raise ValueError("Informe o tema do vídeo.")
        formatos = dados.get("formatos") or ["wide", "shorts"]
        formatos = [f for f in formatos if f in ("wide", "shorts")]
        if not formatos:
            raise ValueError("Selecione ao menos um formato (Wide e/ou Shorts).")

        job = {
            "id": uuid.uuid4().hex[:12],
            "titulo": (dados.get("titulo") or "").strip(),
            "tema": tema,
            "tom": dados.get("tom") or "informativo",
            "duracao_min": max(1, min(20, int(dados.get("duracao_min") or 8))),
            "keyword_seo": (dados.get("keyword_seo") or "").strip(),
            "formatos": formatos,
            "criado_em": storage.now_iso(),
            "atualizado_em": storage.now_iso(),
            "status": "rascunho",
            "etapa_atual": None,
            "etapas": [
                {
                    "id": etapa,
                    "nome": ETAPA_LABELS[etapa],
                    "status": "pendente",
                    "iniciada_em": None,
                    "concluida_em": None,
                    "mensagem": "",
                    "dados": {},
                    "logs": [],
                }
                for etapa in ETAPAS
            ],
            "dados": {},
            "upload": {},
        }
        storage.upsert_job(job)
        return job

    def listar(self) -> list:
        jobs = storage.list_jobs()
        for job in jobs:
            job["progresso"] = progresso(job)
        return sorted(jobs, key=lambda j: j.get("criado_em", ""), reverse=True)

    # ------------------------------------------------------------------
    # Controles (iniciar/pausar/parar/repetir)
    # ------------------------------------------------------------------

    def agir(self, job_id: str, acao: str) -> dict:
        if acao == "repetir":
            self._resetar_erro(job_id)
            return self.iniciar(job_id)
        if acao == "iniciar":
            return self.iniciar(job_id)
        if acao == "pausar":
            return self.pausar(job_id)
        if acao == "parar":
            return self.parar(job_id)
        raise ValueError(f"Ação desconhecida: {acao}")

    def _resetar_erro(self, job_id: str) -> None:
        """Repetir: volta a primeira etapa com erro para pendente."""
        job = storage.get_job(job_id)
        if not job:
            return
        for etapa in job["etapas"]:
            if etapa["status"] == "erro":
                etapa["status"] = "pendente"
                etapa["iniciada_em"] = None
                etapa["concluida_em"] = None
                etapa["mensagem"] = "Repetição solicitada pelo usuário."
                break
        storage.upsert_job(job)

    def iniciar(self, job_id: str) -> dict:
        job = storage.get_job(job_id)
        if not job:
            return {"ok": False, "mensagem": "Job não encontrado."}
        if job["status"] == "em_andamento":
            return {"ok": False, "mensagem": "Job já está em andamento."}
        if job["status"] == "concluido":
            return {"ok": False, "mensagem": "Job já concluído — crie um novo vídeo."}

        self._pausas.setdefault(job_id, threading.Event())
        self._pausas[job_id].clear()
        self._paradas.setdefault(job_id, threading.Event())
        self._paradas[job_id].clear()

        thread = self._threads.get(job_id)
        if thread and thread.is_alive():
            job["status"] = "em_andamento"
            job["atualizado_em"] = storage.now_iso()
            storage.upsert_job(job)
            return {"ok": True, "mensagem": "Job retomado."}

        job["status"] = "em_andamento"
        job["atualizado_em"] = storage.now_iso()
        storage.upsert_job(job)
        t = threading.Thread(target=self._executar, args=(job_id,), daemon=True)
        self._threads[job_id] = t
        t.start()
        return {"ok": True, "mensagem": "Pipeline iniciado."}

    def pausar(self, job_id: str) -> dict:
        pausa = self._pausas.get(job_id)
        thread = self._threads.get(job_id)
        if not pausa or not thread or not thread.is_alive():
            return {"ok": False, "mensagem": "Job não está em execução."}
        pausa.set()
        return {"ok": True, "mensagem": "Pausa solicitada — aplicada entre etapas."}

    def parar(self, job_id: str) -> dict:
        parada = self._paradas.setdefault(job_id, threading.Event())
        parada.set()
        pausa = self._pausas.get(job_id)
        if pausa:
            pausa.clear()  # destrava a espera para que a parada seja percebida
        return {"ok": True, "mensagem": "Parada solicitada."}

    # ------------------------------------------------------------------
    # Worker
    # ------------------------------------------------------------------

    def _checar(self, job_id: str) -> None:
        parada = self._paradas.get(job_id)
        if parada and parada.is_set():
            raise _Parada()
        pausa = self._pausas.get(job_id)
        if pausa and pausa.is_set():
            job = storage.get_job(job_id)
            if job and job["status"] == "em_andamento":
                job["status"] = "pausado"
                job["atualizado_em"] = storage.now_iso()
                storage.upsert_job(job)
            while pausa.is_set():
                time.sleep(0.5)
                if parada and parada.is_set():
                    raise _Parada()
            job = storage.get_job(job_id)
            if job and job["status"] == "pausado":
                job["status"] = "em_andamento"
                job["atualizado_em"] = storage.now_iso()
                storage.upsert_job(job)

    def _executar(self, job_id: str) -> None:
        try:
            while True:
                job = storage.get_job(job_id)
                if not job:
                    return
                pendente = None
                for etapa in job["etapas"]:
                    if etapa["status"] == "pendente":
                        pendente = etapa
                        break
                if pendente is None:
                    # Nada mais a executar: conclui com o status correto.
                    com_erro = any(e["status"] == "erro" for e in job["etapas"])
                    job["status"] = "erro" if com_erro else "concluido"
                    job["etapa_atual"] = None
                    job["atualizado_em"] = storage.now_iso()
                    storage.upsert_job(job)
                    return
                self._checar(job_id)
                self._executar_etapa(job_id, pendente["id"])
                # Etapa falhou? Interrompe o fluxo — "Repetir" retoma daqui.
                job = storage.get_job(job_id)
                if job and job["status"] == "erro":
                    return
        except _Parada:
            job = storage.get_job(job_id)
            if job:
                job["status"] = "cancelado"
                job["atualizado_em"] = storage.now_iso()
                for etapa in job["etapas"]:
                    if etapa["status"] == "em_andamento":
                        etapa["status"] = "pendente"
                        etapa["mensagem"] = "Etapa interrompida."
                storage.upsert_job(job)
        except Exception as e:  # erro inesperado fora das etapas
            job = storage.get_job(job_id)
            if job:
                job["status"] = "erro"
                job["atualizado_em"] = storage.now_iso()
                storage.upsert_job(job)

    def _executar_etapa(self, job_id: str, etapa_id: str) -> None:
        job = storage.get_job(job_id)
        etapa = next(e for e in job["etapas"] if e["id"] == etapa_id)
        etapa["status"] = "em_andamento"
        etapa["iniciada_em"] = storage.now_iso()
        job["etapa_atual"] = etapa_id
        job["atualizado_em"] = storage.now_iso()
        storage.upsert_job(job)

        try:
            if etapa_id == "roteiro":
                resultado = self._etapa_roteiro(job)
            elif etapa_id == "thumbnail":
                resultado = self._etapa_thumbnail(job)
            elif etapa_id == "wide":
                resultado = self._etapa_wide(job)
            elif etapa_id == "shorts":
                resultado = self._etapa_shorts(job)
            elif etapa_id == "upload":
                resultado = self._etapa_upload(job)
            else:
                raise ValueError(f"Etapa desconhecida: {etapa_id}")
        except Exception as e:
            job = storage.get_job(job_id)
            etapa = next(e2 for e2 in job["etapas"] if e2["id"] == etapa_id)
            etapa["status"] = "erro"
            etapa["mensagem"] = str(e)
            etapa["logs"].append(f"[{_hora()}] ✗ {e}")
            etapa["concluida_em"] = storage.now_iso()
            job["status"] = "erro"
            job["atualizado_em"] = storage.now_iso()
            storage.upsert_job(job)
            return

        job = storage.get_job(job_id)
        etapa = next(e2 for e2 in job["etapas"] if e2["id"] == etapa_id)
        etapa["status"] = resultado["status"]
        etapa["mensagem"] = resultado["mensagem"]
        etapa["dados"] = resultado.get("dados", {})
        etapa["concluida_em"] = storage.now_iso()
        for linha in resultado.get("logs", []):
            etapa["logs"].append(f"[{_hora()}] {linha}")
        job["dados"].update(resultado.get("job_dados", {}))
        if "upload" in resultado.get("job_dados", {}):
            job["upload"] = resultado["job_dados"]["upload"]
        job["etapa_atual"] = None
        job["atualizado_em"] = storage.now_iso()
        storage.upsert_job(job)

    # ------------------------------------------------------------------
    # Etapas
    # ------------------------------------------------------------------

    def _etapa_roteiro(self, job: dict) -> dict:
        resultado = llm.gerar_roteiro(
            tema=job["tema"],
            titulo=job.get("titulo", ""),
            tom=job.get("tom", "informativo"),
            duracao_min=job.get("duracao_min", 8),
        )
        roteiro = resultado["roteiro"]
        arquivo = storage.roteiros_dir() / f"{job['id']}.txt"
        arquivo.write_text(roteiro, encoding="utf-8")
        logs = [
            f"Roteiro com {len(roteiro):,} caracteres (origem: {resultado['origem']}).".replace(",", "."),
            f"Salvo em {arquivo}",
        ]
        if resultado.get("aviso"):
            logs.append(f"⚠ {resultado['aviso']}")
        return {
            "status": "concluida",
            "mensagem": f"Roteiro pronto ({len(roteiro):,} caracteres — {resultado['origem']}).".replace(",", "."),
            "job_dados": {
                "roteiro": roteiro,
                "roteiro_chars": len(roteiro),
                "arquivo_roteiro": str(arquivo),
                "origem_roteiro": resultado["origem"],
            },
            "logs": logs,
        }

    def _etapa_thumbnail(self, job: dict) -> dict:
        resultado = llm.gerar_titulo_e_thumbnail(job["tema"], job.get("dados", {}).get("roteiro", ""))
        return {
            "status": "concluida",
            "mensagem": (
                f"Título e prompt de thumbnail gerados ({resultado['origem']}). "
                "Renderize a imagem no MoneyPrinterTurbo com o prompt salvo."
            ),
            "job_dados": {
                "titulo_gerado": resultado["titulo"],
                "titulo_alternativo": resultado["titulo_alternativo"],
                "thumbnail_prompt": resultado["thumbnail_prompt"],
                "origem_titulo": resultado["origem"],
            },
            "logs": [
                f"Título: {resultado['titulo']}",
                f"Alternativo: {resultado['titulo_alternativo']}",
                f"Prompt thumbnail: {resultado['thumbnail_prompt'][:120]}...",
            ],
        }

    def _etapa_wide(self, job: dict) -> dict:
        if "wide" not in job.get("formatos", []):
            return {"status": "pulada", "mensagem": "Formato Wide não selecionado para este job.", "logs": []}
        roteiro = job.get("dados", {}).get("roteiro", "")
        subject = job.get("dados", {}).get("titulo_gerado") or job.get("titulo") or job["tema"]
        logs = []
        try:
            task_id = moneyprinter.criar_video_wide(
                subject=subject,
                script=roteiro,
                terms=job.get("keyword_seo") or job["tema"],
            )
            logs.append(f"Tarefa criada no MoneyPrinterTurbo: {task_id}")
            resultado = moneyprinter.aguardar_video(task_id, timeout_min=20)
            videos = resultado.get("videos", [])
            logs.append(f"Vídeo wide pronto: {videos[0] if videos else 'sem URL listada'}")
            return {
                "status": "concluida",
                "mensagem": "Vídeo wide 16:9 produzido com MoneyPrinterTurbo.",
                "job_dados": {"videos_wide": videos, "task_id_wide": task_id, "producao_wide": "moneyprinter"},
                "logs": logs,
            }
        except moneyprinter.ServicoIndisponivel as e:
            logs.append(f"✗ {e}")
            if openmontage.disponivel():
                logs.append("Tentando fallback via OpenMontage...")
                om = openmontage.produzir(job["id"], job["dados"]["arquivo_roteiro"])
                logs.append(f"OpenMontage concluído: {om.get('video_path') or om.get('observacao')}")
                return {
                    "status": "concluida",
                    "mensagem": "Vídeo wide produzido via OpenMontage (fallback).",
                    "job_dados": {
                        "videos_wide": [],
                        "arquivo_local": om.get("video_path") or "",
                        "producao_wide": "openmontage",
                    },
                    "logs": logs,
                }
            raise

    def _etapa_shorts(self, job: dict) -> dict:
        if "shorts" not in job.get("formatos", []):
            return {"status": "pulada", "mensagem": "Formato Shorts não selecionado para este job.", "logs": []}
        roteiro = job.get("dados", {}).get("roteiro", "")
        titulo = job.get("dados", {}).get("titulo_gerado") or job.get("titulo") or job["tema"]
        resultado = short_video_maker.criar_short(
            titulo=titulo,
            script=roteiro,
            tema=job["tema"],
        )
        return {
            "status": "concluida",
            "mensagem": "Tarefa enviada ao Short-Video-Maker (9:16).",
            "job_dados": {"resposta_shorts": resultado},
            "logs": [f"HTTP {resultado['status_http']} do Short-Video-Maker."],
        }

    def _etapa_upload(self, job: dict) -> dict:
        conf = storage.get_config()["integracoes"]["youtube_upload"]
        if not (conf.get("url") or conf.get("uploader_mcp_path")):
            return {
                "status": "pulada",
                "mensagem": (
                    "Upload manual: nenhum uploader configurado. Configure em "
                    "Ferramentas → Upload YouTube e clique em Repetir."
                ),
                "logs": ["Uploader não configurado — etapa pulada (não é erro)."],
            }
        videos = job.get("dados", {}).get("videos_wide") or []
        arquivo = job.get("dados", {}).get("arquivo_local") or ""
        if not videos and not arquivo:
            raise youtube_upload.UploadErro(
                "Nenhum vídeo produzido para enviar. Conclua a etapa de produção (Wide) antes do upload."
            )
        titulo = job.get("dados", {}).get("titulo_gerado") or job.get("titulo") or job["tema"]
        descricao = f"{titulo}\n\n{job.get('keyword_seo') or job['tema']}\n\nGerado pelo LeadMaster."
        resultado = youtube_upload.upload_video(
            titulo=titulo,
            descricao=descricao,
            arquivo=arquivo,
            video_url=videos[0] if videos else "",
            tags=job.get("keyword_seo", ""),
        )
        upload = dict(job.get("upload") or {})
        upload.update(
            {
                "video_id": resultado.get("video_id", ""),
                "url": resultado.get("url", ""),
                "modo_upload": resultado.get("modo", ""),
                "status": "nao_listado",
                "publicado_em": None,
            }
        )
        logs = [f"Upload via {resultado.get('modo')} concluído: {resultado.get('url') or resultado.get('video_id')}"]
        if conf.get("modo") == "nao_listado_1h_publico":
            horas = max(0, int(conf.get("espera_publicacao_horas", 1)))
            agenda = (datetime.now().astimezone() + timedelta(hours=horas)).isoformat(timespec="seconds")
            upload["agenda_publicacao"] = agenda
            logs.append(f"Vídeo não listado; publicação automática agendada para {agenda}.")
            mensagem = f"Upload não listado criado. Publicação automática em {horas}h ({agenda[11:16]})."
        else:
            upload["agenda_publicacao"] = None
            mensagem = "Upload criado (modo direto, sem agendamento)."
        return {
            "status": "concluida",
            "mensagem": mensagem,
            "job_dados": {"upload": upload},
            "logs": logs,
        }

    # ------------------------------------------------------------------
    # Agendador de publicação (não listado → público)
    # ------------------------------------------------------------------

    def iniciar_agendador(self) -> None:
        if getattr(self, "_agendador_ativo", False):
            return
        self._agendador_ativo = True
        threading.Thread(target=self._loop_agendador, daemon=True).start()

    def _loop_agendador(self) -> None:
        while True:
            time.sleep(60)
            try:
                self._processar_agenda()
            except Exception:
                pass  # agendador é resiliente por definição

    def _processar_agenda(self) -> None:
        agora = datetime.now().astimezone()
        for job in storage.list_jobs():
            upload = job.get("upload") or {}
            agenda = upload.get("agenda_publicacao")
            if not agenda or upload.get("publicado_em"):
                continue
            if datetime.fromisoformat(agenda) > agora:
                continue
            if int(upload.get("tentativas", 0)) >= 10:
                upload["agenda_publicacao"] = None
                upload["status"] = "falhou"
                job["upload"] = upload
                storage.upsert_job(job)
                continue
            try:
                youtube_upload.tornar_publico(upload.get("video_id", ""))
                upload["publicado_em"] = storage.now_iso()
                upload["status"] = "publico"
                upload.pop("ultimo_erro", None)
                job["upload"] = upload
                storage.upsert_job(job)
                agents.disparar_webhook("video.publicado", {"job_id": job["id"], "url": upload.get("url")})
            except Exception as e:
                upload["tentativas"] = int(upload.get("tentativas", 0)) + 1
                upload["ultimo_erro"] = str(e)
                job["upload"] = upload
                storage.upsert_job(job)

    def recuperar(self) -> None:
        """Após reinício do servidor: jobs 'em_andamento' voltam a 'pausado'."""
        for job in storage.list_jobs():
            if job.get("status") == "em_andamento":
                job["status"] = "pausado"
                job["atualizado_em"] = storage.now_iso()
                for etapa in job["etapas"]:
                    if etapa["status"] == "em_andamento":
                        etapa["status"] = "pendente"
                        etapa["mensagem"] = "Etapa interrompida pelo reinício do servidor."
                storage.upsert_job(job)
