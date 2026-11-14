# Skill: Atomic Write Guard (Escrita Atômica em JSON)

**Propósito:** evitar corrupção de dados. O LeadMaster não tem banco de dados: os JSON
em `<home>/storage/` **são** o banco. Eles são escritos por 3 frentes simultâneas —
rotas da API, workers em background (campanhas, cadências, pipeline) e o launcher —
em Windows, onde arquivo aberto por outro processo quebra a escrita.

## Regras obrigatórias

1. **Toda escrita em JSON passa por `backend/services/storage.py`** (`_write`). Ela já
   implementa: `threading.Lock` global + escrita em `.tmp` + `os.replace()` atômico.
2. **Nunca** use `json.dump(..., open('x.json','w'))` diretamente em serviço, rota ou
   worker.
3. **Nunca** leia um JSON fora de `storage.py` (a não ser em testes, usando o path do
   tmp_path).
4. **Workers** (`services/cadence.py`, `services/agents.py`, `services/pipeline.py`)
   devem reler o registro do disco antes de mergear contadores — o padrão do projeto é
   a função `_gravar(fresco)` (merge sobre cópia fresca).

## Caminhos sensíveis

| Arquivo | Quem escreve |
|---|---|
| `leads.json` | API (CRUD), extratores (import), worker de cadências |
| `campaigns.json` | API (CRUD/status), worker de disparos |
| `cadences.json` | API (CRUD), worker de cadências |
| `pipeline.json` | API (jobs), motor do pipeline, agendador de publicação |
| `crm_columns.json` | API (colunas) |
| `agents.json`, `config.json` | API |

## Código correto (referência)

```python
# CERTO — usa a abstração do projeto
storage.update_lead(lead_id, {"etapa": "proposta"})

# ERRADO — quebra atomicidade e ignora o lock
with open('leads.json', 'w') as f:
    json.dump(leads, f)
```

## Teste obrigatório

Todo teste que valida escrita deve usar `tmp_path` + `monkeypatch.setenv(
"LEADMASTER_HOME", ...)` e verificar o **arquivo no disco**, não apenas a resposta.