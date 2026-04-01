import { supabase } from '../../../services/supabaseClient';

const errorMessage = (error, fallback) => error?.message || fallback;
const bogotaNowISO = () => {
  const local = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' });
  return `${local.replace(' ', 'T')}-05:00`;
};

// 🔥 CREAR COBRO
export const crearPago = async (data, user) => {

  try {
    if (!user?.id) {
      throw new Error('Usuario no autenticado');
    }

    if (!data?.residente_id || !data?.concepto || !data?.valor) {
      throw new Error('Datos del cobro incompletos');
    }

    const valorNumerico = Number(data.valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      throw new Error('El valor del cobro debe ser mayor a 0');
    }

    // 🔥 obtener conjunto del usuario
    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios_app')
      .select('conjunto_id')
      .eq('id', user.id)
      .single();

    if (errorUsuario || !usuario) {
      throw new Error(errorMessage(errorUsuario, 'No se pudo obtener el usuario'));
    }

    // 🔥 crear pago
    const tipoPago = String(data?.tipo_pago || 'administracion').trim().toLowerCase();

    const { data: pago, error } = await supabase
      .from('pagos')
      .insert([{
        conjunto_id: usuario.conjunto_id,
        residente_id: data.residente_id,
        concepto: String(data.concepto).trim(),
        tipo_pago: tipoPago,
        valor: valorNumerico,
        created_at: bogotaNowISO(),
        estado: 'pendiente'
      }])
      .select()
      .single();

    if (error) {
      throw new Error(errorMessage(error, 'No se pudo crear el cobro'));
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
        mensaje: `Tienes un cobro de $${valorNumerico}`
      }]);
    }

    return { pago, error: null };

  } catch (err) {
    console.error('Error crearPago:', err);
    return { pago: null, error: errorMessage(err, 'Error creando cobro') };
  }
};


// 🔥 REGISTRAR PAGO
export const registrarPago = async (pago_id) => {

  try {
    if (!pago_id) {
      throw new Error('Pago inválido');
    }

    const { error } = await supabase
      .from('pagos')
      .update({
        estado: 'pagado',
        fecha_pago: new Date().toISOString()
      })
      .eq('id', pago_id);

    if (error) {
      throw new Error(errorMessage(error, 'No se pudo registrar el pago'));
    }

    return { ok: true };

  } catch (err) {
    console.error('Error registrarPago:', err);
    return { ok: false, error: errorMessage(err, 'Error registrando pago') };
  }
};