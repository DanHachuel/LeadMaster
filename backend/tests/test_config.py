"""Testes das rotas de configuração — GET/POST/PUT /api/config.

Valida a estrutura padrão, o sigulo absoluto dos segredos (regra do
AGENTS.md: GET nunca expõe chaves), a persistência em config.json, o trim
automático de textos (prevenção de erros — Nielsen) e a rejeição de payloads
quebrados. LEADMASTER_HOME em diretório temporário.
"""

from fastapi.testclient import TestClient

import main
from services import storage


def _client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    return TestClient(main.app)


def test_get_retorna_estrutura_padrao(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        c = client.get("/api/config").json()
        for secao in ("llm", "extratores", "integracoes", "agentes", "webhook", "perfil"):
            assert secao in c
        assert c["llm"]["base_url"]  # default do OpenAI-compat
        assert c["llm"]["api_key"] == ""  # nunca exposto
        assert c["extratores"]["google_maps_cli"] == ""
        assert c["integracoes"]["openoutreach"]["enabled"] is False


def test_get_nunca_expõe_segredos(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        client.post("/api/config", json={"llm": {"api_key": "sk-super-secreta"}})
        corpo = client.get("/api/config").json()
        assert corpo["llm"]["api_key"] == ""
        assert corpo["llm"]["api_key_configurado"] is True
        # Nem o corpo cru da resposta pode conter a chave.
        assert "sk-super-secreta" not in client.get("/api/config").text


def test_post_persiste_e_aplica_trim(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        r = client.post(
            "/api/config",
            json={"llm": {"base_url": "  https://api.exemplo.com/v1  ", "api_key": "  sk-123  "}},
        )
        assert r.status_code == 200
        gravado = storage.get_config()["llm"]
        assert gravado["base_url"] == "https://api.exemplo.com/v1"  # trim aplicado
        assert gravado["api_key"] == "sk-123"
        # Round-trip pelo GET (mascarado) confirma a persistência.
        get = client.get("/api/config").json()
        assert get["llm"]["base_url"] == "https://api.exemplo.com/v1"
        assert get["llm"]["api_key_configurado"] is True


def test_post_segredo_vazio_mantem_atual(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        client.post("/api/config", json={"llm": {"api_key": "sk-original"}})
        client.post("/api/config", json={"llm": {"api_key": "", "modelo": "gpt-4o"}})
        gravado = storage.get_config()["llm"]
        assert gravado["api_key"] == "sk-original"  # vazio não apaga
        assert gravado["modelo"] == "gpt-4o"


def test_put_continua_funcionando(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        r = client.put("/api/config", json={"extratores": {"igmapper_cli": "  C:\\ferramentas\\igmapper.exe  "}})
        assert r.status_code == 200
        assert storage.get_config()["extratores"]["igmapper_cli"] == "C:\\ferramentas\\igmapper.exe"


def test_payload_invalido_422(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        # Lista no lugar de objeto: rejeitado pelo FastAPI.
        assert client.post("/api/config", json=["nao", "e", "objeto"]).status_code == 422
        # Seção que deve ser objeto recebendo escalar: rejeitado pela validação.
        r = client.post("/api/config", json={"llm": "string-no-lugar-de-objeto"})
        assert r.status_code == 422
        assert "objeto" in r.json()["detail"]
        # A configuração anterior (padrão) permanece íntegra.
        assert storage.get_config()["llm"]["base_url"] != "string-no-lugar-de-objeto"


def test_post_trim_em_arrays_e_aninhados(tmp_path, monkeypatch):
    with _client(tmp_path, monkeypatch) as client:
        client.post("/api/config", json={"webhook": {"url": "  https://hook.exemplo.com/x  ", "eventos": ["  lead.criado  "]}})
        wh = storage.get_config()["webhook"]
        assert wh["url"] == "https://hook.exemplo.com/x"
        assert wh["eventos"][0] == "lead.criado"
