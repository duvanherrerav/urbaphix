import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ReservaCreateCard from '../components/residente/ReservaCreateCard';
import ReservaCard from '../components/residente/ReservaCard';
import ReservaEmptyState from '../components/residente/ReservaEmptyState';
import ReservaErrorBanner from '../components/residente/ReservaErrorBanner';
import ReservaStatusBadge from '../components/shared/ReservaStatusBadge';
import { formatDateRangeBogota, getNowBogotaTimeHHMM, getTodayBogotaDate } from '../utils/dateTimeBogota';
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
const TIMELINE_ENABLED = false;

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
        };

        cargarDisponibilidad();
    }, [usuarioApp?.conjunto_id, form.recurso_id, form.fecha]);

    const franjaSeleccionada = useMemo(
        () => franjasDisponibles.find((f) => f.id === form.franja_id) || null,
        [franjasDisponibles, form.franja_id]
    );
    const depositoRecursoSeleccionado = useMemo(() => {
        const recurso = recursos.find((r) => r.id === form.recurso_id);
        if (!recurso) return null;
        return {
            requiere: recurso.requiere_deposito === true,
            valor: recurso.deposito_valor,
            tipo: recurso.reglas?.deposito?.tipo || null,
            observacion: recurso.reglas?.deposito?.observacion || null
        };
    }, [recursos, form.recurso_id]);

    const crear = async () => {
        if (!perfilResidente?.id) return toast.error('No se encontró tu perfil de residente');
        if (!form.recurso_id || !form.fecha || !form.franja_id) return toast.error('Completa recurso, fecha y franja');
        if (form.fecha < getTodayBogotaDate()) return toast.error('No puedes reservar fechas pasadas');
        if (!franjaSeleccionada) return toast.error('Selecciona una franja válida');
        if (!franjaSeleccionada.seleccionable) {
            setHorarioInvalido(true);
            setMensajeHorario('Esta franja ya no está disponible.');
            return toast.error('La franja seleccionada no está disponible');
        }

        if (form.fecha === getTodayBogotaDate()) {
            const ahora = getNowBogotaTimeHHMM();
            if (franjaSeleccionada.inicio < ahora) {
                setHorarioInvalido(true);
                setMensajeHorario('Parte de la franja ya pasó. Selecciona un horario futuro para hoy.');
                return toast.error('No puedes reservar una hora pasada para hoy');
            }
        }

        setHorarioInvalido(false);
        setMensajeHorario('');
        setSugerenciasHorario([]);

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
                recurso_tipo: recursos.find((r) => r.id === form.recurso_id)?.tipo || null,
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
        () => reservas.filter((r) => ESTADOS_ACTIVOS.includes(r.estado)),
        [reservas]
    );

    const reservasHistorial = useMemo(
        () => reservas.filter((r) => !ESTADOS_ACTIVOS.includes(r.estado)).slice(0, 5),
        [reservas]
    );

    const bloqueoPreview = franjaSeleccionada?.estado === 'bloqueada';

    return (
        <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow">
                <h1 className="text-2xl font-bold">Mis reservas</h1>
                <p className="text-sm text-blue-100">Gestiona tus solicitudes de zonas comunes de forma simple y clara.</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="bg-app-bg-alt/20 px-2 py-1 rounded-full">Activas: {reservasActivas.length}</span>
                    <span className="bg-app-bg-alt/20 px-2 py-1 rounded-full">Historial: {reservasHistorial.length}</span>
                    <span className="bg-app-bg-alt/20 px-2 py-1 rounded-full">Recursos: {recursos.length}</span>
                </div>
            </div>

            <ReservaErrorBanner message={errorGeneral} onRetry={cargar} />

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
            />

            <section className="bg-app-bg-alt rounded-2xl p-5 shadow space-y-3 border border-app-border">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">Mis reservas activas ({reservasActivas.length})</h3>
                    {loadingReservas && <p className="text-xs text-app-text-secondary">Actualizando...</p>}
                </div>

                {reservasActivas.length === 0 && (
                    <ReservaEmptyState
                        title="No tienes reservas activas"
                        description="Cuando crees una solicitud aparecerá aquí para seguimiento y acciones rápidas."
                        actionLabel="Crear una reserva"
                        onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    />
                )}

                <div className="space-y-3">
                    {reservasActivas.map((r) => (
                        <ReservaCard
                            key={r.id}
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
                    ))}
                </div>
            </section>

            <section className="bg-app-bg-alt rounded-2xl p-5 shadow space-y-3 border border-app-border">
                <h3 className="text-lg font-semibold">Historial reciente</h3>

                {reservasHistorial.length === 0 && (
                    <ReservaEmptyState
                        title="Aún no tienes historial"
                        description="Las reservas finalizadas, canceladas o rechazadas aparecerán en esta sección."
                    />
                )}

                <div className="space-y-2">
                    {reservasHistorial.map((r) => (
                        <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                            <div>
                                <p className="font-medium">{r.recursos_comunes?.nombre || 'Recurso común'}</p>
                                <p className="text-xs text-app-text-secondary">{formatDateRangeBogota(r.fecha_inicio, r.fecha_fin)}</p>
                            </div>
                            <ReservaStatusBadge estado={r.estado} />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
