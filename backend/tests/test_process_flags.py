"""Testes de isolamento de processos (Windows process groups).

Verificam que os workers são criados com CREATE_NEW_PROCESS_GROUP |
CREATE_NO_WINDOW no Windows e sem flags no POSIX — para que Ctrl+C do terminal
não derrube launcher e workers em cascata (STATUS_CONTROL_C_EXIT).

Rodam no GitHub Actions (Linux) e no Windows local: `os.name` e `subprocess.run`
são mockados. Exceção: fingir "posix" no Windows quebra `pathlib` (PosixPath não
instancia nesse cenário) — nesse caso o teste é pulado; no Linux CI ele roda
nativamente.
"""

import os
import subprocess
import sys
from unittest.mock import patch

import pytest

from services import extractors
from services.flags import creationflags

# CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW (valores literais — os nomes
# nem sempre existem em todas as plataformas POSIX).
FLAGS_WINDOWS = 0x00000200 | 0x08000000

_SO_WINDOWS_REAL = os.name == "nt"


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
        with patch("os.name", "nt"):
            flags = creationflags()
        assert flags & 0x00000200, "CREATE_NEW_PROCESS_GROUP ausente"
        assert flags & 0x08000000, "CREATE_NO_WINDOW ausente"
        assert flags == FLAGS_WINDOWS

    def test_posix_sem_flags(self):
        with patch("os.name", "posix"):
            assert creationflags() == 0


class TestExtratores:
    def _extrair_maps(self):
        return extractors.extrair_google_maps("dentista", "São Paulo SP", 10)

    def test_google_maps_windows_com_flags(self):
        with (
            patch("os.name", "nt"),
            patch.object(extractors.storage, "get_config", return_value=_config_fake()),
            patch.object(extractors.subprocess, "run", side_effect=_completed_process) as run_mock,
        ):
            self._extrair_maps()
        assert run_mock.called
        assert run_mock.call_args.kwargs["creationflags"] == FLAGS_WINDOWS

    @pytest.mark.skipif(
        _SO_WINDOWS_REAL,
        reason="fingir posix no Windows quebra pathlib; no Linux CI roda nativamente",
    )
    def test_google_maps_posix_sem_flags(self):
        with (
            patch.object(extractors.storage, "get_config", return_value=_config_fake()),
            patch.object(extractors.subprocess, "run", side_effect=_completed_process) as run_mock,
        ):
            self._extrair_maps()
        assert run_mock.called
        assert run_mock.call_args.kwargs["creationflags"] == 0

    def test_instagram_windows_com_flags(self):
        with (
            patch("os.name", "nt"),
            patch.object(extractors.storage, "get_config", return_value=_config_fake()),
            patch.object(extractors.subprocess, "run", side_effect=_completed_process) as run_mock,
        ):
            try:
                extractors.extrair_instagram("https://instagram.com/padaria.do.largo/")
            except extractors.ExtratorErro:
                pass  # saída mockada vazia → "sem dados reconhecíveis" (esperado)
        assert run_mock.called
        assert run_mock.call_args.kwargs["creationflags"] == FLAGS_WINDOWS
