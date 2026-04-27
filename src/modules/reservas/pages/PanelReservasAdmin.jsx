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
import AppTimePicker from '../../../components/ui/AppTimePicker';
import AppDatePicker from '../../../components/ui/AppDatePicker';
import {
    getReservaAccionLabel,
    formatearMilesCOP,
    getReservaEstadoLabel,
    getReservaResidenteLabel,
    getReservaTorreAptoLabel,
    normalizarInputMoneda
} from '../utils/reservaFormatters';

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
const HISTORIAL_PREVIEW_LIMITE = 3;
const HISTORIAL_PAGE_SIZE = 5;

const getTodayInputDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function ToggleField({ checked, onChange, label, description }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`app-toggle ${checked ? 'app-toggle-active' : ''}`}
        >
            <span className="flex items-center justify-between gap-3">
                <span className="text-left">
                    <span className="block text-sm font-medium text-app-text-primary">{label}</span>
                    {description && <span className="block text-xs text-app-text-secondary">{description}</span>}
                </span>
                <span className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${checked ? 'bg-brand-secondary' : 'bg-app-border'}`}>
                    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
                </span>
            </span>
        </button>
    );
}


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
    const [mostrarHistorialCompleto, setMostrarHistorialCompleto] = useState(false);
    const [busquedaHistorial, setBusquedaHistorial] = useState('');
    const [filtroEstadoHistorial, setFiltroEstadoHistorial] = useState('todos');
    const [paginaHistorial, setPaginaHistorial] = useState(1);
    const [hoyBloqueo] = useState(getTodayInputDate());

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

    const validarGeneralRecurso = () => {
        if (!recursoForm.nombre?.trim() || !recursoForm.tipo) {
            toast.error('Completa nombre y tipo del recurso para continuar.');
            return false;
        }
        if (Number(recursoForm.tiempo_buffer_min) < 0) {
            toast.error('El tiempo de separación no puede ser negativo.');
            return false;
        }
        return true;
    };

    const validarDisponibilidadRecurso = () => {
        for (const dia of GRUPOS_DIAS) {
            const error = validarDia(recursoForm.disponibilidad_semanal[dia.key], dia.label);
            if (error) {
                toast.error(error);
                return false;
            }
        }

        if (recursoForm.festivos.activo && recursoForm.festivos.usar === 'especial') {
            const errorFestivo = validarDia({ ...recursoForm.festivos.especial, activo: true }, 'Festivos');
            if (errorFestivo) {
                toast.error(errorFestivo);
                return false;
            }
        }

        return true;
    };

    const validarDepositoRecurso = () => {
        if (!recursoForm.requiere_deposito) return true;
        if (!(Number(recursoForm.deposito_valor) > 0)) {
            toast.error('El valor del depósito debe ser mayor a 0.');
            return false;
        }
        if (!['reembolsable', 'no_reembolsable'].includes(recursoForm.deposito_tipo)) {
            toast.error('Debes definir el tipo de depósito.');
            return false;
        }
        return true;
    };

    const avanzarWizard = () => {
        if (wizardStep === 0 && !validarGeneralRecurso()) return;
        if (wizardStep === 1 && !validarDisponibilidadRecurso()) return;
        setWizardStep((s) => Math.min(2, s + 1));
    };

    const onChangeDepositoValor = (rawValue) => {
        const limpio = normalizarInputMoneda(rawValue);
        setRecursoForm((s) => ({ ...s, deposito_valor: limpio }));
    };


    const guardarRecurso = async () => {
        if (!validarGeneralRecurso()) return;
        if (!validarDisponibilidadRecurso()) return;
        if (!validarDepositoRecurso()) return;

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
        if (!bloqueoForm.recurso_id || !bloqueoForm.fecha || !bloqueoForm.hora_inicio || !bloqueoForm.hora_fin || !bloqueoForm.motivo?.trim()) return toast.error('Completa recurso, horario y motivo del cierre temporal');
        if (bloqueoForm.fecha < hoyBloqueo) return toast.error('No puedes registrar bloqueos en fechas pasadas.');
        if (bloqueoForm.hora_fin <= bloqueoForm.hora_inicio) return toast.error('La hora final debe ser mayor a la hora inicial');

        const resp = await crearBloqueo({
            conjunto_id: usuarioApp.conjunto_id,
            recurso_id: bloqueoForm.recurso_id,
            fecha_inicio: `${bloqueoForm.fecha}T${bloqueoForm.hora_inicio}:00`,
            fecha_fin: `${bloqueoForm.fecha}T${bloqueoForm.hora_fin}:00`,
            motivo: bloqueoForm.motivo.trim(),
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
        setMostrarHistorialCompleto(false);
        setBusquedaHistorial('');
        setFiltroEstadoHistorial('todos');
        setPaginaHistorial(1);
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

    const historialFiltrado = useMemo(() => {
        const term = busquedaHistorial.trim().toLowerCase();
        return recursosHistorial.filter((r) => {
            const cumpleEstado = filtroEstadoHistorial === 'todos' || r.estado === filtroEstadoHistorial;
            if (!cumpleEstado) return false;
            if (!term) return true;
            const candidato = [
                r.recursos_comunes?.nombre,
                r.estado,
                getReservaEstadoLabel(r.estado),
                r.motivo,
                getReservaResidenteLabel(r),
                getReservaTorreAptoLabel(r)
            ].filter(Boolean).join(' ').toLowerCase();
            return candidato.includes(term);
        });
    }, [busquedaHistorial, filtroEstadoHistorial, recursosHistorial]);

    const historialPreview = useMemo(
        () => recursosHistorial.slice(0, HISTORIAL_PREVIEW_LIMITE),
        [recursosHistorial]
    );

    const hayMasHistorial = recursosHistorial.length > HISTORIAL_PREVIEW_LIMITE;
    const totalPaginasHistorial = Math.max(1, Math.ceil(historialFiltrado.length / HISTORIAL_PAGE_SIZE));
    const historialPaginado = useMemo(() => {
        const start = (paginaHistorial - 1) * HISTORIAL_PAGE_SIZE;
        return historialFiltrado.slice(start, start + HISTORIAL_PAGE_SIZE);
    }, [historialFiltrado, paginaHistorial]);

    useEffect(() => {
        setPaginaHistorial(1);
    }, [busquedaHistorial, filtroEstadoHistorial, mostrarHistorialCompleto]);

    useEffect(() => {
        if (paginaHistorial > totalPaginasHistorial) {
            setPaginaHistorial(totalPaginasHistorial);
        }
    }, [paginaHistorial, totalPaginasHistorial]);

    return (
        <div className="space-y-5">
            <div className="app-surface-primary rounded-2xl p-5 shadow space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-2xl font-bold">Recursos comunes</h2>
                    {vistaAdmin === 'lista' ? (
                        <button className="app-btn-primary text-xs" onClick={iniciarCreacion}>Crear recurso</button>
                    ) : (
                        <button className="app-btn-ghost text-xs" onClick={salirAListado}>Volver al listado</button>
                    )}
                </div>
                {loading && <p className="text-sm text-app-text-secondary">Cargando...</p>}

                {vistaAdmin === 'lista' && (
                    <div className="space-y-2">
                        {recursos.map((r) => (
                            <div key={r.id} className="app-surface-muted p-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-medium">{r.nombre}</p>
                                    <p className="text-sm text-app-text-secondary">{r.tipo} · Capacidad: {r.capacidad || 'N/A'}</p>
                                </div>
                                <button className="app-btn-ghost text-xs" onClick={() => abrirDetalleRecurso(r.id)}>Editar</button>
                            </div>
                        ))}
                        {recursos.length === 0 && <p className="text-sm text-app-text-secondary">No hay recursos creados.</p>}
                    </div>
                )}

                {vistaAdmin !== 'lista' && (
                    <div className="space-y-4">
                        {vistaAdmin === 'crear' && (
                            <>
                                <div className="flex gap-2 text-sm">
                                    {['General', 'Disponibilidad', 'Depósito'].map((label, idx) => (
                                        <span key={label} className={`px-3 py-1 rounded-full ${wizardStep === idx ? 'bg-[#38BDF826] text-state-info border-state-info/40' : 'bg-app-bg text-app-text-secondary border-app-border'}`}>{idx + 1}. {label}</span>
                                    ))}
                                </div>
                                <div className="grid md:grid-cols-2 gap-3">
                                    {wizardStep === 0 && (
                                        <>
                                            <label className="text-sm">Nombre del recurso
                                                <input className="app-input mt-1" placeholder="Ej: Salón social torre 1" value={recursoForm.nombre} onChange={(e) => setRecursoForm((s) => ({ ...s, nombre: e.target.value }))} />
                                            </label>
                                            <label className="text-sm">Tipo de recurso
                                                <select className="app-input mt-1" value={recursoForm.tipo} onChange={(e) => setRecursoForm((s) => ({ ...s, tipo: e.target.value }))}>
                                                    <option value="salon_social">Salón social</option><option value="cancha">Cancha</option><option value="bbq">BBQ</option><option value="logistica">Logística</option><option value="enseres">Enseres</option><option value="gimnasio">Gimnasio</option><option value="generica">Genérica</option>
                                                </select>
                                            </label>
                                            <label className="text-sm">Capacidad máxima
                                                <input className="app-input mt-1" placeholder="Opcional" value={recursoForm.capacidad} onChange={(e) => setRecursoForm((s) => ({ ...s, capacidad: e.target.value }))} />
                                            </label>
                                            <label className="text-sm">Descripción
                                                <input className="app-input mt-1" placeholder="Opcional" value={recursoForm.descripcion} onChange={(e) => setRecursoForm((s) => ({ ...s, descripcion: e.target.value }))} />
                                            </label>
                                            <label className="text-sm md:col-span-2">Política de confirmación
                                                <select className="app-input mt-1" value={recursoForm.confirmacion_politica} onChange={(e) => setRecursoForm((s) => ({ ...s, confirmacion_politica: e.target.value }))}>
                                                    {POLITICAS_CONFIRMACION.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-sm md:col-span-2">Tiempo de separación entre reservas (minutos)
                                                <input type="number" min="0" className="app-input mt-1" value={recursoForm.tiempo_buffer_min} onChange={(e) => setRecursoForm((s) => ({ ...s, tiempo_buffer_min: e.target.value }))} />
                                            </label>
                                        </>
                                    )}
                                </div>
                                {wizardStep === 1 && (
                                    <div className="app-surface-muted p-4 space-y-3 bg-app-bg/70">
                                        <h4 className="font-semibold">Disponibilidad</h4>
                                        {GRUPOS_DIAS.map((dia) => {
                                            const cfg = recursoForm.disponibilidad_semanal[dia.key];
                                            return (
                                                <div key={dia.key} className="rounded-lg border border-app-border bg-app-bg-alt/80 p-3 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h5 className="font-medium">{dia.label}</h5>
                                                        <ToggleField
                                                            checked={cfg.activo}
                                                            onChange={(checked) => updateDiaConfig(dia.key, (d) => ({ ...d, activo: checked }))}
                                                            label="Disponible"
                                                            description={`Controla si ${dia.label.toLowerCase()} se habilita para reservas.`}
                                                        />
                                                    </div>
                                                    {cfg.activo && (
                                                        <>
                                                            <label className="text-sm block">Tipo de horario
                                                                <select className="app-input mt-1" value={cfg.modo} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, modo: e.target.value }))}>{MODO_OPCIONES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                                                            </label>
                                                            {cfg.modo === 'slots' ? (
                                                                <div className="grid md:grid-cols-2 gap-2">
                                                                    <label className="text-sm">Hora de apertura<AppTimePicker className="mt-1" value={cfg.slots.hora_apertura} onChange={(nextValue) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, hora_apertura: nextValue } }))} /></label>
                                                                    <label className="text-sm">Hora de cierre<AppTimePicker className="mt-1" value={cfg.slots.hora_cierre} onChange={(nextValue) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, hora_cierre: nextValue } }))} /></label>
                                                                    <label className="text-sm">Duración por reserva (min)<input type="number" min="15" className="app-input mt-1" value={cfg.slots.duracion_min} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, duracion_min: e.target.value } }))} /></label>
                                                                    <label className="text-sm">Intervalo entre inicios (min)<input type="number" min="0" className="app-input mt-1" value={cfg.slots.intervalo_min} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, intervalo_min: e.target.value } }))} /></label>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    <button type="button" className="app-btn-ghost text-xs" onClick={() => addBloque(dia.key)}>Agregar bloque</button>
                                                                    {cfg.bloques_fijos.map((bloque, idx) => (
                                                                        <div key={`${dia.key}-${idx}`} className="grid md:grid-cols-4 gap-2 items-end border rounded-lg p-2">
                                                                            <label className="text-xs md:col-span-2">Nombre del bloque<input className="app-input mt-1" value={bloque.nombre} onChange={(e) => editBloque(dia.key, idx, 'nombre', e.target.value)} /></label>
                                                                            <label className="text-xs">Hora de inicio<AppTimePicker className="mt-1" value={bloque.hora_inicio} onChange={(nextValue) => editBloque(dia.key, idx, 'hora_inicio', nextValue)} /></label>
                                                                            <label className="text-xs">Hora de fin<AppTimePicker className="mt-1" value={bloque.hora_fin} onChange={(nextValue) => editBloque(dia.key, idx, 'hora_fin', nextValue)} /></label>
                                                                            <button type="button" className="app-btn-danger text-xs h-8 md:col-span-4" onClick={() => removeBloque(dia.key, idx)}>Eliminar bloque</button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        <div className="rounded-xl border border-brand-primary/25 bg-app-bg-alt/80 p-4 space-y-3">
                                            <div>
                                                <h5 className="font-medium">Días festivos</h5>
                                                <p className="text-xs text-app-text-secondary">Define si el recurso operará en festivos y qué horario se aplicará.</p>
                                            </div>
                                            <ToggleField
                                                checked={recursoForm.festivos.activo}
                                                onChange={(checked) => updateFestivosConfig((f) => ({ ...f, activo: checked }))}
                                                label="Disponible en festivos"
                                                description="Permite reservas en días festivos con la regla que elijas abajo."
                                            />
                                            {recursoForm.festivos.activo && (
                                                <>
                                                    <label className="text-sm block">Aplicar horario de festivo
                                                        <select className="app-input mt-1" value={recursoForm.festivos.usar} onChange={(e) => updateFestivosConfig((f) => ({ ...f, usar: e.target.value }))}>
                                                            <option value="sabado">Usar horario de sábado</option>
                                                            <option value="domingo">Usar horario de domingo</option>
                                                            <option value="especial">Usar horario especial</option>
                                                        </select>
                                                    </label>
                                                    {recursoForm.festivos.usar === 'especial' && (
                                                        <div className="space-y-2 rounded-lg border border-brand-primary/30 bg-app-bg/60 p-3">
                                                            <label className="text-sm block">Tipo de horario especial
                                                                <select className="app-input mt-1" value={recursoForm.festivos.especial.modo} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, modo: e.target.value } }))}>
                                                                    {MODO_OPCIONES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                                </select>
                                                            </label>
                                                            {recursoForm.festivos.especial.modo === 'slots' && (
                                                                <div className="grid md:grid-cols-2 gap-2">
                                                                    <label className="text-sm">Hora de apertura<AppTimePicker className="mt-1" value={recursoForm.festivos.especial.slots.hora_apertura} onChange={(nextValue) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, hora_apertura: nextValue } } }))} /></label>
                                                                    <label className="text-sm">Hora de cierre<AppTimePicker className="mt-1" value={recursoForm.festivos.especial.slots.hora_cierre} onChange={(nextValue) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, hora_cierre: nextValue } } }))} /></label>
                                                                    <label className="text-sm">Duración por reserva (min)<input type="number" min="15" className="app-input mt-1" value={recursoForm.festivos.especial.slots.duracion_min} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, duracion_min: e.target.value } } }))} /></label>
                                                                    <label className="text-sm">Intervalo entre inicios (min)<input type="number" min="0" className="app-input mt-1" value={recursoForm.festivos.especial.slots.intervalo_min} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, intervalo_min: e.target.value } } }))} /></label>
                                                                </div>
                                                            )}
                                                            {recursoForm.festivos.especial.modo === 'bloques_fijos' && (
                                                                <div className="space-y-2">
                                                                    <button type="button" className="app-btn-ghost text-xs" onClick={() => addBloque('festivos')}>Agregar bloque festivo</button>
                                                                    {recursoForm.festivos.especial.bloques_fijos.map((bloque, idx) => (
                                                                        <div key={`wizard-festivos-${idx}`} className="grid md:grid-cols-4 gap-2 items-end border rounded-lg p-2">
                                                                            <label className="text-xs md:col-span-2">Nombre del bloque<input className="app-input mt-1" value={bloque.nombre} onChange={(e) => editBloque('festivos', idx, 'nombre', e.target.value)} /></label>
                                                                            <label className="text-xs">Hora de inicio<AppTimePicker className="mt-1" value={bloque.hora_inicio} onChange={(nextValue) => editBloque('festivos', idx, 'hora_inicio', nextValue)} /></label>
                                                                            <label className="text-xs">Hora de fin<AppTimePicker className="mt-1" value={bloque.hora_fin} onChange={(nextValue) => editBloque('festivos', idx, 'hora_fin', nextValue)} /></label>
                                                                            <button type="button" className="app-btn-danger text-xs h-8 md:col-span-4" onClick={() => removeBloque('festivos', idx)}>Eliminar bloque</button>
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
                                    <div className="app-surface-muted p-4 space-y-3 bg-app-bg/70">
                                        <h4 className="font-semibold">Depósito</h4>
                                        <ToggleField
                                            checked={recursoForm.requiere_deposito}
                                            onChange={(checked) => setRecursoForm((s) => ({ ...s, requiere_deposito: checked }))}
                                            label="¿Requiere depósito?"
                                            description="Actívalo para solicitar depósito antes de confirmar reservas."
                                        />
                                        {recursoForm.requiere_deposito && (
                                            <div className="grid md:grid-cols-2 gap-3">
                                                <label className="text-sm">Valor del depósito (COP)
                                                    <input
                                                        inputMode="numeric"
                                                        placeholder="Ej: 100.000"
                                                        className="app-input mt-1"
                                                        value={formatearMilesCOP(recursoForm.deposito_valor)}
                                                        onChange={(e) => onChangeDepositoValor(e.target.value)}
                                                    />
                                                    <span className="mt-1 block text-xs text-app-text-secondary">Se mostrará con separador de miles y se guardará como valor numérico.</span>
                                                </label>
                                                <label className="text-sm">Tipo de depósito
                                                    <select className="app-input mt-1" value={recursoForm.deposito_tipo} onChange={(e) => setRecursoForm((s) => ({ ...s, deposito_tipo: e.target.value }))}>
                                                        <option value="reembolsable">Reembolsable</option><option value="no_reembolsable">No reembolsable</option>
                                                    </select>
                                                </label>
                                                <label className="text-sm md:col-span-2">Observación (opcional)<textarea className="app-input mt-1" value={recursoForm.deposito_observacion} onChange={(e) => setRecursoForm((s) => ({ ...s, deposito_observacion: e.target.value }))} /></label>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <button className="app-btn-ghost text-xs" onClick={() => setWizardStep((s) => Math.max(0, s - 1))} disabled={wizardStep === 0}>Anterior</button>
                                    {wizardStep < 2
                                        ? <button className="app-btn-primary text-xs" onClick={avanzarWizard}>Siguiente</button>
                                        : <button className="app-btn-primary text-xs" onClick={guardarDesdeVista}>Crear recurso</button>}
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
                                        <button key={key} className={`px-3 py-1 rounded border ${detalleTab === key ? 'bg-[#38BDF826] text-state-info border-state-info/40' : 'bg-app-bg text-app-text-secondary border-app-border'}`} onClick={() => setDetalleTab(key)}>{label}</button>
                                    ))}
                                </div>

                                {detalleTab === 'general' && (
                                    <div className="grid md:grid-cols-2 gap-3">
                                        <label className="text-sm">Nombre del recurso
                                            <input className="app-input mt-1" placeholder="Ej: Salón social torre 1" value={recursoForm.nombre} onChange={(e) => setRecursoForm((s) => ({ ...s, nombre: e.target.value }))} />
                                        </label>
                                        <label className="text-sm">Tipo de recurso
                                            <select className="app-input mt-1" value={recursoForm.tipo} onChange={(e) => setRecursoForm((s) => ({ ...s, tipo: e.target.value }))}>
                                                <option value="salon_social">Salón social</option><option value="cancha">Cancha</option><option value="bbq">BBQ</option><option value="logistica">Logística</option><option value="enseres">Enseres</option><option value="gimnasio">Gimnasio</option><option value="generica">Genérica</option>
                                            </select>
                                        </label>
                                        <label className="text-sm">Capacidad máxima
                                            <input className="app-input mt-1" placeholder="Opcional" value={recursoForm.capacidad} onChange={(e) => setRecursoForm((s) => ({ ...s, capacidad: e.target.value }))} />
                                        </label>
                                        <label className="text-sm">Descripción
                                            <input className="app-input mt-1" placeholder="Opcional" value={recursoForm.descripcion} onChange={(e) => setRecursoForm((s) => ({ ...s, descripcion: e.target.value }))} />
                                        </label>
                                        <label className="text-sm md:col-span-2">Política de confirmación
                                            <select className="app-input mt-1" value={recursoForm.confirmacion_politica} onChange={(e) => setRecursoForm((s) => ({ ...s, confirmacion_politica: e.target.value }))}>
                                                {POLITICAS_CONFIRMACION.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </label>
                                        <label className="text-sm md:col-span-2">Tiempo de separación entre reservas (minutos)
                                            <input type="number" min="0" className="app-input mt-1" value={recursoForm.tiempo_buffer_min} onChange={(e) => setRecursoForm((s) => ({ ...s, tiempo_buffer_min: e.target.value }))} />
                                        </label>
                                    </div>
                                )}

                                {detalleTab === 'disponibilidad' && (
                                    <div className="app-surface-muted p-4 space-y-3 bg-app-bg/70">
                                        <h4 className="font-semibold">Disponibilidad semanal</h4>
                                        {GRUPOS_DIAS.map((dia) => {
                                            const cfg = recursoForm.disponibilidad_semanal[dia.key];
                                            return (
                                                <div key={dia.key} className="rounded-lg border border-app-border bg-app-bg-alt/80 p-3 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h5 className="font-medium">{dia.label}</h5>
                                                        <ToggleField
                                                            checked={cfg.activo}
                                                            onChange={(checked) => updateDiaConfig(dia.key, (d) => ({ ...d, activo: checked }))}
                                                            label="Disponible"
                                                            description={`Controla si ${dia.label.toLowerCase()} se habilita para reservas.`}
                                                        />
                                                    </div>
                                                    {cfg.activo && (
                                                        <>
                                                            <label className="text-sm block">Tipo de horario
                                                                <select className="app-input mt-1" value={cfg.modo} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, modo: e.target.value }))}>{MODO_OPCIONES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                                                            </label>
                                                            {cfg.modo === 'slots' ? (
                                                                <div className="grid md:grid-cols-2 gap-2">
                                                                    <label className="text-sm">Hora de apertura<AppTimePicker className="mt-1" value={cfg.slots.hora_apertura} onChange={(nextValue) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, hora_apertura: nextValue } }))} /></label>
                                                                    <label className="text-sm">Hora de cierre<AppTimePicker className="mt-1" value={cfg.slots.hora_cierre} onChange={(nextValue) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, hora_cierre: nextValue } }))} /></label>
                                                                    <label className="text-sm">Duración por reserva (min)<input type="number" min="15" className="app-input mt-1" value={cfg.slots.duracion_min} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, duracion_min: e.target.value } }))} /></label>
                                                                    <label className="text-sm">Intervalo entre inicios (min)<input type="number" min="0" className="app-input mt-1" value={cfg.slots.intervalo_min} onChange={(e) => updateDiaConfig(dia.key, (d) => ({ ...d, slots: { ...d.slots, intervalo_min: e.target.value } }))} /></label>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    <button type="button" className="app-btn-ghost text-xs" onClick={() => addBloque(dia.key)}>Agregar bloque</button>
                                                                    {cfg.bloques_fijos.map((bloque, idx) => (
                                                                        <div key={`${dia.key}-${idx}`} className="grid md:grid-cols-4 gap-2 items-end border rounded-lg p-2">
                                                                            <label className="text-xs md:col-span-2">Nombre del bloque<input className="app-input mt-1" value={bloque.nombre} onChange={(e) => editBloque(dia.key, idx, 'nombre', e.target.value)} /></label>
                                                                            <label className="text-xs">Hora de inicio<AppTimePicker className="mt-1" value={bloque.hora_inicio} onChange={(nextValue) => editBloque(dia.key, idx, 'hora_inicio', nextValue)} /></label>
                                                                            <label className="text-xs">Hora de fin<AppTimePicker className="mt-1" value={bloque.hora_fin} onChange={(nextValue) => editBloque(dia.key, idx, 'hora_fin', nextValue)} /></label>
                                                                            <button type="button" className="app-btn-danger text-xs h-8 md:col-span-4" onClick={() => removeBloque(dia.key, idx)}>Eliminar bloque</button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        <div className="rounded-xl border border-brand-primary/25 bg-app-bg-alt/80 p-4 space-y-3">
                                            <div>
                                                <h5 className="font-medium">Días festivos</h5>
                                                <p className="text-xs text-app-text-secondary">Define si el recurso operará en festivos y qué horario se aplicará.</p>
                                            </div>
                                            <ToggleField
                                                checked={recursoForm.festivos.activo}
                                                onChange={(checked) => updateFestivosConfig((f) => ({ ...f, activo: checked }))}
                                                label="Disponible en festivos"
                                                description="Permite reservas en días festivos con la regla que elijas abajo."
                                            />
                                            {recursoForm.festivos.activo && (
                                                <>
                                                    <label className="text-sm block">Aplicar horario de festivo
                                                        <select className="app-input mt-1" value={recursoForm.festivos.usar} onChange={(e) => updateFestivosConfig((f) => ({ ...f, usar: e.target.value }))}>
                                                            <option value="sabado">Usar horario de sábado</option>
                                                            <option value="domingo">Usar horario de domingo</option>
                                                            <option value="especial">Usar horario especial</option>
                                                        </select>
                                                    </label>
                                                    {recursoForm.festivos.usar === 'especial' && (
                                                        <div className="space-y-2 rounded-lg border border-brand-primary/30 bg-app-bg/60 p-3">
                                                            <label className="text-sm block">Tipo de horario especial
                                                                <select className="app-input mt-1" value={recursoForm.festivos.especial.modo} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, modo: e.target.value } }))}>
                                                                    {MODO_OPCIONES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                                </select>
                                                            </label>
                                                            {recursoForm.festivos.especial.modo === 'slots' && (
                                                                <div className="grid md:grid-cols-2 gap-2">
                                                                    <label className="text-sm">Hora de apertura<AppTimePicker className="mt-1" value={recursoForm.festivos.especial.slots.hora_apertura} onChange={(nextValue) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, hora_apertura: nextValue } } }))} /></label>
                                                                    <label className="text-sm">Hora de cierre<AppTimePicker className="mt-1" value={recursoForm.festivos.especial.slots.hora_cierre} onChange={(nextValue) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, hora_cierre: nextValue } } }))} /></label>
                                                                    <label className="text-sm">Duración por reserva (min)<input type="number" min="15" className="app-input mt-1" value={recursoForm.festivos.especial.slots.duracion_min} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, duracion_min: e.target.value } } }))} /></label>
                                                                    <label className="text-sm">Intervalo entre inicios (min)<input type="number" min="0" className="app-input mt-1" value={recursoForm.festivos.especial.slots.intervalo_min} onChange={(e) => updateFestivosConfig((f) => ({ ...f, especial: { ...f.especial, slots: { ...f.especial.slots, intervalo_min: e.target.value } } }))} /></label>
                                                                </div>
                                                            )}
                                                            {recursoForm.festivos.especial.modo === 'bloques_fijos' && (
                                                                <div className="space-y-2">
                                                                    <button type="button" className="app-btn-ghost text-xs" onClick={() => addBloque('festivos')}>Agregar bloque festivo</button>
                                                                    {recursoForm.festivos.especial.bloques_fijos.map((bloque, idx) => (
                                                                        <div key={`detalle-festivos-${idx}`} className="grid md:grid-cols-4 gap-2 items-end border rounded-lg p-2">
                                                                            <label className="text-xs md:col-span-2">Nombre del bloque<input className="app-input mt-1" value={bloque.nombre} onChange={(e) => editBloque('festivos', idx, 'nombre', e.target.value)} /></label>
                                                                            <label className="text-xs">Hora de inicio<AppTimePicker className="mt-1" value={bloque.hora_inicio} onChange={(nextValue) => editBloque('festivos', idx, 'hora_inicio', nextValue)} /></label>
                                                                            <label className="text-xs">Hora de fin<AppTimePicker className="mt-1" value={bloque.hora_fin} onChange={(nextValue) => editBloque('festivos', idx, 'hora_fin', nextValue)} /></label>
                                                                            <button type="button" className="app-btn-danger text-xs h-8 md:col-span-4" onClick={() => removeBloque('festivos', idx)}>Eliminar bloque</button>
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
                                    <div className="app-surface-muted p-4 space-y-3 bg-app-bg/70">
                                        <h4 className="font-semibold">Depósito</h4>
                                        <ToggleField
                                            checked={recursoForm.requiere_deposito}
                                            onChange={(checked) => setRecursoForm((s) => ({ ...s, requiere_deposito: checked }))}
                                            label="¿Requiere depósito?"
                                            description="Actívalo para solicitar depósito antes de confirmar reservas."
                                        />
                                        {recursoForm.requiere_deposito && (
                                            <div className="grid md:grid-cols-2 gap-3">
                                                <label className="text-sm">Valor del depósito (COP)
                                                    <input
                                                        inputMode="numeric"
                                                        placeholder="Ej: 100.000"
                                                        className="app-input mt-1"
                                                        value={formatearMilesCOP(recursoForm.deposito_valor)}
                                                        onChange={(e) => onChangeDepositoValor(e.target.value)}
                                                    />
                                                    <span className="mt-1 block text-xs text-app-text-secondary">Se mostrará con separador de miles y se guardará como valor numérico.</span>
                                                </label>
                                                <label className="text-sm">Tipo de depósito
                                                    <select className="app-input mt-1" value={recursoForm.deposito_tipo} onChange={(e) => setRecursoForm((s) => ({ ...s, deposito_tipo: e.target.value }))}>
                                                        <option value="reembolsable">Reembolsable</option><option value="no_reembolsable">No reembolsable</option>
                                                    </select>
                                                </label>
                                                <label className="text-sm md:col-span-2">Observación (opcional)<textarea className="app-input mt-1" value={recursoForm.deposito_observacion} onChange={(e) => setRecursoForm((s) => ({ ...s, deposito_observacion: e.target.value }))} /></label>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {detalleTab === 'bloqueos' && (
                                    <div className="space-y-3">
                                        <p className="text-sm text-app-text-secondary">Registra cierres temporales por mantenimiento o novedades operativas.</p>
                                        <div className="rounded-xl border border-app-border bg-app-bg/40 p-4">
                                            <div className="grid md:grid-cols-2 gap-3">
                                                <label className="text-sm">Recurso a bloquear
                                                    <select className="app-input mt-1" value={bloqueoForm.recurso_id} onChange={(e) => setBloqueoForm((s) => ({ ...s, recurso_id: e.target.value }))}>
                                                        <option value="">Selecciona recurso</option>
                                                        {recursos.map((r) => <option key={r.id} value={r.id}>{r.nombre} · {r.tipo}</option>)}
                                                    </select>
                                                </label>
                                                <label className="text-sm">📅 Fecha del bloqueo
                                                    <AppDatePicker className="mt-1" value={bloqueoForm.fecha} minDate={hoyBloqueo} onChange={(nextValue) => setBloqueoForm((s) => ({ ...s, fecha: nextValue }))} placeholder="Selecciona fecha del bloqueo" />
                                                </label>
                                                <label className="text-sm">🕒 Hora inicio
                                                    <AppTimePicker className="mt-1" value={bloqueoForm.hora_inicio} onChange={(nextValue) => setBloqueoForm((s) => ({ ...s, hora_inicio: nextValue }))} placeholder="Selecciona hora inicio" />
                                                </label>
                                                <label className="text-sm">🕒 Hora fin
                                                    <AppTimePicker className="mt-1" value={bloqueoForm.hora_fin} onChange={(nextValue) => setBloqueoForm((s) => ({ ...s, hora_fin: nextValue }))} placeholder="Selecciona hora fin" />
                                                </label>
                                                <label className="text-sm md:col-span-2">Motivo del cierre temporal
                                                    <input className="app-input mt-1" placeholder="Ej: mantenimiento preventivo" value={bloqueoForm.motivo} onChange={(e) => setBloqueoForm((s) => ({ ...s, motivo: e.target.value }))} />
                                                </label>
                                            </div>
                                            <p className="mt-2 text-xs text-app-text-secondary">La hora fin debe ser mayor que la hora inicio.</p>
                                        </div>
                                        <button className="app-btn-primary text-xs" onClick={crearBloqueoAdmin}>Registrar cierre temporal</button>
                                        <div className="space-y-2">
                                            {bloqueos.filter((b) => !recursoEditId || b.recurso_id === recursoEditId).map((b) => (
                                                <div key={b.id} className="app-surface-muted p-2 flex items-center justify-between">
                                                    <p className="text-sm">{b.recursos_comunes?.nombre || b.recurso_id} · {formatDateRangeBogota(b.fecha_inicio, b.fecha_fin)} · {b.motivo}</p>
                                                    <button className="app-btn-ghost text-xs" onClick={() => borrarBloqueo(b.id)}>Eliminar</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {detalleTab === 'historial' && (
                                    <div className="space-y-3">
                                        <p className="text-sm text-app-text-secondary">Vista rápida de los últimos movimientos para evitar una lista infinita en pantalla.</p>
                                        {historialPreview.map((r) => {
                                            const evaluacionNoShow = evaluarElegibilidadNoShow(r);
                                            return (
                                                <div key={r.id} className="app-surface-muted p-3 space-y-2">
                                                    <div className="flex items-center justify-between gap-2"><p className="font-medium">{r.recursos_comunes?.nombre || 'Recurso'}</p><ReservaStatusBadge estado={r.estado} /></div>
                                                    <p className="text-sm text-app-text-secondary">Inicio: {formatDateTimeBogota(r.fecha_inicio)} · Fin: {formatDateTimeBogota(r.fecha_fin)}</p>
                                                    <p className="text-sm text-app-text-secondary">{getReservaResidenteLabel(r)} · {getReservaTorreAptoLabel(r)}</p>
                                                    <div className="grid md:grid-cols-3 gap-2 text-xs">
                                                        <div className="app-surface-primary p-2">
                                                            <p className="text-app-text-secondary">Post-reserva</p>
                                                            <p>{getReservaEstadoLabel(r.estado)}</p>
                                                        </div>
                                                        <div className="app-surface-primary p-2">
                                                            <p className="text-app-text-secondary">Depósito</p>
                                                            <p>{r.deposito_estado || r.metadata?.deposito_estado || 'Pendiente de política 7B'}</p>
                                                        </div>
                                                        <div className="app-surface-primary p-2">
                                                            <p className="text-app-text-secondary">Causal económica</p>
                                                            <p>{r.causal_economica || r.metadata?.causal_economica || 'Sin causal definida'}</p>
                                                        </div>
                                                    </div>
                                                    {r.estado === 'solicitada' && (
                                                        <div className="flex gap-2 mt-2">
                                                            <button className="app-btn-secondary text-xs" onClick={() => actualizarEstado(r.id, 'aprobada')}>Aprobar</button>
                                                            <button className="app-btn-danger text-xs" onClick={() => actualizarEstado(r.id, 'rechazada')}>Rechazar</button>
                                                        </div>
                                                    )}
                                                    {r.estado === 'aprobada' && (
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            <button className="app-btn-primary text-xs" onClick={() => actualizarEstado(r.id, 'en_curso', 'Check-in por admin')}>Check-in</button>
                                                            <button className="app-btn-secondary text-xs disabled:opacity-50" disabled={!evaluacionNoShow.elegible} onClick={() => actualizarEstado(r.id, 'no_show', 'Marcada como no asistió por admin')}>Marcar como no asistió</button>
                                                            {!evaluacionNoShow.elegible && <p className="w-full text-xs text-amber-700">{evaluacionNoShow.motivo}</p>}
                                                        </div>
                                                    )}
                                                    {r.estado === 'en_curso' && (
                                                        <div className="flex gap-2 mt-2">
                                                            <button className="app-btn-secondary text-xs" onClick={() => actualizarEstado(r.id, 'finalizada', 'Check-out por admin')}>Check-out</button>
                                                        </div>
                                                    )}
                                                    <button className="text-xs text-brand-secondary underline" onClick={() => verBitacora(r.id)}>Ver historial</button>
                                                    {eventosPorReserva[r.id]?.length > 0 && (
                                                        <ul className="text-xs text-app-text-secondary list-disc pl-4">
                                                            {eventosPorReserva[r.id].map((ev) => (
                                                                <li key={ev.id}>{getReservaAccionLabel(ev.accion)} · {formatDateTimeBogota(ev.created_at)} · {ev.detalle || 'Sin detalle'}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {recursosHistorial.length === 0 && <p className="text-sm text-app-text-secondary">Sin historial para este recurso.</p>}
                                        {hayMasHistorial && (
                                            <button className="app-btn-ghost text-xs" onClick={() => setMostrarHistorialCompleto(true)}>Ver historial completo ({recursosHistorial.length})</button>
                                        )}

                                        {mostrarHistorialCompleto && (
                                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                                                <div className="app-surface-primary w-full max-w-5xl rounded-2xl border border-app-border p-4">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h4 className="font-semibold">Historial completo del recurso</h4>
                                                        <button className="app-btn-ghost text-xs" onClick={() => setMostrarHistorialCompleto(false)}>Cerrar</button>
                                                    </div>
                                                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                        <input className="app-input" placeholder="Buscar por residente, estado, motivo o recurso" value={busquedaHistorial} onChange={(e) => setBusquedaHistorial(e.target.value)} />
                                                        <select className="app-input" value={filtroEstadoHistorial} onChange={(e) => setFiltroEstadoHistorial(e.target.value)}>
                                                            <option value="todos">Todos los estados</option>
                                                            <option value="solicitada">Solicitada</option>
                                                            <option value="aprobada">Aprobada</option>
                                                            <option value="rechazada">Rechazada</option>
                                                            <option value="cancelada">Cancelada</option>
                                                            <option value="en_curso">En curso</option>
                                                            <option value="finalizada">Finalizada</option>
                                                            <option value="no_show">No asistió</option>
                                                        </select>
                                                    </div>
                                                    <div className="mt-3 max-h-[65vh] space-y-2 overflow-y-auto pr-1 app-scrollbar">
                                                        {historialPaginado.map((item) => (
                                                            <div key={`modal-${item.id}`} className="app-surface-muted p-3">
                                                                <div className="flex items-center justify-between gap-2"><p className="font-medium">{item.recursos_comunes?.nombre || 'Recurso'}</p><ReservaStatusBadge estado={item.estado} /></div>
                                                                <p className="text-xs text-app-text-secondary">Inicio: {formatDateTimeBogota(item.fecha_inicio)} · Fin: {formatDateTimeBogota(item.fecha_fin)}</p>
                                                                <p className="text-xs text-app-text-secondary">{getReservaResidenteLabel(item)} · {getReservaTorreAptoLabel(item)}</p>
                                                            </div>
                                                        ))}
                                                        {historialFiltrado.length === 0 && <p className="text-sm text-app-text-secondary">No hay resultados para el filtro actual.</p>}
                                                    </div>
                                                    <div className="mt-3 flex items-center justify-between">
                                                        <button className="app-btn-ghost text-xs disabled:opacity-50" disabled={paginaHistorial <= 1} onClick={() => setPaginaHistorial((p) => Math.max(1, p - 1))}>
                                                            Anterior
                                                        </button>
                                                        <p className="text-xs text-app-text-secondary">Página {paginaHistorial} de {totalPaginasHistorial}</p>
                                                        <button className="app-btn-ghost text-xs disabled:opacity-50" disabled={paginaHistorial >= totalPaginasHistorial} onClick={() => setPaginaHistorial((p) => Math.min(totalPaginasHistorial, p + 1))}>
                                                            Siguiente
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {['general', 'disponibilidad', 'deposito'].includes(detalleTab) && (
                                    <button className="app-btn-primary text-xs" onClick={guardarDesdeVista}>Guardar cambios</button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
