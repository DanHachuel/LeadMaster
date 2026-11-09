import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Campanha, Lead } from '../lib/types';
import { ETAPAS, ETAPA_LABEL } from '../lib/types';
import { Modal } from '../components/Modal';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { cn, dataHora } from '../lib/format';

/**
 * Disparos (campanhas): tabela com Nome/Status/Total de Leads/Data de Criação,
 * botão "Nova Campanha" em gradiente (Fitts + von Restorff), badges vibrantes
 * de status (von Restorff) e barra de progresso nas campanhas ativas (Zeigarnik).
 */
export function Disparos() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [detalhes, setDetalhes] = useState<Campanha | null>(null);

  const [nome, setNome] = useState('');
  const [template, setTemplate] = useState('');
  const [canal, setCanal] = useState<'texto' | 'audio'>('texto');
  const [filtroEtapa, setFiltroEtapa] = useState<string>('leads');

  const carregarLeads = useCallback(async () => {
    setLeads(await api.leads.listar());
  }, []);

  useEffect(() => {
    carregarLeads().catch((e) => toast('erro', e.message));
  }, [carregarLeads, toast]);

  // Polling gerenciado pelo TanStack Query (0.1.02): sonda a cada 4s enquanto
  // existir campanha ativa; cleanup e pausa em aba oculta automáticos.
  const { data: campanhas = [], refetch: recarregarCampanhas } = useQuery<Campanha[]>({
    queryKey: ['campanhas'],
    queryFn: () => api.campanhas.listar(),
    refetchInterval: (query) =>
      query.state.data?.some((c) => c.status === 'em_andamento') ? 4000 : false,
    refetchIntervalInBackground: false,
  });

  const totalPorEtapa = useMemo(
    () => Object.fromEntries(ETAPAS.map((e) => [e, leads.filter((l) => l.etapa === e).length])) as Record<string, number>,
    [leads],
  );

  const criar = async () => {
    if (!nome.trim()) {
      toast('erro', 'Dê um nome para a campanha.');
      return;
    }
    if (!template.trim()) {
      toast('erro', 'Escreva o template da mensagem.');
      return;
    }
    try {
      await api.campanhas.criar({
        nome: nome.trim(),
        canal,
        template: canal,
        mensagem: template.trim(),
        lead_ids: [],
        filtro_etapa: filtroEtapa,
      });
      const rotuloEtapa = ETAPA_LABEL[filtroEtapa as keyof typeof ETAPA_LABEL] ?? filtroEtapa;
      toast('sucesso', `Campanha criada — ${totalPorEtapa[filtroEtapa] ?? 0} leads de "${rotuloEtapa}" serão disparados.`);
      setModalAberto(false);
      setNome('');
      setTemplate('');
      await recarregarCampanhas();
      await carregarLeads();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao criar campanha.');
    }
  };

  const alterarStatus = async (campanha: Campanha, status: 'ativa' | 'pausada' | 'rascunho') => {
    try {
      await api.campanhas.status(campanha.id, status);
      toast('sucesso', `Campanha "${campanha.nome}" → ${status === 'ativa' ? 'Ativa' : status === 'pausada' ? 'Pausada' : 'Rascunho'}.`);
      await recarregarCampanhas();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao alterar status.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          <strong className="text-gray-800">{campanhas.length}</strong> campanhas · templates em Agentes
        </p>
        {/* Botão primário (Fitts + von Restorff) */}
        <button
          onClick={() => setModalAberto(true)}
          className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition shadow-sm"
        >
          <i className="fas fa-plus mr-2" /> Nova Campanha
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Total de Leads</th>
                <th className="px-5 py-3 font-semibold">Data de Criação</th>
                <th className="px-5 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map((campanha) => {
                const ativa = campanha.status === 'em_andamento';
                const total = Math.max(campanha.total, campanha.enviadas + campanha.erros);
                return (
                  <tr key={campanha.id} className="border-b border-gray-50 hover:bg-indigo-50/40">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-[220px]">{campanha.nome}</p>
                      <p className="text-xs text-gray-400">
                        {campanha.canal === 'audio' ? 'Áudio' : 'Texto'} · template "{campanha.template}"
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={campanha.status} />
                    </td>
                    <td className="px-5 py-3 text-gray-600">{total}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">{dataHora(campanha.criado_em)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setDetalhes(campanha)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mr-3"
                      >
                        <i className="fas fa-list mr-1" /> Ver
                      </button>
                      {ativa ? (
                        <>
                          <button
                            onClick={() => alterarStatus(campanha, 'pausada')}
                            className="px-4 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 mr-2"
                          >
                            <i className="fas fa-pause mr-1" /> Pausar
                          </button>
                          <button
                            onClick={() => alterarStatus(campanha, 'rascunho')}
                            className="px-4 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                          >
                            <i className="fas fa-stop mr-1" /> Parar
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => alterarStatus(campanha, 'ativa')}
                          className="px-5 py-2 text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90"
                        >
                          <i className="fas fa-play mr-1" /> Iniciar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {campanhas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-gray-400">
                    <i className="fas fa-bullhorn text-3xl text-gray-200 block mb-3" />
                    Nenhuma campanha ainda. Clique em <strong className="text-indigo-500">Nova Campanha</strong> para começar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Zeigarnik: campanha ativa mostra barra de progresso + spinner */}
      {campanhas.filter((c) => c.status === 'em_andamento').length > 0 && (
        <div className="space-y-3">
          {campanhas
            .filter((c) => c.status === 'em_andamento')
            .map((campanha) => {
              const total = Math.max(campanha.total, campanha.enviadas + campanha.erros);
              const pct = total ? Math.round(((campanha.enviadas + campanha.erros) / total) * 100) : 0;
              return (
                <div key={campanha.id} className="bg-white rounded-xl shadow-sm border border-indigo-100 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <i className="fas fa-spinner fa-spin text-indigo-500" /> {campanha.nome}
                    </p>
                    <span className="text-xs text-gray-500">
                      {campanha.enviadas} enviadas · {campanha.erros} erros
                    </span>
                  </div>
                  <ProgressBar valor={pct} mostrarLabel />
                </div>
              );
            })}
        </div>
      )}

      {/* Modal: nova campanha */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Nova Campanha" icone="fas fa-bullhorn" largura="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome da Campanha *</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Reativação de novos leads"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Template da Mensagem *</label>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={4}
              placeholder={'Use variáveis: {{nome}}, {{primeiro_nome}}, {{empresa}}, {{cidade}}...'}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Variáveis: <code className="bg-gray-100 px-1 rounded">{'{{nome}}'}</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">{'{{primeiro_nome}}'}</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">{'{{empresa}}'}</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">{'{{cidade}}'}</code>
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Canal</label>
              <select
                value={canal}
                onChange={(e) => setCanal(e.target.value as 'texto' | 'audio')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                <option value="texto">Texto</option>
                <option value="audio">Áudio</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Filtrar Leads por Etapa do CRM</label>
              <select
                value={filtroEtapa}
                onChange={(e) => setFiltroEtapa(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                {ETAPAS.map((etapa) => (
                  <option key={etapa} value={etapa}>
                    {ETAPA_LABEL[etapa]} ({totalPorEtapa[etapa] ?? 0} leads)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            <i className="fas fa-circle-info mr-1" /> O envio simulado altera o status no JSON. A integração real
            (OpenOutreach) é validada na hora de iniciar — configure em Ferramentas.
          </p>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={criar} className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90">
              <i className="fas fa-plus mr-2" /> Criar Campanha
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: detalhes da campanha */}
      <Modal aberto={!!detalhes} onFechar={() => setDetalhes(null)} titulo={`Eventos — ${detalhes?.nome ?? ''}`} icone="fas fa-list" largura="lg">
        {detalhes && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {detalhes.eventos.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">
                Nenhum evento ainda — a execução do disparo é simulada nesta fase.
              </p>
            )}
            {detalhes.eventos.slice().reverse().map((evento, i) => (
              <div key={i} className="flex items-start gap-3 text-sm border-b border-gray-50 pb-2">
                <i className={cn('mt-1 text-xs', evento.status === 'enviado' ? 'fas fa-circle-check text-green-500' : 'fas fa-circle-xmark text-red-500')} />
                <div className="min-w-0 flex-1">
                  <p className="text-gray-700 truncate">{leads.find((l) => l.id === evento.lead_id)?.nome ?? evento.lead_id}</p>
                  {evento.mensagem && <p className="text-xs text-gray-400 truncate">{evento.mensagem}</p>}
                </div>
                <span className="text-xs text-gray-300 shrink-0">{dataHora(evento.momento)}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
