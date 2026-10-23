import { Doughnut } from 'react-chartjs-2';
import './registry';

interface Props {
  enviadas: number;
  erros: number;
}

/** Doughnut — Desempenho das campanhas (Enviadas × Erros), fiel ao protótipo. */
export function CampaignsDoughnut({ enviadas, erros }: Props) {
  return (
    <div className="mt-4 h-64 flex items-center justify-center">
      <Doughnut
        data={{
          labels: ['Enviadas', 'Erros'],
          datasets: [
            {
              data: [enviadas, erros],
              backgroundColor: ['#3b82f6', '#ef4444'],
              borderWidth: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (contexto) => `${contexto.label}: ${contexto.parsed}`,
              },
            },
          },
        }}
      />
    </div>
  );
}
