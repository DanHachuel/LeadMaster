"""Testes das colunas customizáveis do CRM — CRUD e regras de negócio."""

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def _padrao():
    return [
        {"id": "leads", "nome": "Novos Leads", "cor": "blue"},
        {"id": "em_contato", "nome": "Em Contato", "cor": "amber"},
        {"id": "proposta", "nome": "Proposta", "cor": "violet"},
        {"id": "fechado", "nome": "Fechado", "cor": "green"},
    ]


def test_seed_inicial(client):
    cols = client.get("/api/crm/columns").json()
    assert [c["id"] for c in cols] == ["leads", "em_contato", "proposta", "fechado"]


def test_put_renomear(client):
    cols = _padrao()
    cols[0]["nome"] = "Leads Frios"
    r = client.put("/api/crm/columns", json=cols)
    assert r.status_code == 200
    assert r.json()[0]["nome"] == "Leads Frios"


def test_put_reordenar(client):
    cols = list(reversed(_padrao()))
    r = client.put("/api/crm/columns", json=cols)
    assert r.status_code == 200
    assert [c["id"] for c in r.json()] == ["fechado", "proposta", "em_contato", "leads"]


def test_put_adicionar_coluna(client):
    cols = _padrao()
    cols.append({"id": "negociacao", "nome": "Em Negociação", "cor": "pink"})
    r = client.put("/api/crm/columns", json=cols)
    assert r.status_code == 200
    assert len(r.json()) == 5


def test_put_duplicado_id_400(client):
    cols = _padrao()
    cols[1]["id"] = "leads"
    assert client.put("/api/crm/columns", json=cols).status_code == 400


def test_put_cor_invalida_400(client):
    cols = _padrao()
    cols[0]["cor"] = "rosa-choque"
    assert client.put("/api/crm/columns", json=cols).status_code == 400


def test_put_vazio_400(client):
    assert client.put("/api/crm/columns", json=[]).status_code == 400


def test_delete_coluna_vazia(client):
    # Cria uma coluna sem leads (o seed de demonstração popula as 4 padrão).
    cols = _padrao()
    cols.append({"id": "vazia", "nome": "Coluna Vazia", "cor": "gray"})
    client.put("/api/crm/columns", json=cols)
    r = client.delete("/api/crm/columns/vazia")
    assert r.status_code == 200
    ids = [c["id"] for c in client.get("/api/crm/columns").json()]
    assert "vazia" not in ids


def test_delete_inexistente_404(client):
    assert client.delete("/api/crm/columns/nao_existe").status_code == 404


def test_delete_coluna_com_leads_400(client):
    lead = client.post("/api/crm/leads", json={"nome": "Lead Bloqueio", "telefone": "(11) 93333-2222"}).json()
    assert lead["etapa"] == "leads"
    r = client.delete("/api/crm/columns/leads")
    assert r.status_code == 400
    assert "Mova" in r.json()["detail"]
    # Coluna continua existindo.
    assert any(c["id"] == "leads" for c in client.get("/api/crm/columns").json())


def test_put_remover_coluna_com_leads_400(client):
    client.post("/api/crm/leads", json={"nome": "Lead Protegido", "telefone": "(11) 92222-1111"}).json()
    cols = [c for c in _padrao() if c["id"] != "leads"]
    r = client.put("/api/crm/columns", json=cols)
    assert r.status_code == 400
    assert "Mova" in r.json()["detail"]


def test_mover_para_etapa_inexistente_400(client):
    lead = client.post("/api/crm/leads", json={"nome": "Lead Etapa Ruim", "telefone": "(11) 91111-0000"}).json()
    r = client.put(f"/api/crm/leads/{lead['id']}/etapa", json={"etapa": "fantasia"})
    assert r.status_code == 400


def test_mover_para_coluna_customizada(client):
    cols = _padrao()
    cols.append({"id": "negociacao", "nome": "Em Negociação", "cor": "pink"})
    client.put("/api/crm/columns", json=cols)
    lead = client.post("/api/crm/leads", json={"nome": "Lead Custom", "telefone": "(11) 95555-1212"}).json()
    r = client.put(f"/api/crm/leads/{lead['id']}/etapa", json={"etapa": "negociacao"})
    assert r.status_code == 200
    assert r.json()["etapa"] == "negociacao"