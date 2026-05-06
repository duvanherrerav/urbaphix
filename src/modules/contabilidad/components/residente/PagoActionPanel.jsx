export default function PagoActionPanel({ pago, configPago, onPagar, onArchivoChange, onSubirComprobante }) {
  const tieneComprobante = Boolean(pago?.comprobante_url);
  const estaPagado = pago?.estado === 'pagado';
  const estaPendiente = pago?.estado === 'pendiente';
  const estaRechazado = pago?.estado === 'rechazado';
  const puedeSubir = estaPendiente || estaRechazado;

  if (estaPagado) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-app-border/60 pt-2">
        {tieneComprobante && (
          <a href={pago.comprobante_url} target="_blank" rel="noreferrer" className="app-btn-ghost px-3 py-1.5 text-[11px]">
            Ver comprobante 📄
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-app-border/80 bg-app-bg/55 p-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-app-text-primary">
            {tieneComprobante ? 'Comprobante en revisión' : 'Adjunta tu comprobante'}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-app-text-secondary">
            {tieneComprobante
              ? 'Soporte enviado para validación administrativa.'
              : 'Carga el soporte después de realizar el pago.'}
          </p>
        </div>

        {estaPendiente && !tieneComprobante && (
          <button type="button" onClick={onPagar} className="app-btn-primary px-3 py-1.5 text-xs">
            Pagar
          </button>
        )}
      </div>

      {(tieneComprobante || puedeSubir) && (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          {puedeSubir && (
            <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-brand-primary/30 bg-app-bg-alt/70 px-3 py-1.5 text-xs text-app-text-secondary transition-colors hover:border-brand-secondary/70 hover:bg-[#38BDF812]">
              <span className="truncate">{tieneComprobante ? 'Seleccionar nuevo soporte' : 'Seleccionar comprobante'}</span>
              <span className="shrink-0 font-semibold text-brand-secondary">Buscar archivo</span>
              <input type="file" onChange={onArchivoChange} className="sr-only" />
            </label>
          )}

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {tieneComprobante && (
              <a href={pago.comprobante_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-secondary transition-colors hover:text-brand-primary">
                Ver comprobante 📄
              </a>
            )}

            {puedeSubir && (
              <button type="button" onClick={onSubirComprobante} className="app-btn-secondary px-3 py-1.5 text-xs">
                {tieneComprobante ? 'Reemplazar' : 'Subir'}
              </button>
            )}
          </div>
        </div>
      )}

      {configPago?.tipo === 'manual' && (
        <p className="rounded-lg bg-brand-primary/10 px-3 py-1.5 text-[11px] leading-snug text-app-text-secondary">
          💡 Pago manual habilitado para este conjunto.
        </p>
      )}
    </div>
  );
}
