export const ESTADOS_PAGO = Object.freeze({
  PENDIENTE: 'pendiente',
  EN_REVISION: 'en_revision',
  PAGADO: 'pagado',
  RECHAZADO: 'rechazado'
});

export const ESTADOS_PAGO_VALIDOS = Object.freeze(Object.values(ESTADOS_PAGO));

const ESTADO_PAGO_UI = Object.freeze({
  [ESTADOS_PAGO.PENDIENTE]: {
    key: ESTADOS_PAGO.PENDIENTE,
    label: 'Pendiente de pago',
    badge: 'app-badge-warning'
  },
  [ESTADOS_PAGO.EN_REVISION]: {
    key: ESTADOS_PAGO.EN_REVISION,
    label: 'Comprobante en revisión',
    badge: 'app-badge-info'
  },
  [ESTADOS_PAGO.PAGADO]: {
    key: ESTADOS_PAGO.PAGADO,
    label: 'Pago aprobado',
    badge: 'app-badge-success'
  },
  [ESTADOS_PAGO.RECHAZADO]: {
    key: ESTADOS_PAGO.RECHAZADO,
    label: 'Comprobante rechazado',
    badge: 'app-badge-error'
  }
});

const STEPPER_BY_ESTADO = Object.freeze({
  [ESTADOS_PAGO.PENDIENTE]: ['generado'],
  [ESTADOS_PAGO.EN_REVISION]: ['generado', 'comprobante'],
  [ESTADOS_PAGO.PAGADO]: ['generado', 'comprobante', 'aprobado'],
  [ESTADOS_PAGO.RECHAZADO]: ['generado', 'comprobante']
});

const BASE_STEPPER_STEPS = Object.freeze([
  { key: 'generado', label: 'Generado' },
  { key: 'comprobante', label: 'Comprobante' },
  { key: 'aprobado', label: 'Aprobado' }
]);

export function getEstadoPagoKey(estado) {
  const key = String(estado || ESTADOS_PAGO.PENDIENTE).trim().toLowerCase();
  return ESTADOS_PAGO_VALIDOS.includes(key) ? key : ESTADOS_PAGO.PENDIENTE;
}

export function getEstadoPagoUi(estado) {
  return ESTADO_PAGO_UI[getEstadoPagoKey(estado)];
}

export function getPagoStepperSteps(estado) {
  const estadoKey = getEstadoPagoKey(estado);
  const activeSteps = STEPPER_BY_ESTADO[estadoKey] || STEPPER_BY_ESTADO[ESTADOS_PAGO.PENDIENTE];
  const isRejected = estadoKey === ESTADOS_PAGO.RECHAZADO;

  return BASE_STEPPER_STEPS.map((step) => ({
    ...step,
    label: isRejected && step.key === 'comprobante' ? 'Rechazado' : step.label,
    active: activeSteps.includes(step.key),
    rejected: isRejected && (step.key === 'comprobante' || step.key === 'aprobado')
  }));
}

export function estaPagoRechazado(estado) {
  return getEstadoPagoKey(estado) === ESTADOS_PAGO.RECHAZADO;
}

export function puedeSubirComprobante(estado) {
  const estadoKey = getEstadoPagoKey(estado);
  return estadoKey === ESTADOS_PAGO.PENDIENTE || estadoKey === ESTADOS_PAGO.RECHAZADO;
}

export function estaPagoPagado(estado) {
  return getEstadoPagoKey(estado) === ESTADOS_PAGO.PAGADO;
}

export function estaPagoEnRevision(estado) {
  return getEstadoPagoKey(estado) === ESTADOS_PAGO.EN_REVISION;
}
