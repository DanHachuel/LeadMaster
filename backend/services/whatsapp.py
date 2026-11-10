"""Gateway de WhatsApp — OpenWA (padrão) com suporte opcional a WAHA.

O LeadMaster NÃO embute o gateway: ele consome a API REST de um serviço local
separado (OpenWA em http://127.0.0.1:2785 por padrão). Toda chamada externa
falha graciosamente com mensagem acionável — nunca finge envio.
"""

import httpx

from . import storage


class GatewayErro(Exception):
    """Gateway indisponível, sessão desconectada ou resposta inesperada."""


def _conf() -> dict:
    return storage.get_config()["integracoes"]["whatsapp"]


def configurado() -> bool:
    """Gateway só é usado quando o usuário o ativa em Ferramentas (sem gateway
    ativo, o worker permanece no modo simulação)."""
    c = _conf()
    return bool(c.get("enabled") and c.get("gateway_url"))


def _sessao() -> str:
    return _conf().get("session_id") or "default"


def _headers() -> dict:
    key = _conf().get("api_key") or ""
    return {"X-API-Key": key} if key else {}


def _base() -> str:
    return (_conf().get("gateway_url") or "http://127.0.0.1:2785").rstrip("/")


def _tipo() -> str:
    return (_conf().get("gateway_type") or "openwa").lower()


# ---------------------------------------------------------------------------
# Sessão e status
# ---------------------------------------------------------------------------

def status() -> dict:
    """estado: conectado | aguardando_qr | desconectado (+ detalhe cru)."""
    conf = _conf()
    url = _base()
    sid = _sessao()
    try:
        if _tipo() == "waha":
            r = httpx.get(f"{url}/api/sessions/{sid}", headers=_headers(), timeout=8)
        else:
            r = httpx.get(f"{url}/api/sessions/{sid}", headers=_headers(), timeout=8)
    except httpx.HTTPError as e:
        raise GatewayErro(
            f"Gateway WhatsApp não respondeu em {url}. Inicie o OpenWA (ou WAHA) "
            "e clique em Repetir."
        ) from e
    if r.status_code >= 400:
        raise GatewayErro(f"Gateway respondeu HTTP {r.status_code}: {r.text[:200]}")
    try:
        dados = r.json()
    except ValueError:
        raise GatewayErro("Gateway retornou resposta não-JSON no status.")
    bruto = str(dados.get("status") or dados.get("state") or "").upper()
    me = (dados.get("me") or {}) if isinstance(dados.get("me"), dict) else {}
    numero = me.get("id") or dados.get("number") or ""
    if "CONNECTED" in bruto or "WORKING" in bruto or bruto == "READY":
        estado = "conectado"
    elif "QR" in bruto or bruto == "SCANNING":
        estado = "aguardando_qr"
    else:
        estado = "desconectado"
    return {"estado": estado, "bruto": bruto, "numero": numero, "gateway_url": url}


def iniciar_sessao() -> dict:
    """Inicia (ou reinicia) a sessão — dispara a geração do QR Code."""
    url = _base()
    sid = _sessao()
    try:
        if _tipo() == "waha":
            r = httpx.post(f"{url}/api/sessions/start", json={"name": sid}, headers=_headers(), timeout=30)
        else:
            r = httpx.post(f"{url}/api/sessions/{sid}/start", headers=_headers(), timeout=30)
    except httpx.HTTPError as e:
        raise GatewayErro(f"Falha ao iniciar sessão no gateway ({url}): {e}") from e
    if r.status_code >= 400:
        raise GatewayErro(f"Gateway recusou o início da sessão (HTTP {r.status_code}): {r.text[:200]}")
    return {"ok": True, "status_http": r.status_code, "gateway_url": url}


def qr_bytes() -> tuple[bytes, str]:
    """Repassa o QR Code do gateway. Retorna (bytes, content_type)."""
    url = _base()
    sid = _sessao()
    try:
        if _tipo() == "waha":
            r = httpx.get(f"{url}/api/{sid}/auth/qr", headers=_headers(), timeout=15)
        else:
            r = httpx.get(f"{url}/api/sessions/{sid}/qr", headers=_headers(), timeout=15)
    except httpx.HTTPError as e:
        raise GatewayErro(f"Falha ao obter QR Code do gateway ({url}): {e}") from e
    if r.status_code >= 400:
        raise GatewayErro(
            f"QR Code indisponível (HTTP {r.status_code}). A sessão pode já estar "
            "conectada — confira o status."
        )
    content_type = r.headers.get("content-type", "image/png")
    return r.content, content_type


# ---------------------------------------------------------------------------
# Envio
# ---------------------------------------------------------------------------

def formatar_chat_id(telefone: str) -> str:
    """(11) 99999-9999 → 5511999999999@c.us (_openwa_ e waha usam o mesmo formato)."""
    digitos = "".join(c for c in (telefone or "") if c.isdigit())
    if not digitos:
        raise GatewayErro("Lead sem telefone não pode receber mensagem.")
    if not digitos.startswith("55") and len(digitos) <= 11:
        digitos = "55" + digitos
    return f"{digitos}@c.us"


def enviar_texto(telefone: str, mensagem: str) -> dict:
    """Envia mensagem de texto pelo gateway. Erros sobem como GatewayErro."""
    url = _base()
    sid = _sessao()
    chat_id = formatar_chat_id(telefone)
    try:
        if _tipo() == "waha":
            r = httpx.post(
                f"{url}/api/sendText",
                json={"session": sid, "chatId": chat_id, "text": mensagem},
                headers=_headers(),
                timeout=60,
            )
        else:
            r = httpx.post(
                f"{url}/api/sessions/{sid}/messages/send-text",
                json={"chatId": chat_id, "text": mensagem},
                headers=_headers(),
                timeout=60,
            )
    except httpx.HTTPError as e:
        raise GatewayErro(f"Falha de conexão com o gateway ({url}): {e}") from e
    if r.status_code >= 400:
        raise GatewayErro(f"Gateway recusou o envio (HTTP {r.status_code}): {r.text[:200]}")
    return {"ok": True, "chat_id": chat_id, "status_http": r.status_code}
