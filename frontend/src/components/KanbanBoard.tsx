import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  onMover: (leadId: string, para: Etapa) => Promise<void>;
  onAbrirLead?: (lead: Lead) => void;
}

type Colunas = Record<Etapa, string[]>;

function colunaDe(mapa: Partial<Colunas>, id: string): Etapa | null {
  if ((ETAPAS as string[]).includes(id)) return id as Etapa;
  for (const etapa of ETAPAS) {
    if ((mapa[etapa] || []).includes(id)) return etapa;
  }
  return null;
}

/**
 * Tabuleiro Kanban com @dnd-kit/core + @dnd-kit/sortable (múltiplos contêineres).
 * - Reordenação visual dentro da coluna (sortable).
 * - Movimentação entre colunas persiste via onMover (PUT /api/crm/leads/{id}/etapa).
 * - Soltar fora de qualquer coluna reverte o movimento.
 */
export function KanbanBoard({ leads, onMover, onAbrirLead }: Props) {
  const [itens, setItens] = useState<Colunas>(() => agrupar(leads));
  const [arrastando, setArrastando] = useState<string | null>(null);
  const snapshot = useRef<Colunas>(itens);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Sincroniza com o conjunto de leads (criação/remoção/revert de API).
  useEffect(() => {
    setItens((atual) => {
      const ids = new Set(leads.map((l) => l.id));
      const novo = {} as Colunas;
      for (const etapa of ETAPAS) {
        novo[etapa] = (atual[etapa] || []).filter((id) => ids.has(id));
      }
      let mudou = false;
      for (const lead of leads) {
        const colunaAtual = colunaDe(novo, lead.id);
        if (colunaAtual === null) {
          novo[lead.etapa] = [...(novo[lead.etapa] || []), lead.id];
          mudou = true;
        } else if (colunaAtual !== lead.etapa) {
          // Divergência (ex.: API recusou e o pai reverteu): volta à coluna original.
          novo[colunaAtual] = novo[colunaAtual].filter((id) => id !== lead.id);
          novo[lead.etapa] = [...(novo[lead.etapa] || []), lead.id];
          mudou = true;
        }
      }
      const mesmoTamanho = ETAPAS.every((e) => (novo[e] || []).length === (atual[e] || []).length);
      return mudou || !mesmoTamanho ? novo : atual;
    });
  }, [leads]);

  const leadDe = useCallback((id: string | null) => (id ? leads.find((l) => l.id === id) || null : null), [leads]);
  const leadArrastado = useMemo(() => leadDe(arrastando), [leadDe, arrastando]);

  const aoIniciar = (e: DragStartEvent) => {
    snapshot.current = itens;
    setArrastando(String(e.active.id));
  };

  const aoArrastarSobre = useCallback((e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setItens((atual) => {
      const de = colunaDe(atual, activeId);
      const para = colunaDe(atual, overId);
      if (!de || !para || de === para) return atual;
      return {
        ...atual,
        [de]: atual[de].filter((id) => id !== activeId),
        [para]: [...atual[para], activeId],
      };
    });
  }, []);

  const aoTerminar = async (e: DragEndEvent) => {
    setArrastando(null);
    const activeId = String(e.active.id);
    if (!e.over) {
      // Soltou fora de todas as colunas: reverte para a posição do início.
      setItens(snapshot.current);
      return;
    }
    const para = colunaDe(itens, String(e.over.id));
    const de = colunaDe(snapshot.current, activeId);
    if (!para || !de || para === de) return;
    await onMover(activeId, para); // reverte sozinho se a API falhar (efeito acima)
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={aoIniciar} onDragOver={aoArrastarSobre} onDragEnd={aoTerminar}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {ETAPAS.map((etapa) => (
          <KanbanColumn
            key={etapa}
            etapa={etapa}
            cor={CORES[etapa]}
            leads={leads.filter((l) => itens[etapa]?.includes(l.id))}
            onAbrirLead={onAbrirLead}
          />
        ))}
      </div>
      <DragOverlay>{leadArrastado ? <KanbanCard lead={leadArrastado} emOverlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function agrupar(leads: Lead[]): Colunas {
  const mapa = { leads: [], em_contato: [], proposta: [], fechado: [] } as unknown as Colunas;
  for (const lead of leads) {
    if (mapa[lead.etapa]) mapa[lead.etapa].push(lead.id);
  }
  return mapa;
}
