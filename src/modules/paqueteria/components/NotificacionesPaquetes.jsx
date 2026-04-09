import { useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';
import toast from 'react-hot-toast';
import { parsearCategoriaDesdeDescripcion } from '../services/paquetesService';

export default function NotificacionesPaquetes({ usuarioApp }) {

  useEffect(() => {

    if (!usuarioApp) return;

    let channel = null;

    const init = async () => {

      // 🔥 obtener residente
      const { data: residente } = await supabase
        .from('residentes')
        .select('id')
        .eq('usuario_id', usuarioApp.id)
        .single();

      if (!residente) return;

      const residenteId = residente.id;

      console.log("👤 Residente ID:", residenteId);

      channel = supabase
        .channel('paquetes-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'paquetes'
          },
          (payload) => {

            console.log("📦 EVENTO:", payload);

            const paquete = payload.new;

            if (!paquete) return;

            // 🔥 validar dueño
            if (paquete.residente_id !== residenteId) return;

            // 🟢 NUEVO PAQUETE
            if (payload.eventType === 'INSERT') {
              const parsed = parsearCategoriaDesdeDescripcion(paquete.descripcion);
              const isServicio = parsed.categoria === 'servicio_publico';

              if (Notification.permission === 'granted') {
                new Notification(isServicio ? '🧾 Servicio público recibido' : '📦 Nuevo paquete', {
                  body: isServicio
                    ? `Tienes un servicio público por reclamar (${parsed.descripcion})`
                    : `Tienes un paquete (${parsed.descripcion})`,
                  icon: '/icon.png'
                });
              }

              toast.success(
                isServicio
                  ? '🧾 Tienes un servicio público por reclamar'
                  : '📦 Tienes un nuevo paquete'
              );
            }

            // 🔵 PAQUETE ENTREGADO
            if (
              payload.eventType === 'UPDATE' &&
              payload.old?.estado !== 'entregado' &&
              paquete.estado === 'entregado'
            ) {

              if (Notification.permission === 'granted') {
                new Notification('📦 Paquete entregado', {
                  body: `Tu paquete (${paquete.descripcion}) fue entregado`,
                  icon: '/icon.png'
                });
              }

              toast('📦 Tu paquete fue entregado');
            }
          }
        )
        .subscribe();
    };

    init();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };

  }, [usuarioApp?.id]);

  return null;
}