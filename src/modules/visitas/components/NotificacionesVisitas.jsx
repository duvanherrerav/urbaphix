import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import toast from 'react-hot-toast';

export default function NotificacionesVisitas({ usuarioApp }) {

  const [ultimaNotificacion, setUltimaNotificacion] = useState(null);

  useEffect(() => {

    if (!usuarioApp) return;

    const channel = supabase
      .channel('visitas-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'registro_visitas'
        },
        async (payload) => {

          const visita = payload.new;

          // 🔥 1. SOLO RESIDENTES
          if (usuarioApp.rol_id !== 'residente') return;

          // 🔥 2. BUSCAR RESIDENTE DEL USUARIO
          const { data: residentesRows } = await supabase
            .from('residentes')
            .select('*')
            .eq('usuario_id', usuarioApp.id)
            .limit(1);
          const residente = residentesRows?.[0] || null;

          if (!residente) return;

          const { data: visitante } = await supabase
            .from('visitantes')
            .select('residente_id, nombre')
            .eq('id', visita.visitante_id)
            .single();

          if (!visitante) return;

          // 🔥 3. VALIDAR QUE LA VISITA SEA DE ESTE RESIDENTE
          if (visitante.residente_id !== residente.id) return;

          // 🔥 4. EVITAR DUPLICADOS
          const clave = visita.id + visita.estado;

          if (ultimaNotificacion === clave) return;

          setUltimaNotificacion(clave);

          // 🔥 5. NOTIFICACIONES

          if (visita.estado === 'ingresado') {

            if (Notification.permission === 'granted') {
              new Notification('🚗 Visita ingresó', {
                body: `${visitante.nombre} ha ingresado`,
                icon: '/icon.png'
              });
            }

            toast.success('🚗 Tu visita ha ingresado');
          }

          if (visita.estado === 'salido') {

            if (Notification.permission === 'granted') {
              new Notification('✅ Visita salió', {
                body: `${visitante.nombre} ha salido`,
                icon: '/icon.png'
              });
            }

            toast('✅ Tu visita ha salido');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [usuarioApp, ultimaNotificacion]);

  return null;
}
