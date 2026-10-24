# LeadMaster

**SaaS local de prospecção.** CRM, extratores de leads e agentes de IA — instalável via
`npx`, 100% local, sem nuvem e sem banco de dados externo.

![Stack](https://img.shields.io/badge/React%2018-Vite%20%2B%20TS-61dafb) ![Backend](https://img.shields.io/badge/FastAPI-Python%203.11%2B-009688) ![Storage](https://img.shields.io/badge/storage-JSON%20local-orange)

---

## Instalação e uso

Requisitos: **Node 18+** e **Python 3.11+** no PATH.

```cmd
:: CMD / MobaXterm (Windows)
npx.cmd --yes --prefer-online @danhachuel/leadmaster@0.1.0 install
npx.cmd --yes --prefer-online @danhachuel/leadmaster@0.1.0
```

```bash
# Linux / macOS / PowerShell
npx --yes @danhachuel/leadmaster@0.1.0 install
npx --yes @danhachuel/leadmaster@0.1.0
```

- `install` prepara a pasta de dados e instala as dependências Python.
- Sem argumentos, o launcher sobe o servidor local (FastAPI na porta **5055**) e abre o
  navegador automaticamente. Se a porta 5055 estiver ocupada, o LeadMaster sobe
  automaticamente na próxima livre (5056, 5057, ...). Pressione `Ctrl+C` para encerrar.
- Flags úteis: `--home=<caminho>` (pasta de dados), `--port=<numero>`,
  `doctor` (diagnóstico), `help`.

A pasta de dados padrão é `Documents\REPOSITORIO\LeadMaster` (sobrescreva com
`--home` ou `LEADMASTER_HOME`). Todos os dados — leads, campanhas e
configuração — ficam em `<home>\storage` como arquivos JSON.

### Modo desenvolvimento (a partir do repositório)

```bash
npm install          # dependências da raiz (concurrently)
npm run dev          # sobe backend (uvicorn :8010, reload) + frontend (Vite :5055)
```

O Vite dev server sobe a UI de desenvolvimento em `http://localhost:5055` (com
auto-incremento para 5056, 5057... se a porta estiver ocupada) e faz proxy de `/api`
para `http://127.0.0.1:8010` (backend de desenvolvimento).

---

## Módulos

| Módulo | O que faz |
|---|---|
| **Painel** | Status da conexão, taxa de entrega, taxa de erro, total de leads; gráfico de barras (leads por etapa do CRM) e doughnut (campanhas: enviadas × erros). |
| **Leads** | CRUD completo, importação em massa a partir dos extratores, barra de progresso de preenchimento, enriquecimento por IA. |
| **CRM Kanban** | Drag-and-drop (@dnd-kit) nas colunas *Leads → Em contato → Proposta → Fechado*; o agente de IA sugere movimentações e enriquece os cards. |
| **Extratores** | **Google Maps** (palavra-chave + localização, via `gosom/google-maps-scraper`), **Instagram** (URL do perfil, via `lucasoal/igmapper`) e **CNPJ** (BrasilAPI + busca por CNAE/UF + `D4Vinci/Scrapling`). Toda extração gera pré-visualização antes de importar. |
| **Disparos** | Campanhas de disparo (texto/áudio) com templates configuráveis e execução via `eracle/OpenOutreach`. |
| **Agentes** | Agente de disparo (prompts/templates) e agente de atendimento (texto via LLM ou voz via `pipecat-ai/pipecat`). |
| **Ferramentas** | Chaves de API, URLs das integrações locais, testes de conexão — tudo salvo em `config.json` local. |

---

## Arquitetura

```
npx @danhachuel/leadmaster
 └─ scripts/cli.mjs            # instala deps Python, sobe uvicorn, abre navegador
     └─ backend/main.py        # FastAPI: API + serving da UI construída (frontend/dist)
         ├─ services/storage.py        # JSON local (leads, campanhas, config)
         ├─ services/extractors.py     # Maps / Instagram / CNPJ
         ├─ services/crm_agent.py      # sugestões + enriquecimento
         ├─ services/agents.py         # disparo (OpenOutreach) + atendimento
         └─ services/llm.py            # LLM OpenAI-compatível
```

- **Portas**: LeadMaster UI/API `:5055` (auto-incrementa: 5056, 5057, ... se ocupada) ·
  backend de desenvolvimento `:8000`.
- **Degradación graciosa**: se um serviço externo não estiver configurado/rodando, a ação
  falha com mensagem acionável — nada de falsos sucessos.

### Serviços externos (opcionais, todos locais)

| Serviço | Como usar no LeadMaster |
|---|---|
| [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper) | Informe o caminho do binário em *Ferramentas → Extratores*. |
| [lucasoal/igmapper](https://github.com/lucasoal/igmapper) | Informe o caminho em *Ferramentas → Extratores*. |
| BrasilAPI / OpenCNPJ / Scrapling | Consulta por CNPJ e busca por CNAE/UF (configuráveis). |
| [eracle/OpenOutreach](https://github.com/eracle/OpenOutreach) | Agente de disparo. |
| [pipecat-ai/pipecat](https://github.com/pipecat-ai/pipecat) | Atendimento por voz. |

---

## UX

A interface replica o protótipo `LeadMaster v1.0` (sidebar escura `#1e1b4b`, cards
brancos, gradientes indigo/purple) e aplica as **7 Leis de Usabilidade**:

1. **Fitts** — CTAs grandes ("Nova Campanha", "Salvar").
2. **Hick** — configurações avançadas em accordions.
3. **Zeigarnik** — barras de progresso (preenchimento de leads e campanhas).
4. **Jakob** — consistência com o modelo mental do protótipo (menu lateral fixo).
5. **Gradiente de Meta** — "Faltam 2 campos para o lead ficar completo".
6. **von Restorff** — botão principal com gradiente sobre fundo neutro.
7. **Miller** — métricas agrupadas em cards (chunking).

---

## Versionamento e release

- Etiqueta visual: `MAJOR.MINOR.PATCH` com **patch de dois dígitos** (`0.1.00` → `0.1.99`
  → `0.2.00`; `0.9.99` → `1.0.00`). O NPM normaliza para a forma canônica (`0.1.0`).
- Publicação **sempre** via GitHub Actions (`.github/workflows/publish-npm.yml`):
  dispatch manual com `dist-tag next` → push da tag `vX.Y.ZZ` → promoção a `latest`.
- Toda versão precisa de entrada no `CHANGELOG.md`. Regras completas em `AGENTS.md`.

## Licença

[MIT](LICENSE) © Dan Hachuel
