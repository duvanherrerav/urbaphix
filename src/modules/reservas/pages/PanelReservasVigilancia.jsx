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

    const actualizar = async (id, estado, detalle) => {
        const resp = await cambiarEstadoReserva({ reserva_id: id, estado, usuario_id: usuarioApp.id, usuario_rol: usuarioApp.rol_id, detalle });
        if (!resp.ok) return toast.error(resp.error);
        toast.success(`Reserva ${estadoLabel(estado).toLowerCase()}`);

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

            {!cargandoActual && reservas.map((r) => {
                const evaluacionNoShow = evaluarElegibilidadNoShow(r);
                const detalleExpandido = expandedReservaId === r.id;

                return (
                    <article key={r.id} className="app-surface-muted p-4 border border-app-border/70 space-y-3 rounded-xl">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                                <p className="text-lg font-semibold leading-tight">{r.recursos_comunes?.nombre || 'Recurso'}</p>
                                <p className="text-sm text-app-text-secondary mt-1">{formatDateRangeBogota(r.fecha_inicio, r.fecha_fin)}</p>
                                <p className="text-sm mt-1">{getReservaResidenteLabel(r)}</p>
                                <p className="text-sm text-app-text-secondary">{getReservaTorreAptoLabel(r)}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <ReservaStatusBadge estado={r.estado} />
                                <span className="text-xs app-surface-primary px-2 py-1 rounded-md">Estado operativo: {estadoLabel(r.estado)}</span>
                            </div>
                        </div>

                        {r.estado === 'aprobada' && (
                            <div className="flex flex-wrap gap-2">
                                <button className="app-btn-primary text-xs" onClick={() => actualizar(r.id, 'en_curso', 'Check-in por vigilancia')}>Registrar ingreso</button>
                                <button className="app-btn-secondary text-xs disabled:opacity-50" disabled={!evaluacionNoShow.elegible} onClick={() => actualizar(r.id, 'no_show', 'Marcada como no asistió por vigilancia')}>No asistió</button>
                                {!evaluacionNoShow.elegible && <p className="w-full text-xs text-app-text-secondary">{evaluacionNoShow.motivo}</p>}
                            </div>
                        )}

                        {r.estado === 'en_curso' && <button className="app-btn-primary text-xs" onClick={() => actualizar(r.id, 'finalizada', 'Check-out por vigilancia')}>Registrar salida</button>}

                        <div className="pt-1">
                            <button className="text-xs underline text-app-text-secondary hover:text-app-text-primary" onClick={() => setExpandedReservaId(detalleExpandido ? null : r.id)}>
                                {detalleExpandido ? 'Ocultar detalle' : 'Ver detalle'}
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
                            : 'No hay reservas recientes para mostrar.'}
                </p>
            )}

            {filtroEstado === 'historico' && (
                <div className="pt-2 border-t border-app-border/50 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-app-text-secondary">Página {paginaHistorial}</p>
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
