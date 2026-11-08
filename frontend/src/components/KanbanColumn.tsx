import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '../lib/format';
import type { Etapa, Lead } from '../lib/types';
import { ETAPA_LABEL } from '../lib/types';
import { KanbanCard } from './KanbanCard';

interface Props {
  etapa: Etapa;
  leads: Lead[];
  cor: string;
  onAbrirLead?: (lead: Lead) => void;
}

/**
 * Coluna do Kanban: branca com sombra suave (padrão do Dashboard) e, ao receber
 * um card (Zeigarnik), ganha borda tracejada indigo mostrando onde vai cair.
 */
export function KanbanColumn({ etapa, leads, cor, onAbrirLead }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });

  return (
    <div className="w-72 shrink-0">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <span className={cn('w-2.5 h-2.5 rounded-full', cor)} />
          {ETAPA_LABEL[etapa]}
        </span>
        <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5 shadow-sm">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'bg-white rounded-xl p-3 min-h-[420px] transition-colors',
          'shadow-sm border',
          isOver ? 'border-2 border-dashed border-indigo-400 bg-indigo-50' : 'border-gray-100',
        )}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-0.5">
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
        </SortableContext>
      </div>
    </div>
  );
}
