import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { entregarPaquete as entregarPaqueteService } from '../services/paquetesService';
import toast from 'react-hot-toast';

export default function PanelPaquetes({ usuarioApp }) {

    const [paquetes, setPaquetes] = useState([]);

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

    useEffect(() => {
        const cargar = async () => {
            if (!usuarioApp?.conjunto_id) return;

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

        cargar();
    }, [usuarioApp]);

    // 🔥 ENTREGAR PAQUETE
    const entregarPaquete = async (paquete) => {
        const result = await entregarPaqueteService(paquete.id);

        if (!result.ok) {
            toast.error(`No se pudo entregar: ${result.error}`);
            return;
        }

        toast.success(`Paquete entregado: ${paquete.descripcion}`);
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