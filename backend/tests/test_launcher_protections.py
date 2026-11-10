"""Gate de regressão da arquitetura do launcher (scripts/cli.mjs).

Arquitetura "launcher descartável" (padrão PandaNews, adotada na 0.1.33):
o launcher sobe o servidor DESTACADO, grava o lock e SAI — o servidor
sobrevive ao terminal e só morre pelo comando `kill` (ou pelo kill switch
do próximo start). O gate falha se qualquer peça dessa arquitetura for
removida ou se o modelo antigo (terminal preso) voltar.
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
    # Espinha dorsal da arquitetura descartável
    # ------------------------------------------------------------------

    def test_spawn_destacado_com_stdio_em_arquivo(self):
        corpo = _corpo_cmd_start()
        assert "spawn(" in corpo
        assert "detached: true" in corpo  # grupo próprio: imune a Ctrl+C
        assert "windowsHide: true" in corpo  # nunca janela de console
        assert "stdio: ['ignore', logFd, logFd]" in corpo  # NUNCA pipes no terminal
        assert "openSync(logPath, 'a')" in corpo  # FD do arquivo de log

    def test_launcher_descartavel_unref(self):
        corpo = _corpo_cmd_start()
        # O event loop do launcher NÃO depende do filho (ele sai sozinho).
        assert "child.unref();" in corpo
        # ...e o launcher encerra após o sucesso (prompt volta de propósito).
        assert "process.exit(0);" in corpo
        assert "rodando em background" in corpo

    # ------------------------------------------------------------------
    # Fim do modelo antigo: é PROIBDO segurar o terminal
    # ------------------------------------------------------------------

    def test_proibido_segurar_o_terminal(self):
        codigo = _codigo_sem_comentarios()
        for proibido in (
            "process.stdin.resume",
            "http.createServer",  # dummy server
            "await new Promise",  # congelamento do fluxo
            "setInterval",  # keep-alive
            "beforeExit",
        ):
            assert proibido not in codigo, f"keep-alive proibido voltou: {proibido}"

    def test_proibido_vinculo_de_morte(self):
        codigo = _codigo_sem_comentarios()
        # O launcher NÃO pode matar o Python ao morrer, nem morrer com ele.
        assert "child.on('exit'" not in codigo
        assert "child.on('close'" not in codigo
        assert "process.on('exit'" not in codigo

    # ------------------------------------------------------------------
    # Lock file + comando kill
    # ------------------------------------------------------------------

    def test_lock_file_global(self):
        codigo = _codigo_sem_comentarios()
        assert "leadmaster.pid" in codigo  # arquivo de lock
        assert "escreverLock(" in codigo  # gravado no start
        assert "lerLock(" in codigo  # lido no kill/doctor
        assert "removerLock(" in codigo  # removido no kill

    def test_comando_kill(self):
        c = _conteudo()
        assert "'kill'" in c and "'stop'" in c  # dispatcher aceita os dois
        assert "async function cmdKill(" in c
        assert "taskkill" in c  # Windows: /F /T por PID
        kill = c[c.index("async function cmdKill(") : c.index("async function cmdDoctor(")]
        assert "matarArvoreProcesso" in kill
        assert "encerrarInstanciaAnterior" in kill  # rede de segurança por porta
        assert "removerLock" in kill
        assert "Servidor encerrado com sucesso" in kill

    def test_mensagem_final_ensina_o_kill(self):
        corpo = _corpo_cmd_start()
        assert "leadmaster kill" in corpo or "@${VERSION} kill" in corpo

    # ------------------------------------------------------------------
    # Proteções que permanecem (higiene e isolamento)
    # ------------------------------------------------------------------

    def test_kill_switch_mata_instancia_anterior(self):
        c = _conteudo()
        assert "encerrarInstanciaAnterior" in c
        assert "taskkill" in c
        assert "netstat" in c or "lsof" in c
        assert "já está rodando" not in c

    def test_isolamento_do_worker(self):
        c = _conteudo()
        assert "detached: true" in c
        assert "windowsHide: true" in c
