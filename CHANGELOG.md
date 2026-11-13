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

## [0.1.38] — 2026-11-12

### Adicionado

- **Modo claro/escuro (tema light/dark — padrão ProdMaker):**
  - Hook `frontend/src/hooks/useTheme.ts`: estado `'light' | 'dark'` (padrão
    **dark**, mantendo a identidade atual), persistência em
    `localStorage` (`leadmaster_theme`), aplicação via
    `document.documentElement.setAttribute('data-theme', theme)` e
    `toggleTheme()`.
  - **Botão de alternância no Header** (canto superior direito, ao lado do
    nome do usuário): ícone **sol** quando escuro (ação: clarear) e **lua**
    quando claro (ação: escurecer), com `aria-label`/`title`
    ("Alternar para tema claro/escuro") e hover suave.
  - **Variáveis CSS** em `index.css` (`--bg-primary`, `--bg-secondary`,
    `--text-primary`, `--text-secondary`, `--border-color`,
    `--bg-tertiary`, `--text-muted`, `--sidebar-bg`) com seletores
    `[data-theme='dark']` e `[data-theme='light']`:
    dark = slate-900/slate-800/slate-100; light = slate-50/branco/slate-900.
  - **Camada de remapeamento** (especificidade `main ...`, vence as utilities
    sem quebrar a sidebar — que é sempre escura por identidade): `bg-white`,
    `bg-gray-50/100`, `text-gray-*` e `border-gray-*` passam a seguir as
    variáveis nos dois temas. Cores semânticas (indigo/red/green/amber/blue)
    ficam de fora: badges e alertas mantêm o significado.
  - Componentes raiz migrados para as variáveis: Header, Sidebar, MetricCard,
    Modal, Accordion, ProgressBar; scrollbar e rodapés escuros ajustados.
- **Gate de regressão** (`backend/tests/test_ui_theme.py`): falha se o hook,
    o botão do Header, as variáveis CSS ou a camada de remapeamento
    desaparecerem. Suíte: **127 passed**.

## [0.1.37] — 2026-11-12

### Adicionado

- **Cadências de Follow-up (reengajamento automático):**
  - Storage `cadences.json` com `[{"id", "nome", "etapa_gatilho", "dias_espera",
    "acao", "ativo", "ultimas_execucoes"}]`; `config.json → cadencias.intervalo_horas`
    define a frequência do worker (padrão 1h).
  - Worker em background (`asyncio.create_task` no lifespan do FastAPI,
    `services/cadence.py`): a cada hora verifica os leads parados na etapa
    gatilho além dos `dias_espera` (usando `atualizado_em`) e aplica a ação
    — **mover_para_proposta**, **mover_para_em_contato** ou **adicionar_tag_frio**
    — registrando a execução na cadência e disparando o webhook
    `cadencia.executada`. O worker é resiliente (nunca derruba a API) e a
    verificação pode ser forçada pela rota.
  - Rotas: `GET/POST /api/cadences`, `PUT/DELETE /api/cadences/{id}` (validações:
    dias ≥ 1, etapa gatilho e ação válidas; 404 para inexistentes) +
    `POST /api/cadences/verificar` (execução imediata).
  - Frontend: página `/cadencias` (menu lateral "Cadências" em Gestão) com
    tabela (Nome, Etapa Gatilho, Dias, Ação, Status), última execução por
    cadência, botão **"Nova Cadência"** em gradiente (von Restorff), modal com
    **no máximo 4 campos** (Lei de Hick), toggle ativo/inativo com cores
    contrastantes (verde/vermelho) e **ícone de relógio pulsante** nas
    cadências ativas (Zeigarnik). Prevenção de erros: dias ≤ 0 bloqueia com
    borda vermelha + mensagem; nome vazio bloqueia.
- **10 novos testes pytest** (`backend/tests/test_cadences.py`): CRUD completo
  (criar/editar/remover/404), validações (dias 0 → 422, dia negativo → 400,
  ação/etapa inválidas → 400) e worker (lead antigo movido, lead recente
  preservado, cadência inativa não executa, ação de tag). Suíte: **123 passed**.

## [0.1.36] — 2026-11-12

### Alterado (correção de regressão)

- **Launcher de volta ao terminal (foreground com `readline`):** o modelo
  descartável da 0.1.33 liberava o terminal — o usuário quer o terminal preso
  vendo os logs, encerrando só no **Ctrl+C**. Agora:
  - o worker nasce com **`stdio: 'inherit'`** — logs do FastAPI em tempo real
    no terminal (adeu `stdio: ['ignore', logFd, logFd]`);
  - **`child.unref()` removido**; o launcher fica preso por
    `readline.createInterface({ input: process.stdin, output: process.stdout })`
    — **sem** `setInterval`/`stdin.resume()`/dummy server/`beforeExit`
    (esses foram justamente o que falhou no MobaXterm);
  - `rl.on('SIGINT')` captura o Ctrl+C de forma limpa: mata o worker por
    código (`matarArvoreProcesso`, com `taskkill /T /F` no Windows), remove o
    lock e sai — mensagem final ensina "Logs em tempo real abaixo; Ctrl+C
    encerra"; `SIGTERM`/`SIGBREAK` seguem como paradas legítimas;
  - `process.exit(0)` do fim do start **removido** (o terminal só volta pelo
    Ctrl+C ou por erro acionável).
- **Comando `kill`/`stop` mantido** para o caso de a janela do terminal ser
  fechada (o worker, em grupo isolado, sobrevive) — lock global continua.
- **AGENTS.md:** seção 🚨 REGRA INVIOLÁVEL reescrita para o modelo foreground
  (stdio inherit, readline, Ctrl+C limpo, proibição de keep-alives e unref).
- **Gates** (`test_launcher_protections.py`): exigem `stdio: 'inherit'`,
  `readline.createInterface` e handler SIGINT dentro do `cmdStart`; falham se
  keep-alives proibidos, `child.unref()` ou `process.exit(` no caminho de
  sucesso voltarem.

### Adicionado

