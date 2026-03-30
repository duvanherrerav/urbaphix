import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';

export default function CarteraResumen({ usuarioApp }) {

  const [cartera, setCartera] = useState([]);

  useEffect(() => {
    if (usuarioApp?.conjunto_id) {
      obtenerCartera();
    }
  }, [usuarioApp]);

  // 🔥 OBTENER CARTERA
  const obtenerCartera = async () => {

    const { data, error } = await supabase
      .from('pagos')
      .select(`
        valor,
        residentes (
          id,
          usuario_id,
          apartamentos (
            numero,
            torres!fk_apartamento_torre (
              nombre
            )
          ),
          usuarios_app (
            nombre
          )
        )
      `)
      .eq('conjunto_id', usuarioApp.conjunto_id)
      .eq('estado', 'pendiente');

    if (error) {
      console.log(error);
      return;
    }

    const mapa = {};

    data.forEach(p => {

      const residente = p.residentes;
      const id = residente?.id;

      if (!id) return;

      if (!mapa[id]) {
        mapa[id] = {
          usuario_id: residente?.usuario_id, // 🔥 CLAVE
          nombre: residente?.usuarios_app?.nombre || 'Residente',
          apartamento: residente?.apartamentos?.numero || '-',
          torre: residente?.apartamentos?.torres?.nombre || '-',
          totalDeuda: 0,
          cantidadPagos: 0
        };
      }

      mapa[id].totalDeuda += p.valor || 0;
      mapa[id].cantidadPagos += 1;
    });

    const resultado = Object.values(mapa).sort(
      (a, b) => b.totalDeuda - a.totalDeuda
    );

    setCartera(resultado);
  };

  // 🔔 ENVIAR RECORDATORIO
  const enviarRecordatorio = async (c) => {

    if (!c.usuario_id) {
      alert('No se encontró usuario');
      return;
    }

    try {
      const { error } = await supabase
        .from('notificaciones')
        .insert([{
          usuario_id: c.usuario_id,
          tipo: 'recordatorio_pago',
          titulo: 'Pago pendiente',
          mensaje: `Tienes una deuda de $${c.totalDeuda.toLocaleString()} en Torre ${c.torre} Apto ${c.apartamento}`
        }]);

      if (error) throw error;

      alert('📩 Recordatorio enviado');

    } catch (err) {
      console.log(err);
      alert('Error enviando recordatorio');
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow">

      <h3 className="text-lg font-bold mb-4">
        💰 Cartera (Morosos)
      </h3>

      {cartera.length === 0 && (
        <p className="text-gray-500">
          No hay cartera pendiente 🎉
        </p>
      )}

      <div className="space-y-3">

        {cartera.map((c, i) => (

          <div
            key={i}
            className="flex justify-between items-center border p-4 rounded-xl hover:shadow transition"
          >

            {/* INFO */}
            <div>
              <p className="font-semibold text-gray-800">
                🏢 Torre {c.torre} • Apto {c.apartamento}
              </p>

              <p className="text-sm text-gray-500">
                {c.nombre}
              </p>

              <p className="text-xs text-gray-400">
                {c.cantidadPagos} pagos pendientes
              </p>
            </div>

            {/* DERECHA */}
            <div className="text-right">

              <p className="text-lg font-bold text-red-600">
                ${c.totalDeuda.toLocaleString()}
              </p>

              <button
                onClick={() => enviarRecordatorio(c)}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-lg"
              >
                Recordar 📩
              </button>

            </div>

          </div>

        ))}

      </div>

    </div>
  );
}