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

        const qr_code = crypto.randomUUID();

        const { data: visita, error } = await supabase
            .from('visitas')
            .insert([{
                conjunto_id: usuario.conjunto_id,
                residente_id: data.residente_id,
                apartamento_id: data.apartamento_id || null,
                nombre_visitante: data.nombre.trim(),
                tipo_documento: String(data.tipo_documento).trim().toUpperCase(),
                documento: String(data.documento).trim(),
                placa: data.placa ? String(data.placa).trim().toUpperCase() : null,
                fecha_visita: data.fecha,
                hora_inicio: data.hora_inicio || null,
                hora_fin: data.hora_fin || null,
                estado: 'pendiente',
                qr_code
            }])
            .select()
            .single();

        if (error || !visita) {
            throw new Error(errorMessage(error, 'No se pudo crear la visita'));
        }

        return { ok: true, visita, qr_code, error: null };
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
            .from('visitas')
            .select('*')
            .eq('qr_code', qr_code)
            .single();

            if (errorVisita || !visita) {
            throw new Error('QR inválido o visita no encontrada');
        }

        const { error: errorAcceso } = await supabase.from('accesos').insert([{
            visita_id: visita.id,
            fecha_ingreso: new Date().toISOString()
        }]);

        if (errorAcceso) {
            throw new Error(errorMessage(errorAcceso, 'No se pudo registrar el acceso'));
        }

        const { error: errorUpdate } = await supabase
            .from('visitas')
            .update({ estado: 'ingresado' })
            .eq('id', visita.id);

        if (errorUpdate) {
            throw new Error(errorMessage(errorUpdate, 'No se pudo actualizar el estado de la visita'));
        }

        const { error: errorNotificacion } = await supabase.from('notificaciones').insert([{
            usuario_id: visita.residente_id,
            tipo: 'visita_ingreso',
            titulo: 'Tu visita ingresó',
            mensaje: `${visita.nombre_visitante} ya está en portería`
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