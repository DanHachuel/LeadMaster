# Skill: Systemic View Guard (Visão Sistêmica)

**Propósito:** evitar que uma alteração local quebre dependências ocultas em outro módulo.
O Thunderbolt quebrou em produção várias vezes porque o agente alterou um arquivo sem olhar quem o consumia. No LeadMaster isso é ainda mais crítico: 3 camadas independentes (launcher Node, backend Python, frontend React) compartilham dados e contratos.

## Mapa de Dependências

```
npx → scripts/cli.mjs ──spawna──> backend/main.py (FastAPI) ──serve──> frontend/dist
                                          │
                                          ├─ services/*.py ──> storage/*.json  (JSON local)
                                          └─ workers em background (threads/asyncio)

frontend/src/lib/api.ts ──HTTP──> backend/main.py  (contrato REST)
```

| Se você alterar... | Verifique obrigatoriamente... |
|---|---|
| `backend/main.py` (rotas) | `frontend/src/lib/api.ts` (contrato), testes em `backend/tests/`, e se a tela consome a rota |
| `backend/services/storage.py` | todos os serviços que leem/escrevem os JSON e os workers em background (`services/cadence.py`, `services/agents.py`) |
| `scripts/cli.mjs` | `backend/main.py` (o spawn depende de cwd/env), o workflow `publish-npm.yml` e o smoke test |
| `backend/services/pipeline.py`, `cadence.py`, `agents.py` | os JSON que eles tocam (`pipeline.json`, `cadences.json`, `campaigns.json`) e as telas que exibem o resultado |
| `frontend/src/lib/types.ts` | todas as páginas que usam os tipos |
| `crm_columns.json` / rotas de colunas | leads com `etapa` apontando para colunas removidas (regra de bloqueio no DELETE) |

## Regra de Ouro

> **Antes de alterar um arquivo, liste quem depende dele.** Use `grep` pelo nome das
> rotas, funções ou tipos alterados em todo o repositório (frontend + backend + scripts
> + testes). Se encontrar pelo menos um consumidor, atualize-o no mesmo commit.

## Checklist pré-commit

1. `grep -r "nome_da_rota_ou_funcao" backend/ frontend/src/ scripts/` — zero surpresas?
2. A suíte `python -m pytest backend/tests -q` continua verde?
3. `npm --prefix frontend run build` passa (tipos do contrato sincronizados)?
4. O endpoint alterado quebrou alguma tela que ainda não migrei? (teste a rota na mão antes)

## Sinais de alerta

- Alterou o shape de um JSON sem ver os workers em background.
- Renomeou um campo do PUT e não atualizou o modal que o consome.
- Removeu uma coluna do Kanban sem checar leads órfãos.