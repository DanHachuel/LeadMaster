# Skill: React State Guard (Estado do Frontend)

**Propósito:** manter o estado do React previsível e sincronizado com o backend. O
front é a camada que o usuário vê; estado perdido ou dessincronizado vira retrabalho.

## 1. Polling para background workers

- O servidor tem trabalho assíncorno real: campanhas ativas, cadências, status de
  WhatsApp. A UI **não** usa `setInterval` solto.
- Padrão do projeto: **TanStack Query com `refetchInterval`**:

```tsx
const { data } = useQuery({
  queryKey: ['campanhas'],
  queryFn: () => api.campanhas.listar(),
  refetchInterval: (query) => query.state.data?.some(c => c.status === 'em_andamento') ? 4000 : false,
  refetchIntervalInBackground: false, // não gasta request com aba oculta
});
```

- O Query gerencia ciclo de vida, dedupe, cancelamento no desmonte e reverte estado
  otimista quando a API nega.

## 2. Persistência vem da API

- Estado de tarefas em andamento (campanha ativa, cadência rodando, gateway conectado)
  **vem da API**, nunca só do `useState`. Assim sobrevive a F5 e a duas abas abertas.
- O que pode ser estado local puro: filtros, texto de busca, estado de modal, rascunho
  de formulário.

## 3. Loops de renderização

- Não atualize estado dentro de `useEffect` que depende do próprio estado sem condição
  de parada.
- Derive valores com `useMemo` em vez de sincronizar estado por efeito.
- Se precisar de valor "anterior" para comparar, use o padrão ref
  (`usePrevious`) ou derive no render.
- Em StrictMode (dev) o efeito roda duas vezes — cleanup precisa ser real
  (`clearInterval`, `revokeObjectURL`).

## 4. Contrato com o backend

- Toda chamada HTTP passa por `frontend/src/lib/api.ts` (regra do AGENTS.md).
- Erros da API viram **toast** com a mensagem acionável do backend — nunca mensagem genérica
  e nunca silêncio.
- Otimismo só com caminho de reverso: `setQueryData` antes, `refetch`/reverte no catch.