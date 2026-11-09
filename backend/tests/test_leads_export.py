"""Testes da exportação CSV de leads — GET /api/crm/leads/export.

Valida MIME, Content-Disposition, BOM (acentos no Excel), colunas esperadas e
presença dos dados dos leads no conteúdo.
"""

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def test_exportar_csv(client):
    r = client.get("/api/crm/leads/export")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert 'attachment; filename="leads_leadmaster.csv"' in r.headers["content-disposition"]

    conteudo = r.content.decode("utf-8-sig")  # remove o BOM para inspecionar
    assert r.content.startswith(b"\xef\xbb\xbf")  # BOM presente (Excel pt-BR)
    linhas = [l for l in conteudo.splitlines() if l.strip()]
    cabecalho = linhas[0].split(";")
    for coluna in ("id", "nome", "telefone", "email", "fonte", "etapa"):
        assert coluna in cabecalho
    # Um lead de demonstração (seed) aparece no conteúdo.
    assert any("Bella Massa" in l or "Horizonte" in l for l in linhas[1:])


def test_exportar_csv_achata_extras(client):
    # Cria um lead com extras (dados do scraper real).
    client.post(
        "/api/crm/leads",
        json={"nome": "Empresa com Extras", "telefone": "(11) 95555-0000", "extras": {"site": "https://empresa.com", "avaliacao": 4.7}},
    )
    r = client.get("/api/crm/leads/export")
    assert r.status_code == 200
    conteudo = r.content.decode("utf-8-sig")
    assert "extras_site" in conteudo.splitlines()[0]
    assert "https://empresa.com" in conteudo


def test_exportar_csv_sem_leads(client):
    # Base vazia: só o cabeçalho.
    home = main.storage.storage_dir()
    (home / "leads.json").write_text("[]", encoding="utf-8")
    r = client.get("/api/crm/leads/export")
    assert r.status_code == 200
    linhas = [l for l in r.content.decode("utf-8-sig").splitlines() if l.strip()]
    assert len(linhas) == 1  # apenas o cabeçalho
