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

export function getFechaPagoKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

export function estaFechaEnRango(value, { fechaDesde = '', fechaHasta = '' } = {}) {
  if (!fechaDesde && !fechaHasta) return true;

  const fechaKey = getFechaPagoKey(value);
  if (!fechaKey) return false;

  const cumpleDesde = fechaDesde ? fechaKey >= fechaDesde : true;
  const cumpleHasta = fechaHasta ? fechaKey <= fechaHasta : true;
  return cumpleDesde && cumpleHasta;
}

function getFechaMetricaPago(pago, estadoKey) {
  if (estadoKey === ESTADOS_PAGO.PAGADO) return pago?.fecha_pago;
  if (estadoKey === ESTADOS_PAGO.VENCIDO) return pago?.fecha_vencimiento;
  return pago?.created_at;
}

function estaPagoEnRangoMetrica(pago, estadoKey, rangoFechas = {}) {
  return estaFechaEnRango(getFechaMetricaPago(pago, estadoKey), rangoFechas);
}

export function getResumenEstadosPago(pagos = [], rangoFechas = {}) {
  const resumen = ESTADOS_PAGO_FINANCIEROS.reduce((acc, estado) => ({
    ...acc,
    [estado]: { cantidad: 0, total: 0 }
  }), {});

  pagos.forEach((pago) => {
    const estadoKey = obtenerEstadoFinancieroReal(pago);
    if (!estaPagoEnRangoMetrica(pago, estadoKey, rangoFechas)) return;

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

export const ESTADOS_CARTERA_ACTIVA = Object.freeze([
  ESTADOS_PAGO.PENDIENTE,
  ESTADOS_PAGO.VENCIDO,
  ESTADOS_PAGO.EN_REVISION,
  ESTADOS_PAGO.RECHAZADO
]);

export const AGING_CARTERA_BUCKETS = Object.freeze([
  { key: '1_30', label: '1-30 días', min: 1, max: 30 },
  { key: '31_60', label: '31-60 días', min: 31, max: 60 },
  { key: '61_90', label: '61-90 días', min: 61, max: 90 },
  { key: '90_plus', label: '+90 días', min: 91, max: Infinity }
]);

export function getResumenFinancieroEjecutivo(pagos = [], rangoFechas = {}) {
  const porEstado = getResumenEstadosPago(pagos, rangoFechas);
  const totalRecaudado = porEstado[ESTADOS_PAGO.PAGADO].total;
  const totalPendiente = porEstado[ESTADOS_PAGO.PENDIENTE].total;
  const totalVencido = porEstado[ESTADOS_PAGO.VENCIDO].total;
  const totalEnValidacion = porEstado[ESTADOS_PAGO.EN_REVISION].total;
  const totalRechazado = porEstado[ESTADOS_PAGO.RECHAZADO].total;
  const carteraTotal = totalPendiente + totalVencido + totalEnValidacion + totalRechazado;
  const universoPeriodo = totalRecaudado + carteraTotal;
  const safePercent = (valor) => (universoPeriodo > 0 ? Math.round((valor / universoPeriodo) * 100) : 0);

  return {
    porEstado,
    universoPeriodo,
    carteraTotal,
    totalRecaudado,
    totalPendiente,
    totalVencido,
    totalEnValidacion,
    totalRechazado,
    porcentajeRecaudo: safePercent(totalRecaudado),
    porcentajeCarteraPendiente: safePercent(carteraTotal),
    porcentajeCarteraVencida: safePercent(totalVencido),
    pagosAprobados: porEstado[ESTADOS_PAGO.PAGADO].cantidad,
    pagosVencidos: porEstado[ESTADOS_PAGO.VENCIDO].cantidad,
    comprobantesEnRevision: porEstado[ESTADOS_PAGO.EN_REVISION].cantidad
  };
}

export function getAgingCartera(pagos = [], rangoFechas = {}) {
  const buckets = AGING_CARTERA_BUCKETS.reduce((acc, bucket) => ({
    ...acc,
    [bucket.key]: { ...bucket, total: 0, cantidad: 0 }
  }), {});

  pagos.forEach((pago) => {
    const estadoKey = obtenerEstadoFinancieroReal(pago);
    if (!ESTADOS_CARTERA_ACTIVA.includes(estadoKey)) return;

    if (!estaFechaEnRango(pago.fecha_vencimiento, rangoFechas)) return;

    const diasMora = getDiasMoraPago(pago);
    if (diasMora <= 0) return;

    const bucket = AGING_CARTERA_BUCKETS.find((item) => diasMora >= item.min && diasMora <= item.max);
    if (!bucket) return;

    buckets[bucket.key].total += getValorPago(pago);
    buckets[bucket.key].cantidad += 1;
  });

  return AGING_CARTERA_BUCKETS.map((bucket) => buckets[bucket.key]);
}

export function getTopCarteraApartamentos(pagos = [], limit = 5, rangoFechas = {}) {
  const mapa = new Map();

  pagos.forEach((pago) => {
    const estadoKey = obtenerEstadoFinancieroReal(pago);
    if (!ESTADOS_CARTERA_ACTIVA.includes(estadoKey)) return;

    if (!estaPagoEnRangoMetrica(pago, estadoKey, rangoFechas)) return;

    const apartamento = pago.apartamento || pago.residentes?.apartamentos?.numero || '-';
    const torre = pago.torre || pago.residentes?.apartamentos?.torres?.nombre || '-';
    const residente = pago.nombre || pago.residentes?.usuarios_app?.nombre || 'Residente';
    const key = `${torre}::${apartamento}::${pago.residente_id || pago.residentes?.id || residente}`;

    if (!mapa.has(key)) {
      mapa.set(key, {
        key,
        torre,
        apartamento,
        residente,
        totalAdeudado: 0,
        cantidadPagos: 0,
        maxDiasMora: 0,
        porEstado: ESTADOS_CARTERA_ACTIVA.reduce((acc, estado) => ({
          ...acc,
          [estado]: { cantidad: 0, total: 0 }
        }), {})
      });
    }

    const row = mapa.get(key);
    const valor = getValorPago(pago);
    row.totalAdeudado += valor;
    row.cantidadPagos += 1;
    row.maxDiasMora = Math.max(row.maxDiasMora, getDiasMoraPago(pago));
    row.porEstado[estadoKey].cantidad += 1;
    row.porEstado[estadoKey].total += valor;
  });

  return Array.from(mapa.values())
    .sort((a, b) => {
      const vencidoDiff = b.porEstado[ESTADOS_PAGO.VENCIDO].total - a.porEstado[ESTADOS_PAGO.VENCIDO].total;
      return vencidoDiff || b.totalAdeudado - a.totalAdeudado || b.maxDiasMora - a.maxDiasMora;
    })
    .slice(0, limit);
}
