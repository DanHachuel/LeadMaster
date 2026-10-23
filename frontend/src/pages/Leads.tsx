import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Etapa, Lead } from '../lib/types';
import { ETAPAS, ETAPA_LABEL } from '../lib/types';
import { Modal } from '../components/Modal';
import { Accordion } from '../components/Accordion';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { camposFaltantes, completude, cn, dataHora, downloadJson, mensagemMeta } from '../lib/format';

const VAZIO: Partial<Lead> = { nome: '', telefone: '', email: '', fonte: 'Manual', etapa: 'leads' };

export function Leads() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState<string>('todas');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Partial<Lead> | null>(null);
  const [excluindo, setExcluindo] = useState<Lead | null>(null);
  const [enriquecendoId, setEnriquecendoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLeads(await api.leads.listar());
  }, []);

  useEffect(() => {
    carregar().catch((e) => toast('erro', e.message));
  }, [carregar, toast]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return leads.filter((l) => {
      const casaTermo =
        !termo ||
        l.nome.toLowerCase().includes(termo) ||
        l.telefone.includes(termo) ||
        l.email.toLowerCase().includes(termo);
      const casaEtapa = filtroEtapa === 'todas' || l.etapa === filtroEtapa;
      return casaTermo && casaEtapa;
    });
  }, [leads, busca, filtroEtapa]);

  const abrirNovo = () => {
    setEditando({ ...VAZIO });
    setModalAberto(true);
  };

  const abrirEdicao = (lead: Lead) => {
    setEditando({ ...lead });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!editando?.nome?.trim()) {
      toast('erro', 'O nome do lead é obrigatório.');
      return;
    }
    try {
      if (editando.id) {
        const { id, criado_em, atualizado_em, ...patch } = editando;
        await api.leads.atualizar(id, patch as Partial<Lead>);
        toast('sucesso', 'Lead atualizado.');
      } else {
        await api.leads.criar(editando);
        toast('sucesso', 'Lead criado com sucesso.');
      }
      setModalAberto(false);
      setEditando(null);
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao salvar lead.');
    }
  };

  const excluir = async () => {
    if (!excluindo) return;
    try {
      await api.leads.remover(excluindo.id);
      toast('sucesso', `Lead "${excluindo.nome}" removido.`);
      setExcluindo(null);
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao remover.');
    }
  };

  const enriquecer = async (lead: Lead) => {
    setEnriquecendoId(lead.id);
    try {
      const r = await api.leads.enriquecer(lead.id);
      r.notas.forEach((nota) => toast('info', nota));
      toast('sucesso', 'Lead enriquecido.');
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao enriquecer.');
    } finally {
      setEnriquecendoId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <i className="fas fa-search absolute left-3 top-2.5 text-gray-400 text-sm" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
            />
          </div>
          <select
            value={filtroEtapa}
            onChange={(e) => setFiltroEtapa(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
          >
            <option value="todas">Todas as etapas</option>
            {ETAPAS.map((etapa) => (
              <option key={etapa} value={etapa}>
                {ETAPA_LABEL[etapa]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadJson(leads, 'leadmaster-leads.json')}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <i className="fas fa-download mr-2" /> Exportar
          </button>
          {/* Botão primário grande (Lei de Fitts + von Restorff) */}
          <button
            onClick={abrirNovo}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition shadow-sm"
          >
            <i className="fas fa-plus mr-2" /> Novo Lead
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 font-semibold">Lead</th>
                <th className="px-5 py-3 font-semibold">Contato</th>
                <th className="px-5 py-3 font-semibold">Etapa</th>
                <th className="px-5 py-3 font-semibold">Completude</th>
                <th className="px-5 py-3 font-semibold">Atualizado</th>
                <th className="px-5 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((lead) => {
                const pct = completude(lead);
                const faltam = camposFaltantes(lead);
                return (
                  <tr key={lead.id} className="border-b border-gray-50 hover:bg-indigo-50/40 transition">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800">{lead.nome}</p>
                      <p className="text-xs text-gray-400">
                        {lead.fonte}
                        {lead.empresa ? ` · ${lead.empresa}` : ''}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <p>{lead.telefone || '—'}</p>
                      <p className="text-xs text-gray-400">{lead.email || 'sem e-mail'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={lead.etapa} />
                    </td>
                    <td className="px-5 py-3 w-52">
                      <ProgressBar valor={pct} altura="sm" />
                      <p className="text-[11px] text-gray-400 mt-1">{mensagemMeta(pct, faltam)}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">{dataHora(lead.atualizado_em)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => enriquecer(lead)}
                        disabled={enriquecendoId === lead.id}
                        title=" Enriquecer com IA / BrasilAPI"
                        className="text-gray-400 hover:text-indigo-600 px-1.5 disabled:opacity-40"
                      >
                        <i className={cn('fas fa-wand-magic-sparkles', enriquecendoId === lead.id && 'fa-spin')} />
                      </button>
                      <button
                        onClick={() => abrirEdicao(lead)}
                        title="Editar"
                        className="text-gray-400 hover:text-indigo-600 px-1.5"
                      >
                        <i className="fas fa-pen" />
                      </button>
                      <button
                        onClick={() => setExcluindo(lead)}
                        title="Excluir"
                        className="text-gray-400 hover:text-red-600 px-1.5"
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-gray-400">
                    <i className="fas fa-users text-3xl text-gray-200 block mb-3" />
                    Nenhum lead encontrado. Crie um novo ou importe pelos Extratores.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de criação/edição */}
      <Modal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        titulo={editando?.id ? 'Editar lead' : 'Novo lead'}
        icone="fas fa-user-plus"
      >
        {editando && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo rotulo="Nome *" valor={editando.nome || ''} onChange={(v) => setEditando({ ...editando, nome: v })} />
              <Campo rotulo="Telefone" valor={editando.telefone || ''} onChange={(v) => setEditando({ ...editando, telefone: v })} placeholder="(11) 99999-9999" />
              <Campo rotulo="E-mail" tipo="email" valor={editando.email || ''} onChange={(v) => setEditando({ ...editando, email: v })} placeholder="contato@empresa.com.br" />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Etapa</label>
                <select
                  value={editando.etapa || 'leads'}
                  onChange={(e) => setEditando({ ...editando, etapa: e.target.value as Etapa })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
                >
                  {ETAPAS.map((etapa) => (
                    <option key={etapa} value={etapa}>
                      {ETAPA_LABEL[etapa]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lei de Hick: campos avançados escondidos */}
            <Accordion titulo="Campos avançados" icone="fas fa-sliders">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo rotulo="Empresa" valor={editando.empresa || ''} onChange={(v) => setEditando({ ...editando, empresa: v })} />
                <Campo rotulo="CNPJ" valor={editando.cnpj || ''} onChange={(v) => setEditando({ ...editando, cnpj: v })} placeholder="00.000.000/0000-00" />
                <Campo rotulo="Cidade" valor={editando.cidade || ''} onChange={(v) => setEditando({ ...editando, cidade: v })} placeholder="São Paulo/SP" />
                <Campo rotulo="Fonte" valor={editando.fonte || ''} onChange={(v) => setEditando({ ...editando, fonte: v })} placeholder="Google Maps, Instagram, CNPJ..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
                <textarea
                  value={editando.observacoes || ''}
                  onChange={(e) => setEditando({ ...editando, observacoes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
                  placeholder="Histórico de conversas, próximos passos..."
                />
              </div>
            </Accordion>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setModalAberto(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition"
              >
                <i className="fas fa-save mr-2" /> Salvar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmação de exclusão */}
      <Modal aberto={!!excluindo} onFechar={() => setExcluindo(null)} titulo="Excluir lead" icone="fas fa-trash">
        <p className="text-sm text-gray-600">
          Tem certeza que deseja excluir <strong>{excluindo?.nome}</strong>? Essa ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setExcluindo(null)}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button onClick={excluir} className="px-6 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
            Excluir
          </button>
        </div>
      </Modal>
    </div>
  );
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
