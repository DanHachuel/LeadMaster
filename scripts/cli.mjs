#!/usr/bin/env node
/**
 * LeadMaster — SaaS local de prospecção e automação de conteúdo.
 * Launcher oficial do pacote NPM (@danhachuel/leadmaster).
 *
 * Comandos:
 *   install  Prepara a pasta de dados (home) e instala as dependências Python.
 *   start    Sobe o backend FastAPI (serving da UI construída) e imprime a URL
 *            no terminal — NUNCA abre o navegador; quem abre é o usuário.
 *            `npx @danhachuel/leadmaster` sem argumentos executa este comando.
 *   doctor   Diagnóstico rápido: Node, Python, dependências, pasta de dados.
 *   help     Ajuda.
 *   version  Versão do pacote.
 *
 * Flags:
 *   --home=<caminho>        Pasta de dados (padrão: %USERPROFILE%\\Documents\\REPOSITORIO\\LeadMaster).
 *   --port=<numero>         Porta inicial da UI/API (padrão: 5055; se ocupada, tenta 5056, 5057, ...).
 *   --skip-python-deps      Não instala dependências Python (usado em CI/smoke-test).
 *
 * Ambiente:
 *   LEADMASTER_HOME  Mesmo efeito de --home.
 *   LEADMASTER_PORT  Porta inicial da UI/API (mesmo efeito de --port).
 */

import { spawn, spawnSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, appendFileSync, rmSync, cpSync, openSync, closeSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

// ---------------------------------------------------------------------------
// Erros globais (blindagem anti-encerramento silencioso)
// Rejeições e exceções não tratadas são APENAS LOGADAS — nunca devem derrubar
// o launcher sem explicação (era assim que o MobaXterm perdia o processo sem
// deixar rastro). O launcher só termina pelo fluxo normal: erro acionável,
// parada legítima (SIGTERM/SIGBREAK) ou morte do servidor Python filho.
// NUNCA REMOVER (regra inviolável do AGENTS.md).
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Porta padrão da UI/API local; se estiver ocupada, o launcher avança
// automaticamente (5055 → 5056 → 5057 → ...) até encontrar uma porta livre.
const UI_PORT = 5055;
const UI_PORT_MAX_TENTATIVAS = 50;

// ---------------------------------------------------------------------------
// Parsing de argumentos
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { _: [], home: null, port: null, skipPythonDeps: false };
  for (const raw of argv) {
    if (raw === '--skip-python-deps') args.skipPythonDeps = true;
    else if (raw.startsWith('--home=')) args.home = raw.slice('--home='.length);
    else if (raw.startsWith('--port=')) args.port = Number.parseInt(raw.slice('--port='.length), 10);
    else if (raw.startsWith('-')) console.warn(`Aviso: flag desconhecida "${raw}" ignorada.`);
    else args._.push(raw);
  }
  if (process.env.LEADMASTER_HOME) args.home = args.home || process.env.LEADMASTER_HOME;
  if (process.env.LEADMASTER_PORT) args.port = args.port || Number.parseInt(process.env.LEADMASTER_PORT, 10);
  return args;
}

// ---------------------------------------------------------------------------
// Resolução da pasta de dados (home)
// ---------------------------------------------------------------------------

function resolveHome(args) {
  if (args.home) return path.resolve(args.home);
  const docs = path.join(homedir(), 'Documents');
  if (existsSync(docs)) return path.join(docs, 'REPOSITORIO', 'LeadMaster');
  return path.join(homedir(), '.leadmaster');
}

