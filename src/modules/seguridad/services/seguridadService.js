import { supabase } from '../../../services/supabaseClient';
import { ESTADOS_INCIDENCIA, puedeTransicionarEstado } from '../utils/incidenteUI';
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

const ESTADO_POR_DEFECTO = 'nuevo';
const TIPO_POR_DEFECTO = 'seguridad';

const normalizarEstado = (estado) => {
    const estadoNormalizado = String(estado || '').trim().toLowerCase();
    return ESTADOS_INCIDENCIA.includes(estadoNormalizado) ? estadoNormalizado : ESTADO_POR_DEFECTO;
};

const validarEstadoEntrada = (estado) => {
    const estadoTexto = String(estado || '').trim();
    const estadoNormalizado = normalizarEstado(estadoTexto);
    return {
        estadoNormalizado,
        esValido: estadoTexto.length > 0 && estadoNormalizado === estadoTexto.toLowerCase()
    };
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

        const payload = {
            conjunto_id: conjuntoId,
            reportado_por: user.id,
            descripcion: data.descripcion,
            nivel: data.nivel || 'bajo',
            estado: normalizarEstado(data.estado),
            tipo: data.tipo || TIPO_POR_DEFECTO,
            ubicacion_texto: data.ubicacion_texto || null,
            evidencia_url: data.evidencia_url || null,
            resolucion: data.resolucion || null,
            impacto_economico: data.impacto_economico || null
        };

        const { data: incidente, error } = await supabase
            .from('incidentes')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        const fechas = getFechasLocal();
        fechas[incidente.id] = Date.now();
        setFechasLocal(fechas);

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

export const actualizarEstadoIncidente = async ({ incidenteId, estado, usuarioId, estadoActual = ESTADO_POR_DEFECTO }) => {
    try {
        const { estadoNormalizado: estadoDestino, esValido } = validarEstadoEntrada(estado);
        if (!esValido) {
            throw new Error('Estado inválido');
        }

        const { data: incidenteActual, error: incidenteError } = await supabase
            .from('incidentes')
            .select('id, estado')
            .eq('id', incidenteId)
            .single();

        if (incidenteError) throw incidenteError;

        // La fuente de verdad para el estado es DB; localStorage solo funciona como espejo/fallback UI.
        const estadoBaseDb = normalizarEstado(incidenteActual?.estado);
        const estadoBaseFallback = normalizarEstado(estadoActual);
        const estadoBase = estadoBaseDb || estadoBaseFallback || ESTADO_POR_DEFECTO;

        const esMismoEstado = estadoBase === estadoDestino;
        if (!esMismoEstado && !puedeTransicionarEstado(estadoBase, estadoDestino)) {
            const estadosActuales = getEstadoLocal();
            estadosActuales[incidenteId] = {
                ...(estadosActuales[incidenteId] || {}),
                estado: estadoBase,
                updated_at: new Date().toISOString()
            };
            setEstadoLocal(estadosActuales);
            throw new Error(`Transición de estado no permitida (estado actual: ${estadoBase})`);
        }

        const { error: updateError } = await supabase
            .from('incidentes')
            .update({ estado: estadoDestino })
            .eq('id', incidenteId);

        if (updateError) throw updateError;

        const estados = getEstadoLocal();
        estados[incidenteId] = {
            estado: estadoDestino,
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

export const actualizarGestionIncidente = async ({ incidenteId, resolucion, impacto_economico, evidencia_url, estado }) => {
    try {
        const payload = {};

        if (typeof resolucion !== 'undefined') payload.resolucion = resolucion || null;
        if (typeof impacto_economico !== 'undefined') payload.impacto_economico = impacto_economico || null;
        if (typeof evidencia_url !== 'undefined') payload.evidencia_url = evidencia_url || null;
        if (typeof estado !== 'undefined') {
            const { estadoNormalizado, esValido } = validarEstadoEntrada(estado);
            if (!esValido) {
                throw new Error('Estado inválido');
            }
            payload.estado = estadoNormalizado;
        }

        if (Object.keys(payload).length === 0) {
            return { ok: true, error: null };
        }

        const { error } = await supabase
            .from('incidentes')
            .update(payload)
            .eq('id', incidenteId);

        if (error) throw error;
        return { ok: true, error: null };
    } catch (error) {
        console.error('actualizarGestionIncidente error:', error);
        return { ok: false, error: error?.message || 'No se pudo actualizar la gestión del incidente' };
    }
};

export const obtenerEstadosIncidentesLocal = () => getEstadoLocal();
export const obtenerFechasIncidentesLocal = () => getFechasLocal();
