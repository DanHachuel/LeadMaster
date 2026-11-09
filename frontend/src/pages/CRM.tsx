import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Etapa, Lead, SugestaoCrm } from '../lib/types';
import { ETAPAS, ETAPA_LABEL } from '../lib/types';
import { KanbanBoard } from '../components/KanbanBoard';
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
      // Observações seguem pela rota genérica de leads (PATCH).
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

  const porEtapa = useMemo(
    () => Object.fromEntries(ETAPAS.map((e) => [e, leads.filter((l) => l.etapa === e).length])) as Record<Etapa, number>,
    [leads],
  );

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
          {/* Botão primário (Lei de Fitts + von Restorff) */}
          <button
            onClick={() => setModalAberto(true)}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition shadow-sm"
          >
            <i className="fas fa-plus mr-2" /> Adicionar Lead
          </button>
        </div>
      </div>

      <KanbanBoard leads={leads} onMover={mover} onAbrirLead={(lead) => { setEditando(lead); setObservacoes(lead.observacoes || ''); }} />

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
