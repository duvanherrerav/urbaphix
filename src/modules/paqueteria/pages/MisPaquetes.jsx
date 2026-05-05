import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { parsearCategoriaDesdeDescripcion } from '../services/paquetesService';
import PaqueteCard from '../components/PaqueteCard';
import PaquetesResumen from '../components/PaquetesResumen';
import PaquetesFiltros from '../components/PaquetesFiltros';

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

  const rangoInicio = paquetesFiltrados.length ? ((paginaActual - 1) * PAGE_SIZE) + 1 : 0;
  const rangoFin = Math.min(paginaActual * PAGE_SIZE, paquetesFiltrados.length);

  return (
    <div className="space-y-4 lg:space-y-5">
      <header className="app-surface-primary border border-brand-primary/10 rounded-xl p-4">
        <h2 className="text-xl sm:text-2xl font-bold text-app-text-primary">Mis paquetes</h2>
        <p className="text-sm text-app-text-secondary mt-1">Consulta el estado de tus paquetes y servicios registrados en portería.</p>
      </header>

      <PaquetesResumen resumen={resumen} />

      <PaquetesFiltros
        filtroEstado={filtroEstado}
        setFiltroEstado={setFiltroEstado}
        resumen={resumen}
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        onResetPagina={() => setPagina(1)}
      />

      {loading && <p className="text-sm text-app-text-secondary">Cargando paquetes...</p>}

      {!loading && paquetesNormalizados.length === 0 && (
        <div className="app-surface-primary border border-brand-primary/10 rounded-xl p-5 text-sm">
          <p className="font-semibold text-app-text-primary">Aún no tienes paquetes registrados</p>
          <p className="text-app-text-secondary mt-1">Cuando portería registre un paquete o servicio para tu apartamento, aparecerá aquí.</p>
        </div>
      )}

      {!loading && paquetesNormalizados.length > 0 && paquetesFiltrados.length === 0 && (
        <div className="app-surface-primary border border-brand-primary/10 rounded-xl p-4 text-sm text-app-text-secondary">
          No encontramos paquetes con estos filtros.
        </div>
      )}

      {!loading && paquetesFiltrados.length > 0 && (
        <>
          <section className="space-y-3">
            {paquetesPaginados.map((p) => (
              <PaqueteCard key={p.id} paquete={p} />
            ))}
          </section>

          <div className="app-surface-muted border border-brand-primary/10 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-app-text-secondary">Mostrando {rangoInicio}–{rangoFin} de {paquetesFiltrados.length} paquetes</span>
            <div className="flex items-center gap-2">
              <span className="text-app-text-secondary">Página {paginaActual} de {totalPaginas}</span>
              <button className="app-btn-ghost text-xs" disabled={paginaActual === 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>Anterior</button>
              <button className="app-btn-ghost text-xs" disabled={paginaActual === totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}>Siguiente</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
