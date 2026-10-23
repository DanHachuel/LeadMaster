import { useDroppable } from '@dnd-kit/core';
import { cn } from '../lib/format';
import type { Etapa, Lead } from '../lib/types';
import { ETAPA_LABEL } from '../lib/types';
import { KanbanCard } from './KanbanCard';

interface Props {
  etapa: Etapa;
  leads: Lead[];
  onAbrirLead?: (lead: Lead) => void;
  cor: string;
}

/** Coluna do Kanban: Leads, Em contato, Proposta, Fechado. */
export function KanbanColumn({ etapa, leads, onAbrirLead, cor }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-gray-50 rounded-xl p-3 w-72 shrink-0 flex flex-col min-h-[420px] transition-colors',
        isOver && 'bg-indigo-50 ring-2 ring-indigo-300',
      )}
    >
      <div className="flex items-center justify-between px-1 pb-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <span className={cn('w-2.5 h-2.5 rounded-full', cor)} />
          {ETAPA_LABEL[etapa]}
        </span>
        <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">
          {leads.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-0.5" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        {leads.length === 0 && (
          <div className="text-center text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-lg py-10 mt-8">
            <i className="fas fa-inbox text-2xl text-gray-300 mb-2 block" />
            Arraste leads para cá
          </div>
        )}
        {leads.map((lead) => (
          <KanbanCard key={lead.id} lead={lead} onAbrir={onAbrirLead} />
        ))}
      </div>
    </div>
  );
}
