import { Doughnut } from 'react-chartjs-2';
import './registry';

interface Props {
  enviadas: number;
  erros: number;
}

/** Doughnut — Desempenho das campanhas (Enviadas × Erros), fiel ao protótipo. */
export function CampaignsDoughnut({ enviadas, erros }: Props) {
  // Zero state (Zeigarnik): sem disparos, mensagem amigável em vez de gráfico vazio.
  if (enviadas + erros === 0) {
    return (
      <div className="mt-4 h-64 flex flex-col items-center justify-center text-center gap-2 border-2 border-dashed border-gray-100 rounded-lg px-4">
        <i className="fas fa-paper-plane text-2xl text-gray-300" />
        <p className="text-sm text-gray-400">Nenhuma campanha disparada ainda.</p>
        <p className="text-xs text-gray-300">Crie uma campanha em Disparos para ver o desempenho aqui.</p>
      </div>
    );
  }

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
