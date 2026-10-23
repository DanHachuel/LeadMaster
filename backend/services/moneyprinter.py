"""Integração com o MoneyPrinterTurbo (produção de vídeos wide 16:9).

API esperada (padrão do projeto): POST http://localhost:8080/api/v1/videos
Cria a tarefa e consulta o progresso até o vídeo ficar pronto.
"""

import time

import httpx

from . import storage


class ServicoIndisponivel(Exception):
    """MoneyPrinterTurbo não está rodando — mensagem acionável."""


class ProducaoErro(Exception):
    """O serviço respondeu, mas a produção falhou."""


def _conf() -> dict:
    return storage.get_config()["integracoes"]["moneyprinter"]


def _url() -> str:
    return _conf()["url"].rstrip("/")


def verificar() -> bool:
    """True se o serviço responde (qualquer código HTTP conta como 'vivo')."""
    try:
        httpx.get(_url() + "/docs", timeout=2)
        return True
    except httpx.HTTPError:
        try:
            httpx.get(_url(), timeout=2)
            return True
        except httpx.HTTPError:
            return False


def criar_video_wide(
    subject: str,
    script: str,
    terms: str = "",
    duracao_segundos: int = 60,
    voz: str = "pt-BR-Standard",
) -> str:
    """Cria a tarefa de vídeo wide (16:9). Retorna o task_id."""
    payload = {
        "video_subject": subject,
        "video_script": script,
        "video_terms": terms or subject,
        "video_aspect": "16:9",
        "video_clip_duration": min(duracao_segundos, 20),
        "video_source_provider": "pexels",
        "voice_volume": 1.0,
        "voice_rate": 1.0,
    }
    try:
        r = httpx.post(_url() + "/api/v1/videos", json=payload, timeout=120)
    except httpx.HTTPError as e:
        raise ServicoIndisponivel(
            f"MoneyPrinterTurbo não respondeu em {_url()}. "
            "Inicie o serviço (uvicorn app.server:app) e clique em Repetir."
        ) from e
    if r.status_code >= 400:
        raise ProducaoErro(f"MoneyPrinterTurbo rejeitou a tarefa (HTTP {r.status_code}): {r.text[:300]}")
    task_id = (r.json().get("data") or {}).get("task_id")
    if not task_id:
        raise ProducaoErro(f"Resposta sem task_id: {r.text[:300]}")
    return task_id


def aguardar_video(task_id: str, timeout_min: int = 20, a_cada_progresso=None) -> dict:
    """Sonda a tarefa até concluir. Retorna {progresso, videos, saidas}."""
    limite = time.time() + timeout_min * 60
    while time.time() < limite:
        try:
            r = httpx.get(_url() + "/api/v1/tasks", params={"task_id": task_id}, timeout=15)
        except httpx.HTTPError as e:
            raise ServicoIndisponivel(
                f"MoneyPrinterTurbo sumiu durante a produção: {e}. Clique em Repetir com o serviço ativo."
            ) from e
        if r.status_code >= 500:
            time.sleep(5)
            continue
        data = (r.json() or {}).get("data") or {}
        task = data
        if isinstance(data.get("tasks"), list) and data["tasks"]:
            task = data["tasks"][0]
        progresso = task.get("progress") or 0
        if a_cada_progresso:
            a_cada_progresso(progresso)
        if task.get("videos"):
            return {"progresso": 100, "videos": task["videos"], "saidas": task.get("progress_details", {})}
        time.sleep(5)
    raise ProducaoErro(
        f"A tarefa {task_id} não ficou pronta em {timeout_min} minutos. "
        "Verifique o MoneyPrinterTurbo e use Repetir."
    )
