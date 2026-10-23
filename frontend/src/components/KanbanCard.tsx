import { useDraggable } from '@dnd-kit/core';
import { cn, mascararTelefone } from '../lib/format';
import type { Lead } from '../lib/types';

interface Props {
  lead: Lead;
  onAbrir?: (lead: Lead) => void;
  emOverlay?: boolean;
}

/** Card arrastável do Kanban: nome, telefone e fonte (fiel ao conceito do protótipo). */
export function KanbanCard({ lead, onAbrir, emOverlay = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        'bg-white rounded-lg shadow-sm border border-gray-100 p-3 cursor-grab active:cursor-grabbing select-none',
        isDragging && !emOverlay && 'opacity-40',
        emOverlay && 'shadow-xl rotate-2',
      )}
      onDoubleClick={() => onAbrir?.(lead)}
      title="Arraste para mudar de etapa · duplo clique para editar"
    >
      <p className="text-sm font-semibold text-gray-800 truncate">{lead.nome}</p>
      <p className="text-xs text-gray-500 mt-0.5">{mascararTelefone(lead.telefone)}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] uppercase tracking-wide bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
          {lead.fonte}
        </span>
        <span className="text-[10px] text-gray-400">
          <i className="fas fa-star text-amber-400 mr-0.5" />
          {lead.score ?? 0}
        </span>
      </div>
    </div>
  );
}
