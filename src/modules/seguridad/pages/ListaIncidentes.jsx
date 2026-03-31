import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { actualizarEstadoIncidente, obtenerEstadosIncidentesLocal } from '../services/seguridadService';

const ESTADOS_GESTION = ['en_gestion', 'resuelto', 'cerrado'];
const formatBogota = (value) => {
  if (!value) return '-';
  const raw = String(value).trim().replace(' ', 'T');
  const baseDate = new Date(raw);
  if (Number.isNaN(baseDate.getTime())) return '-';

  const bogotaMs = baseDate.getTime() - (5 * 60 * 60 * 1000);
  const bogotaDate = new Date(bogotaMs);

  return bogotaDate.toLocaleString('es-CO', {
    timeZone: 'UTC',
    dateStyle: 'short',
    timeStyle: 'short'
  });
};

export default function ListaIncidentes({ usuarioApp }) {

  const [incidentes, setIncidentes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [estadosLocal, setEstadosLocal] = useState({});

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

  const lista = incidentes.filter((i) => {
    const estadoActual = estadosLocal[i.id]?.estado || 'nuevo';
    return filtroEstado === 'todos' ? true : estadoActual === filtroEstado;
  });

  return (
    <div className="bg-white p-4 rounded-xl shadow space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Incidentes</h2>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Todos</option>
          {['nuevo', ...ESTADOS_GESTION].map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {lista.map((i) => (
        <div key={i.id} className="border rounded-lg p-3 space-y-2">
          <p><b>Descripción:</b> {i.descripcion}</p>
          <p><b>Nivel:</b> {i.nivel}</p>
          <p><b>Estado:</b> <span className="capitalize">{estadosLocal[i.id]?.estado || 'nuevo'}</span></p>
          <p className="text-xs text-gray-500"><b>Fecha (Bogotá):</b> {formatBogota(i.created_at)}</p>

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
    </div>
  );
}