import { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabaseClient';
import { logger } from '../../../utils/logger';
import { enqueueOfflineAction, esErrorConectividad, registrarBitacora, registrarIngresoVisitaRPC, registrarIntentoQRInvalido, validarReglasAcceso } from '../services/porteriaService';
import { ModuleTitle } from '../../../components/ui/ModuleIcon';

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
      const usuarioConjuntoId = usuarioApp?.conjunto_id;

      if (!usuarioConjuntoId) {
        logger.warn('EscanearQR: usuario sin conjunto_id; búsqueda QR depende de RLS', {
          usuario_id: usuarioApp?.id
        });
      }

      // 🔥 validar conjunto
      if (conjunto_id && usuarioConjuntoId && conjunto_id !== usuarioConjuntoId) {
        await registrarIntentoQRInvalido({ qrRaw: text, usuarioApp });
        toast.error("QR no pertenece a este conjunto");
        return;
      }

      // 🔥 buscar visita
      let visitaQuery = supabase
        .from('registro_visitas')
        .select(`
          id, qr_code, conjunto_id, estado, fecha_visita, hora_inicio, hora_fin, visitante_id,
          visitantes (nombre, documento, residente_id)
        `)
        .or(visita_id ? `id.eq.${visita_id}` : `qr_code.eq.${qr_code}`);

      if (usuarioConjuntoId) {
        visitaQuery = visitaQuery.eq('conjunto_id', usuarioConjuntoId);
      }

      const { data: visita, error } = await visitaQuery.single();

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
      const horaIngresoLocal = new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }).replace(' ', ' ');
      const { error: ingresoError } = await registrarIngresoVisitaRPC({
        qrCode: visitaNormalizada.qr_code,
        vigilanteId: usuarioApp?.id
      });

      if (ingresoError) {
        if (esErrorConectividad(ingresoError)) {
          enqueueOfflineAction({
            type: 'visita_estado',
            visita_id: visitaNormalizada.id,
            qr_code: visitaNormalizada.qr_code,
            vigilante_id: usuarioApp?.id || null,
            payload: {
              estado: 'ingresado',
              hora_ingreso: horaIngresoLocal
            }
          });
          toast.error("Sin conexión estable. El ingreso quedó en cola de contingencia.");
        } else {
          logger.error('EscanearQR: no se pudo registrar ingreso', ingresoError);
          toast.error('No fue posible registrar el ingreso. Intenta nuevamente.');
        }
      } else {
        // 🔔 La RPC valida actor operativo y tenant antes de exponer el token del destinatario.
        const { data: destinatario, error: errorDestinatario } = await supabase
          .rpc('fn_visit_push_recipient', { p_registro_id: visitaNormalizada.id })
          .maybeSingle();

        if (errorDestinatario) {
          logger.warn('EscanearQR: no se pudo resolver destinatario push de visita', errorDestinatario);
        } else if (!destinatario?.user_id) {
          logger.warn('EscanearQR: visita sin destinatario push autorizado', {
            visita_id: visitaNormalizada.id
          });
        } else {
          const { error: errorNotificacion } = await supabase.from('notificaciones').insert([{
            usuario_id: destinatario.user_id,
            tipo: 'visita_ingreso',
            titulo: "Visita ingresó",
            mensaje: `${visitaNormalizada.nombre_visitante} ha ingresado`
          }]);

          if (errorNotificacion) {
            logger.warn('EscanearQR: no se pudo crear notificación de ingreso', errorNotificacion);
          }

          if (!destinatario.fcm_token) {
            logger.warn('EscanearQR: usuario sin fcm_token para push de visita', {
              usuario_id: destinatario.user_id
            });
          } else {
            try {
              await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-notificacion`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  token: destinatario.fcm_token,
                  titulo: '🚗 Visita ingresó',
                  mensaje: `${visitaNormalizada.nombre_visitante} ha ingresado`
                })
              });
            } catch (errorPush) {
              logger.warn('EscanearQR: no se pudo enviar push de ingreso', errorPush);
            }
          }
        }

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
      logger.error('EscanearQR: error validando QR', err);
      await registrarIntentoQRInvalido({ qrRaw: text, usuarioApp });
      toast.error("QR inválido");
    }
  };

  return (
    <div>
      <ModuleTitle icon="visitas" title="Escanear QR" className="text-xl font-bold text-app-text-primary" iconClassName="h-9 w-9 rounded-xl" />
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
