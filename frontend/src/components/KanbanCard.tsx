import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn, mascararTelefone } from '../lib/format';
import type { Lead } from '../lib/types';

interface Props {
  lead: Lead;
  onAbrir?: (lead: Lead) => void;
  emOverlay?: boolean;
}

/**
 * Card do lead (Lei de Fitts: o card inteiro é a alça de arraste — área de
 * acerto máxima). Clique simples abre os detalhes; o clique é suprimido
 * logo após um drag (flag global anti-ruptura do drag-and-drop). Efeito
 * Zeigarnik: enquanto arrastado, fica com opacity 0.5.
 */
export function KanbanCard({ lead, onAbrir, emOverlay = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        'bg-white rounded-lg shadow-sm border border-gray-100 p-3 cursor-grab active:cursor-grabbing select-none touch-none',
        emOverlay && 'shadow-xl rotate-2 cursor-grabbing',
      )}
      onClick={() => {
        if (globalThis.__leadmasterArrastando) return; // clique pós-drag: ignora
        onAbrir?.(lead);
      }}
      title="Arraste para mudar de coluna · clique para ver detalhes"
    >
      <p className="text-sm font-semibold text-gray-800 truncate">{lead.nome}</p>
      <p className="text-xs text-gray-500 mt-0.5">{mascararTelefone(lead.telefone)}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] uppercase tracking-wide bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
          {lead.fonte}
        </span>
        <span className="text-[10px] text-gray-400" title="Data de criação">
          {new Date(lead.criado_em).toLocaleDateString('pt-BR')}
        </span>
      </div>
    </div>
  );
}
