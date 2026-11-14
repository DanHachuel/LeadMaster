# Changelog

Todas as mudanÃƒÆ’Ã‚Â§as notÃƒÆ’Ã‚Â¡veis deste projeto serÃƒÆ’Ã‚Â£o documentadas neste ficheiro.
O formato ÃƒÆ’Ã‚Â© baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

A etiqueta visual de versÃƒÆ’Ã‚Â£o usa patch de dois dÃƒÆ’Ã‚Â­gitos (ex.: `0.1.00`); o registry NPM
normaliza para a forma canÃƒÆ’Ã‚Â´nica (ex.: `0.1.0`).

## [0.1.11] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-08

### Corrigido

- **Launcher ainda devolvia o prompt no MobaXterm ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a 0.1.9 nÃƒÆ’Ã‚Â£o resolveu** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o
   processo Node encerrava seu event loop logo apÃƒÆ’Ã‚Â³s imprimir "LeadMaster no ar...",
   mesmo com o keep-alive `setInterval`. Sem o Node vivo, o MobaXterm fecha a
   pseudo-console (PTY) e o uvicorn perde o terminal, encerrando junto. CorreÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
   definitivas no `scripts/cli.mjs`:
   - **Terminal preso:** `process.stdin.resume();` inserido **logo antes das
     mensagens finais de sucesso** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o Node fica indefinidamente vivo ouvindo a
     entrada padrÃƒÆ’Ã‚Â£o, sem depender de timers nem do wrapper do `npx`. O keep-alive
     `setInterval` permanece como segunda camada de proteÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o.
   - **Ciclo de vida vinculado nos dois sentidos:** `child.on('close')` encerra o
     launcher quando o servidor Python cai (mensagem "Servidor encerrado"), e
     `process.on('exit')` mata o filho quando o launcher morre ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â nenhum processo
     fica ÃƒÆ’Ã‚Â³rfÃƒÆ’Ã‚Â£o. O worker Python continua **sem `.unref()`** (o pai nÃƒÆ’Ã‚Â£o pode
     morrer sozinho).
   - **Erros globais (debug):** handlers `unhandledRejection` e `uncaughtException`
     logam o erro em vez de derrubar o launcher silenciosamente.
   - **Sem `process.exit(0)` apÃƒÆ’Ã‚Â³s o sucesso:** a saÃƒÆ’Ã‚Â­da do fluxo principal agora ÃƒÆ’Ã‚Â©
     natural (via listeners do filho); chamadas de `process.exit` permanecem apenas
     em caminhos de erro acionÃƒÆ’Ã‚Â¡vel, na parada legÃƒÆ’Ã‚Â­tima (`SIGTERM`/`SIGBREAK`) e no
     aviso informativo "jÃƒÆ’Ã‚Â¡ estÃƒÆ’Ã‚Â¡ rodando".
- **AGENTS.md:** regra inviolÃƒÆ’Ã‚Â¡vel do launcher passa de quatro para **cinco
   proteÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes** (nova: *Terminal preso*, incluindo a proibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de `process.exit(0)`
   apÃƒÆ’Ã‚Â³s o sucesso e a vedaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do `.unref()`).
- **Gate de regressÃƒÆ’Ã‚Â£o reforÃƒÆ’Ã‚Â§ado:** `backend/tests/test_launcher_protections.py`
   falha se `process.stdin.resume();` desaparecer, se `.unref()` aparecer, se o
   ciclo de vida vinculado for removido ou se os handlers globais sumirem.

## [0.1.38] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-12

### Adicionado

- **Modo claro/escuro (tema light/dark ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â padrÃƒÆ’Ã‚Â£o ProdMaker):**
  - Hook `frontend/src/hooks/useTheme.ts`: estado `'light' | 'dark'` (padrÃƒÆ’Ã‚Â£o
    **dark**, mantendo a identidade atual), persistÃƒÆ’Ã‚Âªncia em
    `localStorage` (`leadmaster_theme`), aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o via
    `document.documentElement.setAttribute('data-theme', theme)` e
    `toggleTheme()`.
  - **BotÃƒÆ’Ã‚Â£o de alternÃƒÆ’Ã‚Â¢ncia no Header** (canto superior direito, ao lado do
    nome do usuÃƒÆ’Ã‚Â¡rio): ÃƒÆ’Ã‚Â­cone **sol** quando escuro (aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o: clarear) e **lua**
    quando claro (aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o: escurecer), com `aria-label`/`title`
    ("Alternar para tema claro/escuro") e hover suave.
  - **VariÃƒÆ’Ã‚Â¡veis CSS** em `index.css` (`--bg-primary`, `--bg-secondary`,
    `--text-primary`, `--text-secondary`, `--border-color`,
    `--bg-tertiary`, `--text-muted`, `--sidebar-bg`) com seletores
    `[data-theme='dark']` e `[data-theme='light']`:
    dark = slate-900/slate-800/slate-100; light = slate-50/branco/slate-900.
  - **Camada de remapeamento** (especificidade `main ...`, vence as utilities
    sem quebrar a sidebar ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â que ÃƒÆ’Ã‚Â© sempre escura por identidade): `bg-white`,
    `bg-gray-50/100`, `text-gray-*` e `border-gray-*` passam a seguir as
    variÃƒÆ’Ã‚Â¡veis nos dois temas. Cores semÃƒÆ’Ã‚Â¢nticas (indigo/red/green/amber/blue)
    ficam de fora: badges e alertas mantÃƒÆ’Ã‚Âªm o significado.
  - Componentes raiz migrados para as variÃƒÆ’Ã‚Â¡veis: Header, Sidebar, MetricCard,
    Modal, Accordion, ProgressBar; scrollbar e rodapÃƒÆ’Ã‚Â©s escuros ajustados.
- **Gate de regressÃƒÆ’Ã‚Â£o** (`backend/tests/test_ui_theme.py`): falha se o hook,
    o botÃƒÆ’Ã‚Â£o do Header, as variÃƒÆ’Ã‚Â¡veis CSS ou a camada de remapeamento
    desaparecerem. SuÃƒÆ’Ã‚Â­te: **127 passed**.

## [0.1.41] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-14

### Alterado

- **DocumentaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o completa (README + MANUAL):**
  - `README.md` reescrito no formato *marketing + quick start*: badges (npm,
    testes, React, FastAPI, tema), instalaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o com `npx`/`npx.cmd`, tabela de
    comandos (`install`/`start`/`kill`/`doctor`), resumo de **todas** as
    funcionalidades (Painel, Funil, CRM Kanban com colunas customizÃƒÆ’Ã‚Â¡veis,
    Leads, Extratores Maps/Instagram/CNPJ, Disparos, CadÃƒÆ’Ã‚Âªncias, Agentes,
    ConexÃƒÆ’Ã‚Âµes WhatsApp, RelatÃƒÆ’Ã‚Â³rios, Webhook, Suporte, tema claro/escuro) e
    diagrama de arquitetura (launcher ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ FastAPI ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ React + storage JSON).
  - **`MANUAL.md` (novo)** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â guia de uso por tela em linguagem de usuÃƒÆ’Ã‚Â¡rio
    final: Ferramentas (LLM, gateway WhatsApp/QR Code, scrapers real vs
    mock), Painel e Funil (gargalo), CRM (criar, editar, tags, score, buscar,
    exportar CSV, colunas personalizÃƒÆ’Ã‚Â¡veis, sugestÃƒÆ’Ã‚Âµes de IA), Extratores,
    Disparos (worker, pausa, mensagem por IA) e CadÃƒÆ’Ã‚Âªncias, Agentes e ConexÃƒÆ’Ã‚Âµes,
    RelatÃƒÆ’Ã‚Â³rios e onde ficam os dados/backup/logs.
  - Sem alteraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de cÃƒÆ’Ã‚Â³digo: sÃƒÆ’Ã‚Â³ documentaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o (escopo mÃƒÆ’Ã‚Â­nimo).

## [0.1.40] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-13

### Adicionado

- **Docs: Adicionadas Skills de prevenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de regressÃƒÆ’Ã‚Âµes no padrÃƒÆ’Ã‚Â£o OpenCode** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
  pasta `.opencode/skills/` com 7 guias obrigatÃƒÆ’Ã‚Â³rios (lidos antes de cada tarefa
  via aviso no topo do `AGENTS.md`):
  - `systemic-view-guard` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â mapa de dependÃƒÆ’Ã‚Âªncias launcherÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬ÂbackendÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬ÂfrontendÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬Âstorage;
  - `parallel-session-guard` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â proibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de sessÃƒÆ’Ã‚Âµes simultÃƒÆ’Ã‚Â¢neas, verificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de
    working tree alheio, rebase obrigatÃƒÆ’Ã‚Â³rio e renumeraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o em colisÃƒÆ’Ã‚Â£o de versÃƒÆ’Ã‚Â£o;
  - `surgical-scope-guard` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â escopo mÃƒÆ’Ã‚Â­nimo, proibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de refatoraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o nÃƒÆ’Ã‚Â£o
    solicitada e lista de arquivos sensÃƒÆ’Ã‚Â­veis;
  - `atomic-write-guard` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â toda escrita em JSON via `storage.py` (lock + tmp +
    replace); workers relÃƒÆ’Ã‚Âªem antes do merge;
  - `windows-runtime-guard` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â regras inviolÃƒÆ’Ã‚Â¡veis do launcher (`stdio: 'inherit'`,
    `readline`, sem `stdin.resume`/`setInterval`/dummy server/`unref`),
    `creationflags` em subprocessos e execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o a partir do `.runtime`;
  - `contract-test-guard` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â testes com `TestClient` + `tmp_path` verificando
    comportamento real e o JSON no disco; proibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de teste por substring;
  - `react-state-guard` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â polling via TanStack Query (`refetchInterval`),
    estado de workers vem da API, sem loops de renderizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o.
- Nenhuma alteraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o em cÃƒÆ’Ã‚Â³digo funcional ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â apenas documentaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o e a referÃƒÆ’Ã‚Âªncia
  das skills no `AGENTS.md`.

## [0.1.39] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-13

### Adicionado

- **Colunas do Kanban customizÃƒÆ’Ã‚Â¡veis (backend):**
  - Storage `crm_columns.json` com `[{id, nome, cor}]` e migraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o inicial: as 4
    colunas atuais sÃƒÆ’Ã‚Â£o criadas automaticamente, preservando os
    `etapa: "leads"` dos leads existentes.
  - Rotas: `GET /api/crm/columns`, `PUT /api/crm/columns` (renomear/reordenar/
    adicionar ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â com validaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de id ÃƒÆ’Ã‚Âºnico, nome nÃƒÆ’Ã‚Â£o vazio e cor vÃƒÆ’Ã‚Â¡lida) e
    `DELETE /api/crm/columns/{id}` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â **exclusÃƒÆ’Ã‚Â£o bloqueada (400) se houver
    leads na coluna**, tambÃƒÆ’Ã‚Â©m no PUT que removeria a coluna.
  - `PUT /api/crm/leads/{id}/etapa` e criaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de leads agora validam contra as
    colunas dinÃƒÆ’Ã‚Â¢micas (aceitando novas etapas criadas pelo usuÃƒÆ’Ã‚Â¡rio).
- **13 novos testes pytest** (`backend/tests/test_crm_columns.py`): seed,
  renomear, reordenar, adicionar, ids duplicados/cor invÃƒÆ’Ã‚Â¡lida/vazio (400),
  delete com e sem leads (200/400), PUT removendo coluna ocupada (400),
  movimentaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para etapa inexistente (400) e para coluna customizada.
  SuÃƒÆ’Ã‚Â­te completa: **140 passed**.

## [0.1.37] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-12

### Adicionado

