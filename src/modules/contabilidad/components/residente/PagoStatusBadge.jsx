export default function PagoStatusBadge({ estadoProceso, compact = false }) {
  const estado = estadoProceso || { label: 'Pendiente de pago', badge: 'app-badge-warning' };

  return (
    <span className={`app-badge ${estado.badge} ${compact ? 'text-[11px]' : 'text-xs'}`}>
      {estado.label}
    </span>
  );
}