- **Relatórios (Analytics):**
  - Rota **`GET /api/reports`**: consolidado de `campaigns.json` — resumo
    (campanhas, enviadas, erros, **taxa de sucesso**, ativas, concluídas),
    volume **por campanha** e **por dia** (agregado dos eventos).
  - Página **`frontend/src/pages/Relatorios.tsx`** (rota `/relatorios`, menu
    Gestão): cards **Total Enviado / Total de Erros / Taxa de Sucesso Geral**
    (Lei de Miller), **gráfico de barras** enviadas × erros por campanha
    (Chart.js) e **tabela de histórico** (nome, iniciada, concluída,
    enviados, erros, status) + zero states e auto-refresh a cada 10s enquanto
    houver campanha ativa.
  - **3 novos testes pytest** (`backend/tests/test_reports.py`): base vazia,
    consolidação de campanhas e agregação por dia. Suíte: **113 passed**.

## [0.1.35] — 2026-11-10

### Adicionado

- **Tags e Lead Scoring (qualificação no CRM):**
  - `PUT /api/crm/leads/{id}` agora aceita **`tags`** (lista) e **`score`** (inteiro
    0–5); score fora do intervalo ou tags em formato inválido → **400**.
  - `GET /api/crm/leads?tag=<nome>` filtra apenas leads com a tag informada.
  - **Card do Kanban:** tags como badges coloridos abaixo do nome (cores
    vibrantes para **Quente** — vermelho, **Urgente** — laranja, **Morno** — âmbar,
    **Frio** — azul; demais em indigo — von Restorff) e **estrelas do score**
    (preenchidas/vazias) no canto superior direito.
  - **Modal de detalhes:** campo "Nova Tag" + botão **"+"**, tags existentes com
    **"X"** para remover (auto-save imediato) e **estrelas 1–5 clicáveis e
    grandes** (Lei de Fitts) para o score — clicar de novo na mesma estrela
    zera; "limpar" disponível; erro no salvamento reverte com toast.
  - **Dropdown de filtro por tag** ao lado da barra de busca (todas as tags da
    base, ordenadas), combinando com a busca textual instantânea.
- **6 novos testes pytest** (`backend/tests/test_tags_score.py`): persistência de
  tags e score, score inválido (400), tags em formato inválido (400), filtro por
  tag e filtro sem resultados. Suíte completa: **109 passed**.

## [0.1.34] — 2026-11-10

### Adicionado

- **Conexões — ajuste fino do gateway WhatsApp:**
  - **Instruções passo a passo** em accordion (Lei de Hick) quando desconectado:
    subir o OpenWA/WAHA (ex.: `docker run -p 2785:2785 openwa`), informar URL e
    API Key em Ferramentas, clicar em "Conectar WhatsApp" e escanear o QR.
  - **QR Code em moldura branca com margem** (leitura pela câmera) +
    **contador regressivo de validade** e barra de progresso do refresh
    (Zeigarnik); a imagem é renovada a cada 10s enquanto o modal está aberto.
  - **Botão verde "Enviar Mensagem de Teste"** (von Restorff) quando conectado:
    mini-modal com número (com DDD) e mensagem, enviando pela nova rota
    `POST /api/whatsapp/test-send` — valida o gateway de ponta a ponta.
  - **Prevenção de erros:** gateway offline (503) na conexão ou no teste exibe
    **Prevenção de erros:** gateway offline (503) na conexão ou no teste exibe
    toast *"Gateway do WhatsApp não encontrado. Verifique se o OpenWA está
    rodando."* — o card de status também passa a mostrar essa orientação.
- **3 novos testes pytest** (`test_whatsapp_gateway.py`): rota de teste de envio
  (payload `chatId` + rota `send-text`), gateway offline no teste (503 com a URL)
  e simulação do worker preservada. Suíte completa: **103 passed**.

## [0.1.33] — 2026-11-10

### Alterado (refatoração críticâ de arquitetura)

- **Launcher descartável + servidor autônomo (arquitetura PandaNews):** o
  encerramento silencioso no MobaXterm estava residindo no modelo anterior, que
  mantinha o Node vivo amarrado ao terminal (`stdin.resume`, `setInterval`,
  dummy server, `await new Promise`) e vinculava a morte do Node à do Python.
  Agora:
  - o worker nasce com **`stdio: ['ignore', logFd, logFd]`** — saída em
    `<home>/storage/logs/backend.log`, **nunca pipes no terminal**;
  - **`child.unref()`** logo após o spawn: o event loop do launcher não depende
    do filho; removidos `child.on('exit')`/`close`, `process.on('exit')` e
    **todos** os keep-alives;
  - o launcher grava o **lock global `<home>/leadmaster.pid`**
    (`{pid, porta, versao, iniciado_em}`), imprime o sucesso e chama
    `process.exit(0)` — **o prompt volta e o servidor continua no ar**;
  - novo comando **`kill`** (alias `stop`): lê o lock, mata a árvore
    (`taskkill /F /T /PID` no Windows / `kill -9` no Unix), roda a rede de
    segurança por porta, remove o lock e imprime "Servidor encerrado com
    sucesso";
  - mensagem final do `start`: *"LeadMaster rodando em background na porta
    5055. Para encerrar, use: npx --yes @danhachuel/leadmaster@<versão> kill"*;
  - `doctor` mostra o lock do servidor; `help` documenta o novo comando.
- **Frontend:** Dashboard exibe aviso do modelo background + comando `kill` —
  fechar o terminal não derruba mais o app.
- **AGENTS.md:** seção 🚨 REGRA INVIOLÁVEL reescrita para a nova arquitetura
  (spawn destacado com stdio em arquivo, launcher descartável, lock file,
  comando kill, higiene e guarda da consola).
- **Gate de regressão reescrito** (`test_launcher_protections.py`): falha se
  `child.unref()`, `stdio: ['ignore', logFd, logFd]`, o lock ou o comando
  `kill` desaparecerem; falha se qualquer keep-alive proibido
  (`stdin.resume`/`setInterval`/`http.createServer`/`await new Promise`) ou
  vínculo de morte voltar. Suíte: **95 passed**.

