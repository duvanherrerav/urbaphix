export default function PagoEmptyState() {
  return (
    <div className="app-surface-primary p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/15 text-2xl">💰</div>
      <h3 className="text-lg font-bold text-app-text-primary">Aún no tienes cobros registrados</h3>
      <p className="mt-1 text-sm text-app-text-secondary">Cuando la administración genere un cobro, aparecerá aquí.</p>
    </div>
  );
}
