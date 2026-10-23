import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip } from 'chart.js';

// Registro único dos elementos usados nos gráficos do painel.
Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);
