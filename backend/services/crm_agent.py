"""Agente de CRM: sugere movimentações de etapa e enriquece leads.

Funciona 100% local com heurísticas; quando um LLM está configurado, as
sugestões passam por uma triagem por IA (mais contexto, mais confiança).
Nunca move o lead automaticamente: o usuário aplica a sugestão.
"""

import httpx

from . import extractors, llm, storage


def _score(lead: dict) -> int:
    pontos = 0
    if lead.get("telefone"):
        pontos += 20
    if lead.get("email"):
        pontos += 20
    if lead.get("empresa") or lead.get("cnpj"):
        pontos += 15
    if lead.get("cidade") or lead.get("endereco"):
        pontos += 10
    if lead.get("observacoes"):
        pontos += 10
    if lead.get("tags"):
        pontos += 5
    base = int(lead.get("score") or 0)
    return min(100, max(base, pontos))


def sugerir_movimentacoes() -> dict:
    """Heurísticas + (opcional) refinamento por LLM. Retorna {sugestoes: [...]}."""
    leads = storage.list_leads()
    sugestoes = []

    for lead in leads:
        etapa = lead.get("etapa", "leads")
        score = _score(lead)
        contato_completo = bool(lead.get("telefone")) or bool(lead.get("email"))

        if etapa == "leads" and contato_completo and score >= 60:
            sugestoes.append(
                {
                    "lead_id": lead["id"],
                    "lead_nome": lead.get("nome"),
                    "de": "leads",
                    "para": "em_contato",
                    "confianca": min(0.95, score / 100),
                    "motivo": "Contato completo e score alto — pronto para o primeiro contato.",
                }
            )
        elif etapa == "em_contato" and lead.get("observacoes", "").strip():
            sugestoes.append(
                {
                    "lead_id": lead["id"],
                    "lead_nome": lead.get("nome"),
                    "de": "em_contato",
                    "para": "proposta",
                    "confianca": 0.7,
                    "motivo": "Já existe histórico de conversa (observações preenchidas) — hora da proposta.",
                }
            )
        elif etapa == "proposta" and score >= 85:
            sugestoes.append(
                {
                    "lead_id": lead["id"],
                    "lead_nome": lead.get("nome"),
                    "de": "proposta",
                    "para": "fechado",
                    "confianca": 0.8,
                    "motivo": "Proposta madura com dados completos — chegou a hora de fechar.",
                }
            )

    if llm.configurado() and sugestoes:
        try:
            texto_leads = "\n".join(
                f"- {s['lead_nome']}: {s['de']} → {s['para']} (motivo heurístico: {s['motivo']})"
                for s in sugestoes[:15]
            )
            resposta = llm.chat(
                [
                    {
                        "role": "system",
                        "content": (
                            "Você é um revisor de CRM. Avalie as sugestões de movimentação de leads. "
                            'Responda APENAS JSON: {"aprovadas": [índices numéricos]} '
                            "com os índices (0-based) das sugestões que fazem sentido comercialmente."
                        ),
                    },
                    {"role": "user", "content": texto_leads},
                ],
                temperature=0.2,
                max_tokens=200,
            )
            import json as _json

            dados = _json.loads(resposta[resposta.find("{") :])
            aprovados = set(dados.get("aprovadas", []))
            for i, s in enumerate(sugestoes):
                if i not in aprovados:
                    s["motivo"] += " (IA não endossou — confira antes de aplicar)"
                    s["confianca"] *= 0.5
        except Exception:
            pass  # IA é refinamento, não requisito — heurísticas já valem

    return {"sugestoes": sugestoes[:20]}


def enriquecer_lead(lead_id: str) -> dict:
    """Enriquece um lead: CNPJ via BrasilAPI, score recalculado e notas."""
    lead = None
    for l in storage.list_leads():
        if l.get("id") == lead_id:
            lead = l
            break
    if not lead:
        return {"ok": False, "mensagem": "Lead não encontrado."}

    patch, notas = {}, []

    if lead.get("cnpj") and not lead.get("empresa"):
        try:
            dados = extractors.consulta_cnpj(lead["cnpj"])
            for campo in ("empresa", "telefone", "endereco", "cidade", "email"):
                if not lead.get(campo) and dados.get(campo):
                    patch[campo] = dados[campo]
            notas.append("Dados de CNPJ preenchidos via BrasilAPI.")
        except extractors.ExtratorErro as e:
            notas.append(f"CNPJ não enriquecido: {e}")

    patch["score"] = _score({**lead, **patch})

    if llm.configurado():
        try:
            resposta = llm.chat(
                [
                    {
                        "role": "system",
                        "content": (
                            "Você é assistente comercial. Responda APENAS JSON: "
                            '{"resumo": "uma frase", "tags": ["até 3 tags"]}'
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Lead: {lead.get('nome')} | empresa: {lead.get('empresa')} | cidade: "
                            f"{lead.get('cidade')} | fonte: {lead.get('fonte')} | observações: "
                            f"{lead.get('observacoes')}"
                        ),
                    },
                ],
                temperature=0.3,
                max_tokens=200,
            )
            import json as _json

            dados = _json.loads(resposta[resposta.find("{") :])
            if dados.get("resumo"):
                patch["resumo_ia"] = dados["resumo"]
                notas.append("Resumo gerado por IA.")
            if dados.get("tags"):
                patch["tags"] = dados["tags"][:3]
        except Exception:
            notas.append("IA indisponível no momento — enriquecimento apenas com dados locais.")

    atualizado = storage.update_lead(lead_id, patch)
    return {"ok": True, "lead": atualizado, "notas": notas}


def calcular_completude(lead: dict) -> int:
    campos = ["nome", "telefone", "email", "empresa", "cidade", "observacoes"]
    preenchidos = sum(1 for c in campos if (lead.get(c) or "").strip())
    return int(round(preenchidos / len(campos) * 100))
