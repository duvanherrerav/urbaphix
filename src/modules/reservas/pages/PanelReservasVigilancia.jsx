import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
    cambiarEstadoReserva,
    evaluarElegibilidadNoShow,
    listarReservas,
    subscribeReservasConjunto
} from '../services/reservasService';
import ReservaStatusBadge from '../components/shared/ReservaStatusBadge';
import { formatDateRangeBogota } from '../utils/dateTimeBogota';
import { getReservaResidenteLabel, getReservaTorreAptoLabel } from '../utils/reservaFormatters';

const HISTORIAL_PAGE_SIZE = 10;

export default function PanelReservasVigilancia({ usuarioApp }) {
    const [reservas, setReservas] = useState([]);
    const [filtroEstado, setFiltroEstado] = useState('operativas');
    const [expandedReservaId, setExpandedReservaId] = useState(null);
    const [paginaHistorial, setPaginaHistorial] = useState(1);
    const [loadingOperativas, setLoadingOperativas] = useState(false);
    const [loadingHistorial, setLoadingHistorial] = useState(false);
    const [hasNextHistorial, setHasNextHistorial] = useState(false);
    const [accionesLoading, setAccionesLoading] = useState({});
    const [highlightReservaId, setHighlightReservaId] = useState(null);

    const cargarOperativas = async () => {
        if (!usuarioApp?.conjunto_id) return;
        setLoadingOperativas(true);

        const resp = await listarReservas({
            conjunto_id: usuarioApp.conjunto_id,
            estados: ['aprobada', 'en_curso'],
            limit: 80
        });

        setLoadingOperativas(false);
        if (!resp.ok) return toast.error(resp.error);

        setReservas(resp.data || []);
        setHasNextHistorial(false);
    };

    const cargarHistorico = async (pagina) => {
        if (!usuarioApp?.conjunto_id) return;
        setLoadingHistorial(true);

        const offset = (pagina - 1) * HISTORIAL_PAGE_SIZE;
        const resp = await listarReservas({
            conjunto_id: usuarioApp.conjunto_id,
            estados: ['aprobada', 'en_curso', 'finalizada', 'no_show'],
            limit: HISTORIAL_PAGE_SIZE,
            offset
        });

        setLoadingHistorial(false);
        if (!resp.ok) return toast.error(resp.error);

        const data = resp.data || [];
        setReservas(data);
        setHasNextHistorial(data.length === HISTORIAL_PAGE_SIZE);
    };

    useEffect(() => {
        if (!usuarioApp?.conjunto_id) return;

        if (filtroEstado === 'operativas') {
            cargarOperativas();
            return;
        }

        cargarHistorico(paginaHistorial);
    }, [usuarioApp?.conjunto_id, filtroEstado, paginaHistorial]);

    useEffect(() => {
        if (!usuarioApp?.conjunto_id || filtroEstado !== 'operativas') return undefined;
        return subscribeReservasConjunto(usuarioApp.conjunto_id, () => cargarOperativas());
    }, [usuarioApp?.conjunto_id, filtroEstado]);

    const estadoLabel = (estado) => {
        if (estado === 'aprobada') return 'Lista para ingreso';
        if (estado === 'en_curso') return 'En uso';
        if (estado === 'finalizada') return 'Finalizada';
        if (estado === 'no_show') return 'No asistió';
        return estado;
    };

    const resumen = useMemo(() => ({
        operativas: reservas.filter((r) => ['aprobada', 'en_curso'].includes(r.estado)).length,
        finalizadas: reservas.filter((r) => r.estado === 'finalizada').length,
        noShow: reservas.filter((r) => r.estado === 'no_show').length
    }), [reservas]);

    const obtenerMensajeCargandoAccion = (estado) => {
        if (estado === 'en_curso') return 'Registrando ingreso...';
        if (estado === 'finalizada') return 'Registrando salida...';
        if (estado === 'no_show') return 'Marcando no asistencia...';
        return 'Actualizando reserva...';
    };

    const obtenerMensajeExitoAccion = (estado) => {
        if (estado === 'en_curso') return 'Ingreso registrado correctamente.';
        if (estado === 'finalizada') return 'Salida registrada correctamente.';
        if (estado === 'no_show') return 'Reserva marcada como No asistió.';
        return 'Reserva actualizada correctamente.';
    };

    const actualizar = async (id, estado, detalle) => {
        const accionKey = `${id}-${estado}`;
        if (accionesLoading[accionKey]) return;

        setAccionesLoading((prev) => ({ ...prev, [accionKey]: true }));
        const resp = await cambiarEstadoReserva({ reserva_id: id, estado, usuario_id: usuarioApp.id, usuario_rol: usuarioApp.rol_id, detalle });
        setAccionesLoading((prev) => ({ ...prev, [accionKey]: false }));

        if (!resp.ok) {
            toast.error('No se pudo actualizar la reserva. Intenta nuevamente.');
            return;
        }
        toast.success(obtenerMensajeExitoAccion(estado));
        setHighlightReservaId(id);
        setTimeout(() => setHighlightReservaId((prev) => (prev === id ? null : prev)), 1200);

        if (filtroEstado === 'operativas') {
            cargarOperativas();
            return;
        }

        cargarHistorico(paginaHistorial);
    };

    const cambiarVista = (vista) => {
        setFiltroEstado(vista);
        setExpandedReservaId(null);
        setPaginaHistorial(1);
        setHasNextHistorial(false);
    };

    const mostrarSinMasResultados = filtroEstado === 'historico' && paginaHistorial > 1 && !loadingHistorial && reservas.length === 0;
    const cargandoActual = filtroEstado === 'operativas' ? loadingOperativas : loadingHistorial;
    const inicioRangoHistorial = ((paginaHistorial - 1) * HISTORIAL_PAGE_SIZE) + 1;
    const finRangoHistorial = inicioRangoHistorial + Math.max(reservas.length - 1, 0);

    return (
        <div className="app-surface-primary rounded-2xl p-5 shadow space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold">Reservas operativas 🛡️</h2>
                    <p className="text-sm text-app-text-secondary">Vista de operación para registrar ingresos, salidas y no asistencia.</p>
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="filtro-reservas-vigilancia" className="text-xs text-app-text-secondary">Vista</label>
                    <select id="filtro-reservas-vigilancia" className="app-input max-w-56" value={filtroEstado} onChange={(e) => cambiarVista(e.target.value)}>
                        <option value="operativas">Operativas (atención inmediata)</option>
                        <option value="historico">Histórico corto (recientes)</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="app-surface-muted p-2"><span className="text-app-text-secondary">Operativas</span><p className="text-lg font-semibold">{resumen.operativas}</p></div>
                <div className="app-surface-muted p-2"><span className="text-app-text-secondary">Finalizadas</span><p className="text-lg font-semibold text-state-success">{resumen.finalizadas}</p></div>
                <div className="app-surface-muted p-2"><span className="text-app-text-secondary">No asistió</span><p className="text-lg font-semibold text-state-warning">{resumen.noShow}</p></div>
            </div>

            {cargandoActual && <p className="text-sm text-app-text-secondary">Cargando reservas...</p>}

            {reservas.map((r) => {
                const evaluacionNoShow = evaluarElegibilidadNoShow(r);
                const detalleExpandido = expandedReservaId === r.id;
                const cargandoIngreso = Boolean(accionesLoading[`${r.id}-en_curso`]);
                const cargandoSalida = Boolean(accionesLoading[`${r.id}-finalizada`]);
                const cargandoNoShow = Boolean(accionesLoading[`${r.id}-no_show`]);

                return (
                    <article
                        key={r.id}
                        className={`app-surface-muted p-4 border space-y-3 rounded-xl transition-all duration-300 ${
                            highlightReservaId === r.id
                                ? 'border-state-info shadow-[0_0_0_2px_rgba(59,130,246,0.25)]'
                                : 'border-app-border/70'
                        }`}
                    >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                                <p className="text-lg font-semibold leading-tight">{r.recursos_comunes?.nombre || 'Recurso'}</p>
                                <p className="text-sm text-app-text-secondary mt-1">{formatDateRangeBogota(r.fecha_inicio, r.fecha_fin)}</p>
                                <p className="text-sm mt-1">{getReservaResidenteLabel(r)}</p>
                                <p className="text-sm text-app-text-secondary">{getReservaTorreAptoLabel(r)}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <ReservaStatusBadge estado={r.estado} labelOverride={estadoLabel(r.estado)} />
                            </div>
                        </div>

                        {r.estado === 'aprobada' && (
                            <div className="flex flex-wrap gap-2">
                                <button
                                    title="Registrar entrada del residente"
                                    className="app-btn-primary text-xs disabled:opacity-50 min-w-[12.5rem] justify-center"
                                    onClick={() => actualizar(r.id, 'en_curso', 'Check-in por vigilancia')}
                                    disabled={cargandoIngreso}
                                >
                                    {cargandoIngreso ? obtenerMensajeCargandoAccion('en_curso') : 'Registrar ingreso'}
                                </button>
                                <button
                                    title={evaluacionNoShow.elegible ? 'Marcar que el residente no llegó' : 'Disponible después de 15 minutos de la hora de inicio'}
                                    className="app-btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed min-w-[12.5rem] justify-center"
                                    disabled={!evaluacionNoShow.elegible || cargandoNoShow}
                                    onClick={() => {
                                        const confirmar = window.confirm('¿Confirmas marcar esta reserva como No asistió? Esta acción afecta el historial operativo.');
                                        if (!confirmar) return;
                                        actualizar(r.id, 'no_show', 'Marcada como no asistió por vigilancia');
                                    }}
                                >
                                    {cargandoNoShow ? obtenerMensajeCargandoAccion('no_show') : 'No asistió'}
                                </button>
                                {!evaluacionNoShow.elegible && <p className="w-full text-xs text-app-text-secondary">{evaluacionNoShow.motivo}</p>}
                            </div>
                        )}

                        {r.estado === 'en_curso' && (
                            <button
                                title="Finalizar uso de la reserva"
                                className="app-btn-primary text-xs disabled:opacity-50 min-w-[12.5rem] justify-center"
                                onClick={() => {
                                    const confirmar = window.confirm('¿Confirmas registrar la salida y finalizar esta reserva?');
                                    if (!confirmar) return;
                                    actualizar(r.id, 'finalizada', 'Check-out por vigilancia');
                                }}
                                disabled={cargandoSalida}
                            >
                                {cargandoSalida ? obtenerMensajeCargandoAccion('finalizada') : 'Registrar salida'}
                            </button>
                        )}

                        <div className="pt-1">
                            <button className="text-xs text-app-text-secondary hover:text-app-text-primary transition-all duration-200" onClick={() => setExpandedReservaId(detalleExpandido ? null : r.id)}>
                                {detalleExpandido ? '▼ Ocultar detalle' : '▶ Ver detalle'}
                            </button>
                        </div>

                        {detalleExpandido && (
                            <div className="grid md:grid-cols-2 gap-2 text-xs app-surface-primary p-3 rounded-lg border border-app-border/50">
                                <div>
                                    <p className="text-app-text-secondary">Depósito</p>
                                    <p>{r.deposito_estado || r.metadata?.deposito_estado || 'Sin información registrada'}</p>
                                </div>
                                <div>
                                    <p className="text-app-text-secondary">Causal económica</p>
                                    <p>{r.causal_economica || r.metadata?.causal_economica || 'Sin información registrada'}</p>
                                </div>
                            </div>
                        )}
                    </article>
                );
            })}

            {!cargandoActual && reservas.length === 0 && (
                <p className="text-sm text-app-text-secondary">
                    {filtroEstado === 'operativas'
                        ? 'No hay reservas pendientes de atención en este momento.'
                        : mostrarSinMasResultados
                            ? 'No hay más reservas para mostrar.'
                            : 'No hay reservas en el historial para este rango.'}
                </p>
            )}

            {filtroEstado === 'historico' && (
                <div className="pt-2 border-t border-app-border/50 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs text-app-text-secondary">Página {paginaHistorial}</p>
                        <p className="text-xs text-app-text-secondary">
                            {reservas.length > 0 ? `Mostrando ${inicioRangoHistorial}–${finRangoHistorial} resultados` : 'Mostrando 0 resultados'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="app-btn-secondary text-xs disabled:opacity-50"
                            onClick={() => setPaginaHistorial((prev) => Math.max(1, prev - 1))}
                            disabled={loadingHistorial || paginaHistorial === 1}
                        >
                            Anterior
                        </button>
                        <button
                            className="app-btn-secondary text-xs disabled:opacity-50"
                            onClick={() => setPaginaHistorial((prev) => prev + 1)}
                            disabled={loadingHistorial || !hasNextHistorial}
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
