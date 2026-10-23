"""Extratores de leads: Google Maps, Instagram e CNPJ.

Princípios:
- Nenhuma extração importa automaticamente: o frontend pré-visualiza e o
  usuário confirma a importação.
- Toda integração externa falha graciosamente com instruções acionáveis.
- Os comandos de CLI usam templates de argumentos configuráveis, porque as
  flags dos projetos upstream podem variar entre versões.
"""

import csv
import json
import subprocess
import tempfile
from pathlib import Path

import httpx

from . import storage


class ExtratorNaoConfigurado(Exception):
    pass


class ExtratorErro(Exception):
    pass


def _conf() -> dict:
    return storage.get_config()["extratores"]


def _novo_lead_parcial() -> dict:
    return {"tags": [], "observacoes": "", "score": 50}


# ---------------------------------------------------------------------------
# Google Maps (gosom/google-maps-scraper via CLI)
# ---------------------------------------------------------------------------

def extrair_google_maps(palavra_chave: str, localizacao: str, max_resultados: int = 100) -> dict:
    conf = _conf()
    cli = conf.get("google_maps_cli", "")
    if not cli or not Path(cli).exists():
        raise ExtratorNaoConfigurado(
            "Google Maps Scraper não configurado. Instale https://github.com/gosom/google-maps-scraper "
            "e informe o caminho do binário em Ferramentas → Extratores."
        )
    with tempfile.TemporaryDirectory(prefix="leadmaster-maps-") as tmp:
        outdir = Path(tmp)
        args_template = conf.get(
            "google_maps_args",
            '--kw "{palavra_chave}" --loc "{localizacao}" --lang pt --email --max {max_resultados} --outdir "{outdir}"',
        )
        cmd = [cli] + _formatar_args(
            args_template,
            palavra_chave=palavra_chave,
            localizacao=localizacao,
            max_resultados=max_resultados,
            outdir=str(outdir),
        )
        try:
            resultado = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, shell=False)
        except FileNotFoundError as e:
            raise ExtratorNaoConfigurado(f"Não foi possível executar o CLI do Google Maps Scraper: {e}") from e
        if resultado.returncode != 0:
            raise ExtratorErro(
                f"Google Maps Scraper terminou com código {resultado.returncode}: {resultado.stderr[-400:]}. "
                "Confira as flags do template em Ferramentas → Extratores."
            )
        leads = _parse_resultados_diretorio(outdir, fonte="Google Maps")
    return {"leads": leads, "comando": " ".join(cmd[:4]) + " ..."}


# ---------------------------------------------------------------------------
# Instagram (lucasoal/igmapper via CLI)
# ---------------------------------------------------------------------------

def extrair_instagram(profile_url: str) -> dict:
    conf = _conf()
    cli = conf.get("igmapper_cli", "")
    if not cli or not Path(cli).exists():
        raise ExtratorNaoConfigurado(
            "igmapper não configurado. Instale https://github.com/lucasoal/igmapper "
            "e informe o caminho em Ferramentas → Extratores."
        )
    with tempfile.TemporaryDirectory(prefix="leadmaster-ig-") as tmp:
        outdir = Path(tmp)
        args_template = conf.get("igmapper_args", "--profile {url} --outdir {outdir}")
        cmd = [cli] + _formatar_args(args_template, url=profile_url, outdir=str(outdir))
        try:
            resultado = subprocess.run(cmd, capture_output=True, text=True, timeout=900, shell=False)
        except FileNotFoundError as e:
            raise ExtratorNaoConfigurado(f"Não foi possível executar o igmapper: {e}") from e
        if resultado.returncode != 0:
            raise ExtratorErro(f"igmapper terminou com código {resultado.returncode}: {resultado.stderr[-400:]}")
        leads = _parse_resultados_diretorio(outdir, fonte="Instagram")
    if not leads:
        raise ExtratorErro(
            "igmapper rodou mas não retornou dados reconhecíveis. Confira o formato de saída "
            "(esperado CSV/JSON com username, full_name, followers, phone, email)."
        )
    return {"leads": leads, "comando": " ".join(cmd[:4]) + " ..."}


# ---------------------------------------------------------------------------
# CNPJ — consulta direta (BrasilAPI) e busca por CNAE/UF (provedor configurável)
# ---------------------------------------------------------------------------

