import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Etapa, Lead, SugestaoCrm } from '../lib/types';
import { ETAPAS, ETAPA_LABEL } from '../lib/types';
import { KanbanBoard } from '../components/KanbanBoard';
import { corTag } from '../components/KanbanCard';
import { Modal } from '../components/Modal';
import { Accordion } from '../components/Accordion';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { cn, dataHora } from '../lib/format';

const VAZIO: Partial<Lead> = { nome: '', telefone: '', email: '', fonte: 'Manual', etapa: 'leads' };

export function CRM() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sugestoes, setSugestoes] = useState<SugestaoCrm[] | null>(null);
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Lead | null>(null);
  const [novo, setNovo] = useState<Partial<Lead>>({ ...VAZIO });
  const [observacoes, setObservacoes] = useState('');
  const [nomeEdit, setNomeEdit] = useState('');
  const [telefoneEdit, setTelefoneEdit] = useState('');
  const [emailEdit, setEmailEdit] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [tagsEdit, setTagsEdit] = useState<string[]>([]);
  const [novaTag, setNovaTag] = useState('');
  const [scoreEdit, setScoreEdit] = useState(0);
  const [busca, setBusca] = useState('');
  const [exportando, setExportando] = useState(false);
  const [tagFiltro, setTagFiltro] = useState('');

  const carregar = useCallback(async () => {
    setLeads(await api.crm.leadsListar());
  }, []);

  useEffect(() => {
    carregar().catch((e) => toast('erro', e.message));
  }, [carregar, toast]);

  // Pré-preenche o modal com os dados atuais do lead selecionado.
  useEffect(() => {
    if (!editando) return;
    setObservacoes(editando.observacoes || '');
    setNomeEdit(editando.nome || '');
    setTelefoneEdit(editando.telefone || '');
    setEmailEdit(editando.email || '');
    setTagsEdit([...(editando.tags || [])]);
    setScoreEdit(editando.score ?? 0);
  }, [editando]);

  const mover = async (leadId: string, para: Etapa) => {
    const anteriores = leads;
    // Otimista: move na hora; reverte se a API recusar (PUT /api/crm/leads/{id}/etapa).
    setLeads((atuais) => atuais.map((l) => (l.id === leadId ? { ...l, etapa: para } : l)));
    try {
      await api.crm.moverLead(leadId, para);
      toast('sucesso', `Lead movido para "${ETAPA_LABEL[para]}".`);
    } catch (e) {
      setLeads(anteriores);
      toast('erro', e instanceof Error ? e.message : 'Falha ao mover lead.');
    }
  };

  const criar = async () => {
    if (!novo.nome?.trim()) {
      toast('erro', 'O nome do lead é obrigatório.');
      return;
    }
    try {
      await api.crm.criarLead({ ...novo, etapa: novo.etapa || 'leads' });
      toast('sucesso', 'Lead criado com sucesso.');
      setModalAberto(false);
      setNovo({ ...VAZIO });
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao criar lead.');
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

  // Auto-save de tags/score (feedback imediato; falha reverte via toast).
  const salvarTags = async (tags: string[]) => {
    if (!editando) return;
    const anteriores = tagsEdit;
    setTagsEdit(tags);
    try {
      const atualizado = await api.crm.editarLead(editando.id, { tags });
      setLeads((atuais) => atuais.map((l) => (l.id === editando.id ? { ...l, ...atualizado } : l)));
      setEditando((atual) => (atual ? { ...atual, ...atualizado } : atual));
    } catch (e) {
      setTagsEdit(anteriores);
      toast('erro', e instanceof Error ? e.message : 'Falha ao salvar tags.');
    }
  };

  const salvarScore = async (score: number) => {
    if (!editando) return;
    const anterior = scoreEdit;
    setScoreEdit(score);
    try {
      const atualizado = await api.crm.editarLead(editando.id, { score });
      setLeads((atuais) => atuais.map((l) => (l.id === editando.id ? { ...l, ...atualizado } : l)));
      setEditando((atual) => (atual ? { ...atual, ...atualizado } : atual));
    } catch (e) {
      setScoreEdit(anterior);
      toast('erro', e instanceof Error ? e.message : 'Falha ao salvar score.');
    }
  };

  const adicionarTag = () => {
    const tag = novaTag.trim();
    if (!tag) return;
    if (tagsEdit.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      toast('erro', 'Esta tag já existe neste lead.');
      return;
    }
    setNovaTag('');
    salvarTags([...tagsEdit, tag]);
  };

  const removerTag = (tag: string) => salvarTags(tagsEdit.filter((t) => t !== tag));

  const salvarDetalhes = async () => {
    if (!editando) return;
    if (!nomeEdit.trim()) {
      toast('erro', 'O nome do lead não pode ficar vazio.');
      return;
    }
    setSalvando(true);
    try {
      const atualizado = await api.crm.editarLead(editando.id, {
        nome: nomeEdit.trim(),
        telefone: telefoneEdit.trim(),
        email: emailEdit.trim(),
      });
      if (observacoes !== (editando.observacoes || '')) {
        await api.leads.atualizar(editando.id, { observacoes });
      }
      setLeads((atuais) => atuais.map((l) => (l.id === editando.id ? { ...l, ...atualizado, observacoes } : l)));
      setEditando(null);
      toast('sucesso', 'Alterações salvas.');
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao salvar alterações.');
    } finally {
      setSalvando(false);
    }
  };

  // Lista final: filtro por tag (local) + busca textual instantânea.
  const leadsFiltrados = useMemo(() => {
    let lista = tagFiltro
      ? leads.filter((l) => (l.tags || []).some((t) => t.toLowerCase() === tagFiltro.toLowerCase()))
      : leads;
    const termo = busca.trim().toLowerCase();
    if (termo) {
      lista = lista.filter(
        (l) =>
          l.nome.toLowerCase().includes(termo) ||
          (l.telefone || '').includes(termo) ||
          (l.email || '').toLowerCase().includes(termo),
      );
    }
    return lista;
  }, [leads, busca, tagFiltro]);

  const exportarCsv = async () => {
    setExportando(true);
    try {
      const resp = await fetch(api.crm.exportarCsvUrl());
      if (!resp.ok) throw new Error(`Erro HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads_leadmaster.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast('sucesso', 'CSV exportado com sucesso.');
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao exportar CSV.');
    } finally {
      setExportando(false);
    }
  };

  const porEtapa = useMemo(
    () => Object.fromEntries(ETAPAS.map((e) => [e, leads.filter((l) => l.etapa === e).length])) as Record<Etapa, number>,
    [leads],
  );

  // Todas as tags existentes na base (para o dropdown de filtro).
  const todasTags = useMemo(() => {
    const conjunto = new Set<string>();
    for (const l of leads) for (const t of l.tags || []) conjunto.add(t);
    return [...conjunto].sort((a, b) => a.localeCompare(b));
  }, [leads]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
          <span>
            <strong className="text-gray-800">{leads.length}</strong> leads no funil
          </span>
          {ETAPAS.map((etapa) => (
            <span key={etapa} className="hidden md:inline">
              {ETAPA_LABEL[etapa]}: <strong className="text-gray-700">{porEtapa[etapa]}</strong>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={pedirSugestoes}
            disabled={carregandoSugestoes}
            className="px-5 py-2.5 text-sm font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition disabled:opacity-60 shadow-sm"
          >
            <i className={cn('fas fa-wand-magic-sparkles mr-2', carregandoSugestoes && 'fa-spin')} />
            Sugestões da IA
          </button>
          {/* Exportação em estilo neutro (von Restorff: não compete com o primário) */}
          <button
            onClick={exportarCsv}
            disabled={exportando}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-60 shadow-sm"
          >
            <i className={cn('fas fa-file-csv mr-2', exportando && 'fa-spin')} />
            {exportando ? 'Exportando...' : 'Exportar CSV'}
          </button>
          {/* Botão primário (Lei de Fitts + von Restorff) */}
          <button
            onClick={() => setModalAberto(true)}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition shadow-sm"
          >
            <i className="fas fa-plus mr-2" /> Adicionar Lead
          </button>
        </div>
      </div>

      {/* Barra de busca larga (Lei de Fitts) */}
      <div className="relative">
        <i className="fas fa-search absolute left-3 top-3 text-gray-400 text-sm" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar leads por nome, telefone ou e-mail..."
          className="w-full pl-9 pr-9 py-2.5 text-sm bg-white border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-400 outline-none"
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            aria-label="Limpar busca"
          >
            <i className="fas fa-times" />
          </button>
        )}
        <select
          value={tagFiltro}
          onChange={(e) => setTagFiltro(e.target.value)}
          className="text-sm bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2.5 focus:ring-2 focus:ring-indigo-400 outline-none"
        >
          <option value="">Todas as tags</option>
          {todasTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      {/* Zeigarnik: busca sem resultados mostra mensagem amigável */}
      {busca.trim() && leadsFiltrados.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          <i className="fas fa-magnifying-glass mr-2" />
          Nenhum lead encontrado para "<strong>{busca.trim()}</strong>". Tente outro nome, telefone ou e-mail.
        </div>
      )}

      <KanbanBoard leads={leadsFiltrados} onMover={mover} onAbrirLead={(lead) => { setEditando(lead); setObservacoes(lead.observacoes || ''); }} />

      {/* Painel de sugestões do agente de CRM */}
      <Modal aberto={sugestoes !== null} onFechar={() => setSugestoes(null)} titulo="Sugestões de movimentação (Agente de CRM)" icone="fas fa-robot" largura="lg">
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

      {/* Modal: criar lead */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Adicionar Lead" icone="fas fa-user-plus">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo rotulo="Nome *" valor={novo.nome || ''} onChange={(v) => setNovo({ ...novo, nome: v })} />
            <Campo rotulo="Telefone" valor={novo.telefone || ''} onChange={(v) => setNovo({ ...novo, telefone: v })} placeholder="(11) 99999-9999" />
            <Campo rotulo="E-mail" tipo="email" valor={novo.email || ''} onChange={(v) => setNovo({ ...novo, email: v })} placeholder="contato@empresa.com.br" />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Coluna inicial</label>
              <select
                value={novo.etapa || 'leads'}
                onChange={(e) => setNovo({ ...novo, etapa: e.target.value as Etapa })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                {ETAPAS.map((etapa) => (
                  <option key={etapa} value={etapa}>{ETAPA_LABEL[etapa]}</option>
                ))}
              </select>
            </div>
          </div>
          <Campo rotulo="Fonte" valor={novo.fonte || ''} onChange={(v) => setNovo({ ...novo, fonte: v })} placeholder="Manual, Google Maps, Instagram, CNPJ..." />
          <Accordion titulo="Campos avançados" icone="fas fa-sliders">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo rotulo="Empresa" valor={novo.empresa || ''} onChange={(v) => setNovo({ ...novo, empresa: v })} />
              <Campo rotulo="Cidade" valor={novo.cidade || ''} onChange={(v) => setNovo({ ...novo, cidade: v })} placeholder="São Paulo/SP" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
              <textarea
                value={novo.observacoes || ''}
                onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              />
            </div>
          </Accordion>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={criar} className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90">
              <i className="fas fa-save mr-2" /> Salvar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: detalhes do lead (clique no card) */}
      <Modal aberto={!!editando} onFechar={() => setEditando(null)} titulo="Detalhes do Lead" icone="fas fa-address-card">
        {editando && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-gray-800">{editando.nome}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editando.fonte} · criado em {dataHora(editando.criado_em)}
                </p>
              </div>
              <StatusBadge status={editando.etapa} />
            </div>

            {/* Dados completos (inclui extras: site, endereço, avaliação...) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <Dado rotulo="Empresa" valor={editando.empresa} />
              <Dado rotulo="CNPJ" valor={editando.cnpj} />
              <Dado rotulo="Endereço" valor={editando.endereco} />
              <Dado rotulo="Cidade" valor={editando.cidade} />
              <Dado rotulo="Site" valor={dadoExtra(editando, 'site', 'website', 'web_site')} />
              <Dado rotulo="Avaliação" valor={dadoExtra(editando, 'avaliacao', 'rating', 'nota')} />
              <Dado rotulo="Seguidores" valor={dadoExtra(editando, 'seguidores', 'followers')} />
              <Dado rotulo="Username" valor={dadoExtra(editando, 'username', 'handle')} />
              <Dado rotulo="Bio" valor={dadoExtra(editando, 'bio', 'biography')} />
              <div className="md:col-span-2 flex flex-wrap gap-1.5">
                {(editando.tags || []).map((tag) => (
                  <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Edição dos campos principais */}
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500">Editar dados</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
                  <input
                    value={nomeEdit}
                    onChange={(e) => setNomeEdit(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2',
                      nomeEdit.trim() ? 'border-gray-200 focus:ring-indigo-400' : 'border-red-400 focus:ring-red-400',
                    )}
                  />
                  {!nomeEdit.trim() && <p className="text-[11px] text-red-600 mt-1">O nome não pode ficar vazio.</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Telefone</label>
                  <input
                    value={telefoneEdit}
                    onChange={(e) => setTelefoneEdit(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={emailEdit}
                    onChange={(e) => setEmailEdit(e.target.value)}
                    placeholder="contato@empresa.com.br"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
                  placeholder="Ex.: ligou pedindo proposta, retorna na sexta..."
                />
              </div>
            </div>

            {/* Tags (von Restorff: "Quente"/"Urgente" em cores vibrantes) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tagsEdit.length === 0 && <span className="text-xs text-gray-400">Nenhuma tag ainda.</span>}
                {tagsEdit.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded ${corTag(tag)}`}
                  >
                    {tag}
                    <button onClick={() => removerTag(tag)} className="opacity-60 hover:opacity-100" aria-label={`Remover tag ${tag}`}>
                      <i className="fas fa-times text-[9px]" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={novaTag}
                  onChange={(e) => setNovaTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && adicionarTag()}
                  placeholder="Nova tag (ex.: Quente, Urgente)"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
                />
                <button
                  onClick={adicionarTag}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
                >
                  <i className="fas fa-plus" />
                </button>
              </div>
            </div>

            {/* Score — estrelas clicáveis grandes (Lei de Fitts) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Prioridade do lead (0–5 estrelas)</label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((estrela) => (
                  <button
                    key={estrela}
                    onClick={() => salvarScore(scoreEdit === estrela ? 0 : estrela)}
                    title={`${estrela} estrela${estrela > 1 ? 's' : ''}`}
                    className="p-1 group"
                    aria-label={`Definir score ${estrela}`}
                  >
                    <i
                      className={cn(
                        'fas fa-star text-2xl transition-transform group-hover:scale-110',
                        scoreEdit >= estrela ? 'text-amber-400' : 'text-gray-200 hover:text-amber-200',
                      )}
                    />
                  </button>
                ))}
                {scoreEdit > 0 && (
                  <button onClick={() => salvarScore(0)} className="ml-2 text-xs text-gray-400 hover:text-gray-600">
                    limpar
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <button onClick={() => enriquecer(editando)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                <i className="fas fa-wand-magic-sparkles mr-1" /> Enriquecer com IA
              </button>
              {/* Salvar grande em gradiente (Fitts + von Restorff) */}
              <button
                onClick={salvarDetalhes}
                disabled={salvando}
                className="flex-1 md:flex-none px-8 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 disabled:opacity-60"
              >
                <i className={cn('fas fa-save mr-2', salvando && 'fa-spin')} />
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor?: string | number | null }) {
  if (valor === undefined || valor === null || valor === '') return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{rotulo}</p>
      <p className="text-gray-700 break-words">{String(valor)}</p>
    </div>
  );
}

function dadoExtra(lead: Lead, ...chaves: string[]): string {
  const extras = (lead.extras || {}) as Record<string, unknown>;
  for (const chave of chaves) {
    if (extras[chave] !== undefined && extras[chave] !== null && extras[chave] !== '') {
      return String(extras[chave]);
    }
  }
  return '';
}

function Campo({
  rotulo,
  valor,
  onChange,
  tipo = 'text',
  placeholder,
}: {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  tipo?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{rotulo}</label>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
      />
    </div>
  );
}
