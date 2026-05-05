export default function PaquetesResumen({ resumen }) {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <article className="app-surface-primary border border-brand-primary/10 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-wide text-app-text-secondary">Total</p>
        <p className="text-2xl font-bold text-app-text-primary mt-1">{resumen.total}</p>
      </article>

      <article className="app-surface-primary border border-state-warning/30 bg-state-warning/5 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-wide text-state-warning">Pendientes</p>
        <p className="text-2xl font-bold text-state-warning mt-1">{resumen.pendientes}</p>
      </article>

      <article className="app-surface-primary border border-state-success/20 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-wide text-app-text-secondary">Entregados</p>
        <p className="text-2xl font-bold text-state-success mt-1">{resumen.entregados}</p>
      </article>

      <article className="app-surface-primary border border-brand-secondary/20 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-wide text-app-text-secondary">Servicios</p>
        <p className="text-2xl font-bold text-brand-secondary mt-1">{resumen.servicios}</p>
      </article>
    </section>
  );
}
