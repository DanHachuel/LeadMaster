"""Testes do chat de teste do agente — POST /api/agents/chat.

Mockam a chamada externa à LLM (nunca gastamos tokens no CI) e validam:
mensagem vazia → 400, ausência de API Key → 400 acionável, resposta mockada
persistida no histórico (chat_history.json) e contexto (prompt do sistema +
histórico) enviado à LLM.
"""

import pytest
from fastapi.testclient import TestClient

import main
from services import agents, llm, storage


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def test_mensagem_vazia_400(client):
    r = client.post("/api/agents/chat", json={"message": "   "})
    assert r.status_code == 400
    assert "Mensagem vazia" in r.json()["detail"]


def test_sem_llm_configurada_400(client):
    # Home novo: sem api_key no config → erro acionável (Ferramentas → LLM).
    r = client.post("/api/agents/chat", json={"message": "Olá!"})
    assert r.status_code == 400
    assert "Ferramentas" in r.json()["detail"]


def test_chat_resposta_e_historico(client, monkeypatch):
    # LLM "configurada" + chamada externa mockada (zero tokens no CI).
    monkeypatch.setattr(llm, "configurado", lambda: True)
    monkeypatch.setattr(
        llm,
        "chat",
        lambda mensagens, **kwargs: "Resposta mockada do agente.",
    )
    r = client.post("/api/agents/chat", json={"message": "Qual o horário de atendimento?"})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["ok"] is True
    assert corpo["resposta"] == "Resposta mockada do agente."

    # Histórico persistido (recarregar a página não perde a conversa).
    hist = client.get("/api/agents/chat/history").json()
    assert len(hist) == 2
    assert hist[0]["papel"] == "user" and hist[0]["conteudo"] == "Qual o horário de atendimento?"
    assert hist[1]["papel"] == "assistant" and hist[1]["conteudo"] == "Resposta mockada do agente."

    # Segunda mensagem: a LLM recebe o contexto (system + histórico + nova).
    capturado = {}
    original = llm.chat

    def espiar(mensagens, **kwargs):
        capturado["mensagens"] = mensagens
        return original(mensagens, **kwargs)

    monkeypatch.setattr(llm, "chat", espiar)
    client.post("/api/agents/chat", json={"message": "E no sábado?"})
    papeis = [m["role"] for m in capturado["mensagens"]]
    assert papeis[0] == "system"  # prompt do sistema de agents.json
    assert papeis.count("user") == 2
    assert papeis.count("assistant") == 1


def test_limpar_historico(client, monkeypatch):
    monkeypatch.setattr(llm, "configurado", lambda: True)
    monkeypatch.setattr(llm, "chat", lambda mensagens, **kwargs: "Ok.")
    client.post("/api/agents/chat", json={"message": "Oi"})
    assert len(client.get("/api/agents/chat/history").json()) == 2

    r = client.delete("/api/agents/chat/history")
    assert r.status_code == 200
    assert client.get("/api/agents/chat/history").json() == []


def test_erro_da_llm_nao_suja_historico_assistente(client, monkeypatch):
    # LLM configurada mas falhando: a mensagem do usuário fica no histórico,
    # mas nenhuma resposta de assistente é gravada.
    monkeypatch.setattr(llm, "configurado", lambda: True)

    def explodir(mensagens, **kwargs):
        raise llm.LLMErro("LLM respondeu HTTP 500: erro interno")

    monkeypatch.setattr(llm, "chat", explodir)
    r = client.post("/api/agents/chat", json={"message": "Teste de falha"})
    assert r.status_code == 200
    assert r.json()["ok"] is False
    hist = client.get("/api/agents/chat/history").json()
    assert len(hist) == 1 and hist[0]["papel"] == "user"


def test_prompt_do_sistema_editavel_entra_no_contexto(client, monkeypatch):
    monkeypatch.setattr(llm, "configurado", lambda: True)
    storage.save_agent("atendimento", {"prompt": "Você é o robô de testes do LeadMaster."})
    capturado = {}
    monkeypatch.setattr(llm, "chat", lambda m, **k: capturado.setdefault("m", m) or "ok")
    client.post("/api/agents/chat", json={"message": "Quem é você?"})
    assert capturado["m"][0]["role"] == "system"
    assert "robô de testes" in capturado["m"][0]["content"]
