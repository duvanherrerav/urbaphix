import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';

export default function PanelVigilancia({ usuarioApp }) {

    const [visitas, setVisitas] = useState([]);

    useEffect(() => {
        obtenerVisitas();
    }, []);

    const obtenerVisitas = async () => {
        
        const hoy = new Date();
        const hace7dias = new Date();

        hace7dias.setDate(hoy.getDate() - 7);

        const fechaInicio = hace7dias.toLocaleString("sv-SE", { timeZone: "America/Bogota" }).replace(' ', ' ')

        const { data, error } = await supabase
            .from('visitas')
            .select('*')
            .eq('conjunto_id', usuarioApp.conjunto_id)
            .gte('fecha_visita', fechaInicio)
            .order('hora_ingreso', {ascending: false})
            .order('hora_salida', {ascending: false})
            .order('fecha_visita', { ascending: false })

        if (error) {
            console.log(error);
            return;
        }

        setVisitas(data || []);
    };

    // 🔥 DAR INGRESO
    const darIngreso = async (id) => {

        const { error } = await supabase
            .from('visitas')
            .update({
                estado: 'ingresado',
                hora_ingreso: new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }).replace(' ', ' ')
            })
            .eq('id', id);

        if (error) {
            console.log(error);
            alert('Error al registrar ingreso');
        } else {
            obtenerVisitas();
        }
    };

    // 🔥 REGISTRAR SALIDA
    const registrarSalida = async (id) => {

        const { error } = await supabase
            .from('visitas')
            .update({
                estado: 'salido',
                hora_salida: new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }).replace(' ', ' ')
            })
            .eq('id', id);

        if (error) {
            console.log(error);
            alert('Error al registrar salida');
        } else {
            obtenerVisitas();
        }
    };

    return (
        <div>
            <h2>Panel de Vigilancia 👮‍♂️</h2>

            {visitas.length === 0 && <p>No hay visitas hoy</p>}

            {visitas.map(v => (
                <div key={v.id} style={{
                    border: '1px solid #ccc',
                    margin: '10px',
                    padding: '10px',
                    borderRadius: '8px'
                }}>

                    <p><b>Visitante:</b> {v.nombre_visitante}</p>
                    <p><b>Documento:</b> {v.documento}</p>
                    <p><b>Fecha:</b> {v.fecha_visita}</p>
                    <p><b>Placa:</b> {v.placa || 'No'}</p>

                    <p>
                        <b>Estado:</b>
                        <span style={{
                            color:
                                v.estado === 'pendiente' ? 'orange' :
                                    v.estado === 'ingresado' ? 'blue' :
                                        'green'
                        }}>
                            {' '}{v.estado}
                        </span>
                    </p>

                    {v.hora_ingreso && (
                        <p style={{ color: 'blue' }}>
                            ⏱ Ingreso: {new Date(v.hora_ingreso).toLocaleString("sv-SE", { timeZone: "America/Bogota" }).replace(' ', ' ')}
                        </p>
                    )}

                    {v.hora_salida && (
                        <p style={{ color: 'green' }}>
                            ✅ Salida: {new Date(v.hora_salida).toLocaleString("sv-SE", { timeZone: "America/Bogota" }).replace(' ', ' ')}
                        </p>
                    )}

                    {/* 🔥 BOTONES */}
                    {v.estado === 'pendiente' && (
                        <button onClick={() => darIngreso(v.id)}>
                            Dar ingreso
                        </button>
                    )}

                    {v.estado === 'ingresado' && (
                        <button onClick={() => registrarSalida(v.id)}>
                            Registrar salida
                        </button>
                    )}

                </div>
            ))}
        </div>
    );
}