"""Persistência 100% local em arquivos JSON.

Toda a escrita é atômica (arquivo temporário + replace) e protegida por um lock
global, para permitir o uso concorrente pelas rotas da API e pelos workers em
background (pipeline, campanhas, agendador de publicação).
"""

import json
import os
import threading
from datetime import datetime
from pathlib import Path

LOCK = threading.RLock()

# Campos que nunca podem vazar para o frontend.
SECRET_KEYS = {"api_key", "token", "senha", "password"}

LEADS_FILE = "leads.json"
CAMPAIGNS_FILE = "campaigns.json"
PIPELINE_FILE = "pipeline.json"
CONFIG_FILE = "config.json"


# ---------------------------------------------------------------------------
# Caminhos
# ---------------------------------------------------------------------------

def _repo_root() -> Path:
    """Raiz do repositório (pasta que contém backend/). storage.py está em
    backend/services/, então sobe três níveis."""
    return Path(__file__).resolve().parent.parent.parent


def get_home() -> Path:
    """Pasta de dados (home). Ordem: env LEADMASTER_HOME → raiz do repo."""
    env = os.environ.get("LEADMASTER_HOME")
    if env:
        return Path(env).resolve()
    return _repo_root()


def storage_dir() -> Path:
    d = get_home() / "storage"
    d.mkdir(parents=True, exist_ok=True)
    return d


def roteiros_dir() -> Path:
    d = get_home() / "roteiros"
    d.mkdir(parents=True, exist_ok=True)
    return d


def videos_dir() -> Path:
    d = get_home() / "videos"
    d.mkdir(parents=True, exist_ok=True)
    return d


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Leitura/escrita atômica
# ---------------------------------------------------------------------------

def _read(name: str, default):
    with LOCK:
        path = storage_dir() / name
        if not path.exists():
            return default
        try:
            # utf-8-sig: tolera BOM (comum em arquivos editados no Windows
            # por PowerShell/Notepad) e é idêntico a utf-8 quando não há BOM.
            return json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError:
            # Arquivo corrompido: preserva uma cópia para inspeção manual
            # e devolve o padrão para não travar a aplicação.
            try:
                path.rename(path.with_suffix(path.suffix + ".corrompido"))
            except OSError:
                pass
            return default


def _write(name: str, data) -> None:
    with LOCK:
        path = storage_dir() / name
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp.replace(path)


# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

DEFAULT_CONFIG = {
    "perfil": {
        "nome": "Dan",
        "licenca": {
            "ativa": True,
            "expira_em": "31/12/2099 23:59",
            "restam_dias": None,
        },
    },
    "llm": {
        "provedor": "openai-compat",
        "base_url": "https://api.openai.com/v1",
        "api_key": "",
        "modelo": "gpt-4o-mini",
    },
    "integracoes": {
        "moneyprinter": {"url": "http://localhost:8080"},
        "short_video_maker": {"url": "http://localhost:3123"},
        "openmontage": {"cli_path": ""},
        "youtube_upload": {
            "url": "",
            "api_key": "",
            "upload_path": "/api/upload",
            "publicar_path": "/api/videos/{video_id}/publicar",
            "modo": "nao_listado_1h_publico",
            "limite_diario": 50,
            "espera_publicacao_horas": 1,
            "uploader_mcp_path": "",
        },
        "openoutreach": {"url": "", "send_path": "/api/send"},
        "pipecat": {"url": ""},
    },
    "extratores": {
        "google_maps_cli": "",
        "google_maps_args": (
            '--kw "{palavra_chave}" --loc "{localizacao}" --lang pt --email --max {max_resultados} --outdir "{outdir}"'
        ),
        "igmapper_cli": "",
        "igmapper_args": "--profile {url} --outdir {outdir}",
        "scrapling_cli": "",
        "cnpj_provedor_busca": "https://api.opencnpj.org",
    },
    "agentes": {
        "disparo": {
            "templates": {
                "texto": (
                    "Olá {{primeiro_nome}}! Sou da {{minha_empresa}} e ajudo empresas como "
                    "{{empresa}} a crescerem com conteúdo automatizado no YouTube. "
                    "Posso te enviar uma proposta rápida?"
                ),
                "audio": "Olá {{primeiro_nome}}, tudo bem? Falo em nome da {{minha_empresa}}...",
            },
            "minha_empresa": "LeadMaster",
            "delay_entre_envios_segundos": 3,
        },
        "atendimento": {"modo": "texto"},
    },
    "webhook": {
        "url": "",
        "eventos": ["lead.criado", "lead.etapa", "campanha.concluida", "video.publicado"],
    },
    "uploads": {"data": "", "contador": 0},
}


