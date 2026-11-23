"""Gate de regressão da arquitetura do launcher (scripts/cli.mjs).

Modelo vigente (0.1.48): LAUNCHER DESCARTÁVEL (padrão PandaNews). Mais de 10
tentativas comprovaram que o terminal (PTY/cmd.exe/npx.cmd) SEMPRE mata o Node
e, com ele, o Python — por isso o terminal preso foi abandonado. O `start`:
  1. sobe o Python com `stdio: ['ignore', logFd, logFd]` (tudo em
     storage/logs/backend.log), `detached: true` (grupo próprio) e
     `windowsHide: true`;
  2. dá `fs.closeSync(logFd)` e `child.unref()` — o Node NÃO espera pelo filho;
  3. confirma o health (nunca finge sucesso: crash na subida avisa com o fim
     do log e encerra com código);
  4. grava o lock (`leadmaster.pid`), imprime o sucesso e ENCERRA — o prompt
     volta e o Python segue no ar até o `kill`.

São PROIBIDOS (falha do gate): readline, setInterval, dummy server
(`http.createServer`), `await new Promise`, `process.stdin.resume`, `beforeExit`
e qualquer amarração da morte do Python à do Node após o sucesso.
Continuam valendo: lock file, comando kill, kill switch, guarda da consola.
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
    # Espinha dorsal do modelo descartável (PandaNews)
    # ------------------------------------------------------------------

    def test_spawn_desacoplado_stdio_em_arquivo(self):
        # Regra 0.1.48 (pedido do usuário): NENHUM pipe/inherit para o
        # terminal — stdout/stderr do Python vão direto para backend.log.
        corpo = _corpo_cmd_start()
        assert "fs.openSync(" in corpo
        assert "backend.log" in corpo
        assert "stdio: ['ignore', logFd, logFd]" in corpo
        assert "fs.closeSync(logFd)" in corpo
        assert "logFd" in corpo

    def test_unref_obrigatorio_modelo_descartavel(self):
        # Sem `child.unref()` o Node esperaria o filho e o terminal preso
        # voltaria — o oposto exato do padrão PandaNews.
        codigo = _codigo_sem_comentarios()
        assert "child.unref()" in codigo, "child.unref() desapareceu (obrigatório no modelo descartável)"

    def test_worker_isolado(self):
        corpo = _corpo_cmd_start()
        assert "detached: true" in corpo  # grupo próprio: sobrevive ao terminal
        assert "windowsHide: true" in corpo  # nunca janela de console

    def test_mensagem_de_sucesso_instrui_o_kill(self):
        # A mensagem final ensina: background, caminho do log, navegador e
        # encerramento pelo kill.
        corpo = _corpo_cmd_start()
        assert "LeadMaster rodando em background na porta" in corpo
        assert "Os logs estão em:" in corpo
        assert "backend.log" in corpo
        assert "Abra o navegador" in corpo
        assert "Para encerrar o servidor, rode: npx --yes @danhachuel/leadmaster kill" in corpo

    def test_nenhum_keep_alive_no_start(self):
        # Zero âncoras de terminal: após a mensagem de sucesso o launcher
        # encerra naturalmente e o prompt volta (comportamento esperado).
        codigo = _codigo_sem_comentarios()
        for proibido in (
            "readline",
            "setInterval",
            "http.createServer",
            "await new Promise",
            "process.stdin.resume",
            "beforeExit",
        ):
            assert proibido not in codigo, f"keep-alive proibido voltou: {proibido}"

    def test_morte_do_python_nao_amarrada_ao_node(self):
        # Após o sucesso, a morte do Python NÃO encerra nada (o launcher já
        # saiu). Durante a subida, o crash avisa com o fim do log.
        corpo = _corpo_cmd_start()
        assert "child.on('exit'" in corpo
        assert "Servidor local encerrou" in corpo
        assert "sucessoAnunciado" in corpo  # o handler só age ANTES do sucesso

    def test_exit_trace_sem_alarme_no_sucesso(self):
        # Saída com código 0 (inclusive no `start`, por design) não é alarme —
        # o trace só acusa encerramentos inesperados (código ≠ 0).
        c = _conteudo()
        assert "process.on('exit'" in c
        assert "O LAUNCHER ESTÁ ENCERRANDO COM CÓDIGO" in c
        assert "Stack trace do encerramento:" in c
        codigo = _codigo_sem_comentarios()
        assert "if (code === 0) return" in codigo
        assert "event loop esvaziou" not in codigo  # alarme do modelo preso saiu

    # ------------------------------------------------------------------
    # Nunca fingir sucesso (continua valendo)
    # ------------------------------------------------------------------

    def test_captura_de_erro_no_spawn(self):
        corpo = _corpo_cmd_start()
        # Sem listener, erro de spawn virava exceção silenciosa.
        assert "child.on('error'" in corpo
        assert "ERRO CRÍTICO AO INICIAR O PYTHON" in corpo
        inicio = corpo.index("child.on('error'")
        fim = corpo.index("});", inicio)
        handler = corpo[inicio:fim]
        assert "process.exit(1)" in handler

    def test_health_confirmado_antes_do_sucesso(self):
        corpo = _corpo_cmd_start()
        assert "waitForHealth(" in corpo
        assert "não respondeu" in corpo  # falha do health é acionável
        assert "backend.log" in corpo    # falha aponta para o log

    def test_runtime_verificado_antes_do_spawn(self):
        corpo = _corpo_cmd_start()
        assert "Runtime corrompido" in corpo  # mensagem acionável
        assert "backend', 'main.py'" in corpo or "backend', \"main.py\"" in corpo

    def test_handlers_globais_com_exit(self):
        c = _conteudo()
        # uncaughtException encerra com código (nunca silencioso).
        assert "process.on('uncaughtException'" in c
        assert "process.exit(1)" in c

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

    def test_start_bat_descartavel(self):
        # Regra 0.1.47/0.1.48: o install gera um start.bat que roda o launcher
        # DIRETO pelo node (sem npx no meio) e dá `exit` — a janela preta fecha
        # sozinha (sem `pause`), porque o servidor fica no ar em background.
        c = _conteudo()
        codigo = _codigo_sem_comentarios()
        assert "gerarStartBat(" in c
        assert "async function cmdInstall(" in c
        install = c[c.index("async function cmdInstall(") : c.index("function cmdStart(")]
        assert "gerarStartBat(home)" in install
        assert 'node "%~dp0.runtime' in c
        assert "'exit'" in c
        assert "pause" not in codigo  # a janela preta fecha sozinha (sem pause)