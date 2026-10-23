"""Agentes do LeadMaster:

- **Agente de disparo**: executa campanhas de envio (texto/áudio) via OpenOutreach.
- **Agente de atendimento**: chat por texto (LLM) ou voz (pipecat).
- **Webhooks**: eventos locais disparados para a URL configurada.
"""

import threading
import time

import httpx

from . import llm, storage


class AgenteIndisponivel(Exception):
    pass


# Controles por campanha: id → {"pausar": threading.Event, "parar": threading.Event}
_CONTROLES: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Templates e renderização
# ---------------------------------------------------------------------------

def obter_templates() -> dict:
    agentes = storage.get_config().get("agentes", {})
    return agentes.get("disparo", {}).get("templates", {})


def salvar_templates(patch: dict) -> dict:
    agentes = storage.get_config().get("agentes", {})
    templates = agentes.get("disparo", {}).get("templates", {})
    templates.update(patch)
    storage.update_config({"agentes": {"disparo": {"templates": templates}}})
    return templates


def render_template(texto: str, lead: dict) -> str:
    from .crm_agent import _score  # evita import circular no topo

    minha_empresa = storage.get_config().get("agentes", {}).get("disparo", {}).get("minha_empresa", "LeadMaster")
    primeiro_nome = (lead.get("nome") or "").split()[0] if lead.get("nome") else ""
    variaveis = {
        "nome": lead.get("nome", ""),
        "primeiro_nome": primeiro_nome,
        "empresa": lead.get("empresa") or lead.get("nome", ""),
        "telefone": lead.get("telefone", ""),
        "cidade": lead.get("cidade", ""),
        "minha_empresa": minha_empresa,
        "score": str(lead.get("score") or _score(lead)),
    }
    for chave, valor in variaveis.items():
        texto = texto.replace("{{" + chave + "}}", str(valor))
    return texto


def testar_template(texto: str, lead_id: str | None = None) -> dict:
    lead = None
    for l in storage.list_leads():
        if l.get("id") == lead_id:
            lead = l
            break
    if not lead:
        lead = {"nome": "Maria Exemplo", "empresa": "Empresa X", "cidade": "São Paulo/SP", "telefone": "(11) 90000-0000"}
    return {"renderizado": render_template(texto, lead)}


# ---------------------------------------------------------------------------
# Agente de disparo (campanhas via OpenOutreach)
# ---------------------------------------------------------------------------

def disparo_configurado() -> bool:
    o = storage.get_config()["integracoes"]["openoutreach"]
    return bool(o.get("url") and o.get("enabled", True))


def iniciar_campanha(campaign_id: str) -> dict:
    campaign = storage.get_campaign(campaign_id)
    if not campaign:
        return {"ok": False, "mensagem": "Campanha não encontrada."}
    if not disparo_configurado():
        return {
            "ok": False,
            "mensagem": (
                "OpenOutreach não configurado — valide a URL e ative a integração em "
                "Ferramentas → OpenOutreach para poder disparar."
            ),
        }
    if campaign.get("status") == "em_andamento":
        return {"ok": False, "mensagem": "Campanha já está em andamento."}

    controles = {"pausar": threading.Event(), "parar": threading.Event()}
    _CONTROLES[campaign_id] = controles
    campaign["status"] = "em_andamento"
    campaign["iniciada_em"] = storage.now_iso()
    campaign.setdefault("enviadas", 0)
    campaign.setdefault("erros", 0)
    campaign.setdefault("eventos", [])
    storage.upsert_campaign(campaign)

    threading.Thread(target=_executar_campanha, args=(campaign_id,), daemon=True).start()
    return {"ok": True, "mensagem": "Campanha iniciada."}


def pausar_campanha(campaign_id: str) -> dict:
    controles = _CONTROLES.get(campaign_id)
    if not controles:
        return {"ok": False, "mensagem": "Campanha não está em execução."}
    controles["pausar"].set()
    return {"ok": True, "mensagem": "Pausa solicitada; concluída após o envio em andamento."}


def parar_campanha(campaign_id: str) -> dict:
    controles = _CONTROLES.get(campaign_id)
    if not controles:
        return {"ok": False, "mensagem": "Campanha não está em execução."}
    controles["parar"].set()
    return {"ok": True, "mensagem": "Parada solicitada."}


