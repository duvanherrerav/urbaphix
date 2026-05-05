import { useState } from 'react';

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

  if (key === 'pendiente') {
    return { label: 'Pendiente de entrega', badgeClass: 'app-badge-warning' };
  }

  if (key === 'entregado') {
    return { label: 'Entregado', badgeClass: 'app-badge-success' };
  }

  return { label: 'Estado no disponible', badgeClass: 'app-badge-info' };
};

export default function PaqueteCard({ paquete }) {
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const estado = mapEstado(paquete.estado);
  const recibido = formatFechaCO(paquete.fecha_recibido);
  const entregado = formatFechaCO(paquete.fecha_entrega);
  const isServicio = paquete.categoria === 'servicio_publico';
  const tipoLabel = isServicio ? 'Servicio público' : 'Paquete';
  const descripcion = paquete.descripcion_visible || 'Paquete sin descripción';
  const detalleId = paquete.id ? `paquete-detalle-${paquete.id}` : undefined;

  return (
    <article className="app-surface-primary border border-brand-primary/10 rounded-xl px-3 py-3 sm:px-4 transition-all duration-200 hover:border-brand-primary/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-app-text-secondary">
              {tipoLabel}
            </span>
            <span className={`app-badge text-xs ${estado.badgeClass}`}>{estado.label}</span>
          </div>

          <h3 className="text-sm sm:text-base font-semibold leading-snug text-app-text-primary break-words">
            {descripcion}
          </h3>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-app-text-secondary">
            <span>
              <span className="font-semibold text-app-text-primary">Recibido:</span> {recibido || 'Sin fecha registrada'}
            </span>
            <span>
              <span className="font-semibold text-app-text-primary">Entrega:</span> {entregado || 'Aún no entregado'}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="app-btn-ghost self-start whitespace-nowrap text-xs px-3 py-2"
          onClick={() => setDetalleAbierto((abierto) => !abierto)}
          aria-expanded={detalleAbierto}
          aria-controls={detalleId}
        >
          {detalleAbierto ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
      </div>

      {detalleAbierto && (
        <div id={detalleId} className="mt-3 border-t border-app-border/70 pt-3 text-xs sm:text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-app-text-secondary">Descripción</dt>
              <dd className="text-right font-medium text-app-text-primary break-words">{descripcion}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-app-text-secondary">Tipo/categoría</dt>
              <dd className="text-right font-medium text-app-text-primary">{tipoLabel}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-app-text-secondary">Estado</dt>
              <dd className="text-right font-medium text-app-text-primary">{estado.label}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-app-text-secondary">Recibido</dt>
              <dd className="text-right font-medium text-app-text-primary">{recibido || 'Sin fecha registrada'}</dd>
            </div>
            <div className="flex items-start justify-between gap-3 sm:col-span-2">
              <dt className="text-app-text-secondary">Entrega</dt>
              <dd className="text-right font-medium text-app-text-primary">{entregado || 'Aún no entregado'}</dd>
            </div>
          </dl>
        </div>
      )}
    </article>
  );
}