"""Gate de regressão da arquitetura do launcher (scripts/cli.mjs).

Modelo vigente (0.1.42): TERMINAL PRESO (foreground). O servidor sobe com
`stdio: 'inherit'` (logs do FastAPI em tempo real no terminal) e o launcher
fica preso pelo `readline` em escopo de MÓDULO (referência viva — sem GC) —
que também captura o Ctrl+C de forma limpa (mata o worker por código e
remove o lock). Falhas NUNCA são silenciosas: `child.on('error')` e
`child.on('exit')` logam o motivo, o runtime é verificado antes do spawn e
EOF na entrada não derruba o processo. São PROIBIDOS os keep-alives do modelo
anterior (setInterval, stdin.resume, dummy server, beforeExit,
await new Promise) e o `child.unref()` do modelo descartável.
"""

import re
from pathlib import Path

CAMINHO = Path(__file__).resolve().parents[2] / "scripts" / "cli.mjs"


def _conteudo() -> str:
    assert CAMINHO.exists(), f"launcher não encontrado em {CAMINHO}"
    return CAMINHO.read_text(encoding="utf-8")


def _codigo_sem_comentarios() -> str:
    """Código efetivo (comentários removidos) — regras valem para o CÓDIGO:
    menções em comentários/explicativos não contam."""
    sem_bloco = re.sub(r"/\*.*?\*/", "", _conteudo(), flags=re.DOTALL)
    return re.sub(r"//[^\n]*", "", sem_bloco)


def _corpo_cmd_start() -> str:
    c = _conteudo()
    assert "function cmdStart(" in c, "função cmdStart não encontrada"
    inicio = c.index("function cmdStart(")
    fim = c.index("async function cmdKill(")
    return c[inicio:fim]


