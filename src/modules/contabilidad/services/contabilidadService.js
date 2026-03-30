import { supabase } from '../../../services/supabaseClient';

// 🔥 CREAR COBRO
export const crearPago = async (data, user) => {

  try {

    // 🔥 obtener conjunto del usuario
    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios_app')
      .select('conjunto_id')
      .eq('id', user.id)
      .single();

    if (errorUsuario || !usuario) {
      throw new Error('No se pudo obtener el usuario');
    }

    // 🔥 crear pago
    const { data: pago, error } = await supabase
      .from('pagos')
      .insert([{
        conjunto_id: usuario.conjunto_id,
        residente_id: data.residente_id,
        concepto: data.concepto,
        valor: data.valor,
        estado: 'pendiente'
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // 🔥 obtener usuario_app del residente
    const { data: residente } = await supabase
      .from('residentes')
      .select('usuario_id')
      .eq('id', data.residente_id)
      .single();

    // 🔔 notificación
    if (residente?.usuario_id) {
      await supabase.from('notificaciones').insert([{
        usuario_id: residente.usuario_id,
        tipo: 'nuevo_cobro',
        titulo: '💰 Nuevo cobro',
        mensaje: `Tienes un cobro de $${data.valor}`
      }]);
    }

    return { pago, error: null };

  } catch (err) {
    console.log('Error crearPago:', err);
    return { pago: null, error: err.message };
  }
};


// 🔥 REGISTRAR PAGO
export const registrarPago = async (pago_id) => {

  try {

    const { error } = await supabase
      .from('pagos')
      .update({
        estado: 'pagado',
        fecha_pago: new Date().toISOString()
      })
      .eq('id', pago_id);

    if (error) {
      throw error;
    }

    return { ok: true };

  } catch (err) {
    console.log('Error registrarPago:', err);
    return { ok: false, error: err.message };
  }
};