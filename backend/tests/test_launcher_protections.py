"""Gate de regressão da arquitetura do launcher (scripts/cli.mjs).

Lê o launcher e falha se qualquer proteção contra encerramento silencioso no
Windows (MobaXterm) for removida:

1. Keep-alive com setInterval (event loop ativo sem I/O de console);
2. Terminal preso: `process.stdin.resume();` (PTY do MobaXterm nunca fecha);
   sem `process.exit(0)` no caminho de sucesso e sem `.unref()` no worker;
3. Kill switch: instância anterior do LeadMaster encerrada antes de subir a
   nova versão (taskkill/lsof pelo PID da porta) — nunca reuso de instância;
4. Absorção de SIGINT/SIGHUP no Windows (apenas log, sem encerrar);
5. Função guardConsoleStream (anti-EPIPE com espelho em arquivo de log);
6. Isolamento do worker Python (detached: true / CREATE_NEW_PROCESS_GROUP).
"""

from pathlib import Path

CAMINHO = Path(__file__).resolve().parents[2] / "scripts" / "cli.mjs"


def _conteudo() -> str:
    assert CAMINHO.exists(), f"launcher não encontrado em {CAMINHO}"
    return CAMINHO.read_text(encoding="utf-8")


class TestLauncherProtections:
    def test_keepalivo(self):
        assert "setInterval(() => {}, 1000)" in _conteudo()

    def test_terminal_preso_stdin_resume(self):
        assert "process.stdin.resume();" in _conteudo()

    def test_worker_nunca_unref(self):
        assert ".unref()" not in _conteudo()

    def test_kill_switch_mata_instancia_anterior(self):
        # Regra inviolável: nunca ignorar uma porta ocupada por outra instância
        # do LeadMaster — matar o processo antigo antes de subir o novo. Sem
        # isso a versão antiga trava arquivos (EBUSY no npx) e a nova não sobe.
        c = _conteudo()
        assert "encerrarInstanciaAnterior" in c
        assert "taskkill" in c  # Windows: mata a árvore do PID da porta
        assert "netstat" in c or "lsof" in c  # descoberta do PID pela porta
        # Avisar que já existe instância no ar é proibido (impede atualizações).
        assert "já está rodando" not in c

    def test_ciclo_de_vida_vinculado(self):
        c = _conteudo()
        assert "child.on('exit'" in c or "child.on(\"exit\"" in c
        assert "child.on('close'" in c or "child.on(\"close\"" in c
        assert "process.on('exit'" in c or "process.on(\"exit\"" in c

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

    def test_kill_switch_presente(self):
        c = _conteudo()
        assert "encerrarInstanciaAnterior" in c
        assert "netstat" in c  # descoberta do PID no Windows
        assert "lsof" in c  # descoberta do PID no Linux/macOS
        assert "taskkill" in c and "/F" in c  # kill switch Windows

    def test_nunca_avisa_ja_esta_rodando(self):
        # Mensagem proibida: impede atualizações e deixa a versão antiga no ar.
        assert "já está rodando" not in _conteudo().lower()
        assert "ja esta rodando" not in _conteudo().lower()

    def test_sigterm_nao_absorvido(self):
        # SIGTERM/SIGBREAK são paradas legítimas: sempre encerram.
        c = _conteudo()
        assert "SIGTERM" in c and "SIGBREAK" in c
        assert "naoAbsorver" in c
