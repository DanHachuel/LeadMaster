# Skill: Windows Runtime Guard (Ambiente Hostil)

**Propósito:** blindar o app contra Windows + MobaXterm. Este binômio foi responsável
por semanas de dor no Thunderbolt (app morrendo sozinho, janelas de CMD piscando,
EBUSY no npx). As regras abaixo são **invioláveis** e estão no AGENTS.md.

## 1. Launcher (`scripts/cli.mjs`)

- O servidor Python sobe com **`stdio: 'inherit'`** — nunca `pipe` (pipes no terminal
  são o canal que derrubava tudo quando a PTY do MobaXterm morria).
- O worker nasce com **`detached: true`** (grupo de processos próprio) +
  **`windowsHide: true`** — nunca abre janela de console.
- Terminal preso via **`readline.createInterface`**; Ctrl+C é tratado pelo handler
  `SIGINT` (mata a árvore do worker). `SIGTERM`/`SIGBREAK` são paradas legítimas.
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

## 4. Diagnóstico rápido

```cmd
node scripts/cli.mjs doctor
```

Mostra: versão, pasta de dados, runtime, Python, dependências, status do servidor e
integrações. Falhou? Veja `<home>/storage/logs/`.