import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Campanha, Lead } from '../lib/types';
import { ETAPAS, ETAPA_LABEL } from '../lib/types';
import { Accordion } from '../components/Accordion';
import { Modal } from '../components/Modal';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { cn, dataHora } from '../lib/format';

export function Disparos() {
  const { toast } = useToast();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [modalAberto, setModalAberto] = useState(false);
  const [detalhes, setDetalhes] = useState<Campanha | null>(null);

  // Formulário da nova campanha
  const [nome, setNome] = useState('');
  const [canal, setCanal] = useState<'texto' | 'audio'>('texto');
  const [template, setTemplate] = useState('texto');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [etapaFiltro, setEtapaFiltro] = useState<string>('todas');

  const carregar = useCallback(async () => {
    const [cs, ls, ts] = await Promise.all([api.campanhas.listar(), api.leads.listar(), api.agentes.templates()]);
    setCampanhas(cs);
    setLeads(ls);
    setTemplates(ts);
  }, []);

  useEffect(() => {
    carregar().catch((e) => toast('erro', e.message));
  }, [carregar, toast]);

  // Polling enquanto houver campanha em andamento (Efeito Zeigarnik)
  const emAndamento = campanhas.some((c) => c.status === 'em_andamento');
  useEffect(() => {
    if (!emAndamento) return;
    const intervalo = setInterval(() => carregar().catch(() => undefined), 4000);
    return () => clearInterval(intervalo);
  }, [emAndamento, carregar]);

  const leadsFiltrados = useMemo(
    () => (etapaFiltro === 'todas' ? leads : leads.filter((l) => l.etapa === etapaFiltro)),
    [leads, etapaFiltro],
  );

  const alternar = (id: string) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const selecionarEtapa = () => {
    setSelecionados(new Set(leadsFiltrados.map((l) => l.id)));
  };

  const criarCampanha = async () => {
    if (!nome.trim()) {
      toast('erro', 'Dê um nome para a campanha.');
      return;
    }
    if (selecionados.size === 0) {
      toast('erro', 'Selecione ao menos um lead para disparar.');
      return;
    }
    try {
      await api.campanhas.criar({ nome: nome.trim(), canal, template, lead_ids: [...selecionados] });
      toast('sucesso', 'Campanha criada — clique em Iniciar quando estiver pronto.');
      setModalAberto(false);
      setNome('');
      setSelecionados(new Set());
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao criar campanha.');
    }
  };

  const agir = async (campanha: Campanha, acao: 'iniciar' | 'pausar' | 'parar') => {
    try {
      const r =
        acao === 'iniciar'
          ? await api.campanhas.iniciar(campanha.id)
          : acao === 'pausar'
            ? await api.campanhas.pausar(campanha.id)
            : await api.campanhas.parar(campanha.id);
      toast(r.ok ? 'sucesso' : 'info', r.mensagem);
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha na ação.');
    }
  };

  const excluir = async (campanha: Campanha) => {
    try {
      await api.campanhas.remover(campanha.id);
      toast('sucesso', `Campanha "${campanha.nome}" removida.`);
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao remover.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <strong className="text-gray-800">{campanhas.length}</strong> campanhas • templates configuráveis em Agentes
        </p>
        <button
          onClick={() => setModalAberto(true)}
          className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition shadow-sm"
        >
          <i className="fas fa-plus mr-2" /> Nova Campanha
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {campanhas.map((campanha) => {
          const total = Math.max(campanha.total, campanha.enviadas + campanha.erros);
          const pct = total ? Math.round(((campanha.enviadas + campanha.erros) / total) * 100) : 0;
          const rodando = campanha.status === 'em_andamento';
          return (
            <div key={campanha.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{campanha.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    criada em {dataHora(campanha.criado_em)} · template "{campanha.template}"
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={canalRotulo(campanha.canal)} rotulo={campanha.canal === 'audio' ? 'Áudio' : 'Texto'} />
                  <StatusBadge status={campanha.status} />
                </div>
              </div>

              {/* Zeigarnik: progresso visível */}
              <ProgressBar valor={pct} mostrarLabel />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  <i className="fas fa-paper-plane text-blue-500 mr-1" />
                  {campanha.enviadas} enviadas
                </span>
                <span>
                  <i className="fas fa-circle-exclamation text-red-500 mr-1" />
                  {campanha.erros} erros
                </span>
                <span>{total} leads</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setDetalhes(campanha)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <i className="fas fa-list mr-1" /> Ver eventos
                </button>
                <div className="flex items-center gap-2">
                  {(campanha.status === 'rascunho' || campanha.status === 'pausada' || campanha.status === 'concluida') && (
                    <button
                      onClick={() => agir(campanha, 'iniciar')}
                      className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90"
                    >
                      <i className="fas fa-play mr-1" /> {campanha.status === 'pausada' ? 'Retomar' : 'Iniciar'}
                    </button>
                  )}
                  {rodando && (
                    <>
                      <button
                        onClick={() => agir(campanha, 'pausar')}
                        className="px-4 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
                      >
                        <i className="fas fa-pause mr-1" /> Pausar
                      </button>
                      <button
                        onClick={() => agir(campanha, 'parar')}
                        className="px-4 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                      >
                        <i className="fas fa-stop mr-1" /> Parar
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => excluir(campanha)}
                    className="text-gray-400 hover:text-red-600 px-2 py-2"
                    title="Excluir campanha"
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {campanhas.length === 0 && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
            <i className="fas fa-bullhorn text-3xl text-gray-200 block mb-3" />
            Nenhuma campanha ainda. Crie a primeira com "Nova Campanha".
          </div>
        )}
      </div>

      {/* Modal: nova campanha */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Nova campanha de disparo" icone="fas fa-bullhorn" largura="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome da campanha *</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Reativação de leads de novembro"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Canal</label>
              <select
                value={canal}
                onChange={(e) => {
                  const valor = e.target.value as 'texto' | 'audio';
                  setCanal(valor);
                  setTemplate(valor);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                <option value="texto">Texto</option>
                <option value="audio">Áudio</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Template</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                {Object.keys(templates).map((chave) => (
                  <option key={chave} value={chave}>
                    {chave === 'texto' ? 'Texto' : 'Áudio'} — {templates[chave].slice(0, 40)}...
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Seleção de leads com alvos grandes (Lei de Fitts) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500">
                Leads destinatários — {selecionados.size} selecionado(s)
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={etapaFiltro}
                  onChange={(e) => setEtapaFiltro(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                >
                  <option value="todas">Todas as etapas</option>
                  {ETAPAS.map((etapa) => (
                    <option key={etapa} value={etapa}>
                      {ETAPA_LABEL[etapa]}
                    </option>
                  ))}
                </select>
                <button onClick={selecionarEtapa} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  Selecionar todos
                </button>
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
              {leadsFiltrados.map((lead) => (
                <label
                  key={lead.id}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-indigo-50/50"
                >
                  <input
                    type="checkbox"
                    checked={selecionados.has(lead.id)}
                    onChange={() => alternar(lead.id)}
                    className="w-4 h-4 accent-indigo-500"
                  />
                  <span className="text-gray-700 flex-1 truncate">{lead.nome}</span>
                  <span className="text-xs text-gray-400">{lead.telefone || lead.email || 'sem contato'}</span>
                </label>
              ))}
              {leadsFiltrados.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-gray-400">Nenhum lead nesta etapa.</p>
              )}
            </div>
          </div>

          <Accordion titulo="Como funciona o disparo?" icone="fas fa-circle-question">
            <p className="text-xs text-gray-500">
              O disparo é executado pelo <strong>OpenOutreach</strong> (eracle/OpenOutreach). Se ainda não
              configurou, a validação acontece na hora de iniciar — configure em <strong>Ferramentas → OpenOutreach</strong>.
            </p>
          </Accordion>

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => setModalAberto(false)}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={criarCampanha}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90"
            >
              <i className="fas fa-plus mr-2" /> Criar campanha
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: eventos da campanha */}
      <Modal aberto={!!detalhes} onFechar={() => setDetalhes(null)} titulo={`Eventos — ${detalhes?.nome ?? ''}`} icone="fas fa-list" largura="lg">
        {detalhes && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {detalhes.eventos.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">
                Nenhum evento ainda — inicie a campanha para gerar disparos.
              </p>
            )}
            {detalhes.eventos
              .slice()
              .reverse()
              .map((evento, i) => (
                <div key={i} className="flex items-start gap-3 text-sm border-b border-gray-50 pb-2">
                  <i
                    className={cn(
                      'mt-1 text-xs',
                      evento.status === 'enviado' ? 'fas fa-circle-check text-green-500' : 'fas fa-circle-xmark text-red-500',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-700 truncate">
                      {leads.find((l) => l.id === evento.lead_id)?.nome ?? evento.lead_id}
                    </p>
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

function canalRotulo(canal: string): string {
  return canal === 'audio' ? 'audio' : 'texto';
}
