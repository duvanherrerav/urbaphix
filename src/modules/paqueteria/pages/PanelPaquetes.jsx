import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { entregarPaquete as entregarPaqueteService, listarPaquetesConDetalle } from '../services/paquetesService';

const ITEMS_POR_PAGINA = 10;
const ENTREGADOS_RECIENTES = 3;

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const formatearUbicacion = (torre, apto) => {
  if (!torre || !apto) return 'Ubicación no disponible';
  return `Torre y Apto: ${torre}${apto}`;
};

export default function PanelPaquetes({ usuarioApp }) {
  const [paquetes, setPaquetes] = useState([]);
  const [entregadosRecientes, setEntregadosRecientes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('pendiente');
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(false);
  const [paginaPendientes, setPaginaPendientes] = useState(1);
  const [paginaEntregados, setPaginaEntregados] = useState(1);

  const obtenerPaquetes = async () => {
    if (!usuarioApp?.conjunto_id) return;
    setLoading(true);
    const [result, recientesResult] = await Promise.all([
      listarPaquetesConDetalle({ conjunto_id: usuarioApp.conjunto_id, estado: filtroEstado, busqueda }),
      listarPaquetesConDetalle({ conjunto_id: usuarioApp.conjunto_id, estado: 'entregado', busqueda: '' })
    ]);
    setLoading(false);

    if (!result.ok) return toast.error(result.error || 'No se pudo cargar paquetería');
    if (!recientesResult.ok) return toast.error(recientesResult.error || 'No se pudieron cargar entregados recientes');
    setPaquetes(result.data || []);
    setEntregadosRecientes((recientesResult.data || []).slice(0, ENTREGADOS_RECIENTES));
  };

  useEffect(() => {
    setPaginaPendientes(1);
    setPaginaEntregados(1);
  }, [filtroEstado, busqueda]);

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

  const paginar = (registros, pagina) => {
    const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
    return registros.slice(inicio, inicio + ITEMS_POR_PAGINA);
  };

  const totalPaginasPendientes = Math.max(1, Math.ceil(entregables.length / ITEMS_POR_PAGINA));
  const totalPaginasEntregados = Math.max(1, Math.ceil(entregados.length / ITEMS_POR_PAGINA));
  const entregablesPaginados = paginar(entregables, paginaPendientes);
  const entregadosPaginados = paginar(entregados, paginaEntregados);

  const entregarPaquete = async (paquete) => {
    const confirmar = window.confirm(paquete.categoria === 'servicio_publico' ? `¿Confirmar entrega del servicio público "${paquete.descripcion_visible}"?` : `¿Confirmar entrega del paquete "${paquete.descripcion_visible}"?`);
    if (!confirmar) return;

    const result = await entregarPaqueteService(paquete.id);
    if (!result.ok) return toast.error(`No se pudo entregar: ${result.error}`);

    toast.success(paquete.categoria === 'servicio_publico' ? 'Servicio público entregado al residente' : 'Paquete entregado');
    window.dispatchEvent(new CustomEvent('paqueteria:changed', { detail: { action: 'delivered', paqueteId: paquete.id } }));
    obtenerPaquetes();
  };

  const renderPaginacion = ({ total, pagina, setPagina, totalPaginas }) => {
    if (total === 0) return null;
    const inicio = (pagina - 1) * ITEMS_POR_PAGINA + 1;
    const fin = Math.min(pagina * ITEMS_POR_PAGINA, total);
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-xs text-app-text-secondary">Mostrando {inicio}–{fin} de {total} paquetes</p>
        <div className="flex items-center gap-2">
          <button className="app-btn-ghost text-xs" onClick={() => setPagina((prev) => Math.max(1, prev - 1))} disabled={pagina === 1}>Anterior</button>
          <span className="text-xs text-app-text-secondary">Página {pagina} de {totalPaginas}</span>
          <button className="app-btn-ghost text-xs" onClick={() => setPagina((prev) => Math.min(totalPaginas, prev + 1))} disabled={pagina === totalPaginas}>Siguiente</button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-surface-primary rounded-2xl p-4 space-y-4 border border-brand-primary/10">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-primary/10 pb-3">
        <div>
          <h2 className="text-lg font-semibold">Panel de paquetería 📬</h2>
          <p className="text-xs text-app-text-secondary">Centro operativo para entrega por estado y ubicación.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="app-surface-muted border border-brand-primary/20 px-3 py-2 rounded-lg"><b>Pendientes:</b> {entregables.length}</div>
          <div className="app-surface-muted border border-brand-primary/20 px-3 py-2 rounded-lg"><b>Serv. públicos:</b> {serviciosPendientes}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button className={`app-btn text-xs ${filtroEstado === 'pendiente' ? 'app-btn-secondary' : 'app-btn-ghost'}`} onClick={() => setFiltroEstado('pendiente')}>Pendientes</button>
          <button className={`app-btn text-xs ${filtroEstado === 'entregado' ? 'app-btn-secondary' : 'app-btn-ghost'}`} onClick={() => setFiltroEstado('entregado')}>Entregados</button>
          <button className={`app-btn text-xs ${filtroEstado === 'todos' ? 'app-btn-primary' : 'app-btn-ghost'}`} onClick={() => setFiltroEstado('todos')}>Todos</button>
        </div>

        <div className="grid md:grid-cols-[1fr_auto] gap-2">
          <input className="app-input" placeholder="Buscar por descripción, torre o apartamento" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <button className="app-btn-ghost" onClick={obtenerPaquetes}>Buscar</button>
        </div>
      </div>

      {loading && <p className="text-sm text-app-text-secondary">Cargando paquetería...</p>}
      {!loading && paquetes.length === 0 && <p className="text-sm text-app-text-secondary">No hay registros para este filtro.</p>}

      {(filtroEstado === 'pendiente' || filtroEstado === 'todos') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-state-warning">Recepción pendiente de entrega</h3>
            <span className="text-xs text-app-text-secondary">{entregables.length}</span>
          </div>
          {entregablesPaginados.map((p) => (
            <div key={p.id} className="app-surface-muted p-3 border border-state-warning/30 rounded-xl space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-sm">{p.descripcion_visible || 'Sin descripción'}</p>
                <span className={`app-badge text-xs ${p.categoria === 'servicio_publico' ? 'app-badge-info' : 'app-badge-success'}`}>{p.categoria === 'servicio_publico' ? 'Servicio público' : 'Paquete'}</span>
              </div>
              <span className="app-badge app-badge-ghost text-xs">{formatearUbicacion(p.torre_nombre, p.apartamento_numero)}</span>
              <p className="text-xs text-app-text-secondary">Recibido: {formatDateTime(p.fecha_recibido)}</p>
              <div className="flex justify-end">
                <button className="app-btn-primary text-xs" onClick={() => entregarPaquete(p)}>Marcar entregado</button>
              </div>
            </div>
          ))}
          {entregables.length === 0 && <p className="text-xs text-app-text-secondary">No hay paquetes pendientes.</p>}
          {renderPaginacion({ total: entregables.length, pagina: paginaPendientes, setPagina: setPaginaPendientes, totalPaginas: totalPaginasPendientes })}
        </div>
      )}

      {(filtroEstado === 'pendiente' || filtroEstado === 'todos') && (
        <div className="space-y-2 border-t border-brand-primary/10 pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-state-success">Entregados recientes</h3>
            {entregadosRecientes.length >= ENTREGADOS_RECIENTES && (
              <button className="app-btn-ghost text-xs" onClick={() => setFiltroEstado('entregado')}>Ver historial completo</button>
            )}
          </div>
          {entregadosRecientes.map((p) => (
            <div key={p.id} className="app-surface-muted p-3 border border-state-success/20 rounded-xl space-y-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-sm">{p.descripcion_visible || 'Sin descripción'}</p>
                <span className="text-[11px] text-app-text-secondary">{formatDateTime(p.fecha_entrega)}</span>
              </div>
              <p className="text-xs text-app-text-secondary">{formatearUbicacion(p.torre_nombre, p.apartamento_numero)}</p>
            </div>
          ))}
          {entregadosRecientes.length === 0 && <p className="text-xs text-app-text-secondary">Aún no hay entregas recientes.</p>}
        </div>
      )}

      {(filtroEstado === 'entregado' || filtroEstado === 'todos') && (
        <div className="space-y-2 border-t border-brand-primary/10 pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-state-success">Historial de entregas</h3>
            <span className="text-xs text-app-text-secondary">{entregados.length}</span>
          </div>
          {entregadosPaginados.map((p) => (
            <div key={p.id} className="app-surface-muted p-3 border border-state-success/20 rounded-xl space-y-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-sm">{p.descripcion_visible || 'Sin descripción'}</p>
                <span className={`app-badge text-xs ${p.categoria === 'servicio_publico' ? 'app-badge-info' : 'app-badge-success'}`}>{p.categoria === 'servicio_publico' ? 'Servicio público' : 'Paquete'}</span>
              </div>
              <p className="text-xs text-app-text-secondary">{formatearUbicacion(p.torre_nombre, p.apartamento_numero)}</p>
              <p className="text-xs text-app-text-secondary">Recibido: {formatDateTime(p.fecha_recibido)}</p>
              <p className="text-xs text-app-text-secondary">Entregado: {formatDateTime(p.fecha_entrega)}</p>
            </div>
          ))}
          {entregados.length === 0 && <p className="text-xs text-app-text-secondary">No hay entregas en este filtro.</p>}
          {renderPaginacion({ total: entregados.length, pagina: paginaEntregados, setPagina: setPaginaEntregados, totalPaginas: totalPaginasEntregados })}
        </div>
      )}
    </div>
  );
}
