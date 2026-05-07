import { supabase } from '../../../services/supabaseClient';

export const EVENTOS_PAGO = {
  COBRO_CREADO: 'cobro_creado',
  COMPROBANTE_SUBIDO: 'comprobante_subido',
  COMPROBANTE_REEMPLAZADO: 'comprobante_reemplazado',
  PAGO_APROBADO: 'pago_aprobado',
  COMPROBANTE_RECHAZADO: 'comprobante_rechazado',
  PAGO_VENCIDO: 'pago_vencido'
};

export const EVENTOS_PAGO_LABELS = {
  [EVENTOS_PAGO.COBRO_CREADO]: 'Cobro creado',
  [EVENTOS_PAGO.COMPROBANTE_SUBIDO]: 'Comprobante subido',
  [EVENTOS_PAGO.COMPROBANTE_REEMPLAZADO]: 'Comprobante reemplazado',
  [EVENTOS_PAGO.PAGO_APROBADO]: 'Pago aprobado',
  [EVENTOS_PAGO.COMPROBANTE_RECHAZADO]: 'Comprobante rechazado',
  [EVENTOS_PAGO.PAGO_VENCIDO]: 'Pago vencido'
};

const normalizarIds = (ids = []) => [...new Set(ids.filter(Boolean))];

export const getPagoEventoLabel = (evento) => EVENTOS_PAGO_LABELS[evento] || evento || 'Evento';

export const agruparEventosPorPago = (eventos = []) => eventos.reduce((acc, evento) => {
  if (!evento?.pago_id) return acc;
  acc[evento.pago_id] = acc[evento.pago_id] || [];
  acc[evento.pago_id].push(evento);
  return acc;
}, {});

export const obtenerEventosPorPagos = async (pagoIds = []) => {
  const ids = normalizarIds(pagoIds);
  if (ids.length === 0) return { eventos: [], error: null };

  const { data, error } = await supabase
    .from('pagos_eventos')
    .select(`
      *,
      usuarios_app ( nombre )
    `)
    .in('pago_id', ids)
    .order('created_at', { ascending: false });

  if (error) return { eventos: [], error };
  return { eventos: data || [], error: null };
};

export const adjuntarEventosAPagos = async (pagos = []) => {
  const { eventos, error } = await obtenerEventosPorPagos(pagos.map((pago) => pago.id));
  if (error) return { pagos, error };

  const eventosPorPago = agruparEventosPorPago(eventos);
  return {
    pagos: pagos.map((pago) => ({
      ...pago,
      eventos: eventosPorPago[pago.id] || []
    })),
    error: null
  };
};

export const registrarPagoEvento = async ({
  pago,
  usuarioId,
  evento,
  estadoAnterior = null,
  estadoNuevo = null,
  mensaje = null,
  metadata = {}
}) => {
  if (!pago?.id || !pago?.conjunto_id || !pago?.residente_id || !usuarioId || !evento) {
    return { ok: false, error: new Error('Datos incompletos para registrar evento de pago') };
  }

  const { error } = await supabase.from('pagos_eventos').insert([{
    pago_id: pago.id,
    conjunto_id: pago.conjunto_id,
    residente_id: pago.residente_id,
    usuario_id: usuarioId,
    evento,
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
    mensaje,
    metadata
  }]);

  if (error) {
    console.error('Error registrando evento de pago:', error);
    return { ok: false, error };
  }

  return { ok: true, error: null };
};

export const crearNotificacionPago = async ({ usuarioId, tipo, titulo, mensaje }) => {
  if (!usuarioId || !tipo || !titulo || !mensaje) return { ok: false, error: null };

  const { error } = await supabase.from('notificaciones').insert([{
    usuario_id: usuarioId,
    tipo,
    titulo,
    mensaje
  }]);

  if (error) {
    console.error('Error creando notificación de pago:', error);
    return { ok: false, error };
  }

  return { ok: true, error: null };
};

export const notificarAdminsPago = async ({ conjuntoId, tipo, titulo, mensaje }) => {
  if (!conjuntoId || !tipo || !titulo || !mensaje) return { ok: false, error: null };

  const { data: admins, error } = await supabase
    .from('usuarios_app')
    .select('id')
    .eq('conjunto_id', conjuntoId)
    .eq('rol_id', 'admin');

  if (error) {
    console.error('Error consultando admins para notificación de pago:', error);
    return { ok: false, error };
  }

  const notificaciones = (admins || []).map((admin) => ({
    usuario_id: admin.id,
    tipo,
    titulo,
    mensaje
  }));

  if (notificaciones.length === 0) return { ok: true, error: null };

  const { error: errorInsert } = await supabase.from('notificaciones').insert(notificaciones);
  if (errorInsert) {
    console.error('Error notificando admins de pago:', errorInsert);
    return { ok: false, error: errorInsert };
  }

  return { ok: true, error: null };
};
