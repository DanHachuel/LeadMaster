# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste ficheiro.
O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

A etiqueta visual de versão usa patch de dois dígitos (ex.: `0.1.00`); o registry NPM
normaliza para a forma canônica (ex.: `0.1.0`).

## [0.1.11] — 2026-11-08

### Corrigido

- **Launcher ainda devolvia o prompt no MobaXterm — a 0.1.9 não resolveu** — o
   processo Node encerrava seu event loop logo após imprimir "LeadMaster no ar...",
   mesmo com o keep-alive `setInterval`. Sem o Node vivo, o MobaXterm fecha a
   pseudo-console (PTY) e o uvicorn perde o terminal, encerrando junto. Correções
   definitivas no `scripts/cli.mjs`:
   - **Terminal preso:** `process.stdin.resume();` inserido **logo antes das
     mensagens finais de sucesso** — o Node fica indefinidamente vivo ouvindo a
     entrada padrão, sem depender de timers nem do wrapper do `npx`. O keep-alive
     `setInterval` permanece como segunda camada de proteção.
   - **Ciclo de vida vinculado nos dois sentidos:** `child.on('close')` encerra o
     launcher quando o servidor Python cai (mensagem "Servidor encerrado"), e
     `process.on('exit')` mata o filho quando o launcher morre — nenhum processo
     fica órfão. O worker Python continua **sem `.unref()`** (o pai não pode
     morrer sozinho).
   - **Erros globais (debug):** handlers `unhandledRejection` e `uncaughtException`
     logam o erro em vez de derrubar o launcher silenciosamente.
   - **Sem `process.exit(0)` após o sucesso:** a saída do fluxo principal agora é
     natural (via listeners do filho); chamadas de `process.exit` permanecem apenas
     em caminhos de erro acionável, na parada legítima (`SIGTERM`/`SIGBREAK`) e no
     aviso informativo "já está rodando".
- **AGENTS.md:** regra inviolável do launcher passa de quatro para **cinco
   proteções** (nova: *Terminal preso*, incluindo a proibição de `process.exit(0)`
   após o sucesso e a vedação do `.unref()`).
- **Gate de regressão reforçado:** `backend/tests/test_launcher_protections.py`
   falha se `process.stdin.resume();` desaparecer, se `.unref()` aparecer, se o
   ciclo de vida vinculado for removido ou se os handlers globais sumirem.

## [0.1.11] — 2026-11-08

### Adicionado

- **Extrator de Leads (Instagram)** — segunda fonte dedicada, mesmo padrão do Maps:
  - Rota `POST /api/extractors/instagram` (`profile_url`, `limit`): sem igmapper
    configurado gera **mock de 5–10 leads** (segurança anti-bloqueio de conta);
    com `lucasoal/igmapper` configurado em Ferramentas, executa o CLI real com as
    flags de isolamento (`creationflags`). Leads salvos em `leads.json` na coluna
    **"Novos Leads"**.
  - Página `frontend/src/pages/ExtratorInstagram.tsx` (rota `/extrator-instagram`,
    link no menu lateral): campo de URL do perfil + slider de quantidade, botão
    **"Iniciar Extração"** em gradiente (von Restorff/Fitts), **barra de progresso
    animada** "Buscando seguidores..." (Zeigarnik), tabela de resultados
    (Nome/Username, Telefone, Fonte, Seguidores) e botão **"Ir para o CRM"**.
  - Opções avançadas (apenas contas comerciais, mínimo de seguidores) escondidas
    em accordion (Lei de Hick).
  - Aba Instagram duplicada em Extratores removida — a página agora tem apenas
    CNPJ + atalhos para as duas páginas dedicadas (Maps e Instagram).

### Corrigido

- **Launcher — terminal preso (5ª regra inviolável):** `process.stdin.resume()`
  mantém o Node (e a PTY do MobaXterm, e com ela o uvicorn) vivos indefinidamente;
  `process.on('exit')` mata o worker Python em qualquer caminho de saída; `.unref()`
  eliminado também dos comentários. Gate de regressão atualizado
  (`test_launcher_protections.py`): falha se `process.stdin.resume()`, o ciclo de
  vida vinculado ou o isolamento desaparecerem.

## [0.1.10] — 2026-11-08

### Adicionado

- **Extrator de Leads (Google Maps)** — primeira página dedicada de extração:
  - Rota `POST /api/extractors/maps` (`keyword`, `location`, `limit`): sem scraper
    configurado gera **mock de 5–10 leads** (segurança anti-bloqueio de IP);
    com `gosom/google-maps-scraper` configurado em Ferramentas, executa o CLI
    real com as flags de isolamento (`creationflags` da 0.1.5). Os leads são
    salvos em `leads.json` na coluna **"Novos Leads"** e retornados na resposta.
  - Página `frontend/src/pages/ExtratorMaps.tsx` (rota `/extrator-maps`, link no
    menu lateral): formulário limpo (palavra-chave, localização, slider de
    quantidade), **modal/accordion** com opções avançadas escondidas (Lei de
    Hick), botão **"Iniciar Extração"** em gradiente (von Restorff/Fitts),
    **barra de progresso animada** durante a extração (Zeigarnik), tabela de
    resultados (Nome, Telefone, Localização, Avaliação) e botão **"Ir para o
    CRM"**. A aba Maps duplicada dentro de Extratores foi removida (substituída
    por um atalho para a página dedicada).

