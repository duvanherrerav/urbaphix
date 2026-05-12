import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

export default function NotificacionesBell({ usuarioApp }) {

    const [notificaciones, setNotificaciones] = useState([]);
    const [abierto, setAbierto] = useState(false);
    const usuarioId = usuarioApp?.id;

    const obtenerNotificaciones = useCallback(async () => {
        if (!usuarioId) {
            setNotificaciones([]);
            return;
        }

        const { data } = await supabase
            .from('notificaciones')
            .select('*')
            .eq('usuario_id', usuarioId)
            .order('created_at', { ascending: false });

        setNotificaciones(data || []);
    }, [usuarioId]);

    useEffect(() => {
        if (!usuarioId) return undefined;

        Promise.resolve().then(() => obtenerNotificaciones());

        const channel = supabase
            .channel(`notificaciones-${usuarioId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notificaciones',
                    filter: `usuario_id=eq.${usuarioId}`
                },
                () => obtenerNotificaciones()
            )
            .subscribe();

        return () => supabase.removeChannel(channel);

    }, [obtenerNotificaciones, usuarioId]);

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
                        <p>No hay notificaciones</p>
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