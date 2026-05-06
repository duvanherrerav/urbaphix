import { formatFechaBogota } from '../../../../utils/dateFormatters';
import { estaPagoPagado, getDiasMoraPago, obtenerEstadoFinancieroReal, ESTADOS_PAGO } from '../../utils/pagosEstados';
import PagoActionPanel from './PagoActionPanel';
import PagoStatusBadge from './PagoStatusBadge';
import PagoTimeline from './PagoTimeline';

export default function PagoCard({ pago, estadoProceso, configPago, onPagar, onArchivoChange, onSubirComprobante }) {
  const valor = Number(pago?.valor || 0);
  const estadoReal = obtenerEstadoFinancieroReal(pago);
  const estaPagado = estaPagoPagado(pago?.estado);
  const estaVencido = estadoReal === ESTADOS_PAGO.VENCIDO;
  const diasMora = getDiasMoraPago(pago);

  return (
    <article className={`rounded-2xl border ${estaVencido ? 'border-state-error/55 shadow-[0_0_0_1px_rgba(239,68,68,0.14),0_18px_42px_rgba(239,68,68,0.12)]' : 'border-app-border/90 shadow-[0_12px_30px_rgba(2,6,23,0.22)]'} bg-app-bg-alt/80 transition-all duration-300 hover:border-brand-primary/25 hover:shadow-[0_16px_36px_rgba(2,6,23,0.28)] ${estaPagado ? 'p-3' : 'p-3.5 sm:p-4'}`}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(160px,190px)] lg:items-center">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="min-w-0 truncate text-sm font-bold text-app-text-primary sm:text-base">{pago.concepto}</p>
                <PagoStatusBadge estadoProceso={estadoProceso} compact />
              </div>
              <p className="text-[11px] text-app-text-secondary">Generado {formatFechaBogota(pago.created_at)} · Vence {formatFechaBogota(pago.fecha_vencimiento)}</p>
              {estaVencido && (
                <p className="rounded-lg border border-state-error/25 bg-state-error/10 px-2 py-1 text-[11px] font-medium text-state-error">
                  Este cobro presenta mora administrativa. {diasMora} día(s) de mora.
                </p>
              )}
            </div>

            <div className="shrink-0 sm:text-right lg:hidden">
              <p className="text-[10px] uppercase tracking-[0.16em] text-app-text-secondary">Valor</p>
              <p className="text-xl font-black leading-tight text-app-text-primary">${valor.toLocaleString('es-CO')}</p>
            </div>
          </div>

          <PagoTimeline pago={pago} compact={estaPagado} />
        </div>

        <div className="hidden rounded-xl border border-app-border/70 bg-app-bg/65 px-3 py-2.5 lg:block lg:text-right">
          <p className="text-[10px] uppercase tracking-[0.16em] text-app-text-secondary">Valor</p>
          <p className="text-2xl font-black leading-tight text-app-text-primary">${valor.toLocaleString('es-CO')}</p>
        </div>
      </div>

      <div className={estaPagado ? 'mt-2' : 'mt-3'}>
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
