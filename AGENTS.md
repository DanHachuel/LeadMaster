# AGENTS.md — Regras do Projeto LeadMaster

Regras obrigatórias para qualquer agente (humano ou IA) trabalhando neste repositório.
O LeadMaster é um **SaaS local de prospecção e automação de conteúdo**: CRM, extratores de
leads, agentes de IA e pipeline completo de geração de vídeos faceless (YouTube e Shorts),
instalável via `npx` e 100% local.

---

## 1. Stack Tecnológica (obrigatória)

- **Frontend:** React 18 + Vite + TypeScript, Tailwind CSS, Chart.js (`react-chartjs-2`),
  `@dnd-kit/core` (Kanban), Font Awesome, React Router.
- **Backend:** Python 3.11+ com FastAPI.
- **Armazenamento:** 100% local via arquivos JSON. **Proibido** Supabase, Firebase ou
  qualquer banco externo.
- **Distribuição:** NPM (`@danhachuel/leadmaster`), instalação via `npx`.
- **Portas:** a UI/API local usa a porta padrão **5055** (`UI_PORT`); se estiver ocupada,
  o launcher avança automaticamente (5056, 5057, ...) até encontrar uma porta livre. Em
  modo dev, a UI (Vite) também inicia em 5055 com auto-incremento e o backend uvicorn
  fica em 8000 (proxy `/api`).
- **Proibido:** Streamlit.

## 2. Estrutura do Repositório

```
LeadMaster/
├── .github/workflows/publish-npm.yml   # Publicação NPM via GitHub Actions
├── scripts/cli.mjs                      # Launcher npx (install / start / doctor)
├── frontend/                            # React + Vite + Tailwind (UI)
│   ├── src/components/                  # Sidebar, Header, MetricCard, Charts, Kanban...
│   ├── src/pages/                       # Dashboard, Leads, CRM, Disparos, Extratores,
│   │                                    # Pipeline, Agentes, Ferramentas...
│   └── src/lib/api.ts                   # Cliente HTTP tipado
├── backend/                             # FastAPI
│   ├── main.py                          # Rotas da API + serving da UI (dist)
│   ├── services/                        # Integrações e regras de negócio
│   │   ├── moneyprinter.py              # MoneyPrinterTurbo (localhost:8080)
│   │   ├── short_video_maker.py         # Short-Video-Maker (localhost:3123)
│   │   ├── openmontage.py               # OpenMontage via CLI
│   │   ├── youtube_upload.py            # Upload (não listado → 1h → público)
│   │   ├── crm_agent.py                 # Agente de CRM (sugestões/enriquecimento)
│   │   ├── extractors.py                # Google Maps / Instagram / CNPJ
│   │   ├── agents.py                    # Agente de disparo e atendimento
│   │   ├── llm.py                       # LLM (OpenAI-compatível)
│   │   ├── pipeline.py                  # Motor do pipeline de vídeos
│   │   └── storage.py                   # Persistência JSON local
└── storage/                             # Dados locais (ignorados pelo git)
    ├── leads.json
    ├── campaigns.json
    ├── pipeline.json
    └── config.json
```

## 3. Armazenamento Local

- A pasta de dados (**home**) resolve nesta ordem: flag `--home` > variável
  `LEADMASTER_HOME` > `Documents/REPOSITORIO/LeadMaster` > `~/.leadmaster`.
- Toda persistência ocorre em `<home>/storage`: `leads.json`, `campaigns.json`,
  `pipeline.json`, `config.json`.
- Sementes (seeds) são criadas automaticamente pelo backend na primeira execução.
- **Nunca** persistir dados em nuvem. **Nunca** commitar conteúdo de `storage/`.

## 4. Endpoints e Integrações Externas

| Integração | Endpoint padrão | Uso |
|---|---|---|
| MoneyPrinterTurbo | `POST http://localhost:8080/api/v1/videos` | Produção wide 16:9 |
| Short-Video-Maker | `POST http://localhost:3123/api/short-video` | Produção Shorts 9:16 |
| OpenMontage | CLI local configurável | Fallback de produção |
| Upload YouTube | Serviço local configurável (primário) + `youtube-uploader-mcp` (fallback) | Upload não listado → aguarda 1h → público (limite 50/dia) |
| Google Maps | `gosom/google-maps-scraper` via CLI | Extração de leads |
| Instagram | `lucasoal/igmapper` via CLI | Extração de leads |
| CNPJ | BrasilAPI + provedor de busca configurável + `D4Vinci/Scrapling` (profundo) | Extração de leads |
| OpenOutreach | `eracle/OpenOutreach` | Agente de disparo |
| pipecat | `pipecat-ai/pipecat` | Agente de atendimento por voz |

Regra de degradação: toda integração externa deve falhar **graciosamente** com mensagem
acionável (como instalar/iniciar o serviço) — nunca travar a aplicação, nunca fingir sucesso.

## 5. Versionamento NPM

O LeadMaster usa a convenção visual de lançamento `MAJOR.MINOR.PATCH`, com **dois dígitos
no PATCH**. Ao atingir o patch 99, a próxima publicação deve incrementar o componente
MINOR e reiniciar o PATCH em 00; quando o MINOR está em 9, é o MAJOR que avança e
MINOR/PATCH reiniciam em 00.

