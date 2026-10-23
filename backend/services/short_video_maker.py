"""Integração com o Short-Video-Maker (produção de Shorts 9:16).

API esperada: POST http://localhost:3123/api/short-video
Como o formato exato do projeto pode variar, a resposta bruta (truncada) é
sempre guardada no job para inspeção.
"""

import httpx

from . import storage


class ServicoIndisponivel(Exception):
    """Short-Video-Maker não está rodando — mensagem acionável."""


class ProducaoErro(Exception):
    """O serviço respondeu, mas a produção falhou."""


def _conf() -> dict:
    return storage.get_config()["integracoes"]["short_video_maker"]


def _url() -> str:
    return _conf()["url"].rstrip("/")


def verificar() -> bool:
    try:
        httpx.get(_url(), timeout=2)
        return True
    except httpx.HTTPError:
        return False


def criar_short(
    titulo: str,
    script: str,
    tema: str = "",
    voz: str = "pt-BR",
    duracao_segundos: int = 45,
) -> dict:
    """Envia o roteiro cortado para o Short-Video-Maker e devolve a resposta."""
    # Shorts usam o início do roteiro (gancho) — corte na primeira quebra limpa.
    corte = script[:1200]
    if len(script) > 1200:
        fim = corte.rfind(". ")
        corte = corte[: fim + 1] if fim > 400 else corte
    payload = {
        "title": titulo,
        "script": corte,
        "topic": tema or titulo,
        "voice": voz,
        "duration": duracao_segundos,
        "aspect": "9:16",
    }
    try:
        r = httpx.post(_url() + "/api/short-video", json=payload, timeout=300)
    except httpx.HTTPError as e:
        raise ServicoIndisponivel(
            f"Short-Video-Maker não respondeu em {_url()}. "
            "Inicie o serviço na porta 3123 e clique em Repetir."
        ) from e
    texto = r.text[:600]
    if r.status_code >= 400:
        raise ProducaoErro(f"Short-Video-Maker rejeitou a tarefa (HTTP {r.status_code}): {texto}")
    try:
        corpo = r.json()
    except ValueError:
        corpo = {"resposta_bruta": texto}
    return {"status_http": r.status_code, "resposta": corpo}
