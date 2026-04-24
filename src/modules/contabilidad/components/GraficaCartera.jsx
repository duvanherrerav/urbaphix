import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function GraficaCartera({ pagos }) {

  let totalPagado = 0;
  let totalPendiente = 0;

  pagos.forEach(p => {
    if (p.estado === 'pagado') {
      totalPagado += p.valor;
    } else {
      totalPendiente += p.valor;
    }
  });

  const data = {
    labels: ['Pagado 💰', 'Pendiente ⏳'],
    datasets: [
      {
        data: [totalPagado, totalPendiente],
        backgroundColor: ['#10B981', '#F59E0B'],
        borderColor: ['#059669', '#D97706'],
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
        <div className="rounded-lg border border-app-border bg-app-bg p-2">
          <p className="font-semibold text-app-text-primary">Pagado</p>
          <p className="text-sm font-bold text-state-success">${totalPagado.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-lg border border-app-border bg-app-bg p-2">
          <p className="font-semibold text-app-text-primary">Pendiente</p>
          <p className="text-sm font-bold text-state-warning">${totalPendiente.toLocaleString('es-CO')}</p>
        </div>
      </div>
    </div>
  );
}