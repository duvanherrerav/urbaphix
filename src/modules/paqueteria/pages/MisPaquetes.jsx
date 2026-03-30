import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';

export default function MisPaquetes({ usuarioApp }) {

  const [paquetes, setPaquetes] = useState([]);

  useEffect(() => {
    obtenerPaquetes();
  }, []);

  const obtenerPaquetes = async () => {

    const { data: residente } = await supabase
      .from('residentes')
      .select('*')
      .eq('usuario_id', usuarioApp.id)
      .single();

    if (!residente) return;

    const { data } = await supabase
      .from('paquetes')
      .select('*')
      .eq('residente_id', residente.id)
      .order('fecha_recibido', { ascending: false });

    setPaquetes(data || []);
  };

  return (
    <div>
      <h2>Mis paquetes 📦</h2>

      {paquetes.map(p => (
        <div key={p.id} style={{
          border: '1px solid #ccc',
          margin: '10px',
          padding: '10px',
          borderRadius: '8px'
        }}>
          <p><b>Descripción:</b> {p.descripcion}</p>

          <p>
            <b>Estado:</b>
            <span style={{
              color: p.estado === 'pendiente' ? 'orange' : 'green'
            }}>
              {' '}{p.estado}
            </span>
          </p>

          <p>
            <b>Recibido:</b> {new Date(p.fecha_recibido).toLocaleDateString()}
          </p>

          {p.fecha_entrega && (
            <p>
              <b>Entregado:</b> {new Date(p.fecha_entrega).toLocaleDateString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}