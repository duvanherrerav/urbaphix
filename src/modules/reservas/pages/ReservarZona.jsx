import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ReservaCreateCard from '../components/residente/ReservaCreateCard';
import ReservaCard from '../components/residente/ReservaCard';
import ReservaEmptyState from '../components/residente/ReservaEmptyState';
import ReservaErrorBanner from '../components/residente/ReservaErrorBanner';
import ReservaStatusBadge from '../components/shared/ReservaStatusBadge';
import { formatDateRangeBogota, getTodayBogotaDate } from '../utils/dateTimeBogota';
import { getReservaEstadoLabel } from '../utils/reservaFormatters';
import {
    cambiarEstadoReserva,
    crearReserva,
    getDisponibilidadRecurso,
    getPerfilResidente,
    getRecursosComunes,
    listarDocumentosReservas,
    listarReservas,
    registrarDocumentoReserva,
    subscribeReservasConjunto
} from '../services/reservasService';

const ESTADOS_ACTIVOS = ['solicitada', 'aprobada', 'en_curso'];
const ESTADOS_HISTORIAL = ['finalizada', 'cancelada', 'rechazada', 'no_show'];
const HISTORIAL_PAGE_SIZE = 5;
const TIMELINE_ENABLED = false;

const RESERVA_FILTERS = [
    { value: 'todos', label: 'Todos los estados' },
    { value: 'finalizada', label: 'Finalizadas' },
    { value: 'cancelada', label: 'Canceladas' },
    { value: 'rechazada', label: 'Rechazadas' },
    { value: 'no_show', label: 'No asistió' }
];

const ReservaListSkeleton = ({ count = 2 }) => (
    <div className="space-y-3" aria-label="Cargando reservas">
        {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="app-surface-muted p-4 space-y-3 animate-pulse">
                <div className="flex items-center justify-between gap-3">
                    <div className="space-y-2 flex-1">
                        <div className="h-4 w-2/3 rounded bg-app-border" />
                        <div className="h-3 w-1/2 rounded bg-app-border" />
                    </div>
                    <div className="h-6 w-20 rounded-full bg-app-border" />
                </div>
                <div className="h-3 w-full rounded bg-app-border" />
            </div>
        ))}
    </div>
);

const getReservaFechaInicioValue = (reserva) => new Date(reserva.fecha_inicio).getTime() || 0;

