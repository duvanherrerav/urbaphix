const TIPO_PAGO_LABELS = {
  administracion: 'Administración',
  incumplimiento_rph: 'Incumplimiento RPH',
  llamado_atencion: 'Llamado de atención',
  multa: 'Multa',
  cuota_extraordinaria: 'Cuota extraordinaria',
  sin_tipo: 'Sin tipo'
};

export function getTipoPagoLabel(tipo) {
  const key = String(tipo || 'sin_tipo').trim().toLowerCase();
  return TIPO_PAGO_LABELS[key] || key.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
