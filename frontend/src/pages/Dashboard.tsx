import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Metricas } from '../lib/types';
import { MetricCard } from '../components/MetricCard';
import { LeadsStageChart } from '../components/charts/LeadsStageChart';
import { CampaignsDoughnut } from '../components/charts/CampaignsDoughnut';
import { cn } from '../lib/format';

export function Dashboard({ nomeUsuario }: { nomeUsuario: string }) {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setErro('');
      setMetricas(await api.metricas());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar métricas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 15000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  const perfil = metricas?.perfil;
  const restam = perfil?.licenca.restam_dias;

  return (
    <div className="space-y-6">
      {/* Saudação e Licença */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Olá, {nomeUsuario} 👋 bem-vindo ao seu painel
        </h1>
        <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
          <span>
            {perfil?.licenca.ativa ? 'Licença ativa' : 'Sem licença'} •{' '}
            {perfil?.licenca.expira_em ? `expira em ${perfil.licenca.expira_em}` : '—'} • dados 100% locais
          </span>
          {restam !== null && restam !== undefined && (
            <span>
              Restam <strong className="text-gray-700">{restam === null ? '∞' : `${restam} dias`}</strong>
            </span>
          )}
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <i className="fas fa-exclamation-triangle mr-2" />
          {erro}
        </div>
      )}

      {/* Cards de Métricas (Lei de Miller: métricas agrupadas em cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard rotulo="Status da Conexão" icone="fas fa-plug">
          <div className="mt-2 flex items-center">
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                metricas?.conexao.geral ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 mr-1.5 rounded-full',
                  metricas?.conexao.geral ? 'bg-green-500' : 'bg-red-500',
                )}
              />
              {metricas?.conexao.geral ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            <i className="fas fa-brain mr-1" />
            {metricas?.conexao.llm ? 'LLM ✓' : 'LLM não configurado'} ·{' '}
            <i className="fas fa-paper-plane mr-1" />
            {metricas?.conexao.openoutreach ? 'OpenOutreach ✓' : 'OpenOutreach não configurado'}
          </p>
        </MetricCard>
        <MetricCard
          rotulo="Taxa de entrega"
          valor={carregando ? '—' : `${metricas?.taxa_entrega ?? 0}%`}
          subtitulo={`${metricas?.total_enviadas ?? 0} enviadas • total`}
          icone="fas fa-paper-plane"
        />
        <MetricCard
          rotulo="Taxa de erro"
          valor={carregando ? '—' : `${metricas?.taxa_erro ?? 0}%`}
          subtitulo={`${metricas?.total_erros ?? 0} erros • total`}
          icone="fas fa-triangle-exclamation"
        />
        <MetricCard
          rotulo="Leads cadastrados"
          valor={carregando ? '—' : metricas?.leads_total ?? 0}
          subtitulo="Total na base"
          icone="fas fa-users"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800">Leads por etapa (CRM)</h3>
              <p className="text-xs text-gray-500 mt-1">Quantidade de leads em cada coluna do Kanban</p>
            </div>
            <button
              onClick={carregar}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Atualizar
            </button>
          </div>
          {metricas ? <LeadsStageChart porEtapa={metricas.leads_por_etapa} /> : <Skeleton />}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800">Desempenho das campanhas</h3>
              <p className="text-xs text-gray-500 mt-1">Agregação de todas as campanhas (Enviadas × Erros)</p>
            </div>
            <button
              onClick={carregar}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Atualizar
            </button>
          </div>
          <CampaignsDoughnut enviadas={metricas?.campanhas.enviadas ?? 0} erros={metricas?.campanhas.erros ?? 0} />
          <div className="mt-4 flex items-center justify-center space-x-6 text-xs">
            <span className="flex items-center">
              <span className="w-3 h-3 bg-blue-500 rounded-full mr-1.5" /> Enviadas ({metricas?.campanhas.enviadas ?? 0})
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-1.5" /> Erros ({metricas?.campanhas.erros ?? 0})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-4 h-64 flex items-center justify-center text-gray-300">
      <i className="fas fa-spinner fa-spin text-2xl" />
    </div>
  );
}
