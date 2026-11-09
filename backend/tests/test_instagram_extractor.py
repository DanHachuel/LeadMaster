"""Testes do Extrator de Leads (Instagram) — POST /api/extractors/instagram.

Sem igmapper configurado, a rota gera mock (5–10 leads) e persiste em
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
    r = client.post(
        "/api/extractors/instagram",
        json={"profile_url": "https://instagram.com/nike", "limit": 10},
    )
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["origem"] == "mock"
    assert 5 <= len(corpo["importados"]) <= 10

    for lead in corpo["importados"]:
        assert lead["fonte"] == "Instagram"
        assert lead["etapa"] == "leads"  # coluna "Novos Leads"
        assert lead["nome"] and lead["telefone"]

    depois = client.get("/api/crm/leads").json()
    assert len(depois) == antes + len(corpo["importados"])


def test_limit_respeitado(client):
    r = client.post(
        "/api/extractors/instagram",
        json={"profile_url": "https://instagram.com/perfil", "limit": 6},
    )
    assert r.status_code == 201
    assert len(r.json()["importados"]) == 6


def test_payload_invalido(client):
    r = client.post("/api/extractors/instagram", json={"limit": 5})
    assert r.status_code == 422
