import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

export default function GraficaVisitas({ visitas }) {

  // 🔥 AGRUPAR POR FECHA
  const visitasPorDia = {};

  visitas.forEach(v => {
    const fecha = v.fecha_visita;

    if (!visitasPorDia[fecha]) {
      visitasPorDia[fecha] = 0;
    }

    visitasPorDia[fecha]++;
  });

  const fechas = Object.keys(visitasPorDia).sort();

  const valores = fechas.map(f => visitasPorDia[f]);

  // 🔥 LABELS BONITOS
  const labels = fechas.map(f => {
    const date = new Date(f);
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short'
    });
  });

  const data = {
    labels,
    datasets: [
      {
        label: 'Visitas',
        data: valores,
        backgroundColor: 'rgba(59, 130, 246, 0.85)',
        hoverBackgroundColor: 'rgba(37, 99, 235, 0.95)',
        borderRadius: 8,
        maxBarThickness: 40
      }
    ]
  };

  // 🔥 OPCIONES PRO
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 4, right: 8, bottom: 2, left: 4 }
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#E5E7EB',
          boxWidth: 12,
          padding: 14,
          font: { size: 12, weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: '#0F172A',
        titleColor: '#F8FAFC',
        bodyColor: '#E2E8F0',
        callbacks: {
          label: (context) => ` ${context.raw} visitas`
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#E5E7EB',
          font: { size: 11, weight: '600' }
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          color: '#E5E7EB',
          font: { size: 11, weight: '600' }
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.18)'
        }
      }
    }
  };

  return (
    <div className="h-full w-full rounded-xl bg-app-bg-alt p-3">
      <div className="h-full w-full">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
