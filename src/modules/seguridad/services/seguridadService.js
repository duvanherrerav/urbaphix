import { supabase } from '@/services/supabaseClient';

export const crearIncidente = async (data, user) => {

    // 🔹 Obtener conjunto
    const { data: usuario } = await supabase
        .from('usuarios_app')
        .select('conjunto_id')
        .eq('id', user.id)
        .single();

    // 🔹 Crear incidente
    const { data: incidente, error } = await supabase
        .from('incidentes')
        .insert([{
            conjunto_id: usuario.conjunto_id,
            reportado_por: user.id,
            descripcion: data.descripcion,
            nivel: data.nivel
        }])
        .select()
        .single();

    // 🔔 Notificación a admin
    await supabase.from('notificaciones').insert([{
        tipo: 'incidente',
        titulo: 'Nuevo incidente',
        mensaje: data.descripcion
    }]);
    if (data.nivel === 'alto') {
        await supabase.from('notificaciones').insert([{
            tipo: 'alerta_critica',
            titulo: '🚨 Incidente crítico',
            mensaje: data.descripcion
        }]);
    }
    return { incidente, error };
};