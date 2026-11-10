// Cliente HTTP único do frontend (regra do AGENTS.md: toda chamada HTTP passa por aqui).

import type {
  AppConfig,
  Campanha,
  Lead,
  Metricas,
  ResultadoExtracao,
  SugestaoCrm,
} from './types';

const BASE = '/api';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function req<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + caminho, {
    ...opcoes,
    headers: opcoes.body ? { 'Content-Type': 'application/json', ...(opcoes.headers || {}) } : opcoes.headers,
  });
  if (!res.ok) {
    let detalhe = `Erro HTTP ${res.status}`;
    try {
      const corpo = await res.json();
      detalhe = String(corpo.detail || corpo.mensagem || detalhe);
    } catch {
      /* resposta sem corpo JSON */
    }
    throw new ApiError(res.status, detalhe);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const corpo = (dados: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(dados) });

export const api = {
  // Sistema
  health: () => req<{ status: string; versao: string; home: string; storage: string }>('/health'),
  doctor: () =>
    req<{
      ok: boolean;
      versao: string;
      python: string;
      sistema: string;
      dist_frontend: boolean;
      storage: string;
      integracoes: Record<string, boolean>;
    }>('/doctor'),
  shutdown: () => req<{ ok: boolean }>('/shutdown', corpo({})),

  // Métricas
  metricas: () => req<Metricas>('/metrics'),

  // Leads
  leads: {
    listar: () => req<Lead[]>('/leads'),
    criar: (lead: Partial<Lead>) => req<Lead>('/leads', corpo(lead)),
    atualizar: (id: string, patch: Partial<Lead>) => req<Lead>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remover: (id: string) => req<{ ok: boolean }>(`/leads/${id}`, { method: 'DELETE' }),
    importar: (leads: Partial<Lead>[]) =>
      req<{ importados: Lead[]; duplicados: Partial<Lead>[] }>('/leads/import', corpo({ leads })),
    enriquecer: (id: string) =>
      req<{ ok: boolean; lead: Lead; notas: string[] }>(`/leads/${id}/enrich`, corpo({})),
  },

  // CRM (Kanban: leads por etapa + agente de sugestões)
  crm: {
    leadsListar: (tag?: string) => req<Lead[]>(tag ? `/crm/leads?tag=${encodeURIComponent(tag)}` : '/crm/leads'),
    criarLead: (lead: Partial<Lead>) => req<Lead>('/crm/leads', corpo(lead)),
    editarLead: (id: string, dados: Partial<Lead>) =>
      req<Lead>(`/crm/leads/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
    exportarCsvUrl: () => '/api/crm/leads/export',
    moverLead: (id: string, etapa: string) =>
      req<Lead>(`/crm/leads/${id}/etapa`, { method: 'PUT', body: JSON.stringify({ etapa }) }),
    sugestoes: () => req<{ sugestoes: SugestaoCrm[] }>('/crm/sugestoes'),
    aplicar: (lead_id: string, para: string) => req<{ ok: boolean; lead: Lead }>('/crm/sugestoes/aplicar', corpo({ lead_id, para })),
  },

  // Campanhas / Disparos
  campanhas: {
    listar: () => req<Campanha[]>('/campaigns'),
    criar: (dados: { nome: string; canal: string; template: string; mensagem?: string; lead_ids: string[]; filtro_etapa?: string | null }) =>
      req<Campanha>('/campaigns', corpo(dados)),
    status: (id: string, status: 'ativa' | 'pausada' | 'rascunho') =>
      req<Campanha>(`/campaigns/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    gerarMensagem: (nicho: string, tom: string) =>
      req<{ template: string }>('/campaigns/generate-message', corpo({ nicho, tom })),
    iniciar: (id: string) => req<{ ok: boolean; mensagem: string }>(`/campaigns/${id}/start`, corpo({})),
    pausar: (id: string) => req<{ ok: boolean; mensagem: string }>(`/campaigns/${id}/pause`, corpo({})),
    parar: (id: string) => req<{ ok: boolean; mensagem: string }>(`/campaigns/${id}/stop`, corpo({})),
    remover: (id: string) => req<{ ok: boolean }>(`/campaigns/${id}`, { method: 'DELETE' }),
  },

  // Extratores
  extrair: {
    maps: (dados: { keyword: string; location: string; limit?: number }) =>
      req<{ origem: string; aviso: string; extraidos: Partial<Lead>[]; importados: Lead[]; duplicados: number }>(
        '/extractors/maps',
        corpo(dados),
      ),
    instagram: (profile_url: string, limit?: number) =>
      req<{ origem: string; aviso: string; extraidos: Partial<Lead>[]; importados: Lead[]; duplicados: number }>(
        '/extractors/instagram',
        corpo({ profile_url, limit }),
      ),
    cnpj: (cnpj: string) => req<Partial<Lead>>('/extract/cnpj', corpo({ cnpj })),
    cnpjBusca: (dados: { cnae: string; uf: string; quantidade?: number }) =>
      req<ResultadoExtracao>('/extract/cnpj/search', corpo(dados)),
    cnpjExtract: (dados: { cnae: string; uf: string; limit?: number }) =>
      req<{ origem: string; aviso: string; extraidos: Partial<Lead>[]; importados: Lead[]; duplicados: number }>(
        '/extractors/cnpj',
        corpo(dados),
      ),
  },

  // Configuração
  config: {
    obter: () => req<AppConfig>('/config'),
    salvar: (patch: AppConfig | Record<string, unknown>) => req<AppConfig>('/config', { method: 'PUT', body: JSON.stringify(patch) }),
    testarLlm: () => req<{ ok: boolean; resposta?: string; mensagem?: string }>('/config/test/llm', corpo({})),
    testarIntegracao: (url: string) => req<{ ok: boolean; status_http?: number; mensagem?: string }>('/config/test/integracao', corpo({ url })),
  },

  // Integrações
  integracoes: () =>
    req<Record<string, boolean>>('/integrations/status'),

  // Agentes
  agentes: {
    listar: () =>
      req<{
        llm_configurado: boolean;
        agentes: Record<string, { status: 'ativo' | 'inativo'; prompt: string }>;
      }>('/agents'),
    status: (agent_id: string, status: 'ativo' | 'inativo') =>
      req<{ ok: boolean; agent_id: string; status: string }>(`/agents/${agent_id}/status`, corpo({ status })),
    salvarPrompt: (agent_id: string, prompt: string) =>
      req<{ ok: boolean; agent_id: string; prompt: string }>(`/agents/${agent_id}/prompt`, corpo({ prompt })),
    templates: () => req<Record<string, string>>('/agents/templates'),
    salvarTemplates: (patch: Record<string, string>) =>
      req<Record<string, string>>('/agents/templates', { method: 'PUT', body: JSON.stringify(patch) }),
    testarTemplate: (template: string, lead_id?: string | null) =>
      req<{ renderizado: string }>('/agents/templates/test', corpo({ template, lead_id })),
    chat: (mensagens: { role: string; content: string }[]) =>
      req<{ ok: boolean; resposta?: string; mensagem?: string }>('/agents/attendance/chat', corpo({ mensagens })),
    chatSimples: (message: string) =>
      req<{ ok: boolean; resposta?: string; mensagem?: string }>('/agents/chat', corpo({ message })),
    chatHistorico: () =>
      req<{ papel: 'user' | 'assistant'; conteudo: string; momento: string }[]>('/agents/chat/history'),
    chatLimpar: () => req<{ ok: boolean }>('/agents/chat/history', { method: 'DELETE' }),
  },

  // Funil de Prospecção
  funil: () =>
    req<{
      etapas: { nome: string; quantidade: number }[];
      conversoes: { de: string; para: string; taxa: number | null; queda: number | null }[];
      gargalo: string | null;
    }>('/funnel'),

  // WhatsApp (gateway local OpenWA/WAHA)
  whatsapp: {
    status: () => req<{ estado: string; bruto: string; numero: string; gateway_url: string }>('/whatsapp/status'),
    conectar: () => req<{ ok: boolean; status_http?: number }>('/whatsapp/sessions/start', corpo({})),
    qrUrl: () => '/api/whatsapp/qr',
    testeEnvio: (telefone: string, mensagem: string) =>
      req<{ ok: boolean; chat_id?: string }>('/whatsapp/test-send', corpo({ telefone, mensagem })),
  },

  // Webhook
  webhook: {
    obter: () => req<{ url: string; eventos: string[]; ultimo_teste: string | null }>('/webhook'),
    salvar: (patch: { url?: string; eventos?: string[] }) =>
      req<{ url: string; eventos: string[]; ultimo_teste: string | null }>('/webhook', { method: 'PUT', body: JSON.stringify(patch) }),
    testar: (url: string) =>
      req<{ ok: boolean; status_http?: number; resposta?: string; mensagem?: string; ultimo_teste?: string }>('/webhook/test', corpo({ url })),
  },
};
