import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { actualizarEstadoIncidente } from '../services/seguridadService';

const ESTADOS = ['nuevo', 'en_gestion', 'resuelto', 'cerrado'];

export default function ListaIncidentes({ usuarioApp }) {

  const [incidentes, setIncidentes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('todos');

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
    };

    cargar();
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

    setIncidentes((prev) => prev.map((i) => (i.id === incidente.id ? { ...i, estado, asignado_a: usuarioApp?.id } : i)));
    toast.success(`Incidente actualizado a ${estado}`);
  };

  const lista = incidentes.filter((i) => (filtroEstado === 'todos' ? true : i.estado === filtroEstado));

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
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {lista.map((i) => (
        <div key={i.id} className="border rounded-lg p-3 space-y-2">
          <p><b>Descripción:</b> {i.descripcion}</p>
          <p><b>Nivel:</b> {i.nivel}</p>
          <p><b>Estado:</b> {i.estado || 'nuevo'}</p>
          <p className="text-xs text-gray-500"><b>Fecha:</b> {i.created_at ? new Date(i.created_at).toLocaleString() : '-'}</p>

          {usuarioApp?.rol_id === 'admin' && (
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map((estado) => (
                <button
                  key={estado}
                  className="px-2 py-1 border rounded text-xs hover:bg-gray-50"
                  onClick={() => cambiarEstado(i, estado)}
                >
                  {estado}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {lista.length === 0 && <p className="text-sm text-gray-500">Sin incidentes para el filtro seleccionado.</p>}
    </div>
  );
}