function ensureHome(home) {
  for (const dir of [home, path.join(home, 'storage')]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Runtime permanente (regra inviolável do AGENTS.md)
//
// O servidor NUNCA executa a partir do cache do npx (`_npx\...`): um processo
// rodando de lá segura o diretório e o npx falha com EBUSY na próxima
// instalação — antes mesmo de qualquer código do launcher rodar (por isso o
// kill switch sozinho não resolvia). Solução: `install` copia backend/ e
// frontend/dist/ para <home>/.runtime e `start` executa de lá. O cache do npx
// nunca é tocado por processos nossos.
// ---------------------------------------------------------------------------

function runtimeDir(home) {
  return path.join(home, '.runtime');
}

function runtimePronto(home) {
  return existsSync(path.join(runtimeDir(home), 'backend', 'main.py'));
}

/** Copia backend/ e frontend/dist/ do pacote para o runtime permanente. */
function copiarParaRuntime(home) {
  const runtime = runtimeDir(home);
  rmSync(runtime, { recursive: true, force: true });
  mkdirSync(runtime, { recursive: true });
  cpSync(path.join(PKG_ROOT, 'backend'), path.join(runtime, 'backend'), {
    recursive: true,
    filter: (src) => !src.includes('__pycache__') && !src.endsWith('.pyc') && !src.includes(`${path.sep}.venv`),
  });
  const dist = path.join(PKG_ROOT, 'frontend', 'dist');
  if (existsSync(path.join(dist, 'index.html'))) {
    cpSync(dist, path.join(runtime, 'frontend', 'dist'), { recursive: true });
  }
  return runtime;
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

function detectPython() {
  const candidates = platform() === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  for (const cmd of candidates) {
    const extra = cmd === 'py' ? ['-3'] : [];
    const probe = spawnSync(cmd, [...extra, '--version'], { encoding: 'utf8', windowsHide: true });
    if (probe.status === 0) return { cmd, args: extra };
  }
  return null;
}

function pythonRun(python, args, opts = {}) {
  return spawnSync(python.cmd, [...python.args, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    ...opts,
  });
}

function pythonDepsOk(python) {
  const probe = pythonRun(python, ['-c', 'import fastapi, uvicorn, httpx, pydantic'], { stdio: 'pipe' });
  return probe.status === 0;
}

function installPythonDeps(python) {
  console.log('→ Instalando dependências Python (fastapi, uvicorn, httpx, pydantic)...');
  const res = pythonRun(python, ['-m', 'pip', 'install', '-r', path.join(PKG_ROOT, 'backend', 'requirements.txt'), '--quiet', '--disable-pip-version-check'], {
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    console.error('');
    console.error('✗ Falha ao instalar as dependências Python.');
    console.error('  Comando manual equivalente:');
    console.error(`  ${python.cmd} ${python.args.join(' ')} -m pip install -r "${path.join(PKG_ROOT, 'backend', 'requirements.txt')}"`);
    process.exit(1);
  }
  console.log('✓ Dependências Python instaladas.');
}

// ---------------------------------------------------------------------------
// Frontend (modo repositório/fonte): instala deps Node e constrói a UI.
// No pacote publicado via npx a UI já vem pronta (frontend/dist) e este
// bloco é pulado automaticamente.
// ---------------------------------------------------------------------------

const NPM = platform() === 'win32' ? 'npm.cmd' : 'npm';

function npmRun(args, cwd, opts = {}) {
  return spawnSync(NPM, args, { cwd, stdio: 'inherit', shell: true, windowsHide: true, ...opts });
}

function instalarNodeDeps(cwd, rotulo) {
  console.log(`→ Instalando dependências Node (${rotulo})...`);
  let res = npmRun(['install', '--no-fund', '--no-audit'], cwd);
  if (res.status !== 0) {
    // npm >= 12 pode bloquear postinstall scripts (ex.: esbuild) por política;
    // aprova o pacote e repete a instalação.
    console.log('ℹ npm bloqueou um postinstall; aprovando (esbuild) e repetindo a instalação...');
    npmRun(['install-scripts', 'approve', 'esbuild'], cwd, { stdio: 'ignore' });
    res = npmRun(['install', '--no-fund', '--no-audit'], cwd);
  }
  if (res.status !== 0) {
    console.error(`✗ Falha ao instalar as dependências Node (${rotulo}).`);
    process.exit(1);
  }
  console.log(`✓ Dependências Node instaladas (${rotulo}).`);
}

/**
 * Idempotente por design: NÃO reinstala tudo a cada versão.
 *  - Dependências Node presentes? Pula a instalação.
 *  - Interface (dist) já construída? Pula o build.
 *  - Build falhou (deps desatualizadas após troca de versão)?
 *    Roda npm install incremental e tenta UMA vez mais.
 */
function instalarFrontend() {
  const frontend = path.join(PKG_ROOT, 'frontend');
  const dist = path.join(frontend, 'dist', 'index.html');
  const viteBin =
    platform() === 'win32'
      ? path.join(frontend, 'node_modules', '.bin', 'vite.cmd')
      : path.join(frontend, 'node_modules', '.bin', 'vite');

  if (!existsSync(viteBin)) {
    instalarNodeDeps(frontend, 'React, Vite, Tailwind');
  } else {
    console.log('✓ Dependências Node do frontend já instaladas — nada a fazer.');
  }

  if (existsSync(dist)) {
    console.log('✓ Interface já construída (frontend/dist) — nada a fazer.');
    return;
  }

  console.log('→ Construindo a interface (npm run build)...');
  let build = npmRun(['run', 'build'], frontend);
  if (build.status !== 0 || !existsSync(dist)) {
    console.log('ℹ Build falhou — atualizando dependências Node (só o que faltar) e repetindo...');
    instalarNodeDeps(frontend, 'atualização incremental do frontend');
    build = npmRun(['run', 'build'], frontend);
    if (build.status !== 0 || !existsSync(dist)) {
      console.error('✗ Falha ao construir a interface (frontend/dist).');
      console.error('  Rode manualmente: npm --prefix frontend run build');
      process.exit(1);
    }
  }
  console.log('✓ Interface pronta (frontend/dist).');
}

/**
 * Modo fonte (checkout do repositório): prepara raiz + frontend + build,
 * sempre de forma idempotente. No pacote npx a UI já vem pronta e isto
 * é pulado automaticamente (não existe frontend/package.json no tarball).
 */
function instalarModoFonte() {
  if (!existsSync(path.join(PKG_ROOT, 'frontend', 'package.json'))) return false;
  console.log('ℹ Modo repositório (fonte) detectado.');
  // Raiz: devDependencies (concurrently, usadas por "npm run dev").
  if (!existsSync(path.join(PKG_ROOT, 'node_modules', 'concurrently'))) {
    const res = npmRun(['install', '--no-fund', '--no-audit'], PKG_ROOT);
    if (res.status !== 0) {
      console.warn('⚠ Falha nas dependências da raiz (npm run dev pode não funcionar; o painel em si não é afetado).');
    } else {
      console.log('✓ Dependências da raiz instaladas.');
    }
  } else {
    console.log('✓ Dependências da raiz já instaladas — nada a fazer.');
  }
  instalarFrontend();
  return true;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function httpGetJson(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ ok: false, status: res.statusCode, body: null });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, body: null }); });
    req.on('error', () => resolve({ ok: false, status: 0, body: null }));
  });
}