def _deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def _deep_merge_preserve_secrets(base: dict, override: dict) -> dict:
    """Deep merge que ignora valores vazios em campos de segredo (manter atual)."""
    out = dict(base)
    for key, value in override.items():
        if key in SECRET_KEYS and (value == "" or value is None) and key in out:
            continue
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge_preserve_secrets(out[key], value)
        else:
            out[key] = value
    return out


def get_config() -> dict:
    return _deep_merge(DEFAULT_CONFIG, _read(CONFIG_FILE, {}))


def update_config(patch: dict) -> dict:
    with LOCK:
        atual = get_config()
        novo = _deep_merge_preserve_secrets(atual, patch)
        _write(CONFIG_FILE, novo)
        return novo


def redact_config(config: dict) -> dict:
    """Copia a config substituindo segredos por vazio + flag `_configurado`."""
    out = {}
    for key, value in config.items():
        if isinstance(value, dict):
            out[key] = redact_config(value)
        elif key in SECRET_KEYS:
            out[key] = ""
            out[f"{key}_configurado"] = bool(value)
        else:
            out[key] = value
    return out


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------

def list_leads() -> list:
    return _read(LEADS_FILE, [])


def save_leads(leads: list) -> None:
    _write(LEADS_FILE, leads)


def add_lead(lead: dict) -> dict:
    with LOCK:
        leads = list_leads()
        lead["criado_em"] = lead.get("criado_em") or now_iso()
        lead["atualizado_em"] = now_iso()
        leads.append(lead)
        save_leads(leads)
        return lead


def update_lead(lead_id: str, patch: dict) -> dict | None:
    with LOCK:
        leads = list_leads()
        for lead in leads:
            if lead.get("id") == lead_id:
                lead.update(patch)
                lead["atualizado_em"] = now_iso()
                save_leads(leads)
                return lead
        return None


def delete_lead(lead_id: str) -> bool:
    with LOCK:
        leads = list_leads()
        restantes = [l for l in leads if l.get("id") != lead_id]
        if len(restantes) == len(leads):
            return False
        save_leads(restantes)
        return True


def import_leads(novos: list, dedup: bool = True) -> dict:
    """Importa leads em massa; retorna {importados, duplicados}."""
    with LOCK:
        leads = list_leads()
        existentes = {
            (l.get("telefone") or "").strip(),
            (l.get("email") or "").strip().lower(),
        }
        importados, duplicados = [], []
        for novo in novos:
            tel = (novo.get("telefone") or "").strip()
            email = (novo.get("email") or "").strip().lower()
            if dedup and ((tel and tel in existentes) or (email and email in existentes)):
                duplicados.append(novo)
                continue
            novo.setdefault("id", _novo_id())
            novo["criado_em"] = now_iso()
            novo["atualizado_em"] = now_iso()
            leads.append(novo)
            existentes.add(tel)
            existentes.add(email)
            importados.append(novo)
        save_leads(leads)
        return {"importados": importados, "duplicados": duplicados}


def _novo_id() -> str:
    import uuid

    return uuid.uuid4().hex[:12]


# ---------------------------------------------------------------------------
# Campanhas
# ---------------------------------------------------------------------------

def list_campaigns() -> list:
    return _read(CAMPAIGNS_FILE, [])


def save_campaigns(campaigns: list) -> None:
    _write(CAMPAIGNS_FILE, campaigns)


def upsert_campaign(campaign: dict) -> dict:
    with LOCK:
        campaigns = list_campaigns()
        for i, c in enumerate(campaigns):
            if c.get("id") == campaign["id"]:
                campaigns[i] = campaign
                break
        else:
            campaigns.append(campaign)
        save_campaigns(campaigns)
        return campaign


def get_campaign(campaign_id: str) -> dict | None:
    for c in list_campaigns():
        if c.get("id") == campaign_id:
            return c
    return None


def delete_campaign(campaign_id: str) -> bool:
    with LOCK:
        campaigns = list_campaigns()
        restantes = [c for c in campaigns if c.get("id") != campaign_id]
        if len(restantes) == len(campaigns):
            return False
        save_campaigns(restantes)
        return True


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def list_jobs() -> list:
    data = _read(PIPELINE_FILE, {"jobs": []})
    if isinstance(data, list):  # tolerância a formato antigo
        data = {"jobs": data}
    return data.get("jobs", [])


