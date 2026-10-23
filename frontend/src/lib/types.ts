// Tipos compartilhados entre frontend e backend (ver backend/services/*.py).

export type Etapa = 'leads' | 'em_contato' | 'proposta' | 'fechado';

export const ETAPAS: Etapa[] = ['leads', 'em_contato', 'proposta', 'fechado'];

export const ETAPA_LABEL: Record<Etapa, string> = {
  leads: 'Leads',
  em_contato: 'Em contato',
  proposta: 'Proposta',
  fechado: 'Fechado',
};

export interface Lead {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  fonte: string;
  etapa: Etapa;
  cnpj?: string;
  empresa?: string;
  endereco?: string;
  cidade?: string;
  observacoes?: string;
  score?: number;
  tags: string[];
  extras?: Record<string, unknown>;
  resumo_ia?: string;
  criado_em: string;
  atualizado_em: string;
}

export type StatusCampanha = 'rascunho' | 'em_andamento' | 'pausada' | 'concluida' | 'erro';

export interface EventoCampanha {
  lead_id: string;
  status: 'enviado' | 'erro';
  mensagem: string;
  momento: string;
}

export interface Campanha {
  id: string;
  nome: string;
  canal: 'texto' | 'audio';
  template: string;
  lead_ids: string[];
  status: StatusCampanha;
  total: number;
  enviadas: number;
  erros: number;
  criado_em: string;
  iniciada_em?: string;
  concluida_em?: string;
  eventos: EventoCampanha[];
}

export type StatusEtapaJob = 'pendente' | 'em_andamento' | 'concluida' | 'erro' | 'pulada';

export interface EtapaJob {
  id: 'roteiro' | 'thumbnail' | 'wide' | 'shorts' | 'upload';
  nome: string;
  status: StatusEtapaJob;
  iniciada_em: string | null;
  concluida_em: string | null;
  mensagem: string;
  dados: Record<string, unknown>;
  logs: string[];
}

export type StatusJob = 'rascunho' | 'em_andamento' | 'pausado' | 'concluido' | 'erro' | 'cancelado';

export interface UploadJob {
  video_id?: string;
  url?: string;
  modo_upload?: string;
  status?: string;
  agenda_publicacao?: string | null;
  publicado_em?: string | null;
  ultimo_erro?: string;
  tentativas?: number;
}

export interface JobPipeline {
  id: string;
  titulo: string;
  tema: string;
  tom: string;
  duracao_min: number;
  keyword_seo: string;
  formatos: string[];
  criado_em: string;
  atualizado_em: string;
  status: StatusJob;
  etapa_atual: string | null;
  etapas: EtapaJob[];
  dados: {
    roteiro?: string;
    roteiro_chars?: number;
    arquivo_roteiro?: string;
    origem_roteiro?: string;
    titulo_gerado?: string;
    titulo_alternativo?: string;
    thumbnail_prompt?: string;
    videos_wide?: string[];
    task_id_wide?: string;
    resposta_shorts?: unknown;
    arquivo_local?: string;
  };
  upload: UploadJob;
  progresso?: number;
}

export interface SugestaoCrm {
  lead_id: string;
  lead_nome: string;
  de: Etapa;
  para: Etapa;
  confianca: number;
  motivo: string;
}

export interface Conexao {
  geral: boolean;
  moneyprinter: boolean;
  short_video_maker: boolean;
  uploader_youtube: boolean;
  llm: boolean;
  openoutreach: boolean;
}

export interface Metricas {
  conexao: Conexao;
  taxa_entrega: number;
  taxa_erro: number;
  total_enviadas: number;
  total_erros: number;
  leads_total: number;
  leads_por_etapa: Record<Etapa, number>;
  campanhas: { enviadas: number; erros: number; total: number };
  pipeline: { ativos: number; concluidos: number };
  perfil: { nome: string; licenca: { ativa: boolean; expira_em: string; restam_dias: number | null } };
}

export interface AppConfig {
  perfil: { nome: string; licenca: { ativa: boolean; expira_em: string; restam_dias: number | null } };
  llm: { provedor: string; base_url: string; api_key: string; api_key_configurado?: boolean; modelo: string };
  integracoes: {
    moneyprinter: { url: string };
    short_video_maker: { url: string };
    openmontage: { cli_path: string };
    youtube_upload: {
      url: string;
      api_key: string;
      api_key_configurado?: boolean;
      upload_path: string;
      publicar_path: string;
      modo: string;
      limite_diario: number;
      espera_publicacao_horas: number;
      uploader_mcp_path: string;
    };
    openoutreach: { url: string; enabled: boolean; send_path: string };
    pipecat: { url: string };
  };
  extratores: {
    google_maps_cli: string;
    google_maps_args: string;
    igmapper_cli: string;
    igmapper_args: string;
    scrapling_cli: string;
    cnpj_provedor_busca: string;
  };
  agentes: {
    disparo: { templates: { texto: string; audio: string }; minha_empresa: string; delay_entre_envios_segundos: number };
    atendimento: { modo: string };
  };
  webhook: { url: string; eventos: string[] };
}

export interface ResultadoExtracao {
  leads: Partial<Lead>[];
  comando?: string;
  provedor?: string;
}
