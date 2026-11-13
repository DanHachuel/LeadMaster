import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Cadencia } from '../lib/types';
import { ETAPAS, ETAPA_LABEL } from '../lib/types';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { cn, dataHora } from '../lib/format';

const ACOES = [
  { valor: 'mover_para_proposta', rotulo: 'Mover para Proposta' },
  { valor: 'mover_para_em_contato', rotulo: 'Mover para Em Contato' },
  { valor: 'adicionar_tag_frio', rotulo: 'Adicionar tag "Frio"' },
];

const ETAPAS_GATILHO = ETAPAS.filter((e) => e !== 'fechado');

const VAZIA = { nome: '', etapa_gatilho: 'em_contato', dias_espera: 3, acao: 'mover_para_proposta', ativo: true };

/**
 * Cadências de Follow-up — reengajamento automático de leads parados no
 * Kanban. Modal simples com 4 campos (Lei de Hick), toggle ativo/inativo com
 * cores contrastantes (von Restorff) e ícone de relógio pulsante para
 * cadências ativas (Zeigarnik).
 */
export function Cadencias() {
  const { toast } = useToast();
  const [cadences, setCadences] = useState<Cadencia[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Cadencia | null>(null);
  const [form, setForm] = useState<{ nome: string; etapa_gatilho: string; dias_espera: number; acao: string; ativo: boolean }>({ ...VAZIA });
  const [diasTexto, setDiasTexto] = useState('3');

  const carregar = useCallback(async () => {
    setCadences(await api.cadences.listar());
  }, []);

  useEffect(() => {
    carregar().catch((e) => toast('erro', e.message));
  }, [carregar, toast]);

  const abrirNova = () => {
    setEditando(null);
    setForm({ ...VAZIA });
    setDiasTexto('3');
    setModalAberto(true);
  };

  const abrirEdicao = (cad: Cadencia) => {
    setEditando(cad);
    setForm({ nome: cad.nome, etapa_gatilho: cad.etapa_gatilho, dias_espera: cad.dias_espera, acao: cad.acao, ativo: cad.ativo });
    setDiasTexto(String(cad.dias_espera));
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) {
      toast('erro', 'Informe o nome da cadência.');
      return;
    }
    const dias = Number(diasTexto);
    if (!Number.isInteger(dias) || dias < 1) {
      toast('erro', 'Dias de espera deve ser um número inteiro maior que zero.');
      return;
    }
    try {
      if (editando) {
        await api.cadences.editar(editando.id, { ...form, dias_espera: dias });
        toast('sucesso', 'Cadência atualizada.');
      } else {
        await api.cadences.criar({ ...form, dias_espera: dias });
        toast('sucesso', 'Cadência criada — o worker executa automaticamente.');
      }
      setModalAberto(false);
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao salvar cadência.');
    }
  };

  const alternarAtivo = async (cad: Cadencia) => {
    try {
      await api.cadences.editar(cad.id, { ativo: !cad.ativo });
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao alterar status.');
    }
  };

  const remover = async (cad: Cadencia) => {
    try {
      await api.cadences.remover(cad.id);
      toast('sucesso', `Cadência "${cad.nome}" removida.`);
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao remover.');
    }
  };

  const verificarAgora = async () => {
    try {
      const r = await api.cadences.verificar();
      if (r.executadas.length > 0) {
        toast('sucesso', `${r.executadas.length} follow-up(s) executado(s) agora.`);
      } else {
        toast('info', 'Nenhum lead estourou o tempo das cadências.');
      }
      await carregar();
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao verificar.');
    }
  };

  const temAtiva = useMemo(() => cadences.some((c) => c.ativo), [cadences]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>
            <strong className="text-gray-800">{cadences.length}</strong> cadências
          </span>
          {temAtiva && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              worker ativo
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={verificarAgora}
            className="px-5 py-2.5 text-sm font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 shadow-sm"
          >
            <i className="fas fa-bolt mr-2" /> Verificar agora
          </button>
          <button
            onClick={abrirNova}
            className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90 transition shadow-sm"
          >
            <i className="fas fa-plus mr-2" /> Nova Cadência
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">Etapa Gatilho</th>
                <th className="px-5 py-3 font-semibold">Dias de Espera</th>
                <th className="px-5 py-3 font-semibold">Ação</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {cadences.map((cad) => (
                <tr key={cad.id} className="border-b border-gray-50 hover:bg-indigo-50/40">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800 flex items-center gap-2">
                      {cad.ativo && <i className="fas fa-clock text-emerald-500 animate-pulse" title="Cadência ativa" />}
                      {cad.nome}
                    </p>
                    {cad.ultimas_execucoes?.[0] && (
                      <p className="text-xs text-gray-400 mt-0.5" title={cad.ultimas_execucoes[0].descricao}>
                        última: {cad.ultimas_execucoes[0].lead_nome} ({dataHora(cad.ultimas_execucoes[0].executada_em)})
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{ETAPA_LABEL[cad.etapa_gatilho as keyof typeof ETAPA_LABEL] ?? cad.etapa_gatilho}</td>
                  <td className="px-5 py-3 text-gray-600">{cad.dias_espera} dias</td>
                  <td className="px-5 py-3 text-gray-600">{ACOES.find((a) => a.valor === cad.acao)?.rotulo ?? cad.acao}</td>
                  <td className="px-5 py-3">
                    {/* Toggle com cores contrastantes (von Restorff) */}
                    <button
                      onClick={() => alternarAtivo(cad)}
                      className={cn(
                        'relative w-12 h-6.5 py-0.5 rounded-full transition-colors',
                        cad.ativo ? 'bg-emerald-500' : 'bg-red-400',
                      )}
                      aria-label={cad.ativo ? 'Desativar cadência' : 'Ativar cadência'}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                          cad.ativo && 'translate-x-6',
                        )}
                      />
                      <span className="sr-only">{cad.ativo ? 'Ativo' : 'Inativo'}</span>
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => abrirEdicao(cad)} className="text-gray-400 hover:text-indigo-600 px-1.5" title="Editar">
                      <i className="fas fa-pen" />
                    </button>
                    <button onClick={() => remover(cad)} className="text-gray-400 hover:text-red-600 px-1.5" title="Excluir">
                      <i className="fas fa-trash" />
                    </button>
                  </td>
                </tr>
              ))}
              {cadences.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-gray-400">
                    <i className="fas fa-clock-rotate-left text-3xl text-gray-200 block mb-3" />
                    Nenhuma cadência. Crie a primeira para reengajar leads parados automaticamente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        <i className="fas fa-circle-info mr-1" /> O worker verifica as cadências a cada hora (configurável em
        <strong> config.json → cadencias.intervalo_horas</strong>) e aplica a ação automaticamente, registrando cada execução.
      </p>

      {/* Modal: criar/editar (4 campos no máximo — Lei de Hick) */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo={editando ? 'Editar Cadência' : 'Nova Cadência'} icone="fas fa-clock-rotate-left">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex.: Follow-up 1"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Etapa Gatilho</label>
              <select
                value={form.etapa_gatilho}
                onChange={(e) => setForm({ ...form, etapa_gatilho: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                {ETAPAS_GATILHO.map((etapa) => (
                  <option key={etapa} value={etapa}>{ETAPA_LABEL[etapa]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Dias de Espera *</label>
              <input
                type="number"
                min={1}
                value={diasTexto}
                onChange={(e) => setDiasTexto(e.target.value)}
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2',
                  Number(diasTexto) >= 1 ? 'border-gray-200 focus:ring-indigo-400' : 'border-red-400 focus:ring-red-400',
                )}
              />
              {Number(diasTexto) < 1 && <p className="text-[11px] text-red-600 mt-1">Use um número inteiro maior que zero.</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ação</label>
            <select
              value={form.acao}
              onChange={(e) => setForm({ ...form, acao: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            >
              {ACOES.map((acao) => (
                <option key={acao.valor} value={acao.valor}>{acao.rotulo}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="w-4 h-4 accent-indigo-500"
            />
            Cadência ativa
          </label>
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => setModalAberto(false)}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:opacity-90"
            >
              <i className="fas fa-save mr-2" /> Salvar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
