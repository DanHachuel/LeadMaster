import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Etapa, Lead, SugestaoCrm } from '../lib/types';
import { ETAPAS, ETAPA_LABEL } from '../lib/types';
import { KanbanBoard } from '../components/KanbanBoard';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { cn, mascararTelefone } from '../lib/format';

export function CRM() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sugestoes, setSugestoes] = useState<SugestaoCrm[] | null>(null);
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);
  const [editando, setEditando] = useState<Lead | null>(null);
  const [observacoes, setObservacoes] = useState('');

  const carregar = useCallback(async () => {
    setLeads(await api.leads.listar());
  }, []);

  useEffect(() => {
    carregar().catch((e) => toast('erro', e.message));
  }, [carregar, toast]);

  const mover = async (leadId: string, para: Etapa) => {
    const anteriores = leads;
    // Otimista: move na hora; reverte se a API recusar.
    setLeads((atuais) => atuais.map((l) => (l.id === leadId ? { ...l, etapa: para } : l)));
    try {
      await api.leads.atualizar(leadId, { etapa: para });
      toast('sucesso', `Lead movido para "${ETAPA_LABEL[para]}".`);
    } catch (e) {
      setLeads(anteriores);
      toast('erro', e instanceof Error ? e.message : 'Falha ao mover lead.');
    }
  };

  const pedirSugestoes = async () => {
    setCarregandoSugestoes(true);
    try {
      const r = await api.crm.sugestoes();
      setSugestoes(r.sugestoes);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao pedir sugestões.');
    } finally {
      setCarregandoSugestoes(false);
    }
  };

  const aplicarSugestao = async (sugestao: SugestaoCrm) => {
    try {
      await api.crm.aplicar(sugestao.lead_id, sugestao.para);
      setSugestoes((atuais) => atuais?.filter((s) => s !== sugestao) ?? null);
      await carregar();
      toast('sucesso', `Sugestão aplicada: ${sugestao.lead_nome} → ${ETAPA_LABEL[sugestao.para]}.`);
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao aplicar sugestão.');
    }
  };

  const enriquecer = async (lead: Lead) => {
    try {
      const r = await api.leads.enriquecer(lead.id);
      r.notas.forEach((nota) => toast('info', nota));
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao enriquecer.');
    }
  };

  const salvarObservacoes = async () => {
    if (!editando) return;
    try {
      await api.leads.atualizar(editando.id, { observacoes });
      setEditando(null);
      await carregar();
      toast('sucesso', 'Observações salvas.');
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao salvar.');
    }
  };

  const porEtapa = useMemo(
    () => Object.fromEntries(ETAPAS.map((e) => [e, leads.filter((l) => l.etapa === e).length])) as Record<Etapa, number>,
    [leads],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>
            <strong className="text-gray-800">{leads.length}</strong> leads no funil
          </span>
          {ETAPAS.map((etapa) => (
            <span key={etapa} className="hidden md:inline">
              {ETAPA_LABEL[etapa]}: <strong className="text-gray-700">{porEtapa[etapa]}</strong>
            </span>
          ))}
        </div>
        <button
          onClick={pedirSugestoes}
          disabled={carregandoSugestoes}
          className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition disabled:opacity-60"
        >
          <i className={cn('fas fa-wand-magic-sparkles mr-2', carregandoSugestoes && 'fa-spin')} />
          Sugestões da IA
        </button>
      </div>

      <KanbanBoard leads={leads} onMover={mover} onAbrirLead={(lead) => { setEditando(lead); setObservacoes(lead.observacoes || ''); }} />

      {/* Painel de sugestões do agente de CRM */}
      <Modal
        aberto={sugestoes !== null}
        onFechar={() => setSugestoes(null)}
        titulo="Sugestões de movimentação (Agente de CRM)"
        icone="fas fa-robot"
        largura="lg"
      >
        {sugestoes && sugestoes.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            <i className="fas fa-circle-check text-green-500 text-2xl block mb-3" />
            Nenhuma sugestão no momento — o funil está equilibrado. 🎯
          </p>
        )}
        <div className="space-y-3">
          {sugestoes?.map((s, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4 flex items-start justify-between gap-4 hover:border-indigo-200 transition">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{s.lead_nome}</p>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                  <StatusBadge status={s.de} /> <i className="fas fa-arrow-right text-gray-300" /> <StatusBadge status={s.para} />
                  <span className="text-gray-400">confiança {Math.round(s.confianca * 100)}%</span>
                </p>
                <p className="text-xs text-gray-600 mt-2">{s.motivo}</p>
              </div>
              <button
                onClick={() => aplicarSugestao(s)}
                className="shrink-0 px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90"
              >
                Aplicar
              </button>
            </div>
          ))}
        </div>
      </Modal>

      {/* Edição rápida do card (duplo clique) */}
      <Modal aberto={!!editando} onFechar={() => setEditando(null)} titulo="Lead" icone="fas fa-address-card">
        {editando && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-gray-800">{editando.nome}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {mascararTelefone(editando.telefone)} · {editando.fonte}
                </p>
              </div>
              <StatusBadge status={editando.etapa} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
                placeholder="Ex.: ligou pedindo proposta, retorna na sexta..."
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => enriquecer(editando)}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <i className="fas fa-wand-magic-sparkles mr-1" /> Enriquecer com IA
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditando(null)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarObservacoes}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90"
                >
                  <i className="fas fa-save mr-2" /> Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
