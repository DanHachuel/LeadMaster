"""Cliente LLM (API OpenAI-compatível) com fallback local para roteiros.

A configuração fica em `config.json → llm` (provedor, base_url, api_key, modelo).
Se o LLM não estiver configurado, os roteiros são gerados por um modelo local
(template estruturado) e a origem é sempre informada ao usuário — nunca fingimos
uma geração por IA.
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


def chat(mensagens: list, temperature: float = 0.7, max_tokens: int = 4000) -> str:
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


# ---------------------------------------------------------------------------
# Roteiro (7k–9k caracteres)
# ---------------------------------------------------------------------------

def gerar_roteiro(tema: str, titulo: str = "", tom: str = "informativo", duracao_min: int = 8) -> dict:
    """Gera o roteiro do vídeo faceless. Retorna {roteiro, origem, aviso}."""
    if configurado():
        sistema = (
            "Você é um roteirista profissional de vídeos faceless para YouTube, "
            "especialista em retenção. Escreva em português do Brasil."
        )
        usuario = (
            f"Escreva um roteiro completo para um vídeo faceless de YouTube sobre: {tema}.\n"
            f"Título de trabalho: {titulo or '(crie um título)'}\n"
            f"Tom: {tom}. Duração estimada: {duracao_min} minutos.\n"
            "REQUISITOS:\n"
            "- Entre 7000 e 9000 caracteres de texto corrido (sem marcadores de cena).\n"
            "- Comece com um gancho de 2 frases que prende na primeira.\n"
            "- Use seções lógicas, exemplos concretos e números.\n"
            "- Termine com CTA para inscrever-se no canal.\n"
            "- Apenas o texto do roteiro, sem títulos em markdown."
        )
        try:
            texto = chat(
                [{"role": "system", "content": sistema}, {"role": "user", "content": usuario}],
                temperature=0.8,
                max_tokens=6000,
            )
            return {"roteiro": texto.strip(), "origem": "llm", "aviso": ""}
        except LLMErro as e:
            raise  # configurado mas falhou: etapa deve falhar com mensagem acionável
    return {
        "roteiro": _roteiro_local(tema, titulo, tom, duracao_min),
        "origem": "local",
        "aviso": "LLM não configurado — roteiro gerado por modelo local (rascunho). Configure o LLM em Ferramentas para roteiros completos de 7k–9k caracteres.",
    }


def _roteiro_local(tema: str, titulo: str, tom: str, duracao_min: int) -> str:
    """Rascunho estruturado, honesto sobre sua origem local."""
    titulo = titulo or f"{tema}: o guia definitivo"
    blocos = max(3, duracao_min)
    linhas = [
        f"[GANCHO] {titulo}. Nos próximos {duracao_min} minutos você vai entender exatamente "
        f"como {tema.lower()} funciona na prática — e por que quase todo mundo erra nisso. Fica até o final.",
        "",
        "[INTRODUÇÃO]",
        f"Antes de qualquer coisa: o que é {tema.lower()}? É a diferença entre agir no escuro "
        "e agir com método. Neste vídeo eu vou te mostrar o passo a passo completo.",
        "",
    ]
    for i in range(1, blocos + 1):
        linhas += [
            f"[PARTE {i} — PONTO-CHAVE {i}]",
            f"Primeiro, o contexto: a maior parte das pessoas que tenta {tema.lower()} falha porque "
            "pula a etapa de preparação. Não faça isso. Comece pelo diagnóstico simples: onde você "
            "está hoje e qual é o resultado mínimo que já mudaria seu jogo.",
            f"Segundo, a execução: escolha UMA estratégia de {tema.lower()} e execute-a por 14 dias "
            "sem mudar de rota. Registre os números. O que não é medido não melhora.",
            f"Terceiro, o erro comum da parte {i}: fazer mais do mesmo esperando resultado diferente. "
            "Ajuste uma variável por vez e observe.",
            "",
        ]
    linhas += [
        "[ENCERRAMENTO E CTA]",
        "Se esse vídeo te ajudou, se inscreve no canal e ativa o sininho — toda semana tem "
        f"conteúdo novo sobre {tema.lower()}. Comenta aqui qual etapa você vai aplicar primeiro. Até o próximo!",
        "",
        "(Rascunho gerado localmente pelo LeadMaster, sem LLM. Configure seu LLM em "
        "Ferramentas para gerar roteiros completos de 7.000 a 9.000 caracteres.)",
    ]
    return "\n".join(linhas)


def gerar_titulo_e_thumbnail(tema: str, roteiro: str) -> dict:
    """Gera título otimizado + prompt de thumbnail. Retorna {titulo, titulo_alternativo, thumbnail_prompt, origem}."""
    if configurado():
        try:
            resposta = chat(
                [
                    {
                        "role": "system",
                        "content": (
                            "Você é especialista em SEO de YouTube. Responda APENAS com JSON válido, "
                            'sem markdown, no formato: {"titulo": "...", "titulo_alternativo": "...", '
                            '"thumbnail_prompt": "..."}. Títulos com até 60 caracteres, thumbnail_prompt '
                            "em português, descrevendo imagem sem texto legível."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Tema do vídeo: {tema}\n\nRoteiro (início):\n{roteiro[:1500]}",
                    },
                ],
                temperature=0.6,
                max_tokens=500,
            )
            import json as _json

            inicio = resposta.find("{")
            dados = _json.loads(resposta[inicio:] if inicio >= 0 else resposta)
            return {
                "titulo": dados.get("titulo", ""),
                "titulo_alternativo": dados.get("titulo_alternativo", ""),
                "thumbnail_prompt": dados.get("thumbnail_prompt", ""),
                "origem": "llm",
            }
        except (LLMErro, ValueError, KeyError):
            pass  # cai no fallback local abaixo
    return {
        "titulo": f"{tema}: o guia definitivo (passo a passo)",
        "titulo_alternativo": f"Como dominar {tema} em pouco tempo",
        "thumbnail_prompt": (
            f"Imagem 16:9 vibrante sobre {tema}, estilo minimalista de alto contraste, "
            "pessoa em silhueta olhando para resultado crescente, cores indigo e roxo, sem texto."
        ),
        "origem": "local",
    }