- **CadÃƒÆ’Ã‚Âªncias de Follow-up (reengajamento automÃƒÆ’Ã‚Â¡tico):**
  - Storage `cadences.json` com `[{"id", "nome", "etapa_gatilho", "dias_espera",
    "acao", "ativo", "ultimas_execucoes"}]`; `config.json ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ cadencias.intervalo_horas`
    define a frequÃƒÆ’Ã‚Âªncia do worker (padrÃƒÆ’Ã‚Â£o 1h).
  - Worker em background (`asyncio.create_task` no lifespan do FastAPI,
    `services/cadence.py`): a cada hora verifica os leads parados na etapa
    gatilho alÃƒÆ’Ã‚Â©m dos `dias_espera` (usando `atualizado_em`) e aplica a aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â **mover_para_proposta**, **mover_para_em_contato** ou **adicionar_tag_frio**
    ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â registrando a execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o na cadÃƒÆ’Ã‚Âªncia e disparando o webhook
    `cadencia.executada`. O worker ÃƒÆ’Ã‚Â© resiliente (nunca derruba a API) e a
    verificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o pode ser forÃƒÆ’Ã‚Â§ada pela rota.
  - Rotas: `GET/POST /api/cadences`, `PUT/DELETE /api/cadences/{id}` (validaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes:
    dias ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥ 1, etapa gatilho e aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o vÃƒÆ’Ã‚Â¡lidas; 404 para inexistentes) +
    `POST /api/cadences/verificar` (execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o imediata).
  - Frontend: pÃƒÆ’Ã‚Â¡gina `/cadencias` (menu lateral "CadÃƒÆ’Ã‚Âªncias" em GestÃƒÆ’Ã‚Â£o) com
    tabela (Nome, Etapa Gatilho, Dias, AÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, Status), ÃƒÆ’Ã‚Âºltima execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o por
    cadÃƒÆ’Ã‚Âªncia, botÃƒÆ’Ã‚Â£o **"Nova CadÃƒÆ’Ã‚Âªncia"** em gradiente (von Restorff), modal com
    **no mÃƒÆ’Ã‚Â¡ximo 4 campos** (Lei de Hick), toggle ativo/inativo com cores
    contrastantes (verde/vermelho) e **ÃƒÆ’Ã‚Â­cone de relÃƒÆ’Ã‚Â³gio pulsante** nas
    cadÃƒÆ’Ã‚Âªncias ativas (Zeigarnik). PrevenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de erros: dias ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¤ 0 bloqueia com
    borda vermelha + mensagem; nome vazio bloqueia.
- **10 novos testes pytest** (`backend/tests/test_cadences.py`): CRUD completo
  (criar/editar/remover/404), validaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes (dias 0 ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 422, dia negativo ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 400,
  aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o/etapa invÃƒÆ’Ã‚Â¡lidas ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 400) e worker (lead antigo movido, lead recente
  preservado, cadÃƒÆ’Ã‚Âªncia inativa nÃƒÆ’Ã‚Â£o executa, aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de tag). SuÃƒÆ’Ã‚Â­te: **123 passed**.

## [0.1.36] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-12

### Alterado (correÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de regressÃƒÆ’Ã‚Â£o)

- **Launcher de volta ao terminal (foreground com `readline`):** o modelo
  descartÃƒÆ’Ã‚Â¡vel da 0.1.33 liberava o terminal ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o usuÃƒÆ’Ã‚Â¡rio quer o terminal preso
  vendo os logs, encerrando sÃƒÆ’Ã‚Â³ no **Ctrl+C**. Agora:
  - o worker nasce com **`stdio: 'inherit'`** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â logs do FastAPI em tempo real
    no terminal (adeu `stdio: ['ignore', logFd, logFd]`);
  - **`child.unref()` removido**; o launcher fica preso por
    `readline.createInterface({ input: process.stdin, output: process.stdout })`
    ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â **sem** `setInterval`/`stdin.resume()`/dummy server/`beforeExit`
    (esses foram justamente o que falhou no MobaXterm);
  - `rl.on('SIGINT')` captura o Ctrl+C de forma limpa: mata o worker por
    cÃƒÆ’Ã‚Â³digo (`matarArvoreProcesso`, com `taskkill /T /F` no Windows), remove o
    lock e sai ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â mensagem final ensina "Logs em tempo real abaixo; Ctrl+C
    encerra"; `SIGTERM`/`SIGBREAK` seguem como paradas legÃƒÆ’Ã‚Â­timas;
  - `process.exit(0)` do fim do start **removido** (o terminal sÃƒÆ’Ã‚Â³ volta pelo
    Ctrl+C ou por erro acionÃƒÆ’Ã‚Â¡vel).
- **Comando `kill`/`stop` mantido** para o caso de a janela do terminal ser
  fechada (o worker, em grupo isolado, sobrevive) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â lock global continua.
- **AGENTS.md:** seÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â¨ REGRA INVIOLÃƒÆ’Ã‚ÂVEL reescrita para o modelo foreground
  (stdio inherit, readline, Ctrl+C limpo, proibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de keep-alives e unref).
- **Gates** (`test_launcher_protections.py`): exigem `stdio: 'inherit'`,
  `readline.createInterface` e handler SIGINT dentro do `cmdStart`; falham se
  keep-alives proibidos, `child.unref()` ou `process.exit(` no caminho de
  sucesso voltarem.

### Adicionado

- **RelatÃƒÆ’Ã‚Â³rios (Analytics):**
  - Rota **`GET /api/reports`**: consolidado de `campaigns.json` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â resumo
    (campanhas, enviadas, erros, **taxa de sucesso**, ativas, concluÃƒÆ’Ã‚Â­das),
    volume **por campanha** e **por dia** (agregado dos eventos).
  - PÃƒÆ’Ã‚Â¡gina **`frontend/src/pages/Relatorios.tsx`** (rota `/relatorios`, menu
    GestÃƒÆ’Ã‚Â£o): cards **Total Enviado / Total de Erros / Taxa de Sucesso Geral**
    (Lei de Miller), **grÃƒÆ’Ã‚Â¡fico de barras** enviadas ÃƒÆ’Ã¢â‚¬â€ erros por campanha
    (Chart.js) e **tabela de histÃƒÆ’Ã‚Â³rico** (nome, iniciada, concluÃƒÆ’Ã‚Â­da,
    enviados, erros, status) + zero states e auto-refresh a cada 10s enquanto
    houver campanha ativa.
  - **3 novos testes pytest** (`backend/tests/test_reports.py`): base vazia,
    consolidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de campanhas e agregaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o por dia. SuÃƒÆ’Ã‚Â­te: **113 passed**.

## [0.1.35] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-10

### Adicionado

- **Tags e Lead Scoring (qualificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o no CRM):**
  - `PUT /api/crm/leads/{id}` agora aceita **`tags`** (lista) e **`score`** (inteiro
    0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“5); score fora do intervalo ou tags em formato invÃƒÆ’Ã‚Â¡lido ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ **400**.
  - `GET /api/crm/leads?tag=<nome>` filtra apenas leads com a tag informada.
  - **Card do Kanban:** tags como badges coloridos abaixo do nome (cores
    vibrantes para **Quente** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â vermelho, **Urgente** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â laranja, **Morno** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ÃƒÆ’Ã‚Â¢mbar,
    **Frio** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â azul; demais em indigo ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â von Restorff) e **estrelas do score**
    (preenchidas/vazias) no canto superior direito.
  - **Modal de detalhes:** campo "Nova Tag" + botÃƒÆ’Ã‚Â£o **"+"**, tags existentes com
    **"X"** para remover (auto-save imediato) e **estrelas 1ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“5 clicÃƒÆ’Ã‚Â¡veis e
    grandes** (Lei de Fitts) para o score ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â clicar de novo na mesma estrela
    zera; "limpar" disponÃƒÆ’Ã‚Â­vel; erro no salvamento reverte com toast.
  - **Dropdown de filtro por tag** ao lado da barra de busca (todas as tags da
    base, ordenadas), combinando com a busca textual instantÃƒÆ’Ã‚Â¢nea.
- **6 novos testes pytest** (`backend/tests/test_tags_score.py`): persistÃƒÆ’Ã‚Âªncia de
  tags e score, score invÃƒÆ’Ã‚Â¡lido (400), tags em formato invÃƒÆ’Ã‚Â¡lido (400), filtro por
  tag e filtro sem resultados. SuÃƒÆ’Ã‚Â­te completa: **109 passed**.

## [0.1.34] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-10

### Adicionado

- **ConexÃƒÆ’Ã‚Âµes ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ajuste fino do gateway WhatsApp:**
  - **InstruÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes passo a passo** em accordion (Lei de Hick) quando desconectado:
    subir o OpenWA/WAHA (ex.: `docker run -p 2785:2785 openwa`), informar URL e
    API Key em Ferramentas, clicar em "Conectar WhatsApp" e escanear o QR.
  - **QR Code em moldura branca com margem** (leitura pela cÃƒÆ’Ã‚Â¢mera) +
    **contador regressivo de validade** e barra de progresso do refresh
    (Zeigarnik); a imagem ÃƒÆ’Ã‚Â© renovada a cada 10s enquanto o modal estÃƒÆ’Ã‚Â¡ aberto.
  - **BotÃƒÆ’Ã‚Â£o verde "Enviar Mensagem de Teste"** (von Restorff) quando conectado:
    mini-modal com nÃƒÆ’Ã‚Âºmero (com DDD) e mensagem, enviando pela nova rota
    `POST /api/whatsapp/test-send` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â valida o gateway de ponta a ponta.
  - **PrevenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de erros:** gateway offline (503) na conexÃƒÆ’Ã‚Â£o ou no teste exibe
    **PrevenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de erros:** gateway offline (503) na conexÃƒÆ’Ã‚Â£o ou no teste exibe
    toast *"Gateway do WhatsApp nÃƒÆ’Ã‚Â£o encontrado. Verifique se o OpenWA estÃƒÆ’Ã‚Â¡
    rodando."* ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o card de status tambÃƒÆ’Ã‚Â©m passa a mostrar essa orientaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o.
- **3 novos testes pytest** (`test_whatsapp_gateway.py`): rota de teste de envio
  (payload `chatId` + rota `send-text`), gateway offline no teste (503 com a URL)
  e simulaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do worker preservada. SuÃƒÆ’Ã‚Â­te completa: **103 passed**.

## [0.1.33] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-10

### Alterado (refatoraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o crÃƒÆ’Ã‚Â­ticÃƒÆ’Ã‚Â¢ de arquitetura)

- **Launcher descartÃƒÆ’Ã‚Â¡vel + servidor autÃƒÆ’Ã‚Â´nomo (arquitetura PandaNews):** o
  encerramento silencioso no MobaXterm estava residindo no modelo anterior, que
  mantinha o Node vivo amarrado ao terminal (`stdin.resume`, `setInterval`,
  dummy server, `await new Promise`) e vinculava a morte do Node ÃƒÆ’Ã‚Â  do Python.
  Agora:
  - o worker nasce com **`stdio: ['ignore', logFd, logFd]`** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â saÃƒÆ’Ã‚Â­da em
    `<home>/storage/logs/backend.log`, **nunca pipes no terminal**;
  - **`child.unref()`** logo apÃƒÆ’Ã‚Â³s o spawn: o event loop do launcher nÃƒÆ’Ã‚Â£o depende
    do filho; removidos `child.on('exit')`/`close`, `process.on('exit')` e
    **todos** os keep-alives;
  - o launcher grava o **lock global `<home>/leadmaster.pid`**
    (`{pid, porta, versao, iniciado_em}`), imprime o sucesso e chama
    `process.exit(0)` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â **o prompt volta e o servidor continua no ar**;
  - novo comando **`kill`** (alias `stop`): lÃƒÆ’Ã‚Âª o lock, mata a ÃƒÆ’Ã‚Â¡rvore
    (`taskkill /F /T /PID` no Windows / `kill -9` no Unix), roda a rede de
    seguranÃƒÆ’Ã‚Â§a por porta, remove o lock e imprime "Servidor encerrado com
    sucesso";
  - mensagem final do `start`: *"LeadMaster rodando em background na porta
    5055. Para encerrar, use: npx --yes @danhachuel/leadmaster@<versÃƒÆ’Ã‚Â£o> kill"*;
  - `doctor` mostra o lock do servidor; `help` documenta o novo comando.
- **Frontend:** Dashboard exibe aviso do modelo background + comando `kill` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
  fechar o terminal nÃƒÆ’Ã‚Â£o derruba mais o app.
- **AGENTS.md:** seÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â¨ REGRA INVIOLÃƒÆ’Ã‚ÂVEL reescrita para a nova arquitetura
  (spawn destacado com stdio em arquivo, launcher descartÃƒÆ’Ã‚Â¡vel, lock file,
  comando kill, higiene e guarda da consola).
