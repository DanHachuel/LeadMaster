"""Testes do motor de disparos em background — agents.processar_campanha_em_background.

Cobrem: contadores enviadas/erros atualizados em campaigns.json, erro
simulado (1 a cada 10), conclusão automática, interrupção por pausa no meio
do loop e o gatilho via PUT /api/campaigns/{id}/status com status "ativa".
"""

import asyncio

from fastapi.testclient import TestClient

import main
from services import agents, storage


def _lead(telefone: str) -> dict:
    return {
        "id": storage._novo_id(),
        "nome": f"Lead {telefone}",
        "telefone": telefone,
        "email": "",
        "fonte": "teste",
        "etapa": "leads",
        "empresa": "",
        "cidade": "",
        "endereco": "",
        "score": 50,
        "tags": [],
        "observacoes": "",
        "extras": {},
        "criado_em": storage.now_iso(),
        "atualizado_em": storage.now_iso(),
    }


def _campanha(quantidade: int) -> dict:
    return {
        "id": storage._novo_id(),
        "nome": "Campanha QA",
        "canal": "texto",
        "template": "texto",
        "mensagem": "Olá {{nome}}!",
        "lead_ids": [storage._novo_id() for _ in range(quantidade)],
        "status": "rascunho",
        "total": quantidade,
        "enviadas": 0,
        "erros": 0,
        "eventos": [],
        "criado_em": storage.now_iso(),
    }


def _preparar(tmp_path, monkeypatch, quantidade):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    leads = [_lead(f"(11) 90000-{i:04d}") for i in range(quantidade)]
    campanha = _campanha(quantidade)
    campanha["lead_ids"] = [l["id"] for l in leads]
    storage.save_leads(leads)
    storage.upsert_campaign(campanha)
    return campanha


def test_background_processa_e_conclui(tmp_path, monkeypatch):
    campanha = _preparar(tmp_path, monkeypatch, 12)
    asyncio.run(agents.processar_campanha_em_background(campanha["id"], delay_segundos=0))

    gravada = storage.get_campaign(campanha["id"])
    assert gravada["status"] == "concluida"
    assert gravada["enviadas"] + gravada["erros"] == 12  # todos processados
    assert gravada["enviadas"] == 11  # 1 erro simulado a cada 10
    assert gravada["erros"] == 1
    assert len(gravada["eventos"]) == 12
    assert any(e["status"] == "erro" for e in gravada["eventos"])
    assert "concluida_em" in gravada


def test_pausa_interrompe_no_proximo_ciclo(tmp_path, monkeypatch):
    campanha = _preparar(tmp_path, monkeypatch, 6)

    real_sleep = asyncio.sleep

    async def sleep_pausante(delay, *args, **kwargs):
        # Na 3ª "espera" o usuário pausa a campanha (como a rota faria).
        sleep_pausante.chamadas += 1
        if sleep_pausante.chamadas == 3:
            atual = storage.get_campaign(campanha["id"])
            atual["status"] = "pausada"
            storage.upsert_campaign(atual)
        await real_sleep(0)

    sleep_pausante.chamadas = 0
    monkeypatch.setattr(agents.asyncio, "sleep", sleep_pausante)
    asyncio.run(agents.processar_campanha_em_background(campanha["id"], delay_segundos=0.01))

    gravada = storage.get_campaign(campanha["id"])
    assert gravada["status"] == "pausada"
    # Processou menos que o total: o loop foi interrompido no meio.
    assert gravada["enviadas"] + gravada["erros"] < 6


def test_retomar_nao_reenvia(tmp_path, monkeypatch):
    campanha = _preparar(tmp_path, monkeypatch, 5)
    asyncio.run(agents.processar_campanha_em_background(campanha["id"], delay_segundos=0))
    concluida = storage.get_campaign(campanha["id"])
    assert concluida["enviadas"] == 5

    # Reativar uma concluída zera os contadores (nova rodada).
    concluida.update({"enviadas": 0, "erros": 0, "eventos": [], "concluida_em": None, "status": "em_andamento"})
    storage.upsert_campaign(concluida)
    asyncio.run(agents.processar_campanha_em_background(campanha["id"], delay_segundos=0))
    assert storage.get_campaign(campanha["id"])["enviadas"] == 5


def test_rota_ativa_dispara_background(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    monkeypatch.setattr(agents, "SIM_DELAY_SEGUNDOS", 0)
    chamadas = []
    original = agents.processar_campanha_em_background

    async def espiao(campaign_id, delay_segundos=None):
        chamadas.append(campaign_id)
        await original(campaign_id, delay_segundos=0)

    monkeypatch.setattr(agents, "processar_campanha_em_background", espiao)

    leads = [_lead(f"(11) 91000-{i:04d}") for i in range(3)]
    campanha = _campanha(3)
    campanha["lead_ids"] = [l["id"] for l in leads]
    storage.save_leads(leads)
    storage.upsert_campaign(campanha)

    with TestClient(main.app) as client:
        r = client.put(f"/api/campaigns/{campanha['id']}/status", json={"status": "ativa"})
        assert r.status_code == 200
        assert r.json()["status"] == "em_andamento"

    # O BackgroundTask roda dentro do TestClient antes de retornar.
    assert chamadas == [campanha["id"]]
    gravada = storage.get_campaign(campanha["id"])
    assert gravada["enviadas"] + gravada["erros"] == 3
    assert gravada["status"] == "concluida"


def test_rota_pausa_nao_dispara(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    campanha = _campanha(2)
    storage.upsert_campaign(campanha)
    chamadas = []
    monkeypatch.setattr(agents, "processar_campanha_em_background", lambda *a, **k: chamadas.append(a))
    with TestClient(main.app) as client:
        r = client.put(f"/api/campaigns/{campanha['id']}/status", json={"status": "pausada"})
        assert r.status_code == 200
        assert r.json()["status"] == "pausada"
    assert chamadas == []
