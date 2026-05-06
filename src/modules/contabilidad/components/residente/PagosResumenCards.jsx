export default function PagosResumenCards({ resumen }) {
  const saldo = Number(resumen?.pendienteValor || 0);

  return (
    <section className="grid grid-cols-2 lg:grid-cols-[0.85fr_0.85fr_1.3fr] gap-3">
      <div className="rounded-2xl border border-state-warning/25 bg-app-bg px-4 py-3">
        <p className="text-[11px] uppercase tracking-wide text-app-text-secondary">Pendientes</p>
        <p className="mt-1 text-2xl font-bold text-state-warning">{resumen?.pendientes || 0}</p>
        <p className="text-xs text-app-text-secondary">Por gestionar</p>
      </div>

      <div className="rounded-2xl border border-state-success/25 bg-app-bg px-4 py-3">
        <p className="text-[11px] uppercase tracking-wide text-app-text-secondary">Pagados</p>
        <p className="mt-1 text-2xl font-bold text-state-success">{resumen?.pagados || 0}</p>
        <p className="text-xs text-app-text-secondary">Aprobados</p>
      </div>

      <div className="col-span-2 lg:col-span-1 rounded-2xl border border-brand-primary/35 bg-gradient-to-br from-brand-primary/18 to-app-bg px-4 py-3">
        <p className="text-[11px] uppercase tracking-wide text-app-text-secondary">Saldo pendiente</p>
        <p className="mt-1 text-3xl font-black text-app-text-primary">${saldo.toLocaleString('es-CO')}</p>
        <p className="text-xs text-app-text-secondary">Total de cobros pendientes de pago</p>
      </div>
    </section>
  );
}
