"""Testes das métricas do Painel — GET /api/metrics.

Popula os JSONs de teste (LEADMASTER_HOME em diretório temporário) com dados
conhecidos e verifica o cálculo em tempo real: totais de leads, distribuição
por etapa, consolidação das campanhas (enviadas/erros/taxas) e status da
conexão.
"""

from fastapi.testclient import TestClient

import main
from services import storage


def _client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    # Cria os arquivos vazios ANTES do lifespan: evita os seeds de demo que o
    # backend semeia na primeira execução — assim o teste parte de base zerada.
    storage.save_leads([])
    storage.save_campaigns([])
    return TestClient(main.app)


def _lead(nome: str, etapa: str, telefone: str) -> dict:
    return {
        "nome": nome,
        "telefone": telefone,
        "email": "",
        "fonte": "teste",
        "etapa": etapa,
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


def test_metrics_sem_dados(tmp_path, monkeypatch):
    # Base vazia: nada de quebrar — taxas padrão (100% entrega, 0% erro).
    with _client(tmp_path, monkeypatch) as client:
        r = client.get("/api/metrics")
        assert r.status_code == 200
        m = r.json()
        assert m["leads_total"] == 0
        assert m["leads_por_etapa"] == {"leads": 0, "em_contato": 0, "proposta": 0, "fechado": 0}
        assert m["total_enviadas"] == 0
        assert m["total_erros"] == 0
        assert m["taxa_entrega"] == 100.0
        assert m["taxa_erro"] == 0.0
        assert m["campanhas"] == {"enviadas": 0, "erros": 0, "total": 0}
        assert m["conexao"]["geral"] is True
        assert isinstance(m["conexao"]["llm"], bool)
        assert isinstance(m["conexao"]["openoutreach"], bool)


def test_metrics_com_leads_conhecidos(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    storage.save_leads([])
    storage.save_campaigns([])
    storage.import_leads(
        [
            _lead("Lead A", "leads", "(11) 90000-0001"),
            _lead("Lead B", "leads", "(11) 90000-0002"),
            _lead("Lead C", "em_contato", "(11) 90000-0003"),
            _lead("Lead D", "proposta", "(11) 90000-0004"),
            _lead("Lead E", "fechado", "(11) 90000-0005"),
        ],
        dedup=False,
    )
    with TestClient(main.app) as client:
        m = client.get("/api/metrics").json()
        assert m["leads_total"] == 5
        assert m["leads_por_etapa"] == {"leads": 2, "em_contato": 1, "proposta": 1, "fechado": 1}


def test_metrics_consolida_campanhas(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    storage.save_leads([])
    storage.save_campaigns(
        [
            {"id": "c1", "nome": "Campanha 1", "status": "concluida", "enviadas": 90, "erros": 10},
            {"id": "c2", "nome": "Campanha 2", "status": "concluida", "enviadas": 60, "erros": 2},
        ]
    )
    with TestClient(main.app) as client:
        m = client.get("/api/metrics").json()
        assert m["total_enviadas"] == 150
        assert m["total_erros"] == 12
        assert m["taxa_entrega"] == 92.6  # 150 / 162 * 100
        assert m["taxa_erro"] == 7.4  # 12 / 162 * 100
        assert m["campanhas"] == {"enviadas": 150, "erros": 12, "total": 2}


def test_metrics_reflete_alteracoes_no_kanban(tmp_path, monkeypatch):
    # Mover um lead de etapa (rota do CRM) muda a contagem no /api/metrics.
    with _client(tmp_path, monkeypatch) as client:
        criado = client.post(
            "/api/crm/leads",
            json={"nome": "Lead Kanban", "telefone": "(11) 90000-0009", "fonte": "teste"},
        ).json()
        m1 = client.get("/api/metrics").json()
        assert m1["leads_por_etapa"]["leads"] == 1

        client.put(f"/api/crm/leads/{criado['id']}/etapa", json={"etapa": "fechado"})
        m2 = client.get("/api/metrics").json()
        assert m2["leads_por_etapa"] == {"leads": 0, "em_contato": 0, "proposta": 0, "fechado": 1}
        assert m2["leads_total"] == 1
