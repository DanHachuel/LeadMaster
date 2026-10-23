import { cn } from '../lib/format';

const ESTILOS: Record<string, string> = {
  // Etapas do CRM
  leads: 'bg-blue-100 text-blue-800',
  em_contato: 'bg-amber-100 text-amber-800',
  proposta: 'bg-violet-100 text-violet-800',
  fechado: 'bg-green-100 text-green-800',
  // Status de job do pipeline e campanhas
  rascunho: 'bg-gray-100 text-gray-600',
  em_andamento: 'bg-blue-100 text-blue-800',
  pausado: 'bg-amber-100 text-amber-800',
  pausada: 'bg-amber-100 text-amber-800',
  concluido: 'bg-green-100 text-green-800',
  cancelado: 'bg-gray-100 text-gray-600',
  erro: 'bg-red-100 text-red-800',
  concluida: 'bg-green-100 text-green-800',
  pendente: 'bg-gray-100 text-gray-600',
  pulada: 'bg-gray-100 text-gray-500',
  enviada: 'bg-green-100 text-green-800',
  // Genéricos
  ativo: 'bg-green-100 text-green-800',
  inativo: 'bg-gray-100 text-gray-600',
};

const ROTULOS: Record<string, string> = {
  leads: 'Leads',
  em_contato: 'Em contato',
  proposta: 'Proposta',
  fechado: 'Fechado',
  rascunho: 'Rascunho',
  em_andamento: 'Em andamento',
  pausado: 'Pausado',
  pausada: 'Pausada',
  concluido: 'Concluído',
  concluida: 'Concluída',
  cancelado: 'Cancelado',
  erro: 'Erro',
  pendente: 'Pendente',
  pulada: 'Pulada',
  enviada: 'Enviada',
  ativo: 'Ativo',
  inativo: 'Inativo',
  texto: 'Texto',
  audio: 'Áudio',
};

interface Props {
  status: string;
  rotulo?: string;
  className?: string;
}

export function StatusBadge({ status, rotulo, className }: Props) {
  const estilo = ESTILOS[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', estilo, className)}>
      {rotulo || ROTULOS[status] || status}
    </span>
  );
}
