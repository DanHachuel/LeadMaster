import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useState } from 'react';
import type { Etapa, Lead } from '../lib/types';
import { ETAPAS } from '../lib/types';
import { KanbanCard } from './KanbanCard';
import { KanbanColumn } from './KanbanColumn';

const CORES: Record<Etapa, string> = {
  leads: 'bg-blue-500',
  em_contato: 'bg-amber-500',
  proposta: 'bg-violet-500',
  fechado: 'bg-green-500',
};

interface Props {
  leads: Lead[];
  onMover: (leadId: string, para: Etapa) => void;
  onAbrirLead?: (lead: Lead) => void;
}

/** Tabuleiro Kanban com drag-and-drop (@dnd-kit/core). */
export function KanbanBoard({ leads, onMover, onAbrirLead }: Props) {
  const [arrastando, setArrastando] = useState<Lead | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const aoIniciar = (e: DragStartEvent) => {
    const lead = leads.find((l) => l.id === e.active.id);
    setArrastando(lead ?? null);
  };

  const aoTerminar = (e: DragEndEvent) => {
    setArrastando(null);
    const destino = e.over?.id as Etapa | undefined;
    if (!destino) return;
    const lead = leads.find((l) => l.id === e.active.id);
    if (!lead || lead.etapa === destino) return;
    onMover(lead.id, destino);
  };

  return (
    <DndContext sensors={sensors} onDragStart={aoIniciar} onDragEnd={aoTerminar}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {ETAPAS.map((etapa) => (
          <KanbanColumn
            key={etapa}
            etapa={etapa}
            cor={CORES[etapa]}
            leads={leads.filter((l) => l.etapa === etapa)}
            onAbrirLead={onAbrirLead}
          />
        ))}
      </div>
      <DragOverlay>
        {arrastando ? <KanbanCard lead={arrastando} emOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
