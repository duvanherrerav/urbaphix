import ReservaStatusBadge from '../shared/ReservaStatusBadge';
import { formatDateRangeBogota, formatDateTimeBogota } from '../../utils/dateTimeBogota';
import { getReservaEstadoLabel } from '../../utils/reservaFormatters';

export default function ReservaCard({
    reserva,
    canCancel,
    onCancel,
    onAttach,
    uploading,
    timelineEnabled = false,
    onToggleTimeline = null,
    timelineOpen = false,
    timelineItems = []
}) {
    const soportesCount = reserva.documentos?.length || 0;
    const estadoLabel = getReservaEstadoLabel(reserva.estado);

    return (
        <article className="app-surface-muted p-4 space-y-4 border border-app-border/70">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-1 min-w-0">
                    <p className="text-xs uppercase tracking-[0.16em] text-brand-primary font-semibold">{reserva.recursos_comunes?.tipo || 'Zona común'}</p>
                    <h4 className="font-semibold text-app-text-primary text-lg leading-tight">{reserva.recursos_comunes?.nombre || 'Recurso común'}</h4>
                    <p className="text-xs text-app-text-secondary">{formatDateRangeBogota(reserva.fecha_inicio, reserva.fecha_fin)}</p>
                </div>
                <ReservaStatusBadge estado={reserva.estado} />
            </div>

            <div className="grid sm:grid-cols-3 gap-2 text-xs">
                <div className="app-surface-primary p-3">
                    <p className="text-app-text-secondary">Estado</p>
                    <p className="font-semibold text-app-text-primary">{estadoLabel}</p>
                </div>
                <div className="app-surface-primary p-3">
                    <p className="text-app-text-secondary">Tipo</p>
                    <p className="font-semibold text-app-text-primary">{reserva.tipo_reserva}{reserva.subtipo ? ` · ${reserva.subtipo}` : ''}</p>
                </div>
                <div className="app-surface-primary p-3">
                    <p className="text-app-text-secondary">Soportes</p>
                    <p className="font-semibold text-app-text-primary">{soportesCount} registrados</p>
                </div>
            </div>

            {reserva.motivo && <p className="text-sm text-app-text-secondary">Motivo: {reserva.motivo}</p>}

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                En este MVP, “Adjuntar soporte” registra referencia del archivo en la base de datos; no realiza carga binaria a Storage.
            </div>

            <div className="flex flex-wrap gap-2">
                {canCancel && (
                    <button type="button" className="app-btn-secondary text-xs" onClick={() => onCancel(reserva.id)}>
                        Cancelar reserva
                    </button>
                )}

                <label className="app-btn-ghost text-xs cursor-pointer">
                    {uploading ? 'Registrando soporte...' : 'Adjuntar soporte'}
                    <input
                        type="file"
                        className="hidden"
                        onChange={(e) => onAttach(reserva.id, e.target.files?.[0])}
                        disabled={uploading}
                    />
                </label>

                {timelineEnabled && onToggleTimeline && (
                    <button type="button" className="app-btn-ghost text-xs" onClick={() => onToggleTimeline(reserva.id)}>
                        {timelineOpen ? 'Ocultar trazabilidad' : 'Ver trazabilidad'}
                    </button>
                )}
            </div>

            {timelineEnabled && timelineOpen && (
                <ul className="text-xs text-app-text-secondary list-disc pl-4 space-y-1">
                    {timelineItems.length === 0 && <li>Sin eventos disponibles.</li>}
                    {timelineItems.map((ev) => (
                        <li key={ev.id}>{ev.accion} · {formatDateTimeBogota(ev.created_at)} · {ev.detalle || 'Sin detalle'}</li>
                    ))}
                </ul>
            )}
        </article>
    );
}