## [0.1.32] — 2026-11-10

### Adicionado

- **Gateway WhatsApp (OpenWA padrão, WAHA opcional) — disparos reais:**
  - Config (Ferramentas → WhatsApp): `gateway_type` (openwa/waha),
    `gateway_url` (padrão `http://127.0.0.1:2785`), API Key (`X-API-Key`),
    `session_id` e toggle **"Usar gateway real"** — sem o toggle, os disparos
    seguem simulados (comportamento padrão preservado).
  - Serviço `backend/services/whatsapp.py`: status (`conectado` /
    `aguardando_qr` / `desconectado`), início de sessão, repasse do QR Code e
    envio de texto (`chatId` no formato `5511999999999@c.us`), com as rotas do
    OpenWA e as equivalentes do WAHA (`/api/sendText`).
  - Rotas: `GET /api/whatsapp/status` (503 acionável com o gateway fora),
    `POST /api/whatsapp/sessions/start` e `GET /api/whatsapp/qr` (repassa a
    imagem do gateway).
  - **Worker de disparos** (`processar_campanha_em_background`): com gateway
    ativo, envia de verdade pelo gateway; falha do gateway conta como erro do
    lead (com log) e **nunca trava a campanha**. Sem gateway → simulação
    mantida.
  - Frontend: nova página **`/conexoes`** (menu lateral "Conexões"): card do
    WhatsApp com **polling de 5s** (TanStack Query), botão grande **"Conectar
    WhatsApp"** (Fitts), modal com QR Code + spinner *"Aguardando leitura do
    celular..."* (Zeigarnik), badge verde esmeralda com pulso quando conectado
    (von Restorff) e número da conta. Em **Disparos**, ativar campanha sem
    WhatsApp conectado é **bloqueado** com toast *"Conecte o WhatsApp na aba
    Conexões antes de disparar."* (prevenção de erros).
- **10 novos testes pytest** (`backend/tests/test_whatsapp_gateway.py`):
  status conectado / aguardando QR / gateway offline (503) / QR repassado,
  worker enviando pelo gateway (payload com chatId e mensagem renderizada),
  worker com falha do gateway (3 erros, campanha concluída sem travar) e
  simulação preservada sem gateway.

## [0.1.31] — 2026-11-10

### Adicionado

- **Geração de mensagens com IA nos Disparos:**
  - Rota `POST /api/campaigns/generate-message` (`nicho`, `tom`) — usa
    `services/llm.py` (`gerar_template_prospeccao`) para escrever um template de
    prospecção; o prompt **obriga** as variáveis `{nome}` e `{empresa}`. Sem LLM
    configurada → **400** com mensagem acionável; erro da LLM → **500** com o
    detalhe (nunca finge sucesso).
  - Worker (`agents.render_template`) passa a substituir **também a chave
    simples** (`{nome}`, `{empresa}`, `{telefone}`, `{cidade}`...) além da
    `{{chave}}` — chaves mais longas primeiro, sem substituição parcial. O
    worker de disparos já usava `render_template` antes de simular o envio;
    agora os templates gerados pela IA funcionam sem edição manual.
  - Frontend (`Disparos.tsx`): campo **"Nicho do Público"** + botão secundário
    **"Gerar com IA"** (ícone de varinha, roxo — von Restorff) ao lado do
    textarea; **spinner** enquanto gera (Zeigarnik); toast de sucesso
    *"Template gerado pela IA! Lembre-se de usar {nome} e {empresa}."*; LLM sem
    chave → toast *"Configure a API Key na aba Ferramentas primeiro."*
    (prevenção de erros).
- **5 novos testes pytest** (`backend/tests/test_campaign_message.py`): geração
  com LLM mockada (template contém as variáveis), 400 sem LLM,
  `render_template` chave simples e dupla, e o **worker substituindo as
  variáveis** antes do envio (evento gravado com o nome real do lead).

## [0.1.30] — 2026-11-10

### Adicionado

- **Suporte — chat de teste do Agente de Atendimento (LLM):**
  - Rota **`POST /api/agents/chat`** (`{"message": "..."}`): monta o contexto com
    o **prompt do sistema do agente** (`agents.json → atendimento.prompt`,
    editável em Agentes) + **histórico salvo** + a mensagem nova, chama a LLM
    OpenAI-compatível já existente (`services/llm.py`) e devolve a resposta.
    Sem API Key → **400 acionável** ("Ferramentas → LLM..."); mensagem só com
    espaços → **400** (prevenção de erros — Nielsen).
  - **Histórico persistente** (`chat_history.json`, últimas 200 mensagens):
    `GET /api/agents/chat/history` restaura a conversa ao recarregar a página e
    `DELETE /api/agents/chat/history` limpa. A resposta do assistante só entra
    no histórico quando a chamada à LLM dá certo.
  - `frontend/src/pages/Suporte.tsx` reescrita com o **chat no topo**: balões
    do usuário à direita em gradiente indigo/purple e do agente à esquerda em
    cinza (von Restorff), indicador **"digitando..."** com três pontinhos
    animados enquanto a LLM pensa (Zeigarnik), **auto-scroll** para a última
    mensagem, campo largo + botão-avião com **Enter para enviar** (Fitts) e
    bloqueio de mensagem vazia. Diagnóstico do ambiente e FAQ preservados
    abaixo (FAQ ganhou as perguntas do chat).
- **6 novos testes pytest** (`backend/tests/test_chat_suporte.py`) com a LLM
  mockada (zero tokens no CI): mensagem vazia → 400, sem chave → 400
  acionável, resposta + histórico persistidos, contexto (system + histórico +
  nova mensagem) conferido, limpar histórico e falha da LLM não gravando
  resposta falsa. Suíte completa: **94 passed**.

## [0.1.29] — 2026-11-09

### Adicionado

