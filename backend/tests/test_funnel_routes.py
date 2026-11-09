"""Testes do Funil de Prospecção — GET /api/funnel.

Semeadura determinística no leads.json do home temporário para validar
contagens, taxas de conversão e identificação do gargalo.
"""

import json

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def _semear(client, distribuicao):
    """Escreve leads diretamente no leads.json do home do teste."""
    home = main.storage.storage_dir()
    leads = []
    for etapa, qtd in distribuicao.items():
        for i in range(qtd):
            leads.append({"id": f"{etapa}-{i}", "nome": f"Lead {etapa} {i}", "telefone": "", "email": "", "fonte": "Teste", "etapa": etapa})
    (home / "leads.json").write_text(json.dumps(leads), encoding="utf-8")


def test_funil_conversoes_e_gargalo(client):
    # [10, 5, 2, 1]: taxas 50%, 40%, 50% → quedas 50, 60, 50 → gargalo "Em Contato"
    _semear(client, {"leads": 10, "em_contato": 5, "proposta": 2, "fechado": 1})
    r = client.get("/api/funnel")
    assert r.status_code == 200
    corpo = r.json()
    assert [e["quantidade"] for e in corpo["etapas"]] == [10, 5, 2, 1]
    assert [e["nome"] for e in corpo["etapas"]] == ["Leads", "Em Contato", "Proposta", "Fechado"]
    taxas = [c["taxa"] for c in corpo["conversoes"]]
    assert taxas == [50.0, 40.0, 50.0]
    assert corpo["gargalo"] == "Em Contato"


def test_funil_gargalo_primeira_etapa(client):
    # Todos param na primeira etapa: queda 100% em Leads → Em Contato.
    _semear(client, {"leads": 7, "em_contato": 0, "proposta": 0, "fechado": 0})
    corpo = client.get("/api/funnel").json()
    assert corpo["gargalo"] == "Leads"
    assert corpo["conversoes"][0]["taxa"] == 0.0


def test_funil_sem_leads(client):
    _semear(client, {})
    corpo = client.get("/api/funnel").json()
    assert [e["quantidade"] for e in corpo["etapas"]] == [0, 0, 0, 0]
    assert all(c["taxa"] is None for c in corpo["conversoes"])
    assert corpo["gargalo"] is None


def test_funil_sem_gargalo(client):
    # Quedas todas zero (contagens iguais) → sem gargalo definido.
    _semear(client, {"leads": 4, "em_contato": 4, "proposta": 4, "fechado": 4})
    corpo = client.get("/api/funnel").json()
    assert corpo["gargalo"] is None
