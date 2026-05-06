import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { ESTADOS_PAGO, getResumenEstadosPago } from '../utils/pagosEstados';

ChartJS.register(ArcElement, Tooltip, Legend);

const CARTERA_SEGMENTOS = [
  {
    key: ESTADOS_PAGO.PAGADO,
    label: 'Pagado 💰',
    title: 'Pagado',
    color: '#10B981',
    borderColor: '#059669',
    textClass: 'text-state-success'
  },
  {
    key: ESTADOS_PAGO.PENDIENTE,
    label: 'Pendiente ⏳',
    title: 'Pendiente',
    color: '#F59E0B',
    borderColor: '#D97706',
    textClass: 'text-state-warning'
  },
  {
    key: ESTADOS_PAGO.VENCIDO,
    label: 'Vencido 🚨',
    title: 'Vencido',
    color: '#DC2626',
    borderColor: '#991B1B',
    textClass: 'text-state-error'
  },
  {
    key: ESTADOS_PAGO.EN_REVISION,
    label: 'En revisión 🔎',
    title: 'En revisión',
    color: '#38BDF8',
    borderColor: '#0284C7',
    textClass: 'text-state-info'
  },
  {
    key: ESTADOS_PAGO.RECHAZADO,
    label: 'Rechazado ⚠️',
    title: 'Rechazado',
    color: '#EF4444',
    borderColor: '#DC2626',
    textClass: 'text-state-error'
  }
];

export default function GraficaCartera({ pagos }) {
  const resumen = getResumenEstadosPago(pagos);

  const data = {
    labels: CARTERA_SEGMENTOS.map((segmento) => segmento.label),
    datasets: [
      {
        data: CARTERA_SEGMENTOS.map((segmento) => resumen[segmento.key].total),
        backgroundColor: CARTERA_SEGMENTOS.map((segmento) => segmento.color),
        borderColor: CARTERA_SEGMENTOS.map((segmento) => segmento.borderColor),
        borderWidth: 1
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    radius: '82%',
    plugins: {
      legend: {
        position: 'bottom',
        align: 'center',
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
        bodyColor: '#E2E8F0'
      }
    },
    layout: {
      padding: { top: 4, right: 6, bottom: 0, left: 6 }
    }
  };

  return (
    <div className="h-full w-full rounded-xl bg-app-bg-alt p-3 flex flex-col overflow-hidden">
      <div className="h-[240px] max-w-[320px] w-full mx-auto">
        <Doughnut data={data} options={options} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {CARTERA_SEGMENTOS.map((segmento) => (
          <div key={segmento.key} className="rounded-lg border border-app-border bg-app-bg p-2">
            <p className="font-semibold text-app-text-primary">{segmento.title}</p>
            <p className={`text-sm font-bold ${segmento.textClass}`}>
              ${resumen[segmento.key].total.toLocaleString('es-CO')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
