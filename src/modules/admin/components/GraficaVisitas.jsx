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
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.raw} visitas`
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  return (
    <div>

      {/* HEADER */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          Visitas por día 📅
        </h3>
        <p className="text-sm text-gray-500">
          Últimos días de actividad
        </p>
      </div>

      {/* GRÁFICA */}
      <div className="bg-white p-4 rounded-xl shadow">
        <Bar data={data} options={options} />
      </div>

    </div>
  );
} 