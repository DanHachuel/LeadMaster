# Skill: Parallel Session Guard (Sessões Paralelas)

**Propósito:** impedir que duas sessões de agente no mesmo repositório sobrescrevam o
trabalho uma da outra. O usuário do LeadMaster **corre múltiplas sessões simultâneas**
e o histórico de versões já mostrou colisões reais (E409 no registry: "Cannot publish
over previously staged version").

## Proibições

1. **Nunca** abrir uma sessão de alteração de código enquanto outra estiver rodando no
   mesmo diretório. Se `git status` mostrar arquivos modificados que **não são da sua
   tarefa**, **pare** e reporte ao usuário antes de tocar em qualquer arquivo.
2. **Nunca** usar `git add -A` sem antes ler `git status --short` completo.
3. **Nunca** reescrever arquivos inteiros (`write`/`nova versão`) quando um simples patch
   resolve — arquivos podem ter sido alterados por outra sessão entre a sua leitura e a
   sua escrita.

## Fluxo obrigatório antes de cada push

```bash
git fetch origin
git status -sb            # confirma que está em sync e não há lixo alheio
git diff --stat           # revisa exatamente o que vai no commit
git rebase origin/main    # se o remoto avançou
```

Depois do push:

```bash
npm view @danhachuel/leadmaster dist-tags --prefer-online
```

**Confirme sempre a versão no registry antes de publicar.** Se a versão que você ia
publicar já existir lá (colisão), a versão publicada vence e você **renumera para o
próximo patch** (regra permanente do AGENTS.md).

## Trabalho in-progress de sessão anterior

Se você encontrar trabalho não commitado de uma tarefa diferente (ex.: uma feature
inacabada), **não descarte sem perguntar**. Opções em ordem de preferência:

1. Completar o trabalho mínimo necessário para a suíte ficar verde, commitar com bump
   próprio e seguir.
2. Se não for possível, reportar ao usuário e pedir instrução.

Nunca deixe metade de feature silenciosamente no working tree: ela voará no próximo
`git add -A` de outra sessão.