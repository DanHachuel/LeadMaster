"""Testes do gateway WhatsApp (OpenWA/WAHA) e do worker com envio real.

Mockam o HTTP do gateway: status, QR Code, envio de texto pelo worker e falha
do gateway sem travar a campanha.
"""

import asyncio
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


def _configurar_gateway(client, **campos):
    patch_body = {"integracoes": {"whatsapp": {"gateway_url": "http://127.0.0.1:2785", "enabled": True, **campos}}}
    client.put("/api/config", json=patch_body)


def test_status_conectado(client):
    _configurar_gateway(client)
    with patch.object(main.whatsapp.httpx, "get", return_value=httpx.Response(200, json={"status": "CONNECTED", "me": {"id": "5511999999999@c.us"}})):
        r = client.get("/api/whatsapp/status")
    assert r.status_code == 200
    assert r.json()["estado"] == "conectado"


def test_status_aguardando_qr(client):
    _configurar_gateway(client)
    with patch.object(main.whatsapp.httpx, "get", return_value=httpx.Response(200, json={"status": "SCAN_QR_CODE"})):
        r = client.get("/api/whatsapp/status")
    assert r.status_code == 200
    assert r.json()["estado"] == "aguardando_qr"


def test_status_gateway_offline_503(client):
    _configurar_gateway(client)
    with patch.object(main.whatsapp.httpx, "get", side_effect=httpx.ConnectError("sem rede")):
        r = client.get("/api/whatsapp/status")
    assert r.status_code == 503
    assert "2785" in r.json()["detail"]


def test_qr_repassa_imagem(client):
    _configurar_gateway(client)
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 40
    with patch.object(main.whatsapp.httpx, "get", return_value=httpx.Response(200, content=png, headers={"content-type": "image/png"})):
        r = client.get("/api/whatsapp/qr")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/png")
    assert r.content[:4] == b"\x89PNG"


def test_worker_envia_via_gateway(client):
    _configurar_gateway(client)
    lead = client.post("/api/crm/leads", json={"nome": "Pizzaria do Zé", "telefone": "(11) 98888-7777"}).json()
    campanha = client.post(
        "/api/campaigns",
        json={"nome": "Campanha Gateway", "canal": "texto", "lead_ids": [lead["id"]], "mensagem": "Oi {nome}!"},
    ).json()

    with patch.object(main.whatsapp.httpx, "post", return_value=httpx.Response(200, json={"ok": True})) as post_mock:
        asyncio.run(main.agents.processar_campanha_em_background(campanha["id"], delay_segundos=0))

    assert post_mock.called
    _, kwargs = post_mock.call_args
    assert "messages/send-text" in post_mock.call_args[0][0]
    payload = kwargs["json"]
    assert payload["chatId"] == "5511988887777@c.us"
    assert payload["text"] == "Oi Pizzaria do Zé!"
    enviadas = [e for e in main.storage.get_campaign(campanha["id"])["eventos"] if e["status"] == "enviado"]
    assert len(enviadas) == 1


def test_worker_gateway_falha_conta_erro_sem_travar(client):
    _configurar_gateway(client)
    leads = [client.post("/api/crm/leads", json={"nome": f"Lead {i}", "telefone": f"(11) 9000{i}-000{i}"}).json() for i in range(3)]
    campanha = client.post(
        "/api/campaigns",
        json={"nome": "Campanha Falha", "canal": "texto", "lead_ids": [l["id"] for l in leads], "mensagem": "Oi {nome}!"},
    ).json()

    with patch.object(main.whatsapp.httpx, "post", return_value=httpx.Response(500, text="sessão caiu")):
        asyncio.run(main.agents.processar_campanha_em_background(campanha["id"], delay_segundos=0))

    gravada = main.storage.get_campaign(campanha["id"])
    assert gravada["status"] == "concluida"  # campanha não travou
    assert gravada["erros"] == 3
    assert all("Gateway" in e["mensagem"] for e in gravada["eventos"])


def test_sem_gateway_mantem_simulacao(client):
    """Sem gateway configurado, o worker segue no modo simulação."""
    lead = client.post("/api/crm/leads", json={"nome": "Lead Sim", "telefone": "(21) 91111-2222"}).json()
    campanha = client.post(
        "/api/campaigns",
        json={"nome": "Campanha Sim", "canal": "texto", "lead_ids": [lead["id"]], "mensagem": "Oi {nome}!"},
    ).json()
    asyncio.run(main.agents.processar_campanha_em_background(campanha["id"], delay_segundos=0))
    gravada = main.storage.get_campaign(campanha["id"])
    assert gravada["enviadas"] == 1
