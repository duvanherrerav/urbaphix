import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';

export default function PanelPaquetes({ usuarioApp }) {

    const [paquetes, setPaquetes] = useState([]);

    useEffect(() => {
        if (usuarioApp?.conjunto_id) {
            obtenerPaquetes();
        }
    }, [usuarioApp]);

    const obtenerPaquetes = async () => {

        const { data, error } = await supabase
            .from('paquetes')
            .select('*')
            .eq('conjunto_id', usuarioApp.conjunto_id)
            .eq('estado', 'pendiente')
            .order('fecha_recibido', { ascending: false });

        if (error) {
            console.log(error);
            return;
        }

        setPaquetes(data || []);
    };

    // 🔥 ENTREGAR PAQUETE
    const entregarPaquete = async (paquete) => {

        // 1. actualizar estado
        const { error } = await supabase
            .from('paquetes')
            .update({
                estado: 'entregado',
                fecha_entrega: new Date().toISOString()
            })
            .eq('id', paquete.id);

        if (error) {
            console.log(error);
            alert('Error al entregar paquete');
            return;
        }

        // 2. obtener usuario del residente
        const { data: residente, error: errorResidente } = await supabase
            .from('residentes')
            .select('usuario_id')
            .eq('id', paquete.residente_id)
            .single();

        if (errorResidente || !residente) {
            console.log(errorResidente);
            return;
        }

        // 3. crear notificación
        const { error: errorNotif } = await supabase
            .from('notificaciones')
            .insert([{
                usuario_id: residente.usuario_id,
                tipo: 'paquete_entregado',
                titulo: '📦 Paquete entregado',
                mensaje: `Tu paquete (${paquete.descripcion}) fue entregado`
            }]);

        if (errorNotif) {
            console.log(errorNotif);
        }

        // 4. refrescar lista
        obtenerPaquetes();
    };

    return (
        <div>
            <h2>Paquetes pendientes 📦</h2>

            {paquetes.length === 0 && <p>No hay paquetes</p>}

            {paquetes.map(p => (
                <div key={p.id} style={{
                    border: '1px solid #ccc',
                    margin: '10px',
                    padding: '10px',
                    borderRadius: '8px'
                }}>
                    <p><b>Descripción:</b> {p.descripcion}</p>

                    <p>
                        <b>Fecha:</b> {new Date(p.fecha_recibido).toLocaleDateString()}
                    </p>

                    {p.estado === 'pendiente' && (
                        <button onClick={() => entregarPaquete(p)}>
                            Entregar paquete
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}