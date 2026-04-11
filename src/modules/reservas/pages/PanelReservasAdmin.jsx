import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
    actualizarRecursoComun,
    cambiarEstadoReserva,
    crearBloqueo,
    crearRecursoComun,
    getRecursosComunes,
    listarBloqueos,
    listarEventosReserva,
    listarReservas,
    subscribeReservasConjunto,
    eliminarBloqueo
} from '../services/reservasService';
import ReservaStatusBadge from '../components/shared/ReservaStatusBadge';
import { formatDateRangeBogota, formatDateTimeBogota } from '../utils/dateTimeBogota';

const DISPONIBILIDAD_DEFAULT = {
    modo: 'slots',
    slots: {
        hora_apertura: '06:00',
        hora_cierre: '22:00',
        duracion_min: 60,
        intervalo_min: 30
    },
    bloques_fijos: []
};

const buildRecursoFormDefault = () => ({
    nombre: '',
    tipo: 'salon_social',
    descripcion: '',
    capacidad: '',
    tiempo_buffer_min: 0,
    disponibilidad_modo: 'slots',
    hora_apertura: DISPONIBILIDAD_DEFAULT.slots.hora_apertura,
    hora_cierre: DISPONIBILIDAD_DEFAULT.slots.hora_cierre,
    duracion_min: DISPONIBILIDAD_DEFAULT.slots.duracion_min,
    intervalo_min: DISPONIBILIDAD_DEFAULT.slots.intervalo_min,
    bloques_fijos: []
});

const toMinutes = (hhmm = '') => {
    if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return (h * 60) + m;
};

const normalizarDisponibilidadDesdeRecurso = (recurso) => {
    const disponibilidad = recurso?.reglas?.disponibilidad || {};
    const modo = disponibilidad?.modo === 'bloques_fijos' ? 'bloques_fijos' : 'slots';
    const slots = disponibilidad?.slots || {};
    const bloques = Array.isArray(disponibilidad?.bloques_fijos) ? disponibilidad.bloques_fijos : [];

    return {
        ...buildRecursoFormDefault(),
        nombre: recurso?.nombre || '',
        tipo: recurso?.tipo || 'salon_social',
        descripcion: recurso?.descripcion || '',
        capacidad: recurso?.capacidad ?? '',
        tiempo_buffer_min: Number(recurso?.tiempo_buffer_min || 0),
        disponibilidad_modo: modo,
        hora_apertura: slots?.hora_apertura || DISPONIBILIDAD_DEFAULT.slots.hora_apertura,
        hora_cierre: slots?.hora_cierre || DISPONIBILIDAD_DEFAULT.slots.hora_cierre,
        duracion_min: Number(slots?.duracion_min || DISPONIBILIDAD_DEFAULT.slots.duracion_min),
        intervalo_min: Number(slots?.intervalo_min || DISPONIBILIDAD_DEFAULT.slots.intervalo_min),
        bloques_fijos: bloques.map((b, idx) => ({
            id: b?.id || `bloque_${idx + 1}`,
            label: b?.label || `Bloque ${idx + 1}`,
            hora_inicio: b?.hora_inicio || '08:00',
            hora_fin: b?.hora_fin || '09:00'
        }))
    };
};

const validarDisponibilidad = (form) => {
    if (Number(form.tiempo_buffer_min) < 0) return 'El tiempo buffer no puede ser negativo';

    if (form.disponibilidad_modo === 'slots') {
        const apertura = toMinutes(form.hora_apertura);
        const cierre = toMinutes(form.hora_cierre);
        const duracion = Number(form.duracion_min);
        const intervalo = Number(form.intervalo_min);

        if (apertura === null || cierre === null) return 'Hora de apertura/cierre inválida';
        if (apertura >= cierre) return 'hora_apertura debe ser menor a hora_cierre';
        if (!Number.isFinite(duracion) || duracion < 15) return 'duracion_min debe ser un número mayor o igual a 15';
        if (!Number.isFinite(intervalo) || intervalo < 5) return 'intervalo_min debe ser un número mayor o igual a 5';
        if ((apertura + duracion) > cierre) return 'La duración no cabe dentro de la jornada configurada';
        return null;
    }

    if (!form.bloques_fijos.length) return 'Debes configurar al menos un bloque fijo';

    const bloques = form.bloques_fijos.map((b) => ({
        ...b,
        inicioMin: toMinutes(b.hora_inicio),
        finMin: toMinutes(b.hora_fin)
    }));

    for (const b of bloques) {
        if (!b.id?.trim()) return 'Cada bloque debe tener id';
        if (!b.label?.trim()) return 'Cada bloque debe tener label';
        if (b.inicioMin === null || b.finMin === null) return 'Cada bloque debe tener horas válidas';
        if (b.inicioMin >= b.finMin) return `Bloque ${b.label} tiene rango inválido`;
    }

    const ordenados = [...bloques].sort((a, b) => a.inicioMin - b.inicioMin);
    for (let i = 1; i < ordenados.length; i += 1) {
        const prev = ordenados[i - 1];
        const curr = ordenados[i];
        if (curr.inicioMin < prev.finMin) {
            return `Bloques solapados: ${prev.label} y ${curr.label}`;
        }
    }

    return null;
};

