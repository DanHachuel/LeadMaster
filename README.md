# LeadMaster — SaaS Local de Prospecção e CRM

**SaaS local de prospecção e CRM.** CRM Kanban, extratores de leads, disparos,
agentes de IA, cadências de follow-up e WhatsApp — instalável via `npx`,
**100% local** (JSON na sua máquina), sem nuvem e sem banco de dados externo.

![npm version](https://img.shields.io/npm/v/@danhachuel/leadmaster.svg) ![npm downloads](https://img.shields.io/npm/dm/@danhachuel/leadmaster.svg) ![tests](https://img.shields.io/badge/tests-127%2B%20passed-brightgreen) ![React](https://img.shields.io/badge/React%2018-Vite%20%2B%20TS-61dafb) ![Backend](https://img.shields.io/badge/FastAPI-Python%203.11%2B-009688) ![storage](https://img.shields.io/badge/storage-JSON%20local-orange) ![theme](https://img.shields.io/badge/tema-claro%2Fescuro-indigo)

> 📖 **Guia completo de uso:** [MANUAL.md](MANUAL.md) — como configurar e usar cada tela.

---

## Instalação e uso

Requisitos: **Node 18+** e **Python 3.11+** no PATH.

```cmd
:: CMD / MobaXterm (Windows)
npx.cmd --yes --prefer-online @danhachuel/leadmaster@latest install
npx.cmd --yes --prefer-online @danhachuel/leadmaster@latest
```

```bash
# Linux / macOS / PowerShell
npx --yes @danhachuel/leadmaster@latest install
npx --yes @danhachuel/leadmaster@latest
```

Para fixar uma versão específica, troque `@latest` por `@<versão>`
(ex.: `@0.1.41`). Confira a mais recente em
`npm view @danhachuel/leadmaster version`.

### Quick Start

| Ação | Comando |
|---|---|
| Preparar (deps Python + dados) | `npx @danhachuel/leadmaster install` |
| **Iniciar** | `npx @danhachuel/leadmaster` (ou `... start`) |
| **Encerrar** | `npx @danhachuel/leadmaster kill` (ou `... stop`) |
| Diagnóstico | `npx @danhachuel/leadmaster doctor` |
| Ajuda / versão | `npx @danhachuel/leadmaster help` / `... version` |

- O servidor sobe em **`http://127.0.0.1:5055`** (porta ocupada? sobe
  automaticamente na próxima: 5056, 5057, ...) e **imprime a URL** — o
  LeadMaster **nunca abre o navegador nem janelas**: quem abre é você.
- O terminal fica **preso** exibindo os logs em tempo real. **`Ctrl+C`**
  encerra. Se a janela do terminal for fechada, o servidor continua no ar —
  use `kill` para encerrar de qualquer lugar.
- Flags úteis: `--home=<caminho>` (pasta de dados), `--port=<numero>`,
  `--skip-python-deps` (CI). Variáveis: `LEADMASTER_HOME`, `LEADMASTER_PORT`.
- Pasta de dados padrão: `Documents\REPOSITORIO\LeadMaster`. Tudo fica em
  `<home>/storage/*.json` (leads, campanhas, config, colunas do Kanban...).

### Modo desenvolvimento (a partir do repositório)

```bash
npm install          # dependências da raiz (concurrently)
npm run dev          # backend (uvicorn :8010, reload) + frontend (Vite :5055)
```

---

## Funcionalidades

- **Painel (Dashboard)** — métricas em tempo real (leads por etapa, taxa de
  entrega/erro), licença e aviso do modelo de execução.
- **Funil** — conversões por etapa do CRM e **gargalo** (onde os leads param).
- **CRM Kanban** — drag-and-drop (@dnd-kit), **colunas personalizáveis**,
  modal de detalhes com edição (nome/telefone/e-mail/tags/score/observações),
  **busca instantânea** (nome, telefone ou e-mail), **exportação CSV**,
  sugestões de movimentação por IA.
- **Leads** — CRUD completo, importação em massa, barra de preenchimento,
  enriquecimento por IA.
- **Extratores** — **Google Maps** (palavra-chave + localização),
  **Instagram** (seguidores de um perfil) e **CNPJ** (empresas por CNAE + UF).
  Sem ferramenta configurada, geram **mock de 5–10 registros** para teste
  seguro; configuradas, executam o scraper real com isolamento de processos
  (sem janelas de CMD). Toda extração entra na coluna **"Novos Leads"**.
- **Disparos** — campanhas com worker em background, **geração de mensagem por
  IA**, pausa/retomada no meio do processo, contadores em tempo real.
- **Cadências** — regras automáticas de follow-up por etapa + dias de espera,
  com execução manual ou agendada.
- **Agentes** — agente de disparo (templates/prompt) e agente de atendimento
  (chat de teste com a LLM, texto ou voz via pipecat).
- **Conexões** — gateway **WhatsApp** (OpenWA/WAHA): status, **QR Code** para
  conectar e teste de envio.
- **Relatórios** — totais consolidados, taxa de sucesso geral, gráfico de
  volume por campanha e histórico.
- **Ferramentas** — LLM (provedor/base URL/modelo/chave), caminhos dos
  scrapers, gateway e webhook — tudo em `config.json` local com segredos
  mascarados.
- **Webhook** — eventos locais (`lead.criado`, `lead.etapa`,
  `campanha.concluida`...) com teste de entrega.
- **Suporte** — diagnóstico do ambiente + chat de teste do agente.
- **Tema claro/escuro** — alternância no canto superior direito (persistida).

---

## Arquitetura

```
npx @danhachuel/leadmaster
 └─ scripts/cli.mjs                 # launcher Node: instala deps, copia o runtime,
    │                               # mata instância anterior, sobe o uvicorn e prende
    │                               # o terminal (stdio: 'inherit' + readline + Ctrl+C)
    └─ <home>/.runtime/backend      # runtime permanente (nunca roda do cache do npx)
        └─ backend/main.py          # FastAPI: API REST + serving da UI (frontend/dist)
            ├─ services/storage.py      # JSON local — lock + escrita atômica (_write)
            ├─ services/extractors.py   # Google Maps / Instagram / CNPJ
            ├─ services/agents.py       # disparo + atendimento (workers em thread)
            ├─ services/cadence.py      # cadências de follow-up
            ├─ services/llm.py          # LLM OpenAI-compatível
            └─ services/pipeline.py     # motor de conteúdo
                 └─ storage/*.json      # leads · campanhas · config · colunas...
frontend (React 18 + Vite + TS + Tailwind)  ──HTTP via src/lib/api.ts──>  /api/*
```

- **Portas**: UI/API `:5055` (auto-incrementa) · backend de desenvolvimento
  `:8010` (proxy do Vite).
- **Modelo de execução**: o launcher sobe o servidor em grupo de processos
  próprio (`detached`), com `stdio: 'inherit'`; **fechar o terminal não derruba
  o app** — encerre com `kill`.
- **Degradação graciosa**: integração externa ausente/falhando nunca gera falso
  sucesso — a mensagem diz o que configurar.

### Serviços externos (opcionais, todos locais)

| Serviço | Onde configurar | Para qué |
|---|---|---|
| LLM OpenAI-compatível (NVIDIA NIM, OpenAI...) | Ferramentas → LLM | agentes, sugestões, enriquecimento, chat |
| [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper) | Ferramentas → Extratores | extrator real do Maps |
| [lucasoal/igmapper](https://github.com/lucasoal/igmapper) | Ferramentas → Extratores | extrator real do Instagram |
| Provedor de busca CNPJ (OpenCNPJ...) + [D4Vinci/Scrapling](https://github.com/D4Vinci/Scrapling) | Ferramentas → Extratores | busca por CNAE/UF e scraping profundo |
| Gateway WhatsApp ([OpenWA](https://github.com/open-wa/wa-automate) / WAHA) | Conexões | disparos e QR Code |
| [eracle/OpenOutreach](https://github.com/eracle/OpenOutreach) | Ferramentas → Agentes | envio real de campanhas |
| [pipecat-ai/pipecat](https://github.com/pipecat-ai/pipecat) | Ferramentas → Integrações | atendimento por voz |

---

## UX

A interface replica o protótipo `LeadMaster v1.0` (sidebar escura `#1e1b4b`,
cards claros, gradientes indigo/purple, tema claro/escuro) e aplica as
**7 Leis de Usabilidade** (Fitts, Hick, Zeigarnik, Jakob, Gradiente de Meta,
von Restorff, Miller).

---

## Versionamento e release

- Etiqueta visual `MAJOR.MINOR.PATCH` com **patch de dois dígitos**
  (`0.1.00` → `0.1.99` → `0.2.00`); o NPM normaliza para a forma canônica.
- Publicação **sempre** via GitHub Actions
  (`.github/workflows/publish-npm.yml`): dispatch com `dist-tag next` → push da
  tag `vX.Y.ZZ` → promoção a `latest`.
- Toda versão precisa de entrada no `CHANGELOG.md`. Regras completas em
  `AGENTS.md`.

## Licença

[MIT](LICENSE) © Dan Hachuel