### Corrigido

- **Bug latente em `storage.import_leads`** (NameError na deduplicação) —
  exposto pelos novos testes e corrigido; importação em massa agora funciona.

### Testes

- 3 novos testes pytest da rota (`backend/tests/test_maps_extractor.py`):
  mock/persistência, limite respeitado e payload inválido (422).
  Suíte completa: **21 passed**.

## [0.1.09] — 2026-11-08

### Corrigido

- **Encerramento silencioso do launcher no MobaXterm (Windows)** — o app morria
  sozinho por sinais espúrios (perda de foco/minimização) e por EPIPE ao fechar o
  terminal. Correções no `scripts/cli.mjs`:
  - **Keep-alive:** `setInterval(() => {}, 1000);` mantém o event loop ativo mesmo
    sem I/O de console.
  - **Absorção de sinais no Windows:** `SIGINT`/`SIGHUP` agora são apenas logados
    (`[LAUNCHER] Sinal absorvido no Windows`) e **não** encerram o launcher;
    `SIGTERM`/`SIGBREAK` (Ctrl+Break) seguem como paradas legítimas. No
    Linux/macOS o comportamento gracioso é mantido.
  - **Guarda da consola (anti-EPIPE):** `guardConsoleStream()` ignora erros `EPIPE`
    no `'error'` dos streams e espelha toda a saída em
    `storage/logs/launcher_console.log`; escrita original com exceção retorna
    silenciosamente. Aplicada a `process.stdout`/`process.stderr` antes de
    qualquer escrita do launcher.
  - Isolamento mantido: worker Python com `detached: true` + `windowsHide: true`
    (`CREATE_NEW_PROCESS_GROUP`).
- **AGENTS.md:** nova seção *🚨 REGRA INVIOLÁVEL: ARQUITETURA DO LAUNCHER* com as
  4 proteções obrigatórias.
- **Gate de regressão:** `backend/tests/test_launcher_protections.py` falha se
  keep-alive, absorção de sinais, `guardConsoleStream` ou isolamento forem
  removidos do launcher.

## [0.1.08] — 2026-11-08

### Adicionado

- **Módulo CRM Kanban implementado conforme especificação:**
  - Rotas: `GET /api/crm/leads`, `POST /api/crm/leads` (criação manual) e
    `PUT /api/crm/leads/{lead_id}/etapa` (movimentação ao soltar o card) —
    persistência no `leads.json` local (seeds de demonstração mantidos).
  - Kanban com **@dnd-kit/core + @dnd-kit/sortable** (multi-contêiner):
    arrastar entre colunas persiste via API; reordenação visual dentro da
    coluna; soltar fora das colunas reverte o movimento.
  - Colunas: **Novos Leads → Em Contato → Proposta → Fechado**.
  - Card mostra Nome, Telefone, Fonte e **Data de Criação**.
  - Botão **"Adicionar Lead"** (gradiente) com modal de criação (campos
    avançados em accordion).
  - UX: card inteiro arrastável (Fitts); **opacity 0.5** no card arrastado e
    **borda tracejada indigo** na coluna de destino (Zeigarnik); colunas
    brancas com sombra suave (padrão do Dashboard).
- **7 novos testes pytest** para as rotas do CRM (`backend/tests/test_crm_routes.py`):
  listagem, criação, persistência, validação, movimentação, 404 e etapas
  inválidas — isolados com `LEADMASTER_HOME` temporário.

## [0.1.07] — 2026-11-08

### Adicionado

- **Regra permanente (AGENTS.md): PROIBIDO criar versões que abram telas de
  CMD/terminal no computador do usuário.** Nenhum popup de console pode aparecer
  ao rodar o LeadMaster; requisitos técnicos:
  - Node (`child_process`): sempre `windowsHide: true`; `.cmd`/`.bat` via
    `shell: true` + `windowsHide: true`;
  - Python (`subprocess`): sempre `creationflags` com `CREATE_NO_WINDOW`
    (`services/flags.py`);
  - saída sempre em pipes/logs — nunca janelas interativas.
  - QA inclui verificação item a item dos spawns.
  - Estado do código auditado: todos os spawns do launcher já cumprem
    (`windowsHide`) e os subprocessos Python usam `creationflags` — nenhuma
    alteração de código foi necessária.

## [0.1.06] — 2026-11-08

### Corrigido

- **Regra de comandos de instalação (AGENTS.md)** — redação ambígua permitia enviar
  `@latest` nas mensagens de release. Agora é explícito: os comandos entregues ao
  usuário usam **sempre a versão canônica confirmada no registry** (ex.: `0.1.6`) —
  `@latest` é permitido apenas nas instruções permanentes (README, página NPM,
  `legal/`).

