"""Testes do controle dos Agentes de IA (backend/main.py).

GET /api/agents, PUT /api/agents/{id}/status (com bloqueio do disparo sem
LLM configurada) e PUT /api/agents/{id}/prompt. Home isolado em tmp.
"""

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def test_listar_agentes(client):
    r = client.get("/api/agents")
    assert r.status_code == 200
    corpo = r.json()
    assert "disparo" in corpo["agentes"] and "atendimento" in corpo["agentes"]
    assert corpo["agentes"]["disparo"]["status"] == "inativo"
    assert corpo["llm_configurado"] is False  # seed sem chave de LLM


def test_ativar_disparo_sem_llm_bloqueia(client):
    r = client.put("/api/agents/disparo/status", json={"status": "ativo"})
    assert r.status_code == 400
    assert "API Key" in r.json()["detail"]
    # Continua inativo
    estado = client.get("/api/agents").json()["agentes"]["disparo"]["status"]
    assert estado == "inativo"


def test_ativar_atendimento_permitido_sem_llm(client):
    r = client.put("/api/agents/atendimento/status", json={"status": "ativo"})
    assert r.status_code == 200
    assert r.json()["status"] == "ativo"
    # Persistido em agents.json
    estado = client.get("/api/agents").json()["agentes"]["atendimento"]["status"]
    assert estado == "ativo"


def test_ativar_disparo_com_llm(client):
    # Configura a chave do LLM e ativa o disparo.
    client.put("/api/config", json={"llm": {"api_key": "sk-teste-123"}})
    r = client.put("/api/agents/disparo/status", json={"status": "ativo"})
    assert r.status_code == 200
    assert r.json()["status"] == "ativo"


def test_desativar_agente(client):
    client.put("/api/agents/atendimento/status", json={"status": "ativo"})
    r = client.put("/api/agents/atendimento/status", json={"status": "inativo"})
    assert r.status_code == 200
    assert r.json()["status"] == "inativo"


def test_status_invalido_e_agente_desconhecido(client):
    r = client.put("/api/agents/disparo/status", json={"status": "talvez"})
    assert r.status_code == 400
    r2 = client.put("/api/agents/inexistente/status", json={"status": "ativo"})
    assert r2.status_code == 404


def test_salvar_prompt_persiste(client):
    prompt = "Você é um agente de prospecção especialista em SaaS."
    r = client.put("/api/agents/disparo/prompt", json={"prompt": prompt})
    assert r.status_code == 200
    assert r.json()["prompt"] == prompt
    salvo = client.get("/api/agents").json()["agentes"]["disparo"]["prompt"]
    assert salvo == prompt


def test_salvar_prompt_agente_desconhecido(client):
    r = client.put("/api/agents/inexistente/prompt", json={"prompt": "x"})
    assert r.status_code == 404
    r2 = client.put("/api/agents/disparo/prompt", json={})
    assert r2.status_code == 400
