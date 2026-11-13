"""Testes das Cadências de Follow-up — CRUD e lógica do worker."""

import json
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


PAYLOAD_VALIDO = {
    "nome": "Follow-up 1",
    "etapa_gatilho": "em_contato",
    "dias_espera": 3,
    "acao": "mover_para_proposta",
    "ativo": True,
}


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def test_criar_cadencia(client):
    r = client.post("/api/cadences", json=PAYLOAD_VALIDO)
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["id"]
    assert corpo["nome"] == "Follow-up 1"
    assert corpo["ultimas_execucoes"] == []
    salvas = client.get("/api/cadences").json()
    assert len(salvas) == 1


def test_criar_cadencia_invalida(client):
    base = dict(PAYLOAD_VALIDO)
    base["dias_espera"] = 0
    assert client.post("/api/cadences", json=base).status_code == 422  # ge=1
    base2 = dict(PAYLOAD_VALIDO)
    base2["acao"] = "explodir_tudo"
    assert client.post("/api/cadences", json=base2).status_code == 400
    base3 = dict(PAYLOAD_VALIDO)
    base3["etapa_gatilho"] = "lugar_nenhum"
    assert client.post("/api/cadences", json=base3).status_code == 400


def test_editar_cadencia(client):
    criada = client.post("/api/cadences", json=PAYLOAD_VALIDO).json()
    r = client.put(f"/api/cadences/{criada['id']}", json={"dias_espera": 5, "ativo": False})
    assert r.status_code == 200
    assert r.json()["dias_espera"] == 5
    assert r.json()["ativo"] is False


def test_editar_dias_negativo_400(client):
    criada = client.post("/api/cadences", json=PAYLOAD_VALIDO).json()
    assert client.put(f"/api/cadences/{criada['id']}", json={"dias_espera": -3}).status_code == 400


def test_editar_inexistente_404(client):
    assert client.put("/api/cadences/nao-existe", json={"dias_espera": 2}).status_code == 404


def test_remover_cadencia(client):
    criada = client.post("/api/cadences", json=PAYLOAD_VALIDO).json()
    assert client.delete(f"/api/cadences/{criada['id']}").status_code == 200
    assert client.get("/api/cadences").json() == []
    assert client.delete(f"/api/cadences/{criada['id']}").status_code == 404


# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------

def test_worker_move_lead_antigo(client):
    """Lead em 'em_contato' parado há mais de 3 dias → movido para proposta."""
    lead = client.post("/api/crm/leads", json={"nome": "Lead Esquecido", "telefone": "(11) 97777-6666", "etapa": "em_contato"}).json()
    # Força atualizado_em antigo.
    leads = json.loads((main.storage.storage_dir() / "leads.json").read_text(encoding="utf-8"))
    for l in leads:
        if l["id"] == lead["id"]:
            l["atualizado_em"] = (datetime.now().astimezone() - timedelta(days=5)).isoformat(timespec="seconds")
    (main.storage.storage_dir() / "leads.json").write_text(json.dumps(leads), encoding="utf-8")

    client.post("/api/cadences", json=PAYLOAD_VALIDO)
    r = client.post("/api/cadences/verificar")
    assert r.status_code == 200
    assert len(r.json()["executadas"]) == 1
    salvo = [l for l in client.get("/api/crm/leads").json() if l["id"] == lead["id"]][0]
    assert salvo["etapa"] == "proposta"


def test_worker_ignora_lead_recente(client):
    """Lead atualizado ontem não deve ser tocado por cadência de 3 dias."""
    lead = client.post("/api/crm/leads", json={"nome": "Lead Recente", "telefone": "(11) 96666-5555", "etapa": "em_contato"}).json()
    client.post("/api/cadences", json=PAYLOAD_VALIDO)
    r = client.post("/api/cadences/verificar")
    assert r.json()["executadas"] == []
    salvo = [l for l in client.get("/api/crm/leads").json() if l["id"] == lead["id"]][0]
    assert salvo["etapa"] == "em_contato"


def test_worker_cadencia_inativa_nao_executa(client):
    lead = client.post("/api/crm/leads", json={"nome": "Lead Antigo Inativo", "telefone": "(11) 95555-4444", "etapa": "em_contato"}).json()
    leads = json.loads((main.storage.storage_dir() / "leads.json").read_text(encoding="utf-8"))
    for l in leads:
        if l["id"] == lead["id"]:
            l["atualizado_em"] = (datetime.now().astimezone() - timedelta(days=10)).isoformat(timespec="seconds")
    (main.storage.storage_dir() / "leads.json").write_text(json.dumps(leads), encoding="utf-8")

    payload = dict(PAYLOAD_VALIDO)
    payload["ativo"] = False
    client.post("/api/cadences", json=payload)
    r = client.post("/api/cadences/verificar")
    assert r.json()["executadas"] == []


def test_worker_acao_tag_frio(client):
    lead = client.post("/api/crm/leads", json={"nome": "Lead Frio", "telefone": "(11) 94444-3333", "etapa": "leads"}).json()
    leads = json.loads((main.storage.storage_dir() / "leads.json").read_text(encoding="utf-8"))
    for l in leads:
        if l["id"] == lead["id"]:
            l["atualizado_em"] = (datetime.now().astimezone() - timedelta(days=4)).isoformat(timespec="seconds")
    (main.storage.storage_dir() / "leads.json").write_text(json.dumps(leads), encoding="utf-8")

    payload = {"nome": "Esfriar", "etapa_gatilho": "leads", "dias_espera": 2, "acao": "adicionar_tag_frio"}
    client.post("/api/cadences", json=payload)
    r = client.post("/api/cadences/verificar")
    assert len(r.json()["executadas"]) == 1
    salvo = [l for l in client.get("/api/crm/leads").json() if l["id"] == lead["id"]][0]
    assert "Frio" in salvo["tags"]