def save_jobs(jobs: list) -> None:
    _write(PIPELINE_FILE, {"jobs": jobs})


def get_job(job_id: str) -> dict | None:
    for j in list_jobs():
        if j.get("id") == job_id:
            return j
    return None


def upsert_job(job: dict) -> dict:
    with LOCK:
        jobs = list_jobs()
        for i, j in enumerate(jobs):
            if j.get("id") == job["id"]:
                jobs[i] = job
                break
        else:
            jobs.append(job)
        save_jobs(jobs)
        return job


# ---------------------------------------------------------------------------
# Seeds (primeira execução)
# ---------------------------------------------------------------------------

def _seed_leads() -> list:
    """Leads de demonstração para o painel nascer com vida."""
    modelos = [
        ("Construtora Horizonte Ltda", "(11) 3344-5566", "contato@horizonte.com.br", "CNPJ", "leads", "Construtora Horizonte", "São Paulo/SP", 62),
        ("Clínica Bem Viver", "(11) 98877-1122", "contato@bemviver.com.br", "Google Maps", "leads", "Clínica Bem Viver", "Campinas/SP", 48),
        ("Padaria do Largo", "(21) 2233-4455", "", "Google Maps", "leads", "Padaria do Largo", "Rio de Janeiro/RJ", 25),
        ("Academia Iron Fit", "(31) 99876-5544", "atendimento@ironfit.com.br", "Instagram", "leads", "Iron Fit", "Belo Horizonte/MG", 55),
        ("Escritório Delta Contábil", "(41) 3322-7788", "delta@deltacontabil.com.br", "CNPJ", "em_contato", "Delta Contábil", "Curitiba/PR", 74),
        ("Restaurante Sabor Caseiro", "(85) 98811-2233", "saborcaseiro@gmail.com", "Google Maps", "em_contato", "Sabor Caseiro", "Fortaleza/CE", 68),
        ("Ótica Visão Clara", "(51) 3445-6677", "contato@visaoclara.com.br", "Instagram", "proposta", "Visão Clara", "Porto Alegre/RS", 88),
        ("Mercado Central Atacado", "(62) 99555-1010", "compras@centralatacado.com.br", "CNPJ", "fechado", "Central Atacado", "Goiânia/GO", 95),
    ]
    leads = []
    for nome, telefone, email, fonte, etapa, empresa, cidade, score in modelos:
        leads.append(
            {
                "id": _novo_id(),
                "nome": nome,
                "telefone": telefone,
                "email": email,
                "fonte": fonte,
                "etapa": etapa,
                "empresa": empresa,
                "cidade": cidade,
                "score": score,
                "tags": [],
                "observacoes": "",
                "criado_em": now_iso(),
                "atualizado_em": now_iso(),
            }
        )
    return leads


def _seed_campaigns() -> list:
    return [
        {
            "id": _novo_id(),
            "nome": "Reativação Q4 (demonstração)",
            "canal": "texto",
            "template": "texto",
            "lead_ids": [],
            "status": "concluida",
            "total": 50,
            "enviadas": 47,
            "erros": 3,
            "criado_em": now_iso(),
            "iniciada_em": now_iso(),
            "concluida_em": now_iso(),
            "eventos": [],
        },
        {
            "id": _novo_id(),
            "nome": "Boas-vindas Novos Leads (demonstração)",
            "canal": "texto",
            "template": "texto",
            "lead_ids": [],
            "status": "rascunho",
            "total": 0,
            "enviadas": 0,
            "erros": 0,
            "criado_em": now_iso(),
            "eventos": [],
        },
    ]


def ensure_seeds() -> None:
    """Cria os arquivos de dados com seeds na primeira execução."""
    with LOCK:
        d = storage_dir()
        if not (d / LEADS_FILE).exists():
            _write(LEADS_FILE, _seed_leads())
        if not (d / CAMPAIGNS_FILE).exists():
            _write(CAMPAIGNS_FILE, _seed_campaigns())
        if not (d / PIPELINE_FILE).exists():
            _write(PIPELINE_FILE, {"jobs": []})
        if not (d / CONFIG_FILE).exists():
            _write(CONFIG_FILE, DEFAULT_CONFIG)


def limpar_seeds_demo() -> None:
    """Remove os dados de demonstração (usado quando o usuário pede)."""
    with LOCK:
        save_leads([])
        save_campaigns([])
        save_jobs([])
