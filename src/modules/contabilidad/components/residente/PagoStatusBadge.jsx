export default function PagoStatusBadge({ estadoProceso, compact = false }) {
  const estado = estadoProceso || { label: 'Pendiente de pago', badge: 'app-badge-warning' };

  return (
    <span className={`app-badge ${estado.badge} whitespace-nowrap ${compact ? 'px-2 py-0.5 text-[10px]' : 'text-xs'}`}>
      {estado.label}
    </span>
  );
}
