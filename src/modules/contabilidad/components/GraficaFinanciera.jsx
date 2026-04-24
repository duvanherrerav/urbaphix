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

export default function GraficaFinanciera({ pagos }) {

  // 🔥 AGRUPAR DATA
  const agrupado = {};

  pagos.forEach(p => {
    const fecha = p.created_at.split('T')[0];

    if (!agrupado[fecha]) {
      agrupado[fecha] = {
        pagado: 0,
        pendiente: 0
      };
    }

    if (p.estado === 'pagado') {
      agrupado[fecha].pagado += p.valor;
    } else {
      agrupado[fecha].pendiente += p.valor;
    }
  });

  // 🔥 ORDENAR
  const fechas = Object.keys(agrupado).sort();

  const dataPagado = fechas.map(f => agrupado[f].pagado);
  const dataPendiente = fechas.map(f => agrupado[f].pendiente);

  // 🔥 FORMATEO BONITO
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
        label: 'Pagado 💰',
        data: dataPagado,
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderRadius: 8,
        maxBarThickness: 34
      },
      {
        label: 'Pendiente ⏳',
        data: dataPendiente,
        backgroundColor: 'rgba(245, 158, 11, 0.85)',
        borderRadius: 8,
        maxBarThickness: 34
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 4, right: 10, bottom: 6, left: 6 }
    },
    plugins: {
      legend: {
        position: 'bottom',
        align: 'center',
        labels: {
          color: '#E5E7EB',
          boxWidth: 12,
          padding: 16,
          font: { size: 12, weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: '#0F172A',
        titleColor: '#F8FAFC',
        bodyColor: '#E2E8F0'
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