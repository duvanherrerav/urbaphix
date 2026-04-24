import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { entregarPaquete as entregarPaqueteService, listarPaquetesConDetalle } from '../services/paquetesService';

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

export default function PanelPaquetes({ usuarioApp }) {
  const [paquetes, setPaquetes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('pendiente');
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(false);

  const obtenerPaquetes = async () => {
    if (!usuarioApp?.conjunto_id) return;
    setLoading(true);
    const result = await listarPaquetesConDetalle({ conjunto_id: usuarioApp.conjunto_id, estado: filtroEstado, busqueda });
    setLoading(false);

    if (!result.ok) return toast.error(result.error || 'No se pudo cargar paquetería');
    setPaquetes(result.data || []);
  };

  useEffect(() => { obtenerPaquetes(); }, [usuarioApp?.conjunto_id, filtroEstado]);
  useEffect(() => {
    if (!usuarioApp?.conjunto_id) return undefined;

    const channel = supabase
      .channel(`paqueteria-panel-${usuarioApp.conjunto_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paquetes', filter: `conjunto_id=eq.${usuarioApp.conjunto_id}` }, () => obtenerPaquetes())
      .subscribe();

    const onChanged = () => obtenerPaquetes();
    window.addEventListener('paqueteria:changed', onChanged);

    return () => {
      window.removeEventListener('paqueteria:changed', onChanged);
      supabase.removeChannel(channel);
    };
  }, [usuarioApp?.conjunto_id, filtroEstado, busqueda]);

  const entregables = useMemo(() => paquetes.filter((p) => p.estado === 'pendiente'), [paquetes]);
  const entregados = useMemo(() => paquetes.filter((p) => p.estado === 'entregado'), [paquetes]);
  const serviciosPendientes = useMemo(() => entregables.filter((p) => p.categoria === 'servicio_publico').length, [entregables]);

  const entregarPaquete = async (paquete) => {
    const confirmar = window.confirm(paquete.categoria === 'servicio_publico' ? `¿Confirmar entrega del servicio público "${paquete.descripcion_visible}"?` : `¿Confirmar entrega del paquete "${paquete.descripcion_visible}"?`);
    if (!confirmar) return;

    const result = await entregarPaqueteService(paquete.id);
    if (!result.ok) return toast.error(`No se pudo entregar: ${result.error}`);

    toast.success(paquete.categoria === 'servicio_publico' ? 'Servicio público entregado al residente' : 'Paquete entregado');
    window.dispatchEvent(new CustomEvent('paqueteria:changed', { detail: { action: 'delivered', paqueteId: paquete.id } }));
    obtenerPaquetes();
  };

  return (
    <div className="app-surface-primary rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Panel de paquetería 📬</h2>
          <p className="text-sm text-app-text-secondary">Operación por estado, búsqueda y confirmación de entrega.</p>
        </div>
        <div className="app-surface-muted text-sm border border-brand-primary/20">
          <p><b>Pendientes:</b> {entregables.length}</p>
          <p><b>Servicios públicos:</b> {serviciosPendientes}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={`app-btn text-xs ${filtroEstado === 'pendiente' ? 'app-btn-secondary' : 'app-btn-ghost'}`} onClick={() => setFiltroEstado('pendiente')}>Pendientes</button>
        <button className={`app-btn text-xs ${filtroEstado === 'entregado' ? 'app-btn-secondary' : 'app-btn-ghost'}`} onClick={() => setFiltroEstado('entregado')}>Entregados</button>
        <button className={`app-btn text-xs ${filtroEstado === 'todos' ? 'app-btn-primary' : 'app-btn-ghost'}`} onClick={() => setFiltroEstado('todos')}>Todos</button>
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-2">
        <input className="app-input" placeholder="Buscar por descripción, torre o apartamento" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <button className="app-btn-ghost" onClick={obtenerPaquetes}>Buscar</button>
      </div>

      {loading && <p className="text-sm text-app-text-secondary">Cargando paquetería...</p>}
      {!loading && paquetes.length === 0 && <p className="text-sm text-app-text-secondary">No hay registros para este filtro.</p>}

      <div className="space-y-4">
        {(filtroEstado === 'pendiente' || filtroEstado === 'todos') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-state-warning">Recepción pendiente de entrega</h3>
              <span className="text-xs text-app-text-secondary">{entregables.length}</span>
            </div>
            {entregables.map((p) => (
              <div key={p.id} className="app-surface-muted p-3 border border-state-warning/30">
                <div className="grid md:grid-cols-[1fr_auto] gap-2 items-start">
                  <div>
                    <p className="font-medium">{p.descripcion_visible || 'Sin descripción'}</p>
                    <p className="text-xs text-app-text-secondary">Torre <b>{p.torre_nombre || '-'}</b> · Apto <b>{p.apartamento_numero || '-'}</b> · Recibido {formatDateTime(p.fecha_recibido)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`app-badge ${p.categoria === 'servicio_publico' ? 'app-badge-info' : 'app-badge-success'}`}>{p.categoria === 'servicio_publico' ? 'Servicio público' : 'Paquete'}</span>
                    <button className="app-btn-primary text-xs" onClick={() => entregarPaquete(p)}>Marcar entregado</button>
                  </div>
                </div>
              </div>
            ))}
            {entregables.length === 0 && <p className="text-xs text-app-text-secondary">No hay paquetes pendientes.</p>}
          </div>
        )}

        {(filtroEstado === 'entregado' || filtroEstado === 'todos') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-state-success">Entregas confirmadas</h3>
              <span className="text-xs text-app-text-secondary">{entregados.length}</span>
            </div>
            {entregados.map((p) => (
              <div key={p.id} className="app-surface-muted p-3 border border-state-success/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.descripcion_visible || 'Sin descripción'}</p>
                    <p className="text-xs text-app-text-secondary">Torre <b>{p.torre_nombre || '-'}</b> · Apto <b>{p.apartamento_numero || '-'}</b></p>
                    <p className="text-xs text-app-text-secondary">Recibido {formatDateTime(p.fecha_recibido)} · Entregado {formatDateTime(p.fecha_entrega)}</p>
                  </div>
                  <span className={`app-badge ${p.categoria === 'servicio_publico' ? 'app-badge-info' : 'app-badge-success'}`}>{p.categoria === 'servicio_publico' ? 'Servicio público' : 'Paquete'}</span>
                </div>
              </div>
            ))}
            {entregados.length === 0 && <p className="text-xs text-app-text-secondary">No hay entregas en este filtro.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
