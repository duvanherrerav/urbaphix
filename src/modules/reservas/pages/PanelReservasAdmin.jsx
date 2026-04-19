import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
    actualizarRecursoComun,
    cambiarEstadoReserva,
    crearBloqueo,
    crearRecursoComun,
    evaluarElegibilidadNoShow,
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
const POLITICAS_CONFIRMACION = [
    { value: 'requiere_aprobacion_admin', label: 'Requiere aprobación admin' },
    { value: 'confirmacion_automatica', label: 'Confirmación automática' }
];
const estadoLabel = (estado) => (estado === 'no_show' ? 'No asistió' : estado);

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
    requiere_deposito: false,
    deposito_valor: '',
    deposito_tipo: 'reembolsable',
    deposito_observacion: '',
    confirmacion_politica: 'requiere_aprobacion_admin',
    tiempo_buffer_min: 0,
    disponibilidad_semanal: {
        lun_vie: buildDefaultDia(),
        sabado: { ...buildDefaultDia(), slots: { ...buildDefaultDia().slots, hora_apertura: '08:00', hora_cierre: '20:00' } },
        domingo: { ...buildDefaultDia(), activo: false }
    },
    festivos: {
        activo: false,
        usar: 'sabado',
        especial: {
            modo: 'slots',
            slots: {
                hora_apertura: '08:00',
                hora_cierre: '16:00',
                duracion_min: 60,
                intervalo_min: 30
            },
            bloques_fijos: []
        }
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
    const festivos = disponibilidad?.festivos || {};
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
                duracion_min: Number(slots.duracion_min ?? form.disponibilidad_semanal[key].slots.duracion_min),
                intervalo_min: Number(slots.intervalo_min ?? form.disponibilidad_semanal[key].slots.intervalo_min)
            },
            bloques_fijos: bloques.map((b, idx) => ({
                nombre: b.label || `Bloque ${idx + 1}`,
                hora_inicio: b.hora_inicio || '08:00',
                hora_fin: b.hora_fin || '09:00'
            }))
        };
    });

    const especial = festivos?.especial || {};
    const especialSlots = especial?.slots || {};
    const especialBloques = Array.isArray(especial?.bloques_fijos) ? especial.bloques_fijos : [];

    const politicaConfirmacion = POLITICAS_CONFIRMACION.some((p) => p.value === recurso?.reglas?.confirmacion?.politica)
        ? recurso.reglas.confirmacion.politica
        : 'requiere_aprobacion_admin';

    return {
        ...form,
        nombre: recurso?.nombre || '',
        tipo: recurso?.tipo || 'salon_social',
        descripcion: recurso?.descripcion || '',
        capacidad: recurso?.capacidad ?? '',
        requiere_deposito: recurso?.requiere_deposito === true,
        deposito_valor: recurso?.deposito_valor ?? '',
        deposito_tipo: ['reembolsable', 'no_reembolsable'].includes(recurso?.reglas?.deposito?.tipo)
            ? recurso.reglas.deposito.tipo
            : 'reembolsable',
        deposito_observacion: recurso?.reglas?.deposito?.observacion || '',
        confirmacion_politica: politicaConfirmacion,
        tiempo_buffer_min: Number(recurso?.tiempo_buffer_min || 0),
        festivos: {
            activo: festivos.activo === true,
            usar: ['sabado', 'domingo', 'especial'].includes(festivos.usar) ? festivos.usar : 'sabado',
            especial: {
                modo: especial.modo === 'bloques_fijos' ? 'bloques_fijos' : 'slots',
                slots: {
                    hora_apertura: especialSlots.hora_apertura || form.festivos.especial.slots.hora_apertura,
                    hora_cierre: especialSlots.hora_cierre || form.festivos.especial.slots.hora_cierre,
                    duracion_min: Number(especialSlots.duracion_min ?? form.festivos.especial.slots.duracion_min),
                    intervalo_min: Number(especialSlots.intervalo_min ?? form.festivos.especial.slots.intervalo_min)
                },
                bloques_fijos: especialBloques.map((b, idx) => ({
                    nombre: b.label || `Bloque festivo ${idx + 1}`,
                    hora_inicio: b.hora_inicio || '08:00',
                    hora_fin: b.hora_fin || '09:00'
                }))
            }
        }
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
        if (!Number.isFinite(intervalo) || intervalo < 0) return `${diaLabel}: el intervalo no puede ser negativo`;
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
        if (ordenados[i].inicioMin < ordenados[i - 1].finMin) return `${diaLabel}: hay bloques que se solapan entre sí`;
    }

    return null;
};

const buildDiaPayload = (cfg) => ({
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
});

