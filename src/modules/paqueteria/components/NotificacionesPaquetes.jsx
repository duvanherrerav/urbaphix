import { useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';
import toast from 'react-hot-toast';
import { parsearCategoriaDesdeDescripcion } from '../services/paquetesService';
import { ESTADOS_PAQUETE } from '../services/estadosPaquete';

const NOTIFICATION_DEBOUNCE_MS = 250;

const puedeMostrarNotificacionNavegador = () => (
  typeof Notification !== 'undefined' && Notification.permission === 'granted'
);

export default function NotificacionesPaquetes({ usuarioApp }) {

  useEffect(() => {

    if (!usuarioApp?.id) return undefined;

    let mounted = true;
    let channel = null;
    const pendingNotifications = new Map();

    const clearPendingNotifications = () => {
      pendingNotifications.forEach((timeoutId) => clearTimeout(timeoutId));
      pendingNotifications.clear();
    };

    const scheduleNotification = (key, notify) => {
      if (!mounted) return;

      const existingTimeout = pendingNotifications.get(key);
      if (existingTimeout) clearTimeout(existingTimeout);

      const timeoutId = setTimeout(() => {
        pendingNotifications.delete(key);
        if (!mounted) return;
        notify();
      }, NOTIFICATION_DEBOUNCE_MS);

      pendingNotifications.set(key, timeoutId);
    };

    const init = async () => {

      let residentesQuery = supabase
        .from('residentes')
        .select('id')
        .eq('usuario_id', usuarioApp.id)
        .limit(1);

      if (usuarioApp.conjunto_id) {
        residentesQuery = residentesQuery.eq('conjunto_id', usuarioApp.conjunto_id);
      }

      const { data: residentesRows } = await residentesQuery;

      if (!mounted) return;

      const residente = residentesRows?.[0] || null;

      if (!residente) return;

      const residenteId = residente.id;

      channel = supabase
        .channel(`paquetes-residente-${residenteId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'paquetes',
            filter: `residente_id=eq.${residenteId}`
          },
          (payload) => {
            if (!mounted) return;

            const paquete = payload.new;

            if (!paquete || paquete.residente_id !== residenteId) return;

            // 🟢 NUEVO PAQUETE
            if (payload.eventType === 'INSERT') {
              scheduleNotification(`insert-${paquete.id}`, () => {
                const parsed = parsearCategoriaDesdeDescripcion(paquete.descripcion);
                const isServicio = parsed.categoria === 'servicio_publico';

                if (puedeMostrarNotificacionNavegador()) {
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
              });
            }

            // 🔵 PAQUETE ENTREGADO
            if (
              payload.eventType === 'UPDATE' &&
              payload.old?.estado !== ESTADOS_PAQUETE.ENTREGADO &&
              paquete.estado === ESTADOS_PAQUETE.ENTREGADO
            ) {
              scheduleNotification(`entregado-${paquete.id}`, () => {
                if (puedeMostrarNotificacionNavegador()) {
                  new Notification('📦 Paquete entregado', {
                    body: `Tu paquete (${paquete.descripcion}) fue entregado`,
                    icon: '/icon.png'
                  });
                }

                toast('📦 Tu paquete fue entregado');
              });
            }
          }
        )
        .subscribe();
    };

    init();

    return () => {
      mounted = false;
      clearPendingNotifications();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };

  }, [usuarioApp?.conjunto_id, usuarioApp?.id]);

  return null;
}