- **Gate de regressÃƒÆ’Ã‚Â£o reescrito** (`test_launcher_protections.py`): falha se
  `child.unref()`, `stdio: ['ignore', logFd, logFd]`, o lock ou o comando
  `kill` desaparecerem; falha se qualquer keep-alive proibido
  (`stdin.resume`/`setInterval`/`http.createServer`/`await new Promise`) ou
  vÃƒÆ’Ã‚Â­nculo de morte voltar. SuÃƒÆ’Ã‚Â­te: **95 passed**.

## [0.1.32] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-10

### Adicionado

- **Gateway WhatsApp (OpenWA padrÃƒÆ’Ã‚Â£o, WAHA opcional) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â disparos reais:**
  - Config (Ferramentas ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ WhatsApp): `gateway_type` (openwa/waha),
    `gateway_url` (padrÃƒÆ’Ã‚Â£o `http://127.0.0.1:2785`), API Key (`X-API-Key`),
    `session_id` e toggle **"Usar gateway real"** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â sem o toggle, os disparos
    seguem simulados (comportamento padrÃƒÆ’Ã‚Â£o preservado).
  - ServiÃƒÆ’Ã‚Â§o `backend/services/whatsapp.py`: status (`conectado` /
    `aguardando_qr` / `desconectado`), inÃƒÆ’Ã‚Â­cio de sessÃƒÆ’Ã‚Â£o, repasse do QR Code e
    envio de texto (`chatId` no formato `5511999999999@c.us`), com as rotas do
    OpenWA e as equivalentes do WAHA (`/api/sendText`).
  - Rotas: `GET /api/whatsapp/status` (503 acionÃƒÆ’Ã‚Â¡vel com o gateway fora),
    `POST /api/whatsapp/sessions/start` e `GET /api/whatsapp/qr` (repassa a
    imagem do gateway).
  - **Worker de disparos** (`processar_campanha_em_background`): com gateway
    ativo, envia de verdade pelo gateway; falha do gateway conta como erro do
    lead (com log) e **nunca trava a campanha**. Sem gateway ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ simulaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    mantida.
  - Frontend: nova pÃƒÆ’Ã‚Â¡gina **`/conexoes`** (menu lateral "ConexÃƒÆ’Ã‚Âµes"): card do
    WhatsApp com **polling de 5s** (TanStack Query), botÃƒÆ’Ã‚Â£o grande **"Conectar
    WhatsApp"** (Fitts), modal com QR Code + spinner *"Aguardando leitura do
    celular..."* (Zeigarnik), badge verde esmeralda com pulso quando conectado
    (von Restorff) e nÃƒÆ’Ã‚Âºmero da conta. Em **Disparos**, ativar campanha sem
    WhatsApp conectado ÃƒÆ’Ã‚Â© **bloqueado** com toast *"Conecte o WhatsApp na aba
    ConexÃƒÆ’Ã‚Âµes antes de disparar."* (prevenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de erros).
- **10 novos testes pytest** (`backend/tests/test_whatsapp_gateway.py`):
  status conectado / aguardando QR / gateway offline (503) / QR repassado,
  worker enviando pelo gateway (payload com chatId e mensagem renderizada),
  worker com falha do gateway (3 erros, campanha concluÃƒÆ’Ã‚Â­da sem travar) e
  simulaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o preservada sem gateway.

## [0.1.31] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-10

### Adicionado

- **GeraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de mensagens com IA nos Disparos:**
  - Rota `POST /api/campaigns/generate-message` (`nicho`, `tom`) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â usa
    `services/llm.py` (`gerar_template_prospeccao`) para escrever um template de
    prospecÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o; o prompt **obriga** as variÃƒÆ’Ã‚Â¡veis `{nome}` e `{empresa}`. Sem LLM
    configurada ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ **400** com mensagem acionÃƒÆ’Ã‚Â¡vel; erro da LLM ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ **500** com o
    detalhe (nunca finge sucesso).
  - Worker (`agents.render_template`) passa a substituir **tambÃƒÆ’Ã‚Â©m a chave
    simples** (`{nome}`, `{empresa}`, `{telefone}`, `{cidade}`...) alÃƒÆ’Ã‚Â©m da
    `{{chave}}` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â chaves mais longas primeiro, sem substituiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o parcial. O
    worker de disparos jÃƒÆ’Ã‚Â¡ usava `render_template` antes de simular o envio;
    agora os templates gerados pela IA funcionam sem ediÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o manual.
  - Frontend (`Disparos.tsx`): campo **"Nicho do PÃƒÆ’Ã‚Âºblico"** + botÃƒÆ’Ã‚Â£o secundÃƒÆ’Ã‚Â¡rio
    **"Gerar com IA"** (ÃƒÆ’Ã‚Â­cone de varinha, roxo ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â von Restorff) ao lado do
    textarea; **spinner** enquanto gera (Zeigarnik); toast de sucesso
    *"Template gerado pela IA! Lembre-se de usar {nome} e {empresa}."*; LLM sem
    chave ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ toast *"Configure a API Key na aba Ferramentas primeiro."*
    (prevenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de erros).
- **5 novos testes pytest** (`backend/tests/test_campaign_message.py`): geraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
  com LLM mockada (template contÃƒÆ’Ã‚Â©m as variÃƒÆ’Ã‚Â¡veis), 400 sem LLM,
  `render_template` chave simples e dupla, e o **worker substituindo as
  variÃƒÆ’Ã‚Â¡veis** antes do envio (evento gravado com o nome real do lead).

## [0.1.30] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-10

### Adicionado

- **Suporte ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â chat de teste do Agente de Atendimento (LLM):**
  - Rota **`POST /api/agents/chat`** (`{"message": "..."}`): monta o contexto com
    o **prompt do sistema do agente** (`agents.json ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ atendimento.prompt`,
    editÃƒÆ’Ã‚Â¡vel em Agentes) + **histÃƒÆ’Ã‚Â³rico salvo** + a mensagem nova, chama a LLM
    OpenAI-compatÃƒÆ’Ã‚Â­vel jÃƒÆ’Ã‚Â¡ existente (`services/llm.py`) e devolve a resposta.
    Sem API Key ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ **400 acionÃƒÆ’Ã‚Â¡vel** ("Ferramentas ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ LLM..."); mensagem sÃƒÆ’Ã‚Â³ com
    espaÃƒÆ’Ã‚Â§os ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ **400** (prevenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de erros ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Nielsen).
  - **HistÃƒÆ’Ã‚Â³rico persistente** (`chat_history.json`, ÃƒÆ’Ã‚Âºltimas 200 mensagens):
    `GET /api/agents/chat/history` restaura a conversa ao recarregar a pÃƒÆ’Ã‚Â¡gina e
    `DELETE /api/agents/chat/history` limpa. A resposta do assistante sÃƒÆ’Ã‚Â³ entra
    no histÃƒÆ’Ã‚Â³rico quando a chamada ÃƒÆ’Ã‚Â  LLM dÃƒÆ’Ã‚Â¡ certo.
  - `frontend/src/pages/Suporte.tsx` reescrita com o **chat no topo**: balÃƒÆ’Ã‚Âµes
    do usuÃƒÆ’Ã‚Â¡rio ÃƒÆ’Ã‚Â  direita em gradiente indigo/purple e do agente ÃƒÆ’Ã‚Â  esquerda em
    cinza (von Restorff), indicador **"digitando..."** com trÃƒÆ’Ã‚Âªs pontinhos
    animados enquanto a LLM pensa (Zeigarnik), **auto-scroll** para a ÃƒÆ’Ã‚Âºltima
    mensagem, campo largo + botÃƒÆ’Ã‚Â£o-aviÃƒÆ’Ã‚Â£o com **Enter para enviar** (Fitts) e
    bloqueio de mensagem vazia. DiagnÃƒÆ’Ã‚Â³stico do ambiente e FAQ preservados
    abaixo (FAQ ganhou as perguntas do chat).
- **6 novos testes pytest** (`backend/tests/test_chat_suporte.py`) com a LLM
  mockada (zero tokens no CI): mensagem vazia ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 400, sem chave ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 400
  acionÃƒÆ’Ã‚Â¡vel, resposta + histÃƒÆ’Ã‚Â³rico persistidos, contexto (system + histÃƒÆ’Ã‚Â³rico +
  nova mensagem) conferido, limpar histÃƒÆ’Ã‚Â³rico e falha da LLM nÃƒÆ’Ã‚Â£o gravando
  resposta falsa. SuÃƒÆ’Ã‚Â­te completa: **94 passed**.

## [0.1.29] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Adicionado

- **Motor de disparos em background (`agents.processar_campanha_em_background`)** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
  ativar uma campanha agora executa de verdade (simulaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de envio):
  - Rota `PUT /api/campaigns/{id}/status` com `"status": "ativa"` muda o status
    para `em_andamento` e dispara o worker via **FastAPI `BackgroundTasks`** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a
    resposta volta na hora, os envios sobem depois em `campaigns.json`.
  - O worker percorre os `lead_ids` (filtro por etapa jÃƒÆ’Ã‚Â¡ aplicado na criaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o),
    com `asyncio.sleep(1)` entre envios (tempo real de visualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o na UI) e
    **1 erro simulado a cada 10** leads; grava contadores e eventos a cada ciclo
    via `storage.upsert_campaign` (lock de threading + escrita atÃƒÆ’Ã‚Â´mica).
  - **Pausa no meio:** o registro ÃƒÆ’Ã‚Â© RELIDO do storage a cada ciclo e os
    contadores fazem merge sobre a cÃƒÆ’Ã‚Â³pia fresca ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â pausar/parar (ou uma pausa
    gravada durante o `sleep`) nunca ÃƒÆ’Ã‚Â© sobrescrita; o loop para no ciclo
    seguinte. Reativar uma **concluÃƒÆ’Ã‚Â­da** zera os contadores (nova rodada);
    reativar uma **pausada** continua de onde parou (leads jÃƒÆ’Ã‚Â¡ enviados sÃƒÆ’Ã‚Â£o
    pulados). Ao final, status ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `concluida` (+ webhook `campanha.concluida`).
- **Frontend Disparos:** polling baixado de 4s ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ **2s** (barra de progresso
  acompanha os contadores em tempo real), bloco de campanha ativa ganhou selo
  **"Processando..."**, contagem de restantes e barra mais destacada
  (Zeigarnik); **Pausar/Iniciar agora ÃƒÆ’Ã‚Â© otimista** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a UI atualiza
  instantaneamente e o prÃƒÆ’Ã‚Â³ximo polling reverte se o backend falhar.
- **5 novos testes pytest** (`backend/tests/test_disparos_worker.py`): worker
  processa e conclui (contadores exatos, 1 erro a cada 10), **pausa gravada
  durante o `sleep` interrompe o loop** (corrida tratada ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â pegou e fixou um bug
  real onde o upsert sobrescrevia a pausa), retomada nÃƒÆ’Ã‚Â£o reenvia, rota "ativa"
  dispara o background e rota "pausada" nÃƒÆ’Ã‚Â£o dispara. SuÃƒÆ’Ã‚Â­te: **88 passed**.

## [0.1.28] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Corrigido

- **RenumeraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o por colisÃƒÆ’Ã‚Â£o (E409):** a `0.1.27` jÃƒÆ’Ã‚Â¡ estava staged no registry
  (sessÃƒÆ’Ã‚Â£o paralela), entÃƒÆ’Ã‚Â£o esta versÃƒÆ’Ã‚Â£o republica o estado atual do `main` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
  keep-alive do launcher com **Dummy Server** (`http.createServer` +
  `listen(0, '127.0.0.1')` + `await new Promise(() => {})`, camada principal;
  `stdin.resume`/`setInterval`/`beforeExit` secundÃƒÆ’Ã‚Â¡rias) e os **gates de
  regressÃƒÆ’Ã‚Â£o** correspondentes. SuÃƒÆ’Ã‚Â­te: **83 passed**.

## [0.1.27] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Corrigido (crÃƒÆ’Ã‚Â­tico)

