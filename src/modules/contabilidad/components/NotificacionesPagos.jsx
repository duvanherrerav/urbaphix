import { useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';

export default function NotificacionesPagos({ usuarioApp }) {

    useEffect(() => {

        if (!usuarioApp?.id) return;

        const channel = supabase
            .channel('notificaciones-pagos')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notificaciones',
                    filter: `usuario_id=eq.${usuarioApp.id}`
                },
                
                (payload) => {

                    const notif = payload.new;

                    if (notif.tipo === 'recordatorio_pago') {
                        alert(`📩 ${notif.mensaje}`);
                    }

                }
                
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
        

    }, [usuarioApp]);

    return null;
}