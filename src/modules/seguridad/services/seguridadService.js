import { supabase } from '../../../services/supabaseClient';
import { puedeTransicionarEstado } from '../utils/incidenteUI';
const INCIDENTE_ESTADOS_KEY = 'urbaphix_incidentes_estado_local_v1';
const INCIDENTE_FECHAS_KEY = 'urbaphix_incidentes_fecha_local_v1';

const getEstadoLocal = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(INCIDENTE_ESTADOS_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const setEstadoLocal = (map) => {
    localStorage.setItem(INCIDENTE_ESTADOS_KEY, JSON.stringify(map));
};

const getFechasLocal = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(INCIDENTE_FECHAS_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const setFechasLocal = (map) => {
    localStorage.setItem(INCIDENTE_FECHAS_KEY, JSON.stringify(map));
};

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
                nivel: data.nivel || 'bajo'
            }])
            .select()
            .single();

        if (error) throw error;

        const fechas = getFechasLocal();
        fechas[incidente.id] = Date.now();
        setFechasLocal(fechas);

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

export const actualizarEstadoIncidente = async ({ incidenteId, estado, usuarioId, estadoActual = 'nuevo' }) => {
    try {
        const estados = getEstadoLocal();
        const estadoBase = estados[incidenteId]?.estado || estadoActual || 'nuevo';

        if (!puedeTransicionarEstado(estadoBase, estado)) {
            throw new Error('Transición de estado no permitida');
        }

        estados[incidenteId] = {
            estado,
            asignado_a: usuarioId || null,
            updated_at: new Date().toISOString()
        };
        setEstadoLocal(estados);
        return { ok: true, error: null };
    } catch (error) {
        console.error('actualizarEstadoIncidente error:', error);
        return { ok: false, error: error?.message || 'No se pudo actualizar el incidente' };
    }
};

export const obtenerEstadosIncidentesLocal = () => getEstadoLocal();
export const obtenerFechasIncidentesLocal = () => getFechasLocal();