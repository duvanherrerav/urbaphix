import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { actualizarEstadoIncidente, obtenerEstadosIncidentesLocal, obtenerFechasIncidentesLocal } from '../services/seguridadService';

const ESTADOS_GESTION = ['En gestion', 'Resuelto', 'Cerrado'];
const formatBogota = (value, localEpoch) => {
  if (localEpoch) {
    return new Date(localEpoch).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }
  if (!value) return '-';
  const raw = String(value).trim().replace(' ', 'T');
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(raw);
  const baseDate = new Date(hasZone ? raw : `${raw}Z`);
  if (Number.isNaN(baseDate.getTime())) return '-';

  const bogotaMs = baseDate.getTime() - (5 * 60 * 60 * 1000);
  const bogotaDate = new Date(bogotaMs);
  const d = String(bogotaDate.getUTCDate()).padStart(2, '0');
  const m = String(bogotaDate.getUTCMonth() + 1).padStart(2, '0');
  const y = String(bogotaDate.getUTCFullYear()).slice(0);
  const h24 = bogotaDate.getUTCHours();
  const mm = String(bogotaDate.getUTCMinutes()).padStart(2, '0');
  const ampm = h24 >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h24 % 12 || 12;

  return `${d}/${m}/${y}, ${h12}:${mm} ${ampm}`;
};

export default function ListaIncidentes({ usuarioApp }) {

  const [incidentes, setIncidentes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [estadosLocal, setEstadosLocal] = useState({});
  const [fechasLocal, setFechasLocal] = useState({});
  const [pagina, setPagina] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => {
    const cargar = async () => {
      if (!usuarioApp?.conjunto_id) return;

      const { data, error } = await supabase
        .from('incidentes')
        .select('*')
        .eq('conjunto_id', usuarioApp.conjunto_id)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('No se pudieron cargar incidentes');
        return;
      }

      setIncidentes(data || []);
      setEstadosLocal(obtenerEstadosIncidentesLocal());
      setFechasLocal(obtenerFechasIncidentesLocal());
    };

    cargar();

    const channel = supabase
      .channel(`incidentes-admin-${usuarioApp?.conjunto_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidentes', filter: `conjunto_id=eq.${usuarioApp?.conjunto_id}` },
        () => cargar()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [usuarioApp?.conjunto_id]);

  const cambiarEstado = async (incidente, estado) => {
    const { ok, error } = await actualizarEstadoIncidente({
      incidenteId: incidente.id,
      estado,
      usuarioId: usuarioApp?.id
    });

    if (!ok) {
      toast.error(error);
      return;
    }

    const nuevosEstados = obtenerEstadosIncidentesLocal();
    setEstadosLocal(nuevosEstados);
    toast.success(`Incidente actualizado a ${estado}`);
  };

  const lista = useMemo(() => {
    const term = busqueda.trim().toLowerCase();

    const filtered = incidentes.filter((i) => {
      const estadoActual = estadosLocal[i.id]?.estado || 'nuevo';
      const matchEstado = filtroEstado === 'todos' ? true : estadoActual === filtroEstado;
      const matchBusqueda = !term
        || i.descripcion?.toLowerCase().includes(term)
        || i.nivel?.toLowerCase().includes(term)
        || estadoActual.toLowerCase().includes(term);
      return matchEstado && matchBusqueda;
    });

    // Priorizamos lo no cerrado al inicio
    return filtered.sort((a, b) => {
      const ea = estadosLocal[a.id]?.estado || 'nuevo';
      const eb = estadosLocal[b.id]?.estado || 'nuevo';
      if (ea === 'cerrado' && eb !== 'cerrado') return 1;
      if (ea !== 'cerrado' && eb === 'cerrado') return -1;
      return 0;
    });
  }, [incidentes, estadosLocal, filtroEstado, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(lista.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const listaPaginada = lista.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

  const resumen = {
    total: lista.length,
    nuevos: lista.filter((i) => (estadosLocal[i.id]?.estado || 'nuevo') === 'nuevo').length,
    enGestion: lista.filter((i) => (estadosLocal[i.id]?.estado || 'nuevo') === 'en_gestion').length,
    resueltos: lista.filter((i) => (estadosLocal[i.id]?.estado || 'nuevo') === 'resuelto').length,
    cerrados: lista.filter((i) => (estadosLocal[i.id]?.estado || 'nuevo') === 'cerrado').length
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-xl font-bold">Incidentes</h2>
        <div className="flex gap-2">
          <input
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="Buscar incidente..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
          />
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={filtroEstado}
            onChange={(e) => {
              setFiltroEstado(e.target.value);
              setPagina(1);
            }}
          >
            <option value="todos">Todos</option>
            {['nuevo', ...ESTADOS_GESTION].map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <div className="bg-gray-100 rounded-lg px-3 py-2"><b>Total:</b> {resumen.total}</div>
        <div className="bg-amber-50 rounded-lg px-3 py-2"><b>Nuevos:</b> {resumen.nuevos}</div>
        <div className="bg-blue-50 rounded-lg px-3 py-2"><b>En gestión:</b> {resumen.enGestion}</div>
        <div className="bg-green-50 rounded-lg px-3 py-2"><b>Resueltos:</b> {resumen.resueltos}</div>
        <div className="bg-slate-100 rounded-lg px-3 py-2"><b>Cerrados:</b> {resumen.cerrados}</div>
      </div>

      {listaPaginada.map((i) => (
        <div key={i.id} className="border rounded-lg p-3 space-y-2">
          <p><b>Descripción:</b> {i.descripcion}</p>
          <p><b>Nivel:</b> {i.nivel}</p>
          <p><b>Estado:</b> <span className="capitalize">{estadosLocal[i.id]?.estado || 'Nuevo'}</span></p>
          <p className="text-xs text-gray-500"><b>Fecha incidente:</b> {formatBogota(i.created_at, fechasLocal[i.id])}</p>

          {usuarioApp?.rol_id === 'admin' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Gestión administrativa</p>
              <div className="flex flex-wrap gap-2">
                {ESTADOS_GESTION.map((estado) => (
                  <button
                    key={estado}
                    className={`px-2 py-1 border rounded text-xs hover:bg-gray-50 ${estadosLocal[i.id]?.estado === estado ? 'bg-gray-900 text-white' : ''}`}
                    onClick={() => cambiarEstado(i, estado)}
                  >
                    {estado}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {lista.length === 0 && <p className="text-sm text-gray-500">Sin incidentes para el filtro seleccionado.</p>}

      {lista.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-500">Página {paginaActual} de {totalPaginas}</p>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 border rounded text-sm disabled:opacity-40"
              disabled={paginaActual === 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              className="px-3 py-1 border rounded text-sm disabled:opacity-40"
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