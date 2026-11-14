# Skill: Surgical Scope Guard (Escopo Cirúrgico)

**Propósito:** impedir refatorações não solicitadas e alterações em arquivos sensíveis.
No Thunderbolt, agentes "aproveitavam" uma tarefa para renomear variáveis, limpar
imports e reformatar arquivos inteiros — quebrando comportamento sem ninguém pedir.

## Regra do menor arquivo possível

- Tarefa de UI → só arquivos em `frontend/src/`.
- Tarefa de rota/API → só `backend/main.py` + o serviço envolvido + testes.
- Tarefa de launcher → só `scripts/cli.mjs` (+ workflow se mexer em release).
- **Documentação** (`AGENTS.md`, `CHANGELOG.md`, `README.md`) muda quando o release
  exige, nunca por vontade própria.

## Proibições absolutas

1. **Não renomear** variáveis, funções ou campos fora do escopo da tarefa.
2. **Não limpar** imports "não usados" que não estão causando erro de build.
3. **Não reformatar** arquivos inteiros (nunca `write` num arquivo grande só para trocar
   duas linhas — use patch).
4. **Não remover** código morto que você não criou.
5. **Não "melhorar"** mensagens, logs ou nomes de rotas existentes.

## Arquivos sensíveis — alterar SOMENTE com autorização explícita do usuário

| Arquivo | Por quê |
|---|---|
| `package.json` | versionamento/publicação NPM (só bump de release) |
| `scripts/cli.mjs` | arquitetura do launcher (regras invioláveis no AGENTS.md) |
| `frontend/vite.config.ts` | build/porta/proxy |
| `backend/main.py` | contrato REST inteiro |
| `AGENTS.md` | regras do projeto (só por instrução direta) |
| `.github/workflows/publish-npm.yml` | esteira de release |

## Teste de escopo

Antes do commit, pergunte: *"cada arquivo alterado era estritamente necessário para a
feature pedida?"* Se a resposta for não para algum arquivo, retire-o do commit.