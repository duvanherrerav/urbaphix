export const ESTADOS_INCIDENCIA = ['nuevo', 'en_gestion', 'resuelto', 'cerrado'];

export const ESTADO_LABELS = {
  nuevo: 'Nuevo',
  en_gestion: 'En gestión',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado'
};

export const ESTADO_BADGE_CLASS = {
  nuevo: 'app-badge-warning',
  en_gestion: 'app-badge-info',
  resuelto: 'app-badge-success',
  cerrado: 'app-badge-success'
};

export const ESTADO_SIGUIENTE = {
  nuevo: 'en_gestion',
  en_gestion: 'resuelto',
  resuelto: 'cerrado',
  cerrado: null
};

export const ESTADO_ACCION_LABEL = {
  en_gestion: 'Iniciar gestión',
  resuelto: 'Marcar como resuelto',
  cerrado: 'Cerrar incidente'
};

export const CATEGORIA_LABELS = {
  convivencia: 'Convivencia',
  seguridad: 'Seguridad',
  infraestructura: 'Infraestructura',
  acceso: 'Acceso'
};

export const CATEGORIA_BADGE_CLASS = {
  convivencia: 'app-badge-warning',
  seguridad: 'app-badge-error',
  infraestructura: 'app-badge-info',
  acceso: 'app-badge-info'
};

export const PRIORIDAD_ORDEN = { alto: 0, medio: 1, bajo: 2 };

export const NIVEL_LABEL = {
  alto: 'Alta',
  medio: 'Media',
  bajo: 'Baja'
};

export const NIVEL_BADGE_CLASS = {
  alto: 'app-badge-error',
  medio: 'app-badge-warning',
  bajo: 'app-badge-info'
};

export const getEstadoLabel = (estado) => ESTADO_LABELS[estado] || ESTADO_LABELS.nuevo;

export const getEstadoActual = (estadosLocal, incidenteId) => estadosLocal?.[incidenteId]?.estado || 'nuevo';

export const getSiguienteEstado = (estadoActual) => ESTADO_SIGUIENTE[estadoActual] || null;

export const puedeTransicionarEstado = (estadoActual, estadoDestino) => getSiguienteEstado(estadoActual) === estadoDestino;

export const getAccionEstado = (estadoActual) => {
  const siguiente = getSiguienteEstado(estadoActual);
  if (!siguiente) return null;

  return {
    estadoDestino: siguiente,
    label: ESTADO_ACCION_LABEL[siguiente] || 'Actualizar estado'
  };
};

export const getRadicadoAmigable = (incidenteId) => {
  if (!incidenteId || typeof incidenteId !== 'string') return '-';
  return `INC-${incidenteId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
};

export const parseDescripcionIncidente = (descripcion = '') => {
  const contenido = String(descripcion || '').trim();
  const matchCategoria = contenido.match(/^\[([^\]]+)\]\s*(.*)$/i);
  const categoriaKey = matchCategoria?.[1]?.trim().toLowerCase() || 'seguridad';
  const afterCategoria = (matchCategoria?.[2] || contenido).trim();
  const matchUbicacion = afterCategoria.match(/^\(([^)]+)\)\s*(.*)$/);

  return {
    categoria: categoriaKey,
    categoriaLabel: CATEGORIA_LABELS[categoriaKey] || 'Seguridad',
    categoriaClass: CATEGORIA_BADGE_CLASS[categoriaKey] || 'app-badge-info',
    ubicacion: matchUbicacion?.[1]?.trim() || null,
    descripcionLimpia: (matchUbicacion?.[2] || afterCategoria || contenido).trim() || 'Sin descripción'
  };
};