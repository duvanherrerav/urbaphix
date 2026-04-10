import ReservaStatusBadge from '../shared/ReservaStatusBadge';

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
        <article className="border rounded-xl p-4 space-y-3 bg-white">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-semibold text-slate-900">{reserva.recursos_comunes?.nombre || 'Recurso común'}</p>
                    <p className="text-xs text-slate-500">{new Date(reserva.fecha_inicio).toLocaleString()} → {new Date(reserva.fecha_fin).toLocaleString()}</p>
                </div>
                <ReservaStatusBadge estado={reserva.estado} />
            </div>

            <p className="text-sm text-slate-600">Tipo: {reserva.tipo_reserva}{reserva.subtipo ? ` · ${reserva.subtipo}` : ''}</p>
            <p className="text-sm text-slate-600">Soportes registrados: {reserva.documentos?.length || 0}</p>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                En este MVP, “Adjuntar soporte” registra referencia del archivo en la base de datos; no realiza carga binaria a Storage.
            </div>

            <div className="flex flex-wrap gap-2">
                {canCancel && (
                    <button className="border rounded px-2 py-1 text-sm hover:bg-slate-50" onClick={() => onCancel(reserva.id)}>
                        Cancelar
                    </button>
                )}

                <label className="border rounded px-2 py-1 text-sm cursor-pointer hover:bg-slate-50">
                    {uploading ? 'Registrando...' : 'Adjuntar soporte'}
                    <input
                        type="file"
                        className="hidden"
                        onChange={(e) => onAttach(reserva.id, e.target.files?.[0])}
                        disabled={uploading}
                    />
                </label>

                {timelineEnabled && onToggleTimeline && (
                    <button className="border rounded px-2 py-1 text-sm hover:bg-slate-50" onClick={() => onToggleTimeline(reserva.id)}>
                        {timelineOpen ? 'Ocultar trazabilidad' : 'Ver trazabilidad'}
                    </button>
                )}
            </div>

            {timelineEnabled && timelineOpen && (
                <ul className="text-xs text-slate-600 list-disc pl-4 space-y-1">
                    {timelineItems.length === 0 && <li>Sin eventos disponibles.</li>}
                    {timelineItems.map((ev) => (
                        <li key={ev.id}>{ev.accion} · {new Date(ev.created_at).toLocaleString()} · {ev.detalle || 'Sin detalle'}</li>
                    ))}
                </ul>
            )}
        </article>
    );
}
