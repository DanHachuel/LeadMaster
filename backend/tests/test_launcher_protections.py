"""Gate de regressão da arquitetura do launcher (scripts/cli.mjs).

Lê o launcher e falha se qualquer proteção contra encerramento silencioso no
Windows (MobaXterm) for removida:

1. Keep-alive com setInterval (event loop ativo sem I/O de console);
2. Absorção de SIGINT/SIGHUP no Windows (apenas log, sem encerrar);
3. Função guardConsoleStream (anti-EPIPE com espelho em arquivo de log);
4. Isolamento do worker Python (detached: true / CREATE_NEW_PROCESS_GROUP).
"""

from pathlib import Path

CAMINHO = Path(__file__).resolve().parents[2] / "scripts" / "cli.mjs"


def _conteudo() -> str:
    assert CAMINHO.exists(), f"launcher não encontrado em {CAMINHO}"
    return CAMINHO.read_text(encoding="utf-8")


class TestLauncherProtections:
    def test_keepalivo(self):
        assert "setInterval(() => {}, 1000)" in _conteudo()

    def test_absorcao_de_sinais_no_windows(self):
        c = _conteudo()
        assert "SIGINT" in c and "SIGTERM" in c and "SIGHUP" in c
        assert "absorvido" in c

    def test_guarda_anti_epipe(self):
        c = _conteudo()
        assert "guardConsoleStream" in c
        assert "EPIPE" in c
        assert "launcher_console.log" in c

    def test_isolamento_do_worker(self):
        c = _conteudo()
        assert "detached: true" in c
        assert "windowsHide: true" in c

    def test_sigterm_nao_absorvido(self):
        # SIGTERM/SIGBREAK são paradas legítimas: sempre encerram.
        c = _conteudo()
        assert "SIGTERM" in c and "SIGBREAK" in c
        assert "naoAbsorver" in c
