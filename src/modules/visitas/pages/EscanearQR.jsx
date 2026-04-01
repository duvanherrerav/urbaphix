import { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { enqueueOfflineAction, registrarBitacora, registrarIntentoQRInvalido, validarReglasAcceso } from '../services/porteriaService';

export default function EscanearQR({ usuarioApp }) {

  const [resultado, setResultado] = useState(null);
  const [modoEscaneo, setModoEscaneo] = useState('normal');

  const parseQRCode = (text) => {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.visita_id) {
        return parsed;
      }
    } catch {
      // QR plano: se asume visita_id o qr_code
    }

    if (/^[0-9a-fA-F-]{8,}$/.test(text)) {
      return { qr_code: text };
    }

    return null;
  };

  const procesarQR = async (text) => {
    if (!text) return;

    try {
      const parsed = parseQRCode(text);
      if (!parsed) {
        await registrarIntentoQRInvalido({ qrRaw: text, usuarioApp });
        toast.error('Formato QR no reconocido');
        return;
      }

      const { visita_id, conjunto_id, qr_code } = parsed;

      // 🔥 validar conjunto
      if (conjunto_id && conjunto_id !== usuarioApp.conjunto_id) {
        await registrarIntentoQRInvalido({ qrRaw: text, usuarioApp });
        toast.error("QR no pertenece a este conjunto");
        return;
      }

      // 🔥 buscar visita
      const { data: visita, error } = await supabase
        .from('registro_visitas')
        .select(`
          id, qr_code, conjunto_id, estado, fecha_visita, hora_inicio, hora_fin, visitante_id,
          visitantes (nombre, documento, residente_id)
        `)
        .or(visita_id ? `id.eq.${visita_id}` : `qr_code.eq.${qr_code}`)
        .single();

      if (error || !visita) {
        await registrarIntentoQRInvalido({ qrRaw: text, usuarioApp });
        toast.error("Visita no encontrada");
        await registrarBitacora({
          usuarioApp,
          accion: 'qr_invalido',
          detalle: 'Intento de escaneo con visita no encontrada',
          metadata: { qr: text }
        });
        return;
      }

      const visitaNormalizada = {
        ...visita,
        nombre_visitante: visita.visitantes?.nombre,
        documento: visita.visitantes?.documento,
        residente_id: visita.visitantes?.residente_id
      };

      const regla = validarReglasAcceso(visitaNormalizada);
      if (!regla.ok) {
        toast.error(regla.error);
        await registrarBitacora({
          usuarioApp,
          visitaId: visitaNormalizada.id,
          accion: 'acceso_denegado_regla',
          detalle: regla.error,
          metadata: { modoEscaneo }
        });
        return;
      }

      // 🔥 registrar ingreso
      const { error: updateError } = await supabase
        .from('registro_visitas')
        .update({
          estado: 'ingresado',
          hora_ingreso: new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }).replace(' ', ' ')
        })
        .eq('id', visitaNormalizada.id);

      // 🔥 buscar token del usuario
      const { data: usuario } = await supabase
        .from('usuarios_app')
        .select('fcm_token')
        .eq('id', visitaNormalizada.residente_id)
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
          mensaje: `${visitaNormalizada.nombre_visitante} ha ingresado`
        })
      });

      if (updateError) {
        enqueueOfflineAction({
          type: 'visita_estado',
          visita_id: visitaNormalizada.id,
          payload: {
            estado: 'ingresado',
            hora_ingreso: new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }).replace(' ', ' ')
          }
        });
        toast.error("Sin conexión estable. El ingreso quedó en cola de contingencia.");
      } else {
        // 🔥 guardar notificación
        await supabase.from('notificaciones').insert([{
          usuario_id: visitaNormalizada.residente_id,
          tipo: 'visita_ingreso',
          titulo: "Visita ingresó",
          mensaje: `${visitaNormalizada.nombre_visitante} ha ingresado`
        }]);

        setResultado(visitaNormalizada);
        toast.success('Ingreso autorizado');
        await registrarBitacora({
          usuarioApp,
          visitaId: visitaNormalizada.id,
          accion: 'ingreso_por_qr',
          detalle: 'Ingreso autorizado por lectura QR',
          metadata: { modoEscaneo }
        });
      }

    } catch (err) {
      console.log(err);
      await registrarIntentoQRInvalido({ qrRaw: text, usuarioApp });
      toast.error("QR inválido");
    }
  };

  return (
    <div>
      <h2>Escanear QR 📷</h2>
      <div style={{ marginBottom: '10px' }}>
        <label>
          Modo lectura:&nbsp;
          <select value={modoEscaneo} onChange={(e) => setModoEscaneo(e.target.value)}>
            <option value="normal">Normal</option>
            <option value="alto_contraste">Alto contraste</option>
          </select>
        </label>
      </div>
      
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