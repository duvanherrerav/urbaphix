import { supabase } from '../../../services/supabaseClient';

export const crearIncidente = async (data, user) => {
    try {
        if (!user?.id) {
            throw new Error('Usuario no autenticado');
        }

        if (!data?.descripcion) {
            throw new Error('Descripción requerida');
        }

        const conjuntoId = user.conjunto_id
            ? user.conjunto_id
            : (await supabase
                .from('usuarios_app')
                .select('conjunto_id')
                .eq('id', user.id)
                .single()).data?.conjunto_id;

        if (!conjuntoId) {
            throw new Error('No fue posible determinar el conjunto');
        }

        // 🔹 Crear incidente
        const { data: incidente, error } = await supabase
            .from('incidentes')
            .insert([{
                conjunto_id: conjuntoId,
                reportado_por: user.id,
                descripcion: data.descripcion,
                nivel: data.nivel || 'bajo',
                estado: 'nuevo'
            }])
            .select()
            .single();

        if (error) throw error;

        // 🔔 Notificación a admin
        await supabase.from('notificaciones').insert([{
            tipo: 'alerta_critica',
            titulo: '🚨 Incidente crítico',
            mensaje: data.descripcion
        }]);

        return { incidente, error: null };
    } catch (error) {
        console.error('crearIncidente error:', error);
        return { incidente: null, error: error?.message || 'No se pudo registrar el incidente' };
    }
};

export const actualizarEstadoIncidente = async ({ incidenteId, estado, usuarioId }) => {
    try {
        const { error } = await supabase
            .from('incidentes')
            .update({
                estado,
                asignado_a: usuarioId || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', incidenteId);

        if (error) throw error;
        return { ok: true, error: null };
    } catch (error) {
        console.error('actualizarEstadoIncidente error:', error);
        return { ok: false, error: error?.message || 'No se pudo actualizar el incidente' };
    }
};