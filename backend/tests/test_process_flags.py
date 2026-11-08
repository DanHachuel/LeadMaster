"""Testes de isolamento de processos (Windows process groups).

Verificam que os workers são criados com CREATE_NEW_PROCESS_GROUP |
CREATE_NO_WINDOW no Windows e sem flags no POSIX — para que Ctrl+C do terminal
não derrube launcher e workers em cascata (STATUS_CONTROL_C_EXIT).

Nota de portabilidade: em vez de mockar `os.name` globalmente (o que quebra
`pathlib` nas duas direções — "nt" fingido no Linux e "posix" fingido no
Windows), os testes usam o parâmetro `so` do helper e mockam o próprio helper.
Assim passam idênticos no GitHub Actions (Linux) e no Windows local.
"""

import os
import subprocess
import sys
from unittest.mock import patch

from services import extractors
from services.flags import _WINDOWS_FLAGS, creationflags

FLAGS_WINDOWS = _WINDOWS_FLAGS  # 0x00000200 | 0x08000000


def _config_fake() -> dict:
    return {
        "extratores": {
            # sys.executable existe em qualquer plataforma — o run é mockado.
            "google_maps_cli": sys.executable,
            "google_maps_args": '--kw "{palavra_chave}" --loc "{localizacao}" --email --max {max_resultados} --outdir "{outdir}"',
            "igmapper_cli": sys.executable,
            "igmapper_args": "--profile {url} --outdir {outdir}",
        }
    }


def _completed_process(*_args, **_kwargs) -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")


class TestFlags:
    def test_windows_aplica_novo_grupo_e_sem_janela(self):
        flags = creationflags("nt")
        assert flags & 0x00000200, "CREATE_NEW_PROCESS_GROUP ausente"
        assert flags & 0x08000000, "CREATE_NO_WINDOW ausente"
        assert flags == FLAGS_WINDOWS

    def test_posix_sem_flags(self):
        assert creationflags("posix") == 0

    def test_plataforma_real_sem_parametro(self):
        esperado = FLAGS_WINDOWS if os.name == "nt" else 0
        assert creationflags() == esperado


class TestExtratores:
    def _extrair_maps(self):
        return extractors.extrair_google_maps("dentista", "São Paulo SP", 10)

    def _rodar_com_flags(self, valor_flags):
        with (
            patch.object(extractors.proc_flags, "creationflags", return_value=valor_flags),
            patch.object(extractors.storage, "get_config", return_value=_config_fake()),
            patch.object(extractors.subprocess, "run", side_effect=_completed_process) as run_mock,
        ):
            self._extrair_maps()
        assert run_mock.called
        return run_mock

    def test_google_maps_repassa_flags_windows(self):
        run_mock = self._rodar_com_flags(FLAGS_WINDOWS)
        assert run_mock.call_args.kwargs["creationflags"] == FLAGS_WINDOWS

    def test_google_maps_repassa_zero_posix(self):
        run_mock = self._rodar_com_flags(0)
        assert run_mock.call_args.kwargs["creationflags"] == 0

    def test_instagram_repassa_flags_windows(self):
        with (
            patch.object(extractors.proc_flags, "creationflags", return_value=FLAGS_WINDOWS),
            patch.object(extractors.storage, "get_config", return_value=_config_fake()),
            patch.object(extractors.subprocess, "run", side_effect=_completed_process) as run_mock,
        ):
            try:
                extractors.extrair_instagram("https://instagram.com/padaria.do.largo/")
            except extractors.ExtratorErro:
                pass  # saída mockada vazia → "sem dados reconhecíveis" (esperado)
        assert run_mock.called
        assert run_mock.call_args.kwargs["creationflags"] == FLAGS_WINDOWS