const buildDisponibilidadPayload = (form) => {
    if (form.disponibilidad_modo === 'slots') {
        return {
            version: 1,
            timezone: 'America/Bogota',
            modo: 'slots',
            slots: {
                hora_apertura: form.hora_apertura,
                hora_cierre: form.hora_cierre,
                duracion_min: Number(form.duracion_min),
                intervalo_min: Number(form.intervalo_min)
            },
            bloques_fijos: []
        };
    }

    return {
        version: 1,
        timezone: 'America/Bogota',
        modo: 'bloques_fijos',
        slots: { ...DISPONIBILIDAD_DEFAULT.slots },
        bloques_fijos: form.bloques_fijos.map((b) => ({
            id: b.id.trim(),
            label: b.label.trim(),
            hora_inicio: b.hora_inicio,
            hora_fin: b.hora_fin
        }))
    };
};

export default function PanelReservasAdmin({ usuarioApp }) {
    const [reservas, setReservas] = useState([]);
    const [recursos, setRecursos] = useState([]);
    const [bloqueos, setBloqueos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [eventosPorReserva, setEventosPorReserva] = useState({});
    const [bloqueoForm, setBloqueoForm] = useState({ recurso_id: '', fecha: '', hora_inicio: '', hora_fin: '', motivo: '' });
    const [recursoForm, setRecursoForm] = useState(buildRecursoFormDefault());
    const [recursoEditId, setRecursoEditId] = useState('');

    const cargar = async () => {
        if (!usuarioApp?.conjunto_id) return;
        setLoading(true);

        const [reservasResp, recursosResp, bloqueosResp] = await Promise.all([
            listarReservas({ conjunto_id: usuarioApp.conjunto_id, limit: 300 }),
            getRecursosComunes(usuarioApp.conjunto_id),
            listarBloqueos({ conjunto_id: usuarioApp.conjunto_id })
        ]);

        setLoading(false);

        if (!reservasResp.ok) return toast.error(reservasResp.error);
        if (!recursosResp.ok) toast.error(recursosResp.error);
        if (!bloqueosResp.ok) toast.error(bloqueosResp.error);

        setReservas(reservasResp.data || []);
        setRecursos(recursosResp.data || []);
        setBloqueos(bloqueosResp.data || []);
    };

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuarioApp?.conjunto_id]);

    useEffect(() => {
        if (!usuarioApp?.conjunto_id) return undefined;
        return subscribeReservasConjunto(usuarioApp.conjunto_id, () => {
            cargar();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuarioApp?.conjunto_id]);

    const recursoEnEdicion = useMemo(
        () => recursos.find((r) => r.id === recursoEditId) || null,
        [recursos, recursoEditId]
    );

    useEffect(() => {
        if (!recursoEnEdicion) {
            setRecursoForm(buildRecursoFormDefault());
            return;
        }
        setRecursoForm(normalizarDisponibilidadDesdeRecurso(recursoEnEdicion));
    }, [recursoEnEdicion]);

    const actualizarEstado = async (id, estado) => {
        const resp = await cambiarEstadoReserva({
            reserva_id: id,
            estado,
            usuario_id: usuarioApp.id,
            usuario_rol: usuarioApp.rol_id,
            detalle: `Gestión admin: ${estado}`
        });
        if (!resp.ok) return toast.error(resp.error);
        toast.success(`Reserva ${estado}`);
        cargar();
    };

    const verBitacora = async (reservaId) => {
        const resp = await listarEventosReserva(reservaId);
        if (!resp.ok) return toast.error(resp.error);
        setEventosPorReserva((prev) => ({ ...prev, [reservaId]: resp.data || [] }));
    };

    const onChangeRecursoForm = (field, value) => {
        setRecursoForm((s) => ({ ...s, [field]: value }));
    };

    const agregarBloqueFijo = () => {
        setRecursoForm((s) => ({
            ...s,
            bloques_fijos: [
                ...s.bloques_fijos,
                {
                    id: `bloque_${s.bloques_fijos.length + 1}`,
                    label: `Bloque ${s.bloques_fijos.length + 1}`,
                    hora_inicio: '08:00',
                    hora_fin: '09:00'
                }
            ]
        }));
    };

    const editarBloqueFijo = (index, field, value) => {
        setRecursoForm((s) => ({
            ...s,
            bloques_fijos: s.bloques_fijos.map((b, idx) => idx === index ? { ...b, [field]: value } : b)
        }));
    };

    const eliminarBloqueFijo = (index) => {
        setRecursoForm((s) => ({
            ...s,
            bloques_fijos: s.bloques_fijos.filter((_, idx) => idx !== index)
        }));
    };

    const guardarRecurso = async () => {
        if (!recursoForm.nombre || !recursoForm.tipo) return toast.error('Nombre y tipo son obligatorios');

        const errorValidacion = validarDisponibilidad(recursoForm);
        if (errorValidacion) return toast.error(errorValidacion);

        const reglasDisponibilidad = buildDisponibilidadPayload(recursoForm);
        const payload = {
            conjunto_id: usuarioApp.conjunto_id,
            nombre: recursoForm.nombre.trim(),
            tipo: recursoForm.tipo,
            descripcion: recursoForm.descripcion?.trim() || null,
            capacidad: recursoForm.capacidad ? Number(recursoForm.capacidad) : null,
            tiempo_buffer_min: Number(recursoForm.tiempo_buffer_min || 0),
            reglas: {
                disponibilidad: reglasDisponibilidad
            }
        };

        const resp = recursoEditId
            ? await actualizarRecursoComun({ ...payload, recurso_id: recursoEditId })
            : await crearRecursoComun(payload);

        if (!resp.ok) return toast.error(resp.error);
        toast.success(recursoEditId ? 'Recurso actualizado' : 'Recurso creado');

        if (!recursoEditId) {
            setRecursoForm(buildRecursoFormDefault());
        }

        cargar();
    };

    const crearBloqueoAdmin = async () => {
        if (!bloqueoForm.recurso_id || !bloqueoForm.fecha || !bloqueoForm.hora_inicio || !bloqueoForm.hora_fin || !bloqueoForm.motivo) {
            return toast.error('Completa recurso, horario y motivo del bloqueo');
        }

        const fecha_inicio = `${bloqueoForm.fecha}T${bloqueoForm.hora_inicio}:00`;
        const fecha_fin = `${bloqueoForm.fecha}T${bloqueoForm.hora_fin}:00`;

        if (bloqueoForm.hora_fin <= bloqueoForm.hora_inicio) {
            return toast.error('La hora fin del bloqueo debe ser mayor');
        }

        const resp = await crearBloqueo({
            conjunto_id: usuarioApp.conjunto_id,
            recurso_id: bloqueoForm.recurso_id,
            fecha_inicio,
            fecha_fin,
            motivo: bloqueoForm.motivo,
            creado_por: usuarioApp.id
        });

        if (!resp.ok) return toast.error(resp.error);
        toast.success('Bloqueo creado');
        setBloqueoForm({ recurso_id: '', fecha: '', hora_inicio: '', hora_fin: '', motivo: '' });
        cargar();
    };

    const borrarBloqueo = async (id) => {
        const ok = window.confirm('¿Eliminar bloqueo?');
        if (!ok) return;
        const resp = await eliminarBloqueo(id);
        if (!resp.ok) return toast.error(resp.error);
        toast.success('Bloqueo eliminado');
        cargar();
    };

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow space-y-3">
                <h2 className="text-2xl font-bold">Panel reservas (admin) 🧩</h2>
                {loading && <p className="text-sm text-gray-500">Cargando...</p>}
                {reservas.map((r) => (
                    <div key={r.id} className="border rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2"><p className="font-medium">{r.recursos_comunes?.nombre || 'Recurso'}</p><ReservaStatusBadge estado={r.estado} /></div>
                        <p className="text-sm text-gray-500">{formatDateRangeBogota(r.fecha_inicio, r.fecha_fin)}</p>
                        <p className="text-sm text-gray-500">Residente ID: {r.residente_id}</p>
                        {r.estado === 'solicitada' && (
                            <div className="flex gap-2 mt-2">
                                <button className="bg-emerald-600 text-white px-3 py-1 rounded" onClick={() => actualizarEstado(r.id, 'aprobada')}>Aprobar</button>
                                <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={() => actualizarEstado(r.id, 'rechazada')}>Rechazar</button>
                            </div>
                        )}
                        <button className="text-sm underline" onClick={() => verBitacora(r.id)}>Ver bitácora</button>
                        {eventosPorReserva[r.id]?.length > 0 && (
                            <ul className="text-xs text-gray-600 list-disc pl-4">
                                {eventosPorReserva[r.id].map((ev) => (
                                    <li key={ev.id}>{ev.accion} · {formatDateTimeBogota(ev.created_at)} · {ev.detalle || 'Sin detalle'}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                ))}
                {reservas.length === 0 && <p className="text-sm text-gray-500">Sin reservas registradas.</p>}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow space-y-3">
                <h3 className="text-lg font-semibold">Registrar / editar recurso común</h3>

                <select className="border rounded-lg px-3 py-2 w-full" value={recursoEditId} onChange={(e) => setRecursoEditId(e.target.value)}>
                    <option value="">Crear nuevo recurso</option>
                    {recursos.map((r) => <option key={r.id} value={r.id}>Editar: {r.nombre} · {r.tipo}</option>)}
                </select>

                <div className="grid md:grid-cols-2 gap-3">
                    <input className="border rounded-lg px-3 py-2" placeholder="Nombre recurso" value={recursoForm.nombre} onChange={(e) => onChangeRecursoForm('nombre', e.target.value)} />
                    <select className="border rounded-lg px-3 py-2" value={recursoForm.tipo} onChange={(e) => onChangeRecursoForm('tipo', e.target.value)}>
                        <option value="salon_social">Salón social</option>
                        <option value="cancha">Cancha</option>
                        <option value="bbq">BBQ</option>
                        <option value="logistica">Logística</option>
                        <option value="enseres">Enseres</option>
                        <option value="gimnasio">Gimnasio</option>
                        <option value="generica">Genérica</option>
                    </select>
                    <input className="border rounded-lg px-3 py-2" placeholder="Capacidad (opcional)" value={recursoForm.capacidad} onChange={(e) => onChangeRecursoForm('capacidad', e.target.value)} />
                    <input className="border rounded-lg px-3 py-2" placeholder="Descripción (opcional)" value={recursoForm.descripcion} onChange={(e) => onChangeRecursoForm('descripcion', e.target.value)} />
                </div>

                <div className="border rounded-xl p-4 space-y-3 bg-slate-50">
                    <h4 className="font-semibold">Configuración de disponibilidad</h4>
                    <div className="grid md:grid-cols-2 gap-3">
                        <select className="border rounded-lg px-3 py-2" value={recursoForm.disponibilidad_modo} onChange={(e) => onChangeRecursoForm('disponibilidad_modo', e.target.value)}>
                            <option value="slots">slots</option>
                            <option value="bloques_fijos">bloques_fijos</option>
                        </select>
                        <input
                            type="number"
                            min="0"
                            className="border rounded-lg px-3 py-2"
                            placeholder="tiempo_buffer_min"
                            value={recursoForm.tiempo_buffer_min}
                            onChange={(e) => onChangeRecursoForm('tiempo_buffer_min', e.target.value)}
                        />
                    </div>

                    {recursoForm.disponibilidad_modo === 'slots' && (
                        <div className="grid md:grid-cols-2 gap-3">
                            <label className="text-sm text-slate-700">hora_apertura<input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.hora_apertura} onChange={(e) => onChangeRecursoForm('hora_apertura', e.target.value)} /></label>
                            <label className="text-sm text-slate-700">hora_cierre<input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.hora_cierre} onChange={(e) => onChangeRecursoForm('hora_cierre', e.target.value)} /></label>
                            <label className="text-sm text-slate-700">duracion_min<input type="number" min="15" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.duracion_min} onChange={(e) => onChangeRecursoForm('duracion_min', e.target.value)} /></label>
                            <label className="text-sm text-slate-700">intervalo_min<input type="number" min="5" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.intervalo_min} onChange={(e) => onChangeRecursoForm('intervalo_min', e.target.value)} /></label>
                        </div>
                    )}

                    {recursoForm.disponibilidad_modo === 'bloques_fijos' && (
                        <div className="space-y-2">
                            <button type="button" className="text-xs border rounded px-2 py-1" onClick={agregarBloqueFijo}>Agregar bloque</button>
                            {recursoForm.bloques_fijos.map((bloque, idx) => (
                                <div key={`${bloque.id}-${idx}`} className="grid md:grid-cols-5 gap-2 items-end border rounded-lg p-2 bg-white">
                                    <label className="text-xs">id<input className="border rounded px-2 py-1 w-full mt-1" value={bloque.id} onChange={(e) => editarBloqueFijo(idx, 'id', e.target.value)} /></label>
                                    <label className="text-xs">label<input className="border rounded px-2 py-1 w-full mt-1" value={bloque.label} onChange={(e) => editarBloqueFijo(idx, 'label', e.target.value)} /></label>
                                    <label className="text-xs">hora_inicio<input type="time" className="border rounded px-2 py-1 w-full mt-1" value={bloque.hora_inicio} onChange={(e) => editarBloqueFijo(idx, 'hora_inicio', e.target.value)} /></label>
                                    <label className="text-xs">hora_fin<input type="time" className="border rounded px-2 py-1 w-full mt-1" value={bloque.hora_fin} onChange={(e) => editarBloqueFijo(idx, 'hora_fin', e.target.value)} /></label>
                                    <button type="button" className="text-xs border rounded px-2 py-1 h-8" onClick={() => eliminarBloqueFijo(idx)}>Eliminar</button>
                                </div>
                            ))}
                            {recursoForm.bloques_fijos.length === 0 && (
                                <p className="text-xs text-slate-500">No hay bloques fijos configurados.</p>
                            )}
                        </div>
                    )}
                </div>

                <button className="bg-indigo-700 text-white px-3 py-2 rounded" onClick={guardarRecurso}>{recursoEditId ? 'Guardar cambios' : 'Crear recurso'}</button>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow space-y-3">
                <h3 className="text-lg font-semibold">Bloqueos operativos</h3>
                <div className="grid md:grid-cols-2 gap-3">
                    <select className="border rounded-lg px-3 py-2" value={bloqueoForm.recurso_id} onChange={(e) => setBloqueoForm((s) => ({ ...s, recurso_id: e.target.value }))}>
                        <option value="">Selecciona recurso</option>
                        {recursos.map((r) => <option key={r.id} value={r.id}>{r.nombre} · {r.tipo}</option>)}
                    </select>
                    <input type="date" className="border rounded-lg px-3 py-2" value={bloqueoForm.fecha} onChange={(e) => setBloqueoForm((s) => ({ ...s, fecha: e.target.value }))} />
                    <input type="time" className="border rounded-lg px-3 py-2" value={bloqueoForm.hora_inicio} onChange={(e) => setBloqueoForm((s) => ({ ...s, hora_inicio: e.target.value }))} />
                    <input type="time" className="border rounded-lg px-3 py-2" value={bloqueoForm.hora_fin} onChange={(e) => setBloqueoForm((s) => ({ ...s, hora_fin: e.target.value }))} />
                    <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Motivo" value={bloqueoForm.motivo} onChange={(e) => setBloqueoForm((s) => ({ ...s, motivo: e.target.value }))} />
                </div>
                <button className="bg-slate-800 text-white px-3 py-2 rounded" onClick={crearBloqueoAdmin}>Crear bloqueo</button>
                <div className="space-y-2">
                    {bloqueos.map((b) => (
                        <div key={b.id} className="border rounded p-2 flex items-center justify-between">
                            <p className="text-sm">{b.recursos_comunes?.nombre || b.recurso_id} · {formatDateRangeBogota(b.fecha_inicio, b.fecha_fin)} · {b.motivo}</p>
                            <button className="text-xs border rounded px-2 py-1" onClick={() => borrarBloqueo(b.id)}>Eliminar</button>
                        </div>
                    ))}
                    {bloqueos.length === 0 && <p className="text-sm text-gray-500">No hay bloqueos registrados.</p>}
                </div>
            </div>
        </div>
    );
}
