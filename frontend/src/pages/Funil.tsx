import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ProgressBar } from '../components/ProgressBar';
import { useToast } from '../components/Toast';
import { cn } from '../lib/format';
interface EtapaFunil {
  nome: string;
  quantidade: number;
}

interface ConversaoFunil {
  de: string;
  para: string;
  taxa: number | null;
  queda: number | null;
}

interface FunilDados {
  etapas: EtapaFunil[];
  conversoes: ConversaoFunil[];
  gargalo: string | null;
}

/**
 * Funil de Prospecção — visão macro de conversão entre as etapas do CRM.
 * Sem filtros (Lei de Hick): é "bater o olho e entender". O gargalo (maior
 * queda entre etapas) é destacado em vermelho/laranja com ícone de aviso (von
 * Restorff); funil vazio mostra barra zerada com chamada para prospectar
 * (Zeigarnik).
 */
export function Funil() {
  const { toast } = useToast();
  const [dados, setDados] = useState<FunilDados | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDados(await api.funil());
    } catch (e) {
      toast('erro', e instanceof Error ? e.message : 'Falha ao carregar o funil.');
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const total = dados?.etapas?.[0]?.quantidade ?? 0;
  const vazio = total === 0;
  const base = Math.max(total, 1);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Conversão entre as etapas do CRM — atualizado a cada visita.</p>
        <button onClick={carregar} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
          <i className="fas fa-rotate mr-1" /> Atualizar
        </button>
      </div>

      {/* Funil vazio (Zeigarnik) */}
      {vazio && (
        <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-200 p-10 text-center space-y-4">
          <i className="fas fa-filter text-3xl text-gray-200 block" />
          <div className="max-w-md mx-auto space-y-2">
            <ProgressBar valor={0} />
            <p className="text-sm font-medium text-gray-600">Comece a prospectar para ver seu funil</p>
            <p className="text-xs text-gray-400">
              Extraia leads no <strong>Extrator Maps</strong> ou cadastre pelo <strong>CRM</strong>.
            </p>
          </div>
        </div>
      )}

      {dados && !vazio && (
        <>
          {/* Alerta de gargalo (von Restorff) */}
          {dados.gargalo && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="text-sm text-red-700">
                <strong>Gargalo:</strong> muitos leads param em <strong>"{dados.gargalo}"</strong> —
                vale revisar o abordagem ou o tempo de resposta nessa etapa.
              </p>
            </div>
          )}

          {/* Funil em CSS puro: fatias com larguras decrescentes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-2">
            {dados.etapas.map((etapa, i) => {
              const pct = Math.max((etapa.quantidade / base) * 100, 8);
              const ehGargalo = dados.gargalo === etapa.nome;
              return (
                <div key={etapa.nome} className="w-full flex flex-col items-center">
                  <div
                    className={cn(
                      'h-14 rounded-lg flex items-center justify-center text-white text-sm font-semibold transition-all',
                      ehGargalo
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 ring-2 ring-red-300'
                        : i % 2 === 0
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                          : 'bg-gradient-to-r from-indigo-400 to-purple-400',
                    )}
                    style={{ width: `${pct}%` }}
                    title={ehGargalo ? 'Etapa gargalo do funil' : etapa.nome}
                  >
                    {ehGargalo && <span className="mr-2">⚠️</span>}
                    {etapa.nome} · {etapa.quantidade}
                  </div>
                  {i < dados.etapas.length - 1 && <i className="fas fa-chevron-down text-gray-200 my-0.5" />}
                </div>
              );
            })}
          </div>

          {/* Cards de conversão entre etapas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dados.conversoes.map((conv) => (
              <div key={`${conv.de}-${conv.para}`} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs text-gray-400">
                  {conv.de} <i className="fas fa-arrow-right mx-1" /> {conv.para}
                </p>
                <p
                  className={cn(
                    'text-2xl font-bold mt-1',
                    conv.taxa === null ? 'text-gray-300' : conv.taxa >= 50 ? 'text-emerald-600' : conv.taxa >= 25 ? 'text-amber-500' : 'text-red-500',
                  )}
                >
                  {conv.taxa === null ? '—' : `${conv.taxa}%`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {conv.queda === null ? 'sem leads na etapa anterior' : `queda de ${conv.queda}% na etapa`}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
