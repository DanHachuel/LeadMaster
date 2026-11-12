"""Testes dos relatórios de campanhas — GET /api/reports.

Validam consolidação de campanhas.json (resumo, por campanha, por dia) com
dados conhecidos em LEADMASTER_HOME temporário.
"""

from fastapi.testclient import TestClient

import main
from services import storage


def _client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    # Cria os arquivos vazios ANTES do lifespan: evita os seeds de demo.
    storage.save_campaigns([])
    return TestClient(main.app)


def _campanha(cid, nome, status, enviadas, erros, eventos):
    return {
        "id": cid,
        "nome": nome,
        "canal": "texto",
        "template": "texto",
        "lead_ids": [f"lead-{i}" for i in range(enviadas + erros)],
        "status": status,
        "total": enviadas + erros,
        "enviadas": enviadas,
        "erros": erros,
        "eventos": eventos,
        "criado_em": "2026-11-10T10:00:00-03:00",
        "iniciada_em": "2026-11-10T10:05:00-03:00",
        "concluida_em": "2026-11-10T10:10:00-03:00" if status == "concluida" else None,
    }


def test_reports_sem_campanhas(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        r = client.get("/api/reports")
        assert r.status_code == 200
        corpo = r.json()
        assert corpo["resumo"] == {
            "campanhas": 0,
            "enviadas": 0,
            "erros": 0,
            "taxa_sucesso": 0.0,
            "ativas": 0,
            "concluidas": 0,
        }
        assert corpo["por_campanha"] == []
        assert corpo["por_dia"] == []


def test_reports_consolida_campanhas(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    storage.save_campaigns(
        [
            _campanha(
                "c1",
                "Campanha Um",
                "concluida",
                8,
                2,
                [
                    {"lead_id": "l1", "status": "enviado", "momento": "2026-11-10T10:01:00-03:00"},
                    {"lead_id": "l2", "status": "erro", "momento": "2026-11-10T10:01:30-03:00"},
                ],
            ),
            _campanha("c2", "Campanha Dois", "em_andamento", 4, 0, []),
        ]
    )
    with TestClient(main.app) as client:
        corpo = client.get("/api/reports").json()

    resumo = corpo["resumo"]
    assert resumo["campanhas"] == 2
    assert resumo["enviadas"] == 12
    assert resumo["erros"] == 2
    assert resumo["taxa_sucesso"] == 85.7  # 12 / 14
    assert resumo["ativas"] == 1
    assert resumo["concluidas"] == 1

    nomes = {c["nome"]: c for c in corpo["por_campanha"]}
    assert nomes["Campanha Um"]["total"] == 10
    assert nomes["Campanha Um"]["concluida_em"]
    assert nomes["Campanha Dois"]["status"] == "em_andamento"
    assert nomes["Campanha Dois"]["concluida_em"] is None


def test_reports_agrega_por_dia(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    storage.save_campaigns(
        [
            _campanha(
                "c1",
                "Campanha Um",
                "concluida",
                2,
                1,
                [
                    {"lead_id": "l1", "status": "enviado", "momento": "2026-11-09T20:00:00-03:00"},
                    {"lead_id": "l2", "status": "enviado", "momento": "2026-11-10T10:00:00-03:00"},
                    {"lead_id": "l3", "status": "erro", "momento": "2026-11-10T10:00:30-03:00"},
                ],
            ),
        ]
    )
    with TestClient(main.app) as client:
        corpo = client.get("/api/reports").json()

    assert corpo["por_dia"] == [
        {"dia": "2026-11-09", "enviadas": 1, "erros": 0},
        {"dia": "2026-11-10", "enviadas": 1, "erros": 1},
    ]
