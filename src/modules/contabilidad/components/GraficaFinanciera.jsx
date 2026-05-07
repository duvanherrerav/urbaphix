import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';
import { ESTADOS_PAGO, estaFechaEnRango, getFechaPagoKey, getValorPago, obtenerEstadoFinancieroReal } from '../utils/pagosEstados';

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

const DATASETS_TEMPORALES = [
  { key: 'recaudo', label: 'Recaudo aprobado 💰', backgroundColor: 'rgba(16, 185, 129, 0.85)' },
  { key: 'deudaGenerada', label: 'Deuda generada 📌', backgroundColor: 'rgba(245, 158, 11, 0.85)' },
  { key: 'aprobadosCantidad', label: 'Pagos aprobados #', backgroundColor: 'rgba(34, 197, 94, 0.65)', yAxisID: 'yCount' },
  { key: 'vencidos', label: 'Vencidos por fecha 🚨', backgroundColor: 'rgba(220, 38, 38, 0.9)' }
];

function ensureDay(acc, key) {
  if (!acc[key]) {
    acc[key] = DATASETS_TEMPORALES.reduce((row, dataset) => ({
      ...row,
      [dataset.key]: 0
    }), {});
  }
}

export default function GraficaFinanciera({ pagos = [], fechaDesde = '', fechaHasta = '' }) {
  const agrupado = {};
  const rangoFechas = { fechaDesde, fechaHasta };

  pagos.forEach((p) => {
    const valor = getValorPago(p);
    const estadoKey = obtenerEstadoFinancieroReal(p);
    const fechaCreacion = getFechaPagoKey(p.created_at);
    const fechaRecaudo = getFechaPagoKey(p.fecha_pago);
    const fechaVencimiento = getFechaPagoKey(p.fecha_vencimiento);

    if (fechaCreacion && estaFechaEnRango(p.created_at, rangoFechas)) {
      ensureDay(agrupado, fechaCreacion);
      agrupado[fechaCreacion].deudaGenerada += valor;
    }

    if (estadoKey === ESTADOS_PAGO.PAGADO && fechaRecaudo && estaFechaEnRango(p.fecha_pago, rangoFechas)) {
      ensureDay(agrupado, fechaRecaudo);
      agrupado[fechaRecaudo].recaudo += valor;
      agrupado[fechaRecaudo].aprobadosCantidad += 1;
    }

    if (estadoKey === ESTADOS_PAGO.VENCIDO && fechaVencimiento && estaFechaEnRango(p.fecha_vencimiento, rangoFechas)) {
      ensureDay(agrupado, fechaVencimiento);
      agrupado[fechaVencimiento].vencidos += valor;
    }
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
    datasets: DATASETS_TEMPORALES.map((dataset) => ({
      label: dataset.label,
      data: fechas.map((f) => agrupado[f][dataset.key]),
      backgroundColor: dataset.backgroundColor,
      borderRadius: 8,
      maxBarThickness: 34,
      yAxisID: dataset.yAxisID || 'y'
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
      },
      yCount: {
        beginAtZero: true,
        position: 'right',
        ticks: {
          color: '#A7F3D0',
          precision: 0,
          font: { size: 11, weight: '600' }
        },
        grid: {
          drawOnChartArea: false
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
