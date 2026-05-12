export const ESTADOS_VISITA = Object.freeze({
  PENDIENTE: 'pendiente',
  INGRESADO: 'ingresado',
  SALIDO: 'salido',
  CANCELADO: 'cancelado'
});

const MENSAJES_BLOQUEO_INGRESO = Object.freeze({
  [ESTADOS_VISITA.INGRESADO]: 'Esta visita ya fue utilizada',
  [ESTADOS_VISITA.SALIDO]: 'La visita ya fue finalizada',
  [ESTADOS_VISITA.CANCELADO]: 'La visita fue cancelada'
});

export const normalizarEstadoVisita = (estado) => String(estado || '').trim().toLowerCase();

export const validarEstadoParaIngresoQR = (estado) => {
  const estadoNormalizado = normalizarEstadoVisita(estado);

  if (estadoNormalizado === ESTADOS_VISITA.PENDIENTE) {
    return { ok: true, estado: estadoNormalizado };
  }

  const mensajeBloqueo = MENSAJES_BLOQUEO_INGRESO[estadoNormalizado];
  if (mensajeBloqueo) {
    return { ok: false, estado: estadoNormalizado, error: mensajeBloqueo };
  }

  return {
    ok: false,
    estado: estadoNormalizado,
    error: 'Estado de visita no permitido para ingreso'
  };
};
