"""Upload para YouTube com a estratégia do LeadMaster:

1. Upload primário via serviço local "YouTube-Video-Upload-Frontend-Api"
   (URL e caminhos configuráveis em Ferramentas → Upload YouTube).
2. Fallback opcional via CLI do `youtube-uploader-mcp`.
3. Publicação como **não listado**, aguardando 1h e mudando para **público**
   (agendamento feito pelo motor do pipeline).
4. Limite diário de 50 uploads (contagem local por data).

Erros são sempre acionáveis: como instalar/configurar cada peça.
"""

import subprocess
from datetime import date

import httpx

from . import storage


class UploadNaoConfigurado(Exception):
    pass


class LimiteDiarioExcedido(Exception):
    pass


class UploadErro(Exception):
    pass


def _conf() -> dict:
    return storage.get_config()["integracoes"]["youtube_upload"]


def _contagem() -> dict:
    return storage.get_config()["uploads"]


def verificar() -> bool:
    conf = _conf()
    if not conf.get("url"):
        return bool(conf.get("uploader_mcp_path"))
    try:
        httpx.get(conf["url"].rstrip("/"), timeout=2)
        return True
    except httpx.HTTPError:
        return False


def contagem_hoje() -> int:
    c = _contagem()
    hoje = date.today().isoformat()
    return c["contador"] if c.get("data") == hoje else 0


def _incrementar_contagem() -> None:
    config = storage.get_config()
    hoje = date.today().isoformat()
    uploads = config.setdefault("uploads", {"data": hoje, "contador": 0})
    if uploads.get("data") != hoje:
        uploads.update({"data": hoje, "contador": 0})
    uploads["contador"] = int(uploads.get("contador", 0)) + 1
    storage.update_config({"uploads": uploads})


def upload_video(titulo: str, descricao: str, arquivo: str = "", video_url: str = "", tags: str = "") -> dict:
    """Faz o upload como não listado. Retorna {video_id, url, modo, aviso}."""
    conf = _conf()

    limite = int(conf.get("limite_diario", 50))
    if contagem_hoje() >= limite:
        raise LimiteDiarioExcedido(
            f"Limite diário de {limite} uploads atingido (hoje: {contagem_hoje()}). "
            "O upload continua amanhã automaticamente — clique Repetir no job."
        )

    if conf.get("url"):
        resultado = _upload_via_servico(conf, titulo, descricao, arquivo, video_url, tags)
    elif conf.get("uploader_mcp_path"):
        resultado = _upload_via_mcp(conf, titulo, descricao, arquivo, video_url)
    else:
        raise UploadNaoConfigurado(
            "Nenhum uploader configurado. Em Ferramentas → Upload YouTube, informe a URL do "
            "YouTube-Video-Upload-Frontend-Api (primário) ou o caminho do youtube-uploader-mcp (fallback)."
        )
    _incrementar_contagem()
    return resultado


def _upload_via_servico(conf: dict, titulo: str, descricao: str, arquivo: str, video_url: str, tags: str) -> dict:
    base = conf["url"].rstrip("/")
    path = conf.get("upload_path", "/api/upload").lstrip("/")
    payload = {
        "title": titulo,
        "description": descricao,
        "tags": tags,
        "privacy": "unlisted",  # não listado → agenda de 1h → público
        "video_url": video_url,
        "video_file": arquivo,
        "api_key": conf.get("api_key", ""),
    }
    try:
        r = httpx.post(f"{base}/{path}", json=payload, timeout=600)
    except httpx.HTTPError as e:
        raise UploadErro(
            f"Uploader local ({base}) não respondeu: {e}. Confirme que o "
            "YouTube-Video-Upload-Frontend-Api está ativo e clique Repetir."
        ) from e
    if r.status_code >= 400:
        raise UploadErro(f"Uploader local rejeitou o vídeo (HTTP {r.status_code}): {r.text[:300]}")
    try:
        corpo = r.json()
    except ValueError:
        corpo = {"resposta_bruta": r.text[:300]}
    video_id = corpo.get("video_id") or corpo.get("videoId") or corpo.get("id") or ""
    return {
        "video_id": video_id,
        "url": corpo.get("url") or (f"https://youtu.be/{video_id}" if video_id else ""),
        "modo": "servico_local",
        "resposta": corpo,
    }


def _upload_via_mcp(conf: dict, titulo: str, descricao: str, arquivo: str, video_url: str) -> dict:
    cli = conf.get("uploader_mcp_path", "")
    if not arquivo:
        raise UploadErro("O fallback youtube-uploader-mcp precisa do arquivo de vídeo local (produza o vídeo primeiro).")
    try:
        resultado = subprocess.run(
            [cli, arquivo, "--title", titulo, "--description", descricao, "--privacy", "unlisted"],
            capture_output=True,
            text=True,
            timeout=3600,
            shell=False,
        )
    except FileNotFoundError as e:
        raise UploadNaoConfigurado(f"Caminho do youtube-uploader-mcp inválido: {e}") from e
    if resultado.returncode != 0:
        raise UploadErro(f"youtube-uploader-mcp falhou: {resultado.stderr[-400:]}")
    return {
        "video_id": resultado.stdout.strip().splitlines()[-1] if resultado.stdout.strip() else "",
        "url": resultado.stdout.strip().splitlines()[-1] if resultado.stdout.strip() else "",
        "modo": "uploader_mcp",
        "resposta": {"stdout": resultado.stdout[-500:]},
    }


def tornar_publico(video_id: str) -> dict:
    """Muda o vídeo de não listado para público (chamado pelo agendador)."""
    conf = _conf()
    if not conf.get("url"):
        raise UploadNaoConfigurado("Uploader local não configurado; publique manualmente o vídeo " f"{video_id}.")
    base = conf["url"].rstrip("/")
    path = conf.get("publicar_path", "/api/videos/{video_id}/publicar").lstrip("/")
    try:
        r = httpx.post(f"{base}/{path.format(video_id=video_id)}", json={"privacy": "public"}, timeout=60)
    except httpx.HTTPError as e:
        raise UploadErro(f"Falha ao publicar {video_id} via uploader local: {e}") from e
    if r.status_code >= 400:
        raise UploadErro(f"Uploader local recusou publicar {video_id} (HTTP {r.status_code}): {r.text[:300]}")
    return {"ok": True, "resposta": r.text[:300]}
