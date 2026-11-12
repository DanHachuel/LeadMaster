import { useQuery } from '@tanstack/react-query';
import { Bar } from 'react-chartjs-2';
import { api } from '../lib/api';
import type { Relatorios as DadosRelatorio } from '../lib/types';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { dataHora } from '../lib/format';
import '../components/charts/registry';

const INTERVALO_MS = 10_000; // acompanha campanhas em execução

/**
 * Relatórios (Analytics): consolidado das campanhas de disparo — cards de
 * totais (Lei de Miller), gráfico de volume por campanha (Zeigarnik) e
 * tabela de histórico com datas, enviados, erros e status.
 */
export function Relatorios() {
  const { data, isPending, isError, error, refetch } = useQuery<DadosRelatorio>({
    queryKey: ['relatorios'],
    queryFn: () => api.relatorios(),
    refetchInterval: (query) =>
      query.state.data?.resumo.ativas && query.state.data.resumo.ativas > 0 ? INTERVALO_MS : false,
    refetchIntervalInBackground: false,
  });

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
        <i className="fas fa-exclamation-triangle mr-2" />
        {error instanceof Error ? error.message : 'Falha ao carregar relatórios.'}
      </div>
    );
  }

  const resumo = data?.resumo;
  const porCampanha = data?.por_campanha ?? [];
  const porDia = data?.por_dia ?? [];
  const semDados = (resumo?.enviadas ?? 0) + (resumo?.erros ?? 0) === 0;

  const nomeCurto = (nome: string) => (nome.length > 16 ? `${nome.slice(0, 15)}…` : nome);

  return (
    <div className="space-y-6">
      {/* Cards de totais (Lei de Miller: métricas agrupadas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          rotulo="Total Enviado"
          valor={isPending ? '—' : (resumo?.enviadas ?? 0)}
          subtitulo={`${resumo?.concluidas ?? 0} campanha(s) concluída(s)`}
          icone="fas fa-paper-plane"
        />
        <MetricCard
          rotulo="Total de Erros"
          valor={isPending ? '—' : (resumo?.erros ?? 0)}
          subtitulo={`${resumo?.campanhas ?? 0} campanha(s) no histórico`}
          icone="fas fa-triangle-exclamation"
        />
        <MetricCard
          rotulo="Taxa de Sucesso Geral"
          valor={isPending ? '—' : `${resumo?.taxa_sucesso ?? 0}%`}
          subtitulo={resumo?.ativas ? `${resumo.ativas} em execução` : 'nenhuma em execução'}
          icone="fas fa-chart-line"
        />
      </div>

      {/* Gráfico de volume por campanha */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Volume de envios por campanha</h3>
            <p className="text-xs text-gray-500 mt-1">Enviados × erros de cada campanha do histórico</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center">
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-1.5" /> Enviadas
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-1.5" /> Erros
            </span>
          </div>
        </div>
        {isPending ? (
          <div className="mt-4 h-64 flex items-center justify-center text-gray-300">
            <i className="fas fa-spinner fa-spin text-2xl" />
          </div>
        ) : semDados ? (
          <div className="mt-4 h-64 flex flex-col items-center justify-center text-center gap-2 border-2 border-dashed border-gray-100 rounded-lg px-4">
            <i className="fas fa-chart-column text-2xl text-gray-300" />
            <p className="text-sm text-gray-400">Nenhum dado ainda. Comece uma campanha em Disparos!</p>
          </div>
        ) : (
          <div className="mt-4 h-64">
            <Bar
              data={{
                labels: porCampanha.map((c) => nomeCurto(c.nome)),
                datasets: [
                  {
                    label: 'Enviadas',
                    data: porCampanha.map((c) => c.enviadas),
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderRadius: 4,
                  },
                  {
                    label: 'Erros',
                    data: porCampanha.map((c) => c.erros),
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderRadius: 4,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false } },
                  y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                },
              }}
            />
          </div>
        )}
      </div>

      {/* Tabela de histórico */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-base font-semibold text-gray-800">Histórico de campanhas</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {porDia.length > 0
              ? `Volume diário: ${porDia.map((d) => `${d.dia.slice(5)} → ${d.enviadas}✓/${d.erros}✗`).join(' · ')}`
              : 'Datas, enviados, erros e status de cada campanha'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="px-5 py-3 font-semibold">Campanha</th>
                <th className="px-5 py-3 font-semibold">Iniciada</th>
                <th className="px-5 py-3 font-semibold">Concluída</th>
                <th className="px-5 py-3 font-semibold">Enviados</th>
                <th className="px-5 py-3 font-semibold">Erros</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {porCampanha.map((campanha) => (
                <tr key={campanha.id} className="border-b border-gray-50 hover:bg-indigo-50/40">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800">{campanha.nome}</p>
                    <p className="text-xs text-gray-400">{campanha.total} leads</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">{campanha.iniciada_em ? dataHora(campanha.iniciada_em) : '—'}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{campanha.concluida_em ? dataHora(campanha.concluida_em) : '—'}</td>
                  <td className="px-5 py-3 text-gray-700 font-medium">{campanha.enviadas}</td>
                  <td className="px-5 py-3 text-gray-700">{campanha.erros}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={campanha.status as 'rascunho'} />
                  </td>
                </tr>
              ))}
              {porCampanha.length === 0 && !isPending && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-gray-400">
                    <i className="fas fa-chart-pie text-3xl text-gray-200 block mb-3" />
                    Nenhuma campanha ainda. Crie uma em <strong className="text-indigo-500">Disparos</strong> para
                    ver os relatórios aqui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dica de contexto (Feedback/Zeigarnik) */}
      {!semDados && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <i className="fas fa-circle-info" />
          Os totais são recalculados a partir de <code className="bg-gray-100 px-1 rounded">campaigns.json</code> —
          com campanhas em execução, a página atualiza sozinha a cada 10s.
          <button onClick={() => refetch()} className="text-indigo-500 hover:text-indigo-700 ml-1">
            Atualizar agora
          </button>
        </p>
      )}
    </div>
  );
}
