import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { actualizarEstadoIncidente, obtenerEstadosIncidentesLocal, obtenerFechasIncidentesLocal } from '../services/seguridadService';

const ESTADOS_GESTION = ['en_gestion', 'resuelto', 'cerrado'];
const formatBogota = (value, localEpoch) => {
  if (localEpoch) return new Date(localEpoch).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });
  if (!value) return '-';
  return new Date(value).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
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

      const { data, error } = await supabase.from('incidentes').select('*').eq('conjunto_id', usuarioApp.conjunto_id).order('created_at', { ascending: false });
      if (error) return toast.error('No se pudieron cargar incidentes');

      setIncidentes(data || []);
      setEstadosLocal(obtenerEstadosIncidentesLocal());
      setFechasLocal(obtenerFechasIncidentesLocal());
    };

    cargar();
    const channel = supabase
      .channel(`incidentes-admin-${usuarioApp?.conjunto_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidentes', filter: `conjunto_id=eq.${usuarioApp?.conjunto_id}` }, () => cargar())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [usuarioApp?.conjunto_id]);

  const cambiarEstado = async (incidente, estado) => {
    const { ok, error } = await actualizarEstadoIncidente({ incidenteId: incidente.id, estado, usuarioId: usuarioApp?.id });
    if (!ok) return toast.error(error);
    setEstadosLocal(obtenerEstadosIncidentesLocal());
    toast.success(`Incidente actualizado a ${estado}`);
  };

  const lista = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const filtered = incidentes.filter((i) => {
      const estadoActual = estadosLocal[i.id]?.estado || 'nuevo';
      const matchEstado = filtroEstado === 'todos' ? true : estadoActual === filtroEstado;
      const matchBusqueda = !term || i.descripcion?.toLowerCase().includes(term) || i.nivel?.toLowerCase().includes(term) || estadoActual.toLowerCase().includes(term);
      return matchEstado && matchBusqueda;
    });

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

  return (
    <div className="app-surface-primary p-5 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-2xl font-bold">Incidentes</h2>
        <div className="flex gap-2">
          <input className="app-input text-sm" placeholder="Buscar incidente..." value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} />
          <select className="app-input text-sm" value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }}>
            <option value="todos">Todos</option>
            {['nuevo', ...ESTADOS_GESTION].map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {listaPaginada.map((i) => (
        <div key={i.id} className="app-surface-muted p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium">{i.descripcion}</p>
            <span className={`app-badge ${i.nivel === 'alto' ? 'app-badge-error' : i.nivel === 'medio' ? 'app-badge-warning' : 'app-badge-info'} capitalize`}>{i.nivel}</span>
          </div>
          <div className="grid md:grid-cols-2 gap-2 text-sm">
            <p><span className="text-app-text-secondary">Estado:</span> <span className="capitalize font-semibold">{estadosLocal[i.id]?.estado || 'Nuevo'}</span></p>
            <p className="text-app-text-secondary md:text-right">{formatBogota(i.created_at, fechasLocal[i.id])}</p>
          </div>

          {usuarioApp?.rol_id === 'admin' && (
            <div className="flex flex-wrap gap-2">
              {ESTADOS_GESTION.map((estado) => (
                <button key={estado} className={`app-btn text-xs ${estadosLocal[i.id]?.estado === estado ? 'app-btn-secondary' : 'app-btn-ghost'}`} onClick={() => cambiarEstado(i, estado)}>{estado}</button>
              ))}
            </div>
          )}
        </div>
      ))}

      {lista.length === 0 && <p className="text-sm text-app-text-secondary">Sin incidentes para el filtro seleccionado.</p>}
      {lista.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-app-text-secondary">Página {paginaActual} de {totalPaginas}</p>
          <div className="flex gap-2">
            <button className="app-btn-ghost text-xs" disabled={paginaActual === 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>Anterior</button>
            <button className="app-btn-ghost text-xs" disabled={paginaActual === totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}>Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}
