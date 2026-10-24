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

  // CRM (agente)
  crm: {
    sugestoes: () => req<{ sugestoes: SugestaoCrm[] }>('/crm/sugestoes'),
    aplicar: (lead_id: string, para: string) => req<{ ok: boolean; lead: Lead }>('/crm/sugestoes/aplicar', corpo({ lead_id, para })),
  },

  // Campanhas / Disparos
  campanhas: {
    listar: () => req<Campanha[]>('/campaigns'),
    criar: (dados: { nome: string; canal: string; template: string; lead_ids: string[] }) =>
      req<Campanha>('/campaigns', corpo(dados)),
    iniciar: (id: string) => req<{ ok: boolean; mensagem: string }>(`/campaigns/${id}/start`, corpo({})),
    pausar: (id: string) => req<{ ok: boolean; mensagem: string }>(`/campaigns/${id}/pause`, corpo({})),
    parar: (id: string) => req<{ ok: boolean; mensagem: string }>(`/campaigns/${id}/stop`, corpo({})),
    remover: (id: string) => req<{ ok: boolean }>(`/campaigns/${id}`, { method: 'DELETE' }),
  },

  // Extratores
  extrair: {
    googleMaps: (dados: { palavra_chave: string; localizacao: string; max_resultados?: number }) =>
      req<ResultadoExtracao>('/extract/google-maps', corpo(dados)),
    instagram: (profile_url: string) => req<ResultadoExtracao>('/extract/instagram', corpo({ profile_url })),
    cnpj: (cnpj: string) => req<Partial<Lead>>('/extract/cnpj', corpo({ cnpj })),
    cnpjBusca: (dados: { cnae: string; uf: string; quantidade?: number }) =>
      req<ResultadoExtracao>('/extract/cnpj/search', corpo(dados)),
  },

  // Configuração
  config: {
    obter: () => req<AppConfig>('/config'),
    salvar: (patch: Partial<AppConfig>) => req<AppConfig>('/config', { method: 'PUT', body: JSON.stringify(patch) }),
    testarLlm: () => req<{ ok: boolean; resposta?: string; mensagem?: string }>('/config/test/llm', corpo({})),
    testarIntegracao: (url: string) => req<{ ok: boolean; status_http?: number; mensagem?: string }>('/config/test/integracao', corpo({ url })),
  },

  // Integrações
  integracoes: () =>
    req<Record<string, boolean>>('/integrations/status'),

  // Agentes
  agentes: {
    templates: () => req<Record<string, string>>('/agents/templates'),
    salvarTemplates: (patch: Record<string, string>) =>
      req<Record<string, string>>('/agents/templates', { method: 'PUT', body: JSON.stringify(patch) }),
    testarTemplate: (template: string, lead_id?: string | null) =>
      req<{ renderizado: string }>('/agents/templates/test', corpo({ template, lead_id })),
    chat: (mensagens: { role: string; content: string }[]) =>
      req<{ ok: boolean; resposta?: string; mensagem?: string }>('/agents/attendance/chat', corpo({ mensagens })),
  },

  // Webhook
  webhook: {
    obter: () => req<{ url: string; eventos: string[] }>('/webhook'),
    salvar: (patch: { url?: string; eventos?: string[] }) =>
      req<{ url: string; eventos: string[] }>('/webhook', { method: 'PUT', body: JSON.stringify(patch) }),
    testar: (url: string) => req<{ ok: boolean; status_http?: number; resposta?: string; mensagem?: string }>('/webhook/test', corpo({ url })),
  },
};
