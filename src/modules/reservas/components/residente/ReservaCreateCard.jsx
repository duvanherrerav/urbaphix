const estadoFranjaUI = {
    disponible: {
        label: 'Disponible',
        chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        boton: 'border-emerald-300 hover:bg-emerald-50 text-emerald-700'
    },
    ocupada: {
        label: 'Ocupada',
        chip: 'bg-rose-50 text-rose-700 border-rose-200',
        boton: 'border-rose-200 text-rose-500 cursor-not-allowed'
    },
    bloqueada: {
        label: 'Bloqueada',
        chip: 'bg-orange-50 text-orange-700 border-orange-200',
        boton: 'border-orange-200 text-orange-500 cursor-not-allowed'
    },
    pasada: {
        label: 'Pasada',
        chip: 'bg-slate-100 text-slate-600 border-slate-200',
        boton: 'border-slate-200 text-slate-400 cursor-not-allowed'
    },
    invalida_buffer: {
        label: 'Buffer',
        chip: 'bg-amber-50 text-amber-700 border-amber-200',
        boton: 'border-amber-200 text-amber-500 cursor-not-allowed'
    }
};

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
    franjasDisponibles = [],
    franjaSeleccionadaId = '',
    disponibilidadConfig = null,
    fallbackConfigAplicado = false,
    mensajeDisponibilidad = '',
    depositoConfig = null,
    horarioInvalido = false,
    horarioMensaje = 'Este horario no está disponible.',
    sugerencias = [],
    onSeleccionarFranja = null,
    minFecha = ''
}) {
    const disponibles = franjasDisponibles.filter((f) => f.seleccionable);
    const noDisponibles = franjasDisponibles.filter((f) => !f.seleccionable);

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
                <div className="border rounded-lg px-3 py-2 text-xs text-slate-600 bg-slate-50">
                    {!disponibilidadConfig && 'Selecciona recurso y fecha para ver la disponibilidad.'}
                    {disponibilidadConfig && (
                        <div className="space-y-1">
                            <p>
                                Modo: <span className="font-medium">{disponibilidadConfig.modo === 'bloques_fijos' ? 'Bloques fijos' : 'Slots'}</span>
                            </p>
                            {disponibilidadConfig.modo === 'slots' && (
                                <p>
                                    Jornada {disponibilidadConfig.slots.hora_apertura} - {disponibilidadConfig.slots.hora_cierre} · Duración {disponibilidadConfig.slots.duracion_min} min · Intervalo {disponibilidadConfig.slots.intervalo_min} min
                                </p>
                            )}
                            {fallbackConfigAplicado && (
                                <p className="text-amber-700">Se está usando la configuración predeterminada (06:00-22:00, 60 min, intervalo 30 min).</p>
                            )}
                        </div>
                    )}
                </div>
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

            {depositoConfig?.requiere && (
                <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                    <p className="font-semibold">Este recurso requiere depósito.</p>
                    <p>Valor: ${Number(depositoConfig.valor || 0).toLocaleString('es-CO')} COP</p>
                    {depositoConfig.tipo && <p>Tipo: {depositoConfig.tipo === 'no_reembolsable' ? 'No reembolsable' : 'Reembolsable'}</p>}
                    {depositoConfig.observacion && <p>Nota: {depositoConfig.observacion}</p>}
                </div>
            )}

            <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Franjas disponibles</p>
                {disponibilidadLoading && <p className="text-xs text-slate-500">Calculando disponibilidad...</p>}
                {!disponibilidadLoading && mensajeDisponibilidad && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        {mensajeDisponibilidad}
                    </p>
                )}
                {!disponibilidadLoading && disponibles.length === 0 && (
                    <p className="text-xs text-slate-500">No hay franjas disponibles para esta fecha.</p>
                )}
                <div className="flex flex-wrap gap-2">
                    {disponibles.map((franja) => {
                        const selected = franja.id === franjaSeleccionadaId;
                        return (
                            <button
                                key={franja.id}
                                type="button"
                                className={`text-xs border rounded-full px-2 py-1 ${selected ? 'bg-emerald-600 text-white border-emerald-600' : estadoFranjaUI.disponible.boton}`}
                                onClick={() => onSeleccionarFranja && onSeleccionarFranja(franja)}
                            >
                                {franja.label ? `${franja.label}: ` : ''}{franja.inicio} - {franja.fin}
                            </button>
                        );
                    })}
                </div>
            </div>

            {!disponibilidadLoading && noDisponibles.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">No disponibles</p>
                    <div className="flex flex-wrap gap-2">
                        {noDisponibles.slice(0, 24).map((franja) => {
                            const ui = estadoFranjaUI[franja.estado] || estadoFranjaUI.pasada;
                            return (
                                <span key={franja.id} className={`text-xs border rounded-full px-2 py-1 ${ui.chip}`}>
                                    {franja.label ? `${franja.label}: ` : ''}{franja.inicio} - {franja.fin} · {ui.label}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {sugerencias.length > 0 && (
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    Te sugerimos estos horarios: {sugerencias.join(', ')}.
                </p>
            )}

            <div className="text-[11px] text-slate-500">
                Total franjas libres: {slotsDisponibles.length}
            </div>

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