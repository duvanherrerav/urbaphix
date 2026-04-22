import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { parsearCategoriaDesdeDescripcion } from '../services/paquetesService';

export default function MisPaquetes({ usuarioApp }) {
  const PAGE_SIZE = 8;
  const [paquetes, setPaquetes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);

  const obtenerPaquetes = async (usuarioId) => {
    if (!usuarioId) return;
    setLoading(true);

    const { data: residentesRows } = await supabase
      .from('residentes')
      .select('*')
      .eq('usuario_id', usuarioId)
      .limit(1);
    const residente = residentesRows?.[0] || null;

    if (!residente) {
      setPaquetes([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('paquetes')
      .select('*')
      .eq('residente_id', residente.id)
      .order('fecha_recibido', { ascending: false });

    setPaquetes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!usuarioApp?.id) return;
    obtenerPaquetes(usuarioApp.id);
  }, [usuarioApp?.id]);

  useEffect(() => {
    if (!usuarioApp?.id) return undefined;

    let channel = null;
    const init = async () => {
      const { data: residentesRows } = await supabase
        .from('residentes')
        .select('id')
        .eq('usuario_id', usuarioApp.id)
        .limit(1);
      const residente = residentesRows?.[0] || null;
      if (!residente?.id) return;

      channel = supabase
        .channel(`mis-paquetes-${residente.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'paquetes',
          filter: `residente_id=eq.${residente.id}`
        }, () => obtenerPaquetes(usuarioApp.id))
        .subscribe();
    };
    init();

    const onChanged = () => obtenerPaquetes(usuarioApp.id);
    window.addEventListener('paqueteria:changed', onChanged);

    return () => {
      window.removeEventListener('paqueteria:changed', onChanged);
      if (channel) supabase.removeChannel(channel);
    };
  }, [usuarioApp?.id]);

  const paquetesNormalizados = useMemo(
    () => paquetes.map((raw) => {
      const parsed = parsearCategoriaDesdeDescripcion(raw.descripcion);
      return { ...raw, descripcion_visible: parsed.descripcion, categoria: parsed.categoria };
    }),
    [paquetes]
  );

  const resumen = useMemo(() => ({
    total: paquetesNormalizados.length,
    pendientes: paquetesNormalizados.filter((p) => String(p.estado || '').toLowerCase() === 'pendiente').length,
    entregados: paquetesNormalizados.filter((p) => String(p.estado || '').toLowerCase() === 'entregado').length,
    servicios: paquetesNormalizados.filter((p) => p.categoria === 'servicio_publico').length
  }), [paquetesNormalizados]);

  const paquetesFiltrados = useMemo(() => {
    const estado = String(filtroEstado || '').toLowerCase();
    const term = String(busqueda || '').trim().toLowerCase();

    return paquetesNormalizados.filter((p) => {
      const coincideEstado = estado === 'todos' ? true : String(p.estado || '').toLowerCase() === estado;
      const coincideBusqueda = term
        ? String(p.descripcion_visible || '').toLowerCase().includes(term)
        : true;
      return coincideEstado && coincideBusqueda;
    });
  }, [paquetesNormalizados, filtroEstado, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(paquetesFiltrados.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const paquetesPaginados = useMemo(
    () => paquetesFiltrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE),
    [paquetesFiltrados, paginaActual]
  );

  return (
    <div className="space-y-5">
      <div className="app-surface-primary p-5">
        <h2 className="text-2xl font-bold text-app-text-primary">Mis paquetes 📦</h2>
        <p className="text-sm text-app-text-secondary mt-1">Seguimiento de entregas con estado, fechas y categoría de servicio.</p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="app-surface-muted"><span className="text-app-text-secondary">Total</span><p className="text-lg font-semibold">{resumen.total}</p></div>
          <div className="app-surface-muted"><span className="text-app-text-secondary">Pendientes</span><p className="text-lg font-semibold text-state-warning">{resumen.pendientes}</p></div>
          <div className="app-surface-muted"><span className="text-app-text-secondary">Entregados</span><p className="text-lg font-semibold text-state-success">{resumen.entregados}</p></div>
          <div className="app-surface-muted"><span className="text-app-text-secondary">Servicios</span><p className="text-lg font-semibold text-brand-secondary">{resumen.servicios}</p></div>
        </div>
      </div>

      <div className="app-surface-primary p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`app-btn text-xs ${filtroEstado === 'todos' ? 'app-btn-primary' : 'app-btn-ghost'}`} onClick={() => { setFiltroEstado('todos'); setPagina(1); }}>Todos ({resumen.total})</button>
          <button type="button" className={`app-btn text-xs ${filtroEstado === 'pendiente' ? 'app-btn-secondary' : 'app-btn-ghost'}`} onClick={() => { setFiltroEstado('pendiente'); setPagina(1); }}>Pendientes ({resumen.pendientes})</button>
          <button type="button" className={`app-btn text-xs ${filtroEstado === 'entregado' ? 'app-btn-secondary' : 'app-btn-ghost'}`} onClick={() => { setFiltroEstado('entregado'); setPagina(1); }}>Entregados ({resumen.entregados})</button>
        </div>

        <input
          className="app-input"
          placeholder="Buscar por descripción"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(1);
          }}
        />
      </div>

      {loading && <p className="text-sm text-app-text-secondary">Cargando paquetes...</p>}
      {!loading && paquetesFiltrados.length === 0 && <div className="app-surface-primary p-4 text-sm text-app-text-secondary">No hay paquetes para este filtro.</div>}

      <div className="space-y-3">
        {paquetesPaginados.map((p) => (
          <div key={p.id} className="app-surface-primary p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-app-text-secondary">{p.categoria === 'servicio_publico' ? 'Servicio público' : 'Paquete'}</p>
                <p className="font-semibold text-app-text-primary mt-1">{p.descripcion_visible || 'Sin descripción'}</p>
              </div>
              <span className={`app-badge ${p.categoria === 'servicio_publico' ? 'app-badge-info' : 'app-badge-success'}`}>
                {p.categoria === 'servicio_publico' ? 'Servicio' : 'Envío'}
              </span>
            </div>

            <div className="mt-3 grid md:grid-cols-3 gap-2 text-sm">
              <div className="app-surface-muted"><span className="text-app-text-secondary block">Estado</span><span className={`${p.estado === 'pendiente' ? 'text-state-warning' : 'text-state-success'} font-semibold capitalize`}>{p.estado}</span></div>
              <div className="app-surface-muted"><span className="text-app-text-secondary block">Recibido</span><span>{p.fecha_recibido ? new Date(p.fecha_recibido).toLocaleDateString() : '-'}</span></div>
              <div className="app-surface-muted"><span className="text-app-text-secondary block">Entregado</span><span>{p.fecha_entrega ? new Date(p.fecha_entrega).toLocaleDateString() : 'Pendiente'}</span></div>
            </div>
          </div>
        ))}
      </div>

      {!loading && paquetesFiltrados.length > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-app-text-secondary">Página {paginaActual} de {totalPaginas} · {paquetesFiltrados.length} resultados</span>
          <div className="flex gap-2">
            <button className="app-btn-ghost text-xs" disabled={paginaActual === 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>Anterior</button>
            <button className="app-btn-ghost text-xs" disabled={paginaActual === totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}>Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}
