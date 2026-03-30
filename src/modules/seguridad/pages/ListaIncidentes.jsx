import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient';

export default function ListaIncidentes() {

  const [incidentes, setIncidentes] = useState([]);

  useEffect(() => {
    obtener();
  }, []);

  const obtener = async () => {
    const { data } = await supabase
      .from('incidentes')
      .select('*')
      .order('created_at', { ascending: false });

    setIncidentes(data);
  };

  return (
    <div>
      <h2>Incidentes</h2>

      {incidentes.map(i => (
        <div key={i.id}>
          <p>{i.descripcion}</p>
          <p>{i.nivel}</p>
        </div>
      ))}
    </div>
  );
}