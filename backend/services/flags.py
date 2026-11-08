"""Flags de criação de subprocessos, isolados no Windows.

Problema que resolve: quando o terminal (MobaXterm, VS Code, perda de foco)
envia Ctrl+C, o evento de interrupção (STATUS_CONTROL_C_EXIT / 0xC000013A) é
propagado a todo o *grupo de processos* do terminal — derrubando launcher E
workers juntos, corrompendo extrações e trabalhos em andamento.

Solução: cada worker nasce em seu PRÓPRIO grupo de processos no Windows
(`CREATE_NEW_PROCESS_GROUP`) e sem janela (`CREATE_NO_WINDOW`); assim,
interrupções de terminal não cascateiam para os workers, e quem encerra o
worker é o launcher, de forma controlada.

No Linux/macOS o launcher já spawna com `detached: true` (sessão própria) e
`creationflags` retorna 0 — não há alteração de comportamento.

O parâmetro `so` existe para os testes: assim é possível verificar os dois
comportamentos sem mockar `os.name` globalmente (o que quebraria `pathlib`
nas duas direções — fingir "nt" no Linux e "posix" no Windows).
"""

import os
import subprocess

# CREATE_NEW_PROCESS_GROUP = 0x00000200 (grupo isolado de sinais do console)
# CREATE_NO_WINDOW        = 0x08000000 (não abrir janela de console)
# getattr com fallback literal: CREATE_NO_WINDOW não existe em todas as
# plataformas POSIX — o módulo precisa importar limpo no Linux (CI) também.
_WINDOWS_FLAGS = (
    getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200)
    | getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
)


def creationflags(so: str | None = None) -> int:
    """Flags a passar em subprocess.run/Popen. 0 no Linux/macOS."""
    if so is None:
        so = os.name
    if so == "nt":
        return _WINDOWS_FLAGS
    return 0
