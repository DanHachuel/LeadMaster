# AGENTS.md — Regras do Projeto LeadMaster

Regras obrigatórias para qualquer agente (humano ou IA) trabalhando neste repositório.
O LeadMaster é um **SaaS local de prospecção**: CRM, extratores de leads e agentes de
IA — instalável via `npx` e 100% local. **Não faz parte do produto:** produção de
vídeos, upload para YouTube ou qualquer integração com sistemas de vídeo.

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
  fica em **8010** (proxy `/api`; a 8000 é evitada por conflitar com outros serviços
  locais comuns).
- **Proibido:** Streamlit. Sistemas de vídeo (MoneyPrinterTurbo, Short-Video-Maker,
  OpenMontage, uploaders de YouTube) são **proibidos** no LeadMaster.

## 2. Estrutura do Repositório

```
LeadMaster/
├── .github/workflows/publish-npm.yml   # Publicação NPM via GitHub Actions
├── scripts/cli.mjs                      # Launcher npx (install / start / doctor)
├── frontend/                            # React + Vite + Tailwind (UI)
│   ├── src/components/                  # Sidebar, Header, MetricCard, Charts, Kanban...
│   ├── src/pages/                       # Dashboard, Leads, CRM, Disparos, Extratores,
│   │                                    #   ExtratorMaps, Agentes, Ferramentas, Webhook, Suporte
│   └── src/lib/api.ts                   # Cliente HTTP tipado
├── backend/                             # FastAPI
│   ├── main.py                          # Rotas da API + serving da UI (dist)
│   ├── services/                        # Integrações e regras de negócio
│   │   ├── crm_agent.py                 # Agente de CRM (sugestões/enriquecimento)
│   │   ├── extractors.py                # Google Maps / Instagram / CNPJ
│   │   ├── agents.py                    # Agente de disparo e atendimento
│   │   ├── llm.py                       # LLM (OpenAI-compatível)
│   │   └── storage.py                   # Persistência JSON local
└── storage/                             # Dados locais (ignorados pelo git)
    ├── leads.json
    ├── campaigns.json
    └── config.json
```

## 3. Armazenamento Local

- A pasta de dados (**home**) resolve nesta ordem: flag `--home` > variável
  `LEADMASTER_HOME` > `Documents/REPOSITORIO/LeadMaster` > `~/.leadmaster`.
- Toda persistência ocorre em `<home>/storage`: `leads.json`, `campaigns.json`,
  `config.json`.
- Sementes (seeds) são criadas automaticamente pelo backend na primeira execução.
- **Nunca** persistir dados em nuvem. **Nunca** commitar conteúdo de `storage/`.

## 4. Endpoints e Integrações Externas

| Integração | Endpoint padrão | Uso |
|---|---|---|
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
  - O `<VERSAO>` é **sempre** a versão **canônica literal confirmada no registry** (ex.: `0.1.5`)
    — **nunca** enviar `@latest` ao usuário. `@latest` é permitido apenas nas instruções
    permanentes (README, página do NPM, `legal/`), onde queremos sempre a versão mais recente.
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

1. **Lei de Fitts** — botões primários ("Nova Campanha", "Salvar") grandes e de fácil
   acesso.
2. **Lei de Hick** — configurações avançadas escondidas em menus expansíveis (accordions).
3. **Efeito Zeigarnik** — barras de progresso visíveis no preenchimento de leads e no
   andamento das campanhas.
4. **Lei de Jakob** — consistência visual com o protótipo (menu lateral fixo, cards,
   ícones FontAwesome).
