"""Integração com o OpenMontage (CLI local, fallback de produção de vídeos).

O caminho do executável é configurável em Ferramentas → OpenMontage.
Como as flags do CLI podem variar entre versões, usamos um template de
argumentos configurável com os placeholders {roteiro} e {saida}.
"""

import subprocess
from pathlib import Path

from . import storage


class IntegracaoNaoConfigurada(Exception):
    """Caminho do CLI não configurado — mensagem acionável."""


class ExecucaoErro(Exception):
    """O CLI falhou; stderr vai na mensagem."""


def _conf() -> dict:
    return storage.get_config()["integracoes"]["openmontage"]


def disponivel() -> bool:
    cli = _conf().get("cli_path", "")
    return bool(cli) and Path(cli).exists()


def produzir(job_id: str, roteiro_path: str) -> dict:
    """Executa o OpenMontage com o roteiro e devolve {video_path}."""
    conf = _conf()
    cli = conf.get("cli_path", "")
    if not cli or not Path(cli).exists():
        raise IntegracaoNaoConfigurada(
            "OpenMontage não configurado. Informe o caminho do executável em "
            "Ferramentas → OpenMontage (https://github.com/openmotional/OpenMontage) "
            "ou mantenha o MoneyPrinterTurbo ativo."
        )
    saida = storage.videos_dir() / job_id
    saida.mkdir(parents=True, exist_ok=True)
    try:
        resultado = subprocess.run(
            [cli, roteiro_path, "--output", str(saida)],
            capture_output=True,
            text=True,
            timeout=1800,
            shell=False,
        )
    except FileNotFoundError as e:
        raise IntegracaoNaoConfigurada(f"Não foi possível executar o CLI do OpenMontage: {e}") from e
    except subprocess.TimeoutExpired as e:
        raise ExecucaoErro("OpenMontage passou de 30 minutos sem concluir.") from e
    if resultado.returncode != 0:
        raise ExecucaoErro(f"OpenMontage terminou com código {resultado.returncode}: {resultado.stderr[-400:]}")
    mp4 = sorted(saida.glob("*.mp4"))
    return {
        "video_path": str(mp4[-1]) if mp4 else None,
        "pasta_saida": str(saida),
        "observacao": "" if mp4 else "Execução OK, mas nenhum .mp4 encontrado na pasta de saída.",
    }