## [0.1.05] — 2026-11-08

### Corrigido

- **Encerramento em cascata no Windows (STATUS_CONTROL_C_EXIT / 0xC000013A)** — o
  launcher Node e os workers Python compartilhavam o mesmo grupo de processos,
  então Ctrl+C no terminal (MobaXterm, VS Code, perda de foco) derrubava tudo
  junto, arriscando corromper extrações e trabalhos em andamento.
  - `scripts/cli.mjs`: o servidor FastAPI é spawnado com **`detached: true`**
    (no Windows, `CREATE_NEW_PROCESS_GROUP` 0x00000200) — grupo de processos
    próprio; sinais do terminal não cascateiam para o worker, que só é
    encerrado pelo `kill()` controlado do launcher.
  - `backend/services/flags.py` (novo): helper `creationflags()` com
    `CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW` (0x08000200) no Windows;
    0 no Linux/macOS.
  - `backend/services/extractors.py`: todas as execuções de CLI (Google Maps
    Scraper, igmapper, Scrapling) passam a usar as flags isoladas.
  - Testes `backend/tests/test_process_flags.py` (pytest) verificam as flags sem
    mockar `os.name` (o que quebraria `pathlib` nas duas direções): o helper
    recebe a plataforma por parâmetro e os testes mockam o próprio helper —
    passam idênticos no GitHub Actions (Linux) e no Windows local.
  - CI: novo passo "Run backend tests (pytest)" no workflow de publicação.

## [0.1.04] — 2026-11-05

### Corrigido

- **Instruções de instalação fixadas em versão antiga** — o README (GitHub e pacote NPM)
  e a mensagem final do `install` usavam `@0.1.0`, instalando uma versão obsoleta.
  - README e saída do launcher agora usam a tag **`@latest`** (CMD/MobaXterm e normal),
    com a versão exata exibida ao lado na mensagem do `install`.
  - AGENTS.md documenta a regra: instruções permanentes sempre `@latest`; comunicação
    de release informa também a versão canônica do registry.

## [0.1.03] — 2026-10-25

### Adicionado

- **Páginas legais e de verificação** (`legal/`), baseadas no layout do AutoPost-Lunga:
  - `legal/index.html` — página de apresentação/verificação para APIs de plataformas
    (TikTok, YouTube, Pinterest, Meta): funcionalidades do LeadMaster (CRM Kanban,
    extratores de leads, agentes de IA e pipeline de vídeos faceless), integrações via
    APIs oficiais e links para os documentos legais.
  - `legal/privacy.html` — Política de Privacidade em português (Brasil) com conformidade
    explícita à LGPD (Lei 13.709/2018): dados coletados (e-mail, leads prospectados, uso,
    cookies, tokens de API), finalidades, armazenamento 100% local (JSON), bases legais,
    compartilhamento (plataformas via APIs oficiais e provedores de LLM), direitos do
    titular (art. 18), segurança, retenção e encarregado (DPO).
  - `legal/terms.html` — Termos de Uso em português (Brasil): aceitação, descrição do
    serviço ("como está"), responsabilidades do usuário (conteúdo gerado, credenciais,
    LGPD e termos de plataformas terceiras), usos proibidos (spam/assédio), limitação de
    responsabilidade (bloqueios e penalidades de plataformas), propriedade intelectual
    (uso pessoal, vedada revenda), foro do desenvolvedor (Brasil) e referência à
    Política de Privacidade.
  - Páginas responsivas (HTML5 semântico, CSS embutido, favicon do urso), com rodapé
    de verificação para plataformas e contato do desenvolvedor.
  - Pasta `legal/` incluída no pacote NPM (`files`).

## [0.1.02] — 2026-10-24

### Corrigido

- **Poluição do terminal por logs de polling** (`GET /api/metrics`):
  - Launcher (`scripts/cli.mjs`) e `npm run dev` iniciam o uvicorn com
    `--no-access-log`.
  - Filtro granular de logging no backend silencia o access-log **apenas** de
    `/api/metrics` — erros, exceções e os demais endpoints continuam logados
    normalmente (vale também para execuções manuais do uvicorn).
  - Painel migrado para **TanStack Query** (`@tanstack/react-query`,
    `refetchInterval` de 10s): ciclo de vida e cleanup automáticos, pausa
    quando a aba fica ociosa e retoma ao focar; indicador "atualiza a cada
    10s" visível nos blocos de gráficos.
  - Polling de campanhas (Disparos) também via TanStack Query: sonda a cada
    4s apenas enquanto existe campanha em andamento, sem `setInterval` manual.
  - Verificado: nenhum outro endpoint é alvo de polling — `/api/config` e
    demais chamadas são carregamentos pontuais no início da página.

### Alterado

- **O sistema nunca abre o navegador.** Removida a abertura automática de janela do
  launcher — o LeadMaster apenas imprime a URL no terminal e quem abre é o usuário.

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
