"""Testes do Extrator de Leads (Google Maps) — POST /api/extractors/maps.

Sem scraper configurado, a rota gera mock (5–10 leads) e persiste em
leads.json na coluna "Novos Leads". LEADMASTER_HOME em diretório temporário.
"""

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def test_mock_gera_e_persiste(client):
    antes = len(client.get("/api/crm/leads").json())
    r = client.post("/api/extractors/maps", json={"keyword": "pizzaria", "location": "São Paulo, SP", "limit": 10})
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["origem"] == "mock"
    assert 5 <= len(corpo["importados"]) <= 10

    for lead in corpo["importados"]:
        assert lead["fonte"] == "Google Maps"
        assert lead["etapa"] == "leads"  # coluna "Novos Leads"
        assert lead["nome"] and lead["telefone"]

    depois = client.get("/api/crm/leads").json()
    assert len(depois) == antes + len(corpo["importados"])


def test_limit_respeitado(client):
    r = client.post("/api/extractors/maps", json={"keyword": "dentista", "location": "Rio de Janeiro, RJ", "limit": 7})
    assert r.status_code == 201
    assert len(r.json()["importados"]) == 7


def test_payload_invalido(client):
    r = client.post("/api/extractors/maps", json={"keyword": "x"})
    assert r.status_code == 422
