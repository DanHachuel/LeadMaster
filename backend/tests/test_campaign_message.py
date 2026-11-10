"""Testes da geração de mensagens com IA e da substituição de variáveis.

- `POST /api/campaigns/generate-message` (mock da LLM; 400 sem chave).
- `render_template` com chave simples ({nome}, {empresa}, {telefone}) — usado
  pelo worker antes de simular o envio.
"""

import asyncio
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c


def test_gerar_mensagem_com_llm_mockada(client):
    fake = (
        "Olá {nome}, vi que a {empresa} trabalha com delivery e isso chamou "
        "nossa atenção. Temos uma solução que dobra a recompra sem aumentar "
        "o time. Podemos conversar 10 minutos?"
    )
    with patch.object(main.llm, "chat", return_value=fake):
        r = client.post("/api/campaigns/generate-message", json={"nicho": "pizzarias", "tom": "amigável e direto"})
    assert r.status_code == 200
    assert "{nome}" in r.json()["template"]
    assert "{empresa}" in r.json()["template"]


def test_gerar_mensagem_sem_llm_400(client):
    r = client.post("/api/campaigns/generate-message", json={"nicho": "dentistas"})
    assert r.status_code == 400
    assert "Ferramentas" in r.json()["detail"] or "LLM" in r.json()["detail"]


def test_render_template_chave_simples(client):
    lead = {"nome": "Pizzaria Bella Massa", "empresa": "Bella Massa", "telefone": "(11) 98888-7777", "cidade": "São Paulo/SP"}
    texto = main.agents.render_template("Olá {nome}, da {empresa}! Contato: {telefone}.", lead)
    assert texto == "Olá Pizzaria Bella Massa, da Bella Massa! Contato: (11) 98888-7777."


def test_render_template_chave_dupla_ainda_funciona(client):
    lead = {"nome": "Clínica Bem Viver", "empresa": "Bem Viver", "telefone": "(11) 91234-5678"}
    texto = main.agents.render_template("Olá {{nome}}!", lead)
    assert texto == "Olá Clínica Bem Viver!"


def test_worker_substitui_variaveis_antes_do_envio(client):
    """O worker usa a mensagem com {nome}/{empresa} já substituídos pelos dados
    reais do lead."""
    client.put("/api/config", json={"agentes": {"disparo": {"delay_entre_envios_segundos": 0}}})
    lead = client.post(
        "/api/crm/crm/leads".replace("/crm/crm", "/crm"),
        json={"nome": "Pizzaria Forno de Pedra", "empresa": "Forno de Pedra", "telefone": "(21) 97777-6666"},
    ).json()
    campanha = client.post(
        "/api/campaigns",
        json={
            "nome": "Campanha Variáveis",
            "canal": "texto",
            "lead_ids": [lead["id"]],
            "mensagem": "Oi {nome}, tudo bem? Vi o trabalho da {empresa}.",
        },
    ).json()

    asyncio.run(main.agents.processar_campanha_em_background(campanha["id"], delay_segundos=0))

    gravada = main.storage.get_campaign(campanha["id"])
    evento = [e for e in gravada["eventos"] if e["lead_id"] == lead["id"]][0]
    assert evento["status"] == "enviado"
    assert "Pizzaria Forno de Pedra" in evento["mensagem"]
    assert "{nome}" not in evento["mensagem"]
    assert gravada["status"] == "concluida"