- **Motor de disparos em background (`agents.processar_campanha_em_background`)** —
  ativar uma campanha agora executa de verdade (simulação de envio):
  - Rota `PUT /api/campaigns/{id}/status` com `"status": "ativa"` muda o status
    para `em_andamento` e dispara o worker via **FastAPI `BackgroundTasks`** — a
    resposta volta na hora, os envios sobem depois em `campaigns.json`.
  - O worker percorre os `lead_ids` (filtro por etapa já aplicado na criação),
    com `asyncio.sleep(1)` entre envios (tempo real de visualização na UI) e
    **1 erro simulado a cada 10** leads; grava contadores e eventos a cada ciclo
    via `storage.upsert_campaign` (lock de threading + escrita atômica).
  - **Pausa no meio:** o registro é RELIDO do storage a cada ciclo e os
    contadores fazem merge sobre a cópia fresca — pausar/parar (ou uma pausa
    gravada durante o `sleep`) nunca é sobrescrita; o loop para no ciclo
    seguinte. Reativar uma **concluída** zera os contadores (nova rodada);
    reativar uma **pausada** continua de onde parou (leads já enviados são
    pulados). Ao final, status → `concluida` (+ webhook `campanha.concluida`).
- **Frontend Disparos:** polling baixado de 4s → **2s** (barra de progresso
  acompanha os contadores em tempo real), bloco de campanha ativa ganhou selo
  **"Processando..."**, contagem de restantes e barra mais destacada
  (Zeigarnik); **Pausar/Iniciar agora é otimista** — a UI atualiza
  instantaneamente e o próximo polling reverte se o backend falhar.
- **5 novos testes pytest** (`backend/tests/test_disparos_worker.py`): worker
  processa e conclui (contadores exatos, 1 erro a cada 10), **pausa gravada
  durante o `sleep` interrompe o loop** (corrida tratada — pegou e fixou um bug
  real onde o upsert sobrescrevia a pausa), retomada não reenvia, rota "ativa"
  dispara o background e rota "pausada" não dispara. Suíte: **88 passed**.

## [0.1.28] — 2026-11-09

### Corrigido

- **Renumeração por colisão (E409):** a `0.1.27` já estava staged no registry
  (sessão paralela), então esta versão republica o estado atual do `main` —
  keep-alive do launcher com **Dummy Server** (`http.createServer` +
  `listen(0, '127.0.0.1')` + `await new Promise(() => {})`, camada principal;
  `stdin.resume`/`setInterval`/`beforeExit` secundárias) e os **gates de
  regressão** correspondentes. Suíte: **83 passed**.

## [0.1.27] — 2026-11-09

### Corrigido (crítico)

- **Launcher — Dummy Server (keep-alive infalível):** as versões anteriores
  dependiam de `stdin`/timers; quando o MobaXterm fecha a entrada padrão em EOF
  (perda de foco/variação de PTY), o event loop do Node esvaziava e o prompt
  voltava logo após "LeadMaster no ar", derrubando o uvicorn junto. Agora o
  `cmdStart` cria, **logo após o spawn do Python**, um servidor HTTP inativo
  (`http.createServer` + `keepAliveServer.listen(0, '127.0.0.1')`) — o socket
  aberto no sistema operacional segura o processo **independentemente do
  terminal**; o fluxo principal termina em `await new Promise(() => {})`
  (congelado para sempre) e `stdin.resume`/`setInterval`/`beforeExit` seguem
  como camadas secundárias. **Testado ao vivo com stdin em EOF (`< NUL`):**
  node vivo 1min46s+, health 200, exportação CSV 200 no ar, encerramento
  limpo, zero órfãos.
- **AGENTS.md:** regra 1 do launcher passa a ser o Dummy Server (camada
  principal); regra 2 rebaixa stdin/timers a camadas secundárias.
- **Gates de regressão reforçados** (`test_launcher_protections.py`): falham se
  `http.createServer`, `keepAliveServer.listen(0, '127.0.0.1')` ou
  `await new Promise(() => {})` desaparecerem do corpo do `cmdStart`.
  Suíte completa: **83 passed**.

## [0.1.26] — 2026-11-09

### Adicionado

- **Busca no CRM e exportação CSV** (registro retro-ativo — publicada sem
  entrada anterior):
  - `GET /api/crm/leads/export`: CSV de todos os leads com **BOM UTF-8**
    (`\ufeff`, Excel em português não quebra acentos), delimitador `;`,
    `text/csv; charset=utf-8` e
    `Content-Disposition: attachment; filename="leads_leadmaster.csv"`; campos
    de `extras` **achatados** como colunas `extras_<chave>` e listas (tags) em
    células separadas por `; `.
  - Frontend: **barra de busca larga** no CRM com filtragem local instantânea
    por **Nome, Telefone ou Email** + botão de limpar (Lei de Fitts); botão
    **"Exportar CSV"** em estilo **neutro/outline** — não compete com o
    "Adicionar Lead" em gradiente (von Restorff); busca sem resultados mostra
    *"Nenhum lead encontrado para '...'"* (Zeigarnik).
  - **Corrigido:** o modelo `LeadIn` descartava o campo `extras` — leads
    criados manualmente perdiam site/avaliação. Agora o POST preserva
    `extras` (`LeadIn.extras: dict`).
  - **3 novos testes pytest** (`backend/tests/test_leads_export.py`): MIME +
    disposition + BOM + colunas, achatamento de `extras` e exportação de base
    vazia (só cabeçalho).

## [0.1.25] — 2026-11-09

### Adicionado

- **Modal de Detalhes do Lead no CRM (clique no card):**
  - Rota `PUT /api/crm/leads/{lead_id}` — edição de `nome`, `telefone` e `email`
    (todos opcionais no payload); nome vazio → **400** (prevenção de erros),
    lead inexistente → **404**, payload sem campos editáveis → **400**.
  - Card do Kanban passa a abrir os detalhes no **clique simples** (antes era
    duplo clique); flag global suprime o clique disparado no pointerup após um
    drag, então abrir detalhes e arrastar convivem sem conflito.
  - Modal "Detalhes do Lead" exibe **todos os dados** — inclusive `extras`
    (Site, Endereço, Avaliação, Seguidores, Username, Bio), tags, fonte e data
    de criação — com **inputs de edição** para Nome/Telefone/E-mail pré-preenchidos
    (vermelho + mensagem se o nome for apagado), textarea de observações e botão
    **"Salvar Alterações"** grande em gradiente (Fitts + von Restorff), com
    **spinner** durante o salvamento (Zeigarnik), toast de sucesso e
    **atualização automática** do Kanban. O "Fechar" (X) permanece sutil.
