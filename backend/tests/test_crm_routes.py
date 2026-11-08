"""Testes das rotas do CRM Kanban (backend/main.py).

Usam TestClient do FastAPI com LEADMASTER_HOME em diretório temporário, para
nunca tocar nos dados reais do usuário. Rodam iguais no CI (Linux) e local.
"""

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def test_listar_leads(client):
    r = client.get("/api/crm/leads")
    assert r.status_code == 200
    corpo = r.json()
    assert isinstance(corpo, list) and len(corpo) >= 1  # seeds de demonstração


def test_criar_lead(client):
    r = client.post("/api/crm/leads", json={"nome": "Padaria Teste", "telefone": "(11) 90000-0000", "fonte": "Manual"})
    assert r.status_code == 201
    lead = r.json()
    assert lead["id"]
    assert lead["etapa"] == "leads"
    # Confirma persistência no JSON local
    lista = client.get("/api/crm/leads").json()
    assert any(l["id"] == lead["id"] for l in lista)


def test_criar_lead_sem_nome_invalido(client):
    r = client.post("/api/crm/leads", json={"nome": ""})
    assert r.status_code == 422  # validação do modelo Pydantic


def test_mover_lead_entre_colunas(client):
    criado = client.post("/api/crm/leads", json={"nome": "Lead Móvel"}).json()
    r = client.put(f"/api/crm/leads/{criado['id']}/etapa", json={"etapa": "proposta"})
    assert r.status_code == 200
    assert r.json()["etapa"] == "proposta"


def test_mover_lead_inexistente(client):
    r = client.put("/api/crm/leads/nao-existe/etapa", json={"etapa": "fechado"})
    assert r.status_code == 404


def test_mover_lead_etapa_invalida(client):
    criado = client.post("/api/crm/leads", json={"nome": "Lead X"}).json()
    r = client.put(f"/api/crm/leads/{criado['id']}/etapa", json={"etapa": "nao_existe"})
    assert r.status_code == 400


def test_mover_lead_sem_etapa(client):
    criado = client.post("/api/crm/leads", json={"nome": "Lead Y"}).json()
    r = client.put(f"/api/crm/leads/{criado['id']}/etapa", json={})
    assert r.status_code == 400