def _so_digitos(texto: str) -> str:
    return "".join(c for c in texto or "" if c.isdigit())


def consulta_cnpj(cnpj: str) -> dict:
    cnpj = _so_digitos(cnpj)
    if len(cnpj) != 14:
        raise ExtratorErro("CNPJ inválido: use 14 dígitos (com ou sem pontuação).")
    try:
        r = httpx.get(f"https://brasilapi.com.br/api/cnpj/v1/{cnpj}", timeout=30)
    except httpx.HTTPError as e:
        raise ExtratorErro(f"Falha ao consultar a BrasilAPI: {e}") from e
    if r.status_code == 404:
        raise ExtratorErro("CNPJ não encontrado na BrasilAPI.")
    if r.status_code >= 400:
        raise ExtratorErro(f"BrasilAPI respondeu HTTP {r.status_code}: {r.text[:200]}")
    d = r.json()
    endereco = " ".join(
        p
        for p in [
            d.get("logradouro"),
            d.get("numero"),
            d.get("bairro"),
        ]
        if p
    )
    lead = _novo_lead_parcial()
    lead.update(
        {
            "nome": d.get("razao_social") or d.get("nome_fantasia") or "",
            "empresa": d.get("nome_fantasia") or d.get("razao_social") or "",
            "cnpj": cnpj,
            "telefone": d.get("ddd_telefone_1") or "",
            "endereco": endereco,
            "cidade": f"{d.get('municipio', '')}/{d.get('uf', '')}",
            "email": "",
            "fonte": "CNPJ",
            "etapa": "leads",
        }
    )
    lead["score"] = 55
    return lead


def buscar_cnpj_cnae(cnae: str, uf: str, quantidade: int = 20) -> dict:
    """Busca empresas por CNAE + UF no provedor configurável (padrão: OpenCNPJ).

    O formato pode variar; o parser é tolerante (aceita lista, {"results": ...},
    {"data": ...} e vários nomes de campos).
    """
    conf = _conf()
    base = (conf.get("cnpj_provedor_busca") or "https://api.opencnpj.org").rstrip("/")
    params = {"cnae": _so_digitos(cnae), "uf": uf.strip().upper(), "quantidade": str(max(1, min(quantidade, 100)))}
    try:
        r = httpx.get(base, params=params, timeout=60)
    except httpx.HTTPError as e:
        raise ExtratorErro(
            f"Falha ao consultar o provedor de busca ({base}): {e}. "
            "Verifique a URL do provedor em Ferramentas → Extratores."
        ) from e
    if r.status_code >= 400:
        raise ExtratorErro(
            f"Provedor de busca ({base}) respondeu HTTP {r.status_code}: {r.text[:200]}. "
            "O provedor é configurável em Ferramentas → Extratores."
        )
    try:
        corpo = r.json()
    except ValueError:
        raise ExtratorErro(f"Provedor de busca devolveu resposta não-JSON: {r.text[:200]}")
    itens = []
    if isinstance(corpo, list):
        itens = corpo
    elif isinstance(corpo, dict):
        itens = corpo.get("results") or corpo.get("data") or corpo.get("items") or []
    leads = []
    for item in itens[:quantidade]:
        if not isinstance(item, dict):
            continue
        lead = _novo_lead_parcial()
        lead.update(
            {
                "nome": _primeiro(item, "razao_social", "nome", "razaoSocial", "company_name"),
                "empresa": _primeiro(item, "nome_fantasia", "fantasia", "nomeFantasia", "trade_name") or "",
                "cnpj": _so_digitos(_primeiro(item, "cnpj", "cnpj_raiz", "document")),
                "telefone": _primeiro(item, "telefone", "phone", "ddd_telefone_1") or "",
                "email": _primeiro(item, "email", "contact_email") or "",
                "cidade": f"{_primeiro(item, 'municipio', 'city', 'municipio') or ''}/{_primeiro(item, 'uf', 'state', 'uf') or ''}",
                "fonte": "CNPJ",
                "etapa": "leads",
            }
        )
        lead["score"] = 45
        leads.append(lead)
    return {"leads": leads, "provedor": base}