- **5 novos testes pytest** (`backend/tests/test_lead_edit_routes.py`): edição
  completa, edição parcial (campos omitidos preservados), 404, nome vazio (400)
  e payload sem campos editáveis (400).

## [0.1.24] — 2026-11-09

### Corrigido

- **Launcher — regressão do terminal preso investigada e blindagem reforçada** —
   usuário reportou o prompt do MobaXterm voltando logo após "LeadMaster no ar"
   na 0.1.21 (runtime permanente). A investigação mostrou que o fluxo publicado
   **mantém** as proteções (`process.stdin.resume();`, `setInterval`,
   `child.on('exit')`/`close`, `process.on('exit')`, sem `.unref()`) e que uma
   morte silenciosa assim — sem nenhum log do handler de saída — só ocorre por
   `SIGKILL`/`taskkill /F` (ex.: outra execução `install`/`start` matando a
   instância anterior pelo kill switch, ou fechamento forçado da aba). Mesmo
   assim, o launcher foi reforçado e os gates agora validam o **fluxo**:
   - **Rede de segurança no `cmdStart`:** `process.on('beforeExit')` re-arma o
     `setInterval` se o event loop esvaziar (stdin em EOF, timer perdido,
     surpresa de PTY) — o Node jamais encerra sozinho; erros do stream de
     stdin (`process.stdin.on('error')`) são ignorados;
   - **Gates de fluxo (`test_launcher_protections.py`):** novo helper
     `_corpo_cmd_start()` extrai o corpo da função para garantir que
     `spawn`, `process.stdin.resume();`, `setInterval`, `child.on('exit')`,
     `child.on('close')`, `process.on('exit')` e `beforeExit` existam **dentro
     do `start`** (não no `install` nem em função morta) e que **nenhum
     `process.exit(`** apareça após o terminal ser preso — a saída só por ciclo
     de vida do filho ou por `SIGTERM`/`SIGBREAK`;
   - **AGENTS.md:** regra 2 do launcher documenta a rede de segurança e a
     exigência de posição (após o spawn, no fluxo do start).
- **Diagnóstico rápido para o usuário:** com a regra acima, se o prompt voltar
  sem as linhas "Encerrando LeadMaster..." (SIGTERM/SIGBREAK) ou "Servidor
  local encerrou com código N" (Python caiu), a causa é externa ao launcher
  (outra execução ou fechamento forçado) — o espelho
  `storage/logs/launcher_console.log` mostra exatamente qual caminho ocorreu.

## [0.1.23] — 2026-11-09

### Adicionado

- **Extratores conectados de verdade (fim da dependência de mock quando
  configurado):**
  - **Google Maps:** executa o binário real (`gosom/google-maps-scraper`) com as
    flags de isolamento (`creationflags`, sem janelas de CMD) e **timeout de
    segurança configurável** (`timeout_maps_segundos`, padrão 300s).
  - **Instagram:** passa **URL + limite** ao CLI (`igmapper_args` agora inclui
    `{limit}`) com timeout configurável (`timeout_instagram_segundos`, padrão
    120s).
  - **CNPJ:** URL base da **BrasilAPI** vem do `config.json`
    (`cnpj_api_url`) — permite trocar o provedor sem alterar código.
  - **Regra de erro:** scraper **configurado** que falha (código ≠ 0, timeout,
    executável inválido) retorna **HTTP 500 com mensagem clara** e **não salva
    nada** (sem mock disfarçado, sem dados parciais). Sem scraper configurado,
    o modo mock segue protegendo os primeiros testes.
  - Ferramentas → Extratores ganhou os campos **URL base da BrasilAPI** e
    **timeouts de segurança** (Maps/Instagram).
- **4 novos testes pytest** (`backend/tests/test_extractors_real.py`): scraper
  configurado falhando → 500 sem salvar, timeout → 500 "Timeout na extração",
  falha do igmapper → 500 sem salvar, e mock preservado sem configuração.

## [0.1.22] — 2026-11-09

### Adicionado

