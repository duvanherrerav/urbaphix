import { useId, useState } from 'react';

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
    return { key, label: 'Pendiente de entrega', className: 'text-state-warning' };
  }

  if (key === 'entregado') {
    return { key, label: 'Entregado', className: 'text-state-success' };
  }

  return { key: 'desconocido', label: 'Estado no disponible', className: 'text-app-text-secondary' };
};

const buildDetalleTimeline = ({ estadoKey, recibido, entregado }) => {
  const recibidoLabel = recibido ? `Recibido el ${recibido}` : 'Fecha de recepción no registrada';

  if (estadoKey === 'pendiente') {
    return {
      items: [
        { title: 'Paquete registrado', description: 'Portería dejó este paquete asociado a tu apartamento.' },
        { title: recibidoLabel, description: 'Quedó disponible para seguimiento desde Mis paquetes.' },
        { title: 'Pendiente de entrega', description: 'Sigue esperando confirmación de entrega.' }
      ],
      insight: 'Este paquete aún no ha sido entregado en portería.'
    };
  }

  if (estadoKey === 'entregado') {
    return {
      items: [
        { title: 'Paquete registrado', description: 'Portería dejó este paquete asociado a tu apartamento.' },
        { title: recibidoLabel, description: 'Quedó disponible para seguimiento desde Mis paquetes.' },
        {
          title: 'Entrega completada',
          description: entregado ? `Entregado el ${entregado}` : 'La entrega quedó registrada sin fecha visible.'
        }
      ],
      insight: 'La entrega fue registrada correctamente.'
    };
  }

  return {
    items: [
      { title: 'Paquete registrado', description: 'Existe un registro asociado a tu apartamento.' },
      { title: recibidoLabel, description: 'Esta es la información disponible hasta ahora.' },
      { title: 'Estado no disponible', description: 'No se pudo determinar si ya fue entregado.' }
    ],
    insight: 'No hay información suficiente sobre el estado actual.'
  };
};

export default function PaqueteCard({ paquete }) {
  const [detalleVisible, setDetalleVisible] = useState(false);
  const detalleId = useId();
  const estado = mapEstado(paquete.estado);
  const recibido = formatFechaCO(paquete.fecha_recibido);
  const entregado = formatFechaCO(paquete.fecha_entrega);
  const isServicio = paquete.categoria === 'servicio_publico';
  const detalle = buildDetalleTimeline({ estadoKey: estado.key, recibido, entregado });

  return (
    <article
      className={`app-surface-primary rounded-xl p-3 sm:p-4 space-y-3 transition-colors ${
        detalleVisible ? 'border border-brand-primary/35 bg-brand-primary/5' : 'border border-brand-primary/10'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-app-text-secondary">
            {isServicio ? 'Servicio público' : 'Paquete'}
          </p>
          <h3 className="text-sm sm:text-base font-semibold text-app-text-primary break-words">
            {paquete.descripcion_visible || 'Paquete sin descripción'}
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
        <div className="app-surface-muted rounded-lg p-2">
          <p className="text-app-text-secondary">Recibido</p>
          <p className="font-medium mt-0.5">{recibido || 'Sin fecha registrada'}</p>
        </div>
        <div className="app-surface-muted rounded-lg p-2">
          <p className="text-app-text-secondary">Entrega</p>
          <p className="font-medium mt-0.5">{entregado || 'Aún no entregado'}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="app-btn-ghost text-xs"
          aria-expanded={detalleVisible}
          aria-controls={detalleId}
          onClick={() => setDetalleVisible((visible) => !visible)}
        >
          {detalleVisible ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
      </div>

      {detalleVisible && (
        <div id={detalleId} className="rounded-xl border border-brand-primary/15 bg-app-bg/30 p-3 sm:p-4">
          <ol className="space-y-3">
            {detalle.items.map((item, index) => (
              <li key={`${item.title}-${index}`} className="flex gap-3">
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    index === detalle.items.length - 1 ? 'bg-brand-primary' : 'bg-brand-primary/45'
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-app-text-primary break-words">{item.title}</p>
                  <p className="mt-0.5 text-xs sm:text-sm text-app-text-secondary break-words">{item.description}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-4 rounded-lg border border-brand-primary/10 bg-brand-primary/10 p-3 text-xs sm:text-sm text-app-text-primary">
            {detalle.insight}
          </p>
        </div>
      )}
    </article>
  );
}