- **Launcher ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Dummy Server (keep-alive infalÃƒÆ’Ã‚Â­vel):** as versÃƒÆ’Ã‚Âµes anteriores
  dependiam de `stdin`/timers; quando o MobaXterm fecha a entrada padrÃƒÆ’Ã‚Â£o em EOF
  (perda de foco/variaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de PTY), o event loop do Node esvaziava e o prompt
  voltava logo apÃƒÆ’Ã‚Â³s "LeadMaster no ar", derrubando o uvicorn junto. Agora o
  `cmdStart` cria, **logo apÃƒÆ’Ã‚Â³s o spawn do Python**, um servidor HTTP inativo
  (`http.createServer` + `keepAliveServer.listen(0, '127.0.0.1')`) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o socket
  aberto no sistema operacional segura o processo **independentemente do
  terminal**; o fluxo principal termina em `await new Promise(() => {})`
  (congelado para sempre) e `stdin.resume`/`setInterval`/`beforeExit` seguem
  como camadas secundÃƒÆ’Ã‚Â¡rias. **Testado ao vivo com stdin em EOF (`< NUL`):**
  node vivo 1min46s+, health 200, exportaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o CSV 200 no ar, encerramento
  limpo, zero ÃƒÆ’Ã‚Â³rfÃƒÆ’Ã‚Â£os.
- **AGENTS.md:** regra 1 do launcher passa a ser o Dummy Server (camada
  principal); regra 2 rebaixa stdin/timers a camadas secundÃƒÆ’Ã‚Â¡rias.
- **Gates de regressÃƒÆ’Ã‚Â£o reforÃƒÆ’Ã‚Â§ados** (`test_launcher_protections.py`): falham se
  `http.createServer`, `keepAliveServer.listen(0, '127.0.0.1')` ou
  `await new Promise(() => {})` desaparecerem do corpo do `cmdStart`.
  SuÃƒÆ’Ã‚Â­te completa: **83 passed**.

## [0.1.26] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Adicionado

- **Busca no CRM e exportaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o CSV** (registro retro-ativo ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â publicada sem
  entrada anterior):
  - `GET /api/crm/leads/export`: CSV de todos os leads com **BOM UTF-8**
    (`\ufeff`, Excel em portuguÃƒÆ’Ã‚Âªs nÃƒÆ’Ã‚Â£o quebra acentos), delimitador `;`,
    `text/csv; charset=utf-8` e
    `Content-Disposition: attachment; filename="leads_leadmaster.csv"`; campos
    de `extras` **achatados** como colunas `extras_<chave>` e listas (tags) em
    cÃƒÆ’Ã‚Â©lulas separadas por `; `.
  - Frontend: **barra de busca larga** no CRM com filtragem local instantÃƒÆ’Ã‚Â¢nea
    por **Nome, Telefone ou Email** + botÃƒÆ’Ã‚Â£o de limpar (Lei de Fitts); botÃƒÆ’Ã‚Â£o
    **"Exportar CSV"** em estilo **neutro/outline** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â nÃƒÆ’Ã‚Â£o compete com o
    "Adicionar Lead" em gradiente (von Restorff); busca sem resultados mostra
    *"Nenhum lead encontrado para '...'"* (Zeigarnik).
  - **Corrigido:** o modelo `LeadIn` descartava o campo `extras` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â leads
    criados manualmente perdiam site/avaliaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o. Agora o POST preserva
    `extras` (`LeadIn.extras: dict`).
  - **3 novos testes pytest** (`backend/tests/test_leads_export.py`): MIME +
    disposition + BOM + colunas, achatamento de `extras` e exportaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de base
    vazia (sÃƒÆ’Ã‚Â³ cabeÃƒÆ’Ã‚Â§alho).

## [0.1.25] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Adicionado

- **Modal de Detalhes do Lead no CRM (clique no card):**
  - Rota `PUT /api/crm/leads/{lead_id}` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ediÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de `nome`, `telefone` e `email`
    (todos opcionais no payload); nome vazio ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ **400** (prevenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de erros),
    lead inexistente ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ **404**, payload sem campos editÃƒÆ’Ã‚Â¡veis ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ **400**.
  - Card do Kanban passa a abrir os detalhes no **clique simples** (antes era
    duplo clique); flag global suprime o clique disparado no pointerup apÃƒÆ’Ã‚Â³s um
    drag, entÃƒÆ’Ã‚Â£o abrir detalhes e arrastar convivem sem conflito.
  - Modal "Detalhes do Lead" exibe **todos os dados** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â inclusive `extras`
    (Site, EndereÃƒÆ’Ã‚Â§o, AvaliaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, Seguidores, Username, Bio), tags, fonte e data
    de criaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â com **inputs de ediÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o** para Nome/Telefone/E-mail prÃƒÆ’Ã‚Â©-preenchidos
    (vermelho + mensagem se o nome for apagado), textarea de observaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes e botÃƒÆ’Ã‚Â£o
    **"Salvar AlteraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes"** grande em gradiente (Fitts + von Restorff), com
    **spinner** durante o salvamento (Zeigarnik), toast de sucesso e
    **atualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o automÃƒÆ’Ã‚Â¡tica** do Kanban. O "Fechar" (X) permanece sutil.
- **5 novos testes pytest** (`backend/tests/test_lead_edit_routes.py`): ediÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
  completa, ediÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o parcial (campos omitidos preservados), 404, nome vazio (400)
  e payload sem campos editÃƒÆ’Ã‚Â¡veis (400).

## [0.1.24] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Corrigido

- **Launcher ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â regressÃƒÆ’Ã‚Â£o do terminal preso investigada e blindagem reforÃƒÆ’Ã‚Â§ada** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
   usuÃƒÆ’Ã‚Â¡rio reportou o prompt do MobaXterm voltando logo apÃƒÆ’Ã‚Â³s "LeadMaster no ar"
   na 0.1.21 (runtime permanente). A investigaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o mostrou que o fluxo publicado
   **mantÃƒÆ’Ã‚Â©m** as proteÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes (`process.stdin.resume();`, `setInterval`,
   `child.on('exit')`/`close`, `process.on('exit')`, sem `.unref()`) e que uma
   morte silenciosa assim ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â sem nenhum log do handler de saÃƒÆ’Ã‚Â­da ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â sÃƒÆ’Ã‚Â³ ocorre por
   `SIGKILL`/`taskkill /F` (ex.: outra execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o `install`/`start` matando a
   instÃƒÆ’Ã‚Â¢ncia anterior pelo kill switch, ou fechamento forÃƒÆ’Ã‚Â§ado da aba). Mesmo
   assim, o launcher foi reforÃƒÆ’Ã‚Â§ado e os gates agora validam o **fluxo**:
   - **Rede de seguranÃƒÆ’Ã‚Â§a no `cmdStart`:** `process.on('beforeExit')` re-arma o
     `setInterval` se o event loop esvaziar (stdin em EOF, timer perdido,
     surpresa de PTY) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o Node jamais encerra sozinho; erros do stream de
     stdin (`process.stdin.on('error')`) sÃƒÆ’Ã‚Â£o ignorados;
   - **Gates de fluxo (`test_launcher_protections.py`):** novo helper
     `_corpo_cmd_start()` extrai o corpo da funÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para garantir que
     `spawn`, `process.stdin.resume();`, `setInterval`, `child.on('exit')`,
     `child.on('close')`, `process.on('exit')` e `beforeExit` existam **dentro
     do `start`** (nÃƒÆ’Ã‚Â£o no `install` nem em funÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o morta) e que **nenhum
     `process.exit(`** apareÃƒÆ’Ã‚Â§a apÃƒÆ’Ã‚Â³s o terminal ser preso ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a saÃƒÆ’Ã‚Â­da sÃƒÆ’Ã‚Â³ por ciclo
     de vida do filho ou por `SIGTERM`/`SIGBREAK`;
   - **AGENTS.md:** regra 2 do launcher documenta a rede de seguranÃƒÆ’Ã‚Â§a e a
     exigÃƒÆ’Ã‚Âªncia de posiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o (apÃƒÆ’Ã‚Â³s o spawn, no fluxo do start).
- **DiagnÃƒÆ’Ã‚Â³stico rÃƒÆ’Ã‚Â¡pido para o usuÃƒÆ’Ã‚Â¡rio:** com a regra acima, se o prompt voltar
  sem as linhas "Encerrando LeadMaster..." (SIGTERM/SIGBREAK) ou "Servidor
  local encerrou com cÃƒÆ’Ã‚Â³digo N" (Python caiu), a causa ÃƒÆ’Ã‚Â© externa ao launcher
  (outra execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ou fechamento forÃƒÆ’Ã‚Â§ado) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o espelho
  `storage/logs/launcher_console.log` mostra exatamente qual caminho ocorreu.

## [0.1.23] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Adicionado

- **Extratores conectados de verdade (fim da dependÃƒÆ’Ã‚Âªncia de mock quando
  configurado):**
  - **Google Maps:** executa o binÃƒÆ’Ã‚Â¡rio real (`gosom/google-maps-scraper`) com as
    flags de isolamento (`creationflags`, sem janelas de CMD) e **timeout de
    seguranÃƒÆ’Ã‚Â§a configurÃƒÆ’Ã‚Â¡vel** (`timeout_maps_segundos`, padrÃƒÆ’Ã‚Â£o 300s).
  - **Instagram:** passa **URL + limite** ao CLI (`igmapper_args` agora inclui
    `{limit}`) com timeout configurÃƒÆ’Ã‚Â¡vel (`timeout_instagram_segundos`, padrÃƒÆ’Ã‚Â£o
    120s).
  - **CNPJ:** URL base da **BrasilAPI** vem do `config.json`
    (`cnpj_api_url`) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â permite trocar o provedor sem alterar cÃƒÆ’Ã‚Â³digo.
  - **Regra de erro:** scraper **configurado** que falha (cÃƒÆ’Ã‚Â³digo ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â  0, timeout,
    executÃƒÆ’Ã‚Â¡vel invÃƒÆ’Ã‚Â¡lido) retorna **HTTP 500 com mensagem clara** e **nÃƒÆ’Ã‚Â£o salva
    nada** (sem mock disfarÃƒÆ’Ã‚Â§ado, sem dados parciais). Sem scraper configurado,
    o modo mock segue protegendo os primeiros testes.
  - Ferramentas ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Extratores ganhou os campos **URL base da BrasilAPI** e
    **timeouts de seguranÃƒÆ’Ã‚Â§a** (Maps/Instagram).
- **4 novos testes pytest** (`backend/tests/test_extractors_real.py`): scraper
  configurado falhando ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 500 sem salvar, timeout ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 500 "Timeout na extraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o",
  falha do igmapper ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 500 sem salvar, e mock preservado sem configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o.

## [0.1.22] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Adicionado

