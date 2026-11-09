"""Testes do Extrator de Leads (CNPJ) — POST /api/extractors/cnpj.

Sem provedor de busca configurado (placeholder padrão), a rota gera mock de
5–10 empresas fictícias e persiste em leads.json na coluna "Novos Leads".
LEADMASTER_HOME em diretório temporário.
"""

from fastapi.testclient import TestClient

import main


def _client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    return TestClient(main.app)


def test_mock_gera_e_persiste(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        antes = len(client.get("/api/crm/leads").json())
        r = client.post(
            "/api/extractors/cnpj",
            json={"cnae": "6201-5/01", "uf": "SP", "limit": 10},
        )
        assert r.status_code == 201
        corpo = r.json()
        assert corpo["origem"] == "mock"
        assert 5 <= len(corpo["importados"]) <= 10

        for lead in corpo["importados"]:
            assert lead["fonte"] == "CNPJ"
            assert lead["etapa"] == "leads"  # coluna "Novos Leads"
            assert lead["nome"] and lead["cnpj"] and lead["telefone"]
            assert "/SP" in lead["cidade"]

        depois = client.get("/api/crm/leads").json()
        assert len(depois) == antes + len(corpo["importados"])


def test_limit_respeitado(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        r = client.post(
            "/api/extractors/cnpj",
            json={"cnae": "6202-3/01", "uf": "RJ", "limit": 6},
        )
        assert r.status_code == 201
        assert len(r.json()["importados"]) == 6


def test_uf_normalizada(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        r = client.post(
            "/api/extractors/cnpj",
            json={"cnae": "4711-3/02", "uf": "mg", "limit": 5},
        )
        assert r.status_code == 201
        leads = r.json()["importados"]
        assert all("/MG" in lead["cidade"] for lead in leads)


def test_payload_invalido(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        r = client.post("/api/extractors/cnpj", json={"uf": "SP", "limit": 5})
        assert r.status_code == 422
