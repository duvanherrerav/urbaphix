import { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { supabase } from '../../../services/supabaseClient';

export default function EscanearQR({ usuarioApp }) {

  const [resultado, setResultado] = useState(null);

  const procesarQR = async (text) => {

    if (!text) return;

    try {
      const parsed = JSON.parse(text);

      const { visita_id, conjunto_id } = parsed;

      // 🔥 validar conjunto
      if (conjunto_id !== usuarioApp.conjunto_id) {
        alert("QR no pertenece a este conjunto");
        return;
      }

      // 🔥 buscar visita
      const { data: visita, error } = await supabase
        .from('visitas')
        .select('*')
        .eq('id', visita_id)
        .single();

      if (error || !visita) {
        alert("Visita no encontrada");
        return;
      }

      // 🔥 VALIDAR QUE SEA HOY
      const hoy = new Date().toISOString().split('T')[0];

      if (visita.fecha_visita !== hoy) {
        alert("QR no válido para hoy");
        return;
      }

      if (visita.estado === 'ingresado') {
        alert("Esta visita ya fue utilizada");
        return;
      }

      if (visita.estado === 'salido') {
        alert("Visita finalizada");
        return;
      }

      // 🔥 registrar ingreso
      const { error: updateError } = await supabase
        .from('visitas')
        .update({
          estado: 'ingresado',
          hora_ingreso: new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }).replace(' ', ' ')
        })
        .eq('id', visita_id);

      // 🔥 buscar token del usuario
      const { data: usuario } = await supabase
        .from('usuarios_app')
        .select('fcm_token')
        .eq('id', visita.residente_id)
        .single();

      // 🔥 enviar push
      await fetch('https://dhuerumqizprrudgurla.supabase.co/functions/v1/enviar-notificacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: usuario.fcm_token,
          titulo: '🚗 Visita ingresó',
          mensaje: `${visita.nombre_visitante} ha ingresado`
        })
      });

      if (updateError) {
        alert("Error al registrar ingreso");
      } else {
        // 🔥 guardar notificación
        await supabase.from('notificaciones').insert([{
          usuario_id: visita.residente_id,
          tipo: 'visita_ingreso',
          titulo: "Visita ingresó",
          mensaje: `${visita.nombre_visitante} ha ingresado`
        }]);

        setResultado(visita);
      }

    } catch (err) {
      console.log(err);
      alert("QR inválido");
    }
  };

  return (
    <div>
      <h2>Escanear QR 📷</h2>

      <div style={{ width: '300px' }}>
        <Scanner
          onScan={(result) => {
            if (result?.[0]?.rawValue) {
              procesarQR(result[0].rawValue);
            }
          }}
        />
      </div>

      {resultado && (
        <div style={{ marginTop: '20px' }}>
          <h3>Visita encontrada 👇</h3>
          <p><b>Visitante:</b> {resultado.nombre_visitante}</p>
          <p><b>Documento:</b> {resultado.documento}</p>
        </div>
      )}
    </div>
  );
}