class TestLauncherProtections:
    # ------------------------------------------------------------------
    # Espinha dorsal do modelo foreground
    # ------------------------------------------------------------------

    def test_pipe_manual_com_encaminhamento(self):
        # Regra 0.1.45: sob o npx.cmd o `inherit` engolia a saída do uvicorn
        # quando a PTY morria. Agora o filho sobe com pipe e o launcher
        # encaminha CADA byte manualmente (+ espelho em backend.log), então um
        # crash do Python NUNCA fica invisível.
        corpo = _corpo_cmd_start()
        assert "stdio: ['ignore', 'pipe', 'pipe']" in corpo
        assert "child.stdout.on('data'" in corpo
        assert "child.stderr.on('data'" in corpo
        assert "backend.log" in corpo

    def test_terminal_preso_por_readline(self):
        c = _conteudo()
        corpo = _corpo_cmd_start()
        assert "import readline from 'node:readline'" in c
        assert "readline.createInterface" in corpo
        # A interface vive em escopo de MÓDULO (referência viva — sem GC).
        assert "let readlineUi" in c
        assert "readlineUi = readline.createInterface" in corpo
        assert "readlineUi.on('SIGINT'" in corpo  # Ctrl+C limpo
        # O handler de Ctrl+C mata o worker e remove o lock (nunca órfã).
        inicio = corpo.index("readlineUi.on('SIGINT'")
        fim = corpo.index("});", inicio)
        handler = corpo[inicio:fim]
        assert "pararTudo(" in handler or "matarArvoreProcesso" in handler

    def test_nao_ha_exit_no_caminho_de_sucesso(self):
        # Após a mensagem de sucesso, o launcher NÃO chama process.exit —
        # quem segura é o readline; a saída acontece só pelo Ctrl+C/SIGTERM/
        # SIGBREAK (ou por erros acionáveis, que ficam ANTES desta marca).
        corpo = _corpo_cmd_start()
        assert "LeadMaster no ar em" in corpo
        trecho = corpo[corpo.index("LeadMaster no ar em") : corpo.index("readline.createInterface")]
        assert "process.exit(" not in trecho

    # ------------------------------------------------------------------
    # Fim dos modelos anteriores: keep-alives e unref são PROIBIDOS
    # ------------------------------------------------------------------

    def test_ancora_secundaria_setinterval(self):
        # Regra 0.1.45 (pedido do usuário): âncora bruta de event loop —
        # setInterval NÃO-unref'd, criado só depois do health OK e limpado no
        # cleanup. É a SEGUNDA âncora (a primeira é o handle do filho).
        codigo = _codigo_sem_comentarios()
        assert "keepAlive = setInterval(() => {}, 1000)" in codigo
        assert "clearInterval(keepAlive)" in codigo
        # Proibidos seguem proibidos.
        for proibido in (
            "process.stdin.resume",
            "http.createServer",  # dummy server
            "await new Promise",  # congelamento do fluxo
            "beforeExit",
        ):
            assert proibido not in codigo, f"keep-alive proibido voltou: {proibido}"

    def test_proibido_unref_descartavel(self):
        codigo = _codigo_sem_comentarios()
        assert "child.unref" not in codigo  # modelo background/descartável saiu

    def test_worker_isolado(self):
        corpo = _corpo_cmd_start()
        assert "detached: true" in corpo  # grupo próprio: Ctrl+C não o derruba
        assert "windowsHide: true" in corpo  # nunca janela de console

    # ------------------------------------------------------------------
    # Lock file + comando kill + kill switch (continuam valendo)
    # ------------------------------------------------------------------

    def test_lock_file_global(self):
        codigo = _codigo_sem_comentarios()
        assert "leadmaster.pid" in codigo
        assert "escreverLock(" in codigo
        assert "lerLock(" in codigo
        assert "removerLock(" in codigo

    def test_comando_kill(self):
        c = _conteudo()
        assert "'kill'" in c and "'stop'" in c
        assert "async function cmdKill(" in c
        assert "taskkill" in c
        kill = c[c.index("async function cmdKill(") : c.index("async function cmdDoctor(")]
        assert "matarArvoreProcesso" in kill
        assert "encerrarInstanciaAnterior" in kill
        assert "removerLock" in kill
        assert "Servidor encerrado com sucesso" in kill

    # ------------------------------------------------------------------
    # Isolamento e higiene
    # ------------------------------------------------------------------

    def test_kill_switch_mata_instancia_anterior(self):
        c = _conteudo()
        assert "encerrarInstanciaAnterior" in c
        assert "netstat" in c or "lsof" in c
        assert "já está rodando" not in c

    def test_captura_de_erro_no_spawn(self):
        corpo = _corpo_cmd_start()
        # Sem listener, erro de spawn virava exceção silenciosa.
        assert "child.on('error'" in corpo
        assert "ERRO CRÍTICO AO INICIAR O PYTHON" in corpo
        inicio = corpo.index("child.on('error'")
        fim = corpo.index("});", inicio)
        handler = corpo[inicio:fim]
        assert "process.exit(1)" in handler

    def test_morte_do_servidor_nao_e_silenciosa(self):
        corpo = _corpo_cmd_start()
        # Crash do uvicorn DEVE avisar no terminal antes de liberar o prompt.
        assert "child.on('exit'" in corpo
        assert "Servidor local encerrou" in corpo

    def test_runtime_verificado_antes_do_spawn(self):
        corpo = _corpo_cmd_start()
        assert "Runtime corrompido" in corpo  # mensagem acionável
        assert "backend', 'main.py'" in corpo or "backend', \"main.py\"" in corpo

    def test_handlers_globais_com_exit(self):
        c = _conteudo()
        # uncaughtException encerra com código (nunca silencioso).
        assert "process.on('uncaughtException'" in c
        assert "process.exit(1)" in c

    def test_eof_do_stdin_nao_derruba_o_launcher(self):
        corpo = _corpo_cmd_start()
        # EOF na entrada (wrapper do npx) NÃO pode matar o launcher.
        assert "readlineUi.on('close'" in corpo
        assert "EOF" in corpo
