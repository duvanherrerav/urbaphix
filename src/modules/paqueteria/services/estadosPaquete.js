export const ESTADOS_PAQUETE = Object.freeze({
  PENDIENTE: 'pendiente',
  ENTREGADO: 'entregado'
});

export const FILTROS_PAQUETE = Object.freeze({
  TODOS: 'todos',
  PENDIENTE: ESTADOS_PAQUETE.PENDIENTE,
  ENTREGADO: ESTADOS_PAQUETE.ENTREGADO
});

export const normalizarEstadoPaquete = (estado) => String(estado || '').trim().toLowerCase();