5. **Gradiente de Meta** — mensagens motivacionais ("Faltam 2 campos para o lead ficar
   completo").
6. **Efeito von Restorff** — botão de ação principal destacado com gradiente
   indigo/purple sobre fundo neutro.
7. **Lei de Miller** — métricas relacionadas agrupadas em um único bloco visual (cards).

## 9. Convenções de Código

- Frontend: TypeScript estrito; componentes funcionais; classes utilitárias Tailwind;
  chamadas HTTP somente via `frontend/src/lib/api.ts`.
- Backend: sem frameworks extras além dos listados em `backend/requirements.txt`;
  escrita de JSON sempre atômica e sob lock (`services/storage.py`);
  mensagens de erro sempre acionáveis (o que fazer para resolver);
  **todo subprocesso Python usa flags de criação isoladas**
  (`services/flags.py`: `CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW` no
  Windows) e **workers do launcher Node nascem com `detached: true`**
  (grupo de processos próprio) — assim Ctrl+C do terminal nunca derruba o
  launcher e os workers em cascata; testes em `backend/tests` (pytest) cobrem
  as flags nas duas plataformas.
- Comentários e textos de UI em português do Brasil.
- Toda nova página/rota frontend precisa de entrada correspondente na Sidebar.
- `GET /api/config` jamais expõe segredos (campo mascarado + flag `_configurado`).
- 🚫 **PROIBIDO criar versões que abram telas de CMD/terminal no computador do usuário** —
  regra permanente e absoluta: nenhum popup de console pode aparecer ao rodar o
  LeadMaster. Para cumpri-la, **todo** spawn de subprocesso deve:
  - **Node** (`child_process`): sempre `windowsHide: true`; ao invocar `.cmd`/`.bat`
    no Windows, usar `shell: true` com `windowsHide: true`;
  - **Python** (`subprocess`): sempre `creationflags=proc_flags.creationflags()`
    (inclui `CREATE_NO_WINDOW` no Windows);
  - saída sempre direcionada a pipes/logs (`stdio` controlado) — nunca janelas
    interativas.

## 🚨 REGRA INVIOLÁVEL: ARQUITETURA DO LAUNCHER (anti-travamento no MobaXterm)

O launcher (`scripts/cli.mjs`) NÃO pode ser alterado de forma a remover estas seis
proteções — elas impedem o encerramento silencioso do LeadMaster no Windows:

1. **Keep-alive:** o launcher DEVE conter `setInterval(() => {}, 1000);` para manter o
   event loop ativo mesmo sem streams de I/O de console.
2. **Terminal preso (solução definitiva):** a linha `process.stdin.resume();` DEVE
   estar presente no `cli.mjs`, logo antes das mensagens finais de sucesso — o
   processo Node permanece indefinidamente vivo ouvindo a entrada padrão, o prompt
   do MobaXterm nunca é devolvido e a PTY (e com ela o uvicorn) não é fechada.
   O launcher NUNCA deve chamar `process.exit(0)` após o sucesso da inicialização
   (sai naturalmente ou pelos listeners do filho); `process.exit(...)` reside apenas
   em caminhos de erro acionável, na parada legítima (`SIGTERM`/`SIGBREAK`) e no
   aviso informativo "já está rodando". O worker Python nunca é criado com
   `.unref()`; a morte do filho encerra o launcher (`child.on('close')`) e
   vice-versa (`process.on('exit')`).
3. **Absorção de sinais no Windows:** `SIGINT` e `SIGHUP` DEVEM ser absorvidos no
   Windows (apenas log `"[LAUNCHER] Sinal absorvido..."`, sem `stop()`/`exit()`) — o
   MobaXterm os envia de forma espúria (perda de foco, minimização). `SIGTERM` e
   `SIGBREAK` **nunca** devem ser absorvidos (são paradas legítimas). No Linux/macOS,
   SIGINT/SIGHUP mantêm o encerramento gracioso.
4. **Guarda da consola:** a função `guardConsoleStream` NUNCA deve ser removida —
   ignora `EPIPE` no evento `'error'` do stream e espelha a saída em
   `storage/logs/launcher_console.log`.
5. **Isolamento de processos:** o worker Python DEVE ser iniciado com
   `detached: true` (equivale a `CREATE_NEW_PROCESS_GROUP` no Windows) mantendo
   `windowsHide: true`.
6. **Kill switch (nunca reutilizar instância):** o launcher NUNCA deve ignorar
   uma porta ocupada. Se a porta estiver em uso por outra instância do
   LeadMaster, ele DEVE matar o processo antigo (descoberta do PID via
   `netstat -ano` no Windows / `lsof -ti:porta` no Linux/macOS, seguida de
   `taskkill /F /T /PID` ou `kill -9`) para garantir que a versão nova assuma o
   controle — com espera de 1–2s pela liberação da porta. A mensagem "já está
   rodando" é **proibida**, pois impede atualizações e deixa a versão antiga
   travando arquivos (erro `EBUSY` no `npx`). **Higiene continua valendo:** só
   mata processos **confirmados** como LeadMaster (`/api/health` com o payload
   próprio + PID dono da porta) — processos de outros projetos nunca são
   tocados (o launcher avança para a próxima porta livre). O kill switch roda
   tanto no `install` (libera arquivos antes de instalar) quanto no `start`.

Gate de regressão: `backend/tests/test_launcher_protections.py` falha se qualquer uma
dessas proteções desaparecer do launcher (inclusive `process.stdin.resume();`, o uso
de `.unref()` ou a ausência do kill switch).

### Runtime permanente — terminantemente proibido executar do cache do npx

É **terminantemente proibido** executar o servidor a partir da pasta temporária do
npx (`_npx\...`). Um processo rodando de lá segura o diretório e o próximo `npx
install/update` falha com **`EBUSY`** antes mesmo de qualquer código do launcher
ser carregado — por isso kill switch dentro do launcher não pode resolver isso.

- O comando `install` **DEVE** copiar `backend/` e `frontend/dist/` para a pasta
  permanente `<home>/.runtime` (apagando a anterior, após o kill switch liberar
  os arquivos) e o `start` **DEVE** spawnar o Python a partir de
  `<home>/.runtime/backend` — nunca de `__dirname`.
- O `start` sem `.runtime` pronto se auto-aprovisiona (copia antes de subir);
  com `.runtime` pronto, reutiliza sem recopiar.
- O launcher ainda faz `process.chdir(home)` na entrada — nenhum processo nosso
  mantém cwd dentro do cache do npx.

## 10. QA antes de commit/push

1. `npm --prefix frontend run build` — build limpo (tsc + vite).
2. `python -m py_compile` em todos os `.py` do backend (ou `python -m compileall backend`).
3. Subir backend (`python -m uvicorn main:app` em `backend/`) e conferir `/api/health`.
4. Fluxo manual: criar lead → mover no Kanban → criar campanha → iniciar.
5. **Higiene de processos:** ao encerrar servidores de teste, mate APENAS processos do
   LeadMaster (cujo caminho seja do repositório ou do pacote `@danhachuel/leadmaster`) —
   nunca processos de outros projetos locais (ex.: outros apps uvicorn do usuário), e
   nunca deixe instâncias rodando ao final da sessão. O LeadMaster **nunca abre o
   navegador**: apenas imprime a URL no terminal.
6. **Zero janelas de CMD:** nenhum spawn de subprocesso (Python ou Node) pode abrir
   popup de console no computador do usuário — `windowsHide: true` (Node) e
   `creationflags` com `CREATE_NO_WINDOW` (Python) em todos os spawns.
