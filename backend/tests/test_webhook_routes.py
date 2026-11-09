"""Testes das rotas de Webhook (backend/main.py).

GET/PUT /api/webhook (com validação de URL) e POST /api/webhook/test com o
HTTP externo mockado — o endpoint de teste nunca quebra com URL inválida ou
indisponível. HOME isolado em diretório temporário.
"""

from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def test_obter_padrao(client):
    r = client.get("/api/webhook")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["url"] == ""
    assert "lead.criado" in corpo["eventos"]
    assert corpo["ultimo_teste"] is None


def test_salvar_url_e_eventos(client):
    r = client.put(
        "/api/webhook",
        json={"url": "https://n8n.exemplo.com/webhook/abc", "eventos": ["lead.criado"]},
    )
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["url"] == "https://n8n.exemplo.com/webhook/abc"
    assert corpo["eventos"] == ["lead.criado"]
    # Persistido no config.json
    salvo = client.get("/api/webhook").json()
    assert salvo["url"] == "https://n8n.exemplo.com/webhook/abc"


def test_salvar_url_invalida_400(client):
    r = client.put("/api/webhook", json={"url": "nao-e-uma-url"})
    assert r.status_code == 400
    assert "http" in r.json()["detail"]


def _resposta_ok(*_args, **_kwargs):
    return httpx.Response(200, json={"ok": True})


def test_testar_webhook_sucesso(client):
    client.put("/api/webhook", json={"url": "https://exemplo.com/hook"})
    with patch.object(main.agents.httpx, "post", side_effect=_resposta_ok):
        r = client.post("/api/webhook/test", json={"url": "https://exemplo.com/hook"})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["ok"] is True
    assert corpo["status_http"] == 200
    assert corpo["ultimo_teste"]  # registrado


def test_testar_webhook_conexao_falha_nao_quebra(client):
    # URL indisponível: retorna erro amigável (não 500).
    with patch.object(main.agents.httpx, "post", side_effect=httpx.ConnectError("sem rede")):
        r = client.post("/api/webhook/test", json={"url": "https://inexistente.invalid/hook"})
    assert r.status_code == 200
    assert r.json()["ok"] is False
    assert "mensagem" in r.json()


def test_testar_webhook_url_invalida_400(client):
    # Passa o min_length do modelo, mas falha no esquema http(s) → 400.
    r = client.post("/api/webhook/test", json={"url": "nao-http-url.com/webhook"})
    assert r.status_code == 400
    # URL curta demais falha na validação do modelo.
    r2 = client.post("/api/webhook/test", json={"url": "xyz"})
    assert r2.status_code == 422