def _executar_campanha(campaign_id: str) -> None:
    conf = storage.get_config()
    o = conf["integracoes"]["openoutreach"]
    base = o["url"].rstrip("/")
    send_path = o.get("send_path", "/api/send").lstrip("/")
    delay = int(conf.get("agentes", {}).get("disparo", {}).get("delay_entre_envios_segundos", 3))
    templates = obter_templates()

    campaign = storage.get_campaign(campaign_id)
    leads = {l["id"]: l for l in storage.list_leads() if l["id"] in set(campaign.get("lead_ids", []))}
    campaign["total"] = len(leads)

    for lead_id in campaign.get("lead_ids", []):
        controles = _CONTROLES.get(campaign_id)
        if controles and controles["parar"].is_set():
            campaign["status"] = "pausada"
            storage.upsert_campaign(campaign)
            return
        if controles and controles["pausar"].is_set():
            campaign["status"] = "pausada"
            storage.upsert_campaign(campaign)
            return

        lead = leads.get(lead_id)
        momento = storage.now_iso()
        if not lead:
            campaign["erros"] += 1
            campaign["eventos"].append({"lead_id": lead_id, "status": "erro", "mensagem": "Lead removido da base.", "momento": momento})
            storage.upsert_campaign(campaign)
            continue

        mensagem = render_template(templates.get(campaign.get("canal", "texto"), templates.get("texto", "")), lead)
        try:
            r = httpx.post(
                f"{base}/{send_path}",
                json={
                    "canal": campaign.get("canal", "texto"),
                    "destino": lead.get("telefone") or lead.get("email"),
                    "mensagem": mensagem,
                    "lead_id": lead_id,
                    "campanha": campaign["nome"],
                },
                timeout=60,
            )
            ok = r.status_code < 400
            detalhe = "" if ok else f"HTTP {r.status_code}: {r.text[:200]}"
        except httpx.HTTPError as e:
            ok, detalhe = False, f"Falha de conexão com OpenOutreach: {e}"

        if ok:
            campaign["enviadas"] += 1
            campaign["eventos"].append({"lead_id": lead_id, "status": "enviado", "mensagem": detalhe, "momento": momento})
        else:
            campaign["erros"] += 1
            campaign["eventos"].append({"lead_id": lead_id, "status": "erro", "mensagem": detalhe or "Erro no envio.", "momento": momento})
        storage.upsert_campaign(campaign)
        time.sleep(max(0, delay))

    campaign["status"] = "concluida"
    campaign["concluida_em"] = storage.now_iso()
    storage.upsert_campaign(campaign)
    disparar_webhook("campanha.concluida", {"campanha_id": campaign_id, "nome": campaign["nome"]})
    _CONTROLES.pop(campaign_id, None)


# ---------------------------------------------------------------------------
# Agente de atendimento (texto via LLM / voz via pipecat)
# ---------------------------------------------------------------------------

def atendimento_chat(mensagens: list) -> dict:
    modo = storage.get_config().get("agentes", {}).get("atendimento", {}).get("modo", "texto")
    if modo == "voz":
        url = storage.get_config()["integracoes"]["pipecat"].get("url", "")
        if not url:
            return {"ok": False, "mensagem": "Modo voz selecionado, mas pipecat não configurado (Ferramentas → Integrações)."}
        try:
            r = httpx.post(url.rstrip("/") + "/chat", json={"messages": mensagens}, timeout=120)
            r.raise_for_status()
            return {"ok": True, "resposta": r.json().get("resposta", "")}
        except httpx.HTTPError as e:
            return {"ok": False, "mensagem": f"pipecat não respondeu ({url}): {e}"}

    try:
        resposta = llm.chat(mensagens, temperature=0.5, max_tokens=800)
        return {"ok": True, "resposta": resposta}
    except llm.LLMNaoConfigurado as e:
        return {"ok": False, "mensagem": str(e)}
    except llm.LLMErro as e:
        return {"ok": False, "mensagem": str(e)}


# ---------------------------------------------------------------------------
# Webhook local
# ---------------------------------------------------------------------------

def disparar_webhook(evento: str, payload: dict) -> None:
    conf = storage.get_config().get("webhook", {})
    url = conf.get("url", "")
    if not url or evento not in conf.get("eventos", []):
        return
    try:
        httpx.post(url, json={"evento": evento, "dados": payload, "momento": storage.now_iso()}, timeout=10)
    except httpx.HTTPError:
        pass  # webhook é best-effort; erros não podem travar o fluxo principal


def testar_webhook(url: str) -> dict:
    try:
        r = httpx.post(url, json={"evento": "teste.leadmaster", "dados": {"ok": True}, "momento": storage.now_iso()}, timeout=10)
        return {"ok": r.status_code < 400, "status_http": r.status_code, "resposta": r.text[:300]}
    except httpx.HTTPError as e:
        return {"ok": False, "mensagem": f"Falha de conexão: {e}"}
