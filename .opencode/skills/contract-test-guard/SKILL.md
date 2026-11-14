# Skill: Contract Test Guard (Testes de Contrato)

**Propósito:** garantir que os testes validem **comportamento real** e não a existência
de strings. No Thunderbolt, testes que só checavam substring passavam enquanto o app
quebrava — o pior dos dois mundos.

## O que é um bom teste neste projeto

```python
# CERTO — sobe a API real, usa home temporário e confere o JSON no disco
@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LEADMASTER_HOME", str(tmp_path))
    with TestClient(main.app) as c:
        yield c

def test_mover_lead(client):
    lead = client.post("/api/crm/leads", json={"nome": "X"}).json()
    r = client.put(f"/api/crm/leads/{lead['id']}/etapa", json={"etapa": "proposta"})
    assert r.status_code == 200
    salvo = [l for l in client.get("/api/crm/leads").json() if l["id"] == lead["id"]][0]
    assert salvo["etapa"] == "proposta"
```

```python
# ERRADO — teste de existência de string, não de comportamento
def test_rota_existe():
    assert 'etapa' in open('main.py').read()
```

## Regras

1. **Nunca** teste que só verifica substring de código fonte.
2. **Sempre** isole o storage: `tmp_path` + `LEADMASTER_HOME`. Nenhum teste pode tocar
   no storage real do usuário.
3. **Mock nas bordas, não no core:** mocke HTTP externo (`httpx.post`, LLM, gateway,
   scrapers) mas exercite rotas, storage e workers de verdade.
4. **Para cada bug corrigido, um teste que falharia antes da correção.** Bug conhecido
   já coberto: `import_leads` NameError, `configurado()` do WhatsApp, conexão stdin EOF.
5. **Caminho de erro também é teste:** 400/404/503 com mensagem acionável.

## Gate antes do commit

```bash
python -m pytest backend/tests -q     # tudo verde
npm --prefix frontend run build       # tsc + vite
```

Falhou? **Não commite.**