import { formatFechaBogota } from '../../../../utils/dateFormatters';
import PagoActionPanel from './PagoActionPanel';
import PagoStatusBadge from './PagoStatusBadge';
import PagoTimeline from './PagoTimeline';

export default function PagoCard({ pago, estadoProceso, configPago, onPagar, onArchivoChange, onSubirComprobante }) {
  const valor = Number(pago?.valor || 0);

  return (
    <article className="rounded-2xl border border-app-border bg-app-bg-alt/80 p-4 shadow-[0_14px_35px_rgba(2,6,23,0.24)]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-app-text-primary">{pago.concepto}</p>
              <p className="mt-1 text-xs text-app-text-secondary">Generado: {formatFechaBogota(pago.created_at)}</p>
            </div>
            <PagoStatusBadge estadoProceso={estadoProceso} compact />
          </div>

          <PagoTimeline pago={pago} />
        </div>

        <div className="rounded-2xl border border-app-border bg-app-bg px-4 py-3 lg:text-right">
          <p className="text-[11px] uppercase tracking-wide text-app-text-secondary">Valor</p>
          <p className="text-2xl font-black text-app-text-primary">${valor.toLocaleString('es-CO')}</p>
          <p className="mt-1 text-xs text-app-text-secondary">{estadoProceso?.label || 'Pendiente de pago'}</p>
        </div>
      </div>

      <div className="mt-4">
        <PagoActionPanel
          pago={pago}
          configPago={configPago}
          onPagar={onPagar}
          onArchivoChange={onArchivoChange}
          onSubirComprobante={onSubirComprobante}
        />
      </div>
    </article>
  );
}
