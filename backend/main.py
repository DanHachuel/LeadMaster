"""LeadMaster — API FastAPI (100% local).

Rotas da aplicação + serving estático da UI construída (frontend/dist) para o
modo `npx`, onde um único servidor entrega painel e API na mesma porta.
"""

import json
import logging
import os
import platform
import sys
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from services import agents, crm_agent, extractors, llm, storage

REPO_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"


def _versao() -> str:
    env = os.environ.get("LEADMASTER_VERSION")
    if env:
        return env
    try:
        return json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    except Exception:
        return "dev"


VERSION = _versao()


# ---------------------------------------------------------------------------
# Logs de acesso
#
# O endpoint /api/metrics é consultado por polling do Painel e inundava o
# terminal. O filtro abaixo silencia APENAS esse endpoint no access-log —
# erros, exceções e os demais endpoints continuam sendo logados normalmente.
# (O launcher e o "npm run dev" também passam --no-access-log ao uvicorn.)
# ---------------------------------------------------------------------------

class _FiltroAcessoPolling(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            return "/api/metrics" not in record.getMessage()
        except Exception:
            return True


logging.getLogger("uvicorn.access").addFilter(_FiltroAcessoPolling())


@asynccontextmanager
async def lifespan(_app: FastAPI):
    storage.ensure_seeds()
    yield


app = FastAPI(title="LeadMaster API", version=VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # A UI local (npx) roda same-origin; em modo dev o Vite sobe em 5055 e pode
    # auto-incrementar (5056, 5057...) quando a porta está ocupada — por isso
    # aceitamos qualquer porta em localhost/127.0.0.1.
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class LeadIn(BaseModel):
    nome: str = Field(min_length=1)
    telefone: str = ""
    email: str = ""
    fonte: str = "Manual"
    etapa: str = "leads"
    cnpj: str = ""
    empresa: str = ""
    endereco: str = ""
    cidade: str = ""
    observacoes: str = ""
    score: int | None = None
    tags: list[str] = []
    extras: dict = {}
    extras: dict | None = None


class LeadsImportIn(BaseModel):
    leads: list[dict]


class CampaignIn(BaseModel):
    nome: str = Field(min_length=1)
    canal: str = "texto"
    template: str = "texto"
    mensagem: str = ""
    lead_ids: list[str] = []
    filtro_etapa: str | None = None


class InstagramIn(BaseModel):
    profile_url: str = Field(min_length=6)


class MapsExtractIn(BaseModel):
    keyword: str = Field(min_length=2)
    location: str = Field(min_length=2)
    limit: int = 10


class InstagramExtractIn(BaseModel):
    profile_url: str = Field(min_length=6)
    limit: int = 10


class CnpjIn(BaseModel):
    cnpj: str = Field(min_length=8)


class CnpjSearchIn(BaseModel):
    cnae: str = Field(min_length=2)
    uf: str = Field(min_length=2)
    quantidade: int = 20


class CnpjExtractIn(BaseModel):
    cnae: str = Field(min_length=2)
    uf: str = Field(min_length=2)
    limit: int = 10


class ChatIn(BaseModel):
    mensagens: list[dict]


class TemplateTestIn(BaseModel):
    template: str
    lead_id: str | None = None


class WebhookTestIn(BaseModel):
    url: str = Field(min_length=8)


class IntegracaoTestIn(BaseModel):
    url: str


# ---------------------------------------------------------------------------
# Sistema
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "versao": VERSION,
        "home": str(storage.get_home()),
        "storage": str(storage.storage_dir()),
    }


@app.get("/api/doctor")
def doctor():
    integracoes = {
        "llm_configurado": llm.configurado(),
        "openoutreach": agents.disparo_configurado(),
        "pipecat": bool(storage.get_config()["integracoes"]["pipecat"].get("url")),
    }
    return {
        "ok": True,
        "versao": VERSION,
        "python": platform.python_version(),
        "sistema": platform.platform(),
        "dist_frontend": FRONTEND_DIST.exists(),
        "storage": str(storage.storage_dir()),
        "integracoes": integracoes,
    }


@app.post("/api/shutdown")
def shutdown():
    threading.Timer(0.6, os._exit, [0]).start()
    return {"ok": True, "mensagem": "Servidor local encerrando em instantes."}


# ---------------------------------------------------------------------------
# Métricas (Painel)
# ---------------------------------------------------------------------------

@app.get("/api/metrics")
def metrics():
    leads = storage.list_leads()
    campaigns = storage.list_campaigns()
    enviadas = sum(int(c.get("enviadas", 0)) for c in campaigns)
    erros = sum(int(c.get("erros", 0)) for c in campaigns)
    total_envios = enviadas + erros

    return {
        "conexao": {
            "geral": True,  # o backend local responde => conectado
            "llm": llm.configurado(),
            "openoutreach": agents.disparo_configurado(),
        },
        "taxa_entrega": round(enviadas / total_envios * 100, 1) if total_envios else 100.0,
        "taxa_erro": round(erros / total_envios * 100, 1) if total_envios else 0.0,
        "total_enviadas": enviadas,
        "total_erros": erros,
        "leads_total": len(leads),
        "leads_por_etapa": {
            etapa: sum(1 for l in leads if l.get("etapa") == etapa)
            for etapa in ("leads", "em_contato", "proposta", "fechado")
        },
        "campanhas": {"enviadas": enviadas, "erros": erros, "total": len(campaigns)},
        "perfil": storage.get_config().get("perfil", {}),
    }


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------

def _validar_etapa(etapa: str) -> str:
    if etapa not in ("leads", "em_contato", "proposta", "fechado"):
        raise HTTPException(400, "Etapa inválida. Use: leads, em_contato, proposta ou fechado.")
    return etapa


@app.get("/api/leads")
def listar_leads():
    return storage.list_leads()


@app.post("/api/leads", status_code=201)
def criar_lead(lead_in: LeadIn):
    lead = lead_in.model_dump()
    lead["id"] = storage._novo_id()
    lead["etapa"] = _validar_etapa(lead.get("etapa", "leads"))
    lead["score"] = lead.get("score") if lead.get("score") is not None else crm_agent.calcular_completude(lead)
    storage.add_lead(lead)
    agents.disparar_webhook("lead.criado", {"lead_id": lead["id"], "nome": lead["nome"]})
    return lead


@app.patch("/api/leads/{lead_id}")
def atualizar_lead(lead_id: str, patch: dict):
    if patch.get("etapa"):
        _validar_etapa(patch["etapa"])
    atualizado = storage.update_lead(lead_id, patch)
    if not atualizado:
        raise HTTPException(404, "Lead não encontrado.")
    if patch.get("etapa"):
        agents.disparar_webhook("lead.etapa", {"lead_id": lead_id, "etapa": patch["etapa"]})
    return atualizado


@app.delete("/api/leads/{lead_id}")
def remover_lead(lead_id: str):
    if not storage.delete_lead(lead_id):
        raise HTTPException(404, "Lead não encontrado.")
    return {"ok": True}


@app.post("/api/leads/import")
def importar_leads(dados: LeadsImportIn):
    for lead in dados.leads:
        lead["etapa"] = _validar_etapa(lead.get("etapa", "leads"))
    return storage.import_leads(dados.leads)


@app.post("/api/leads/{lead_id}/enrich")
def enriquecer_lead(lead_id: str):
    resultado = crm_agent.enriquecer_lead(lead_id)
    if not resultado.get("ok"):
        raise HTTPException(404, resultado.get("mensagem", "Lead não encontrado."))
    return resultado


# ---------------------------------------------------------------------------
# CRM (agente)
# ---------------------------------------------------------------------------

@app.get("/api/crm/sugestoes")
def sugestoes_crm():
    return crm_agent.sugerir_movimentacoes()


@app.post("/api/crm/sugestoes/aplicar")
def aplicar_sugestao(dados: dict):
    lead_id, para = dados.get("lead_id"), dados.get("para")
    if not lead_id or not para:
        raise HTTPException(400, "Informe lead_id e para.")
    atualizado = storage.update_lead(lead_id, {"etapa": _validar_etapa(para)})
    if not atualizado:
        raise HTTPException(404, "Lead não encontrado.")
    agents.disparar_webhook("lead.etapa", {"lead_id": lead_id, "etapa": para, "via": "agente_crm"})
    return {"ok": True, "lead": atualizado}


# ---------------------------------------------------------------------------
# CRM — Kanban (leads por etapa)
# ---------------------------------------------------------------------------

@app.get("/api/crm/leads")
def crm_listar_leads():
    """Todos os leads (persistidos em leads.json) — usado pelo quadro Kanban."""
    return storage.list_leads()


@app.post("/api/crm/leads", status_code=201)
def crm_criar_lead(lead_in: LeadIn):
    """Cria um lead manualmente pelo modal 'Adicionar Lead' do CRM."""
    lead = lead_in.model_dump()
    lead["id"] = storage._novo_id()
    lead["etapa"] = _validar_etapa(lead.get("etapa", "leads"))
    lead["score"] = lead.get("score") if lead.get("score") is not None else crm_agent.calcular_completude(lead)
    storage.add_lead(lead)
    agents.disparar_webhook("lead.criado", {"lead_id": lead["id"], "nome": lead["nome"]})
    return lead


@app.put("/api/crm/leads/{lead_id}/etapa")
def crm_mover_lead(lead_id: str, dados: dict):
    """Move um lead de coluna no Kanban (drag-and-drop)."""
    etapa = dados.get("etapa")
    if not etapa:
        raise HTTPException(400, "Informe a etapa de destino.")
    _validar_etapa(etapa)
    atualizado = storage.update_lead(lead_id, {"etapa": etapa})
    if not atualizado:
        raise HTTPException(404, "Lead não encontrado.")
    agents.disparar_webhook("lead.etapa", {"lead_id": lead_id, "etapa": etapa, "via": "kanban"})
    return atualizado


@app.get("/api/crm/leads/export")
def crm_exportar_leads_csv():
    """Exporta todos os leads em CSV (UTF-8 com BOM, amigável ao Excel)."""
    import csv
    import io

    leads = storage.list_leads()

    def _valor_celula(valor) -> str:
        if valor is None:
            return ""
        if isinstance(valor, (list, tuple)):
            return "; ".join(str(v) for v in valor)
        return str(valor)

    # Colunas fixas + união das chaves de `extras` (achatadas com prefixo).
    colunas = [
        "id", "nome", "telefone", "email", "fonte", "etapa", "empresa",
        "cnpj", "endereco", "cidade", "observacoes", "score", "tags",
        "criado_em", "atualizado_em",
    ]
    extras_keys: list[str] = []
    for lead in leads:
        for chave in (lead.get("extras") or {}):
            coluna = f"extras_{chave}"
            if coluna not in extras_keys:
                extras_keys.append(coluna)
    colunas.extend(sorted(extras_keys))

    buffer = io.StringIO()
    escritor = csv.writer(buffer, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    escritor.writerow(colunas)
    for lead in leads:
        linha = [_valor_celula(lead.get(coluna)) for coluna in colunas[: len(colunas) - len(extras_keys)]]
        extras = lead.get("extras") or {}
        for coluna in sorted(extras_keys):
            linha.append(_valor_celula(extras.get(coluna[len("extras_"):])))
        escritor.writerow(linha)

    conteudo = "\ufeff" + buffer.getvalue()  # BOM: Excel em pt-BR lê os acentos
    return Response(
        content=conteudo.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="leads_leadmaster.csv"'},
    )


@app.put("/api/crm/leads/{lead_id}")
def crm_editar_lead(lead_id: str, dados: dict):
    """Edita os dados principais do lead (modal de detalhes do CRM).

    Payload aceita qualquer subconjunto de {nome, telefone, email, ...}; o nome,
    quando presente, não pode ficar vazio (prevenção de erros).
    """
    if "nome" in dados and not str(dados.get("nome") or "").strip():
        raise HTTPException(400, "O nome do lead não pode ficar vazio.")
    patch = {k: v for k, v in dados.items() if k in ("nome", "telefone", "email")}
    if not patch:
        raise HTTPException(400, "Nenhum campo editável informado (nome, telefone, email).")
    atualizado = storage.update_lead(lead_id, patch)
    if not atualizado:
        raise HTTPException(404, "Lead não encontrado.")
    return atualizado


# ---------------------------------------------------------------------------
# Campanhas / Disparos
# ---------------------------------------------------------------------------

@app.get("/api/campaigns")
def listar_campanhas():
    return storage.list_campaigns()


@app.post("/api/campaigns", status_code=201)
def criar_campanha(campaign_in: CampaignIn):
    campaign = campaign_in.model_dump()
    # Filtro por etapa do CRM: sem lead_ids explícitos, seleciona os leads da
    # etapa escolhida (ex.: "Novos Leads").
    if not campaign["lead_ids"] and campaign.get("filtro_etapa"):
        _validar_etapa(campaign["filtro_etapa"])
        campaign["lead_ids"] = [l["id"] for l in storage.list_leads() if l.get("etapa") == campaign["filtro_etapa"]]
    campaign["id"] = storage._novo_id()
    campaign.update({"status": "rascunho", "total": len(campaign["lead_ids"]), "enviadas": 0, "erros": 0, "eventos": [], "criado_em": storage.now_iso()})
    storage.upsert_campaign(campaign)
    return campaign


@app.put("/api/campaigns/{campaign_id}/status")
def alterar_status_campanha(campaign_id: str, dados: dict, background_tasks: BackgroundTasks):
    """Altera o status de uma campanha (rascunho/ativa/pausada/concluida).

    "ativa" (alias de em_andamento) DISPARA o motor de simulação em background
    — a cada envio os contadores sobem em campaigns.json e a UI reflete na
    barra de progresso. Reativar uma campanha concluída zera os contadores
    (nova rodada); reativar uma pausada continua de onde parou (leads já
    enviados são pulados). Pausar/parar responde no próximo ciclo do worker.
    """
    status = (dados.get("status") or "").strip().lower()
    # Aliases aceitos: "ativa" equivale a "em_andamento" no ciclo interno.
    aliases = {"ativa": "em_andamento", "em_andamento": "em_andamento", "pausada": "pausada", "pausado": "pausada", "rascunho": "rascunho", "concluida": "concluida"}
    interno = aliases.get(status)
    if not interno:
        raise HTTPException(400, 'Status inválido. Use: rascunho, ativa, pausada ou concluida.')
    campaign = storage.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(404, "Campanha não encontrada.")

    if interno == "em_andamento":
        if campaign.get("status") == "concluida":
            # Nova rodada: zera métricas e eventos da execução anterior.
            campaign.update({"enviadas": 0, "erros": 0, "eventos": [], "concluida_em": None})
        campaign["status"] = "em_andamento"
        campaign.setdefault("iniciada_em", storage.now_iso())
        campaign.setdefault("enviadas", 0)
        campaign.setdefault("erros", 0)
        campaign.setdefault("eventos", [])
        campaign["total"] = len(campaign.get("lead_ids", []))
        storage.upsert_campaign(campaign)
        # Motor em background: a resposta volta na hora; os envios sobem depois.
        background_tasks.add_task(agents.processar_campanha_em_background, campaign_id)
    else:
        campaign["status"] = interno
        storage.upsert_campaign(campaign)
    return campaign


@app.post("/api/campaigns/{campaign_id}/start")
def iniciar_campanha(campaign_id: str):
    resultado = agents.iniciar_campanha(campaign_id)
    if not resultado.get("ok"):
        raise HTTPException(400, resultado["mensagem"])
    return resultado


@app.post("/api/campaigns/{campaign_id}/pause")
def pausar_campanha(campaign_id: str):
    return agents.pausar_campanha(campaign_id)


@app.post("/api/campaigns/{campaign_id}/stop")
def parar_campanha(campaign_id: str):
    return agents.parar_campanha(campaign_id)


@app.delete("/api/campaigns/{campaign_id}")
def remover_campanha(campaign_id: str):
    if not storage.delete_campaign(campaign_id):
        raise HTTPException(404, "Campanha não encontrada.")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Extratores
# ---------------------------------------------------------------------------

@app.post("/api/extractors/instagram", status_code=201)
def extrair_instagram_endpoint(dados: InstagramExtractIn):
    """Extrator de leads do Instagram (seguidores de um perfil).

    Sem igmapper configurado, gera mock de 5–10 leads (segurança anti-bloqueio
    de conta); com `lucasoal/igmapper` configurado em Ferramentas, executa o
    CLI real com as flags de isolamento de processos. Leads salvos em leads.json
    na coluna "Novos Leads".
    """
    conf = storage.get_config()["extratores"]
    cli = conf.get("igmapper_cli", "")

    origem = "mock"
    aviso = ""
    leads: list = []

    if cli and Path(cli).exists():
        # Scraper REAL configurado: executa e propaga erro amigavel (HTTP 500) se
        # falhar — nunca salvamos dados parciais/corrompidos.
        try:
            resultado = extractors.extrair_instagram(dados.profile_url, dados.limit)
            leads = resultado.get("leads", [])
            origem = "cli"
        except extractors.ExtratorNaoConfigurado as e:
            raise HTTPException(500, f"Scraper nao configurado corretamente: {e}")
        except extractors.ExtratorErro as e:
            raise HTTPException(500, str(e))

    if not leads:
        leads = extractors.gerar_mock_instagram(dados.profile_url, dados.limit)

    importados = storage.import_leads(leads)
    return {
        "origem": origem,
        "aviso": aviso,
        "extraidos": leads,
        "importados": importados["importados"],
        "duplicados": len(importados["duplicados"]),
    }


@app.post("/api/extractors/cnpj", status_code=201)
def extrair_cnpj_endpoint(dados: CnpjExtractIn):
    """Extrator de leads B2B (empresas) por CNAE + UF.

    Enquanto o provedor de busca em Ferramentas → Extratores for o placeholder
    padrão, gera mock de 5–10 empresas fictícias (nome fantasia, CNPJ,
    telefone/e-mail) — estabilidade e anti-bloqueio nesta fase. Com uma URL de
    provedor real configurada, consulta o provedor e degrada para mock em
    falha ou rate-limit. Leads salvos em leads.json na coluna "Novos Leads".
    """
    conf = storage.get_config()["extratores"]
    provedor = (conf.get("cnpj_provedor_busca") or "").strip()

    origem = "mock"
    aviso = ""
    leads: list = []

    if provedor and provedor != extractors.CNPJ_PROVEDOR_PADRAO:
        try:
            resultado = extractors.buscar_cnpj_cnae(dados.cnae, dados.uf, dados.limit)
            leads = resultado.get("leads", [])
            if leads:
                origem = "provedor"
            else:
                aviso = "O provedor de busca não retornou leads — usando dados mockados."
        except extractors.ExtratorErro as e:
            aviso = f"Provedor de busca indisponível ({e}); usando dados mockados."

    if not leads:
        leads = extractors.gerar_mock_cnpj(dados.cnae, dados.uf, dados.limit)

    importados = storage.import_leads(leads)
    return {
        "origem": origem,
        "aviso": aviso,
        "extraidos": leads,
        "importados": importados["importados"],
        "duplicados": len(importados["duplicados"]),
    }


@app.post("/api/extractors/maps", status_code=201)
def extrair_maps(dados: MapsExtractIn):
    """Extrator de leads do Google Maps.

    Se o scraper real (gosom/google-maps-scraper) estiver configurado em
    Ferramentas, usa o CLI com as flags de isolamento de processos; caso
    contrário, gera dados mockados (5 a 10 leads) para teste inicial, sem
    risco de bloqueio de IP. Os leads são salvos em leads.json na coluna
    "Novos Leads" (etapa inicial do Kanban).
    """
    conf = storage.get_config()["extratores"]
    cli = conf.get("google_maps_cli", "")
    max_resultados = max(1, min(dados.limit, 500))

    origem = "mock"
    aviso = ""
    leads: list = []

    if cli and Path(cli).exists():
        # Scraper REAL configurado: executa e propaga erro amigavel (HTTP 500)
        # se falhar — nunca salvamos dados parciais/corrompidos.
        try:
            resultado = extractors.extrair_google_maps(dados.keyword, dados.location, max_resultados)
            leads = resultado.get("leads", [])
            origem = "cli"
        except extractors.ExtratorNaoConfigurado as e:
            raise HTTPException(500, f"Scraper nao configurado corretamente: {e}")
        except extractors.ExtratorErro as e:
            raise HTTPException(500, str(e))

    if not leads:
        leads = extractors.gerar_mock_maps(dados.keyword, dados.location, dados.limit)

    importados = storage.import_leads(leads)
    return {
        "origem": origem,
        "aviso": aviso,
        "extraidos": leads,
        "importados": importados["importados"],
        "duplicados": len(importados["duplicados"]),
    }


@app.post("/api/extract/cnpj")
def consultar_cnpj(dados: CnpjIn):
    try:
        return extractors.consulta_cnpj(dados.cnpj)
    except extractors.ExtratorErro as e:
        raise HTTPException(502, str(e))


@app.post("/api/extract/cnpj/search")
def buscar_cnpj(dados: CnpjSearchIn):
    try:
        return extractors.buscar_cnpj_cnae(dados.cnae, dados.uf, dados.quantidade)
    except extractors.ExtratorErro as e:
        raise HTTPException(502, str(e))


# ---------------------------------------------------------------------------
# Agentes de IA (status + prompt do sistema)
# ---------------------------------------------------------------------------

@app.get("/api/agents")
def listar_agentes():
    """Status e prompt de cada agente (disparo / atendimento)."""
    agentes = storage.get_agents()
    llm_ok = llm.configurado()
    return {
        "llm_configurado": llm_ok,
        "agentes": {
            agent_id: {
                "status": agentes.get(agent_id, {}).get("status", "inativo"),
                "prompt": agentes.get(agent_id, {}).get("prompt", ""),
            }
            for agent_id in storage.AGENTE_IDS
        },
    }


@app.put("/api/agents/{agent_id}/status")
def alterar_status_agente(agent_id: str, dados: dict):
    """Liga/desliga um agente. Ativar o de disparo exige LLM configurada."""
    if agent_id not in storage.AGENTE_IDS:
        raise HTTPException(404, f"Agente desconhecido: {agent_id}. Use: disparo ou atendimento.")
    status = (dados.get("status") or "").strip().lower()
    if status not in ("ativo", "inativo"):
        raise HTTPException(400, 'Status inválido. Use: ativo ou inativo.')
    if status == "ativo" and agent_id == "disparo" and not llm.configurado():
        raise HTTPException(
            400,
            "Configure a API Key do LLM em Ferramentas antes de ativar o Agente de Disparo.",
        )
    agente = storage.save_agent(agent_id, {"status": status})
    return {"ok": True, "agent_id": agent_id, "status": agente["status"]}


@app.put("/api/agents/{agent_id}/prompt")
def salvar_prompt_agente(agent_id: str, dados: dict):
    """Salva o prompt do sistema do agente em agents.json."""
    if agent_id not in storage.AGENTE_IDS:
        raise HTTPException(404, f"Agente desconhecido: {agent_id}. Use: disparo ou atendimento.")
    prompt = dados.get("prompt")
    if prompt is None:
        raise HTTPException(400, "Informe o prompt do sistema.")
    agente = storage.save_agent(agent_id, {"prompt": str(prompt)})
    return {"ok": True, "agent_id": agent_id, "prompt": agente["prompt"]}


# ---------------------------------------------------------------------------
# Funil de Prospecção (métricas de conversão do CRM)
# ---------------------------------------------------------------------------

ETAPAS_FUNIL = ["Leads", "Em Contato", "Proposta", "Fechado"]


@app.get("/api/funnel")
def funil_prospeccao():
    """Métricas de conversão do funil, calculadas a partir do leads.json."""
    leads = storage.list_leads()
    quantidades = [
        sum(1 for l in leads if l.get("etapa") == etapa)
        for etapa in ("leads", "em_contato", "proposta", "fechado")
    ]
    etapas = [{"nome": nome, "quantidade": qtd} for nome, qtd in zip(ETAPAS_FUNIL, quantidades)]

    conversoes = []
    for i in range(len(ETAPAS_FUNIL) - 1):
        de, para = ETAPAS_FUNIL[i], ETAPAS_FUNIL[i + 1]
        if quantidades[i] > 0:
            taxa = round(quantidades[i + 1] / quantidades[i] * 100, 1)
            queda = round(100 - taxa, 1)
        else:
            taxa, queda = None, None
        conversoes.append({"de": de, "para": para, "taxa": taxa, "queda": queda})

    # Gargalo: etapa ORIGEM da maior queda entre etapas consecutivas — é onde os
    # leads param (ex.: muitos entram em "Em Contato" e não seguem).
    quedas = [c for c in conversoes if c["queda"] is not None and c["queda"] > 0]
    gargalo = max(quedas, key=lambda c: c["queda"])["de"] if quedas else None

    return {"etapas": etapas, "conversoes": conversoes, "gargalo": gargalo}


# ---------------------------------------------------------------------------
# Configuração e integrações
# ---------------------------------------------------------------------------

@app.get("/api/config")
def obter_config():
    """Configuração local (config.json) — segredos NUNCA são expostos (regra do
    AGENTS.md): campo devolvido vazio + flag `<campo>_configurado`."""
    return storage.redact_config(storage.get_config())


def _validar_patch(patch: dict) -> None:
    """Rejeita payload que quebraria a estrutura da config.

    Seções que são objetos no padrão (llm, extratores, integracoes...) precisam
    continuar objetos — um valor escalar no lugar corromperia o arquivo e a UI.
    Nenhum campo é obrigatório: o app roda com os defaults e valida credenciais
    apenas no momento da ação (regra do AGENTS.md — sem travas de pré-registo).
    """
    for chave, valor in patch.items():
        padrao = storage.DEFAULT_CONFIG.get(chave)
        if isinstance(padrao, dict) and not isinstance(valor, dict):
            raise HTTPException(422, f"O campo '{chave}' deve ser um objeto com os subcampos.")


def _aparar_textos(valor):
    """Nielsen (prevenção de erros): trim automático em textos antes de salvar —
    espaços acidentais no início/fim (copiar-e-colar de chaves) não quebram a
    credencial nem disparam falsos "inválido" depois."""
    if isinstance(valor, str):
        return valor.strip()
    if isinstance(valor, dict):
        return {k: _aparar_textos(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [_aparar_textos(v) for v in valor]
    return valor


def _salvar_config(patch: dict):
    _validar_patch(patch)
    storage.update_config(_aparar_textos(patch))
    return storage.redact_config(storage.get_config())


@app.put("/api/config")
@app.post("/api/config")
def salvar_config(patch: dict):
    """Salva a configuração em config.json (merge profundo, atômico, sob lock).

    POST e PUT são equivalentes (o frontend usa PUT). Segredos vazios mantêm o
    valor atual; textos recebem trim automático. Devolve a config mascarada.
    """
    return _salvar_config(patch)


@app.post("/api/config/test/llm")
def testar_llm():
    return llm.testar_conexao()


@app.post("/api/config/test/integracao")
def testar_integracao(dados: IntegracaoTestIn):
    import httpx

    try:
        r = httpx.get(dados.url, timeout=4)
        return {"ok": True, "status_http": r.status_code}
    except httpx.HTTPError as e:
        return {"ok": False, "mensagem": f"Sem resposta de {dados.url}: {e}"}


@app.get("/api/integrations/status")
def status_integracoes():
    return {
        "llm": llm.configurado(),
        "openoutreach": agents.disparo_configurado(),
        "pipecat": bool(storage.get_config()["integracoes"]["pipecat"].get("url")),
    }


# ---------------------------------------------------------------------------
# Agentes
# ---------------------------------------------------------------------------

@app.get("/api/agents/templates")
def obter_templates():
    return agents.obter_templates()


@app.put("/api/agents/templates")
def salvar_templates(patch: dict):
    return agents.salvar_templates(patch)


@app.post("/api/agents/templates/test")
def testar_template(dados: TemplateTestIn):
    return agents.testar_template(dados.template, dados.lead_id)


@app.post("/api/agents/attendance/chat")
def atendimento_chat(dados: ChatIn):
    return agents.atendimento_chat(dados.mensagens)


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------

@app.get("/api/webhook")
def obter_webhook():
    webhook = storage.get_config().get("webhook", {})
    return {
        "url": webhook.get("url", ""),
        "eventos": webhook.get("eventos", []),
        "ultimo_teste": webhook.get("ultimo_teste"),
    }


def _url_valida(url: str) -> bool:
    return isinstance(url, str) and (url.startswith("http://") or url.startswith("https://"))


@app.put("/api/webhook")
def salvar_webhook(patch: dict):
    config = storage.get_config()
    webhook = config.get("webhook", {})
    url = patch.get("url", webhook.get("url", ""))
    if url and not _url_valida(url):
        raise HTTPException(400, "URL inválida: deve começar com http:// ou https://.")
    webhook.update({k: v for k, v in patch.items() if k in ("url", "eventos")})
    storage.update_config({"webhook": webhook})
    return {
        "url": webhook.get("url", ""),
        "eventos": webhook.get("eventos", []),
        "ultimo_teste": webhook.get("ultimo_teste"),
    }


@app.post("/api/webhook/test")
def testar_webhook(dados: WebhookTestIn):
    if dados.url and not _url_valida(dados.url):
        raise HTTPException(400, "URL inválida: deve começar com http:// ou https://.")
    resultado = agents.testar_webhook(dados.url)
    if resultado.get("ok"):
        # Registra o último teste bem-sucedido no config.json.
        config = storage.get_config()
        webhook = config.get("webhook", {})
        webhook["ultimo_teste"] = storage.now_iso()
        storage.update_config({"webhook": webhook})
        resultado["ultimo_teste"] = webhook["ultimo_teste"]
    return resultado


# ---------------------------------------------------------------------------
# UI estática (modo npx / produção)
# ---------------------------------------------------------------------------

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        # Rotas de API inexistentes devolvem 404 JSON (não a página do SPA).
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(404, f"Rota /{full_path} não existe.")
        alvo = FRONTEND_DIST / full_path
        if full_path and alvo.is_file():
            return FileResponse(alvo)
        return FileResponse(FRONTEND_DIST / "index.html")
