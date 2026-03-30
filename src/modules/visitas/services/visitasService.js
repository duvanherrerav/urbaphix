import { supabase } from '@/services/supabaseClient';

export const crearVisita = async (data, user) => {

    const { data: usuario } = await supabase
        .from('usuarios_app')
        .select('conjunto_id')
        .eq('id', user.id)
        .single();

    const qr_code = crypto.randomUUID();

    const { data: visita, error } = await supabase
        .from('visitas')
        .insert([{
            conjunto_id: usuario.conjunto_id,
            residente_id: data.residente_id,
            nombre_visitante: data.nombre,
            documento: data.documento,
            placa: data.placa,
            fecha_visita: data.fecha,
            hora_inicio: data.hora_inicio,
            hora_fin: data.hora_fin,
            qr_code
        }])
        .select()
        .single();

    return { visita, qr_code, error };
};

export const validarQR = async (qr_code) => {

    const { data: visita } = await supabase
        .from('visitas')
        .select('*')
        .eq('qr_code', qr_code)
        .single();

    if (!visita) {
        alert('QR inválido');
        return;
    }

    await supabase.from('accesos').insert([{
        visita_id: visita.id,
        fecha_ingreso: new Date()
    }]);

    await supabase
        .from('visitas')
        .update({ estado: 'ingresado' })
        .eq('id', visita.id);

    alert('Ingreso registrado');

    await supabase.from('notificaciones').insert([{
        usuario_id: visita.residente_id,
        tipo: 'visita_ingreso',
        titulo: 'Tu visita ingresó',
        mensaje: `${visita.nombre_visitante} ya está en portería`
    }]);
};