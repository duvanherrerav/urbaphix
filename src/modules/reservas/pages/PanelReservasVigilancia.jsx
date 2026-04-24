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

export default function PanelReservasVigilancia({ usuarioApp }) {
  const [reservas, setReservas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('operativas');

  const cargar = async () => {
    if (!usuarioApp?.conjunto_id) return;

    const estados = filtroEstado === 'operativas'
      ? ['aprobada', 'en_curso']
      : ['aprobada', 'en_curso', 'finalizada', 'no_show'];

    const resp = await listarReservas({ conjunto_id: usuarioApp.conjunto_id, estados, limit: 250 });
    if (!resp.ok) return toast.error(resp.error);
    setReservas(resp.data || []);
  };

  useEffect(() => { cargar(); }, [usuarioApp?.conjunto_id, filtroEstado]);
  useEffect(() => {
    if (!usuarioApp?.conjunto_id) return undefined;
    return subscribeReservasConjunto(usuarioApp.conjunto_id, () => cargar());
  }, [usuarioApp?.conjunto_id, filtroEstado]);

  const estadoLabel = (estado) => (estado === 'no_show' ? 'No asistió' : estado);
  const estadoPostReserva = (estado) => {
    if (estado === 'finalizada') return 'Cierre operativo';
    if (estado === 'no_show') return 'No asistió';
    if (estado === 'en_curso') return 'En curso';
    if (estado === 'aprobada') return 'Lista para check-in';
    return 'Pendiente';
  };
  const resumen = useMemo(() => ({
    operativas: reservas.filter((r) => ['aprobada', 'en_curso'].includes(r.estado)).length,
    finalizadas: reservas.filter((r) => r.estado === 'finalizada').length,
    noShow: reservas.filter((r) => r.estado === 'no_show').length
  }), [reservas]);

  const actualizar = async (id, estado, detalle) => {
    const resp = await cambiarEstadoReserva({ reserva_id: id, estado, usuario_id: usuarioApp.id, usuario_rol: usuarioApp.rol_id, detalle });
    if (!resp.ok) return toast.error(resp.error);
    toast.success(`Reserva ${estadoLabel(estado)}`);
    cargar();
  };

  return (
    <div className="app-surface-primary rounded-2xl p-5 shadow space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Reservas operativas 🛡️</h2>
          <p className="text-sm text-app-text-secondary">Control de check-in, check-out y no show desde vigilancia.</p>
        </div>
        <select className="app-input max-w-56" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="operativas">Operativas</option>
          <option value="historico">Histórico corto</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="app-surface-muted"><span className="text-app-text-secondary">Operativas</span><p className="text-lg font-semibold">{resumen.operativas}</p></div>
        <div className="app-surface-muted"><span className="text-app-text-secondary">Finalizadas</span><p className="text-lg font-semibold text-state-success">{resumen.finalizadas}</p></div>
        <div className="app-surface-muted"><span className="text-app-text-secondary">No show</span><p className="text-lg font-semibold text-state-warning">{resumen.noShow}</p></div>
      </div>

      {reservas.map((r) => {
        const evaluacionNoShow = evaluarElegibilidadNoShow(r);
        return (
          <div key={r.id} className="app-surface-muted p-4 border border-app-border/70 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{r.recursos_comunes?.nombre || 'Recurso'}</p>
              <ReservaStatusBadge estado={r.estado} />
            </div>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <p className="text-app-text-secondary">{formatDateRangeBogota(r.fecha_inicio, r.fecha_fin)}</p>
              <p className="text-app-text-secondary md:text-right">Residente ID: {r.residente_id}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-2 text-xs">
              <div className="app-surface-primary p-2">
                <p className="text-app-text-secondary">Post-reserva</p>
                <p>{estadoPostReserva(r.estado)}</p>
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

            {r.estado === 'aprobada' && (
              <div className="flex flex-wrap gap-2">
                <button className="app-btn-primary text-xs" onClick={() => actualizar(r.id, 'en_curso', 'Check-in por vigilancia')}>Check-in</button>
                <button className="app-btn-secondary text-xs disabled:opacity-50" disabled={!evaluacionNoShow.elegible} onClick={() => actualizar(r.id, 'no_show', 'Marcada como no asistió por vigilancia')}>Marcar no asistió</button>
                {!evaluacionNoShow.elegible && <p className="w-full text-xs text-app-text-secondary">{evaluacionNoShow.motivo}</p>}
              </div>
            )}

            {r.estado === 'en_curso' && <button className="app-btn-secondary text-xs" onClick={() => actualizar(r.id, 'finalizada', 'Check-out por vigilancia')}>Check-out</button>}
          </div>
        );
      })}

      {reservas.length === 0 && <p className="text-sm text-app-text-secondary">No hay reservas en operación.</p>}
    </div>
  );
}
