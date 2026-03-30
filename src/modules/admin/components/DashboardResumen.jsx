import { useEffect, useState } from 'react';

export default function DashboardResumen({ stats, kpis }) {

  const [mensaje, setMensaje] = useState('');
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {

    let texto = `Hoy tienes ${kpis.visitasHoy || 0} visitas y ${kpis.paquetesPendientes || 0} paquetes pendientes.`;

    if (kpis.torreTop && kpis.torreTop !== '-') {
      texto += ` ${kpis.torreTop} es la torre con más movimiento.`;
    }

    setMensaje(texto);

    let nuevasAlertas = [];

    if (kpis.paquetesPendientes > 5) {
      nuevasAlertas.push({
        texto: 'Muchos paquetes pendientes',
        tipo: 'warning'
      });
    }

    if (kpis.visitasHoy > 10) {
      nuevasAlertas.push({
        texto: 'Alto flujo de visitas hoy',
        tipo: 'danger'
      });
    }

    if (stats.pendientes > 5) {
      nuevasAlertas.push({
        texto: 'Varias visitas pendientes',
        tipo: 'info'
      });
    }

    setAlertas(nuevasAlertas);

  }, [stats, kpis]);

  return (
    <div className="space-y-4">

      {/* 🧠 RESUMEN */}
      <div className="bg-gray-900 text-white p-5 rounded-xl shadow">

        <p className="text-sm text-gray-300 mb-1">
          Resumen del día
        </p>

        <p className="text-lg font-semibold">
          {mensaje}
        </p>

      </div>

      {/* 🚨 ALERTAS */}
      {alertas.length > 0 && (
        <div className="space-y-2">

          {alertas.map((a, i) => {

            const estilos = {
              warning: "bg-yellow-100 text-yellow-800",
              danger: "bg-red-100 text-red-800",
              info: "bg-blue-100 text-blue-800"
            };

            return (
              <div
                key={i}
                className={`p-3 rounded-lg text-sm font-medium ${estilos[a.tipo]}`}
              >
                {a.texto}
              </div>
            );
          })}

        </div>
      )}

    </div>
  );
}