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

    const { data: residente } = await supabase
      .from('residentes')
      .select('*')
      .eq('usuario_id', usuarioId)
      .single();

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    obtenerPaquetes(usuarioApp.id);
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
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Mis paquetes 📦</h2>
        <p className="text-sm text-gray-500">Consulta tus envíos pendientes y entregados.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={`px-3 py-1 rounded-full text-sm ${filtroEstado === 'todos' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} onClick={() => { setFiltroEstado('todos'); setPagina(1); }}>Todos ({resumen.total})</button>
        <button type="button" className={`px-3 py-1 rounded-full text-sm ${filtroEstado === 'pendiente' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'}`} onClick={() => { setFiltroEstado('pendiente'); setPagina(1); }}>Pendientes ({resumen.pendientes})</button>
        <button type="button" className={`px-3 py-1 rounded-full text-sm ${filtroEstado === 'entregado' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'}`} onClick={() => { setFiltroEstado('entregado'); setPagina(1); }}>Entregados ({resumen.entregados})</button>
        <span className="px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-700">Servicios públicos ({resumen.servicios})</span>
      </div>

      <input
        className="w-full border rounded-lg px-3 py-2"
        placeholder="Buscar por descripción"
        value={busqueda}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setPagina(1);
        }}
      />

      {loading && <p className="text-sm text-gray-500">Cargando paquetes...</p>}

      {!loading && paquetesFiltrados.length === 0 && (
        <p className="text-sm text-gray-500">No hay paquetes para este filtro.</p>
      )}

      <div className="space-y-3">
        {paquetesPaginados.map((p) => (
          <div key={p.id} className="border rounded-xl p-3 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">Descripción: {p.descripcion_visible}</p>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                p.categoria === 'servicio_publico'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {p.categoria === 'servicio_publico' ? 'Servicio público' : 'Paquete'}
              </span>
            </div>

            <p>
              <span className="font-semibold">Estado:</span>
              <span className={`ml-1 font-medium ${p.estado === 'pendiente' ? 'text-amber-600' : 'text-emerald-600'}`}>
                {p.estado}
              </span>
            </p>

            <p>
              <span className="font-semibold">Recibido:</span> {new Date(p.fecha_recibido).toLocaleDateString()}
            </p>

            {p.fecha_entrega && (
              <p>
                <span className="font-semibold">Entregado:</span> {new Date(p.fecha_entrega).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>
      {!loading && paquetesFiltrados.length > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Página {paginaActual} de {totalPaginas} · {paquetesFiltrados.length} resultados</span>
          <div className="flex gap-2">
            <button
              className="px-2 py-1 border rounded disabled:opacity-40"
              disabled={paginaActual === 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              className="px-2 py-1 border rounded disabled:opacity-40"
              disabled={paginaActual === totalPaginas}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
