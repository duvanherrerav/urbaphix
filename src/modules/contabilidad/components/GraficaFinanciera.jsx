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
    plugins: {
      legend: {
        position: 'bottom'
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow mb-6">

      <h3 className="text-lg font-semibold mb-4">
        Flujo financiero 📊
      </h3>

      <Bar data={data} options={options} />

    </div>
  );
}
