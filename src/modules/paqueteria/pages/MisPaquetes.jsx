import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';

export default function MisPaquetes({ usuarioApp }) {
  const [paquetes, setPaquetes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

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

  const paquetesFiltrados = useMemo(() => {
    const estado = String(filtroEstado || '').toLowerCase();
    const term = String(busqueda || '').trim().toLowerCase();

    return paquetes.filter((p) => {
      const coincideEstado = estado === 'todos' ? true : String(p.estado || '').toLowerCase() === estado;
      const coincideBusqueda = term
        ? String(p.descripcion || '').toLowerCase().includes(term)
        : true;
      return coincideEstado && coincideBusqueda;
    });
  }, [paquetes, filtroEstado, busqueda]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Mis paquetes 📦</h2>
        <p className="text-sm text-gray-500">Consulta tus envíos pendientes y entregados.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={`px-3 py-1 rounded-full text-sm ${filtroEstado === 'todos' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} onClick={() => setFiltroEstado('todos')}>Todos</button>
        <button type="button" className={`px-3 py-1 rounded-full text-sm ${filtroEstado === 'pendiente' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'}`} onClick={() => setFiltroEstado('pendiente')}>Pendientes</button>
        <button type="button" className={`px-3 py-1 rounded-full text-sm ${filtroEstado === 'entregado' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'}`} onClick={() => setFiltroEstado('entregado')}>Entregados</button>
      </div>

      <input
        className="w-full border rounded-lg px-3 py-2"
        placeholder="Buscar por descripción"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {loading && <p className="text-sm text-gray-500">Cargando paquetes...</p>}

      {!loading && paquetesFiltrados.length === 0 && (
        <p className="text-sm text-gray-500">No hay paquetes para este filtro.</p>
      )}

      <div className="space-y-3">
        {paquetesFiltrados.map((p) => (
          <div key={p.id} className="border rounded-xl p-3 bg-white shadow-sm">
            <p className="font-medium">Descripción: {p.descripcion}</p>

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
    </div>
  );
}