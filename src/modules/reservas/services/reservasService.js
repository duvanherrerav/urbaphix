import { supabase } from '../../../services/supabaseClient';

const err = (error, fallback) => error?.message || fallback;

const BASE_RESERVA_SELECT = `
  id,
  conjunto_id,
  recurso_id,
  residente_id,
  apartamento_id,
  fecha_inicio,
  fecha_fin,
  tipo_reserva,
  subtipo,
  estado,
  motivo,
  observaciones,
  metadata,
  aprobada_por,
  rechazada_por,
  checkin_por,
  checkout_por,
  created_at,
  updated_at,
  recursos_comunes ( id, nombre, tipo, requiere_aprobacion, tiempo_buffer_min )
`;

export const getRecursosComunes = async (conjuntoId) => {
    const { data, error } = await supabase
        .from('recursos_comunes')
        .select('id, conjunto_id, nombre, tipo, descripcion, activo, capacidad, requiere_aprobacion, requiere_deposito, deposito_valor, tiempo_buffer_min, reglas')
        .eq('conjunto_id', conjuntoId)
        .eq('activo', true)
        .order('nombre', { ascending: true });

    if (error) return { ok: false, data: [], error: err(error, 'No se pudieron cargar recursos') };
    return { ok: true, data: data || [], error: null };
};



export const crearRecursoComun = async ({
    conjunto_id,
    nombre,
    tipo,
    descripcion = null,
    capacidad = null,
    requiere_aprobacion = true,
    requiere_deposito = false,
    deposito_valor = null,
    tiempo_buffer_min = 0,
    reglas = {}
}) => {
    const { data, error } = await supabase
        .from('recursos_comunes')
        .insert([{
            conjunto_id,
            nombre,
            tipo,
            descripcion,
            activo: true,
            capacidad,
            requiere_aprobacion,
            requiere_deposito,
            deposito_valor,
            tiempo_buffer_min,
            reglas
        }])
        .select('id, conjunto_id, nombre, tipo, activo, capacidad, requiere_aprobacion, requiere_deposito, deposito_valor, tiempo_buffer_min, reglas')
        .single();

    if (error || !data) return { ok: false, data: null, error: err(error, 'No se pudo crear recurso') };
    return { ok: true, data, error: null };
};

export const getPerfilResidente = async (usuarioId) => {
    const { data, error } = await supabase
        .from('residentes')
        .select('id, apartamento_id, conjunto_id')
        .eq('usuario_id', usuarioId)
        .single();

    if (error || !data) return { ok: false, data: null, error: err(error, 'No se encontró perfil de residente') };
    return { ok: true, data, error: null };
};

export const crearReserva = async ({
    conjunto_id,
    recurso_id,
    residente_id,
    apartamento_id,
    fecha_inicio,
    fecha_fin,
    tipo_reserva = 'recreativa',
    subtipo = null,
    motivo = null,
    observaciones = null,
    metadata = {}
}) => {
    const payload = {
        conjunto_id,
        recurso_id,
        residente_id,
        apartamento_id: apartamento_id || null,
        fecha_inicio,
        fecha_fin,
        tipo_reserva,
        subtipo,
        motivo,
        observaciones,
        metadata,
        estado: 'solicitada'
    };

    const { data, error } = await supabase
        .from('reservas_zonas')
        .insert([payload])
        .select(BASE_RESERVA_SELECT)
        .single();

    if (error || !data) return { ok: false, data: null, error: err(error, 'No se pudo crear la reserva') };

    await registrarEventoReserva({
        reserva_id: data.id,
        conjunto_id,
        actor_id: null,
        accion: 'crear',
        detalle: 'Reserva creada'
    });

    return { ok: true, data, error: null };
};

export const listarReservas = async ({
    conjunto_id,
    residente_id = null,
    estados = [],
    fecha_desde = null,
    fecha_hasta = null,
    limit = 150
}) => {
    let q = supabase
        .from('reservas_zonas')
        .select(BASE_RESERVA_SELECT)
        .eq('conjunto_id', conjunto_id)
        .order('fecha_inicio', { ascending: false })
        .limit(limit);

    if (residente_id) q = q.eq('residente_id', residente_id);
    if (estados.length) q = q.in('estado', estados);
    if (fecha_desde) q = q.gte('fecha_inicio', fecha_desde);
    if (fecha_hasta) q = q.lte('fecha_fin', fecha_hasta);

    const { data, error } = await q;
    if (error) return { ok: false, data: [], error: err(error, 'No se pudieron cargar reservas') };
    return { ok: true, data: data || [], error: null };
};

