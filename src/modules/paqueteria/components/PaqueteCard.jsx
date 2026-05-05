const formatFechaCO = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(parsed);
};

const mapEstado = (estado) => {
  const key = String(estado || '').toLowerCase();
  if (key === 'entregado') return { label: 'Entregado', className: 'text-state-success' };
  return { label: 'Pendiente de entrega', className: 'text-state-warning' };
};

export default function PaqueteCard({ paquete }) {
  const estado = mapEstado(paquete.estado);
  const recibido = formatFechaCO(paquete.fecha_recibido);
  const entregado = formatFechaCO(paquete.fecha_entrega);
  const isServicio = paquete.categoria === 'servicio_publico';

  return (
    <article className="app-surface-primary border border-brand-primary/10 rounded-xl p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-app-text-secondary">
            {isServicio ? 'Servicio público' : 'Paquete'}
          </p>
          <h3 className="text-sm sm:text-base font-semibold text-app-text-primary break-words">
            {paquete.descripcion_visible || 'Paquete sin descripción'}
          </h3>
        </div>
        <span className={`app-badge text-xs ${isServicio ? 'app-badge-info' : 'app-badge-success'}`}>
          {isServicio ? 'Servicio público' : 'Paquete'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm">
        <div className="app-surface-muted rounded-lg p-2">
          <p className="text-app-text-secondary">Estado</p>
          <p className={`font-semibold mt-0.5 ${estado.className}`}>{estado.label}</p>
        </div>
        <div className="app-surface-muted rounded-lg p-2">
          <p className="text-app-text-secondary">Recibido</p>
          <p className="font-medium mt-0.5">{recibido || 'Sin fecha registrada'}</p>
        </div>
        <div className="app-surface-muted rounded-lg p-2">
          <p className="text-app-text-secondary">Entrega</p>
          <p className="font-medium mt-0.5">{entregado || 'Aún no entregado'}</p>
        </div>
      </div>
    </article>
  );
}
