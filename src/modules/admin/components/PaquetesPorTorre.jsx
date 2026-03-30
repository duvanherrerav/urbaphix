import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';

export default function PaquetesPorTorre({ usuarioApp }) {

  const [data, setData] = useState([]);

  useEffect(() => {
    if (usuarioApp?.conjunto_id) {
      obtenerData();
    }
  }, [usuarioApp]);

  const obtenerData = async () => {

    const { data: torres, error } = await supabase
      .from('torres')
      .select(`
        id,
        nombre,
        apartamentos (
          id,
          paquetes (
            id,
            estado
          )
        )
      `)
      .eq('conjunto_id', usuarioApp.conjunto_id);

    if (error) {
      console.log(error);
      return;
    }

    const resultado = torres.map(t => {

      let total = 0;

      t.apartamentos.forEach(a => {
        if (a.paquetes) {
          total += a.paquetes.filter(p => p.estado === 'pendiente').length;
        }
      });

      return {
        torre: t.nombre,
        total
      };
    });

    setData(resultado);
  };

  // 🔥 calcular máximo para barras
  const max = Math.max(...data.map(d => d.total), 1);

  return (
    <div>

      <h3 className="text-lg font-semibold mb-4">
        Paquetes por torre 🏢📦
      </h3>

      <div className="space-y-4">

        {data.map((item, index) => {

          const porcentaje = (item.total / max) * 100;

          return (
            <div
              key={index}
              className="bg-white p-4 rounded-xl shadow"
            >

              {/* HEADER */}
              <div className="flex justify-between mb-2">
                <span className="font-medium">
                  🏢 {item.torre}
                </span>

                <span className="text-sm font-bold text-gray-700">
                  {item.total} paquetes
                </span>
              </div>

              {/* BARRA */}
              <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">

                <div
                  className={`h-full ${
                    porcentaje > 70
                      ? 'bg-red-500'
                      : porcentaje > 40
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${porcentaje}%` }}
                />

              </div>

            </div>
          );
        })}

        {data.length === 0 && (
          <p className="text-gray-500 text-sm">
            No hay datos disponibles
          </p>
        )}

      </div>

    </div>
  );
}