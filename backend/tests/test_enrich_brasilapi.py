"""Testes do enriquecimento com BrasilAPI — POST /api/crm/leads/{id}/enrich.

Mockam a chamada externa (httpx.get) — nunca gastamos rede no CI — e verificam
o comportamento real: dados gravados em extras.brasilapi, top-level preenchido
e erros acionáveis (400/404). LEDMASTER_HOME em diretório temporário.
"""

from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

import main
from services import storage


class RespostaFalsa:
    """Simula uma resposta do httpx (só o que o código consome)."""

    def __init__(self, status_code=200, payload=None, texto=''):
        self.status_code = status_code
        self._payload = payload
        self.text = texto or (str(payload) if payload else '')

    def json(self):
        if self._payload is None:
            raise ValueError('sem json')
        return self._payload


def _client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    return TestClient(main.app)


def _lead_com_cnpj(client, cnpj='11222333000181'):
    return client.post(
        '/api/crm/leads',
        json={
            'nome': 'Empresa Alpha Ltda',
            'telefone': '(11) 90000-0000',
            'fonte': 'CNPJ',
            'cnpj': cnpj,
        },
    ).json()


def test_enriquecer_grava_extras_brasilapi(tmp_path, monkeypatch):
    payload = {
        'razao_social': 'EMPRESA ALFA LTDA',
        'nome_fantasia': 'Alfa Tecnologia',
        'capital_social': 150000.0,
        'email': 'contato@alfa.com.br',
        'qsa': [{'nome_socio': 'MARIA SOUZA'}, {'nome_socio': 'JOAO LIMA'}],
    }
    with _client(tmp_path, monkeypatch) as client:
        lead = _lead_com_cnpj(client)
        with patch('httpx.get', return_value=RespostaFalsa(200, payload)) as chamada:
            r = client.post(f"/api/crm/leads/{lead['id']}/enrich")
        assert r.status_code == 200
        assert chamada.called
        assert 'brasilapi.com.br/api/cnpj/v1/11222333000181' in chamada.call_args[0][0]

        corpo = r.json()
        assert corpo['ok'] is True
        br = corpo['enriquecido']
        assert br['razao_social'] == 'EMPRESA ALFA LTDA'
        assert br['nome_fantasia'] == 'Alfa Tecnologia'
        assert br['capital_social'] == 150000.0
        assert br['email'] == 'contato@alfa.com.br'
        assert br['socio_principal'] == 'MARIA SOUZA'  # primeiro do QSA

        # Gravado no disco (contrato-check-guard): extras.brasilapi + top-level.
        salvo = [l for l in client.get('/api/crm/leads').json() if l['id'] == lead['id']][0]
        assert salvo['extras']['brasilapi']['razao_social'] == 'EMPRESA ALFA LTDA'
        assert salvo['extras']['brasilapi']['socio_principal'] == 'MARIA SOUZA'
        assert salvo['empresa'] == 'Alfa Tecnologia'  # top-level preenchido


def test_enriquecer_cnpj_em_extras(tmp_path, monkeypatch):
    # Lead criado por extrator mock guarda CNPJ dentro de extras.
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    storage.save_leads(
        [
            {
                'id': 'lead-extras',
                'nome': 'Beta Servicos',
                'telefone': '(21) 90000-0000',
                'email': '',
                'fonte': 'CNPJ',
                'etapa': 'leads',
                'empresa': '',
                'cidade': '',
                'endereco': '',
                'score': 50,
                'tags': [],
                'observacoes': '',
                'extras': {'cnpj': '99.888.777/0001-66'},
                'criado_em': storage.now_iso(),
                'atualizado_em': storage.now_iso(),
            }
        ]
    )
    payload = {'razao_social': 'BETA SERVICOS LTDA', 'nome_fantasia': '', 'capital_social': 0, 'email': '', 'qsa': []}
    with TestClient(main.app) as client:
        with patch('httpx.get', return_value=RespostaFalsa(200, payload)) as chamada:
            r = client.post('/api/crm/leads/lead-extras/enrich')
        assert r.status_code == 200
        # CNPJ com pontuação é normalizado para dígitos na URL.
        assert chamada.call_args[0][0].endswith('/99888777000166')


def test_enriquecer_cnpj_nao_encontrado(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        lead = _lead_com_cnpj(client)
        with patch('httpx.get', return_value=RespostaFalsa(404, None, 'not found')):
            r = client.post(f"/api/crm/leads/{lead['id']}/enrich")
        assert r.status_code == 400
        assert 'não encontrado' in r.json()['detail']


def test_enriquecer_rate_limit(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        lead = _lead_com_cnpj(client)
        with patch('httpx.get', return_value=RespostaFalsa(429, None, 'too many requests')):
            r = client.post(f"/api/crm/leads/{lead['id']}/enrich")
        assert r.status_code == 400
        assert '429' in r.json()['detail']


def test_enriquecer_timeout_ou_indisponivel(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        lead = _lead_com_cnpj(client)
        with patch('httpx.get', side_effect=httpx.TimeoutException('tempo esgotado')):
            r = client.post(f"/api/crm/leads/{lead['id']}/enrich")
        assert r.status_code == 400
        assert 'BrasilAPI indisponível' in r.json()['detail']


def test_enriquecer_sem_cnpj(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        lead = client.post(
            '/api/crm/leads',
            json={'nome': 'Sem CNPJ', 'telefone': '(11) 90000-0000', 'fonte': 'Manual'},
        ).json()
        r = client.post(f"/api/crm/leads/{lead['id']}/enrich")
        assert r.status_code == 400
        assert 'sem CNPJ' in r.json()['detail']


def test_enriquecer_lead_inexistente(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        r = client.post('/api/crm/leads/nao-existe/enrich')
        assert r.status_code == 404