export const cambiarEstadoReserva = async ({ reserva_id, estado, usuario_id = null, detalle = null }) => {
    const payload = { estado };

    if (estado === 'aprobada') payload.aprobada_por = usuario_id;
    if (estado === 'rechazada') payload.rechazada_por = usuario_id;
    if (estado === 'en_curso') payload.checkin_por = usuario_id;
    if (estado === 'finalizada') payload.checkout_por = usuario_id;

    const { data, error } = await supabase
        .from('reservas_zonas')
        .update(payload)
        .eq('id', reserva_id)
        .select(BASE_RESERVA_SELECT)
        .single();

    if (error || !data) return { ok: false, data: null, error: err(error, 'No se pudo actualizar estado') };

    await registrarEventoReserva({
        reserva_id,
        conjunto_id: data.conjunto_id,
        actor_id: usuario_id,
        accion: estado,
        detalle: detalle || `Cambio de estado a ${estado}`
    });

    return { ok: true, data, error: null };
};

export const registrarEventoReserva = async ({ reserva_id, conjunto_id, actor_id = null, accion, detalle = null, metadata = {} }) => {
    const { data, error } = await supabase
        .from('reservas_eventos')
        .insert([{ reserva_id, conjunto_id, actor_id, accion, detalle, metadata }])
        .select('id, reserva_id, accion, detalle, actor_id, metadata, created_at')
        .single();

    if (error) return { ok: false, data: null, error: err(error, 'No se pudo registrar evento') };
    return { ok: true, data, error: null };
};

export const listarEventosReserva = async (reservaId) => {
    const { data, error } = await supabase
        .from('reservas_eventos')
        .select('id, reserva_id, accion, detalle, actor_id, metadata, created_at')
        .eq('reserva_id', reservaId)
        .order('created_at', { ascending: false });

    if (error) return { ok: false, data: [], error: err(error, 'No se pudo cargar bitácora') };
    return { ok: true, data: data || [], error: null };
};

export const listarBloqueos = async ({ conjunto_id, recurso_id = null }) => {
    let q = supabase
        .from('reservas_bloqueos')
        .select('id, conjunto_id, recurso_id, fecha_inicio, fecha_fin, motivo, creado_por, created_at, recursos_comunes (id, nombre, tipo)')
        .eq('conjunto_id', conjunto_id)
        .order('fecha_inicio', { ascending: true });

    if (recurso_id) q = q.eq('recurso_id', recurso_id);

    const { data, error } = await q;
    if (error) return { ok: false, data: [], error: err(error, 'No se pudieron cargar bloqueos') };
    return { ok: true, data: data || [], error: null };
};

export const crearBloqueo = async ({ conjunto_id, recurso_id, fecha_inicio, fecha_fin, motivo, creado_por = null }) => {
    const { data, error } = await supabase
        .from('reservas_bloqueos')
        .insert([{ conjunto_id, recurso_id, fecha_inicio, fecha_fin, motivo, creado_por }])
        .select('id, conjunto_id, recurso_id, fecha_inicio, fecha_fin, motivo, creado_por, created_at')
        .single();

    if (error || !data) return { ok: false, data: null, error: err(error, 'No se pudo crear bloqueo') };
    return { ok: true, data, error: null };
};

export const eliminarBloqueo = async (bloqueoId) => {
    const { error } = await supabase.from('reservas_bloqueos').delete().eq('id', bloqueoId);
    if (error) return { ok: false, error: err(error, 'No se pudo eliminar bloqueo') };
    return { ok: true, error: null };
};

export const listarDocumentosReserva = async (reservaId) => {
    const { data, error } = await supabase
        .from('reservas_documentos')
        .select('id, reserva_id, conjunto_id, nombre_archivo, ruta_storage, tipo_documento, subido_por, created_at')
        .eq('reserva_id', reservaId)
        .order('created_at', { ascending: false });

    if (error) return { ok: false, data: [], error: err(error, 'No se pudieron cargar soportes') };
    return { ok: true, data: data || [], error: null };
};

export const registrarDocumentoReserva = async ({
    reserva_id,
    conjunto_id,
    nombre_archivo,
    ruta_storage,
    tipo_documento = null,
    subido_por = null
}) => {
    const { data, error } = await supabase
        .from('reservas_documentos')
        .insert([{ reserva_id, conjunto_id, nombre_archivo, ruta_storage, tipo_documento, subido_por }])
        .select('id, reserva_id, conjunto_id, nombre_archivo, ruta_storage, tipo_documento, subido_por, created_at')
        .single();

    if (error || !data) return { ok: false, data: null, error: err(error, 'No se pudo guardar soporte') };
    return { ok: true, data, error: null };
};

export const subscribeReservasConjunto = (conjuntoId, onChange) => {
    const channel = supabase
        .channel(`reservas_zonas_conjunto_${conjuntoId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'reservas_zonas', filter: `conjunto_id=eq.${conjuntoId}` },
            onChange
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};