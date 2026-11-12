"""Gate de regressão da arquitetura do launcher (scripts/cli.mjs).

Modelo vigente (0.1.34): TERMINAL PRESO (foreground). O servidor sobe com
`stdio: 'inherit'` (logs do FastAPI no terminal em tempo real) e o launcher
fica preso pelo `readline` — que também captura o Ctrl+C de forma limpa
(mata o worker por código e remove o lock). São PROIBIDOS os keep-alives do
modelo anterior (setInterval, stdin.resume, dummy server, beforeExit,
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

    def test_stdio_inherit_logs_no_terminal(self):
        corpo = _corpo_cmd_start()
        assert "stdio: 'inherit'" in corpo  # logs do FastAPI em tempo real
        assert "logFd" not in corpo  # nada de saída em arquivo

    def test_terminal_preso_por_readline(self):
        corpo = _corpo_cmd_start()
        assert "import readline from 'node:readline'" in _conteudo()
        assert "readline.createInterface" in corpo
        assert "rl.on('SIGINT'" in corpo  # Ctrl+C limpo
        # O handler de Ctrl+C mata o worker e remove o lock (nunca órfã).
        inicio = corpo.index("rl.on('SIGINT'")
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

    def test_proibido_keepalive_antigo(self):
        codigo = _codigo_sem_comentarios()
        for proibido in (
            "process.stdin.resume",
            "http.createServer",  # dummy server
            "await new Promise",  # congelamento do fluxo
            "setInterval",  # keep-alive de timer
            "beforeExit",
        ):
            assert proibido not in codigo, f"keep-alive proibido voltou: {proibido}"

    def test_proibido_unref_descartavel(self):
        codigo = _codigo_sem_comentarios()
        assert "child.unref" not in codigo  # modelo background/descartável saiu

    def test_proibido_stdio_pipe_no_servidor(self):
        codigo = _codigo_sem_comentarios()
        corpo = _corpo_cmd_start()
        assert "stdio: 'pipe'" not in corpo
        assert "stdio: ['ignore', 'pipe', 'pipe']" not in corpo

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

    def test_worker_isolado(self):
        corpo = _corpo_cmd_start()
        assert "detached: true" in corpo  # grupo próprio: Ctrl+C não o derruba
        assert "windowsHide: true" in corpo  # nunca janela de console
