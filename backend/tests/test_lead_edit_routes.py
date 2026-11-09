"""Testes da edição do lead — PUT /api/crm/leads/{lead_id}.

Edição de nome/telefone/email (todos opcionais), persistência, 404 para ID
inexistente e bloqueio de nome vazio (prevenção de erros).
"""

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def _criar_lead(client):
    return client.post("/api/crm/leads", json={"nome": "Lead Original", "telefone": "(11) 90000-0000", "email": "a@b.com"}).json()


def test_editar_campos_principais(client):
    lead = _criar_lead(client)
    r = client.put(
        f"/api/crm/leads/{lead['id']}",
        json={"nome": "Lead Editado", "telefone": "(21) 98888-7777", "email": "novo@empresa.com"},
    )
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["nome"] == "Lead Editado"
    assert corpo["telefone"] == "(21) 98888-7777"
    assert corpo["email"] == "novo@empresa.com"
    # Persistido no leads.json (a listagem reflete a edição).
    salvo = [l for l in client.get("/api/crm/leads").json() if l["id"] == lead["id"]][0]
    assert salvo["nome"] == "Lead Editado"


def test_editar_parcial(client):
    lead = _criar_lead(client)
    r = client.put(f"/api/crm/leads/{lead['id']}", json={"email": "parcial@x.com"})
    assert r.status_code == 200
    assert r.json()["email"] == "parcial@x.com"
    assert r.json()["nome"] == "Lead Original"  # campos omitidos permanecem


def test_editar_inexistente_404(client):
    r = client.put("/api/crm/leads/nao-existe", json={"nome": "X"})
    assert r.status_code == 404


def test_nome_vazio_bloqueado(client):
    lead = _criar_lead(client)
    r = client.put(f"/api/crm/leads/{lead['id']}", json={"nome": "   "})
    assert r.status_code == 400
    assert "vazio" in r.json()["detail"]


def test_payload_sem_campos_editaveis(client):
    lead = _criar_lead(client)
    r = client.put(f"/api/crm/leads/{lead['id']}", json={"etapa": "fechado"})
    assert r.status_code == 400