async function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await httpGetJson(`http://127.0.0.1:${port}/api/health`, 1000);
    if (res.ok) return res.body;
    await sleep(500);
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function portaLivre(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function resolverPortaUI(portaInicial) {
  /**
   * Devolve a primeira porta livre a partir de portaInicial (padrão 5055).
   * Instâncias anteriores do LeadMaster já foram encerradas pelo kill switch
   * (`encerrarInstanciaAnterior`) antes desta chamada; se uma porta seguir
   * ocupada, é de outro projeto — o launcher avança (5056, 5057, ...).
   * Se nenhuma porta livre no intervalo, devolve {porta: null}.
   */
  for (let i = 0; i < UI_PORT_MAX_TENTATIVAS; i++) {
    const porta = portaInicial + i;
    if (await portaLivre(porta)) {
      return { porta };
    }
    console.log(`ℹ Porta ${porta} ocupada — tentando ${porta + 1}...`);
  }
  return { porta: null };
}

async function procurarInstanciaAtiva(portaInicial, maxTentativas = 10) {
  for (let i = 0; i < maxTentativas; i++) {
    const porta = portaInicial + i;
    const saude = await httpGetJson(`http://127.0.0.1:${porta}/api/health`, 800);
    if (saude.ok && saude.body && (saude.body.versao || saude.body.storage)) {
      return porta;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Lock file global (arquitetura "launcher descartável" — padrão PandaNews)
//
// O launcher Node morre depois de subir o servidor; o lock em
// <home>/leadmaster.pid guarda o PID do backend e a porta para que os
// comandos `kill`/`doctor` (e o kill switch do próximo start) encontrem o
// servidor sem depender de varredura de portas. Lock corrompido ou ausente
// NUNCA pode impedir o arranque — é best-effort.
// ---------------------------------------------------------------------------

const LOCK_FILE = 'leadmaster.pid';

function lockPath(home) {
  return path.join(home, LOCK_FILE);
}

function lerLock(home) {
  try {
    const dados = JSON.parse(readFileSync(lockPath(home), 'utf8'));
    return typeof dados === 'object' && dados ? dados : null;
  } catch {
    return null;
  }
}

function escreverLock(home, pid, porta) {
  try {
    writeFileSync(
      lockPath(home),
      JSON.stringify({ pid, porta, versao: VERSION, iniciado_em: new Date().toISOString() }, null, 2),
    );
  } catch {
    /* lock é best-effort — falhar aqui não derruba o start */
  }
}

function removerLock(home) {
  try {
    unlinkSync(lockPath(home));
  } catch {
    /* já removido ou ausente */
  }
}

// ---------------------------------------------------------------------------
// Kill switch (regra inviolável do AGENTS.md)
//
// O launcher NUNCA deve ignorar uma porta ocupada por outra instância do
// LeadMaster: avisar que já existe instância no ar é PROIBIDO — isso impede
// atualizações (a versão antiga continua rodando, travando arquivos e
// causando EBUSY no npx). Antes de subir a nova versão, encerramos qualquer
// instância anterior confirmada.
//
// Segurança (higiene de processos do AGENTS.md): só mata processos
// CONFIRMADOS como LeadMaster — /api/health respondendo com o payload próprio
// (versao/home/storage) e o PID dono da porta. Processos de outros projetos
// NUNCA são tocados: nesse caso o launcher apenas avança para a próxima porta
// livre, como sempre.
// ---------------------------------------------------------------------------

function saudeEhLeadmaster(body) {
  return Boolean(body && (body.versao || body.storage));
}

function pidsOuvindoPortaWindows(porta) {
  try {
    const out = execSync('netstat -ano', { windowsHide: true, encoding: 'utf8', timeout: 8000 });
    const pids = new Set();
    for (const linha of out.split(/\r?\n/)) {
      if (!linha.includes('LISTENING')) continue;
      const colunas = linha.trim().split(/\s+/);
      if (colunas.length < 5) continue;
      if (!colunas[1].endsWith(`:${porta}`)) continue;
      const pid = Number(colunas[colunas.length - 1]);
      if (Number.isInteger(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

function pidsOuvindoPortaUnix(porta) {
  try {
    const out = execSync(`lsof -ti:${porta} -sTCP:LISTEN`, { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] });
    const pids = out.split(/\s+/).map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
    return [...new Set(pids)];
  } catch {
    // Sem lsof: fallback amplo — processos do LeadMaster na lista de processos.
    try {
      const out = execSync('ps -eo pid=,args=', { encoding: 'utf8', timeout: 8000 });
      const pids = new Set();
      for (const linha of out.split('\n')) {
        const m = linha.trim().match(/^(\d+)\s+(.*)$/);
        if (!m) continue;
        const pid = Number(m[1]);
        const args = m[2];
        const ehLeadmaster = args.includes('leadmaster') && (args.includes('cli.mjs') || args.includes('uvicorn main:app'));
        if (pid > 0 && pid !== process.pid && ehLeadmaster) pids.add(pid);
      }
      return [...pids];
    } catch {
      return [];
    }
  }
}

function matarArvoreProcesso(pid) {
  try {
    if (platform() === 'win32') {
      const r = spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      return r.status === 0;
    }
    process.kill(pid, 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill switch: encerra toda instância anterior do LeadMaster (varre as portas
 * candidatas) antes de subir a nova versão. Portas ocupadas por outros
 * projetos são deixadas em paz (o resolvedor avançará para a próxima porta).
 */
async function encerrarInstanciaAnterior(portaInicial) {
  let encerrouAlguma = false;
  for (let i = 0; i < UI_PORT_MAX_TENTATIVAS; i++) {
    const porta = portaInicial + i;
    const saude = await httpGetJson(`http://127.0.0.1:${porta}/api/health`, 600);
    if (!saude.ok || !saudeEhLeadmaster(saude.body)) continue; // não é LeadMaster — respeitar
    const pids = platform() === 'win32' ? pidsOuvindoPortaWindows(porta) : pidsOuvindoPortaUnix(porta);
    if (pids.length === 0) continue;
    console.log(`ℹ Instância anterior do LeadMaster detectada na porta ${porta} — encerrando (PID ${pids.join(', ')})...`);
    for (const pid of pids) {
      if (!matarArvoreProcesso(pid)) {
        console.warn(`⚠ Não foi possível encerrar o PID ${pid} (permissão?). A nova instância usará outra porta.`);
      }
    }
    encerrouAlguma = true;
    // Aguarda o sistema operacional liberar a porta (até ~5s).
    for (let t = 0; t < 10; t++) {
      await sleep(500);
      const ainda = await httpGetJson(`http://127.0.0.1:${porta}/api/health`, 600);
      if (!ainda.ok) break;
    }
  }
  if (encerrouAlguma) {
    console.log('✓ Instância anterior encerrada — a versão nova assume o controle.');
  }
}

/**
 * Guarda da consola (anti-EPIPE): se o terminal for fechado (MobaXterm, VS
 * Code), escrever em stdout/stderr gera EPIPE — que o Node trataria como
 * uncaughtException, matando o launcher. Esta guarda:
 *  - ignora erros com code EPIPE no evento 'error' do stream;
 *  - espelha toda a saída em storage/logs/launcher_console.log;
 *  - se a escrita original falhar, retorna true silenciosamente.
 * NUNCA REMOVER (regra inviolável do AGENTS.md).
 */
function guardConsoleStream(stream, logFile) {
  stream.on('error', (err) => {
    if (err && err.code === 'EPIPE') return; // terminal fechado: ignora
    return; // demais erros de consola nunca devem derrubar o launcher
  });
  const escritaOriginal = stream.write.bind(stream);
  stream.write = (chunk, encoding, callback) => {
    try {
      appendFileSync(logFile, typeof chunk === 'string' ? chunk : Buffer.from(chunk));
    } catch {
      /* espelho de log é best-effort */
    }
    try {
      return escritaOriginal(chunk, encoding, callback);
    } catch {
      return true; // escrita silenciosa sem exceção
    }
  };
  return stream;
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

async function cmdInstall(args) {
  const home = resolveHome(args);
  const portaInicial = Number.isFinite(args.port) && args.port > 0 ? args.port : UI_PORT;
  console.log(`LeadMaster v${VERSION} — instalação local`);
  console.log('');

  // Kill switch (regra inviolável do AGENTS.md): encerra instâncias anteriores
  // ANTES de instalar — libera os arquivos travados no Windows (erro EBUSY do
  // npx ao atualizar por cima de uma instância rodando).
  await encerrarInstanciaAnterior(portaInicial);

  ensureHome(home);
  console.log(`✓ Pasta de dados pronta: ${home}`);
  console.log(`  (leads, campanhas e configuração ficam em "${path.join(home, 'storage')}")`);

  const python = detectPython();
  if (!python) {
    console.error('✗ Python 3.11+ não encontrado no PATH.');
    console.error('  Instale em https://www.python.org/downloads/ (marque "Add python.exe to PATH").');
    process.exit(1);
  }
  const versionOut = pythonRun(python, ['--version'], { stdio: 'pipe' }).stdout.trim();
  console.log(`✓ Python encontrado: ${versionOut}`);

  if (args.skipPythonDeps) {
    console.log('ℹ Dependências Python não instaladas (--skip-python-deps).');
  } else if (pythonDepsOk(python)) {
    console.log('✓ Dependências Python já estão instaladas — nada a fazer.');
  } else {
    installPythonDeps(python);
  }

  // Frontend (modo repositório): idempotente, só instala o que faltar.
  instalarModoFonte();

  // Runtime permanente: reutiliza a porta inicial já validada pelo kill switch
  // acima, apaga o .runtime anterior (arquivos liberados) e copia esta versão
  // do pacote para lá. Daqui em diante o servidor NUNCA roda de dentro do
  // cache do npx — o EBUSY acaba.
  await encerrarInstanciaAnterior(portaInicial);
  const runtime = copiarParaRuntime(home);
  console.log(`✓ Runtime permanente preparado: ${runtime}`);

  console.log('');
  console.log('Instalação concluída. Para usar (comando único):');
  console.log('  npx --yes @danhachuel/leadmaster@latest');
  console.log(`  (equivalente fixado: npx --yes @danhachuel/leadmaster@${VERSION})`);
  console.log('  (o mesmo comando, sem "install", também verifica e prepara tudo sozinho)');
}

function cmdStart(args) {
  const home = resolveHome(args);
  const portaInicial = Number.isFinite(args.port) && args.port > 0 ? args.port : UI_PORT;

  console.log(`LeadMaster v${VERSION} — iniciando ambiente local`);
  console.log('');

  ensureHome(home);
  console.log(`✓ Pasta de dados: ${home}`);

  (async () => {
    // Kill switch (regra inviolável do AGENTS.md): encerra qualquer instância
    // anterior do LeadMaster (Node + Python) antes de subir a versão nova —
    // nunca deixar a versão antiga no ar nem exibir aviso de reuso.
    await encerrarInstanciaAnterior(portaInicial);

    // Porta: primeira livre a partir de 5055 (→ 5056 → 5057 → ...).
    const { porta } = await resolverPortaUI(portaInicial);
    if (porta === null) {
      console.error(`✗ Nenhuma porta livre entre ${portaInicial} e ${portaInicial + UI_PORT_MAX_TENTATIVAS - 1}.`);
      console.error('  Libere uma porta ou inicie com --port=<numero>.');
      process.exit(1);
    }
    const url = `http://127.0.0.1:${porta}`;
    if (porta !== portaInicial) {
      console.log(`ℹ Porta ${portaInicial} ocupada — usando a porta ${porta}.`);
    }

    const python = detectPython();
    if (!python) {
      console.error('✗ Python 3.11+ não encontrado no PATH. Rode primeiro: npx --yes @danhachuel/leadmaster install');
      process.exit(1);
    }

    if (!pythonDepsOk(python)) {
      if (args.skipPythonDeps) {
        console.warn('⚠ Dependências Python ausentes e --skip-python-deps ativo; o servidor pode não subir.');
      } else {
        installPythonDeps(python);
      }
    } else {
      console.log('✓ Dependências Python OK.');
    }

    // Comando único (estilo Thunderbolt): o start também se auto-prepara.
    // Modo fonte sem deps/build? Instala só o que faltar antes de subir.
    if (existsSync(path.join(PKG_ROOT, 'frontend', 'package.json'))) {
      instalarModoFonte();
    }

    // Kill switch: se uma instância ANTIGA (runtime anterior) ainda ocupar a
    // porta, ela é encerrada antes da nova assumir — nunca reutilizamos.
    await encerrarInstanciaAnterior(portaInicial);

    // Runtime permanente (regra inviolável): o servidor NUNCA roda de dentro
    // do cache do npx (EBUSY na próxima instalação). Sem runtime pronto, o
    // start se auto-aprovisiona copiando para <home>/.runtime; com runtime
    // pronto, reutiliza (sem recopiar nada).
    const runtime = runtimePronto(home) ? runtimeDir(home) : copiarParaRuntime(home);
    console.log(`✓ Executando a partir do runtime permanente: ${runtime}`);

    // -------------------------------------------------------------------------
    // Launcher DESCARTÁVEL (arquitetura PandaNews — regra inviolável do
    // AGENTS.md). O servidor sobe em grupo de processos próprio
    // (detached = CREATE_NEW_PROCESS_GROUP no Windows, imune a Ctrl+C do
    // terminal), com stdio em ARQUIVO (nunca pipes herdados do terminal) e
    // `child.unref()` — o event loop deste launcher NÃO depende do filho.
    // O launcher grava o lock, imprime o sucesso e SAI: o prompt volta, mas
    // o servidor continua no ar até o comando `kill`. Não existe vínculo de
    // morte em nenhum dos dois sentidos.
    // -------------------------------------------------------------------------
    const logPath = path.join(home, 'storage', 'logs', 'backend.log');
    mkdirSync(path.dirname(logPath), { recursive: true });
    const logFd = openSync(logPath, 'a');

    const child = spawn(python.cmd, [...python.args, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(porta), '--no-access-log'], {
      cwd: path.join(runtime, 'backend'),
      env: {
        ...process.env,
        LEADMASTER_HOME: home,
        LEADMASTER_PORT: String(porta),
        LEADMASTER_VERSION: VERSION,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
      stdio: ['ignore', logFd, logFd], // saída em arquivo: não herda o terminal
      detached: true,
      windowsHide: true,
    });
    closeSync(logFd); // o filho tem sua própria cópia herdada do FD
    child.unref(); // launcher descartável: o loop do Node não depende do filho

    // Lock global: PID do backend + porta — sobrevive à morte do launcher.
    escreverLock(home, child.pid ?? null, porta);

    // Durante a curtíssima vida do launcher, sinais espúrios do MobaXterm
    // são absorvidos no Windows (apenas log); SIGTERM/SIGBREAK encerram por
    // código (matam o servidor recém-criado e removem o lock).
    const ehWindows = platform() === 'win32';
    const pararTudo = (codigo) => {
      if (child && child.pid) matarArvoreProcesso(child.pid);
      removerLock(home);
      process.exit(codigo);
    };
    const absorverSinal = (nome) => () => {
      console.log(`[LAUNCHER] Sinal absorvido no Windows (${nome}) — o servidor continua em background.`);
    };
    process.on('SIGINT', ehWindows ? absorverSinal('SIGINT') : () => pararTudo(0));
    process.on('SIGHUP', ehWindows ? absorverSinal('SIGHUP') : () => pararTudo(0));
    process.on('SIGTERM', () => pararTudo(0));
    if (ehWindows) {
      // SIGBREAK (Ctrl+Break): parada legítima também no Windows.
      process.on('SIGBREAK', () => pararTudo(0));
    }

    console.log(`→ Subindo servidor local em ${url} ...`);
    console.log(`  (log do servidor: ${logPath})`);
    const health = await waitForHealth(porta, 120000);
    if (!health) {
      console.error(`✗ O servidor não respondeu em ${url} dentro do tempo limite.`);
      console.error('  Veja os logs acima; rode "npx @danhachuel/leadmaster doctor" para diagnóstico.');
      pararTudo(1);
      return;
    }

    console.log(`✓ LeadMaster rodando em background na porta ${porta} (dados: ${home})`);
    console.log('');
    console.log(`ℹ Abra ${url} no navegador quando quiser — o LeadMaster nunca abre janelas sozinho.`);
    console.log('ℹ O terminal está livre: este launcher encerra e o servidor continua rodando.');
    console.log(`ℹ Para encerrar o servidor: npx --yes @danhachuel/leadmaster@${VERSION} kill`);
    process.exit(0);
  })().catch((err) => {
    console.error('✗ Erro inesperado ao iniciar:', err && err.message ? err.message : err);
    process.exit(1);
  });
}

/**
 * Comando `kill` (alias `stop`): encerra o servidor em background.
 * 1. Lê o lock (<home>/leadmaster.pid) e mata a árvore do PID do backend;
 * 2. Rede de segurança: varre as portas candidatas e encerra instâncias
 *    LeadMaster confirmadas (lock perdido/desatualizado, órfãos);
 * 3. Remove o lock e imprime o resultado.
 */
async function cmdKill(args) {
  const home = resolveHome(args);
  const lock = lerLock(home);
  let matouAlgo = false;

  if (lock && lock.pid) {
    console.log(`ℹ Encerrando servidor em background (PID ${lock.pid}${lock.porta ? `, porta ${lock.porta}` : ''})...`);
    if (matarArvoreProcesso(lock.pid)) {
      matouAlgo = true;
    }
  }

  // Rede de segurança: órfãos LeadMaster (confirmados por health) na porta do
  // lock; sem lock, varre a partir da porta padrão. Processos de outros
  // projetos nunca são tocados.
  const portaBase = lock && lock.porta ? lock.porta : UI_PORT;
  await encerrarInstanciaAnterior(portaBase);
  removerLock(home);

  if (matouAlgo) {
    console.log('✓ Servidor encerrado com sucesso.');
  } else {
    console.log('ℹ Nenhum servidor do LeadMaster estava rodando.');
  }
}

async function cmdDoctor(args) {
  const home = resolveHome(args);
  const portaInicial = Number.isFinite(args.port) && args.port > 0 ? args.port : UI_PORT;
  console.log(`LeadMaster v${VERSION} — diagnóstico`);
  console.log('');
  console.log(`Node ............... ${process.version}`);
  console.log(`Pasta de dados ..... ${home} ${existsSync(path.join(home, 'storage')) ? '(OK)' : '(ainda não criada — rode install)'}`);

  const python = detectPython();
  if (python) {
    const v = pythonRun(python, ['--version'], { stdio: 'pipe' }).stdout.trim();
    console.log(`Python ............. ${v} (${python.cmd})`);
    console.log(`Dependências ....... ${pythonDepsOk(python) ? 'OK (fastapi, uvicorn, httpx, pydantic)' : 'AUSENTES — rode install'}`);
  } else {
    console.log('Python ............. NÃO ENCONTRADO no PATH');
  }

  const ativaEm = await procurarInstanciaAtiva(portaInicial);
  console.log(`Servidor UI ........ ${ativaEm ? `rodando em http://127.0.0.1:${ativaEm}` : `parado (porta inicial ${portaInicial})`}`);
  const lock = lerLock(home);
  if (lock && lock.pid) {
    console.log(`Lock do servidor ... PID ${lock.pid}${lock.porta ? ` · porta ${lock.porta}` : ''}${lock.versao ? ` · versão ${lock.versao}` : ''}`);
  } else {
    console.log('Lock do servidor ... ausente (nenhum start registrado)');
  }
  const hasDist = existsSync(path.join(PKG_ROOT, 'frontend', 'dist', 'index.html'));
  console.log(`Interface (dist) ... ${hasDist ? 'presente' : 'ausente (modo dev ou rebuild necessário)'}`);
  console.log(`Runtime permanente . ${runtimePronto(home) ? `pronto (${runtimeDir(home)})` : 'ausente — rode install'}`);
  console.log('');
  console.log('Diagnóstico concluído.');
}

function cmdHelp() {
  console.log(`LeadMaster v${VERSION} — SaaS local de prospecção e automação de conteúdo`);
  console.log('');
  console.log('Uso: npx --yes @danhachuel/leadmaster@<versão> [comando] [flags]');
  console.log('');
  console.log('Comandos:');
  console.log('  install   Prepara a pasta de dados e instala dependências Python.');
  console.log('  start     Sobe o servidor em background (padrão) e imprime a URL — o terminal fica livre.');
  console.log('  kill      Encerra o servidor em background (alias: stop).');
  console.log('  doctor    Diagnóstico do ambiente.');
  console.log('  version   Mostra a versão.');
  console.log('  help      Esta ajuda.');
  console.log('');
  console.log('Arquitetura: o servidor roda destacado (background) e sobrevive ao terminal.');
  console.log('Para encerrar, use sempre o comando kill — fechar o terminal não o derruba.');
  console.log('');
  console.log('Flags:');
  console.log('  --home=<caminho>   Pasta de dados (padrão: Documents\\REPOSITORIO\\LeadMaster).');
  console.log('  --port=<numero>     Porta inicial da UI (padrão: 5055; se ocupada, tenta 5056, 5057, ...).');
  console.log('  --skip-python-deps  Pula instalação de dependências Python (CI).');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;
  } catch {
    return 'desconhecida';
  }
})();

const rawArgs = process.argv.slice(2);
const args = parseArgs(rawArgs);
const command = args._[0] || 'start';

// Guarda da consola (anti-EPIPE) aplicada ANTES de qualquer escrita do
// launcher: espelha stdout/stderr em storage/logs/launcher_console.log e
// ignora EPIPE (terminal fechado) — regra inviolável do AGENTS.md.
const homeLauncher = resolveHome(args);
const LOG_DIR = path.join(homeLauncher, 'storage', 'logs');
mkdirSync(LOG_DIR, { recursive: true });
const CONSOLE_LOG = path.join(LOG_DIR, 'launcher_console.log');
[process.stdout, process.stderr].forEach((stream) => guardConsoleStream(stream, CONSOLE_LOG));

// Nunca manter o cwd dentro do cache do npx: o launcher nasce com o cwd de
// onde o usuário rodou o comando; assim que sabemos o home, saímos de lá —
// nenhum processo nosso segura diretório do cache (fim do EBUSY no npx).
try {
  process.chdir(homeLauncher);
} catch {
  /* melhor esforço */
}

switch (command) {
  case 'install':
    // cmdInstall é async (kill switch): a promise mantém o evento vivo até o
    // fim; rejeições são logadas pelos handlers globais e encerram com código 1.
    cmdInstall(args).catch((err) => {
      console.error('✗ Erro inesperado na instalação:', err && err.message ? err.message : err);
      process.exit(1);
    });
    break;
  case 'start': cmdStart(args); break;
  case 'kill': case 'stop':
    // Launcher descartável: o kill também é efêmero — encerra e sai.
    cmdKill(args).catch((err) => {
      console.error('✗ Erro inesperado ao encerrar:', err && err.message ? err.message : err);
      process.exit(1);
    });
    break;
  case 'doctor': cmdDoctor(args); break;
  case 'version': console.log(VERSION); break;
  case 'help': case '--help': case '-h': cmdHelp(); break;
  default:
    console.error(`Comando desconhecido: "${command}". Rode "npx @danhachuel/leadmaster help".`);
    process.exit(1);
}
