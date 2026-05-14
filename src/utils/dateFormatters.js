const BOGOTA_TIME_ZONE = 'America/Bogota';
const OFFSET_SUFFIX_REGEX = /(Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const parseUtcTimestampToDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim().replace(' ', 'T');
  const isoUtcValue = OFFSET_SUFFIX_REGEX.test(raw)
    ? raw
    : `${raw}${DATE_ONLY_REGEX.test(raw) ? 'T00:00:00' : ''}Z`;
  const parsed = new Date(isoUtcValue);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatFechaBogota = (value) => {
  const parsed = parseUtcTimestampToDate(value);

  if (!parsed) return '-';

  return parsed.toLocaleDateString('es-CO', { timeZone: BOGOTA_TIME_ZONE });
};

export const formatFechaHoraBogota = (value, fallback = '—') => {
  const parsed = parseUtcTimestampToDate(value);

  if (!parsed) return fallback;

  return parsed.toLocaleString('es-CO', {
    timeZone: BOGOTA_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};
