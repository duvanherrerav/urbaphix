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
    return {
      key,
      label: 'Pendiente',
      badgeClassName: 'app-badge-warning',
      dotClassName: 'bg-state-warning'
    };
  }

  if (key === 'entregado') {
    return {
      key,
      label: 'Entregado',
      badgeClassName: 'app-badge-success',
      dotClassName: 'bg-state-success'
    };
  }

  return {
    key: 'desconocido',
    label: 'Desconocido',
    badgeClassName: 'border-app-border bg-app-bg text-app-text-secondary',
    dotClassName: 'bg-app-text-secondary'
  };
};

const buildDetalleTimeline = ({ estadoKey, recibido, entregado }) => {
  const recibidoDescription = recibido ? `Recibido el ${recibido}` : 'Recepción sin fecha registrada';

  if (estadoKey === 'pendiente') {
    return [
      { title: 'Paquete registrado', description: recibidoDescription, state: 'done' },
      { title: 'Pendiente de entrega', description: 'Esperando confirmación', state: 'current' }
    ];
  }

  if (estadoKey === 'entregado') {
    return [
      { title: 'Paquete registrado', description: recibidoDescription, state: 'done' },
      {
        title: 'Entregado',
        description: entregado ? `Entregado el ${entregado}` : 'Entrega registrada sin fecha visible',
        state: 'current'
      }
    ];
  }

  return [
    { title: 'Paquete registrado', description: recibidoDescription, state: 'done' },
    { title: 'Estado no disponible', description: 'Información pendiente de confirmar', state: 'current' }
  ];
};

export default function PaqueteCard({ paquete }) {
  const [detalleVisible, setDetalleVisible] = useState(false);
  const detalleId = useId();
  const estado = mapEstado(paquete.estado);
  const recibido = formatFechaCO(paquete.fecha_recibido);
  const entregado = formatFechaCO(paquete.fecha_entrega);
  const isServicio = paquete.categoria === 'servicio_publico';
  const tipoLabel = isServicio ? 'Servicio público' : 'Paquete';
  const descripcion = paquete.descripcion_visible || 'Paquete sin descripción';
  const detalle = buildDetalleTimeline({ estadoKey: estado.key, recibido, entregado });

  return (
    <article className="app-surface-primary rounded-xl border border-brand-primary/10 p-3 transition-colors hover:border-brand-primary/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`app-badge text-[11px] px-2 py-0.5 ${isServicio ? 'app-badge-info' : 'app-badge-success'}`}>
              {tipoLabel}
            </span>
            <span className={`app-badge text-[11px] px-2 py-0.5 ${estado.badgeClassName}`}>
              {estado.label}
            </span>
          </div>

          <h3 className="text-base font-semibold leading-snug text-app-text-primary break-words sm:text-[17px]">
            {descripcion}
          </h3>

          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-app-text-secondary">
            <span>Recibido: {recibido || 'Sin fecha registrada'}</span>
            <span aria-hidden="true" className="text-app-text-secondary/70">•</span>
            <span>Entrega: {entregado || 'Aún no entregado'}</span>
          </p>
        </div>

        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-brand-secondary transition-colors hover:bg-brand-secondary/10 hover:text-app-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          aria-expanded={detalleVisible}
          aria-controls={detalleId}
          onClick={() => setDetalleVisible((visible) => !visible)}
        >
          <span>{detalleVisible ? 'Ocultar' : 'Ver detalle'}</span>
          <span aria-hidden="true" className="text-[10px] leading-none">
            {detalleVisible ? '▴' : '▾'}
          </span>
        </button>
      </div>

      {detalleVisible && (
        <div id={detalleId} className="mt-2 border-t border-app-border/60 pt-2">
          <ol className="space-y-2">
            {detalle.map((item, index) => (
              <li key={`${item.title}-${index}`} className="grid grid-cols-[0.75rem_1fr] gap-2">
                <span className="relative flex justify-center pt-1" aria-hidden="true">
                  <span
                    className={`h-2 w-2 rounded-full ${item.state === 'current' ? estado.dotClassName : 'bg-brand-primary/45'}`}
                  />
                  {index < detalle.length - 1 && <span className="absolute top-4 h-[calc(100%+0.5rem)] w-px bg-app-border/70" />}
                </span>
                <div className="min-w-0 pb-0.5">
                  <p className="text-sm font-semibold leading-tight text-app-text-primary break-words">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-snug text-app-text-secondary break-words">{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}
