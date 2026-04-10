export default function ReservaCreateCard({
    form,
    recursos,
    loading,
    onChange,
    onSubmit,
    perfilMissing,
    bloqueoDetectado,
    disponibilidadLoading = false,
    slotsDisponibles = [],
    horarioInvalido = false,
    horarioMensaje = 'Este horario no está disponible.',
    sugerencias = [],
    onSugerirHorario = null,
    minFecha = ''
}) {
    return (
        <section className="bg-white rounded-2xl p-5 shadow space-y-3 border border-slate-100">
            <div>
                <h2 className="text-2xl font-bold">Crear reserva</h2>
                <p className="text-sm text-slate-500">Selecciona recurso, fecha y franja horaria para enviar tu solicitud.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
                <select className="border rounded-lg px-3 py-2" value={form.recurso_id} onChange={(e) => onChange('recurso_id', e.target.value)}>
                    <option value="">Selecciona recurso</option>
                    {recursos.map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre} · {r.tipo}</option>
                    ))}
                </select>

                <select className="border rounded-lg px-3 py-2" value={form.tipo_reserva} onChange={(e) => onChange('tipo_reserva', e.target.value)}>
                    <option value="recreativa">Recreativa</option>
                    <option value="logistica">Logística</option>
                    <option value="prestamo">Préstamo</option>
                </select>

                <input type="date" min={minFecha} className="border rounded-lg px-3 py-2" value={form.fecha} onChange={(e) => onChange('fecha', e.target.value)} />
                <label className="text-sm text-slate-600">
                    Hora de inicio
                    <input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={form.hora_inicio} onChange={(e) => onChange('hora_inicio', e.target.value)} />
                </label>
                <label className="text-sm text-slate-600">
                    Hora de fin
                    <input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={form.hora_fin} onChange={(e) => onChange('hora_fin', e.target.value)} />
                </label>
                <input className="border rounded-lg px-3 py-2" placeholder="Subtipo (opcional)" value={form.subtipo} onChange={(e) => onChange('subtipo', e.target.value)} />
                <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Motivo (opcional)" value={form.motivo} onChange={(e) => onChange('motivo', e.target.value)} />
                <textarea className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Observaciones (opcional)" value={form.observaciones} onChange={(e) => onChange('observaciones', e.target.value)} />
            </div>

            {perfilMissing && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    Tu usuario no tiene perfil de residente asociado. Contacta administración para habilitar reservas.
                </p>
            )}

            {bloqueoDetectado && (
                <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                    La franja seleccionada coincide con un bloqueo operativo.
                </p>
            )}

            {horarioInvalido && (
                <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                    {horarioMensaje}
                </p>
            )}

            <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Horarios disponibles</p>
                {disponibilidadLoading && <p className="text-xs text-slate-500">Calculando disponibilidad...</p>}
                {!disponibilidadLoading && slotsDisponibles.length === 0 && (
                    <p className="text-xs text-slate-500">No hay slots disponibles para esta fecha.</p>
                )}
                <div className="flex flex-wrap gap-2">
                    {slotsDisponibles.slice(0, 8).map((slot) => (
                        <button
                            key={`${slot.inicio}-${slot.fin}`}
                            type="button"
                            className="text-xs border rounded-full px-2 py-1 hover:bg-slate-50"
                            onClick={() => onSugerirHorario && onSugerirHorario(slot)}
                        >
                            {slot.inicio} - {slot.fin}
                        </button>
                    ))}
                </div>
            </div>

            {sugerencias.length > 0 && (
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    Te sugerimos estos horarios: {sugerencias.join(', ')}.
                </p>
            )}

            <button
                onClick={onSubmit}
                disabled={loading || perfilMissing}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-60"
            >
                {loading ? 'Creando solicitud...' : 'Crear solicitud'}
            </button>
        </section>
    );
}