- **Funil de Prospecção (visão macro de conversão):**
  - Rota `GET /api/funnel`: conta os leads por etapa do CRM (`Leads → Em
    Contato → Proposta → Fechado`), calcula a taxa de conversão de cada
    transição (`para/de × 100`, 1 decimal) e a queda percentual, e identifica
    o **gargalo** — a etapa *origem* da maior queda (onde os leads param).
    Resposta: `{etapas, conversoes, gargalo}`.
  - Página `frontend/src/pages/Funil.tsx` (rota `/funil`, link **"Funil de
    Prospecção"** no menu): **funil em CSS puro** com fatias de largura
    decrescente (nome + quantidade por etapa), **cards de conversão** por
    transição (verde ≥50%, âmbar ≥25%, vermelho abaixo), **alerta de gargalo**
    em vermelho/laranja com "⚠️ Gargalo: muitos leads param em 'X'" e fatia
    do gargalo destacada (von Restorff), zero filtros na tela (Lei de Hick) e
    funil vazio com barra zerada + "Comece a prospectar para ver seu funil"
    (Zeigarnik). Acesso aos dados via `api.funil()` no cliente padronizado.
- **4 novos testes pytest** (`backend/tests/test_funnel_routes.py`):
  conversões + gargalo com distribuição [10,5,2,1] (taxas 50/40/50 → gargalo
    "Em Contato"), gargalo na primeira etapa, funil vazio (taxas `null`,
    gargalo `null`) e funil sem gargalo (quedas zero).

## [0.1.21] — 2026-11-09

### Adicionado

- **Módulo de Webhooks revisado conforme especificação:**
  - `GET /api/webhook` agora retorna também **`ultimo_teste`** (registrado a cada
    teste bem-sucedido no `config.json`).
  - `PUT /api/webhook` e `POST /api/webhook/test` **validam a URL**: só
    `http://`/`https://` são aceitos (400 com mensagem acionável).
  - Novo evento **`campanha.iniciada`** — disparado quando uma campanha começa a
    rodar; migração aditiva garante que ele apareça nas configurações existentes.
  - Frontend `frontend/src/pages/Webhook.tsx` reformulado: eventos exibidos
    diretamente e limpos (**Lead Criado**, **Campanha Iniciada**, **Campanha
    Finalizada** — Lei de Hick), **prevenção de erros** (Nielsen): URL fora do
    padrão http(s) bloqueia o salvamento e marca o input com **borda vermelha**,
    botão **"Salvar Configurações"** em gradiente (Fitts) e **"Testar Webhook"**
    em outline contrastante (von Restorff), toast de sucesso/erro no teste e card
    **"Último teste realizado em: [data/hora]"**.
- **7 novos testes pytest** (`backend/tests/test_webhook_routes.py`): leitura do
  padrão, salvamento de URL/eventos com persistência, URL inválida (400), teste
  com sucesso (mock do `httpx.post`, registra `ultimo_teste`), teste com falha de
  conexão sem quebrar (mock de `httpx.ConnectError`) e URL de teste inválida.

## [0.1.20] — 2026-11-09

### Adicionado

- **Módulo de Agentes de IA (controle e configuração):**
  - Backend: `GET /api/agents` (status + prompt de cada agente, e flag
    `llm_configurado`), `PUT /api/agents/{agent_id}/status` (ativo/inativo) e
    `PUT /api/agents/{agent_id}/prompt` — persistência no novo arquivo
    `storage/agents.json` (seed com prompts padrão em pt-BR).
  - **Regra de bloqueio:** ativar o **Agente de Disparo** sem a chave do LLM
    configurada retorna **400** com mensagem acionável ("Configure a API Key
    do LLM em Ferramentas..."); desativar e o Atendimento são sempre
    permitidos.
  - Frontend: `frontend/src/pages/Agentes.tsx` reformulado em **dois cards
    lado a lado** (Disparo / Atendimento): badge de status, **toggle grande**
    (w-16 h-9 — Fitts), **pulso animado verde-esmeralda** e badge esmeralda
    quando ativo (von Restorff + Zeigarnik), textarea do **Prompt do Sistema**
    + botão "Salvar Prompt", toast específico ("Configure a API Key na aba
    Ferramentas primeiro.") quando o bloqueio 400 ocorre, e **accordion** com
    as configurações avançadas (modelo LLM/temperatura; modo texto/voz do
    atendimento) — Lei de Hick.
- **8 novos testes pytest** (`backend/tests/test_agents_routes.py`): listagem,
  bloqueio do disparo sem LLM (400), ativação do atendimento, ativação do
  disparo com LLM, desativação, status inválido/agente desconhecido (400/404),
  persistência do prompt e erros de prompt.

## [0.1.19] — 2026-11-09

### Adicionado

- **`POST /api/config`** — alias do `PUT /api/config` (frontend continua usando
  PUT; clientes externos podem usar POST, como na especificação da tela de
  Ferramentas).
- **Prevenção de erros (Nielsen) — trim automático:** todo texto do payload de
  configuração recebe `strip()` antes de gravar (recursivo, inclui arrays e
  objetos aninhados) — espaço acidental em API Key ou URL não vira falha
  misteriosa depois.
- **Validação de payload (422):** seção que é objeto no padrão (`llm`,
  `extratores`, `integracoes`, `agentes`, `webhook`, `perfil`) recebendo valor
  escalar é rejeitada com mensagem acionável, em vez de corromper o
  `config.json` e a UI.
- **Ícone de olho no campo de API Key** (`CampoSecreto` em Ferramentas):
  alterna visibilidade da chave (von Restorff) — conferir/colar sem apagar o
  campo. Continua com placeholder mascarado e aviso "deixe vazio para manter".
- **Testes (`backend/tests/test_config.py`)** — 7 novos testes de
  `GET/POST/PUT /api/config`: estrutura padrão, segredos nunca expostos ( GET
  devolve vazio + `_configurado` e o corpo cru não contém a chave),
  persistência + trim, segredo vazio não apaga o atual, PUT funcional,
  payload inválido → 422 e trim em arrays aninhados.
  Suíte completa: **51 passed**.

### Auditoria

- **Tela de Ferramentas:** auditada contra a especificação — a página
  (`frontend/src/pages/Ferramentas.tsx`, rota `/ferramentas` já no menu) já
  cobria LLM (provedor/base URL/modelo/API Key), Extratores (Maps, igmapper,
  templates em accordion, CNPJ/Scrapling), Perfil e o botão gradiente "Salvar
  configurações" com toast. Gaps entregues acima: POST, trim, validação, olho.
- **Integrações:** a seção cobre **OpenOutreach** (disparo) e **pipecat**
  (atendimento por voz), que são as integrações do produto. **YouTube/Meta não
  foram implementados** — o AGENTS.md (§1) é explícito: produção/upload de
  vídeos **não faz parte** do LeadMaster (o storage já remove chaves desses
  sistemas em migração). Se o pipeline de vídeos entrar no roadmap um dia, será
  como novo módulo com decisão de produto registrada.

## [0.1.18] — 2026-11-09

### Adicionado

- **Zero states no Painel (Efeito Zeigarnik)** — com base vazia a tela não
  mostra mais gráficos em branco:
  - `LeadsStageChart`: **"Nenhum dado ainda. Comece extraindo leads!"** com
    orientação aos extratores (Maps/Instagram/CNPJ);
  - `CampaignsDoughnut`: **"Nenhuma campanha disparada ainda."** com orientação
    a Disparos;
  - ambos em bloco tracejado discreto, sem quebrar o layout (altura preservada).
- **Testes das métricas (`backend/tests/test_metrics.py`)** — 4 novos testes da
  rota `GET /api/metrics` com dados conhecidos em `LEADMASTER_HOME` temporário
  (seeds de demo neutralizados):
  - base vazia: totais zerados e taxas padrão (100% entrega / 0% erro);
  - leads conhecidos: `leads_total` e `leads_por_etapa` exatos por coluna;
  - consolidação de campanhas: enviadas/erros somados e taxas proporcionais
    (150/162 → 92,6% e 7,4%);
  - reflexo do Kanban: mover lead de coluna via `PUT /api/crm/leads/{id}/etapa`
    recalcula `leads_por_etapa` na hora.
  - Suíte completa: **44 passed**.

### Auditoria

- **`GET /api/metrics` (dinâmica):** auditada contra a especificação — já lê
  `leads.json`/`campaigns.json` em tempo real e devolve `leads_total`,
  `leads_por_etapa` (leads/em_contato/proposta/fechado), totais consolidados
  das campanhas, `taxa_entrega`/`taxa_erro` (fallback 100%/0% sem campanhas) e
  `conexao` (geral/llm/openoutreach). Nenhuma alteração de cálculo necessária —
  agora com cobertura de testes e zero states na UI.

## [0.1.17] — 2026-11-09

### Corrigido

- **Erro `EBUSY` do npx — migração para Runtime Permanente.** A 0.1.15 tentou
  resolver com kill switch dentro do launcher, o que é impossível: o `EBUSY`
  acontece no gerenciador de arquivos do `npx` (`_npx\...`) **antes** de o
  `cli.mjs` ser carregado, então o kill switch nunca rodava. Causa raiz: o
  `uvicorn` era spawnado com `cwd` dentro do cache do npx, segurando o
  diretório. Nova arquitetura:
  - Pasta permanente **`<home>/.runtime`** guarda `backend/` + `frontend/dist/`.
  - `install`: kill switch (libera arquivos) → apaga o `.runtime` anterior →
    copia esta versão do pacote para ele. O cache do npx nunca mais é tocado
    por processos nossos.
  - `start`: spawna o Python a partir de **`<home>/.runtime/backend`** (nunca
    de `__dirname`); sem `.runtime` pronto, auto-aprovisiona; com pronto,
    reutiliza sem recopiar.
  - Launcher faz `process.chdir(home)` na entrada — cwd fora do cache.
  - Regra inviolável documentada no AGENTS.md ("terminantemente proibido
    executar o servidor a partir da pasta temporária do npx") + gate de
    regressão (`.runtime`, `copiarParaRuntime`, `cpSync`, `rmSync`,
    `path.join(runtime, 'backend')`, `process.chdir(homeLauncher)`).
  - `.runtime/` adicionado ao `.gitignore`; `doctor` reporta o status do
    runtime.

## [0.1.16] — 2026-11-09

### Adicionado

- **Módulo de Disparos (Campanhas) revisado conforme especificação:**
  - Rota `PUT /api/campaigns/{id}/status` — altera status
    (`rascunho`/`ativa`/`pausada`/`concluida`; `ativa` normalize para
    `em_andamento`; status inválido → 400, campanha inexistente → 404).
  - `POST /api/campaigns` agora aceita **`filtro_etapa`**: sem `lead_ids`
    explícitos, seleciona automaticamente os leads da etapa do CRM escolhida
    (ex.: "Novos Leads"), e **`mensagem`** (texto do template) — usada pelo
    agente de disparo quando presente.
  - Página `frontend/src/pages/Disparos.tsx` reformulada em **tabela**
    (Nome · Status · Total de Leads · Data de Criação · Ações), botão
    **"Nova Campanha"** grande no topo (Fitts + von Restorff) e modal com nome,
    **template da mensagem** (textarea), canal e **dropdown de filtro por etapa
    do CRM**. Ações na tabela: **Iniciar** (gradiente), **Pausar** e **Parar**.
  - UX: badges de status vibrantes (verde "Ativa", amarelo "Pausada", cinza
    "Rascunho" — von Restorff) e **barra de progresso + spinner** para
    campanhas ativas (Zeigarnik, com polling react-query a cada 4s).
- **5 novos testes pytest** (`backend/tests/test_campaigns_routes.py`):
  listagem, criação com filtro de etapa + persistência, payload inválido,
  alteração de status (ativa/pausada) e erros (status inválido 400 /
  inexistente 404).

### Corrigido

- **Launcher — kill switch (6ª regra inviolável):** o launcher NUNCA mais
  ignora uma porta ocupada por instância anterior do LeadMaster — antes de
  subir, encerra a instância antiga confirmada (PID dono da porta via
  `netstat -ano` no Windows / `lsof -ti:porta -sTCP:LISTEN` no Unix, com
  fallback `ps`), `taskkill /F /T /PID` ou `kill -9`, aguardando até 5s a
  liberação. A mensagem "já está rodando" foi **removida** (impedia
  atualizações e causava `EBUSY` no npx). Processos de outros projetos nunca
  são tocados (avança para a próxima porta). Roda no `install` (libera
  arquivos) e no `start`. Gate de regressão reforçado com as asserções do
  kill switch.

## [0.1.15] — 2026-11-08

### Corrigido

- **Launcher — kill switch: a versão nova SEMPRE assume o controle** — o
   bloqueio de porta foi eliminado. Antes, ao detectar a porta ocupada, o
   `cli.mjs` apenas imprimia "LeadMaster já está rodando" e encerrava: a versão
   antiga continuava no ar, o usuário não conseguia testar a nova e o `npx`
   falhava com `EBUSY` (arquivos travados no Windows). Agora:
   - **`encerrarInstanciaAnterior()`** roda no início do `install` (libera os
     arquivos antes de instalar — fim do `EBUSY`) e do `start`;
   - descoberta do PID dono da porta via `netstat -ano` (Windows) /
     `lsof -ti:porta` (Linux/macOS, com fallback `ps`), seguida de
     `taskkill /F /T /PID` ou `kill -9`;
   - espera de até 5s pela liberação da porta antes de subir o novo servidor;
   - **higiene preservada:** só mata processos **confirmados** como LeadMaster
     (`/api/health` com payload próprio + PID dono da porta). Portas ocupadas
     por outros projetos são respeitadas — o launcher avança para a próxima
     porta livre, como sempre;
   - ciclo de vida vinculado mantido: com o Python antigo morto, o Node antigo
     encerra sozinho (`child.on('exit')`/`close`).
- **AGENTS.md:** 6ª regra inviolável do launcher — *Kill switch*: nunca ignorar
   porta ocupada por instância do LeadMaster; mensagem de reuso **proibida**.
- **Gate de regressão:** `test_launcher_protections.py` falha se o kill switch
   desaparecer (`encerrarInstanciaAnterior`/`taskkill`/`netstat`/`lsof`) ou se a
   mensagem proibida voltar. Suíte completa: **32 passed**.
- **Testado ao vivo:** instância anterior na mesma porta detectada, encerrada
   (PID confirmado) e nova instância assumida com PID novo; node antigo caiu
   pelo ciclo de vida; instância de outros projetos preservada.

## [0.1.14] — 2026-11-08

### Adicionado

- **Extrator de Leads (CNPJ) — terceira fonte dedicada, leads B2B:**
  - Rota `POST /api/extractors/cnpj` (`cnae`, `uf`, `limit`): enquanto o provedor
    de busca em Ferramentas → Extratores for o placeholder padrão, gera **mock de
    5–10 empresas fictícias** (nome fantasia, CNPJ formatado, telefone/e-mail,
    porte e capital social em `extras`) — estabilidade e anti-bloqueio nesta
    fase. Com URL de provedor real configurada, consulta o provedor
    (`buscar_cnpj_cnae`, parser tolerante) e **degrada para mock** em falha ou
    rate-limit, com aviso acionável. Leads salvos em `leads.json` na coluna
    **"Novos Leads"** e retornados na resposta (`extraidos`, `importados`,
    `duplicados`, `origem`).
  - Página `frontend/src/pages/ExtratorCNPJ.tsx` (rota `/extrator-cnpj`, link no
    menu lateral): campo **CNAE**, **dropdown de UF** (27 estados), slider de
    quantidade (5–10), botão **"Iniciar Extração"** em gradiente
    (von Restorff/Fitts), **barra de progresso animada** "Buscando empresas..."
    (Zeigarnik), tabela de resultados (Nome Fantasia, CNPJ, Cidade/UF,
    Telefone, Fonte) e botão **"Ir para o CRM"**. Opções avançadas (porte da
    empresa, capital social mínimo) escondidas em accordion (Lei de Hick) —
    aplicam-se ao provedor real.
  - **Consulta avulsa por CNPJ** (BrasilAPI) preservada dentro da nova página:
    consulta e importa uma empresa específica para "Novos Leads".
  - `frontend/src/pages/Extratores.tsx` virou hub de atalhos para as três
    páginas dedicadas (Maps, Instagram, CNPJ) — aba CNPJ removida, mesmo
    padrão das outras fontes.
- **Testes:** `backend/tests/test_cnpj_extractor.py` — mock gera e persiste
  (fonte/etapa/campos), limite respeitado, UF normalizada (minúscula → "MG") e
  payload inválido (422). Suíte completa: **31 passed**.

### Auditoria

- **0.1.13 (versão anterior):** Extrator Instagram entregue na 0.1.12 por sessão
  simultânea — auditado contra a especificação (rota `POST /api/extractors/instagram`,
  mock 5–10, página `/extrator-instagram`, accordion avançado, testes) **sem
  alterações necessárias**; versão dinâmica na sidebar (`__APP_VERSION__`) e
  consolidação do `process.on('exit')` do launcher conferidos e verdes.

## [0.1.13] — 2026-11-08

### Adicionado

- **Versão dinâmica na sidebar** — a barra lateral exibe **LeadMaster `v0.1.13`**
  (badge discreto ao lado do logotipo, `text-[10px]` em indigo sobre o fundo
  escuro `#1e1b4b`):
  - `frontend/vite.config.ts`: `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`
    lendo o `package.json` da **raiz** — cada release no NPM (bump de versão)
    atualiza a UI **automaticamente**, sem nenhuma alteração manual no código
    React;
  - `frontend/src/vite-env.d.ts`: `declare const __APP_VERSION__: string;`;
  - `frontend/src/components/Sidebar.tsx`: badge `v{__APP_VERSION__}` no header.

### Corrigido

- **Launcher — casa arrumada:** consolidação do `process.on('exit')` duplicado
  (haviam dois handlers matando o worker Python; ficou apenas o mais forte, com
  `taskkill /T /F` no Windows) — o gate de regressão continua falhando se o ciclo
  de vida vinculado ou o terminal preso desaparecerem.

## [0.1.12] — 2026-11-08

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

- **Launcher (5ª regra inviolável):** `process.on('exit')` mata o worker Python em
  qualquer caminho de saída (erros inesperados inclusive); `.unref()` eliminado
  também dos comentários. Gate de regressão atualizado
  (`test_launcher_protections.py`): falha se `process.stdin.resume()`, o ciclo de
  vida vinculado ou o isolamento desaparecerem do launcher.
- **Renumeração por colisão:** a `0.1.11` já estava publicada no registry (commit
  do terminal preso) — esta sessão renumera para o patch seguinte, conforme regra
  do AGENTS.md.

## [0.1.11] — 2026-11-08

### Corrigido

- **Launcher — terminal preso:** `process.stdin.resume();` imediatamente antes das
  mensagens finais de sucesso — o processo Node permanece vivo ouvindo a entrada
  padrão, o prompt do MobaXterm nunca é devolvido e a PTY (e com ela o uvicorn)
  não é fechada. Publicada via tag `v0.1.11`.

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
