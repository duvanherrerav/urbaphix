export default function PagoActionPanel({ pago, configPago, onPagar, onArchivoChange, onSubirComprobante }) {
  const tieneComprobante = Boolean(pago?.comprobante_url);
  const estaPagado = pago?.estado === 'pagado';
  const estaPendiente = pago?.estado === 'pendiente';
  const puedeSubir = estaPendiente;

  if (estaPagado) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {tieneComprobante && (
          <a href={pago.comprobante_url} target="_blank" rel="noreferrer" className="app-btn-ghost text-xs">
            Ver comprobante 📄
          </a>
        )}
        <span className="text-xs text-state-success">Pago aprobado por administración</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-app-border bg-app-bg/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-app-text-primary">
            {tieneComprobante ? 'Comprobante en revisión' : 'Aún no has subido comprobante'}
          </p>
          <p className="text-[11px] text-app-text-secondary">
            {tieneComprobante
              ? 'La administración revisará el soporte enviado.'
              : 'Realiza el pago y adjunta el soporte para revisión.'}
          </p>
        </div>

        {estaPendiente && !tieneComprobante && (
          <button type="button" onClick={onPagar} className="app-btn-primary text-xs">
            Pagar
          </button>
        )}
      </div>

      {tieneComprobante && (
        <a href={pago.comprobante_url} target="_blank" rel="noreferrer" className="inline-flex text-xs text-brand-secondary hover:text-brand-primary">
          Ver comprobante 📄
        </a>
      )}

      {puedeSubir && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-brand-primary/35 bg-app-bg px-3 py-2 text-xs text-app-text-secondary hover:border-brand-primary/60">
            <span>{tieneComprobante ? 'Seleccionar nuevo soporte' : 'Seleccionar comprobante'}</span>
            <span className="font-semibold text-brand-secondary">Buscar archivo</span>
            <input type="file" onChange={onArchivoChange} className="sr-only" />
          </label>

          <button type="button" onClick={onSubirComprobante} className="app-btn-secondary text-xs">
            {tieneComprobante ? 'Reemplazar' : 'Subir comprobante'}
          </button>
        </div>
      )}

      {configPago?.tipo === 'manual' && (
        <p className="rounded-xl bg-brand-primary/10 px-3 py-2 text-[11px] text-app-text-secondary">
          💡 Pago manual habilitado para este conjunto.
        </p>
      )}
    </div>
  );
}
