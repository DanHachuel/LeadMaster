#!/usr/bin/env node
/**
 * LeadMaster — SaaS local de prospecção e automação de conteúdo.
 * Launcher oficial do pacote NPM (@danhachuel/leadmaster).
 *
 * Comandos:
 *   install  Prepara a pasta de dados (home) e instala as dependências Python.
 *   start    Sobe o backend FastAPI (serving da UI construída) e abre o navegador.
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

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

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

function openBrowser(url) {
  try {
    if (platform() === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    else if (platform() === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    console.log(`Abra manualmente: ${url}`);
  }
}

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
   * Varre portas a partir de portaInicial (padrão 5055):
   *  - se encontrar uma instância saudável do LeadMaster, devolve {jaRodando: true};
   *  - senão devolve a primeira porta livre {jaRodando: false, porta};
   *  - se nenhuma porta livre no intervalo, devolve {porta: null}.
   */
  for (let i = 0; i < UI_PORT_MAX_TENTATIVAS; i++) {
    const porta = portaInicial + i;
    const saude = await httpGetJson(`http://127.0.0.1:${porta}/api/health`, 800);
    if (saude.ok && saude.body && (saude.body.versao || saude.body.storage)) {
      return { jaRodando: true, porta };
    }
    if (await portaLivre(porta)) {
      return { jaRodando: false, porta };
    }
    console.log(`ℹ Porta ${porta} ocupada — tentando ${porta + 1}...`);
  }
  return { jaRodando: false, porta: null };
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
// Comandos
// ---------------------------------------------------------------------------

function cmdInstall(args) {
  const home = resolveHome(args);
  console.log(`LeadMaster v${VERSION} — instalação local`);
  console.log('');
  ensureHome(home);
  console.log(`✓ Pasta de dados pronta: ${home}`);
  console.log(`  (leads, campanhas, pipeline e configuração ficam em "${path.join(home, 'storage')}")`);

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
    console.log('✓ Dependências Python já estão instaladas.');
  } else {
    installPythonDeps(python);
  }

  console.log('');
  console.log('Instalação concluída. Próximos passos:');
  console.log(`  1. Inicie o painel:  npx --yes @danhachuel/leadmaster@${VERSION}`);
  console.log(`  2. Ou por aqui:      node scripts/cli.mjs start`);
  console.log('  3. O navegador abrirá automaticamente no painel local.');
}

function cmdStart(args) {
  const home = resolveHome(args);
  const portaInicial = Number.isFinite(args.port) && args.port > 0 ? args.port : UI_PORT;

  console.log(`LeadMaster v${VERSION} — iniciando ambiente local`);
  console.log('');

  ensureHome(home);
  console.log(`✓ Pasta de dados: ${home}`);

  (async () => {
    // Resolve a porta: reusa instância ativa ou pega a primeira livre (5055 → 5056 → ...).
    const { jaRodando, porta } = await resolverPortaUI(portaInicial);
    if (porta === null) {
      console.error(`✗ Nenhuma porta livre entre ${portaInicial} e ${portaInicial + UI_PORT_MAX_TENTATIVAS - 1}.`);
      console.error('  Libere uma porta ou inicie com --port=<numero>.');
      process.exit(1);
    }
    const url = `http://127.0.0.1:${porta}`;
    if (jaRodando) {
      console.log(`ℹ LeadMaster já está rodando em ${url} — abrindo o navegador.`);
      openBrowser(url);
      process.exit(0);
      return;
    }
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

    const hasDist = existsSync(path.join(PKG_ROOT, 'frontend', 'dist', 'index.html'));
    if (!hasDist) {
      console.warn('⚠ Interface construída não encontrada (frontend/dist).');
      if (existsSync(path.join(PKG_ROOT, 'frontend', 'src'))) {
        console.warn('  Modo desenvolvimento: rode "npm run dev" na raiz para usar o Vite dev server.');
      }
    }

    const child = spawn(python.cmd, [...python.args, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(porta)], {
      cwd: path.join(PKG_ROOT, 'backend'),
      env: {
        ...process.env,
        LEADMASTER_HOME: home,
        LEADMASTER_PORT: String(porta),
        LEADMASTER_VERSION: VERSION,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const prefix = (buf, tag) =>
      buf
        .toString('utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => console.log(`[${tag}] ${line}`));
    child.stdout.on('data', (d) => prefix(d, 'api'));
    child.stderr.on('data', (d) => prefix(d, 'api'));

    child.on('exit', (code) => {
      console.log(code === 0 ? '\nLeadMaster encerrado. Até já!' : `\n✗ Servidor local encerrou com código ${code}.`);
      process.exit(code === null ? 1 : code);
    });

    const stop = () => {
      console.log('\nEncerrando LeadMaster...');
      if (platform() === 'win32' && child.pid) {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
      } else {
        child.kill('SIGTERM');
      }
    };
    process.on('SIGINT', () => { stop(); process.exit(0); });
    process.on('SIGTERM', () => { stop(); process.exit(0); });
    if (platform() === 'win32') process.on('SIGHUP', () => { stop(); process.exit(0); });

    console.log(`→ Subindo servidor local em ${url} ...`);
    const health = await waitForHealth(porta, 120000);
    if (!health) {
      console.error(`✗ O servidor não respondeu em ${url} dentro do tempo limite.`);
      console.error('  Veja os logs acima; rode "npx @danhachuel/leadmaster doctor" para diagnóstico.');
      stop();
      process.exit(1);
    }
    console.log(`✓ LeadMaster no ar em ${url} (dados: ${home})`);
    openBrowser(url);
    console.log('');
    console.log('Pressione Ctrl+C para encerrar.');
  })().catch((err) => {
    console.error('✗ Erro inesperado ao iniciar:', err && err.message ? err.message : err);
    process.exit(1);
  });
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
  const hasDist = existsSync(path.join(PKG_ROOT, 'frontend', 'dist', 'index.html'));
  console.log(`Interface (dist) ... ${hasDist ? 'presente' : 'ausente (modo dev ou rebuild necessário)'}`);
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
  console.log('  start     Sobe o servidor local e abre o navegador (padrão).');
  console.log('  doctor    Diagnóstico do ambiente.');
  console.log('  version   Mostra a versão.');
  console.log('  help      Esta ajuda.');
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

switch (command) {
  case 'install': cmdInstall(args); break;
  case 'start': cmdStart(args); break;
  case 'doctor': cmdDoctor(args); break;
  case 'version': console.log(VERSION); break;
  case 'help': case '--help': case '-h': cmdHelp(); break;
  default:
    console.error(`Comando desconhecido: "${command}". Rode "npx @danhachuel/leadmaster help".`);
    process.exit(1);
}
