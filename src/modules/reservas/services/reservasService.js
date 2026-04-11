import { supabase } from '../../../services/supabaseClient';
import { esEstadoReservaValido, puedeTransicionarReserva } from '../domain/reservaStateMachine';

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

const ESTADOS_ACTIVOS_RESERVA = ['solicitada', 'aprobada', 'en_curso'];
const DISPONIBILIDAD_DEFAULT = Object.freeze({
    version: 1,
    timezone: 'America/Bogota',
    modo: 'slots',
    slots: {
        hora_apertura: '06:00',
        hora_cierre: '22:00',
        duracion_min: 60,
        intervalo_min: 30
    },
    bloques_fijos: []
});

const addMinutes = (isoDate, minutes) => new Date(new Date(isoDate).getTime() + (minutes * 60 * 1000));

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

const pad2 = (n) => String(n).padStart(2, '0');

const formatLocalDateTime = (date) => (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    + `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
);

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const uuidLike = (v) => typeof v === 'string' && v.trim().length > 0;

const toMinutes = (hhmm) => {
    if (typeof hhmm !== 'string' || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return (h * 60) + m;
};

const fromMinutesToHHMM = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

const buildDateTimeFromMinutes = (fecha, minutes) => `${fecha}T${fromMinutesToHHMM(minutes)}:00`;

const getBogotaNowParts = () => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const byType = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
    return {
        date: `${byType.year}-${byType.month}-${byType.day}`,
        time: `${byType.hour}:${byType.minute}:${byType.second}`
    };
};

const normalizarDisponibilidad = (reglas = {}, { duracionOverride = null } = {}) => {
    const base = {
        version: 1,
        timezone: DISPONIBILIDAD_DEFAULT.timezone,
        modo: DISPONIBILIDAD_DEFAULT.modo,
        slots: { ...DISPONIBILIDAD_DEFAULT.slots },
        bloques_fijos: []
    };

    const disponibilidad = isPlainObject(reglas?.disponibilidad) ? reglas.disponibilidad : {};
    if (disponibilidad.modo === 'bloques_fijos' || disponibilidad.modo === 'slots') {
        base.modo = disponibilidad.modo;
    }

    const slotsCfg = isPlainObject(disponibilidad.slots) ? disponibilidad.slots : {};
    const apertura = toMinutes(slotsCfg.hora_apertura ?? base.slots.hora_apertura);
    const cierre = toMinutes(slotsCfg.hora_cierre ?? base.slots.hora_cierre);
    const aperturaMin = apertura ?? toMinutes(base.slots.hora_apertura);
    const cierreMin = cierre ?? toMinutes(base.slots.hora_cierre);
    const aperturaFinal = aperturaMin;
    const cierreFinal = cierreMin > aperturaFinal ? cierreMin : toMinutes(base.slots.hora_cierre);

    const duracionRaw = Number.isFinite(Number(duracionOverride))
        ? Number(duracionOverride)
        : Number(slotsCfg.duracion_min ?? base.slots.duracion_min);
    const intervaloRaw = Number(slotsCfg.intervalo_min ?? base.slots.intervalo_min);

    base.slots = {
        hora_apertura: fromMinutesToHHMM(aperturaFinal),
        hora_cierre: fromMinutesToHHMM(cierreFinal),
        duracion_min: clamp(Math.round(duracionRaw || 60), 15, 24 * 60),
        intervalo_min: clamp(Math.round(intervaloRaw || 30), 5, 24 * 60)
    };

    const bloquesRaw = Array.isArray(disponibilidad.bloques_fijos) ? disponibilidad.bloques_fijos : [];
    base.bloques_fijos = bloquesRaw
        .map((b, idx) => {
            if (!isPlainObject(b)) return null;
            const inicioMin = toMinutes(b.hora_inicio);
            const finMin = toMinutes(b.hora_fin);
            if (inicioMin === null || finMin === null || finMin <= inicioMin) return null;
            return {
                id: uuidLike(b.id) ? b.id : `bloque_${idx + 1}`,
                label: typeof b.label === 'string' && b.label.trim() ? b.label.trim() : `Bloque ${idx + 1}`,
                hora_inicio: fromMinutesToHHMM(inicioMin),
                hora_fin: fromMinutesToHHMM(finMin)
            };
        })
        .filter(Boolean);

    if (base.modo === 'bloques_fijos' && base.bloques_fijos.length === 0) {
        base.modo = 'slots';
    }

    return base;
};

const isReservaEnPasadoBogota = (fecha_inicio, fecha_fin) => {
    const now = getBogotaNowParts();
    const nowComparable = `${now.date}T${now.time}`;
    return fecha_inicio < nowComparable || fecha_fin <= nowComparable;
};

export const humanizeReservaError = (error, fallback = 'No se pudo completar la operación') => {
    const message = err(error, fallback);
    const lowered = String(message || '').toLowerCase();

    if (lowered.includes('row-level security') || lowered.includes('permission denied')) {
        return 'No tienes permisos para esta acción en tu conjunto o perfil.';
    }

    if (lowered.includes('reservas_zonas_no_solape') || lowered.includes('conflict')) {
        return 'Ya existe una reserva activa en ese horario para el recurso seleccionado.';
    }

    if (lowered.includes('network') || lowered.includes('fetch')) {
        return 'No hay conexión disponible. Intenta nuevamente.';
    }

    return message;
};

export const getRecursosComunes = async (conjuntoId) => {
    const { data, error } = await supabase
        .from('recursos_comunes')
        .select('id, conjunto_id, nombre, tipo, descripcion, activo, capacidad, requiere_aprobacion, requiere_deposito, deposito_valor, tiempo_buffer_min, reglas')
        .eq('conjunto_id', conjuntoId)
        .eq('activo', true)
        .order('nombre', { ascending: true });

    if (error) return { ok: false, data: [], error: humanizeReservaError(error, 'No se pudieron cargar recursos') };
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

    if (error || !data) return { ok: false, data: null, error: humanizeReservaError(error, 'No se pudo crear recurso') };
    return { ok: true, data, error: null };
};

export const getPerfilResidente = async (usuarioId) => {
    const { data, error } = await supabase
        .from('residentes')
        .select('id, apartamento_id, conjunto_id')
        .eq('usuario_id', usuarioId)
        .single();

    if (error || !data) return { ok: false, data: null, error: humanizeReservaError(error, 'No se encontró perfil de residente') };
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
    if (isReservaEnPasadoBogota(fecha_inicio, fecha_fin)) {
        return { ok: false, data: null, error: 'No puedes crear reservas en horarios pasados (hora de Bogotá).' };
    }

    const validacionDisponibilidad = await validarDisponibilidadReserva({
        conjunto_id,
        recurso_id,
        fecha_inicio,
        fecha_fin
    });

    if (!validacionDisponibilidad.ok) {
        return { ok: false, data: null, error: validacionDisponibilidad.error };
    }

    if (!validacionDisponibilidad.data.disponible) {
        const sugerencias = validacionDisponibilidad.data.sugerencias?.slice(0, 3) || [];
        const suffix = sugerencias.length ? ` Te sugerimos: ${sugerencias.join(', ')}` : '';
        return { ok: false, data: null, error: `Este horario no está disponible.${suffix}` };
    }

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

    if (error || !data) return { ok: false, data: null, error: humanizeReservaError(error, 'No se pudo crear la reserva') };

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
    if (error) return { ok: false, data: [], error: humanizeReservaError(error, 'No se pudieron cargar reservas') };
    return { ok: true, data: data || [], error: null };
};

export const cambiarEstadoReserva = async ({
    reserva_id,
    estado,
    usuario_id = null,
    usuario_rol = null,
    usuario_residente_id = null,
    detalle = null
}) => {
    if (!esEstadoReservaValido(estado)) {
        return { ok: false, data: null, error: `Estado objetivo inválido: ${estado}` };
    }

    const { data: reservaActual, error: errorReservaActual } = await supabase
        .from('reservas_zonas')
        .select('id, estado, residente_id, conjunto_id')
        .eq('id', reserva_id)
        .single();

    if (errorReservaActual || !reservaActual) {
        return { ok: false, data: null, error: humanizeReservaError(errorReservaActual, 'No se encontró la reserva a actualizar') };
    }

    const validacion = puedeTransicionarReserva({
        estadoActual: reservaActual.estado,
        estadoObjetivo: estado,
        rolUsuario: usuario_rol,
        esDueno: usuario_rol === 'residente' && usuario_residente_id === reservaActual.residente_id
    });

    if (!validacion.ok) {
        return { ok: false, data: null, error: validacion.error };
    }

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

    if (error || !data) return { ok: false, data: null, error: humanizeReservaError(error, 'No se pudo actualizar estado') };

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

    if (error) return { ok: false, data: null, error: humanizeReservaError(error, 'No se pudo registrar evento') };
    return { ok: true, data, error: null };
};

export const listarEventosReserva = async (reservaId) => {
    const { data, error } = await supabase
        .from('reservas_eventos')
        .select('id, reserva_id, accion, detalle, actor_id, metadata, created_at')
        .eq('reserva_id', reservaId)
        .order('created_at', { ascending: false });

    if (error) return { ok: false, data: [], error: humanizeReservaError(error, 'No se pudo cargar bitácora') };
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
    if (error) return { ok: false, data: [], error: humanizeReservaError(error, 'No se pudieron cargar bloqueos') };
    return { ok: true, data: data || [], error: null };
};

export const crearBloqueo = async ({ conjunto_id, recurso_id, fecha_inicio, fecha_fin, motivo, creado_por = null }) => {
    const { data, error } = await supabase
        .from('reservas_bloqueos')
        .insert([{ conjunto_id, recurso_id, fecha_inicio, fecha_fin, motivo, creado_por }])
        .select('id, conjunto_id, recurso_id, fecha_inicio, fecha_fin, motivo, creado_por, created_at')
        .single();

    if (error || !data) return { ok: false, data: null, error: humanizeReservaError(error, 'No se pudo crear bloqueo') };
    return { ok: true, data, error: null };
};

export const eliminarBloqueo = async (bloqueoId) => {
    const { error } = await supabase.from('reservas_bloqueos').delete().eq('id', bloqueoId);
    if (error) return { ok: false, error: humanizeReservaError(error, 'No se pudo eliminar bloqueo') };
    return { ok: true, error: null };
};

export const listarDocumentosReserva = async (reservaId) => {
    const { data, error } = await supabase
        .from('reservas_documentos')
        .select('id, reserva_id, conjunto_id, nombre_archivo, ruta_storage, tipo_documento, subido_por, created_at')
        .eq('reserva_id', reservaId)
        .order('created_at', { ascending: false });

    if (error) return { ok: false, data: [], error: humanizeReservaError(error, 'No se pudieron cargar soportes') };
    return { ok: true, data: data || [], error: null };
};

export const listarDocumentosReservas = async (reservaIds = []) => {
    if (!reservaIds.length) return { ok: true, data: {}, error: null };

    const { data, error } = await supabase
        .from('reservas_documentos')
        .select('id, reserva_id, conjunto_id, nombre_archivo, ruta_storage, tipo_documento, subido_por, created_at')
        .in('reserva_id', reservaIds)
        .order('created_at', { ascending: false });

    if (error) return { ok: false, data: {}, error: humanizeReservaError(error, 'No se pudieron cargar soportes') };

    const byReserva = (data || []).reduce((acc, doc) => {
        if (!acc[doc.reserva_id]) acc[doc.reserva_id] = [];
        acc[doc.reserva_id].push(doc);
        return acc;
    }, {});

    return { ok: true, data: byReserva, error: null };
};

export const validarDisponibilidadReserva = async ({
    conjunto_id,
    recurso_id,
    fecha_inicio,
    fecha_fin,
    reserva_id_excluir = null
}) => {
    const { data: recurso, error: errorRecurso } = await supabase
        .from('recursos_comunes')
        .select('id, tiempo_buffer_min')
        .eq('id', recurso_id)
        .eq('conjunto_id', conjunto_id)
        .single();

    if (errorRecurso || !recurso) {
        return { ok: false, data: null, error: humanizeReservaError(errorRecurso, 'No se pudo validar disponibilidad del recurso') };
    }

    const bufferMin = Number(recurso.tiempo_buffer_min || 0);
    const inicioConBuffer = formatLocalDateTime(addMinutes(fecha_inicio, -bufferMin));
    const finConBuffer = formatLocalDateTime(addMinutes(fecha_fin, bufferMin));

    let qReservas = supabase
        .from('reservas_zonas')
        .select('id, fecha_inicio, fecha_fin, estado')
        .eq('conjunto_id', conjunto_id)
        .eq('recurso_id', recurso_id)
        .in('estado', ESTADOS_ACTIVOS_RESERVA)
        .lt('fecha_inicio', finConBuffer)
        .gt('fecha_fin', inicioConBuffer);

    if (reserva_id_excluir) qReservas = qReservas.neq('id', reserva_id_excluir);

    const { data: reservasActivas, error: errorReservas } = await qReservas;
    if (errorReservas) return { ok: false, data: null, error: humanizeReservaError(errorReservas, 'No se pudo validar solapes de reserva') };

    const { data: bloqueos, error: errorBloqueos } = await supabase
        .from('reservas_bloqueos')
        .select('id, fecha_inicio, fecha_fin')
        .eq('conjunto_id', conjunto_id)
        .eq('recurso_id', recurso_id)
        .lt('fecha_inicio', finConBuffer)
        .gt('fecha_fin', inicioConBuffer);

    if (errorBloqueos) return { ok: false, data: null, error: humanizeReservaError(errorBloqueos, 'No se pudo validar bloqueos del recurso') };

    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);

    const conflictoReserva = (reservasActivas || []).some((r) => {
        const rInicio = addMinutes(r.fecha_inicio, -bufferMin);
        const rFin = addMinutes(r.fecha_fin, bufferMin);
        return overlaps(inicio, fin, rInicio, rFin);
    });

    const conflictoBloqueo = (bloqueos || []).some((b) =>
        overlaps(inicio, fin, new Date(b.fecha_inicio), new Date(b.fecha_fin))
    );

    const disponible = !conflictoReserva && !conflictoBloqueo;
    let sugerencias = [];
    if (!disponible) {
        const fecha = new Date(fecha_inicio).toISOString().slice(0, 10);
        const duracionMin = Math.max(30, Math.round((fin.getTime() - inicio.getTime()) / (60 * 1000)));
        const dispResp = await getDisponibilidadRecurso({ conjunto_id, recurso_id, fecha, duracionMin });
        if (dispResp.ok) {
            sugerencias = (dispResp.data.slots || []).slice(0, 4).map((s) => `${s.inicio} - ${s.fin}`);
        }
    }

    return {
        ok: true,
        data: {
            disponible,
            conflictoReserva,
            conflictoBloqueo,
            bufferMin,
            sugerencias
        },
        error: null
    };
};

export const getDisponibilidadRecurso = async ({
    conjunto_id,
    recurso_id,
    fecha,
    duracionMin = null
}) => {
    const { data: recurso, error: errorRecurso } = await supabase
        .from('recursos_comunes')
        .select('id, tiempo_buffer_min, reglas')
        .eq('id', recurso_id)
        .eq('conjunto_id', conjunto_id)
        .single();

    if (errorRecurso || !recurso) {
        return { ok: false, data: null, error: humanizeReservaError(errorRecurso, 'No se pudo cargar disponibilidad del recurso') };
    }

    const bufferMin = Number(recurso.tiempo_buffer_min || 0);
    const config = normalizarDisponibilidad(recurso.reglas || {}, { duracionOverride: duracionMin });
    const dayStart = `${fecha}T00:00:00`;
    const dayEnd = `${fecha}T23:59:59`;

    const { data: reservas, error: errorReservas } = await supabase
        .from('reservas_zonas')
        .select('id, fecha_inicio, fecha_fin, estado')
        .eq('conjunto_id', conjunto_id)
        .eq('recurso_id', recurso_id)
        .in('estado', ESTADOS_ACTIVOS_RESERVA)
        .lt('fecha_inicio', dayEnd)
        .gt('fecha_fin', dayStart);

    if (errorReservas) return { ok: false, data: null, error: humanizeReservaError(errorReservas, 'No se pudo cargar reservas activas del recurso') };

    const { data: bloqueos, error: errorBloqueos } = await supabase
        .from('reservas_bloqueos')
        .select('id, fecha_inicio, fecha_fin')
        .eq('conjunto_id', conjunto_id)
        .eq('recurso_id', recurso_id)
        .lt('fecha_inicio', dayEnd)
        .gt('fecha_fin', dayStart);

    if (errorBloqueos) return { ok: false, data: null, error: humanizeReservaError(errorBloqueos, 'No se pudo cargar bloqueos del recurso') };

    const reservasSinBuffer = (reservas || []).map((r) => ({
        inicio: new Date(r.fecha_inicio),
        fin: new Date(r.fecha_fin)
    }));
    const franjasBuffer = reservasSinBuffer.map((r) => ({
        inicio: addMinutes(r.inicio, -bufferMin),
        fin: addMinutes(r.fin, bufferMin)
    }));
    const franjasBloqueadas = (bloqueos || []).map((b) => ({
        inicio: new Date(b.fecha_inicio),
        fin: new Date(b.fecha_fin)
    }));

    const candidatos = [];
    if (config.modo === 'slots') {
        const aperturaMin = toMinutes(config.slots.hora_apertura);
        const cierreMin = toMinutes(config.slots.hora_cierre);
        const duracion = config.slots.duracion_min;
        const intervalo = config.slots.intervalo_min;

        let cursorMin = aperturaMin;
        while ((cursorMin + duracion) <= cierreMin) {
            candidatos.push({
                id: `slot_${cursorMin}_${cursorMin + duracion}`,
                inicioMin: cursorMin,
                finMin: cursorMin + duracion
            });
            cursorMin += intervalo;
        }
    } else {
        config.bloques_fijos.forEach((b) => {
            const inicioMin = toMinutes(b.hora_inicio);
            const finMin = toMinutes(b.hora_fin);
            if (inicioMin === null || finMin === null || finMin <= inicioMin) return;
            candidatos.push({
                id: b.id,
                label: b.label,
                inicioMin,
                finMin
            });
        });
    }

    const franjas = [];
    const slots = [];
    const bogotaNow = getBogotaNowParts();
    const esHoyBogota = fecha === bogotaNow.date;
    const nowComparable = `${bogotaNow.date}T${bogotaNow.time}`;

    candidatos.forEach((candidate) => {
        const fecha_inicio = buildDateTimeFromMinutes(fecha, candidate.inicioMin);
        const fecha_fin = buildDateTimeFromMinutes(fecha, candidate.finMin);
        const slotStart = new Date(fecha_inicio);
        const slotEnd = new Date(fecha_fin);
        const slotStartComparable = `${fecha}T${fromMinutesToHHMM(candidate.inicioMin)}:00`;
        const paso = esHoyBogota && slotStartComparable < nowComparable;
        const bloqueada = franjasBloqueadas.some((f) => overlaps(slotStart, slotEnd, f.inicio, f.fin));
        const ocupada = reservasSinBuffer.some((f) => overlaps(slotStart, slotEnd, f.inicio, f.fin));
        const invalidaBuffer = !ocupada && franjasBuffer.some((f) => overlaps(slotStart, slotEnd, f.inicio, f.fin));

        let estado = 'disponible';
        if (paso) estado = 'pasada';
        else if (bloqueada) estado = 'bloqueada';
        else if (ocupada) estado = 'ocupada';
        else if (invalidaBuffer) estado = 'invalida_buffer';

        const franja = {
            id: candidate.id,
            label: candidate.label || null,
            inicio: fromMinutesToHHMM(candidate.inicioMin),
            fin: fromMinutesToHHMM(candidate.finMin),
            fecha_inicio,
            fecha_fin,
            estado,
            seleccionable: estado === 'disponible'
        };

        franjas.push(franja);
        if (franja.seleccionable) {
            slots.push({
                inicio: franja.inicio,
                fin: franja.fin,
                fecha_inicio,
                fecha_fin
            });
        }
    });

    return {
        ok: true,
        data: {
            franjas,
            slots,
            bufferMin,
            config,
            fallbackAplicado: !isPlainObject(recurso.reglas?.disponibilidad)
        },
        error: null
    };
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

    if (error || !data) return { ok: false, data: null, error: humanizeReservaError(error, 'No se pudo registrar soporte') };
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
