"""Testes do módulo de Campanhas/Disparos (backend/main.py).

Cobrem listagem, criação (com filtro por etapa do CRM) e alteração de status
via PUT /api/campaigns/{id}/status. LEADMASTER_HOME em diretório temporário.
"""

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def test_listar_campanhas(client):
    r = client.get("/api/campaigns")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1  # seeds de demonstração


def test_criar_campanha_com_filtro_etapa(client):
    # Total de leads na etapa "leads" (seeds).
    leads_leads = [l for l in client.get("/api/crm/leads").json() if l["etapa"] == "leads"]
    r = client.post(
        "/api/campaigns",
        json={
            "nome": "Campanha Filtro",
            "canal": "texto",
            "template": "texto",
            "mensagem": "Olá {{primeiro_nome}}, tudo bem?",
            "filtro_etapa": "leads",
        },
    )
    assert r.status_code == 201
    campanha = r.json()
    assert campanha["nome"] == "Campanha Filtro"
    assert campanha["status"] == "rascunho"
    assert campanha["total"] == len(leads_leads)
    assert len(campanha["lead_ids"]) == len(leads_leads)
    # Persistida
    lista = client.get("/api/campaigns").json()
    assert any(c["id"] == campanha["id"] for c in lista)


def test_criar_campanha_payload_invalido(client):
    r = client.post("/api/campaigns", json={"canal": "texto"})
    assert r.status_code == 422  # nome obrigatório


def test_alterar_status_ativa_e_pausada(client):
    criada = client.post("/api/campaigns", json={"nome": "Status Teste", "lead_ids": []}).json()
    r = client.put(f"/api/campaigns/{criada['id']}/status", json={"status": "ativa"})
    assert r.status_code == 200
    assert r.json()["status"] == "em_andamento"
    r2 = client.put(f"/api/campaigns/{criada['id']}/status", json={"status": "pausada"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "pausada"


def test_alterar_status_invalido_e_inexistente(client):
    criada = client.post("/api/campaigns", json={"nome": "Status X", "lead_ids": []}).json()
    r = client.put(f"/api/campaigns/{criada['id']}/status", json={"status": "nao_existe"})
    assert r.status_code == 400
    r2 = client.put("/api/campaigns/nao-existe/status", json={"status": "ativa"})
    assert r2.status_code == 404
