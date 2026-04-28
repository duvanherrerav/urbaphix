export const formatFechaBogota = (value) => {
  if (!value) return '-';

  const raw = String(value).trim().replace(' ', 'T');
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(raw);
  const parsed = new Date(hasZone ? raw : `${raw}Z`);

  if (Number.isNaN(parsed.getTime())) return '-';

  return parsed.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
};
