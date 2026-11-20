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

    def test_bloqueio_total_dummy_server(self):
        # Regra 0.1.46 (pedido do usuário): a ÚNICA forma comprovada de segurar
        # o Node sob o npx.cmd é um servidor HTTP escutando (socket do SO) +
        # fluxo principal congelado. PROIBIDOS readline e setInterval.
        c = _conteudo()
        codigo = _codigo_sem_comentarios()
        corpo = _corpo_cmd_start()
        assert "readline" not in codigo, "readline voltou (proibido)"
        assert "setInterval" not in codigo, "setInterval voltou (proibido)"
        assert "http.createServer" in corpo
        assert "dummyServer.listen(0, '127.0.0.1')" in corpo
        assert "await new Promise(() => {})" in corpo
        # Ctrl+C por processo (não readline) com cleanup completo.
        assert "process.on('SIGINT'" in corpo
        inicio = corpo.index("process.on('SIGINT'")
        fim = corpo.index("})", inicio)
        handler = corpo[inicio:fim]
        assert "pararTudo(" in handler or "matarArvoreProcesso" in handler

    def test_nao_ha_exit_no_caminho_de_sucesso(self):
        # Após a mensagem de sucesso, o launcher NÃO chama process.exit nem
        # retorna — quem segura é o dummy server + o fluxo congelado; a saída
        # acontece só pelo SIGINT/SIGTERM/SIGBREAK (ou erros acionáveis, que
        # ficam ANTES desta marca).
        corpo = _corpo_cmd_start()
        assert "LeadMaster no ar em" in corpo
        assert "await new Promise(() => {})" in corpo
        trecho = corpo[corpo.index("LeadMaster no ar em") : corpo.index("await new Promise")]
        assert "process.exit(" not in trecho

    # ------------------------------------------------------------------
    # Fim dos modelos anteriores: keep-alives e unref são PROIBIDOS
    # ------------------------------------------------------------------

    def test_exit_trace_obrigatorio(self):
        # Regra 0.1.46: todo encerramento do launcher imprime o stack trace e
        # o código — exit 0 inesperado ganha aviso explícito de loop esvaziado.
        c = _conteudo()
        assert "process.on('exit'" in c
        assert "O LAUNCHER ESTÁ ENCERRANDO COM CÓDIGO" in c
        assert "Stack trace do encerramento:" in c
        assert "event loop esvaziou" in c

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

    def test_proibidos_do_modelo_antigo(self):
        # Regra 0.1.46: sob o npx.cmd, readline e setInterval não seguram o
        # Node; dummy server + promise congelada são a regra.
        codigo = _codigo_sem_comentarios()
        for proibido in ("process.stdin.resume", "beforeExit"):
            assert proibido not in codigo, f"proibido voltou: {proibido}"
        assert "child.unref" not in codigo  # modelo descartável saiu
