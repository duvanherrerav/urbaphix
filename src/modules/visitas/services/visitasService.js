import { supabase } from '../../../services/supabaseClient';

const errorMessage = (error, fallback) => error?.message || fallback;

export const crearVisita = async (data, user) => {
    try {
        if (!user?.id) {
            throw new Error('Usuario no autenticado');
        }

        if (!data?.residente_id || !data?.nombre || !data?.documento || !data?.fecha || !data?.tipo_documento) {
            throw new Error('Datos de visita incompletos');
        }

        const { data: usuario, error: errorUsuario } = await supabase
            .from('usuarios_app')
            .select('conjunto_id')
            .eq('id', user.id)
            .single();

        if (errorUsuario || !usuario?.conjunto_id) {
            throw new Error(errorMessage(errorUsuario, 'No se pudo obtener el conjunto del usuario'));
        }

        const { data: rpcData, error } = await supabase.rpc('fn_crear_o_reutilizar_visitante_y_registro', {
            p_conjunto_id: usuario.conjunto_id,
            p_residente_id: data.residente_id,
            p_apartamento_id: data.apartamento_id || null,
            p_nombre: data.nombre.trim(),
            p_tipo_documento: String(data.tipo_documento).trim().toUpperCase(),
            p_documento: String(data.documento).trim(),
            p_tipo_vehiculo: data.tipo_vehiculo || null,
            p_placa: data.placa ? String(data.placa).trim().toUpperCase() : null,
            p_fecha_visita: data.fecha
        });

        const first = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (error || !first?.registro_id) {
            throw new Error(errorMessage(error, 'No se pudo crear la visita'));
        }

        return {
            ok: true,
            visita: { id: first.registro_id, visitante_id: first.visitante_id, fecha_visita: data.fecha, estado: 'pendiente' },
            qr_code: first.qr_code,
            error: null
        };
    } catch (error) {
        console.error('crearVisita error:', error);
        return { ok: false, visita: null, qr_code: null, error: errorMessage(error, 'Error creando visita') };
    }
};

export const validarQR = async (qr_code) => {
    try {
        if (!qr_code) {
            throw new Error('QR inválido');
        }

        const { data: visita, error: errorVisita } = await supabase
            .from('registro_visitas')
            .select(`
                *,
                visitantes (
                    id,
                    nombre,
                    documento,
                    residente_id
                )
            `)
            .eq('qr_code', qr_code)
            .single();

        if (errorVisita || !visita) {
            throw new Error('QR inválido o visita no encontrada');
        }

        const { error: errorUpdate } = await supabase
            .from('registro_visitas')
            .update({
                estado: 'ingresado',
                hora_ingreso: new Date().toISOString()
            })
            .eq('id', visita.id);

        if (errorUpdate) {
            throw new Error(errorMessage(errorUpdate, 'No se pudo actualizar el estado de la visita'));
        }

        const { error: errorNotificacion } = await supabase.from('notificaciones').insert([{
            usuario_id: visita.visitantes?.residente_id,
            tipo: 'visita_ingreso',
            titulo: 'Tu visita ingresó',
            mensaje: `${visita.visitantes?.nombre || 'Tu visitante'} ya está en portería`
        }]);

        if (errorNotificacion) {
            console.warn('validarQR: no se pudo crear la notificación', errorNotificacion);
        }

        return { ok: true, visita, error: null };
    } catch (error) {
        console.error('validarQR error:', error);
        return { ok: false, visita: null, error: errorMessage(error, 'No se pudo validar el QR') };
    }
};
