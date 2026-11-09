"""Testes dos extratores REAIS (0.1.23): scraper configurado que falha retorna
HTTP 500 amigável e NÃO salva leads mockados/parciais; sem scraper configurado,
o modo mock segue funcionando. Usa o próprio executável do Python como falso
binário para simular falha de execução do CLI.
"""

import subprocess
import sys
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def _completed(returncode, stderr=""):
    return main.extractors.subprocess.CompletedProcess(args=[], returncode=returncode, stdout="", stderr=stderr)


def test_maps_scraper_falhar_500_sem_salvar(client):
    # "Binário" configurado (o próprio python), mas a execução falha (returncode 1).
    client.put("/api/config", json={"extratores": {"google_maps_cli": sys.executable}})
    antes = len(client.get("/api/crm/leads").json())
    with patch.object(main.extractors.subprocess, "run", return_value=_completed(1, "falha simulada")):
        r = client.post("/api/extractors/maps", json={"keyword": "pizzaria", "location": "São Paulo, SP", "limit": 8})
    assert r.status_code == 500
    assert "código 1" in r.json()["detail"] or "falha simulada" in r.json()["detail"]
    # Nada foi salvo no leads.json (sem mock/parcial).
    depois = client.get("/api/crm/leads").json()
    assert len(depois) == antes


def test_maps_scraper_timeout_500(client):
    client.put("/api/config", json={"extratores": {"google_maps_cli": sys.executable}})
    with patch.object(
        main.extractors.subprocess, "run", side_effect=subprocess.TimeoutExpired(cmd="x", timeout=300)
    ):
        r = client.post("/api/extractors/maps", json={"keyword": "dentista", "location": "Rio, RJ", "limit": 8})
    assert r.status_code == 500
    assert "Timeout na extração" in r.json()["detail"]


def test_instagram_scraper_falhar_500_sem_salvar(client):
    client.put("/api/config", json={"extratores": {"igmapper_cli": sys.executable}})
    antes = len(client.get("/api/crm/leads").json())
    with patch.object(main.extractors.subprocess, "run", return_value=_completed(2, "igmapper explodiu")):
        r = client.post("/api/extractors/instagram", json={"profile_url": "https://instagram.com/x", "limit": 6})
    assert r.status_code == 500
    depois = client.get("/api/crm/leads").json()
    assert len(depois) == antes


def test_maps_sem_scraper_mantem_mock(client):
    r = client.post("/api/extractors/maps", json={"keyword": "pizzaria", "location": "Campinas, SP", "limit": 7})
    assert r.status_code == 201
    assert r.json()["origem"] == "mock"
    assert len(r.json()["importados"]) == 7