const buildDisponibilidadPayload = (form) => {
    const semanal = {};
    GRUPOS_DIAS.forEach(({ key }) => {
        semanal[key] = buildDiaPayload(form.disponibilidad_semanal[key]);
    });

    const festivosEspecial = buildDiaPayload({ ...form.festivos.especial, activo: true });

    return {
        version: 3,
        timezone: 'America/Bogota',
        semanal,
        festivos: {
            activo: Boolean(form.festivos.activo),
            usar: form.festivos.usar,
            especial: {
                modo: festivosEspecial.modo,
                slots: festivosEspecial.slots,
                bloques_fijos: festivosEspecial.bloques_fijos
            }
        },
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
    const [vistaAdmin, setVistaAdmin] = useState('lista'); // lista | crear | detalle
    const [wizardStep, setWizardStep] = useState(0); // 0 general, 1 disponibilidad, 2 deposito
    const [detalleTab, setDetalleTab] = useState('general'); // general | disponibilidad | deposito | bloqueos | historial

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

    const recursoEnEdicion = useMemo(() => recursos.find((r) => r.id === recursoEditId) || null, [recursos, recursoEditId]);

    useEffect(() => {
        if (!recursoEnEdicion) {
            setRecursoForm(buildRecursoFormDefault());
            return;
        }
        setRecursoForm(normalizarDisponibilidadDesdeRecurso(recursoEnEdicion));
    }, [recursoEnEdicion]);

    const updateDiaConfig = (diaKey, updater) => {
        setRecursoForm((s) => ({
            ...s,
            disponibilidad_semanal: {
                ...s.disponibilidad_semanal,
                [diaKey]: updater(s.disponibilidad_semanal[diaKey])
            }
        }));
    };

    const updateFestivosConfig = (updater) => {
        setRecursoForm((s) => ({ ...s, festivos: updater(s.festivos) }));
    };

    const addBloque = (scopeKey) => {
        if (scopeKey === 'festivos') {
            updateFestivosConfig((f) => ({
                ...f,
                especial: {
                    ...f.especial,
                    bloques_fijos: [...f.especial.bloques_fijos, { nombre: `Bloque festivo ${f.especial.bloques_fijos.length + 1}`, hora_inicio: '08:00', hora_fin: '09:00' }]
                }
            }));
            return;
        }

        updateDiaConfig(scopeKey, (dia) => ({
            ...dia,
            bloques_fijos: [...dia.bloques_fijos, { nombre: `Bloque ${dia.bloques_fijos.length + 1}`, hora_inicio: '08:00', hora_fin: '09:00' }]
        }));
    };

    const editBloque = (scopeKey, index, field, value) => {
        if (scopeKey === 'festivos') {
            updateFestivosConfig((f) => ({
                ...f,
                especial: {
                    ...f.especial,
                    bloques_fijos: f.especial.bloques_fijos.map((b, idx) => idx === index ? { ...b, [field]: value } : b)
                }
            }));
            return;
        }

        updateDiaConfig(scopeKey, (dia) => ({
            ...dia,
            bloques_fijos: dia.bloques_fijos.map((b, idx) => idx === index ? { ...b, [field]: value } : b)
        }));
    };

    const removeBloque = (scopeKey, index) => {
        if (scopeKey === 'festivos') {
            updateFestivosConfig((f) => ({
                ...f,
                especial: {
                    ...f.especial,
                    bloques_fijos: f.especial.bloques_fijos.filter((_, idx) => idx !== index)
                }
            }));
            return;
        }

        updateDiaConfig(scopeKey, (dia) => ({
            ...dia,
            bloques_fijos: dia.bloques_fijos.filter((_, idx) => idx !== index)
        }));
    };

    const guardarRecurso = async () => {
        if (!recursoForm.nombre || !recursoForm.tipo) return toast.error('Nombre y tipo son obligatorios');
        if (Number(recursoForm.tiempo_buffer_min) < 0) return toast.error('El tiempo de separación no puede ser negativo');
        if (recursoForm.requiere_deposito) {
            if (!(Number(recursoForm.deposito_valor) > 0)) return toast.error('El valor del depósito debe ser mayor a 0');
            if (!['reembolsable', 'no_reembolsable'].includes(recursoForm.deposito_tipo)) return toast.error('Debes definir tipo de depósito');
        }

        for (const dia of GRUPOS_DIAS) {
            const error = validarDia(recursoForm.disponibilidad_semanal[dia.key], dia.label);
            if (error) return toast.error(error);
        }

        if (recursoForm.festivos.activo && recursoForm.festivos.usar === 'especial') {
            const errorFestivo = validarDia({ ...recursoForm.festivos.especial, activo: true }, 'Festivos');
            if (errorFestivo) return toast.error(errorFestivo);
        }

        const payload = {
            conjunto_id: usuarioApp.conjunto_id,
            nombre: recursoForm.nombre.trim(),
            tipo: recursoForm.tipo,
            descripcion: recursoForm.descripcion?.trim() || null,
            capacidad: recursoForm.capacidad ? Number(recursoForm.capacidad) : null,
            requiere_deposito: Boolean(recursoForm.requiere_deposito),
            deposito_valor: recursoForm.requiere_deposito ? Number(recursoForm.deposito_valor) : null,
            tiempo_buffer_min: Number(recursoForm.tiempo_buffer_min || 0),
            reglas: {
                disponibilidad: buildDisponibilidadPayload(recursoForm),
                deposito: recursoForm.requiere_deposito
                    ? {
                        tipo: recursoForm.deposito_tipo,
                        observacion: recursoForm.deposito_observacion?.trim() || null
                    }
                    : {},
                confirmacion: {
                    politica: recursoForm.confirmacion_politica
                }
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
        if (!bloqueoForm.recurso_id || !bloqueoForm.fecha || !bloqueoForm.hora_inicio || !bloqueoForm.hora_fin || !bloqueoForm.motivo) return toast.error('Completa recurso, horario y motivo del cierre temporal');
        if (bloqueoForm.hora_fin <= bloqueoForm.hora_inicio) return toast.error('La hora final debe ser mayor a la hora inicial');

        const resp = await crearBloqueo({
            conjunto_id: usuarioApp.conjunto_id,
            recurso_id: bloqueoForm.recurso_id,
            fecha_inicio: `${bloqueoForm.fecha}T${bloqueoForm.hora_inicio}:00`,
            fecha_fin: `${bloqueoForm.fecha}T${bloqueoForm.hora_fin}:00`,
            motivo: bloqueoForm.motivo,
            creado_por: usuarioApp.id
        });

        if (!resp.ok) return toast.error(resp.error);
        toast.success('Cierre temporal registrado');
        setBloqueoForm({ recurso_id: '', fecha: '', hora_inicio: '', hora_fin: '', motivo: '' });
        cargar();
    };

    const borrarBloqueo = async (id) => {
        if (!window.confirm('¿Eliminar este cierre temporal?')) return;
        const resp = await eliminarBloqueo(id);
        if (!resp.ok) return toast.error(resp.error);
        toast.success('Cierre temporal eliminado');
        cargar();
    };

    const actualizarEstado = async (id, estado, detalle = null) => {
        const resp = await cambiarEstadoReserva({
            reserva_id: id,
            estado,
            usuario_id: usuarioApp.id,
            usuario_rol: usuarioApp.rol_id,
            detalle: detalle || `Gestión admin: ${estado}`
        });
        if (!resp.ok) return toast.error(resp.error);
        toast.success(`Reserva ${estadoLabel(estado)}`);
        cargar();
    };

    const verBitacora = async (reservaId) => {
        const resp = await listarEventosReserva(reservaId);
        if (!resp.ok) return toast.error(resp.error);
        setEventosPorReserva((prev) => ({ ...prev, [reservaId]: resp.data || [] }));
    };

    const iniciarCreacion = () => {
        setRecursoEditId('');
        setRecursoForm(buildRecursoFormDefault());
        setWizardStep(0);
        setVistaAdmin('crear');
    };

    const abrirDetalleRecurso = (recursoId, tab = 'general') => {
        setRecursoEditId(recursoId);
        setDetalleTab(tab);
        setVistaAdmin('detalle');
        setBloqueoForm((s) => ({ ...s, recurso_id: recursoId }));
    };

    const salirAListado = () => {
        setVistaAdmin('lista');
        setWizardStep(0);
        setDetalleTab('general');
    };

    const guardarDesdeVista = async () => {
        await guardarRecurso();
        await cargar();
        if (!recursoEditId) salirAListado();
    };

    const recursosHistorial = useMemo(
        () => reservas.filter((r) => !recursoEditId || r.recurso_id === recursoEditId),
        [reservas, recursoEditId]
    );

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-2xl font-bold">Recursos comunes</h2>
                    {vistaAdmin === 'lista' ? (
                        <button className="bg-indigo-700 text-white px-3 py-2 rounded" onClick={iniciarCreacion}>Crear recurso</button>
                    ) : (
                        <button className="border border-slate-300 px-3 py-2 rounded" onClick={salirAListado}>Volver al listado</button>
                    )}
                </div>
                {loading && <p className="text-sm text-gray-500">Cargando...</p>}

                {vistaAdmin === 'lista' && (
                    <div className="space-y-2">
                        {recursos.map((r) => (
                            <div key={r.id} className="border rounded-xl p-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-medium">{r.nombre}</p>
                                    <p className="text-sm text-slate-500">{r.tipo} · Capacidad: {r.capacidad || 'N/A'}</p>
                                </div>
                                <button className="text-sm border rounded px-3 py-1" onClick={() => abrirDetalleRecurso(r.id)}>Editar</button>
                            </div>
                        ))}
                        {recursos.length === 0 && <p className="text-sm text-gray-500">No hay recursos creados.</p>}
                    </div>
                )}

                {vistaAdmin !== 'lista' && (
                    <div className="space-y-4">
                        {vistaAdmin === 'crear' && (
                            <>
                                <div className="flex gap-2 text-sm">
                                    {['General', 'Disponibilidad', 'Depósito'].map((label, idx) => (
                                        <span key={label} className={`px-3 py-1 rounded-full ${wizardStep === idx ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}. {label}</span>
                                    ))}
                                </div>
                                <div className="grid md:grid-cols-2 gap-3">
                                    {wizardStep === 0 && (
                                        <>
                                            <input className="border rounded-lg px-3 py-2" placeholder="Nombre del recurso" value={recursoForm.nombre} onChange={(e) => setRecursoForm((s) => ({ ...s, nombre: e.target.value }))} />
                                            <select className="border rounded-lg px-3 py-2" value={recursoForm.tipo} onChange={(e) => setRecursoForm((s) => ({ ...s, tipo: e.target.value }))}>
                                                <option value="salon_social">Salón social</option><option value="cancha">Cancha</option><option value="bbq">BBQ</option><option value="logistica">Logística</option><option value="enseres">Enseres</option><option value="gimnasio">Gimnasio</option><option value="generica">Genérica</option>
                                            </select>
                                            <input className="border rounded-lg px-3 py-2" placeholder="Capacidad (opcional)" value={recursoForm.capacidad} onChange={(e) => setRecursoForm((s) => ({ ...s, capacidad: e.target.value }))} />
                                            <input className="border rounded-lg px-3 py-2" placeholder="Descripción (opcional)" value={recursoForm.descripcion} onChange={(e) => setRecursoForm((s) => ({ ...s, descripcion: e.target.value }))} />
                                            <label className="text-sm md:col-span-2">Política de confirmación
                                                <select className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.confirmacion_politica} onChange={(e) => setRecursoForm((s) => ({ ...s, confirmacion_politica: e.target.value }))}>
                                                    {POLITICAS_CONFIRMACION.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-sm md:col-span-2">Tiempo de separación entre reservas (minutos)
                                                <input type="number" min="0" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.tiempo_buffer_min} onChange={(e) => setRecursoForm((s) => ({ ...s, tiempo_buffer_min: e.target.value }))} />
                                            </label>
                                        </>
                                    )}
                                </div>
                                {wizardStep === 1 && (
                                    <div className="border rounded-xl p-4 space-y-3 bg-slate-50">
                                        <h4 className="font-semibold">Disponibilidad</h4>
                                        {GRUPOS_DIAS.map((dia) => {
                                            const cfg = recursoForm.disponibilidad_semanal[dia.key];
                                            return (
                                                <div key={dia.key} className="bg-white border rounded-lg p-3 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h5 className="font-medium">{dia.label}</h5>
                                                        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={cfg.activo} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, activo: e.target.checked }))} />Disponible</label>
                                                    </div>
                                                    {cfg.activo && (
                                                        <>
                                                            <label className="text-sm block">Tipo de horario
                                                                <select className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.modo} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, modo: e.target.value }))}>{MODO_OPCIONES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                                                            </label>
                                                            {cfg.modo === 'slots' ? (
                                                                <div className="grid md:grid-cols-2 gap-2">
                                                                    <label className="text-sm">Hora de apertura<input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.slots.hora_apertura} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, hora_apertura: e.target.value } }))} /></label>
                                                                    <label className="text-sm">Hora de cierre<input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.slots.hora_cierre} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, hora_cierre: e.target.value } }))} /></label>
                                                                    <label className="text-sm">Duración por reserva (min)<input type="number" min="15" className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.slots.duracion_min} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, duracion_min: e.target.value } }))} /></label>
                                                                    <label className="text-sm">Intervalo entre inicios (min)<input type="number" min="0" className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.slots.intervalo_min} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, intervalo_min: e.target.value } }))} /></label>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    <button type="button" className="text-xs border rounded px-2 py-1" onClick={() => addBloque(dia.key)}>Agregar bloque</button>
                                                                    {cfg.bloques_fijos.map((bloque, idx) => (
                                                                        <div key={`${dia.key}-${idx}`} className="grid md:grid-cols-4 gap-2 items-end border rounded-lg p-2">
                                                                            <label className="text-xs md:col-span-2">Nombre del bloque<input className="border rounded px-2 py-1 w-full mt-1" value={bloque.nombre} onChange={(e) => editBloque(dia.key, idx, 'nombre', e.target.value)} /></label>
                                                                            <label className="text-xs">Hora de inicio<input type="time" className="border rounded px-2 py-1 w-full mt-1" value={bloque.hora_inicio} onChange={(e) => editBloque(dia.key, idx, 'hora_inicio', e.target.value)} /></label>
                                                                            <label className="text-xs">Hora de fin<input type="time" className="border rounded px-2 py-1 w-full mt-1" value={bloque.hora_fin} onChange={(e) => editBloque(dia.key, idx, 'hora_fin', e.target.value)} /></label>
                                                                            <button type="button" className="text-xs border rounded px-2 py-1 h-8 md:col-span-4" onClick={() => removeBloque(dia.key, idx)}>Eliminar bloque</button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        <div className="bg-white border rounded-lg p-3 space-y-2">
                                            <h5 className="font-medium">Días festivos</h5>
                                            <label className="text-sm flex items-center gap-2">
                                                <input type="checkbox" checked={recursoForm.festivos.activo} onChange={(e) => updateFestivosConfig((f) => ({ ...f, activo: e.target.checked }))} />
                                                Disponible en festivos
                                            </label>
                                            {recursoForm.festivos.activo && (
                                                <>
                                                    <label className="text-sm block">Aplicar horario de festivo
                                                        <select className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.festivos.usar} onChange={(e) => updateFestivosConfig((f) => ({ ...f, usar: e.target.value }))}>
                                                            <option value="sabado">Usar horario de sábado</option>
                                                            <option value="domingo">Usar horario de domingo</option>
                                                            <option value="especial">Usar horario especial</option>
                                                        </select>
                                                    </label>
                                                    {recursoForm.festivos.usar === 'especial' && (
                                                        <div className="space-y-2 border rounded-lg p-2">
                                                            <label className="text-sm block">Tipo de horario especial
                                                                <select className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.festivos.especial.modo} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, modo: e.target.value } }))}>
                                                                    {MODO_OPCIONES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                                </select>
                                                            </label>
                                                            {recursoForm.festivos.especial.modo === 'slots' && (
                                                                <div className="grid md:grid-cols-2 gap-2">
                                                                    <label className="text-sm">Hora de apertura<input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.festivos.especial.slots.hora_apertura} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, hora_apertura: e.target.value } } }))} /></label>
                                                                    <label className="text-sm">Hora de cierre<input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.festivos.especial.slots.hora_cierre} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, hora_cierre: e.target.value } } }))} /></label>
                                                                    <label className="text-sm">Duración por reserva (min)<input type="number" min="15" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.festivos.especial.slots.duracion_min} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, duracion_min: e.target.value } } }))} /></label>
                                                                    <label className="text-sm">Intervalo entre inicios (min)<input type="number" min="0" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.festivos.especial.slots.intervalo_min} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, intervalo_min: e.target.value } } }))} /></label>
                                                                </div>
                                                            )}
                                                            {recursoForm.festivos.especial.modo === 'bloques_fijos' && (
                                                                <div className="space-y-2">
                                                                    <button type="button" className="text-xs border rounded px-2 py-1" onClick={() => addBloque('festivos')}>Agregar bloque festivo</button>
                                                                    {recursoForm.festivos.especial.bloques_fijos.map((bloque, idx) => (
                                                                        <div key={`wizard-festivos-${idx}`} className="grid md:grid-cols-4 gap-2 items-end border rounded-lg p-2">
                                                                            <label className="text-xs md:col-span-2">Nombre del bloque<input className="border rounded px-2 py-1 w-full mt-1" value={bloque.nombre} onChange={(e) => editBloque('festivos', idx, 'nombre', e.target.value)} /></label>
                                                                            <label className="text-xs">Hora de inicio<input type="time" className="border rounded px-2 py-1 w-full mt-1" value={bloque.hora_inicio} onChange={(e) => editBloque('festivos', idx, 'hora_inicio', e.target.value)} /></label>
                                                                            <label className="text-xs">Hora de fin<input type="time" className="border rounded px-2 py-1 w-full mt-1" value={bloque.hora_fin} onChange={(e) => editBloque('festivos', idx, 'hora_fin', e.target.value)} /></label>
                                                                            <button type="button" className="text-xs border rounded px-2 py-1 h-8 md:col-span-4" onClick={() => removeBloque('festivos', idx)}>Eliminar bloque</button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {wizardStep === 2 && (
                                    <div className="border rounded-xl p-4 space-y-3 bg-slate-50">
                                        <h4 className="font-semibold">Depósito</h4>
                                        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={recursoForm.requiere_deposito} onChange={(e) => setRecursoForm((s) => ({ ...s, requiere_deposito: e.target.checked }))} />¿Requiere depósito?</label>
                                        {recursoForm.requiere_deposito && (
                                            <div className="grid md:grid-cols-2 gap-3">
                                                <label className="text-sm">Valor del depósito (COP)<input type="number" min="1" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.deposito_valor} onChange={(e) => setRecursoForm((s) => ({ ...s, deposito_valor: e.target.value }))} /></label>
                                                <label className="text-sm">Tipo de depósito
                                                    <select className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.deposito_tipo} onChange={(e) => setRecursoForm((s) => ({ ...s, deposito_tipo: e.target.value }))}>
                                                        <option value="reembolsable">Reembolsable</option><option value="no_reembolsable">No reembolsable</option>
                                                    </select>
                                                </label>
                                                <label className="text-sm md:col-span-2">Observación (opcional)<textarea className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.deposito_observacion} onChange={(e) => setRecursoForm((s) => ({ ...s, deposito_observacion: e.target.value }))} /></label>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <button className="border rounded px-3 py-2" onClick={() => setWizardStep((s) => Math.max(0, s - 1))} disabled={wizardStep === 0}>Anterior</button>
                                    {wizardStep < 2
                                        ? <button className="bg-indigo-700 text-white rounded px-3 py-2" onClick={() => setWizardStep((s) => Math.min(2, s + 1))}>Siguiente</button>
                                        : <button className="bg-indigo-700 text-white rounded px-3 py-2" onClick={guardarDesdeVista}>Crear recurso</button>}
                                </div>
                            </>
                        )}

                        {vistaAdmin === 'detalle' && (
                            <>
                                <div className="flex flex-wrap gap-2 border-b pb-2">
                                    {[
                                        ['general', 'General'],
                                        ['disponibilidad', 'Disponibilidad'],
                                        ['deposito', 'Depósito'],
                                        ['bloqueos', 'Bloqueos'],
                                        ['historial', 'Historial']
                                    ].map(([key, label]) => (
                                        <button key={key} className={`px-3 py-1 rounded ${detalleTab === key ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`} onClick={() => setDetalleTab(key)}>{label}</button>
                                    ))}
                                </div>

                                {detalleTab === 'general' && (
                                    <div className="grid md:grid-cols-2 gap-3">
                                        <input className="border rounded-lg px-3 py-2" placeholder="Nombre del recurso" value={recursoForm.nombre} onChange={(e) => setRecursoForm((s) => ({ ...s, nombre: e.target.value }))} />
                                        <select className="border rounded-lg px-3 py-2" value={recursoForm.tipo} onChange={(e) => setRecursoForm((s) => ({ ...s, tipo: e.target.value }))}>
                                            <option value="salon_social">Salón social</option><option value="cancha">Cancha</option><option value="bbq">BBQ</option><option value="logistica">Logística</option><option value="enseres">Enseres</option><option value="gimnasio">Gimnasio</option><option value="generica">Genérica</option>
                                        </select>
                                        <input className="border rounded-lg px-3 py-2" placeholder="Capacidad (opcional)" value={recursoForm.capacidad} onChange={(e) => setRecursoForm((s) => ({ ...s, capacidad: e.target.value }))} />
                                        <input className="border rounded-lg px-3 py-2" placeholder="Descripción (opcional)" value={recursoForm.descripcion} onChange={(e) => setRecursoForm((s) => ({ ...s, descripcion: e.target.value }))} />
                                        <label className="text-sm md:col-span-2">Política de confirmación
                                            <select className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.confirmacion_politica} onChange={(e) => setRecursoForm((s) => ({ ...s, confirmacion_politica: e.target.value }))}>
                                                {POLITICAS_CONFIRMACION.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </label>
                                        <label className="text-sm md:col-span-2">Tiempo de separación entre reservas (minutos)
                                            <input type="number" min="0" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.tiempo_buffer_min} onChange={(e) => setRecursoForm((s) => ({ ...s, tiempo_buffer_min: e.target.value }))} />
                                        </label>
                                    </div>
                                )}

                                {detalleTab === 'disponibilidad' && (
                                    <div className="border rounded-xl p-4 space-y-3 bg-slate-50">
                                        <h4 className="font-semibold">Disponibilidad semanal</h4>
                                        {GRUPOS_DIAS.map((dia) => {
                                            const cfg = recursoForm.disponibilidad_semanal[dia.key];
                                            return (
                                                <div key={dia.key} className="bg-white border rounded-lg p-3 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h5 className="font-medium">{dia.label}</h5>
                                                        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={cfg.activo} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, activo: e.target.checked }))} />Disponible</label>
                                                    </div>
                                                    {cfg.activo && (
                                                        <>
                                                            <label className="text-sm block">Tipo de horario
                                                                <select className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.modo} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, modo: e.target.value }))}>{MODO_OPCIONES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                                                            </label>
                                                            {cfg.modo === 'slots' ? (
                                                                <div className="grid md:grid-cols-2 gap-2">
                                                                    <label className="text-sm">Hora de apertura<input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.slots.hora_apertura} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, hora_apertura: e.target.value } }))} /></label>
                                                                    <label className="text-sm">Hora de cierre<input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.slots.hora_cierre} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, hora_cierre: e.target.value } }))} /></label>
                                                                    <label className="text-sm">Duración por reserva (min)<input type="number" min="15" className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.slots.duracion_min} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, duracion_min: e.target.value } }))} /></label>
                                                                    <label className="text-sm">Intervalo entre inicios (min)<input type="number" min="0" className="border rounded-lg px-3 py-2 w-full mt-1" value={cfg.slots.intervalo_min} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, intervalo_min: e.target.value } }))} /></label>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    <button type="button" className="text-xs border rounded px-2 py-1" onClick={() => addBloque(dia.key)}>Agregar bloque</button>
                                                                    {cfg.bloques_fijos.map((bloque, idx) => (
                                                                        <div key={`${dia.key}-${idx}`} className="grid md:grid-cols-4 gap-2 items-end border rounded-lg p-2">
                                                                            <label className="text-xs md:col-span-2">Nombre del bloque<input className="border rounded px-2 py-1 w-full mt-1" value={bloque.nombre} onChange={(e) => editBloque(dia.key, idx, 'nombre', e.target.value)} /></label>
                                                                            <label className="text-xs">Hora de inicio<input type="time" className="border rounded px-2 py-1 w-full mt-1" value={bloque.hora_inicio} onChange={(e) => editBloque(dia.key, idx, 'hora_inicio', e.target.value)} /></label>
                                                                            <label className="text-xs">Hora de fin<input type="time" className="border rounded px-2 py-1 w-full mt-1" value={bloque.hora_fin} onChange={(e) => editBloque(dia.key, idx, 'hora_fin', e.target.value)} /></label>
                                                                            <button type="button" className="text-xs border rounded px-2 py-1 h-8 md:col-span-4" onClick={() => removeBloque(dia.key, idx)}>Eliminar bloque</button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        <div className="bg-white border rounded-lg p-3 space-y-2">
                                            <h5 className="font-medium">Días festivos</h5>
                                            <label className="text-sm flex items-center gap-2">
                                                <input type="checkbox" checked={recursoForm.festivos.activo} onChange={(e) => updateFestivosConfig((f) => ({ ...f, activo: e.target.checked }))} />
                                                Disponible en festivos
                                            </label>
                                            {recursoForm.festivos.activo && (
                                                <>
                                                    <label className="text-sm block">Aplicar horario de festivo
                                                        <select className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.festivos.usar} onChange={(e) => updateFestivosConfig((f) => ({ ...f, usar: e.target.value }))}>
                                                            <option value="sabado">Usar horario de sábado</option>
                                                            <option value="domingo">Usar horario de domingo</option>
                                                            <option value="especial">Usar horario especial</option>
                                                        </select>
                                                    </label>
                                                    {recursoForm.festivos.usar === 'especial' && (
                                                        <div className="space-y-2 border rounded-lg p-2">
                                                            <label className="text-sm block">Tipo de horario especial
                                                                <select className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.festivos.especial.modo} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, modo: e.target.value } }))}>
                                                                    {MODO_OPCIONES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                                </select>
                                                            </label>
                                                            {recursoForm.festivos.especial.modo === 'slots' && (
                                                                <div className="grid md:grid-cols-2 gap-2">
                                                                    <label className="text-sm">Hora de apertura<input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.festivos.especial.slots.hora_apertura} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, hora_apertura: e.target.value } } }))} /></label>
                                                                    <label className="text-sm">Hora de cierre<input type="time" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.festivos.especial.slots.hora_cierre} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, hora_cierre: e.target.value } } }))} /></label>
                                                                    <label className="text-sm">Duración por reserva (min)<input type="number" min="15" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.festivos.especial.slots.duracion_min} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, duracion_min: e.target.value } } }))} /></label>
                                                                    <label className="text-sm">Intervalo entre inicios (min)<input type="number" min="0" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.festivos.especial.slots.intervalo_min} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, intervalo_min: e.target.value } } }))} /></label>
                                                                </div>
                                                            )}
                                                            {recursoForm.festivos.especial.modo === 'bloques_fijos' && (
                                                                <div className="space-y-2">
                                                                    <button type="button" className="text-xs border rounded px-2 py-1" onClick={() => addBloque('festivos')}>Agregar bloque festivo</button>
                                                                    {recursoForm.festivos.especial.bloques_fijos.map((bloque, idx) => (
                                                                        <div key={`detalle-festivos-${idx}`} className="grid md:grid-cols-4 gap-2 items-end border rounded-lg p-2">
                                                                            <label className="text-xs md:col-span-2">Nombre del bloque<input className="border rounded px-2 py-1 w-full mt-1" value={bloque.nombre} onChange={(e) => editBloque('festivos', idx, 'nombre', e.target.value)} /></label>
                                                                            <label className="text-xs">Hora de inicio<input type="time" className="border rounded px-2 py-1 w-full mt-1" value={bloque.hora_inicio} onChange={(e) => editBloque('festivos', idx, 'hora_inicio', e.target.value)} /></label>
                                                                            <label className="text-xs">Hora de fin<input type="time" className="border rounded px-2 py-1 w-full mt-1" value={bloque.hora_fin} onChange={(e) => editBloque('festivos', idx, 'hora_fin', e.target.value)} /></label>
                                                                            <button type="button" className="text-xs border rounded px-2 py-1 h-8 md:col-span-4" onClick={() => removeBloque('festivos', idx)}>Eliminar bloque</button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {detalleTab === 'deposito' && (
                                    <div className="border rounded-xl p-4 space-y-3 bg-slate-50">
                                        <h4 className="font-semibold">Depósito</h4>
                                        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={recursoForm.requiere_deposito} onChange={(e) => setRecursoForm((s) => ({ ...s, requiere_deposito: e.target.checked }))} />¿Requiere depósito?</label>
                                        {recursoForm.requiere_deposito && (
                                            <div className="grid md:grid-cols-2 gap-3">
                                                <label className="text-sm">Valor del depósito (COP)<input type="number" min="1" className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.deposito_valor} onChange={(e) => setRecursoForm((s) => ({ ...s, deposito_valor: e.target.value }))} /></label>
                                                <label className="text-sm">Tipo de depósito
                                                    <select className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.deposito_tipo} onChange={(e) => setRecursoForm((s) => ({ ...s, deposito_tipo: e.target.value }))}>
                                                        <option value="reembolsable">Reembolsable</option><option value="no_reembolsable">No reembolsable</option>
                                                    </select>
                                                </label>
                                                <label className="text-sm md:col-span-2">Observación (opcional)<textarea className="border rounded-lg px-3 py-2 w-full mt-1" value={recursoForm.deposito_observacion} onChange={(e) => setRecursoForm((s) => ({ ...s, deposito_observacion: e.target.value }))} /></label>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {detalleTab === 'bloqueos' && (
                                    <div className="space-y-3">
                                        <p className="text-sm text-slate-600">Registra cierres temporales por mantenimiento o novedades operativas.</p>
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
                                            {bloqueos.filter((b) => !recursoEditId || b.recurso_id === recursoEditId).map((b) => (
                                                <div key={b.id} className="border rounded p-2 flex items-center justify-between">
                                                    <p className="text-sm">{b.recursos_comunes?.nombre || b.recurso_id} · {formatDateRangeBogota(b.fecha_inicio, b.fecha_fin)} · {b.motivo}</p>
                                                    <button className="text-xs border rounded px-2 py-1" onClick={() => borrarBloqueo(b.id)}>Eliminar</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {detalleTab === 'historial' && (
                                    <div className="space-y-2">
                                        {recursosHistorial.map((r) => {
                                            const evaluacionNoShow = evaluarElegibilidadNoShow(r);
                                            return (
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
                                                    {r.estado === 'aprobada' && (
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={() => actualizarEstado(r.id, 'en_curso', 'Check-in por admin')}>
                                                                Check-in
                                                            </button>
                                                            <button
                                                                className="bg-amber-600 text-white px-3 py-1 rounded disabled:bg-amber-300 disabled:cursor-not-allowed"
                                                                disabled={!evaluacionNoShow.elegible}
                                                                onClick={() => actualizarEstado(r.id, 'no_show', 'Marcada como no asistió por admin')}
                                                            >
                                                                Marcar como no asistió
                                                            </button>
                                                            {!evaluacionNoShow.elegible && (
                                                                <p className="w-full text-xs text-amber-700">{evaluacionNoShow.motivo}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                    {r.estado === 'en_curso' && (
                                                        <div className="flex gap-2 mt-2">
                                                            <button className="bg-emerald-600 text-white px-3 py-1 rounded" onClick={() => actualizarEstado(r.id, 'finalizada', 'Check-out por admin')}>
                                                                Check-out
                                                            </button>
                                                        </div>
                                                    )}
                                                    <button className="text-sm underline" onClick={() => verBitacora(r.id)}>Ver historial</button>
                                                    {eventosPorReserva[r.id]?.length > 0 && (
                                                        <ul className="text-xs text-gray-600 list-disc pl-4">
                                                            {eventosPorReserva[r.id].map((ev) => (
                                                                <li key={ev.id}>{ev.accion} · {formatDateTimeBogota(ev.created_at)} · {ev.detalle || 'Sin detalle'}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {recursosHistorial.length === 0 && <p className="text-sm text-gray-500">Sin historial para este recurso.</p>}
                                    </div>
                                )}

                                {['general', 'disponibilidad', 'deposito'].includes(detalleTab) && (
                                    <button className="bg-indigo-700 text-white px-3 py-2 rounded" onClick={guardarDesdeVista}>Guardar cambios</button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}