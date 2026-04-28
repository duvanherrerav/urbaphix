import { useMemo } from 'react';

export default function DashboardResumen({ stats, kpis }) {
  const mensaje = useMemo(() => {
    const visitas = kpis.visitasRango || 0;
    const paquetesPendientes = kpis.paquetesPendientes || 0;
    const textoPaquetes = paquetesPendientes === 1 ? 'paquete pendiente' : 'paquetes pendientes';
    let texto = `En los últimos 3 días tienes ${visitas} visitas y ${paquetesPendientes} ${textoPaquetes}.`;

    if (kpis.torreTop && kpis.torreTop !== '-') {
      texto += ` La torre ${kpis.torreTop} concentra más paquetes en el periodo.`;
    }
    return texto;
  }, [kpis.paquetesPendientes, kpis.torreTop, kpis.visitasRango]);

  const alertas = useMemo(() => {
    let nuevasAlertas = [];

    if (kpis.paquetesPendientes > 5) {
      nuevasAlertas.push({
        texto: 'Muchos paquetes pendientes',
        tipo: 'warning'
      });
    }

    if ((kpis.visitasRango || 0) > 10) {
      nuevasAlertas.push({
        texto: 'Alto flujo de visitas en el rango',
        tipo: 'danger'
      });
    }

    if (stats.pendientes > 5) {
      nuevasAlertas.push({
        texto: 'Varias visitas pendientes',
        tipo: 'info'
      });
    }
    return nuevasAlertas;
  }, [kpis.paquetesPendientes, kpis.visitasRango, stats.pendientes]);

  return (
    <div className="space-y-4">

      {/* 🧠 RESUMEN */}
      <div className="bg-app-bg text-white p-5 rounded-xl shadow">

        <p className="text-sm text-app-text-secondary mb-1">
          Resumen operativo (3 días)
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
