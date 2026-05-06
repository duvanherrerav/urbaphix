import { estaPagoEnRevision, estaPagoPagado, estaPagoRechazado, puedeSubirComprobante } from '../../utils/pagosEstados';
import ComprobanteUploader from './ComprobanteUploader';

export default function PagoActionPanel({ pago, configPago, onPagar, onArchivoChange, onSubirComprobante }) {
  const tieneComprobante = Boolean(pago?.comprobante_url);
  const estaPagado = estaPagoPagado(pago?.estado);
  const estaEnRevision = estaPagoEnRevision(pago?.estado);
  const estaRechazado = estaPagoRechazado(pago?.estado);
  const puedeSubir = puedeSubirComprobante(pago?.estado);
  const motivoRechazo = String(pago?.motivo_rechazo || '').trim();

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
    <div className={`space-y-2 rounded-xl border bg-app-bg/55 p-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.04)] ${estaRechazado ? 'border-state-error/40' : 'border-app-border/80'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${estaRechazado ? 'text-state-error' : 'text-app-text-primary'}`}>
            {estaRechazado ? 'Comprobante rechazado' : estaEnRevision ? 'Comprobante en revisión' : tieneComprobante ? 'Comprobante adjunto' : 'Adjunta tu comprobante'}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-app-text-secondary">
            {estaRechazado
              ? 'Tu comprobante fue rechazado. Revisa la observación y sube un nuevo soporte.'
              : estaEnRevision
                ? 'Soporte enviado para validación administrativa.'
                : tieneComprobante
                  ? 'Soporte registrado para este cobro.'
                  : 'Carga el soporte después de realizar el pago.'}
          </p>
        </div>

        {puedeSubir && !tieneComprobante && (
          <button type="button" onClick={onPagar} className="app-btn-primary px-3 py-1.5 text-xs">
            Pagar
          </button>
        )}
      </div>

      {estaRechazado && motivoRechazo && (
        <p className="rounded-lg border border-state-error/25 bg-state-error/10 px-3 py-1.5 text-[11px] leading-snug text-app-text-secondary">
          <span className="font-semibold text-state-error">Observación:</span> {motivoRechazo}
        </p>
      )}

      {(tieneComprobante || puedeSubir) && (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          {puedeSubir && (
            <ComprobanteUploader
              tieneComprobante={tieneComprobante}
              onArchivoChange={onArchivoChange}
              onSubirComprobante={onSubirComprobante}
            />
          )}

          {tieneComprobante && (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <a href={pago.comprobante_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-secondary transition-colors hover:text-brand-primary">
                Ver comprobante 📄
              </a>
            </div>
          )}
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
