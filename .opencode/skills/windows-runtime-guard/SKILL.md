# Skill: Runtime Guard — Windows + Linux (Execução Nativa Obrigatória)

**Propósito:** blindar o app contra ambientes hostis de terminal (Windows + MobaXterm
foi o binômio responsável por semanas de dor no Thunderbolt — app morrendo sozinho,
janelas de CMD piscando, EBUSY no npx) **e** garantir compatibilidade nativa em
Windows **e** Linux. As regras abaixo são **invioláveis** e estão no AGENTS.md.

## 0. npx.cmd tem bug conhecido no Windows — use o start.bat

O `npx.cmd` no Windows fecha a PTY e mata o processo Node **à força**
(SIGKILL/TerminateProcess) ao final da tarefa do wrapper — nenhum handler do
Node roda e o terminal devolve o prompt imediatamente. Foram mais de 10
tentativas de conviver com isso (stdio, readline, setInterval, dummy server,
promise congelada): **a morte vem de fora do processo e é inevitável.**

A solução definitiva (padrão PandaNews) é **não depender do Node vivo**: o
launcher é **DESCARTÁVEL** — ele sobe o Python e sai; o prompt voltar é o
comportamento esperado. Para execução estável no dia a dia, o usuário DEVE usar
o `start.bat` gerado pelo `install` em `<home>/start.bat`:

```bat
@echo off
title LeadMaster
cd /d "%~dp0"
node "%~dp0.runtime\cli.mjs" start %*
exit
```

(O `exit` final fecha a janela preta do CMD sozinha — sem `pause` — porque o
servidor fica no ar em background.)

O launcher é copiado pelo `install` para `<home>/.runtime/cli.mjs` (caminho
estável — o cache do `_npx` troca de hash a cada versão) e o `.bat` o executa
**direto pelo node**, sem o npx no meio. **O npx deve ser usado APENAS para
`install` ou atualização de versão.**

## 1. Launcher (`scripts/cli.mjs`) — descartável, padrão PandaNews

**É PROIBIDO tentar manter o terminal preso no Windows.** O launcher deve ser
descartável (`child.unref()` + stdio em arquivo). O terminal SEMPRE devolverá
o prompt, e isso é o comportamento esperado.

- **Spawn desacoplado:** o worker Python nasce com
  **`stdio: ['ignore', logFd, logFd]`** (stdout/stderr vão direto para
  `<home>/storage/logs/backend.log` — nenhum pipe/inherit para o terminal),
  `detached: true` (grupo de processos próprio: sobrevive ao pai e ao
  fechamento da janela) e `windowsHide: true`. Após o spawn:
  **`fs.closeSync(logFd)`** e **`child.unref()`** — o Node não espera pelo
  filho.
- **Zero keep-alive — PROIBIDOS no código:** `readline`, `setInterval`,
  `http.createServer` (dummy server), `await new Promise(...)`,
  `process.stdin.resume()`, `beforeExit`. Depois da mensagem de sucesso o
  launcher encerra naturalmente.
- **Nunca fingir sucesso (obrigatório):**
  - **`child.on('error')`** no spawn — erro de subida do Python imprime
    "ERRO CRÍTICO AO INICIAR O PYTHON" com comando tentado, diretório e a dica
    do `doctor` + exit 1;
  - **`child.on('exit')`** só age na janela de startup (`sucessoAnunciado`):
    crash do uvicorn imprime o motivo e as últimas linhas do `backend.log`;
  - **`waitForHealth`** confere `/api/health` antes do ✅ — servidor que não
    sobe mostra o fim do log + exit 1 (lock removido);
  - **verificação do runtime antes do spawn** (`<runtime>/backend/main.py`) com a
    mensagem acionável *"Runtime corrompido. Rode o comando install novamente"*;
  - `process.on('uncaughtException')` loga **e encerra com código 1**.
- **Após o sucesso, a morte do Python NÃO está amarrada à do Node** — ele vive
  até o `kill` (ou o kill switch do próximo start). Mensagem final do `start`:
  background na porta X, caminho do log, "abra o navegador" e o comando
  `npx --yes @danhachuel/leadmaster kill`. **Ensinar Ctrl+C é PROIBIDO.**
- **Exit Trace:** `process.on('exit')` registra stack e código apenas em
  encerramentos inesperados — saída com código 0 no `start` é o comportamento
  DESENHADO (não é alarme).
- **Proibidos:** `readline`, `setInterval`, `http.createServer`,
  `await new Promise`, `stdin.resume()`, `beforeExit`, `detached: false` e
  remover o `child.unref()`.
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