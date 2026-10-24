"""LeadMaster — API FastAPI (100% local).

Rotas da aplicação + serving estático da UI construída (frontend/dist) para o
modo `npx`, onde um único servidor entrega painel e API na mesma porta.
"""

import json
import os
import platform
import sys
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
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


class LeadsImportIn(BaseModel):
    leads: list[dict]


class CampaignIn(BaseModel):
    nome: str = Field(min_length=1)
    canal: str = "texto"
    template: str = "texto"
    lead_ids: list[str] = []


class GoogleMapsIn(BaseModel):
    palavra_chave: str = Field(min_length=2)
    localizacao: str = Field(min_length=2)
    max_resultados: int = 100


class InstagramIn(BaseModel):
    profile_url: str = Field(min_length=6)


class CnpjIn(BaseModel):
    cnpj: str = Field(min_length=8)


class CnpjSearchIn(BaseModel):
    cnae: str = Field(min_length=2)
    uf: str = Field(min_length=2)
    quantidade: int = 20


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
# Campanhas / Disparos
# ---------------------------------------------------------------------------

@app.get("/api/campaigns")
def listar_campanhas():
    return storage.list_campaigns()


@app.post("/api/campaigns", status_code=201)
def criar_campanha(campaign_in: CampaignIn):
    campaign = campaign_in.model_dump()
    campaign["id"] = storage._novo_id()
    campaign.update({"status": "rascunho", "total": len(campaign["lead_ids"]), "enviadas": 0, "erros": 0, "eventos": [], "criado_em": storage.now_iso()})
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

@app.post("/api/extract/google-maps")
def extrair_google_maps(dados: GoogleMapsIn):
    try:
        return extractors.extrair_google_maps(dados.palavra_chave, dados.localizacao, dados.max_resultados)
    except extractors.ExtratorNaoConfigurado as e:
        raise HTTPException(400, str(e))
    except extractors.ExtratorErro as e:
        raise HTTPException(502, str(e))


@app.post("/api/extract/instagram")
def extrair_instagram(dados: InstagramIn):
    try:
        return extractors.extrair_instagram(dados.profile_url)
    except extractors.ExtratorNaoConfigurado as e:
        raise HTTPException(400, str(e))
    except extractors.ExtratorErro as e:
        raise HTTPException(502, str(e))


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
# Configuração e integrações
# ---------------------------------------------------------------------------

@app.get("/api/config")
def obter_config():
    return storage.redact_config(storage.get_config())


@app.put("/api/config")
def salvar_config(patch: dict):
    storage.update_config(patch)
    return storage.redact_config(storage.get_config())


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
    return storage.get_config().get("webhook", {})


@app.put("/api/webhook")
def salvar_webhook(patch: dict):
    config = storage.get_config()
    webhook = config.get("webhook", {})
    webhook.update({k: v for k, v in patch.items() if k in ("url", "eventos")})
    storage.update_config({"webhook": webhook})
    return webhook


@app.post("/api/webhook/test")
def testar_webhook(dados: WebhookTestIn):
    return agents.testar_webhook(dados.url)


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
