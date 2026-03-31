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
    plugins: {
      legend: {
        position: 'bottom'
      }
    },
    cutout: '68%'
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow">

      <h3 className="text-lg font-semibold mb-4">
        Estado financiero 📊
      </h3>

      <Doughnut data={data} options={options} />

      <div className="mt-4 text-sm text-gray-600 space-y-1">
        <p>💰 Pagado: ${totalPagado.toLocaleString()}</p>
        <p>⏳ Pendiente: ${totalPendiente.toLocaleString()}</p>
      </div>

    </div>
  );
}