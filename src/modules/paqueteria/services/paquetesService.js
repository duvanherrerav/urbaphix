import { supabase } from '@/services/supabaseClient';

export const registrarPaquete = async (data, user) => {

  const { data: usuario } = await supabase
    .from('usuarios_app')
    .select('conjunto_id')
    .eq('id', user.id)
    .single();

  const { data: paquete, error } = await supabase
    .from('paquetes')
    .insert([{
      conjunto_id: usuario.conjunto_id,
      residente_id: data.residente_id,
      descripcion: data.descripcion,
      recibido_por: user.id
    }])
    .select()
    .single();

  // 🔔 Notificación
  await supabase.from('notificaciones').insert([{
    usuario_id: data.residente_id,
    tipo: 'paquete_recibido',
    titulo: 'Tienes un paquete',
    mensaje: 'Un paquete ha llegado a portería'
  }]);

  return { paquete, error };
};

export const entregarPaquete = async (paquete_id, user) => {

  const { data: paquete } = await supabase
    .from('paquetes')
    .select('*')
    .eq('id', paquete_id)
    .single();

  await supabase
    .from('paquetes')
    .update({
      estado: 'entregado',
      fecha_entrega: new Date()
    })
    .eq('id', paquete_id);

  // 🔔 Notificación
  await supabase.from('notificaciones').insert([{
    usuario_id: paquete.residente_id,
    tipo: 'paquete_entregado',
    titulo: 'Paquete entregado',
    mensaje: 'Tu paquete fue entregado correctamente'
  }]);
};