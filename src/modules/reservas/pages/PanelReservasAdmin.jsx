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

const GRUPOS_DIAS = [
    { key: 'lun_vie', label: 'Lunes a viernes' },
    { key: 'sabado', label: 'Sábado' },
    { key: 'domingo', label: 'Domingo' }
];

const MODO_OPCIONES = [
    { value: 'slots', label: 'Franjas automáticas' },
    { value: 'bloques_fijos', label: 'Bloques fijos' }
];

const buildDefaultDia = () => ({
    activo: true,
    modo: 'slots',
    slots: {
        hora_apertura: '06:00',
        hora_cierre: '22:00',
        duracion_min: 60,
        intervalo_min: 30
    },
    bloques_fijos: []
});

const buildRecursoFormDefault = () => ({
    nombre: '',
    tipo: 'salon_social',
    descripcion: '',
    capacidad: '',
    tiempo_buffer_min: 0,
    disponibilidad_semanal: {
        lun_vie: buildDefaultDia(),
        sabado: { ...buildDefaultDia(), slots: { ...buildDefaultDia().slots, hora_apertura: '08:00', hora_cierre: '20:00' } },
        domingo: { ...buildDefaultDia(), activo: false }
    }
});

const toMinutes = (hhmm = '') => {
    if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return (h * 60) + m;
};

const sanitizeBloqueId = (value = '') => value
    .toString()
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    || `bloque_${Date.now()}`;

const normalizarDisponibilidadDesdeRecurso = (recurso) => {
    const disponibilidad = recurso?.reglas?.disponibilidad || {};
    const semanal = disponibilidad?.semanal || {};
    const form = buildRecursoFormDefault();

    GRUPOS_DIAS.forEach(({ key }) => {
        const cfg = semanal[key] || {};
        const slots = cfg.slots || {};
        const bloques = Array.isArray(cfg.bloques_fijos) ? cfg.bloques_fijos : [];
        form.disponibilidad_semanal[key] = {
            activo: cfg.activo !== false,
            modo: cfg.modo === 'bloques_fijos' ? 'bloques_fijos' : 'slots',
            slots: {
                hora_apertura: slots.hora_apertura || form.disponibilidad_semanal[key].slots.hora_apertura,
                hora_cierre: slots.hora_cierre || form.disponibilidad_semanal[key].slots.hora_cierre,
                duracion_min: Number(slots.duracion_min || form.disponibilidad_semanal[key].slots.duracion_min),
                intervalo_min: Number(slots.intervalo_min || form.disponibilidad_semanal[key].slots.intervalo_min)
            },
            bloques_fijos: bloques.map((b, idx) => ({
                nombre: b.label || `Bloque ${idx + 1}`,
                hora_inicio: b.hora_inicio || '08:00',
                hora_fin: b.hora_fin || '09:00'
            }))
        };
    });

    return {
        ...form,
        nombre: recurso?.nombre || '',
        tipo: recurso?.tipo || 'salon_social',
        descripcion: recurso?.descripcion || '',
        capacidad: recurso?.capacidad ?? '',
        tiempo_buffer_min: Number(recurso?.tiempo_buffer_min || 0)
    };
};

const validarDia = (diaCfg, diaLabel) => {
    if (!diaCfg.activo) return null;

    if (diaCfg.modo === 'slots') {
        const apertura = toMinutes(diaCfg.slots.hora_apertura);
        const cierre = toMinutes(diaCfg.slots.hora_cierre);
        const duracion = Number(diaCfg.slots.duracion_min);
        const intervalo = Number(diaCfg.slots.intervalo_min);

        if (apertura === null || cierre === null) return `${diaLabel}: horas inválidas`;
        if (apertura >= cierre) return `${diaLabel}: la hora de inicio debe ser menor a la hora final`;
        if (!Number.isFinite(duracion) || duracion < 15) return `${diaLabel}: la duración mínima debe ser de al menos 15 minutos`;
        if (!Number.isFinite(intervalo) || intervalo < 5) return `${diaLabel}: el intervalo debe ser de al menos 5 minutos`;
        if ((apertura + duracion) > cierre) return `${diaLabel}: la duración no cabe dentro del horario disponible`;
        return null;
    }

    if (!diaCfg.bloques_fijos.length) return `${diaLabel}: agrega al menos un bloque fijo`;

    const bloques = diaCfg.bloques_fijos.map((b) => ({
        ...b,
        inicioMin: toMinutes(b.hora_inicio),
        finMin: toMinutes(b.hora_fin)
    }));

    for (const b of bloques) {
        if (!b.nombre?.trim()) return `${diaLabel}: todos los bloques deben tener nombre`;
        if (b.inicioMin === null || b.finMin === null) return `${diaLabel}: todos los bloques deben tener horas válidas`;
        if (b.inicioMin >= b.finMin) return `${diaLabel}: hay bloques con hora de inicio mayor o igual a la hora final`;
    }

    const ordenados = [...bloques].sort((a, b) => a.inicioMin - b.inicioMin);
    for (let i = 1; i < ordenados.length; i += 1) {
        if (ordenados[i].inicioMin < ordenados[i - 1].finMin) {
            return `${diaLabel}: hay bloques que se solapan entre sí`;
        }
    }

    return null;
};