export default function ReservarZona({ usuarioApp }) {
    const [recursos, setRecursos] = useState([]);
    const [perfilResidente, setPerfilResidente] = useState(null);
    const [reservas, setReservas] = useState([]);
    const [errorGeneral, setErrorGeneral] = useState('');
    const [loadingCreate, setLoadingCreate] = useState(false);
    const [loadingReservas, setLoadingReservas] = useState(false);
    const [subiendoSoporteId, setSubiendoSoporteId] = useState(null);
    const [timelineOpenId, setTimelineOpenId] = useState(null);
    const [timelineByReserva] = useState({});
    const [slotsDisponibles, setSlotsDisponibles] = useState([]);
    const [franjasDisponibles, setFranjasDisponibles] = useState([]);
    const [disponibilidadConfig, setDisponibilidadConfig] = useState(null);
    const [fallbackConfigAplicado, setFallbackConfigAplicado] = useState(false);
    const [sugerenciasHorario, setSugerenciasHorario] = useState([]);
    const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false);
    const [mensajeDisponibilidad, setMensajeDisponibilidad] = useState('');
    const [horarioInvalido, setHorarioInvalido] = useState(false);
    const [mensajeHorario, setMensajeHorario] = useState('');
    const [tabActiva, setTabActiva] = useState('activas');
    const [filtroHistorial, setFiltroHistorial] = useState('todos');
    const [paginaHistorial, setPaginaHistorial] = useState(1);
    const [form, setForm] = useState({
        recurso_id: '',
        fecha: '',
        franja_id: '',
        tipo_reserva: 'recreativa',
        subtipo: '',
        motivo: '',
        observaciones: ''
    });

    const setFormField = (field, value) => {
        setForm((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'recurso_id' || field === 'fecha') {
                next.franja_id = '';
            }
            return next;
        });
    };

    const cargar = async () => {
        if (!usuarioApp?.id || !usuarioApp?.conjunto_id) return;
        setErrorGeneral('');
        setLoadingReservas(true);

        const [recursosResp, perfilResp] = await Promise.all([
            getRecursosComunes(usuarioApp.conjunto_id),
            getPerfilResidente(usuarioApp.id)
        ]);

        if (!recursosResp.ok) setErrorGeneral(recursosResp.error);
        if (!perfilResp.ok) setErrorGeneral(perfilResp.error);

        setRecursos(recursosResp.data || []);
        setPerfilResidente(perfilResp.data || null);

        if (perfilResp.data?.id) {
            const reservasResp = await listarReservas({
                conjunto_id: usuarioApp.conjunto_id,
                residente_id: perfilResp.data.id,
                limit: 200
            });

            if (!reservasResp.ok) {
                setErrorGeneral(reservasResp.error);
                setReservas([]);
            } else {
                const reservaIds = (reservasResp.data || []).map((r) => r.id);
                const docsResp = await listarDocumentosReservas(reservaIds);

                if (!docsResp.ok) {
                    setErrorGeneral(docsResp.error);
                }

                const conSoportes = (reservasResp.data || []).map((reserva) => ({
                    ...reserva,
                    documentos: docsResp.ok ? (docsResp.data[reserva.id] || []) : []
                }));

                setReservas(conSoportes);
            }
        } else {
            setReservas([]);
        }

        setLoadingReservas(false);
    };

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuarioApp?.id, usuarioApp?.conjunto_id]);

    useEffect(() => {
        if (!usuarioApp?.conjunto_id) return undefined;
        return subscribeReservasConjunto(usuarioApp.conjunto_id, () => {
            cargar();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usuarioApp?.conjunto_id]);

    useEffect(() => {
        const cargarDisponibilidad = async () => {
            if (!usuarioApp?.conjunto_id || !form.recurso_id || !form.fecha) {
                setSlotsDisponibles([]);
                setFranjasDisponibles([]);
                setDisponibilidadConfig(null);
                setFallbackConfigAplicado(false);
                setMensajeDisponibilidad('');
                return;
            }

            setLoadingDisponibilidad(true);
            const resp = await getDisponibilidadRecurso({
                conjunto_id: usuarioApp.conjunto_id,
                recurso_id: form.recurso_id,
                fecha: form.fecha
            });
            setLoadingDisponibilidad(false);

            if (!resp.ok) {
                setErrorGeneral(resp.error);
                setSlotsDisponibles([]);
                setFranjasDisponibles([]);
                setDisponibilidadConfig(null);
                setFallbackConfigAplicado(false);
                setMensajeDisponibilidad('');
                return;
            }

            setSlotsDisponibles(resp.data.slots || []);
            setFranjasDisponibles(resp.data.franjas || []);
            setDisponibilidadConfig(resp.data.config || null);
            setFallbackConfigAplicado(Boolean(resp.data.fallbackAplicado));
            setMensajeDisponibilidad(resp.data.mensaje || '');
            setSugerenciasHorario([]);
            setHorarioInvalido(false);
            setMensajeHorario('');
        };

        cargarDisponibilidad();
    }, [usuarioApp?.conjunto_id, form.recurso_id, form.fecha]);

    useEffect(() => {
        setPaginaHistorial(1);
    }, [filtroHistorial]);

    const recursoSeleccionado = useMemo(
        () => recursos.find((r) => r.id === form.recurso_id) || null,
        [recursos, form.recurso_id]
    );

    const franjaSeleccionada = useMemo(
        () => franjasDisponibles.find((franja) => franja.id === form.franja_id) || null,
        [franjasDisponibles, form.franja_id]
    );

    const depositoRecursoSeleccionado = useMemo(() => {
        if (!recursoSeleccionado) return null;
        const reglasDeposito = recursoSeleccionado.reglas?.deposito || {};
        const requiere = Boolean(recursoSeleccionado.requiere_deposito || reglasDeposito.requiere);
        return {
            requiere,
            valor: recursoSeleccionado.deposito_valor || reglasDeposito.valor || 0,
            tipo: reglasDeposito.tipo || null,
            observacion: reglasDeposito.observacion || null
        };
    }, [recursoSeleccionado]);

    const crear = async () => {
        if (!perfilResidente?.id) return toast.error('Tu usuario no tiene perfil de residente asociado');
        if (!form.recurso_id || !form.fecha || !form.franja_id) return toast.error('Selecciona recurso, fecha y franja disponible');

        if (!franjaSeleccionada || !franjaSeleccionada.seleccionable) {
            setHorarioInvalido(true);
            setMensajeHorario('Selecciona una franja marcada como disponible.');
            return toast.error('Selecciona una franja disponible');
        }

        const ahora = getTodayBogotaDate();
        if (form.fecha < ahora) return toast.error('No puedes reservar fechas pasadas');

        setLoadingCreate(true);
        const result = await crearReserva({
            conjunto_id: usuarioApp.conjunto_id,
            recurso_id: form.recurso_id,
            residente_id: perfilResidente.id,
            apartamento_id: perfilResidente.apartamento_id,
            fecha_inicio: franjaSeleccionada.fecha_inicio,
            fecha_fin: franjaSeleccionada.fecha_fin,
            tipo_reserva: form.tipo_reserva,
            subtipo: form.subtipo || null,
            motivo: form.motivo || null,
            observaciones: form.observaciones || null,
            metadata: {
                origen: 'app_residente',
                recurso_tipo: recursoSeleccionado?.tipo || null,
                disponibilidad_modo: disponibilidadConfig?.modo || 'slots',
                franja_id: franjaSeleccionada.id
            }
        });
        setLoadingCreate(false);

        if (!result.ok) {
            const alternativas = slotsDisponibles.slice(0, 4).map((slot) => `${slot.inicio} - ${slot.fin}`);
            setSugerenciasHorario(alternativas);
            return toast.error(result.error);
        }

        if (result.meta?.confirmada_automaticamente) {
            toast.success('Reserva confirmada');
        } else {
            toast.success('Solicitud enviada para aprobación');
        }
        setForm((f) => ({
            ...f,
            fecha: '',
            franja_id: '',
            subtipo: '',
            motivo: '',
            observaciones: ''
        }));
        setTabActiva('activas');
        cargar();
    };

    const seleccionarFranja = (franja) => {
        if (!franja?.seleccionable) return;
        setForm((prev) => ({
            ...prev,
            franja_id: franja.id
        }));
        setHorarioInvalido(false);
        setMensajeHorario('');
        setSugerenciasHorario([]);
    };

    const cancelar = async (reservaId) => {
        const ok = window.confirm('¿Cancelar esta reserva? Esta acción no se puede deshacer.');
        if (!ok) return;

        const resp = await cambiarEstadoReserva({
            reserva_id: reservaId,
            estado: 'cancelada',
            usuario_id: usuarioApp.id,
            usuario_rol: usuarioApp.rol_id,
            usuario_residente_id: perfilResidente?.id || null,
            detalle: 'Cancelación solicitada por residente'
        });

        if (!resp.ok) return toast.error(resp.error);
        toast.success('Reserva cancelada');
        cargar();
    };

    const adjuntarSoporte = async (reservaId, file) => {
        if (!file) return;

        const ruta_storage = `referencia-local://${reservaId}/${Date.now()}-${file.name}`;
        setSubiendoSoporteId(reservaId);

        const resp = await registrarDocumentoReserva({
            reserva_id: reservaId,
            conjunto_id: usuarioApp.conjunto_id,
            nombre_archivo: file.name,
            ruta_storage,
            tipo_documento: file.type || 'adjunto',
            subido_por: usuarioApp.id
        });

        setSubiendoSoporteId(null);

        if (!resp.ok) return toast.error(resp.error);
        toast.success('Soporte referenciado en la reserva');
        cargar();
    };

    const reservasActivas = useMemo(
        () => reservas
            .filter((r) => ESTADOS_ACTIVOS.includes(r.estado))
            .sort((a, b) => getReservaFechaInicioValue(a) - getReservaFechaInicioValue(b)),
        [reservas]
    );

    const reservasHistorial = useMemo(
        () => reservas.filter((r) => !ESTADOS_ACTIVOS.includes(r.estado)),
        [reservas]
    );

    const reservasHistorialFiltradas = useMemo(
        () => reservasHistorial.filter((r) => filtroHistorial === 'todos' || r.estado === filtroHistorial),
        [reservasHistorial, filtroHistorial]
    );

    const totalPaginasHistorial = Math.max(1, Math.ceil(reservasHistorialFiltradas.length / HISTORIAL_PAGE_SIZE));
    const paginaHistorialSegura = Math.min(paginaHistorial, totalPaginasHistorial);
    const reservasHistorialPagina = reservasHistorialFiltradas.slice(
        (paginaHistorialSegura - 1) * HISTORIAL_PAGE_SIZE,
        paginaHistorialSegura * HISTORIAL_PAGE_SIZE
    );
    const rangoHistorialInicio = reservasHistorialFiltradas.length === 0 ? 0 : ((paginaHistorialSegura - 1) * HISTORIAL_PAGE_SIZE) + 1;
    const rangoHistorialFin = Math.min(paginaHistorialSegura * HISTORIAL_PAGE_SIZE, reservasHistorialFiltradas.length);

    const bloqueoPreview = franjaSeleccionada?.estado === 'bloqueada';
    const estadoPostReserva = (reserva) => {
        if (reserva?.estado === 'finalizada') return 'Finalizada';
        if (reserva?.estado === 'no_show') return 'No asistió';
        if (reserva?.estado === 'cancelada') return 'Cancelada';
        if (reserva?.estado === 'en_curso') return 'En curso';
        if (reserva?.estado === 'aprobada') return 'Aprobada';
        return 'Pendiente de gestión';
    };

    const totalFranjasDisponibles = slotsDisponibles.length;
    const totalFranjasNoDisponibles = Math.max(0, franjasDisponibles.length - totalFranjasDisponibles);

    return (
        <div className="space-y-6">
            <div className="app-surface-primary p-5 text-app-text-primary overflow-hidden relative">
                <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-brand-primary/10 to-transparent pointer-events-none" />
                <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary font-semibold">Reservas de residente</p>
                        <h1 className="text-2xl md:text-3xl font-bold">Mis reservas</h1>
                        <p className="text-sm text-app-text-secondary max-w-2xl">
                            Crea solicitudes de zonas comunes, revisa su estado operativo y consulta tu historial sin perder contexto.
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 min-w-full sm:min-w-[24rem]">
                        <div className="app-surface-muted p-3 text-center">
                            <p className="text-xl font-bold text-brand-primary">{reservasActivas.length}</p>
                            <p className="text-[11px] text-app-text-secondary">Activas</p>
                        </div>
                        <div className="app-surface-muted p-3 text-center">
                            <p className="text-xl font-bold text-brand-primary">{reservasHistorial.length}</p>
                            <p className="text-[11px] text-app-text-secondary">Historial</p>
                        </div>
                        <div className="app-surface-muted p-3 text-center">
                            <p className="text-xl font-bold text-brand-primary">{recursos.length}</p>
                            <p className="text-[11px] text-app-text-secondary">Recursos</p>
                        </div>
                    </div>
                </div>
            </div>

            <ReservaErrorBanner message={errorGeneral} onRetry={cargar} />

            <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
                <ReservaCreateCard
                    form={form}
                    recursos={recursos}
                    loading={loadingCreate}
                    onChange={setFormField}
                    onSubmit={crear}
                    perfilMissing={!perfilResidente?.id}
                    bloqueoDetectado={bloqueoPreview}
                    disponibilidadLoading={loadingDisponibilidad}
                    slotsDisponibles={slotsDisponibles}
                    franjasDisponibles={franjasDisponibles}
                    franjaSeleccionadaId={form.franja_id}
                    disponibilidadConfig={disponibilidadConfig}
                    fallbackConfigAplicado={fallbackConfigAplicado}
                    mensajeDisponibilidad={mensajeDisponibilidad}
                    depositoConfig={depositoRecursoSeleccionado}
                    horarioInvalido={horarioInvalido}
                    horarioMensaje={mensajeHorario || 'Este horario no está disponible.'}
                    sugerencias={sugerenciasHorario}
                    onSeleccionarFranja={seleccionarFranja}
                    minFecha={getTodayBogotaDate()}
                    recursoSeleccionado={recursoSeleccionado}
                />

                <aside className="app-surface-primary p-4 space-y-3 xl:sticky xl:top-4 border border-brand-primary/20">
                    <div>
                        <h2 className="font-semibold text-app-text-primary">Resumen de disponibilidad</h2>
                        <p className="text-xs text-app-text-secondary">Se actualiza al seleccionar recurso y fecha.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="app-surface-muted p-3">
                            <p className="text-2xl font-bold text-emerald-600">{totalFranjasDisponibles}</p>
                            <p className="text-xs text-app-text-secondary">Franjas libres</p>
                        </div>
                        <div className="app-surface-muted p-3">
                            <p className="text-2xl font-bold text-amber-600">{totalFranjasNoDisponibles}</p>
                            <p className="text-xs text-app-text-secondary">No disponibles</p>
                        </div>
                    </div>
                    <div className="text-xs text-app-text-secondary space-y-1">
                        <p><span className="font-semibold text-app-text-primary">Recurso:</span> {recursoSeleccionado?.nombre || 'Sin seleccionar'}</p>
                        <p><span className="font-semibold text-app-text-primary">Fecha:</span> {form.fecha || 'Sin seleccionar'}</p>
                        <p><span className="font-semibold text-app-text-primary">Franja:</span> {franjaSeleccionada ? `${franjaSeleccionada.inicio} - ${franjaSeleccionada.fin}` : 'Sin seleccionar'}</p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                        Las reservas pueden quedar solicitadas o aprobadas automáticamente según la política configurada por administración para cada recurso.
                    </div>
                </aside>
            </div>

            <section className="app-surface-primary border border-brand-primary/20 overflow-hidden">
                <div className="border-b border-app-border/60 p-4 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-semibold">Seguimiento de reservas</h3>
                            <p className="text-xs text-app-text-secondary">Activas para acciones rápidas e historial paginado para consultas.</p>
                        </div>
                        {loadingReservas && <p className="text-xs text-app-text-secondary">Actualizando información...</p>}
                    </div>
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones de reservas">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={tabActiva === 'activas'}
                            className={`app-btn-ghost text-xs ${tabActiva === 'activas' ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30' : ''}`}
                            onClick={() => setTabActiva('activas')}
                        >
                            Activas ({reservasActivas.length})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={tabActiva === 'historial'}
                            className={`app-btn-ghost text-xs ${tabActiva === 'historial' ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30' : ''}`}
                            onClick={() => setTabActiva('historial')}
                        >
                            Historial ({reservasHistorial.length})
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-3">
                    {loadingReservas && reservas.length === 0 && <ReservaListSkeleton count={3} />}

                    {tabActiva === 'activas' && !loadingReservas && reservasActivas.length === 0 && (
                        <ReservaEmptyState
                            title="No tienes reservas activas"
                            description="Cuando crees una solicitud aparecerá aquí para seguimiento y acciones rápidas."
                            actionLabel="Crear una reserva"
                            onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        />
                    )}

                    {tabActiva === 'activas' && reservasActivas.length > 0 && (
                        <div className="space-y-3">
                            {reservasActivas.map((r) => (
                                <div key={r.id} className="space-y-2">
                                    <ReservaCard
                                        reserva={r}
                                        canCancel={['solicitada', 'aprobada'].includes(r.estado)}
                                        onCancel={cancelar}
                                        onAttach={adjuntarSoporte}
                                        uploading={subiendoSoporteId === r.id}
                                        timelineEnabled={TIMELINE_ENABLED}
                                        onToggleTimeline={(reservaId) => setTimelineOpenId((prev) => prev === reservaId ? null : reservaId)}
                                        timelineOpen={timelineOpenId === r.id}
                                        timelineItems={timelineByReserva[r.id] || []}
                                    />
                                    <div className="app-surface-muted p-2 grid md:grid-cols-3 gap-2 text-xs">
                                        <p><span className="text-app-text-secondary">Post-reserva:</span> {estadoPostReserva(r)}</p>
                                        <p><span className="text-app-text-secondary">Depósito:</span> {r.deposito_estado || r.metadata?.deposito_estado || 'Pendiente de política 7B'}</p>
                                        <p><span className="text-app-text-secondary">Causal:</span> {r.causal_economica || r.metadata?.causal_economica || 'Sin causal definida'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {tabActiva === 'historial' && (
                        <div className="space-y-3">
                            <div className="app-surface-muted p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-app-text-primary">Historial de reservas</p>
                                    <p className="text-xs text-app-text-secondary">Mostrando {rangoHistorialInicio}-{rangoHistorialFin} de {reservasHistorialFiltradas.length} reservas.</p>
                                </div>
                                <select
                                    className="app-input md:max-w-56"
                                    value={filtroHistorial}
                                    onChange={(e) => setFiltroHistorial(e.target.value)}
                                    aria-label="Filtrar historial por estado"
                                >
                                    {RESERVA_FILTERS.map((filter) => (
                                        <option key={filter.value} value={filter.value}>{filter.label}</option>
                                    ))}
                                </select>
                            </div>

                            {!loadingReservas && reservasHistorialFiltradas.length === 0 && (
                                <ReservaEmptyState
                                    title="Aún no tienes historial"
                                    description="Las reservas finalizadas, canceladas o rechazadas aparecerán en esta sección."
                                />
                            )}

                            <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1 app-scrollbar" aria-live="polite">
                                {reservasHistorialPagina.map((r) => (
                                    <div key={r.id} className="app-surface-muted p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium text-app-text-primary">{r.recursos_comunes?.nombre || 'Recurso común'}</p>
                                                <span className="text-[11px] text-app-text-secondary">{getReservaEstadoLabel(r.estado)}</span>
                                            </div>
                                            <p className="text-xs text-app-text-secondary">{formatDateRangeBogota(r.fecha_inicio, r.fecha_fin)}</p>
                                            <p className="text-xs text-app-text-secondary">
                                                Post-reserva: {estadoPostReserva(r)} · Depósito: {r.deposito_estado || r.metadata?.deposito_estado || 'Pendiente 7B'} · Causal: {r.causal_economica || r.metadata?.causal_economica || 'Sin causal'}
                                            </p>
                                        </div>
                                        <ReservaStatusBadge estado={r.estado} />
                                    </div>
                                ))}
                            </div>

                            <div className="pt-2 border-t border-app-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <p className="text-xs text-app-text-secondary">Página {paginaHistorialSegura} de {totalPaginasHistorial}</p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="app-btn-ghost text-xs disabled:opacity-40"
                                        onClick={() => setPaginaHistorial((prev) => Math.max(1, prev - 1))}
                                        disabled={paginaHistorialSegura === 1}
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        type="button"
                                        className="app-btn-ghost text-xs disabled:opacity-40"
                                        onClick={() => setPaginaHistorial((prev) => Math.min(totalPaginasHistorial, prev + 1))}
                                        disabled={paginaHistorialSegura === totalPaginasHistorial}
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
