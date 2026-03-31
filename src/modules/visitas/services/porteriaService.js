import { supabase } from '../../../services/supabaseClient';

const QUEUE_KEY = 'urbaphix_porteria_queue_v1';
const BITACORA_LOCAL_KEY = 'urbaphix_porteria_bitacora_local_v1';
const INVALID_QR_KEY = 'urbaphix_invalid_qr_counter_v1';
const SLA_UMBRAL_MINUTOS = 15;

const parseJson = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const sanitizeArrayStorage = (key) => {
  const parsed = parseJson(localStorage.getItem(key), []);
  const safe = Array.isArray(parsed) ? parsed : [];
  localStorage.setItem(key, JSON.stringify(safe));
  return safe;
};

const sanitizeObjectStorage = (key) => {
  const parsed = parseJson(localStorage.getItem(key), {});
  const safe = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  localStorage.setItem(key, JSON.stringify(safe));
  return safe;
};

export const migrarStoragePorteria = () => {
  try {
    sanitizeArrayStorage(QUEUE_KEY);
    sanitizeArrayStorage(BITACORA_LOCAL_KEY);
    sanitizeObjectStorage(INVALID_QR_KEY);
    return { ok: true };
  } catch (error) {
    console.error('migrarStoragePorteria error:', error);
    return { ok: false, error: error?.message || 'No se pudo migrar el storage local de portería' };
  }
};

export const enqueueOfflineAction = (action) => {
  const actual = parseJson(localStorage.getItem(QUEUE_KEY), []);
  const payload = [...actual, { ...action, queued_at: new Date().toISOString() }];
  localStorage.setItem(QUEUE_KEY, JSON.stringify(payload));
};

export const getOfflineQueue = () => {
  const parsed = parseJson(localStorage.getItem(QUEUE_KEY), []);
  return Array.isArray(parsed) ? parsed : [];
};

export const clearOfflineQueue = () => localStorage.removeItem(QUEUE_KEY);

const saveLocalAudit = (entry) => {
  const actual = parseJson(localStorage.getItem(BITACORA_LOCAL_KEY), []);
  localStorage.setItem(BITACORA_LOCAL_KEY, JSON.stringify([{ ...entry, local_only: true }, ...actual].slice(0, 200)));
};

export const registrarBitacora = async ({ usuarioApp, visitaId, accion, detalle, metadata = {} }) => {
  const evento = {
    visita_id: visitaId || null,
    accion,
    detalle,
    usuario_id: usuarioApp?.id || null,
    dispositivo: navigator.userAgent,
    metadata,
    created_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase.from('bitacora_porteria').insert([evento]);
    if (error) {
      saveLocalAudit(evento);
    }
  } catch {
    saveLocalAudit(evento);
  }
};

export const calcularSLA = (visitas) => {
  const muestras = visitas.filter((v) => v.hora_ingreso && v.created_at);

  if (!muestras.length) {
    return { promedioMinutos: 0, demoras: 0, muestras: 0 };
  }

  const minutos = muestras.map((v) => {
    const inicio = new Date(v.created_at).getTime();
    const ingreso = new Date(v.hora_ingreso).getTime();
    return Math.max(0, Math.round((ingreso - inicio) / 60000));
  });

  const promedioMinutos = Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length);
  const demoras = minutos.filter((m) => m > SLA_UMBRAL_MINUTOS).length;

  return { promedioMinutos, demoras, muestras: muestras.length };
};

export const validarReglasAcceso = (visita, ahora = new Date()) => {
  const hoy = ahora.toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
  if (visita.fecha_visita !== hoy) {
    return { ok: false, error: 'La visita no corresponde al día actual' };
  }

  if (visita.estado === 'ingresado') return { ok: false, error: 'Esta visita ya fue utilizada' };
  if (visita.estado === 'salido') return { ok: false, error: 'La visita ya fue finalizada' };

  const hhmm = ahora.toLocaleTimeString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 5);
  if (visita.hora_inicio && hhmm < visita.hora_inicio) {
    return { ok: false, error: `Ingreso permitido desde ${visita.hora_inicio}` };
  }

  if (visita.hora_fin && hhmm > visita.hora_fin) {
    return { ok: false, error: `Ventana de acceso vencida (${visita.hora_fin})` };
  }

  return { ok: true };
};

export const registrarIntentoQRInvalido = async ({ qrRaw, usuarioApp }) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const key = `${hoy}:${qrRaw}`;
  const state = parseJson(localStorage.getItem(INVALID_QR_KEY), {});
  const intentos = (state[key] || 0) + 1;
  state[key] = intentos;
  localStorage.setItem(INVALID_QR_KEY, JSON.stringify(state));

  if (intentos < 3 || !usuarioApp?.conjunto_id) return intentos;

  const { data: admins } = await supabase
    .from('usuarios_app')
    .select('id')
    .eq('conjunto_id', usuarioApp.conjunto_id)
    .eq('rol_id', 'admin');

  if (admins?.length) {
    const notifs = admins.map((a) => ({
      usuario_id: a.id,
      tipo: 'seguridad_alerta',
      titulo: '⚠️ Intentos QR inválido',
      mensaje: `Se detectaron ${intentos} intentos inválidos en portería`
    }));
    await supabase.from('notificaciones').insert(notifs);
  }

  await registrarBitacora({
    usuarioApp,
    accion: 'alerta_qr_invalido',
    detalle: `Escalado a administración por ${intentos} intentos inválidos`,
    metadata: { qrRaw }
  });

  return intentos;
};

export const syncOfflineQueue = async (usuarioApp) => {
  const queue = getOfflineQueue();
  if (!queue.length) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      if (item.type === 'visita_estado') {
        const { error } = await supabase
          .from('visitas')
          .update(item.payload)
          .eq('id', item.visita_id);

        if (error) throw error;

        await registrarBitacora({
          usuarioApp,
          visitaId: item.visita_id,
          accion: 'sync_offline_visita',
          detalle: `Sincronizado estado ${item.payload.estado}`,
          metadata: { queued_at: item.queued_at }
        });
      }
      processed += 1;
    } catch {
      failed += 1;
      remaining.push(item);
    }
  }

  if (remaining.length) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } else {
    clearOfflineQueue();
  }

  return { processed, failed };
};

export const obtenerSeguridadConsolidada = async (conjuntoId) => {
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
  const [visitas, incidentes, paquetes] = await Promise.all([
    supabase.from('visitas').select('id, estado, created_at, hora_ingreso').eq('conjunto_id', conjuntoId).eq('fecha_visita', hoy),
    supabase.from('incidentes').select('id').eq('conjunto_id', conjuntoId).gte('created_at', `${hoy} 00:00:00`),
    supabase.from('paquetes').select('id, estado').eq('conjunto_id', conjuntoId).gte('fecha_recibido', `${hoy} 00:00:00`)
  ]);

  const visitasData = visitas.data || [];
  const incidentesData = incidentes.data || [];
  const paquetesData = paquetes.data || [];

  const turno = (createdAt) => {
    const h = Number(new Date(createdAt).toLocaleTimeString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 2));
    if (h < 14) return 'mañana';
    if (h < 22) return 'tarde';
    return 'noche';
  };

  const porTurno = visitasData.reduce((acc, v) => {
    const key = turno(v.created_at || new Date().toISOString());
    acc[key] += 1;
    return acc;
  }, { mañana: 0, tarde: 0, noche: 0 });

  return {
    visitasHoy: visitasData.length,
    incidentesHoy: incidentesData.length,
    paquetesPendientes: paquetesData.filter((p) => p.estado === 'pendiente').length,
    porTurno
  };
};
