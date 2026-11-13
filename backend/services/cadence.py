"""Cadências de follow-up — reengajamento automático de leads parados.

Uma cadência observa uma etapa do Kanban; quando um lead está parado nela além
do `dias_espera`, o worker aplica a `acao` (mover de etapa ou adicionar a tag
"Frio") e registra a execução. O worker roda em background via asyncio
(lifespan do FastAPI), no intervalo definido em config → cadencias.intervalo_horas.
"""

import asyncio
from datetime import datetime, timedelta

from . import agents, storage

INTERVALO_PADRAO_HORAS = 1


def _intervalo_horas() -> float:
    try:
        valor = float(storage.get_config().get("cadencias", {}).get("intervalo_horas", INTERVALO_PADRAO_HORAS))
        return max(0.5, valor)
    except (TypeError, ValueError):
        return INTERVALO_PADRAO_HORAS


def _parse_data(valor: str | None) -> datetime | None:
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor)
    except ValueError:
        return None


def aplicar_acao(lead: dict, acao: str) -> dict:
    """Aplica a ação da cadência em um lead; retorna {patch, descricao}."""
    if acao == "mover_para_proposta":
        return {"etapa": "proposta"}, "movido de Em Contato para Proposta"
    if acao == "mover_para_em_contato":
        return {"etapa": "em_contato"}, "movido de Leads para Em Contato"
    if acao == "adicionar_tag_frio":
        tags = list(lead.get("tags") or [])
        if "Frio" not in tags:
            tags.append("Frio")
        return {"tags": tags}, 'recebeu a tag "Frio"'
    raise ValueError(f"Ação de cadência desconhecida: {acao}")


def verificar_cadencias_agora() -> list:
    """Executa uma verificação imediata. Retorna as execuções realizadas."""
    agora = datetime.now().astimezone()
    executadas: list = []

    for cadencia in storage.list_cadences():
        if not cadencia.get("ativo", True):
            continue
        etapa_gatilho = cadencia.get("etapa_gatilho")
        dias = int(cadencia.get("dias_espera") or 0)
        acao = cadencia.get("acao")
        if dias <= 0 or etapa_gatilho not in ("leads", "em_contato", "proposta"):
            continue

        for lead in storage.list_leads():
            if lead.get("etapa") != etapa_gatilho:
                continue
            referencia = _parse_data(lead.get("atualizado_em")) or _parse_data(lead.get("criado_em"))
            if not referencia or referencia + timedelta(days=dias) > agora:
                continue
            try:
                patch, descricao = aplicar_acao(lead, acao)
                atualizado = storage.update_lead(lead["id"], patch)
            except (ValueError, TypeError):
                continue
            if not atualizado:
                continue
            registro = {
                "lead_id": lead["id"],
                "lead_nome": lead.get("nome"),
                "acao": acao,
                "descricao": descricao,
                "executada_em": storage.now_iso(),
            }
            executadas.append(registro)
            cadencia.setdefault("ultimas_execucoes", []).insert(0, registro)
            cadencia["ultimas_execucoes"] = cadencia["ultimas_execucoes"][:50]
            cadencia["ultima_verificacao"] = registro["executada_em"]
            storage.upsert_cadence(cadencia)

    if executadas:
        agents.disparar_webhook("cadencia.executada", {"total": len(executadas)})
    return executadas


async def worker_loop() -> None:
    """Loop infinito do worker (asyncio.create_task no lifespan)."""
    while True:
        try:
            await asyncio.to_thread(verificar_cadencias_agora)
        except Exception:
            pass  # o worker é resiliente: nunca derruba a API
        await asyncio.sleep(_intervalo_horas() * 3600)