Exemplos obrigatórios: depois de `0.3.99`, a etiqueta apresentada é `0.4.00`; depois de
`0.9.99`, a etiqueta apresentada é `1.0.00` (nunca `0.10.00`). Nunca apresentar patch acima
de 99 nem minor acima de 9.

O NPM aplica SemVer e normaliza zeros à esquerda: a etiqueta visual `0.4.00` é publicada no
registry como a versão canônica `0.4.0`. Antes de cada publicação, confirmar a versão em
`package.json`, no workflow NPM e no registry. Nos comandos Windows/MobaXterm, usar a
versão canônica literal confirmada no registry; na interface e comunicação de lançamento,
usar a etiqueta visual com patch de dois dígitos.

## 6. Push obrigatório

Sempre que uma sessão de agente criar commits, o ramo deve ser enviado de imediato para o
origin (push) — nunca deixar trabalho apenas commitado no disco local. Não perguntar ao
utilizador se deve fazer push: fazer sempre, automaticamente, no final de cada tarefa que
produza commits.

## 7. Regras de Release (permanentes)

- **Publicação imediata** — sempre que algo for atualizado no repositório, enviar para o
  GitHub (push) e publicar de imediato a nova versão no NPM.
- **Publicar sempre via GitHub Actions** — as publicações NPM ocorrem sempre via o workflow
  *Publish npm package* (`.github/workflows/publish-npm.yml`), nunca por `npm publish`
  local. Sequência: bump duplo → commit/push → dispatch manual com dist-tag `next` → push
  da tag `vX.Y.ZZ`, que verifica o tarball e promove a versão a `latest`.
- **Transparência** — depois de criar ou publicar uma versão, relatar explicitamente a
  versão e as áreas ou ficheiros alterados.
- **UX sem travas de pré-registo** — nunca criar travas de pré-registo; validações de
  credenciais apenas no momento da ação que realmente precisa delas.
- **Comandos de instalação** — após cada versão, entregar sempre os comandos no formato:
  - CMD/MobaXterm: `npx.cmd --yes --prefer-online @danhachuel/leadmaster@<VERSAO> install`
    e `npx.cmd --yes --prefer-online @danhachuel/leadmaster@<VERSAO>`
  - Instalação normal: `npx --yes @danhachuel/leadmaster@<VERSAO> install` e
    `npx --yes @danhachuel/leadmaster@<VERSAO>`
- **CHANGELOG obrigatório** — sempre que existir qualquer alteração com push (código,
  docs, configuração, correção, publicação npm), escrever a entrada correspondente no
  `CHANGELOG.md` antes de publicar — nenhuma versão sai sem registo. Ao integrar trabalho
  de outra sessão sem entrada, documentá-la retroativamente.
- **Sessões simultâneas** — antes de qualquer commit/push, verificar o master remoto
  (`git fetch origin` + comparar) e fazer rebase sempre que o master tiver avançado — o
  utilizador corre várias sessões simultâneas. Em colisão de versão, a versão já publicada
  vence e a sessão renumera para o patch seguinte (confirmar no registry antes de publicar).

## 8. Interface do Usuário (UI/UX)

A UI é fiel ao protótipo `LeadMaster v1.0.html`: sidebar fixa escura (`#1e1b4b`), cards
brancos com sombras suaves, ícones Font Awesome, tipografia Inter, gradiente
indigo/purple apenas na ação principal.

**As 7 Leis de UX são requisitos de implementação:**

1. **Lei de Fitts** — botões primários ("Iniciar Novo Vídeo", "Salvar") grandes e de fácil
   acesso.
2. **Lei de Hick** — configurações avançadas escondidas em menus expansíveis (accordions).
3. **Efeito Zeigarnik** — barras de progresso visíveis no pipeline de vídeos e no
   preenchimento de leads.
4. **Lei de Jakob** — consistência visual com o protótipo (menu lateral fixo, cards,
   ícones FontAwesome).
5. **Gradiente de Meta** — mensagens motivacionais ("Faltam 2 etapas para o upload").
6. **Efeito von Restorff** — botão de ação principal destacado com gradiente
   indigo/purple sobre fundo neutro.
7. **Lei de Miller** — métricas relacionadas agrupadas em um único bloco visual (cards).

## 9. Convenções de Código

- Frontend: TypeScript estrito; componentes funcionais; classes utilitárias Tailwind;
  chamadas HTTP somente via `frontend/src/lib/api.ts`.
- Backend: sem frameworks extras além dos listados em `backend/requirements.txt`;
  escrita de JSON sempre atômica e sob lock (`services/storage.py`);
  mensagens de erro sempre acionáveis (o que fazer para resolver).
- Comentários e textos de UI em português do Brasil.
- Toda nova página/rota frontend precisa de entrada correspondente na Sidebar.
- `GET /api/config` jamais expõe segredos (campo mascarado + flag `_configurado`).

## 10. QA antes de commit/push

1. `npm --prefix frontend run build` — build limpo (tsc + vite).
2. `python -m py_compile` em todos os `.py` do backend (ou `python -m compileall backend`).
3. Subir backend (`python -m uvicorn main:app` em `backend/`) e conferir `/api/health`.
4. Fluxo manual: criar lead → mover no Kanban → criar job de vídeo → iniciar/pausar.
