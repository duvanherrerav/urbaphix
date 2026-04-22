import ReservaStatusBadge from '../shared/ReservaStatusBadge';
import { formatDateRangeBogota, formatDateTimeBogota } from '../../utils/dateTimeBogota';

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
    return (
        <article className="border rounded-xl p-4 space-y-3 bg-app-bg-alt">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-semibold text-app-text-primary">{reserva.recursos_comunes?.nombre || 'Recurso común'}</p>
                    <p className="text-xs text-app-text-secondary">{formatDateRangeBogota(reserva.fecha_inicio, reserva.fecha_fin)}</p>
                </div>
                <ReservaStatusBadge estado={reserva.estado} />
            </div>

            <p className="text-sm text-app-text-secondary">Tipo: {reserva.tipo_reserva}{reserva.subtipo ? ` · ${reserva.subtipo}` : ''}</p>
            <p className="text-sm text-app-text-secondary">Soportes registrados: {reserva.documentos?.length || 0}</p>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                En este MVP, “Adjuntar soporte” registra referencia del archivo en la base de datos; no realiza carga binaria a Storage.
            </div>

            <div className="flex flex-wrap gap-2">
                {canCancel && (
                    <button className="app-input text-sm hover:bg-app-bg" onClick={() => onCancel(reserva.id)}>
                        Cancelar
                    </button>
                )}

                <label className="app-input text-sm cursor-pointer hover:bg-app-bg">
                    {uploading ? 'Registrando...' : 'Adjuntar soporte'}
                    <input
                        type="file"
                        className="hidden"
                        onChange={(e) => onAttach(reserva.id, e.target.files?.[0])}
                        disabled={uploading}
                    />
                </label>

                {timelineEnabled && onToggleTimeline && (
                    <button className="app-input text-sm hover:bg-app-bg" onClick={() => onToggleTimeline(reserva.id)}>
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