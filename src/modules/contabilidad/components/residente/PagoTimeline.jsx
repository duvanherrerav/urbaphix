const baseSteps = [
  { key: 'generado', label: 'Cobro generado' },
  { key: 'comprobante', label: 'Comprobante enviado' },
  { key: 'aprobado', label: 'Pago aprobado' }
];

export default function PagoTimeline({ pago }) {
  const tieneComprobante = Boolean(pago?.comprobante_url);
  const aprobado = pago?.estado === 'pagado';

  const steps = baseSteps.map((step) => ({
    ...step,
    active: step.key === 'generado' || (step.key === 'comprobante' && tieneComprobante) || (step.key === 'aprobado' && aprobado)
  }));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5 text-[10px] sm:text-[11px]">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`rounded-full border px-2 py-1 text-center ${step.active
              ? 'border-brand-primary/35 bg-brand-primary/15 text-app-text-primary'
              : 'border-app-border bg-app-bg text-app-text-secondary'}`}
          >
            {step.label}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-app-text-secondary">Avance visual según la información actual del cobro.</p>
    </div>
  );
}
