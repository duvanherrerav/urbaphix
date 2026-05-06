export const ESTADOS_PAGO = Object.freeze({
  PENDIENTE: 'pendiente',
  VENCIDO: 'vencido',
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
  [ESTADOS_PAGO.VENCIDO]: {
    key: ESTADOS_PAGO.VENCIDO,
    label: 'Pago vencido',
    badge: 'app-badge-error'
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
  [ESTADOS_PAGO.VENCIDO]: ['generado', 'comprobante'],
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

export function calcularDiasMora(fechaVencimiento, fechaReferencia = new Date()) {
  if (!fechaVencimiento) return 0;

  const vencimiento = new Date(fechaVencimiento);
  const referencia = fechaReferencia instanceof Date ? fechaReferencia : new Date(fechaReferencia);

  if (Number.isNaN(vencimiento.getTime()) || Number.isNaN(referencia.getTime())) return 0;

  const inicioVencimiento = new Date(vencimiento.getFullYear(), vencimiento.getMonth(), vencimiento.getDate()).getTime();
  const inicioReferencia = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate()).getTime();
  const diferencia = inicioReferencia - inicioVencimiento;

  return Math.max(0, Math.floor(diferencia / 86400000));
}

export function esPagoVencido(pago, fechaReferencia = new Date()) {
  if (!pago || typeof pago !== 'object') return false;

  const estadoKey = getEstadoPagoKey(pago.estado);
  const esEstadoMorable = estadoKey === ESTADOS_PAGO.PENDIENTE || estadoKey === ESTADOS_PAGO.RECHAZADO || estadoKey === ESTADOS_PAGO.VENCIDO;
  const fechaVencimiento = pago.fecha_vencimiento;
  if (!esEstadoMorable || !fechaVencimiento) return false;

  const vencimiento = new Date(fechaVencimiento);
  const referencia = fechaReferencia instanceof Date ? fechaReferencia : new Date(fechaReferencia);

  return !Number.isNaN(vencimiento.getTime())
    && !Number.isNaN(referencia.getTime())
    && vencimiento.getTime() < referencia.getTime();
}

export function obtenerEstadoFinancieroReal(pago, fechaReferencia = new Date()) {
  if (!pago || typeof pago !== 'object') return getEstadoPagoKey(pago);
  const estadoKey = getEstadoPagoKey(pago.estado);

  if (estadoKey === ESTADOS_PAGO.PAGADO || estadoKey === ESTADOS_PAGO.EN_REVISION) {
    return estadoKey;
  }

  return esPagoVencido(pago, fechaReferencia) ? ESTADOS_PAGO.VENCIDO : estadoKey;
}

export function getEstadoPagoUi(estadoOrPago) {
  const estadoKey = typeof estadoOrPago === 'object'
    ? obtenerEstadoFinancieroReal(estadoOrPago)
    : getEstadoPagoKey(estadoOrPago);
  return ESTADO_PAGO_UI[estadoKey];
}

export function getPagoStepperSteps(pagoOrEstado) {
  const estadoKey = typeof pagoOrEstado === 'object'
    ? obtenerEstadoFinancieroReal(pagoOrEstado)
    : getEstadoPagoKey(pagoOrEstado);
  const activeSteps = STEPPER_BY_ESTADO[estadoKey] || STEPPER_BY_ESTADO[ESTADOS_PAGO.PENDIENTE];
  const isRejected = estadoKey === ESTADOS_PAGO.RECHAZADO;
  const isOverdue = estadoKey === ESTADOS_PAGO.VENCIDO;

  return BASE_STEPPER_STEPS.map((step) => ({
    ...step,
    label: isRejected && step.key === 'comprobante' ? 'Rechazado' : step.label,
    active: activeSteps.includes(step.key),
    rejected: isRejected && (step.key === 'comprobante' || step.key === 'aprobado'),
    overdue: isOverdue && step.key === 'comprobante'
  }));
}

export function estaPagoRechazado(estado) {
  return getEstadoPagoKey(estado) === ESTADOS_PAGO.RECHAZADO;
}

export function puedeSubirComprobante(estadoOrPago) {
  const estadoKey = typeof estadoOrPago === 'object'
    ? getEstadoPagoKey(estadoOrPago?.estado)
    : getEstadoPagoKey(estadoOrPago);
  return estadoKey === ESTADOS_PAGO.PENDIENTE || estadoKey === ESTADOS_PAGO.RECHAZADO || estadoKey === ESTADOS_PAGO.VENCIDO;
}

export function estaPagoPagado(estado) {
  return getEstadoPagoKey(estado) === ESTADOS_PAGO.PAGADO;
}

export function estaPagoEnRevision(estado) {
  return getEstadoPagoKey(estado) === ESTADOS_PAGO.EN_REVISION;
}

export function estaPagoVencido(pago) {
  return obtenerEstadoFinancieroReal(pago) === ESTADOS_PAGO.VENCIDO;
}

export const ESTADOS_PAGO_FINANCIEROS = Object.freeze([
  ESTADOS_PAGO.PENDIENTE,
  ESTADOS_PAGO.VENCIDO,
  ESTADOS_PAGO.EN_REVISION,
  ESTADOS_PAGO.PAGADO,
  ESTADOS_PAGO.RECHAZADO
]);

export function getValorPago(pago) {
  return Number(pago?.valor || 0);
}

export function getDiasMoraPago(pago) {
  if (!pago || typeof pago !== 'object') return 0;
  const diasCalculados = calcularDiasMora(pago.fecha_vencimiento);
  const diasPersistidos = Number(pago.dias_mora || 0);
  return Math.max(diasCalculados, Number.isFinite(diasPersistidos) ? diasPersistidos : 0);
}

export function getResumenEstadosPago(pagos = []) {
  const resumen = ESTADOS_PAGO_FINANCIEROS.reduce((acc, estado) => ({
    ...acc,
    [estado]: { cantidad: 0, total: 0 }
  }), {});

  pagos.forEach((pago) => {
    const estadoKey = obtenerEstadoFinancieroReal(pago);
    const valor = getValorPago(pago);

    resumen[estadoKey].cantidad += 1;
    resumen[estadoKey].total += valor;
  });

  return resumen;
}

export function esPagoDeudaActiva(pagoOrEstado) {
  const estadoKey = typeof pagoOrEstado === 'object'
    ? obtenerEstadoFinancieroReal(pagoOrEstado)
    : getEstadoPagoKey(pagoOrEstado);
  return estadoKey === ESTADOS_PAGO.PENDIENTE || estadoKey === ESTADOS_PAGO.RECHAZADO || estadoKey === ESTADOS_PAGO.VENCIDO;
}

export function esPagoCartera(pagoOrEstado) {
  const estadoKey = typeof pagoOrEstado === 'object'
    ? obtenerEstadoFinancieroReal(pagoOrEstado)
    : getEstadoPagoKey(pagoOrEstado);
  return estadoKey !== ESTADOS_PAGO.PAGADO;
}