def enriquecer_com_site(website: str) -> dict:
    """Scraping profundo de contatos no site da empresa, via Scrapling (opcional)."""
    conf = _conf()
    cli = conf.get("scrapling_cli", "")
    if not cli or not Path(cli).exists():
        raise ExtratorNaoConfigurado(
            "Scrapling não configurado. Instale https://github.com/D4Vinci/Scrapling "
            "e informe o caminho em Ferramentas → Extratores."
        )
    try:
        resultado = subprocess.run(
            [cli, "extract", website],
            capture_output=True,
            text=True,
            timeout=300,
            shell=False,
        )
    except FileNotFoundError as e:
        raise ExtratorNaoConfigurado(f"Não foi possível executar o Scrapling: {e}") from e
    if resultado.returncode != 0:
        raise ExtratorErro(f"Scrapling falhou: {resultado.stderr[-400:]}")
    return {"saidas": resultado.stdout[-2000:]}


# ---------------------------------------------------------------------------
# Utilitários de parsing tolerante
# ---------------------------------------------------------------------------

def _primeiro(d: dict, *chaves: str):
    for chave in chaves:
        if d.get(chave):
            return d[chave]
    return ""


def _formatar_args(template: str, **valores: str) -> list[str]:
    """Converte '--kw "a b" --n 5' em ['--kw', 'a b', '--n', '5'] respeitando aspas."""
    texto = template.format(**valores)
    partes, atual, aspas = [], "", None
    for ch in texto:
        if ch in "\"'":
            aspas = None if aspas == ch else ch
            continue
        if ch == " " and not aspas:
            if atual:
                partes.append(atual)
            atual = ""
        else:
            atual += ch
    if atual:
        partes.append(atual)
    return partes


def _mapear_linha(linha: dict, fonte: str) -> dict:
    lead = _novo_lead_parcial()
    nome = _primeiro(linha, "nome", "name", "title", "razao_social", "full_name", "username")
    lead.update(
        {
            "nome": nome or "Sem nome",
            "telefone": _primeiro(linha, "telefone", "phone", "phone_number", "public_phone", "ddd_telefone_1"),
            "email": _primeiro(linha, "email", "email_address", "business_email"),
            "empresa": _primeiro(linha, "empresa", "company", "site_name", "nome_fantasia"),
            "endereco": _primeiro(linha, "endereco", "address", "full_address", "street"),
            "cidade": _primeiro(linha, "cidade", "city", "locality"),
            "site": _primeiro(linha, "site", "website", "web_site"),
            "fonte": fonte,
            "etapa": "leads",
        }
    )
    extras = {}
    if _primeiro(linha, "rating", "nota"):
        extras["avaliacao"] = linha.get("rating") or linha.get("nota")
    if _primeiro(linha, "reviews", "avaliacoes"):
        extras["qtd_avaliacoes"] = linha.get("reviews") or linha.get("avaliacoes")
    if _primeiro(linha, "followers", "seguidores"):
        extras["seguidores"] = linha.get("followers") or linha.get("seguidores")
    if _primeiro(linha, "biography", "bio"):
        extras["bio"] = (linha.get("biography") or linha.get("bio"))[:200]
    lead["extras"] = extras
    lead["score"] = 40 + (10 if lead["telefone"] else 0) + (10 if lead["email"] else 0)
    return lead


def _parse_resultados_diretorio(outdir: Path, fonte: str) -> list:
    leads = []
    for arquivo in sorted(outdir.iterdir()):
        if arquivo.suffix.lower() == ".csv":
            with arquivo.open(encoding="utf-8-sig", newline="") as fh:
                for linha in csv.DictReader(fh):
                    lead = _mapear_linha(linha, fonte)
                    if lead["nome"] != "Sem nome":
                        leads.append(lead)
        elif arquivo.suffix.lower() == ".json":
            try:
                dados = json.loads(arquivo.read_text(encoding="utf-8"))
            except (ValueError, OSError):
                continue
            itens = dados if isinstance(dados, list) else [dados]
            for item in itens:
                if isinstance(item, dict):
                    lead = _mapear_linha(item, fonte)
                    if lead["nome"] != "Sem nome":
                        leads.append(lead)
    # dedup por telefone/email
    vistos, unicos = set(), []
    for lead in leads:
        chave = (lead.get("telefone") or "", (lead.get("email") or "").lower())
        if chave[0] and chave[0] in vistos:
            continue
        if chave[1] and chave[1] in vistos:
            continue
        vistos.add(chave[0])
        vistos.add(chave[1])
        unicos.append(lead)
    return unicos
