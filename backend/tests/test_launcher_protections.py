"""Gate de regressão da arquitetura do launcher (scripts/cli.mjs).

Lê o launcher e falha se qualquer proteção contra encerramento silencioso no
Windows (MobaXterm) for removida:

1. Keep-alive com setInterval (event loop ativo sem I/O de console);
2. Terminal preso com `process.stdin.resume();` (solução definitiva contra a
   devolução do prompt — o Node fica vivo ouvindo a entrada padrão);
3. Ausência de `.unref()` no worker Python (o pai não pode morrer sozinho);
4. Absorção de SIGINT/SIGHUP no Windows (apenas log, sem encerrar);
5. Função guardConsoleStream (anti-EPIPE com espelho em arquivo de log);
6. Isolamento do worker Python (detached: true / CREATE_NEW_PROCESS_GROUP).
"""

from pathlib import Path
import re

CAMINHO = Path(__file__).resolve().parents[2] / "scripts" / "cli.mjs"


def _conteudo() -> str:
    assert CAMINHO.exists(), f"launcher não encontrado em {CAMINHO}"
    return CAMINHO.read_text(encoding="utf-8")


def _codigo_sem_comentarios() -> str:
    """Código efetivo do launcher (comentários removidos).

    Regras de arquitetura valem para o CÓDIGO: menções em comentários
    (explicações, nomes de funções proibidas) não contam.
    """
    sem_bloco = re.sub(r"/\*.*?\*/", "", _conteudo(), flags=re.DOTALL)
    sem_linha = re.sub(r"//[^\n]*", "", sem_bloco)
    return sem_linha


class TestLauncherProtections:
    def test_keepalivo(self):
        assert "setInterval(() => {}, 1000)" in _conteudo()

    def test_stdin_resume_prende_terminal(self):
        # Solução definitiva: sem esta linha o MobaXterm devolve o prompt
        # logo após "LeadMaster no ar..." e fecha a PTY (e o uvicorn junto).
        assert "process.stdin.resume();" in _conteudo()

    def test_worker_nunca_unref(self):
        # O filho Python referenciado mantém o pai vivo; .unref() permitiria
        # a morte prematura do launcher. Comentários podem mencionar a regra.
        assert ".unref()" not in _codigo_sem_comentarios()

    def test_ciclo_de_vida_vinculado(self):
        # Python cai → launcher cai (child 'close'); launcher morre → filho morre.
        c = _conteudo()
        assert "child.on('close'" in c
        assert "process.on('exit'" in c
        assert "Servidor encerrado" in c

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

    def test_erros_globais_logados(self):
        # Erros silenciosos (rejeições/exceções) são logados, não matam o launcher.
        c = _conteudo()
        assert "unhandledRejection" in c
        assert "uncaughtException" in c
