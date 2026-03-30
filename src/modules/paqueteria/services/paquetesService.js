import { supabase } from '../../../services/supabaseClient';

const errorMessage = (error, fallback) => error?.message || fallback;

export const registrarPaquete = async (data, user) => {
  try {
    if (!user?.id) {
      throw new Error('Usuario no autenticado');
    }

    if (!data?.residente_id || !data?.descripcion) {
      throw new Error('Datos de paquete incompletos');
    }

    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios_app')
      .select('conjunto_id')
      .eq('id', user.id)
      .single();

    if (errorUsuario || !usuario?.conjunto_id) {
      throw new Error(errorMessage(errorUsuario, 'No se pudo obtener el conjunto del usuario'));
    }

    const { data: paquete, error } = await supabase
      .from('paquetes')
      .insert([{
        conjunto_id: usuario.conjunto_id,
        residente_id: data.residente_id,
        descripcion: String(data.descripcion).trim(),
        recibido_por: user.id
      }])
      .select()
      .single();

    if (error || !paquete) {
      throw new Error(errorMessage(error, 'No se pudo registrar el paquete'));
    }

    // 🔔 Notificación
    const { error: errorNotificacion } = await supabase.from('notificaciones').insert([{
      usuario_id: data.residente_id,
      tipo: 'paquete_recibido',
      titulo: 'Tienes un paquete',
      mensaje: 'Un paquete ha llegado a portería'
    }]);

    if (errorNotificacion) {
      console.warn('registrarPaquete: no se pudo crear notificación', errorNotificacion);
    }

    return { ok: true, paquete, error: null };
  } catch (error) {
    console.error('registrarPaquete error:', error);
    return { ok: false, paquete: null, error: errorMessage(error, 'Error al registrar paquete') };
  }
};

export const entregarPaquete = async (paquete_id) => {
  try {
    if (!paquete_id) {
      throw new Error('Paquete inválido');
    }

    const { data: paquete, error: errorPaquete } = await supabase
      .from('paquetes')
      .select('*')
      .eq('id', paquete_id)
      .single();

    if (errorPaquete || !paquete) {
      throw new Error(errorMessage(errorPaquete, 'No se encontró el paquete'));
    }

    const { error: errorUpdate } = await supabase
      .from('paquetes')
      .update({
        estado: 'entregado',
        fecha_entrega: new Date().toISOString()
      })
      .eq('id', paquete_id);

    if (errorUpdate) {
      throw new Error(errorMessage(errorUpdate, 'No se pudo actualizar el estado del paquete'));
    }

    // 🔔 Notificación
    const { error: errorNotificacion } = await supabase.from('notificaciones').insert([{
      usuario_id: paquete.residente_id,
      tipo: 'paquete_entregado',
      titulo: 'Paquete entregado',
      mensaje: 'Tu paquete fue entregado correctamente'
    }]);

    if (errorNotificacion) {
      console.warn('entregarPaquete: no se pudo crear notificación', errorNotificacion);
    }

    return { ok: true, paquete, error: null };
  } catch (error) {
    console.error('entregarPaquete error:', error);
    return { ok: false, paquete: null, error: errorMessage(error, 'Error al entregar paquete') };
  }
};
