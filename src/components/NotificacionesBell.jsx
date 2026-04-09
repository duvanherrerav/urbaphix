import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

export default function NotificacionesBell({ usuarioApp }) {

    const [notificaciones, setNotificaciones] = useState([]);
    const [abierto, setAbierto] = useState(false);

    const obtenerNotificaciones = async () => {
        if (!usuarioApp?.id) return;
        const { data } = await supabase
            .from('notificaciones')
            .select('*')
            .eq('usuario_id', usuarioApp.id)
            .order('created_at', { ascending: false });

        setNotificaciones(data || []);
    };

    useEffect(() => {
        if (!usuarioApp?.id) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        obtenerNotificaciones();

        const channel = supabase
            .channel('notificaciones')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notificaciones'
                },
                (payload) => {
                    if (payload.new.usuario_id === usuarioApp.id) {
                        obtenerNotificaciones();
                    }
                }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);

    }, [usuarioApp?.id]);

    const marcarComoLeidas = async () => {

        const noLeidas = notificaciones.filter(n => !n.leido);

        if (noLeidas.length === 0) return;

        const ids = noLeidas.map(n => n.id);

        const { error } = await supabase
            .from('notificaciones')
            .update({ leido: true })
            .in('id', ids);

        if (!error) {
            obtenerNotificaciones(); // refresca
        }
    };

    const marcarUna = async (id) => {
        await supabase
            .from('notificaciones')
            .update({ leido: true })
            .eq('id', id);

        obtenerNotificaciones();
    };

    const noLeidas = notificaciones.filter(n => !n.leido).length;

    return (
        <div style={{ position: 'relative' }}>

            {/* 🔔 ICONO */}
            <button onClick={() => {
                setAbierto(!abierto);
                marcarComoLeidas();
            }}>
                🔔 {noLeidas > 0 && `(${noLeidas})`}
            </button>

            {/* 📥 PANEL */}
            {abierto && (
                <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '40px',
                    width: '300px',
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '10px',
                    padding: '10px',
                    boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
                }}>

                    <h4>Notificaciones</h4>

                    {notificaciones.length === 0 && (
                        <p style={{ color: '#888' }}>No hay notificaciones</p>
                    )}

                    {notificaciones.map(n => (
                        <div
                            key={n.id}
                            onClick={() => marcarUna(n.id)}
                            style={{
                                cursor: 'pointer',
                                padding: '10px',
                                borderBottom: '1px solid #eee',
                                background: n.leido ? '#fff' : '#f5f5f5'
                            }}
                        >
                            <b>{n.titulo}</b>
                            <p><small style={{ color: '#888' }}>
                                {new Date(n.created_at).toLocaleString()}
                            </small>{n.mensaje}</p>
                        </div>
                    ))}

                </div>
            )}
        </div>
    );
}
