"""Cliente LLM (API OpenAI-compatível) para os agentes do LeadMaster.

A configuração fica em `config.json → llm` (provedor, base_url, api_key, modelo).
Usado pelo agente de CRM (enriquecimento/sugestões) e pelo agente de atendimento.
Se o LLM não estiver configurado, as heurísticas locais assumem e a mensagem
sempre informa o que fazer — nunca fingimos uma resposta de IA.
"""

import httpx

from . import storage


class LLMNaoConfigurado(Exception):
    """LLM não configurado — mensagem acionável para Ferramentas → LLM."""


class LLMErro(Exception):
    """LLM configurado, mas a chamada falhou."""


def _conf() -> dict:
    return storage.get_config().get("llm", {})


def configurado() -> bool:
    c = _conf()
    return bool(c.get("api_key") and c.get("base_url"))


def chat(mensagens: list, temperature: float = 0.7, max_tokens: int = 2000) -> str:
    c = _conf()
    if not configurado():
        raise LLMNaoConfigurado(
            "LLM não configurado. Vá em Ferramentas → LLM, informe base_url, api_key e modelo."
        )
    url = c["base_url"].rstrip("/") + "/chat/completions"
    try:
        r = httpx.post(
            url,
            headers={"Authorization": f"Bearer {c['api_key']}"},
            json={
                "model": c.get("modelo", "gpt-4o-mini"),
                "messages": mensagens,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
            timeout=180,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise LLMErro(f"LLM respondeu HTTP {e.response.status_code}: {e.response.text[:300]}") from e
    except httpx.HTTPError as e:
        raise LLMErro(f"Falha de conexão com o LLM ({url}): {e}") from e


def testar_conexao() -> dict:
    try:
        resposta = chat(
            [{"role": "user", "content": "Responda apenas com: OK"}],
            temperature=0,
            max_tokens=8,
        )
        return {"ok": True, "resposta": resposta.strip()[:100]}
    except LLMNaoConfigurado as e:
        return {"ok": False, "mensagem": str(e)}
    except LLMErro as e:
        return {"ok": False, "mensagem": str(e)}