- **Funil de ProspecÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o (visÃƒÆ’Ã‚Â£o macro de conversÃƒÆ’Ã‚Â£o):**
  - Rota `GET /api/funnel`: conta os leads por etapa do CRM (`Leads ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Em
    Contato ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Proposta ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Fechado`), calcula a taxa de conversÃƒÆ’Ã‚Â£o de cada
    transiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o (`para/de ÃƒÆ’Ã¢â‚¬â€ 100`, 1 decimal) e a queda percentual, e identifica
    o **gargalo** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a etapa *origem* da maior queda (onde os leads param).
    Resposta: `{etapas, conversoes, gargalo}`.
  - PÃƒÆ’Ã‚Â¡gina `frontend/src/pages/Funil.tsx` (rota `/funil`, link **"Funil de
    ProspecÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o"** no menu): **funil em CSS puro** com fatias de largura
    decrescente (nome + quantidade por etapa), **cards de conversÃƒÆ’Ã‚Â£o** por
    transiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o (verde ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥50%, ÃƒÆ’Ã‚Â¢mbar ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥25%, vermelho abaixo), **alerta de gargalo**
    em vermelho/laranja com "ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Gargalo: muitos leads param em 'X'" e fatia
    do gargalo destacada (von Restorff), zero filtros na tela (Lei de Hick) e
    funil vazio com barra zerada + "Comece a prospectar para ver seu funil"
    (Zeigarnik). Acesso aos dados via `api.funil()` no cliente padronizado.
- **4 novos testes pytest** (`backend/tests/test_funnel_routes.py`):
  conversÃƒÆ’Ã‚Âµes + gargalo com distribuiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o [10,5,2,1] (taxas 50/40/50 ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ gargalo
    "Em Contato"), gargalo na primeira etapa, funil vazio (taxas `null`,
    gargalo `null`) e funil sem gargalo (quedas zero).

## [0.1.21] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Adicionado

- **MÃƒÆ’Ã‚Â³dulo de Webhooks revisado conforme especificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:**
  - `GET /api/webhook` agora retorna tambÃƒÆ’Ã‚Â©m **`ultimo_teste`** (registrado a cada
    teste bem-sucedido no `config.json`).
  - `PUT /api/webhook` e `POST /api/webhook/test` **validam a URL**: sÃƒÆ’Ã‚Â³
    `http://`/`https://` sÃƒÆ’Ã‚Â£o aceitos (400 com mensagem acionÃƒÆ’Ã‚Â¡vel).
  - Novo evento **`campanha.iniciada`** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â disparado quando uma campanha comeÃƒÆ’Ã‚Â§a a
    rodar; migraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o aditiva garante que ele apareÃƒÆ’Ã‚Â§a nas configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes existentes.
  - Frontend `frontend/src/pages/Webhook.tsx` reformulado: eventos exibidos
    diretamente e limpos (**Lead Criado**, **Campanha Iniciada**, **Campanha
    Finalizada** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Lei de Hick), **prevenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de erros** (Nielsen): URL fora do
    padrÃƒÆ’Ã‚Â£o http(s) bloqueia o salvamento e marca o input com **borda vermelha**,
    botÃƒÆ’Ã‚Â£o **"Salvar ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes"** em gradiente (Fitts) e **"Testar Webhook"**
    em outline contrastante (von Restorff), toast de sucesso/erro no teste e card
    **"ÃƒÆ’Ã…Â¡ltimo teste realizado em: [data/hora]"**.
- **7 novos testes pytest** (`backend/tests/test_webhook_routes.py`): leitura do
  padrÃƒÆ’Ã‚Â£o, salvamento de URL/eventos com persistÃƒÆ’Ã‚Âªncia, URL invÃƒÆ’Ã‚Â¡lida (400), teste
  com sucesso (mock do `httpx.post`, registra `ultimo_teste`), teste com falha de
  conexÃƒÆ’Ã‚Â£o sem quebrar (mock de `httpx.ConnectError`) e URL de teste invÃƒÆ’Ã‚Â¡lida.

## [0.1.20] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Adicionado

- **MÃƒÆ’Ã‚Â³dulo de Agentes de IA (controle e configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o):**
  - Backend: `GET /api/agents` (status + prompt de cada agente, e flag
    `llm_configurado`), `PUT /api/agents/{agent_id}/status` (ativo/inativo) e
    `PUT /api/agents/{agent_id}/prompt` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â persistÃƒÆ’Ã‚Âªncia no novo arquivo
    `storage/agents.json` (seed com prompts padrÃƒÆ’Ã‚Â£o em pt-BR).
  - **Regra de bloqueio:** ativar o **Agente de Disparo** sem a chave do LLM
    configurada retorna **400** com mensagem acionÃƒÆ’Ã‚Â¡vel ("Configure a API Key
    do LLM em Ferramentas..."); desativar e o Atendimento sÃƒÆ’Ã‚Â£o sempre
    permitidos.
  - Frontend: `frontend/src/pages/Agentes.tsx` reformulado em **dois cards
    lado a lado** (Disparo / Atendimento): badge de status, **toggle grande**
    (w-16 h-9 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Fitts), **pulso animado verde-esmeralda** e badge esmeralda
    quando ativo (von Restorff + Zeigarnik), textarea do **Prompt do Sistema**
    + botÃƒÆ’Ã‚Â£o "Salvar Prompt", toast especÃƒÆ’Ã‚Â­fico ("Configure a API Key na aba
    Ferramentas primeiro.") quando o bloqueio 400 ocorre, e **accordion** com
    as configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes avanÃƒÆ’Ã‚Â§adas (modelo LLM/temperatura; modo texto/voz do
    atendimento) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Lei de Hick.
- **8 novos testes pytest** (`backend/tests/test_agents_routes.py`): listagem,
  bloqueio do disparo sem LLM (400), ativaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do atendimento, ativaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do
  disparo com LLM, desativaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, status invÃƒÆ’Ã‚Â¡lido/agente desconhecido (400/404),
  persistÃƒÆ’Ã‚Âªncia do prompt e erros de prompt.

## [0.1.19] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Adicionado

- **`POST /api/config`** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â alias do `PUT /api/config` (frontend continua usando
  PUT; clientes externos podem usar POST, como na especificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o da tela de
  Ferramentas).
- **PrevenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de erros (Nielsen) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â trim automÃƒÆ’Ã‚Â¡tico:** todo texto do payload de
  configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o recebe `strip()` antes de gravar (recursivo, inclui arrays e
  objetos aninhados) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â espaÃƒÆ’Ã‚Â§o acidental em API Key ou URL nÃƒÆ’Ã‚Â£o vira falha
  misteriosa depois.
- **ValidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de payload (422):** seÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o que ÃƒÆ’Ã‚Â© objeto no padrÃƒÆ’Ã‚Â£o (`llm`,
  `extratores`, `integracoes`, `agentes`, `webhook`, `perfil`) recebendo valor
  escalar ÃƒÆ’Ã‚Â© rejeitada com mensagem acionÃƒÆ’Ã‚Â¡vel, em vez de corromper o
  `config.json` e a UI.
- **ÃƒÆ’Ã‚Âcone de olho no campo de API Key** (`CampoSecreto` em Ferramentas):
  alterna visibilidade da chave (von Restorff) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â conferir/colar sem apagar o
  campo. Continua com placeholder mascarado e aviso "deixe vazio para manter".
- **Testes (`backend/tests/test_config.py`)** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 7 novos testes de
  `GET/POST/PUT /api/config`: estrutura padrÃƒÆ’Ã‚Â£o, segredos nunca expostos ( GET
  devolve vazio + `_configurado` e o corpo cru nÃƒÆ’Ã‚Â£o contÃƒÆ’Ã‚Â©m a chave),
  persistÃƒÆ’Ã‚Âªncia + trim, segredo vazio nÃƒÆ’Ã‚Â£o apaga o atual, PUT funcional,
  payload invÃƒÆ’Ã‚Â¡lido ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 422 e trim em arrays aninhados.
  SuÃƒÆ’Ã‚Â­te completa: **51 passed**.

### Auditoria

- **Tela de Ferramentas:** auditada contra a especificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a pÃƒÆ’Ã‚Â¡gina
  (`frontend/src/pages/Ferramentas.tsx`, rota `/ferramentas` jÃƒÆ’Ã‚Â¡ no menu) jÃƒÆ’Ã‚Â¡
  cobria LLM (provedor/base URL/modelo/API Key), Extratores (Maps, igmapper,
  templates em accordion, CNPJ/Scrapling), Perfil e o botÃƒÆ’Ã‚Â£o gradiente "Salvar
  configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes" com toast. Gaps entregues acima: POST, trim, validaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, olho.
- **IntegraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes:** a seÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o cobre **OpenOutreach** (disparo) e **pipecat**
  (atendimento por voz), que sÃƒÆ’Ã‚Â£o as integraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes do produto. **YouTube/Meta nÃƒÆ’Ã‚Â£o
  foram implementados** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o AGENTS.md (Ãƒâ€šÃ‚Â§1) ÃƒÆ’Ã‚Â© explÃƒÆ’Ã‚Â­cito: produÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o/upload de
  vÃƒÆ’Ã‚Â­deos **nÃƒÆ’Ã‚Â£o faz parte** do LeadMaster (o storage jÃƒÆ’Ã‚Â¡ remove chaves desses
  sistemas em migraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o). Se o pipeline de vÃƒÆ’Ã‚Â­deos entrar no roadmap um dia, serÃƒÆ’Ã‚Â¡
  como novo mÃƒÆ’Ã‚Â³dulo com decisÃƒÆ’Ã‚Â£o de produto registrada.

## [0.1.18] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Adicionado

- **Zero states no Painel (Efeito Zeigarnik)** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â com base vazia a tela nÃƒÆ’Ã‚Â£o
  mostra mais grÃƒÆ’Ã‚Â¡ficos em branco:
  - `LeadsStageChart`: **"Nenhum dado ainda. Comece extraindo leads!"** com
    orientaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o aos extratores (Maps/Instagram/CNPJ);
  - `CampaignsDoughnut`: **"Nenhuma campanha disparada ainda."** com orientaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    a Disparos;
  - ambos em bloco tracejado discreto, sem quebrar o layout (altura preservada).
- **Testes das mÃƒÆ’Ã‚Â©tricas (`backend/tests/test_metrics.py`)** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 4 novos testes da
  rota `GET /api/metrics` com dados conhecidos em `LEADMASTER_HOME` temporÃƒÆ’Ã‚Â¡rio
  (seeds de demo neutralizados):
  - base vazia: totais zerados e taxas padrÃƒÆ’Ã‚Â£o (100% entrega / 0% erro);
  - leads conhecidos: `leads_total` e `leads_por_etapa` exatos por coluna;
  - consolidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de campanhas: enviadas/erros somados e taxas proporcionais
    (150/162 ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 92,6% e 7,4%);
  - reflexo do Kanban: mover lead de coluna via `PUT /api/crm/leads/{id}/etapa`
    recalcula `leads_por_etapa` na hora.
  - SuÃƒÆ’Ã‚Â­te completa: **44 passed**.

### Auditoria

- **`GET /api/metrics` (dinÃƒÆ’Ã‚Â¢mica):** auditada contra a especificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â jÃƒÆ’Ã‚Â¡ lÃƒÆ’Ã‚Âª
  `leads.json`/`campaigns.json` em tempo real e devolve `leads_total`,
  `leads_por_etapa` (leads/em_contato/proposta/fechado), totais consolidados
  das campanhas, `taxa_entrega`/`taxa_erro` (fallback 100%/0% sem campanhas) e
  `conexao` (geral/llm/openoutreach). Nenhuma alteraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de cÃƒÆ’Ã‚Â¡lculo necessÃƒÆ’Ã‚Â¡ria ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
  agora com cobertura de testes e zero states na UI.

## [0.1.17] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Corrigido

- **Erro `EBUSY` do npx ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â migraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para Runtime Permanente.** A 0.1.15 tentou
  resolver com kill switch dentro do launcher, o que ÃƒÆ’Ã‚Â© impossÃƒÆ’Ã‚Â­vel: o `EBUSY`
  acontece no gerenciador de arquivos do `npx` (`_npx\...`) **antes** de o
  `cli.mjs` ser carregado, entÃƒÆ’Ã‚Â£o o kill switch nunca rodava. Causa raiz: o
  `uvicorn` era spawnado com `cwd` dentro do cache do npx, segurando o
  diretÃƒÆ’Ã‚Â³rio. Nova arquitetura:
  - Pasta permanente **`<home>/.runtime`** guarda `backend/` + `frontend/dist/`.
  - `install`: kill switch (libera arquivos) ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ apaga o `.runtime` anterior ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢
    copia esta versÃƒÆ’Ã‚Â£o do pacote para ele. O cache do npx nunca mais ÃƒÆ’Ã‚Â© tocado
    por processos nossos.
  - `start`: spawna o Python a partir de **`<home>/.runtime/backend`** (nunca
    de `__dirname`); sem `.runtime` pronto, auto-aprovisiona; com pronto,
    reutiliza sem recopiar.
  - Launcher faz `process.chdir(home)` na entrada ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â cwd fora do cache.
  - Regra inviolÃƒÆ’Ã‚Â¡vel documentada no AGENTS.md ("terminantemente proibido
    executar o servidor a partir da pasta temporÃƒÆ’Ã‚Â¡ria do npx") + gate de
    regressÃƒÆ’Ã‚Â£o (`.runtime`, `copiarParaRuntime`, `cpSync`, `rmSync`,
    `path.join(runtime, 'backend')`, `process.chdir(homeLauncher)`).
  - `.runtime/` adicionado ao `.gitignore`; `doctor` reporta o status do
    runtime.

## [0.1.16] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-09

### Adicionado

- **MÃƒÆ’Ã‚Â³dulo de Disparos (Campanhas) revisado conforme especificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:**
  - Rota `PUT /api/campaigns/{id}/status` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â altera status
    (`rascunho`/`ativa`/`pausada`/`concluida`; `ativa` normalize para
    `em_andamento`; status invÃƒÆ’Ã‚Â¡lido ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 400, campanha inexistente ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 404).
  - `POST /api/campaigns` agora aceita **`filtro_etapa`**: sem `lead_ids`
    explÃƒÆ’Ã‚Â­citos, seleciona automaticamente os leads da etapa do CRM escolhida
    (ex.: "Novos Leads"), e **`mensagem`** (texto do template) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â usada pelo
    agente de disparo quando presente.
  - PÃƒÆ’Ã‚Â¡gina `frontend/src/pages/Disparos.tsx` reformulada em **tabela**
    (Nome Ãƒâ€šÃ‚Â· Status Ãƒâ€šÃ‚Â· Total de Leads Ãƒâ€šÃ‚Â· Data de CriaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o Ãƒâ€šÃ‚Â· AÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes), botÃƒÆ’Ã‚Â£o
    **"Nova Campanha"** grande no topo (Fitts + von Restorff) e modal com nome,
    **template da mensagem** (textarea), canal e **dropdown de filtro por etapa
    do CRM**. AÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes na tabela: **Iniciar** (gradiente), **Pausar** e **Parar**.
  - UX: badges de status vibrantes (verde "Ativa", amarelo "Pausada", cinza
    "Rascunho" ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â von Restorff) e **barra de progresso + spinner** para
    campanhas ativas (Zeigarnik, com polling react-query a cada 4s).
- **5 novos testes pytest** (`backend/tests/test_campaigns_routes.py`):
  listagem, criaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o com filtro de etapa + persistÃƒÆ’Ã‚Âªncia, payload invÃƒÆ’Ã‚Â¡lido,
  alteraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de status (ativa/pausada) e erros (status invÃƒÆ’Ã‚Â¡lido 400 /
  inexistente 404).

### Corrigido

- **Launcher ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â kill switch (6Ãƒâ€šÃ‚Âª regra inviolÃƒÆ’Ã‚Â¡vel):** o launcher NUNCA mais
  ignora uma porta ocupada por instÃƒÆ’Ã‚Â¢ncia anterior do LeadMaster ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â antes de
  subir, encerra a instÃƒÆ’Ã‚Â¢ncia antiga confirmada (PID dono da porta via
  `netstat -ano` no Windows / `lsof -ti:porta -sTCP:LISTEN` no Unix, com
  fallback `ps`), `taskkill /F /T /PID` ou `kill -9`, aguardando atÃƒÆ’Ã‚Â© 5s a
  liberaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o. A mensagem "jÃƒÆ’Ã‚Â¡ estÃƒÆ’Ã‚Â¡ rodando" foi **removida** (impedia
  atualizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes e causava `EBUSY` no npx). Processos de outros projetos nunca
  sÃƒÆ’Ã‚Â£o tocados (avanÃƒÆ’Ã‚Â§a para a prÃƒÆ’Ã‚Â³xima porta). Roda no `install` (libera
  arquivos) e no `start`. Gate de regressÃƒÆ’Ã‚Â£o reforÃƒÆ’Ã‚Â§ado com as asserÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes do
  kill switch.

## [0.1.15] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-08

### Corrigido

- **Launcher ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â kill switch: a versÃƒÆ’Ã‚Â£o nova SEMPRE assume o controle** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o
   bloqueio de porta foi eliminado. Antes, ao detectar a porta ocupada, o
   `cli.mjs` apenas imprimia "LeadMaster jÃƒÆ’Ã‚Â¡ estÃƒÆ’Ã‚Â¡ rodando" e encerrava: a versÃƒÆ’Ã‚Â£o
   antiga continuava no ar, o usuÃƒÆ’Ã‚Â¡rio nÃƒÆ’Ã‚Â£o conseguia testar a nova e o `npx`
   falhava com `EBUSY` (arquivos travados no Windows). Agora:
   - **`encerrarInstanciaAnterior()`** roda no inÃƒÆ’Ã‚Â­cio do `install` (libera os
     arquivos antes de instalar ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fim do `EBUSY`) e do `start`;
   - descoberta do PID dono da porta via `netstat -ano` (Windows) /
     `lsof -ti:porta` (Linux/macOS, com fallback `ps`), seguida de
     `taskkill /F /T /PID` ou `kill -9`;
   - espera de atÃƒÆ’Ã‚Â© 5s pela liberaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o da porta antes de subir o novo servidor;
   - **higiene preservada:** sÃƒÆ’Ã‚Â³ mata processos **confirmados** como LeadMaster
     (`/api/health` com payload prÃƒÆ’Ã‚Â³prio + PID dono da porta). Portas ocupadas
     por outros projetos sÃƒÆ’Ã‚Â£o respeitadas ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o launcher avanÃƒÆ’Ã‚Â§a para a prÃƒÆ’Ã‚Â³xima
     porta livre, como sempre;
   - ciclo de vida vinculado mantido: com o Python antigo morto, o Node antigo
     encerra sozinho (`child.on('exit')`/`close`).
- **AGENTS.md:** 6Ãƒâ€šÃ‚Âª regra inviolÃƒÆ’Ã‚Â¡vel do launcher ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â *Kill switch*: nunca ignorar
   porta ocupada por instÃƒÆ’Ã‚Â¢ncia do LeadMaster; mensagem de reuso **proibida**.
- **Gate de regressÃƒÆ’Ã‚Â£o:** `test_launcher_protections.py` falha se o kill switch
   desaparecer (`encerrarInstanciaAnterior`/`taskkill`/`netstat`/`lsof`) ou se a
   mensagem proibida voltar. SuÃƒÆ’Ã‚Â­te completa: **32 passed**.
- **Testado ao vivo:** instÃƒÆ’Ã‚Â¢ncia anterior na mesma porta detectada, encerrada
   (PID confirmado) e nova instÃƒÆ’Ã‚Â¢ncia assumida com PID novo; node antigo caiu
   pelo ciclo de vida; instÃƒÆ’Ã‚Â¢ncia de outros projetos preservada.

## [0.1.14] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-08

### Adicionado

- **Extrator de Leads (CNPJ) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â terceira fonte dedicada, leads B2B:**
  - Rota `POST /api/extractors/cnpj` (`cnae`, `uf`, `limit`): enquanto o provedor
    de busca em Ferramentas ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Extratores for o placeholder padrÃƒÆ’Ã‚Â£o, gera **mock de
    5ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“10 empresas fictÃƒÆ’Ã‚Â­cias** (nome fantasia, CNPJ formatado, telefone/e-mail,
    porte e capital social em `extras`) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â estabilidade e anti-bloqueio nesta
    fase. Com URL de provedor real configurada, consulta o provedor
    (`buscar_cnpj_cnae`, parser tolerante) e **degrada para mock** em falha ou
    rate-limit, com aviso acionÃƒÆ’Ã‚Â¡vel. Leads salvos em `leads.json` na coluna
    **"Novos Leads"** e retornados na resposta (`extraidos`, `importados`,
    `duplicados`, `origem`).
  - PÃƒÆ’Ã‚Â¡gina `frontend/src/pages/ExtratorCNPJ.tsx` (rota `/extrator-cnpj`, link no
    menu lateral): campo **CNAE**, **dropdown de UF** (27 estados), slider de
    quantidade (5ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“10), botÃƒÆ’Ã‚Â£o **"Iniciar ExtraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o"** em gradiente
    (von Restorff/Fitts), **barra de progresso animada** "Buscando empresas..."
    (Zeigarnik), tabela de resultados (Nome Fantasia, CNPJ, Cidade/UF,
    Telefone, Fonte) e botÃƒÆ’Ã‚Â£o **"Ir para o CRM"**. OpÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes avanÃƒÆ’Ã‚Â§adas (porte da
    empresa, capital social mÃƒÆ’Ã‚Â­nimo) escondidas em accordion (Lei de Hick) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
    aplicam-se ao provedor real.
  - **Consulta avulsa por CNPJ** (BrasilAPI) preservada dentro da nova pÃƒÆ’Ã‚Â¡gina:
    consulta e importa uma empresa especÃƒÆ’Ã‚Â­fica para "Novos Leads".
  - `frontend/src/pages/Extratores.tsx` virou hub de atalhos para as trÃƒÆ’Ã‚Âªs
    pÃƒÆ’Ã‚Â¡ginas dedicadas (Maps, Instagram, CNPJ) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â aba CNPJ removida, mesmo
    padrÃƒÆ’Ã‚Â£o das outras fontes.
- **Testes:** `backend/tests/test_cnpj_extractor.py` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â mock gera e persiste
  (fonte/etapa/campos), limite respeitado, UF normalizada (minÃƒÆ’Ã‚Âºscula ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ "MG") e
  payload invÃƒÆ’Ã‚Â¡lido (422). SuÃƒÆ’Ã‚Â­te completa: **31 passed**.

### Auditoria

- **0.1.13 (versÃƒÆ’Ã‚Â£o anterior):** Extrator Instagram entregue na 0.1.12 por sessÃƒÆ’Ã‚Â£o
  simultÃƒÆ’Ã‚Â¢nea ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â auditado contra a especificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o (rota `POST /api/extractors/instagram`,
  mock 5ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“10, pÃƒÆ’Ã‚Â¡gina `/extrator-instagram`, accordion avanÃƒÆ’Ã‚Â§ado, testes) **sem
  alteraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes necessÃƒÆ’Ã‚Â¡rias**; versÃƒÆ’Ã‚Â£o dinÃƒÆ’Ã‚Â¢mica na sidebar (`__APP_VERSION__`) e
  consolidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do `process.on('exit')` do launcher conferidos e verdes.

## [0.1.13] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-08

### Adicionado

- **VersÃƒÆ’Ã‚Â£o dinÃƒÆ’Ã‚Â¢mica na sidebar** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a barra lateral exibe **LeadMaster `v0.1.13`**
  (badge discreto ao lado do logotipo, `text-[10px]` em indigo sobre o fundo
  escuro `#1e1b4b`):
  - `frontend/vite.config.ts`: `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`
    lendo o `package.json` da **raiz** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â cada release no NPM (bump de versÃƒÆ’Ã‚Â£o)
    atualiza a UI **automaticamente**, sem nenhuma alteraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o manual no cÃƒÆ’Ã‚Â³digo
    React;
  - `frontend/src/vite-env.d.ts`: `declare const __APP_VERSION__: string;`;
  - `frontend/src/components/Sidebar.tsx`: badge `v{__APP_VERSION__}` no header.

### Corrigido

- **Launcher ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â casa arrumada:** consolidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do `process.on('exit')` duplicado
  (haviam dois handlers matando o worker Python; ficou apenas o mais forte, com
  `taskkill /T /F` no Windows) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o gate de regressÃƒÆ’Ã‚Â£o continua falhando se o ciclo
  de vida vinculado ou o terminal preso desaparecerem.

## [0.1.12] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-08

### Adicionado

- **Extrator de Leads (Instagram)** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â segunda fonte dedicada, mesmo padrÃƒÆ’Ã‚Â£o do Maps:
  - Rota `POST /api/extractors/instagram` (`profile_url`, `limit`): sem igmapper
    configurado gera **mock de 5ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“10 leads** (seguranÃƒÆ’Ã‚Â§a anti-bloqueio de conta);
    com `lucasoal/igmapper` configurado em Ferramentas, executa o CLI real com as
    flags de isolamento (`creationflags`). Leads salvos em `leads.json` na coluna
    **"Novos Leads"**.
  - PÃƒÆ’Ã‚Â¡gina `frontend/src/pages/ExtratorInstagram.tsx` (rota `/extrator-instagram`,
    link no menu lateral): campo de URL do perfil + slider de quantidade, botÃƒÆ’Ã‚Â£o
    **"Iniciar ExtraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o"** em gradiente (von Restorff/Fitts), **barra de progresso
    animada** "Buscando seguidores..." (Zeigarnik), tabela de resultados
    (Nome/Username, Telefone, Fonte, Seguidores) e botÃƒÆ’Ã‚Â£o **"Ir para o CRM"**.
  - OpÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes avanÃƒÆ’Ã‚Â§adas (apenas contas comerciais, mÃƒÆ’Ã‚Â­nimo de seguidores) escondidas
    em accordion (Lei de Hick).
  - Aba Instagram duplicada em Extratores removida ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a pÃƒÆ’Ã‚Â¡gina agora tem apenas
    CNPJ + atalhos para as duas pÃƒÆ’Ã‚Â¡ginas dedicadas (Maps e Instagram).

### Corrigido

- **Launcher (5Ãƒâ€šÃ‚Âª regra inviolÃƒÆ’Ã‚Â¡vel):** `process.on('exit')` mata o worker Python em
  qualquer caminho de saÃƒÆ’Ã‚Â­da (erros inesperados inclusive); `.unref()` eliminado
  tambÃƒÆ’Ã‚Â©m dos comentÃƒÆ’Ã‚Â¡rios. Gate de regressÃƒÆ’Ã‚Â£o atualizado
  (`test_launcher_protections.py`): falha se `process.stdin.resume()`, o ciclo de
  vida vinculado ou o isolamento desaparecerem do launcher.
- **RenumeraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o por colisÃƒÆ’Ã‚Â£o:** a `0.1.11` jÃƒÆ’Ã‚Â¡ estava publicada no registry (commit
  do terminal preso) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â esta sessÃƒÆ’Ã‚Â£o renumera para o patch seguinte, conforme regra
  do AGENTS.md.

## [0.1.11] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-08

### Corrigido

- **Launcher ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â terminal preso:** `process.stdin.resume();` imediatamente antes das
  mensagens finais de sucesso ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o processo Node permanece vivo ouvindo a entrada
  padrÃƒÆ’Ã‚Â£o, o prompt do MobaXterm nunca ÃƒÆ’Ã‚Â© devolvido e a PTY (e com ela o uvicorn)
  nÃƒÆ’Ã‚Â£o ÃƒÆ’Ã‚Â© fechada. Publicada via tag `v0.1.11`.

## [0.1.10] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-08

### Adicionado

- **Extrator de Leads (Google Maps)** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â primeira pÃƒÆ’Ã‚Â¡gina dedicada de extraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:
  - Rota `POST /api/extractors/maps` (`keyword`, `location`, `limit`): sem scraper
    configurado gera **mock de 5ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“10 leads** (seguranÃƒÆ’Ã‚Â§a anti-bloqueio de IP);
    com `gosom/google-maps-scraper` configurado em Ferramentas, executa o CLI
    real com as flags de isolamento (`creationflags` da 0.1.5). Os leads sÃƒÆ’Ã‚Â£o
    salvos em `leads.json` na coluna **"Novos Leads"** e retornados na resposta.
  - PÃƒÆ’Ã‚Â¡gina `frontend/src/pages/ExtratorMaps.tsx` (rota `/extrator-maps`, link no
    menu lateral): formulÃƒÆ’Ã‚Â¡rio limpo (palavra-chave, localizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, slider de
    quantidade), **modal/accordion** com opÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes avanÃƒÆ’Ã‚Â§adas escondidas (Lei de
    Hick), botÃƒÆ’Ã‚Â£o **"Iniciar ExtraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o"** em gradiente (von Restorff/Fitts),
    **barra de progresso animada** durante a extraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o (Zeigarnik), tabela de
    resultados (Nome, Telefone, LocalizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, AvaliaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o) e botÃƒÆ’Ã‚Â£o **"Ir para o
    CRM"**. A aba Maps duplicada dentro de Extratores foi removida (substituÃƒÆ’Ã‚Â­da
    por um atalho para a pÃƒÆ’Ã‚Â¡gina dedicada).

### Corrigido

- **Bug latente em `storage.import_leads`** (NameError na deduplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
  exposto pelos novos testes e corrigido; importaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o em massa agora funciona.

### Testes

- 3 novos testes pytest da rota (`backend/tests/test_maps_extractor.py`):
  mock/persistÃƒÆ’Ã‚Âªncia, limite respeitado e payload invÃƒÆ’Ã‚Â¡lido (422).
  SuÃƒÆ’Ã‚Â­te completa: **21 passed**.

## [0.1.09] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-08

### Corrigido

- **Encerramento silencioso do launcher no MobaXterm (Windows)** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o app morria
  sozinho por sinais espÃƒÆ’Ã‚Âºrios (perda de foco/minimizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o) e por EPIPE ao fechar o
  terminal. CorreÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes no `scripts/cli.mjs`:
  - **Keep-alive:** `setInterval(() => {}, 1000);` mantÃƒÆ’Ã‚Â©m o event loop ativo mesmo
    sem I/O de console.
  - **AbsorÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de sinais no Windows:** `SIGINT`/`SIGHUP` agora sÃƒÆ’Ã‚Â£o apenas logados
    (`[LAUNCHER] Sinal absorvido no Windows`) e **nÃƒÆ’Ã‚Â£o** encerram o launcher;
    `SIGTERM`/`SIGBREAK` (Ctrl+Break) seguem como paradas legÃƒÆ’Ã‚Â­timas. No
    Linux/macOS o comportamento gracioso ÃƒÆ’Ã‚Â© mantido.
  - **Guarda da consola (anti-EPIPE):** `guardConsoleStream()` ignora erros `EPIPE`
    no `'error'` dos streams e espelha toda a saÃƒÆ’Ã‚Â­da em
    `storage/logs/launcher_console.log`; escrita original com exceÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o retorna
    silenciosamente. Aplicada a `process.stdout`/`process.stderr` antes de
    qualquer escrita do launcher.
  - Isolamento mantido: worker Python com `detached: true` + `windowsHide: true`
    (`CREATE_NEW_PROCESS_GROUP`).
- **AGENTS.md:** nova seÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o *ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â¨ REGRA INVIOLÃƒÆ’Ã‚ÂVEL: ARQUITETURA DO LAUNCHER* com as
  4 proteÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes obrigatÃƒÆ’Ã‚Â³rias.
- **Gate de regressÃƒÆ’Ã‚Â£o:** `backend/tests/test_launcher_protections.py` falha se
  keep-alive, absorÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de sinais, `guardConsoleStream` ou isolamento forem
  removidos do launcher.

## [0.1.08] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-08

### Adicionado

- **MÃƒÆ’Ã‚Â³dulo CRM Kanban implementado conforme especificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:**
  - Rotas: `GET /api/crm/leads`, `POST /api/crm/leads` (criaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o manual) e
    `PUT /api/crm/leads/{lead_id}/etapa` (movimentaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ao soltar o card) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
    persistÃƒÆ’Ã‚Âªncia no `leads.json` local (seeds de demonstraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o mantidos).
  - Kanban com **@dnd-kit/core + @dnd-kit/sortable** (multi-contÃƒÆ’Ã‚Âªiner):
    arrastar entre colunas persiste via API; reordenaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o visual dentro da
    coluna; soltar fora das colunas reverte o movimento.
  - Colunas: **Novos Leads ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Em Contato ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Proposta ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Fechado**.
  - Card mostra Nome, Telefone, Fonte e **Data de CriaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o**.
  - BotÃƒÆ’Ã‚Â£o **"Adicionar Lead"** (gradiente) com modal de criaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o (campos
    avanÃƒÆ’Ã‚Â§ados em accordion).
  - UX: card inteiro arrastÃƒÆ’Ã‚Â¡vel (Fitts); **opacity 0.5** no card arrastado e
    **borda tracejada indigo** na coluna de destino (Zeigarnik); colunas
    brancas com sombra suave (padrÃƒÆ’Ã‚Â£o do Dashboard).
- **7 novos testes pytest** para as rotas do CRM (`backend/tests/test_crm_routes.py`):
  listagem, criaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, persistÃƒÆ’Ã‚Âªncia, validaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, movimentaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, 404 e etapas
  invÃƒÆ’Ã‚Â¡lidas ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â isolados com `LEADMASTER_HOME` temporÃƒÆ’Ã‚Â¡rio.

## [0.1.07] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-08

### Adicionado

- **Regra permanente (AGENTS.md): PROIBIDO criar versÃƒÆ’Ã‚Âµes que abram telas de
  CMD/terminal no computador do usuÃƒÆ’Ã‚Â¡rio.** Nenhum popup de console pode aparecer
  ao rodar o LeadMaster; requisitos tÃƒÆ’Ã‚Â©cnicos:
  - Node (`child_process`): sempre `windowsHide: true`; `.cmd`/`.bat` via
    `shell: true` + `windowsHide: true`;
  - Python (`subprocess`): sempre `creationflags` com `CREATE_NO_WINDOW`
    (`services/flags.py`);
  - saÃƒÆ’Ã‚Â­da sempre em pipes/logs ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â nunca janelas interativas.
  - QA inclui verificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o item a item dos spawns.
  - Estado do cÃƒÆ’Ã‚Â³digo auditado: todos os spawns do launcher jÃƒÆ’Ã‚Â¡ cumprem
    (`windowsHide`) e os subprocessos Python usam `creationflags` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â nenhuma
    alteraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de cÃƒÆ’Ã‚Â³digo foi necessÃƒÆ’Ã‚Â¡ria.

## [0.1.06] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-08

### Corrigido

- **Regra de comandos de instalaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o (AGENTS.md)** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â redaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o ambÃƒÆ’Ã‚Â­gua permitia enviar
  `@latest` nas mensagens de release. Agora ÃƒÆ’Ã‚Â© explÃƒÆ’Ã‚Â­cito: os comandos entregues ao
  usuÃƒÆ’Ã‚Â¡rio usam **sempre a versÃƒÆ’Ã‚Â£o canÃƒÆ’Ã‚Â´nica confirmada no registry** (ex.: `0.1.6`) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
  `@latest` ÃƒÆ’Ã‚Â© permitido apenas nas instruÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes permanentes (README, pÃƒÆ’Ã‚Â¡gina NPM,
  `legal/`).

## [0.1.05] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-08

### Corrigido

- **Encerramento em cascata no Windows (STATUS_CONTROL_C_EXIT / 0xC000013A)** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o
  launcher Node e os workers Python compartilhavam o mesmo grupo de processos,
  entÃƒÆ’Ã‚Â£o Ctrl+C no terminal (MobaXterm, VS Code, perda de foco) derrubava tudo
  junto, arriscando corromper extraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes e trabalhos em andamento.
  - `scripts/cli.mjs`: o servidor FastAPI ÃƒÆ’Ã‚Â© spawnado com **`detached: true`**
    (no Windows, `CREATE_NEW_PROCESS_GROUP` 0x00000200) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â grupo de processos
    prÃƒÆ’Ã‚Â³prio; sinais do terminal nÃƒÆ’Ã‚Â£o cascateiam para o worker, que sÃƒÆ’Ã‚Â³ ÃƒÆ’Ã‚Â©
    encerrado pelo `kill()` controlado do launcher.
  - `backend/services/flags.py` (novo): helper `creationflags()` com
    `CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW` (0x08000200) no Windows;
    0 no Linux/macOS.
  - `backend/services/extractors.py`: todas as execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de CLI (Google Maps
    Scraper, igmapper, Scrapling) passam a usar as flags isoladas.
  - Testes `backend/tests/test_process_flags.py` (pytest) verificam as flags sem
    mockar `os.name` (o que quebraria `pathlib` nas duas direÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes): o helper
    recebe a plataforma por parÃƒÆ’Ã‚Â¢metro e os testes mockam o prÃƒÆ’Ã‚Â³prio helper ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
    passam idÃƒÆ’Ã‚Âªnticos no GitHub Actions (Linux) e no Windows local.
  - CI: novo passo "Run backend tests (pytest)" no workflow de publicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o.

## [0.1.04] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-11-05

### Corrigido

- **InstruÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de instalaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o fixadas em versÃƒÆ’Ã‚Â£o antiga** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o README (GitHub e pacote NPM)
  e a mensagem final do `install` usavam `@0.1.0`, instalando uma versÃƒÆ’Ã‚Â£o obsoleta.
  - README e saÃƒÆ’Ã‚Â­da do launcher agora usam a tag **`@latest`** (CMD/MobaXterm e normal),
    com a versÃƒÆ’Ã‚Â£o exata exibida ao lado na mensagem do `install`.
  - AGENTS.md documenta a regra: instruÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes permanentes sempre `@latest`; comunicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    de release informa tambÃƒÆ’Ã‚Â©m a versÃƒÆ’Ã‚Â£o canÃƒÆ’Ã‚Â´nica do registry.

## [0.1.03] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-10-25

### Adicionado

- **PÃƒÆ’Ã‚Â¡ginas legais e de verificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o** (`legal/`), baseadas no layout do AutoPost-Lunga:
  - `legal/index.html` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â pÃƒÆ’Ã‚Â¡gina de apresentaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o/verificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para APIs de plataformas
    (TikTok, YouTube, Pinterest, Meta): funcionalidades do LeadMaster (CRM Kanban,
    extratores de leads, agentes de IA e pipeline de vÃƒÆ’Ã‚Â­deos faceless), integraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes via
    APIs oficiais e links para os documentos legais.
  - `legal/privacy.html` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â PolÃƒÆ’Ã‚Â­tica de Privacidade em portuguÃƒÆ’Ã‚Âªs (Brasil) com conformidade
    explÃƒÆ’Ã‚Â­cita ÃƒÆ’Ã‚Â  LGPD (Lei 13.709/2018): dados coletados (e-mail, leads prospectados, uso,
    cookies, tokens de API), finalidades, armazenamento 100% local (JSON), bases legais,
    compartilhamento (plataformas via APIs oficiais e provedores de LLM), direitos do
    titular (art. 18), seguranÃƒÆ’Ã‚Â§a, retenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o e encarregado (DPO).
  - `legal/terms.html` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Termos de Uso em portuguÃƒÆ’Ã‚Âªs (Brasil): aceitaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, descriÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do
    serviÃƒÆ’Ã‚Â§o ("como estÃƒÆ’Ã‚Â¡"), responsabilidades do usuÃƒÆ’Ã‚Â¡rio (conteÃƒÆ’Ã‚Âºdo gerado, credenciais,
    LGPD e termos de plataformas terceiras), usos proibidos (spam/assÃƒÆ’Ã‚Â©dio), limitaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de
    responsabilidade (bloqueios e penalidades de plataformas), propriedade intelectual
    (uso pessoal, vedada revenda), foro do desenvolvedor (Brasil) e referÃƒÆ’Ã‚Âªncia ÃƒÆ’Ã‚Â 
    PolÃƒÆ’Ã‚Â­tica de Privacidade.
  - PÃƒÆ’Ã‚Â¡ginas responsivas (HTML5 semÃƒÆ’Ã‚Â¢ntico, CSS embutido, favicon do urso), com rodapÃƒÆ’Ã‚Â©
    de verificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para plataformas e contato do desenvolvedor.
  - Pasta `legal/` incluÃƒÆ’Ã‚Â­da no pacote NPM (`files`).

## [0.1.02] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-10-24

### Corrigido

- **PoluiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do terminal por logs de polling** (`GET /api/metrics`):
  - Launcher (`scripts/cli.mjs`) e `npm run dev` iniciam o uvicorn com
    `--no-access-log`.
  - Filtro granular de logging no backend silencia o access-log **apenas** de
    `/api/metrics` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â erros, exceÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes e os demais endpoints continuam logados
    normalmente (vale tambÃƒÆ’Ã‚Â©m para execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes manuais do uvicorn).
  - Painel migrado para **TanStack Query** (`@tanstack/react-query`,
    `refetchInterval` de 10s): ciclo de vida e cleanup automÃƒÆ’Ã‚Â¡ticos, pausa
    quando a aba fica ociosa e retoma ao focar; indicador "atualiza a cada
    10s" visÃƒÆ’Ã‚Â­vel nos blocos de grÃƒÆ’Ã‚Â¡ficos.
  - Polling de campanhas (Disparos) tambÃƒÆ’Ã‚Â©m via TanStack Query: sonda a cada
    4s apenas enquanto existe campanha em andamento, sem `setInterval` manual.
  - Verificado: nenhum outro endpoint ÃƒÆ’Ã‚Â© alvo de polling ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â `/api/config` e
    demais chamadas sÃƒÆ’Ã‚Â£o carregamentos pontuais no inÃƒÆ’Ã‚Â­cio da pÃƒÆ’Ã‚Â¡gina.

### Alterado

- **O sistema nunca abre o navegador.** Removida a abertura automÃƒÆ’Ã‚Â¡tica de janela do
  launcher ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o LeadMaster apenas imprime a URL no terminal e quem abre ÃƒÆ’Ã‚Â© o usuÃƒÆ’Ã‚Â¡rio.

## [0.1.01] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-10-23

### Removido

- **Pipeline de vÃƒÆ’Ã‚Â­deos faceless** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â o LeadMaster agora ÃƒÆ’Ã‚Â© 100% focado em prospecÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
  (CRM, extratores de leads e agentes de IA). Removidos:
  - Aba lateral "Pipeline de VÃƒÆ’Ã‚Â­deos", pÃƒÆ’Ã‚Â¡gina e rota `/pipeline`.
  - IntegraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes com MoneyPrinterTurbo, Short-Video-Maker, OpenMontage e upload para
    YouTube: serviÃƒÆ’Ã‚Â§os backend, endpoints `/api/pipeline`, cards e testes em
    Ferramentas, menÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes no Painel, tutorial do header, FAQ do Suporte e
    diagnÃƒÆ’Ã‚Â³stico.
  - Motor do pipeline, agendador de publicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o e contadores diÃƒÆ’Ã‚Â¡rios de upload.
  - `pipeline.json` do armazenamento local ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â removido automaticamente das
    instalaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes existentes, junto com as chaves de vÃƒÆ’Ã‚Â­deo do `config.json`
    (`integracoes.moneyprinter`, `short_video_maker`, `openmontage`,
    `youtube_upload`, `uploads`) e o evento de webhook `video.publicado`.

### Adicionado

- MigraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o automÃƒÆ’Ã‚Â¡tica de configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o: chaves de vÃƒÆ’Ã‚Â­deo de versÃƒÆ’Ã‚Âµes antigas sÃƒÆ’Ã‚Â£o
  limpas na primeira execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o da nova versÃƒÆ’Ã‚Â£o.
- Card "Status da ConexÃƒÆ’Ã‚Â£o" do Painel passa a mostrar LLM e OpenOutreach.

### Alterado

- Backend de desenvolvimento (uvicorn) agora usa a porta **8010** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a 8000 costuma
  ser usada por outros serviÃƒÆ’Ã‚Â§os locais (ex.: PandaNews), o que causava conflito.

## [0.1.00] ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 2026-10-23

### Adicionado

- **VersÃƒÆ’Ã‚Â£o inicial do LeadMaster** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â SaaS local de prospecÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o e automaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de conteÃƒÆ’Ã‚Âºdo,
  instalÃƒÆ’Ã‚Â¡vel via `npx @danhachuel/leadmaster` e 100% offline (sem nuvem).
- **Launcher NPM** (`scripts/cli.mjs`): comandos `install`, `start`, `doctor`, `version`,
  `help`; **comando ÃƒÆ’Ã‚Âºnico auto-suficiente** (estilo Thunderbolt) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â `npx
  @danhachuel/leadmaster` sem argumentos verifica e prepara tudo sozinho antes de subir;
  **instalaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o idempotente** (dependÃƒÆ’Ã‚Âªncias Python e Node sÃƒÆ’Ã‚Â³ sÃƒÆ’Ã‚Â£o instaladas/atualizadas
  quando realmente faltam; interface sÃƒÆ’Ã‚Â³ ÃƒÆ’Ã‚Â© reconstruÃƒÆ’Ã‚Â­da quando o build nÃƒÆ’Ã‚Â£o existe ou
  falha por deps desatualizadas); resoluÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o da pasta de dados (`--home` /
  `LEADMASTER_HOME`, padrÃƒÆ’Ã‚Â£o `Documents/REPOSITORIO/LeadMaster`); instalaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o automÃƒÆ’Ã‚Â¡tica
  das dependÃƒÆ’Ã‚Âªncias Python; porta padrÃƒÆ’Ã‚Â£o da UI/API **5055** com auto-incremento (5056,
  5057, ...) quando ocupada; deteÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de instÃƒÆ’Ã‚Â¢ncia jÃƒÆ’Ã‚Â¡ ativa; abertura automÃƒÆ’Ã‚Â¡tica do
  navegador; encerramento limpo.
- **Workflow de publicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o** (`.github/workflows/publish-npm.yml`): build do frontend,
  validaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de metadados, smoke-test do launcher, publicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o via `dist-tag next`,
  verificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de tarball e promoÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o a `latest` por tag `v*`.
- **Backend FastAPI** (`backend/`):
  - PersistÃƒÆ’Ã‚Âªncia local em JSON (`storage/leads.json`, `campaigns.json`, `pipeline.json`,
    `config.json`) com escrita atÃƒÆ’Ã‚Â´mica e seeds automÃƒÆ’Ã‚Â¡ticas.
  - CRUD de leads com importaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o em massa, agente de CRM (sugestÃƒÆ’Ã‚Â£o de movimentaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o e
    enriquecimento via BrasilAPI/LLM).
  - Campanhas de disparo com execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o em background, contadores e log por lead.
  - Motor do pipeline de vÃƒÆ’Ã‚Â­deos faceless com 5 etapas (roteiro, thumbnail/tÃƒÆ’Ã‚Â­tulo,
    produÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o wide 16:9, produÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o shorts 9:16, upload), controle
    iniciar/pausar/parar/repetir, logs por etapa e agendamento de publicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
    (nÃƒÆ’Ã‚Â£o listado ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ 1h ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ pÃƒÆ’Ã‚Âºblico).
  - IntegraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes: MoneyPrinterTurbo (localhost:8080), Short-Video-Maker (localhost:3123),
    OpenMontage (CLI), upload YouTube com limite de 50/dia e fallback
    `youtube-uploader-mcp`, LLM OpenAI-compatÃƒÆ’Ã‚Â­vel, OpenOutreach, pipecat.
  - Extratores de leads: Google Maps (`gosom/google-maps-scraper`), Instagram
    (`lucasoal/igmapper`), CNPJ (BrasilAPI + provedor de busca por CNAE/UF +
    `D4Vinci/Scrapling`).
  - Endpoints de diagnÃƒÆ’Ã‚Â³stico (`/api/health`, `/api/doctor`), mÃƒÆ’Ã‚Â©tricas do painel e
    serving estÃƒÆ’Ã‚Â¡tico da UI construÃƒÆ’Ã‚Â­da (modo `npx`).
- **Frontend React 18 + Vite + TypeScript + Tailwind** (`frontend/`):
  - UI fiel ao protÃƒÆ’Ã‚Â³tipo `LeadMaster v1.0` (sidebar `#1e1b4b`, cards brancos, gradientes
    indigo/purple, Font Awesome) com as 7 Leis de UX aplicadas; **favicon de urso** nas
    guias dos navegadores (`frontend/public/favicon.svg`).
  - PÃƒÆ’Ã‚Â¡ginas: Painel (mÃƒÆ’Ã‚Â©tricas + grÃƒÆ’Ã‚Â¡ficos Chart.js), Leads (CRUD + progresso de
    preenchimento), CRM Kanban (`@dnd-kit` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Leads/Em contato/Proposta/Fechado),
    Disparos (campanhas), Extratores (Google Maps/Instagram/CNPJ), Pipeline de vÃƒÆ’Ã‚Â­deos,
    Agentes (disparo/atendimento), Ferramentas (configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de chaves e caminhos),
    Webhook e Suporte (diagnÃƒÆ’Ã‚Â³stico).
  - Componentes: Sidebar, Header, MetricCard, ProgressBar, Accordion, Modal, Toast,
    StatusBadge, grÃƒÆ’Ã‚Â¡ficos (barras horizontais e doughnut) e Kanban com drag-and-drop.
- **DocumentaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o**: `README.md` (instalaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, arquitetura, integraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes), `AGENTS.md`
  (regras de projeto, versionamento `MAJOR.MINOR.PATCH` com patch de dois dÃƒÆ’Ã‚Â­gitos,
  release via GitHub Actions, push obrigatÃƒÆ’Ã‚Â³rio, CHANGELOG obrigatÃƒÆ’Ã‚Â³rio) e `LICENSE` (MIT).
