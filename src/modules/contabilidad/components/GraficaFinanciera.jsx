import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';
import { ESTADOS_PAGO, getEstadoPagoKey, getValorPago } from '../utils/pagosEstados';

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

const DATASETS_ESTADOS = [
  {
    key: ESTADOS_PAGO.PAGADO,
    label: 'Recaudado 💰',
    backgroundColor: 'rgba(16, 185, 129, 0.85)'
  },
  {
    key: ESTADOS_PAGO.PENDIENTE,
    label: 'Pendiente ⏳',
    backgroundColor: 'rgba(245, 158, 11, 0.85)'
  },
  {
    key: ESTADOS_PAGO.EN_REVISION,
    label: 'En revisión 🔎',
    backgroundColor: 'rgba(56, 189, 248, 0.85)'
  },
  {
    key: ESTADOS_PAGO.RECHAZADO,
    label: 'Rechazado ⚠️',
    backgroundColor: 'rgba(239, 68, 68, 0.85)'
  }
];

export default function GraficaFinanciera({ pagos }) {
  const agrupado = {};

  pagos.forEach((p) => {
    const fecha = p.created_at.split('T')[0];
    const estadoKey = getEstadoPagoKey(p.estado);

    if (!agrupado[fecha]) {
      agrupado[fecha] = DATASETS_ESTADOS.reduce((acc, dataset) => ({
        ...acc,
        [dataset.key]: 0
      }), {});
    }

    agrupado[fecha][estadoKey] += getValorPago(p);
  });

  const fechas = Object.keys(agrupado).sort();

  const labels = fechas.map((f) => {
    const date = new Date(f);
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short'
    });
  });

  const data = {
    labels,
    datasets: DATASETS_ESTADOS.map((dataset) => ({
      label: dataset.label,
      data: fechas.map((f) => agrupado[f][dataset.key]),
      backgroundColor: dataset.backgroundColor,
      borderRadius: 8,
      maxBarThickness: 34
    }))
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