const buildDisponibilidadPayload = (form) => {
    const semanal = {};

    GRUPOS_DIAS.forEach(({ key }) => {
        const cfg = form.disponibilidad_semanal[key];
        semanal[key] = {
            activo: Boolean(cfg.activo),
            modo: cfg.modo,
            slots: {
                hora_apertura: cfg.slots.hora_apertura,
                hora_cierre: cfg.slots.hora_cierre,
                duracion_min: Number(cfg.slots.duracion_min),
                intervalo_min: Number(cfg.slots.intervalo_min)
            },
            bloques_fijos: (cfg.bloques_fijos || []).map((b) => ({
                id: sanitizeBloqueId(b.nombre),
                label: b.nombre.trim(),
                hora_inicio: b.hora_inicio,
                hora_fin: b.hora_fin
            }))
        };
    });

    return {
        version: 2,
        timezone: 'America/Bogota',
        semanal,
        // compatibilidad legacy (motor residente toma día de semanal, pero conservamos estos campos)
        activo: semanal.lun_vie.activo,
        modo: semanal.lun_vie.modo,
        slots: semanal.lun_vie.slots,
        bloques_fijos: semanal.lun_vie.bloques_fijos
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

    const updateDiaConfig = (diaKey, updater) => {
        setRecursoForm((s) => ({
            ...s,
            disponibilidad_semanal: {
                ...s.disponibilidad_semanal,
                [diaKey]: updater(s.disponibilidad_semanal[diaKey])
            }
        }));
    };

    const agregarBloqueFijo = (diaKey) => {
        updateDiaConfig(diaKey, (dia) => ({
            ...dia,
            bloques_fijos: [...dia.bloques_fijos, { nombre: `Bloque ${dia.bloques_fijos.length + 1}`, hora_inicio: '08:00', hora_fin: '09:00' }]
        }));
    };

    const editarBloqueFijo = (diaKey, index, field, value) => {
        updateDiaConfig(diaKey, (dia) => ({
            ...dia,
            bloques_fijos: dia.bloques_fijos.map((b, idx) => idx === index ? { ...b, [field]: value } : b)
        }));
    };

    const eliminarBloqueFijo = (diaKey, index) => {
        updateDiaConfig(diaKey, (dia) => ({
            ...dia,
            bloques_fijos: dia.bloques_fijos.filter((_, idx) => idx !== index)
        }));
    };

    const guardarRecurso = async () => {
        if (!recursoForm.nombre || !recursoForm.tipo) return toast.error('Nombre y tipo son obligatorios');
        if (Number(recursoForm.tiempo_buffer_min) < 0) return toast.error('El tiempo de separación no puede ser negativo');

        for (const dia of GRUPOS_DIAS) {
            const error = validarDia(recursoForm.disponibilidad_semanal[dia.key], dia.label);
            if (error) return toast.error(error);
        }

        const payload = {
            conjunto_id: usuarioApp.conjunto_id,
            nombre: recursoForm.nombre.trim(),
            tipo: recursoForm.tipo,
            descripcion: recursoForm.descripcion?.trim() || null,
            capacidad: recursoForm.capacidad ? Number(recursoForm.capacidad) : null,
            tiempo_buffer_min: Number(recursoForm.tiempo_buffer_min || 0),
            reglas: {
                disponibilidad: buildDisponibilidadPayload(recursoForm)
            }
        };

        const resp = recursoEditId
            ? await actualizarRecursoComun({ ...payload, recurso_id: recursoEditId })
            : await crearRecursoComun(payload);

        if (!resp.ok) return toast.error(resp.error);
        toast.success(recursoEditId ? 'Recurso actualizado' : 'Recurso creado');
        if (!recursoEditId) setRecursoForm(buildRecursoFormDefault());
        cargar();
    };

    const crearBloqueoAdmin = async () => {
        if (!bloqueoForm.recurso_id || !bloqueoForm.fecha || !bloqueoForm.hora_inicio || !bloqueoForm.hora_fin || !bloqueoForm.motivo) {
            return toast.error('Completa recurso, horario y motivo del cierre temporal');
        }

        const fecha_inicio = `${bloqueoForm.fecha}T${bloqueoForm.hora_inicio}:00`;
        const fecha_fin = `${bloqueoForm.fecha}T${bloqueoForm.hora_fin}:00`;

        if (bloqueoForm.hora_fin <= bloqueoForm.hora_inicio) {
            return toast.error('La hora final debe ser mayor a la hora inicial');
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
        toast.success('Cierre temporal registrado');
        setBloqueoForm({ recurso_id: '', fecha: '', hora_inicio: '', hora_fin: '', motivo: '' });
        cargar();
    };

    const borrarBloqueo = async (id) => {
        const ok = window.confirm('¿Eliminar este cierre temporal?');
        if (!ok) return;
        const resp = await eliminarBloqueo(id);
        if (!resp.ok) return toast.error(resp.error);
        toast.success('Cierre temporal eliminado');
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
                <h3 className="text-lg font-semibold">Configurar recurso común</h3>
                <p className="text-sm text-slate-600">Define horarios por día para que residentes solo vean opciones válidas de reserva.</p>

                <select className="border rounded-lg px-3 py-2 w-full" value={recursoEditId} onChange={(e) => setRecursoEditId(e.target.value)}>
                    <option value="">Crear nuevo recurso</option>
                    {recursos.map((r) => <option key={r.id} value={r.id}>Editar: {r.nombre} · {r.tipo}</option>)}
                </select>

                <div className="grid md:grid-cols-2 gap-3">
                    <input className="border rounded-lg px-3 py-2" placeholder="Nombre del recurso" value={recursoForm.nombre} onChange={(e) => onChangeRecursoForm('nombre', e.target.value)} />
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
                    <label className="text-sm text-slate-700 block">
                        Tiempo de separación entre reservas (minutos)
                        <input type="number" min="0" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.tiempo_buffer_min} onChange={(e) => onChangeRecursoForm('tiempo_buffer_min', e.target.value)} />
                    </label>

                    <div className="space-y-3">
                        {GRUPOS_DIAS.map((dia) => {
                            const cfg = recursoForm.disponibilidad_semanal[dia.key];
                            return (
                                <div key={dia.key} className="bg-white border rounded-lg p-3 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <h5 className="font-medium">{dia.label}</h5>
                                        <label className="text-sm flex items-center gap-2">
                                            <input type="checkbox" checked={cfg.activo} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, activo: e.target.checked }))} />
                                            Disponible
                                        </label>
                                    </div>

                                    {cfg.activo && (
                                        <>
                                            <label className="text-sm block">
                                                Tipo de horario
                                                <select className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.modo} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, modo: e.target.value }))}>
                                                    {MODO_OPCIONES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                            </label>

                                            {cfg.modo === 'slots' && (
                                                <div className="grid md:grid-cols-2 gap-2">
                                                    <label className="text-sm">Hora de apertura<input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.slots.hora_apertura} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, hora_apertura: e.target.value } }))} /></label>
                                                    <label className="text-sm">Hora de cierre<input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.slots.hora_cierre} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, hora_cierre: e.target.value } }))} /></label>
                                                    <label className="text-sm">Duración de cada reserva (min)<input type="number" min="15" className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.slots.duracion_min} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, duracion_min: e.target.value } }))} /></label>
                                                    <label className="text-sm">Cada cuánto inicia una franja (min)<input type="number" min="5" className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.slots.intervalo_min} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, intervalo_min: e.target.value } }))} /></label>
                                                </div>
                                            )}

                                            {cfg.modo === 'bloques_fijos' && (
                                                <div className="space-y-2">
                                                    <p className="text-xs text-slate-500">Define bloques con nombre y horario (ejemplo: Mañana, Tarde).</p>
                                                    <button type="button" className="text-xs border rounded px-2 py-1" onClick={() => agregarBloqueFijo(dia.key)}>Agregar bloque</button>
                                                    {cfg.bloques_fijos.map((bloque, idx) => (
                                                        <div key={`${dia.key}-${idx}`} className="grid md:grid-cols-4 gap-2 items-end border rounded-lg p-2">
                                                            <label className="text-xs md:col-span-2">Nombre del bloque<input className="border rounded px-2 py-1 w-full mt-1" value={bloque.nombre} onChange={(e) => editarBloqueFijo(dia.key, idx, 'nombre', e.target.value)} /></label>
                                                            <label className="text-xs">Hora de inicio<input type="time" className="border rounded px-2 py-1 w-full mt-1" value={bloque.hora_inicio} onChange={(e) => editarBloqueFijo(dia.key, idx, 'hora_inicio', e.target.value)} /></label>
                                                            <label className="text-xs">Hora de fin<input type="time" className="border rounded px-2 py-1 w-full mt-1" value={bloque.hora_fin} onChange={(e) => editarBloqueFijo(dia.key, idx, 'hora_fin', e.target.value)} /></label>
                                                            <button type="button" className="text-xs border rounded px-2 py-1 h-8 md:col-span-4" onClick={() => eliminarBloqueFijo(dia.key, idx)}>Eliminar bloque</button>
                                                        </div>
                                                    ))}
                                                    {cfg.bloques_fijos.length === 0 && <p className="text-xs text-slate-500">Aún no hay bloques.</p>}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <button className="bg-indigo-700 text-white px-3 py-2 rounded" onClick={guardarRecurso}>{recursoEditId ? 'Guardar cambios' : 'Crear recurso'}</button>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow space-y-3">
                <h3 className="text-lg font-semibold">Cerrar temporalmente un recurso</h3>
                <p className="text-sm text-slate-600">Úsalo para mantenimiento, eventos internos, novedades operativas o cierres temporales.</p>

                <div className="grid md:grid-cols-2 gap-3">
                    <select className="border rounded-lg px-3 py-2" value={bloqueoForm.recurso_id} onChange={(e) => setBloqueoForm((s) => ({ ...s, recurso_id: e.target.value }))}>
                        <option value="">Selecciona recurso</option>
                        {recursos.map((r) => <option key={r.id} value={r.id}>{r.nombre} · {r.tipo}</option>)}
                    </select>
                    <input type="date" className="border rounded-lg px-3 py-2" value={bloqueoForm.fecha} onChange={(e) => setBloqueoForm((s) => ({ ...s, fecha: e.target.value }))} />
                    <input type="time" className="border rounded-lg px-3 py-2" value={bloqueoForm.hora_inicio} onChange={(e) => setBloqueoForm((s) => ({ ...s, hora_inicio: e.target.value }))} />
                    <input type="time" className="border rounded-lg px-3 py-2" value={bloqueoForm.hora_fin} onChange={(e) => setBloqueoForm((s) => ({ ...s, hora_fin: e.target.value }))} />
                    <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Motivo del cierre temporal" value={bloqueoForm.motivo} onChange={(e) => setBloqueoForm((s) => ({ ...s, motivo: e.target.value }))} />
                </div>
                <button className="bg-slate-800 text-white px-3 py-2 rounded" onClick={crearBloqueoAdmin}>Registrar cierre temporal</button>
                <div className="space-y-2">
                    {bloqueos.map((b) => (
                        <div key={b.id} className="border rounded p-2 flex items-center justify-between">
                            <p className="text-sm">{b.recursos_comunes?.nombre || b.recurso_id} · {formatDateRangeBogota(b.fecha_inicio, b.fecha_fin)} · {b.motivo}</p>
                            <button className="text-xs border rounded px-2 py-1" onClick={() => borrarBloqueo(b.id)}>Eliminar</button>
                        </div>
                    ))}
                    {bloqueos.length === 0 && <p className="text-sm text-gray-500">No hay cierres temporales registrados.</p>}
                </div>
            </div>
        </div>
    );
}
