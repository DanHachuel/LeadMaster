import { Bar } from 'react-chartjs-2';
import type { Etapa } from '../../lib/types';
import { ETAPA_LABEL, ETAPAS } from '../../lib/types';
import './registry';

interface Props {
  porEtapa: Record<Etapa, number>;
}

/** Gráfico de barras horizontais — Leads por etapa do CRM (fiel ao protótipo). */
export function LeadsStageChart({ porEtapa }: Props) {
  const dados = ETAPAS.map((e) => porEtapa[e] ?? 0);
  const maximo = Math.max(20, Math.ceil((Math.max(...dados) + 1) / 20) * 20);
  return (
    <div className="mt-4 h-64">
      <Bar
        data={{
          labels: ETAPAS.map((e) => ETAPA_LABEL[e]),
          datasets: [
            {
              label: 'Quantidade',
              data: dados,
              backgroundColor: [
                'rgba(59, 130, 246, 0.8)',
                'rgba(59, 130, 246, 0.6)',
                'rgba(59, 130, 246, 0.4)',
                'rgba(59, 130, 246, 0.3)',
              ],
              borderRadius: 4,
              barThickness: 24,
            },
          ],
        }}
        options={{
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              beginAtZero: true,
              max: maximo,
              grid: { color: '#f3f4f6' },
              ticks: { stepSize: 20 },
            },
            y: { grid: { display: false } },
          },
        }}
      />
    </div>
  );
}
