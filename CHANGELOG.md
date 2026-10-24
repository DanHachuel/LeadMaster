# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste ficheiro.
O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

A etiqueta visual de versão usa patch de dois dígitos (ex.: `0.1.00`); o registry NPM
normaliza para a forma canônica (ex.: `0.1.0`).

## [0.1.01] — 2026-10-23

### Removido

- **Pipeline de vídeos faceless** — o LeadMaster agora é 100% focado em prospecção
  (CRM, extratores de leads e agentes de IA). Removidos:
  - Aba lateral "Pipeline de Vídeos", página e rota `/pipeline`.
  - Integrações com MoneyPrinterTurbo, Short-Video-Maker, OpenMontage e upload para
    YouTube: serviços backend, endpoints `/api/pipeline`, cards e testes em
    Ferramentas, menções no Painel, tutorial do header, FAQ do Suporte e
    diagnóstico.
  - Motor do pipeline, agendador de publicação e contadores diários de upload.
  - `pipeline.json` do armazenamento local — removido automaticamente das
    instalações existentes, junto com as chaves de vídeo do `config.json`
    (`integracoes.moneyprinter`, `short_video_maker`, `openmontage`,
    `youtube_upload`, `uploads`) e o evento de webhook `video.publicado`.

### Adicionado

- Migração automática de configuração: chaves de vídeo de versões antigas são
  limpas na primeira execução da nova versão.
- Card "Status da Conexão" do Painel passa a mostrar LLM e OpenOutreach.

### Alterado

- Backend de desenvolvimento (uvicorn) agora usa a porta **8010** — a 8000 costuma
  ser usada por outros serviços locais (ex.: PandaNews), o que causava conflito.

## [0.1.00] — 2026-10-23

### Adicionado

- **Versão inicial do LeadMaster** — SaaS local de prospecção e automação de conteúdo,
  instalável via `npx @danhachuel/leadmaster` e 100% offline (sem nuvem).
- **Launcher NPM** (`scripts/cli.mjs`): comandos `install`, `start`, `doctor`, `version`,
  `help`; **comando único auto-suficiente** (estilo Thunderbolt) — `npx
  @danhachuel/leadmaster` sem argumentos verifica e prepara tudo sozinho antes de subir;
  **instalação idempotente** (dependências Python e Node só são instaladas/atualizadas
  quando realmente faltam; interface só é reconstruída quando o build não existe ou
  falha por deps desatualizadas); resolução da pasta de dados (`--home` /
  `LEADMASTER_HOME`, padrão `Documents/REPOSITORIO/LeadMaster`); instalação automática
  das dependências Python; porta padrão da UI/API **5055** com auto-incremento (5056,
  5057, ...) quando ocupada; deteção de instância já ativa; abertura automática do
  navegador; encerramento limpo.
- **Workflow de publicação** (`.github/workflows/publish-npm.yml`): build do frontend,
  validação de metadados, smoke-test do launcher, publicação via `dist-tag next`,
  verificação de tarball e promoção a `latest` por tag `v*`.
- **Backend FastAPI** (`backend/`):
  - Persistência local em JSON (`storage/leads.json`, `campaigns.json`, `pipeline.json`,
    `config.json`) com escrita atômica e seeds automáticas.
  - CRUD de leads com importação em massa, agente de CRM (sugestão de movimentação e
    enriquecimento via BrasilAPI/LLM).
  - Campanhas de disparo com execução em background, contadores e log por lead.
  - Motor do pipeline de vídeos faceless com 5 etapas (roteiro, thumbnail/título,
    produção wide 16:9, produção shorts 9:16, upload), controle
    iniciar/pausar/parar/repetir, logs por etapa e agendamento de publicação
    (não listado → 1h → público).
  - Integrações: MoneyPrinterTurbo (localhost:8080), Short-Video-Maker (localhost:3123),
    OpenMontage (CLI), upload YouTube com limite de 50/dia e fallback
    `youtube-uploader-mcp`, LLM OpenAI-compatível, OpenOutreach, pipecat.
  - Extratores de leads: Google Maps (`gosom/google-maps-scraper`), Instagram
    (`lucasoal/igmapper`), CNPJ (BrasilAPI + provedor de busca por CNAE/UF +
    `D4Vinci/Scrapling`).
  - Endpoints de diagnóstico (`/api/health`, `/api/doctor`), métricas do painel e
    serving estático da UI construída (modo `npx`).
- **Frontend React 18 + Vite + TypeScript + Tailwind** (`frontend/`):
  - UI fiel ao protótipo `LeadMaster v1.0` (sidebar `#1e1b4b`, cards brancos, gradientes
    indigo/purple, Font Awesome) com as 7 Leis de UX aplicadas; **favicon de urso** nas
    guias dos navegadores (`frontend/public/favicon.svg`).
  - Páginas: Painel (métricas + gráficos Chart.js), Leads (CRUD + progresso de
    preenchimento), CRM Kanban (`@dnd-kit` — Leads/Em contato/Proposta/Fechado),
    Disparos (campanhas), Extratores (Google Maps/Instagram/CNPJ), Pipeline de vídeos,
    Agentes (disparo/atendimento), Ferramentas (configuração de chaves e caminhos),
    Webhook e Suporte (diagnóstico).
  - Componentes: Sidebar, Header, MetricCard, ProgressBar, Accordion, Modal, Toast,
    StatusBadge, gráficos (barras horizontais e doughnut) e Kanban com drag-and-drop.
- **Documentação**: `README.md` (instalação, arquitetura, integrações), `AGENTS.md`
  (regras de projeto, versionamento `MAJOR.MINOR.PATCH` com patch de dois dígitos,
  release via GitHub Actions, push obrigatório, CHANGELOG obrigatório) e `LICENSE` (MIT).
