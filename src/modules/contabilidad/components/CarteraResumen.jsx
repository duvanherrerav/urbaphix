import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { ESTADOS_PAGO, getEstadoPagoKey, getEstadoPagoUi, getValorPago } from '../utils/pagosEstados';

const ESTADOS_CARTERA = [
  ESTADOS_PAGO.PENDIENTE,
  ESTADOS_PAGO.EN_REVISION,
  ESTADOS_PAGO.RECHAZADO
];

export default function CarteraResumen({ usuarioApp }) {

  const [cartera, setCartera] = useState([]);

  useEffect(() => {
    if (usuarioApp?.conjunto_id) {
      obtenerCartera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioApp]);

  // 🔥 OBTENER CARTERA
  const obtenerCartera = async () => {

    const { data, error } = await supabase
      .from('pagos')
      .select(`
        valor,
        estado,
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
      .in('estado', ESTADOS_CARTERA);

    if (error) {
      console.log(error);
      return;
    }

    const mapa = {};

    data.forEach((p) => {
      const residente = p.residentes;
      const id = residente?.id;
      const estadoKey = getEstadoPagoKey(p.estado);

      if (!id || !ESTADOS_CARTERA.includes(estadoKey)) return;

      if (!mapa[id]) {
        mapa[id] = {
          usuario_id: residente?.usuario_id, // 🔥 CLAVE
          nombre: residente?.usuarios_app?.nombre || 'Residente',
          apartamento: residente?.apartamentos?.numero || '-',
          torre: residente?.apartamentos?.torres?.nombre || '-',
          totalDeuda: 0,
          cantidadPagos: 0,
          porEstado: ESTADOS_CARTERA.reduce((acc, estado) => ({
            ...acc,
            [estado]: { cantidad: 0, total: 0 }
          }), {})
        };
      }

      const valor = getValorPago(p);
      mapa[id].totalDeuda += valor;
      mapa[id].cantidadPagos += 1;
      mapa[id].porEstado[estadoKey].cantidad += 1;
      mapa[id].porEstado[estadoKey].total += valor;
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
    <div className="bg-app-bg-alt p-5 rounded-xl shadow">

      <h3 className="text-lg font-bold mb-1">
        💰 Cartera (no pagados)
      </h3>
      <p className="text-xs text-app-text-secondary mb-4">
        Incluye pendientes, comprobantes en revisión y comprobantes rechazados sin aprobar.
      </p>

      {cartera.length === 0 && (
        <p className="text-app-text-secondary">
          No hay cartera pendiente 🎉
        </p>
      )}

      <div className="space-y-3">

        {cartera.map((c) => (

          <div
            key={`${c.usuario_id}-${c.torre}-${c.apartamento}`}
            className="flex flex-col gap-3 border border-app-border bg-app-bg p-4 rounded-xl hover:shadow transition md:flex-row md:justify-between md:items-center"
          >

            {/* INFO */}
            <div>
              <p className="font-semibold text-app-text-primary">
                🏢 Torre {c.torre} • Apto {c.apartamento}
              </p>

              <p className="text-sm text-app-text-secondary">
                {c.nombre}
              </p>

              <p className="text-xs text-app-text-secondary">
                {c.cantidadPagos} pagos no aprobados
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {ESTADOS_CARTERA.map((estadoKey) => {
                  const info = c.porEstado[estadoKey];
                  if (!info?.cantidad) return null;
                  const estadoUi = getEstadoPagoUi(estadoKey);

                  return (
                    <span key={estadoKey} className={`app-badge ${estadoUi.badge}`}>
                      {estadoUi.label}: {info.cantidad} · ${info.total.toLocaleString('es-CO')}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* DERECHA */}
            <div className="text-right">

              <p className="text-lg font-bold text-state-error">
                ${c.totalDeuda.toLocaleString()}
              </p>
              <p className="text-[11px] text-app-text-secondary">Total no aprobado</p>

              <button
                type="button"
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
