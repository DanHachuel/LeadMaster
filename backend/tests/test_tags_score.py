"""Testes de Tags e Lead Scoring — PUT /api/crm/leads/{id} e GET com ?tag=."""

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def _criar(client, nome, tags=None, score=0):
    lead = client.post("/api/crm/leads", json={"nome": nome, "telefone": "(11) 90000-0000", "tags": tags or [], "score": score}).json()
    return lead


def test_salvar_tags_persistem(client):
    lead = _criar(client, "Lead Tags")
    r = client.put(f"/api/crm/leads/{lead['id']}", json={"tags": ["Quente", "Urgente"]})
    assert r.status_code == 200
    assert sorted(r.json()["tags"]) == ["Quente", "Urgente"]
    salvo = [l for l in client.get("/api/crm/leads").json() if l["id"] == lead["id"]][0]
    assert sorted(salvo["tags"]) == ["Quente", "Urgente"]


def test_salvar_score_persiste(client):
    lead = _criar(client, "Lead Score")
    r = client.put(f"/api/crm/leads/{lead['id']}", json={"score": 4})
    assert r.status_code == 200
    assert r.json()["score"] == 4
    salvo = [l for l in client.get("/api/crm/leads").json() if l["id"] == lead["id"]][0]
    assert salvo["score"] == 4


def test_score_fora_do_intervalo_400(client):
    lead = _criar(client, "Lead Score Inválido")
    assert client.put(f"/api/crm/leads/{lead['id']}", json={"score": 6}).status_code == 400
    assert client.put(f"/api/crm/leads/{lead['id']}", json={"score": -1}).status_code == 400
    assert client.put(f"/api/crm/leads/{lead['id']}", json={"score": "abc"}).status_code == 400


def test_tags_formato_invalido_400(client):
    lead = _criar(client, "Lead Tags Inválidas")
    r = client.put(f"/api/crm/leads/{lead['id']}", json={"tags": "não é lista"})
    assert r.status_code == 400


def test_filtro_por_tag(client):
    _criar(client, "Lead Quente", tags=["Quente"])
    _criar(client, "Lead Sem Tag")
    r = client.get("/api/crm/leads?tag=Quente")
    assert r.status_code == 200
    assert [l["nome"] for l in r.json()] == ["Lead Quente"]


def test_filtro_por_tag_inexistente_vazio(client):
    _criar(client, "Lead Sem Tag", tags=["Outra"])
    r = client.get("/api/crm/leads?tag=Quente")
    assert r.status_code == 200
    assert r.json() == []
