# Skill: Runtime Guard — Windows + Linux (Execução Nativa Obrigatória)

**Propósito:** blindar o app contra ambientes hostis de terminal (Windows + MobaXterm
foi o binômio responsável por semanas de dor no Thunderbolt — app morrendo sozinho,
janelas de CMD piscando, EBUSY no npx) **e** garantir compatibilidade nativa em
Windows **e** Linux. As regras abaixo são **invioláveis** e estão no AGENTS.md.

## 1. Launcher (`scripts/cli.mjs`)

- O servidor Python sobe com **`stdio: 'inherit'`** — nunca `pipe` (pipes no terminal
  são o canal que derrubava tudo quando a PTY do MobaXterm morria).
- O worker nasce com **`detached: true`** (grupo de processos próprio) +
  **`windowsHide: true`** — nunca abre janela de console.
- Terminal preso via **`readline.createInterface`** guardado em **variável de escopo
  de módulo** (`readlineUi`, referência viva — o GC do Node não pode coletá-la);
  Ctrl+C é tratado pelo handler `SIGINT` (mata a árvore do worker).
  `SIGTERM`/`SIGBREAK` são paradas legítimas.
- **Falha NUNCA é silenciosa (obrigatório):**
  - **`child.on('error')`** no spawn — sem listener, erro de spawn virava exceção
    silenciosa e o launcher morria sem explicação (regressão da 0.1.41);
  - **`child.on('exit')`** loga código/sinal do crash antes de liberar o terminal;
  - **verificação do runtime antes do spawn** (`<runtime>/backend/main.py`) com a
    mensagem acionável *"Runtime corrompido. Rode o comando install novamente"*;
  - `process.on('uncaughtException')` loga **e encerra com código 1**;
  - `readlineUi.on('close')` trata **EOF do stdin** (wrapper do npx fechando a
    entrada): o launcher NÃO morre — quem segura o processo é o filho Python
    referencial (sem `unref`).
- **Proibidos:** `stdin.resume()`, `setInterval` de keep-alive, `http.createServer`
  (dummy server), `beforeExit`, `await new Promise(...)`, `child.unref()`.
- Existe o gate de regressão `backend/tests/test_launcher_protections.py` que falha se
  qualquer uma dessas regras desaparecer ou se um proibido voltar.

## 2. Subprocessos Python

- Todo `subprocess.run`/`Popen` no backend DEVE usar
  `creationflags=proc_flags.creationflags()` (`services/flags.py`), que aplica
  `CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW` no Windows e 0 no Unix.
- Timeout de segurança sempre que houver chamada externa (scrapers, gateways, LLM).

## 3. Caminhos e execução

- Sempre `path.join` (Node) ou `pathlib`/`os.path.join` (Python) — nunca concatenação
  com `\` ou `/` na mão.
- **Proibido executar o servidor a partir do cache do `npx`** (regra do `.runtime`):
  `install` copia para `<home>/.runtime`, `start` executa de lá, `kill` encerra via
  lock file.
- npm no Windows: dentro de PowerShell use sempre **`npm.cmd`** (o `npm.ps1` está
  bloqueado pela execution policy).

## 4. Execução nativa Windows + Linux (regra absoluta)

- O código deve ser compatível com **Windows e Linux** — caminhos sempre com
  `path.join` (Node) ou `pathlib` (Python); nunca concatenar com `\` ou `/` na mão.
- **É proibido exigir Docker** (ou WSL, Kubernetes, contêineres) para rodar o app —
  a execução nativa é obrigatória nos dois sistemas. Se um banco de dados for
  necessário no futuro, use **SQLite (nativo)** ou instalação direta, nunca
  contêiner como requisito. Contêineres seguem como opção extra do usuário.

## 5. Diagnóstico rápido

```cmd
node scripts/cli.mjs doctor
```

Mostra: versão, pasta de dados, runtime, Python, dependências, status do servidor e
integrações. Falhou? Veja `<home>/storage/logs/`.