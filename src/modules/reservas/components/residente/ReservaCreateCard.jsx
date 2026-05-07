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
        chip: 'bg-app-bg text-app-text-secondary border-app-border',
        boton: 'border-app-border text-app-text-secondary cursor-not-allowed'
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
    minFecha = '',
    recursoSeleccionado = null
}) {
    const disponibles = franjasDisponibles.filter((f) => f.seleccionable);
    const noDisponibles = franjasDisponibles.filter((f) => !f.seleccionable);

    return (
        <section className="app-surface-primary p-5 space-y-4 border border-brand-primary/20" aria-labelledby="crear-reserva-title">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-brand-primary font-semibold">Nueva solicitud</p>
                    <h2 id="crear-reserva-title" className="text-2xl font-bold">Crear reserva</h2>
                    <p className="text-sm text-app-text-secondary">Selecciona recurso, fecha y franja horaria para enviar tu solicitud.</p>
                </div>
                {recursoSeleccionado?.capacidad && (
                    <span className="app-badge-info w-fit">Capacidad: {recursoSeleccionado.capacidad} personas</span>
                )}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
                <label className="space-y-1">
                    <span className="text-xs font-semibold text-app-text-secondary">Recurso común</span>
                    <select className="app-input" value={form.recurso_id} onChange={(e) => onChange('recurso_id', e.target.value)} aria-label="Recurso común">
                    <option value="">Selecciona recurso</option>
                    {recursos.map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre} · {r.tipo}</option>
                    ))}
                    </select>
                </label>

                <label className="space-y-1">
                    <span className="text-xs font-semibold text-app-text-secondary">Tipo de reserva</span>
                    <select className="app-input" value={form.tipo_reserva} onChange={(e) => onChange('tipo_reserva', e.target.value)} aria-label="Tipo de reserva">
                    <option value="recreativa">Recreativa</option>
                    <option value="logistica">Logística</option>
                    <option value="prestamo">Préstamo</option>
                    </select>
                </label>

                <label className="space-y-1">
                    <span className="text-xs font-semibold text-app-text-secondary">Fecha</span>
                    <input type="date" min={minFecha} className="app-input" value={form.fecha} onChange={(e) => onChange('fecha', e.target.value)} aria-label="Fecha de reserva" />
                </label>
                <div className="app-input text-xs text-app-text-secondary bg-app-bg min-h-[4.5rem]">
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
                <label className="space-y-1">
                    <span className="text-xs font-semibold text-app-text-secondary">Subtipo (opcional)</span>
                    <input className="app-input" placeholder="Ej. cumpleaños, reunión, trasteo" value={form.subtipo} onChange={(e) => onChange('subtipo', e.target.value)} />
                </label>
                <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-semibold text-app-text-secondary">Motivo (opcional)</span>
                    <input className="app-input" placeholder="Describe brevemente el uso previsto" value={form.motivo} onChange={(e) => onChange('motivo', e.target.value)} />
                </label>
                <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-semibold text-app-text-secondary">Observaciones (opcional)</span>
                    <textarea className="app-input min-h-24" placeholder="Agrega instrucciones o detalles útiles para administración" value={form.observaciones} onChange={(e) => onChange('observaciones', e.target.value)} />
                </label>
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

            <div className="space-y-2 app-surface-muted p-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-app-text-secondary">Franjas disponibles</p>
                    {disponibilidadLoading && <span className="text-[11px] text-brand-primary">Calculando...</span>}
                </div>
                {disponibilidadLoading && (
                    <div className="grid sm:grid-cols-3 gap-2 animate-pulse">
                        {[0, 1, 2].map((item) => <span key={item} className="h-8 rounded-full bg-app-border" />)}
                    </div>
                )}
                {!disponibilidadLoading && mensajeDisponibilidad && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        {mensajeDisponibilidad}
                    </p>
                )}
                {!disponibilidadLoading && disponibles.length === 0 && (
                    <p className="text-xs text-app-text-secondary">No hay franjas disponibles para esta fecha.</p>
                )}
                <div className="flex flex-wrap gap-2">
                    {disponibles.map((franja) => {
                        const selected = franja.id === franjaSeleccionadaId;
                        return (
                            <button
                                key={franja.id}
                                type="button"
                                className={`text-xs border rounded-full px-3 py-2 transition-all duration-200 ${selected ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : estadoFranjaUI.disponible.boton}`}
                                onClick={() => onSeleccionarFranja && onSeleccionarFranja(franja)}
                                aria-pressed={selected}
                            >
                                {franja.label ? `${franja.label}: ` : ''}{franja.inicio} - {franja.fin}
                            </button>
                        );
                    })}
                </div>
            </div>

            {!disponibilidadLoading && noDisponibles.length > 0 && (
                <details className="space-y-2 app-surface-muted p-3">
                    <summary className="text-xs font-semibold text-app-text-secondary cursor-pointer">No disponibles ({noDisponibles.length})</summary>
                    <div className="flex flex-wrap gap-2 pt-2 max-h-40 overflow-y-auto pr-1 app-scrollbar">
                        {noDisponibles.slice(0, 24).map((franja) => {
                            const ui = estadoFranjaUI[franja.estado] || estadoFranjaUI.pasada;
                            return (
                                <span key={franja.id} className={`text-xs border rounded-full px-2 py-1 ${ui.chip}`}>
                                    {franja.label ? `${franja.label}: ` : ''}{franja.inicio} - {franja.fin} · {ui.label}
                                </span>
                            );
                        })}
                    </div>
                </details>
            )}

            {sugerencias.length > 0 && (
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    Te sugerimos estos horarios: {sugerencias.join(', ')}.
                </p>
            )}

            <div className="text-[11px] text-app-text-secondary">
                Total franjas libres: {slotsDisponibles.length}
            </div>

            <button
                type="button"
                onClick={onSubmit}
                disabled={loading || perfilMissing || !form.recurso_id || !form.fecha || !form.franja_id}
                className="app-btn-primary justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {loading ? 'Creando solicitud...' : 'Crear solicitud'}
            </button>
        </section>
    );
}