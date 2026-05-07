import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';
import {
  ESTADOS_CARTERA_ACTIVA,
  ESTADOS_PAGO,
  getAgingCartera,
  getEstadoPagoUi,
  getResumenFinancieroEjecutivo,
  getTopCarteraApartamentos
} from '../utils/pagosEstados';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`;

const KPI_CARDS = [
  { key: 'porcentajeRecaudo', title: '% recaudo periodo', suffix: '%', className: 'text-state-success' },
  { key: 'porcentajeCarteraPendiente', title: '% cartera pendiente', suffix: '%', className: 'text-state-warning' },
  { key: 'porcentajeCarteraVencida', title: '% cartera vencida', suffix: '%', className: 'text-state-error' },
  { key: 'totalRecaudado', title: 'Total recaudado', money: true, className: 'text-state-success' },
  { key: 'totalPendiente', title: 'Total pendiente', money: true, className: 'text-state-warning' },
  { key: 'totalVencido', title: 'Total vencido', money: true, className: 'text-state-error' },
  { key: 'totalEnValidacion', title: 'Total en validación', money: true, className: 'text-state-info' },
  { key: 'totalRechazado', title: 'Total rechazado', money: true, className: 'text-state-error' },
  { key: 'pagosAprobados', title: 'Pagos aprobados', className: 'text-state-success' },
  { key: 'pagosVencidos', title: 'Pagos vencidos', className: 'text-state-error' },
  { key: 'comprobantesEnRevision', title: 'Comprobantes en revisión', className: 'text-state-info' }
];

export default function AnaliticaFinancieraAvanzada({ pagos = [] }) {
  const resumen = getResumenFinancieroEjecutivo(pagos);
  const aging = getAgingCartera(pagos);
  const topCartera = getTopCarteraApartamentos(pagos, 6);
  const maxAging = Math.max(...aging.map((bucket) => bucket.total), 1);

  const agingData = {
    labels: aging.map((bucket) => bucket.label),
    datasets: [
      {
        label: 'Cartera vencida por antigüedad',
        data: aging.map((bucket) => bucket.total),
        backgroundColor: ['#F59E0B', '#F97316', '#EF4444', '#991B1B'],
        borderRadius: 10,
        maxBarThickness: 42
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F172A',
        titleColor: '#F8FAFC',
        bodyColor: '#E2E8F0',
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
        }
      }
    },
    scales: {
      x: { ticks: { color: '#E5E7EB' }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: '#E5E7EB' }, grid: { color: 'rgba(148, 163, 184, 0.18)' } }
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-app-text-secondary mb-2">KPIs ejecutivos reales</p>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
          {KPI_CARDS.map((card) => {
            const rawValue = resumen[card.key];
            const value = card.money ? formatCurrency(rawValue) : `${rawValue}${card.suffix || ''}`;
            return (
              <div key={card.key} className="rounded-xl border border-app-border bg-app-bg px-3 py-3">
                <p className="text-[11px] text-app-text-secondary">{card.title}</p>
                <p className={`text-xl font-bold mt-1 ${card.className}`}>{value}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <div className="app-surface-muted p-4">
          <div className="mb-3">
            <h4 className="font-semibold text-app-text-primary">Aging de cartera</h4>
            <p className="text-xs text-app-text-secondary">Agrupado por fecha de vencimiento y días de mora.</p>
          </div>
          <div className="h-[220px] mb-3">
            <Bar data={agingData} options={chartOptions} />
          </div>
          <div className="space-y-2">
            {aging.map((bucket) => (
              <div key={bucket.key} className="rounded-lg border border-app-border bg-app-bg p-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold">{bucket.label}</span>
                  <span>{bucket.cantidad} pagos · {formatCurrency(bucket.total)}</span>
                </div>
                <div className="h-2 rounded-full bg-app-bg-alt overflow-hidden">
                  <div className="h-full rounded-full bg-state-error" style={{ width: `${Math.min(100, (bucket.total / maxAging) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="app-surface-muted p-4">
          <div className="mb-3">
            <h4 className="font-semibold text-app-text-primary">Top cartera / morosos</h4>
            <p className="text-xs text-app-text-secondary">Ranking por apartamento, residente y mayor deuda activa.</p>
          </div>
          <div className="space-y-2">
            {topCartera.length === 0 && <p className="text-sm text-app-text-secondary">Sin cartera activa para el filtro actual.</p>}
            {topCartera.map((item, index) => (
              <article key={item.key} className="rounded-xl border border-app-border bg-app-bg p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">#{index + 1} Torre {item.torre} · Apto {item.apartamento}</p>
                    <p className="text-xs text-app-text-secondary">{item.residente} · {item.cantidadPagos} pagos no aprobados{item.maxDiasMora ? ` · ${item.maxDiasMora}d mora máx.` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-state-error">{formatCurrency(item.totalAdeudado)}</p>
                    <p className="text-[11px] text-app-text-secondary">total adeudado</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {ESTADOS_CARTERA_ACTIVA.map((estadoKey) => {
                    const info = item.porEstado[estadoKey];
                    if (!info?.cantidad) return null;
                    const estadoUi = getEstadoPagoUi(estadoKey);
                    return (
                      <span key={estadoKey} className={`app-badge ${estadoUi.badge}`}>
                        {estadoUi.label}: {info.cantidad} · {formatCurrency(info.total)}
                      </span>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
