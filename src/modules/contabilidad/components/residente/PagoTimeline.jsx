import { getPagoStepperSteps } from '../../utils/pagosEstados';

export default function PagoTimeline({ pago, compact = false }) {
  const steps = getPagoStepperSteps(pago?.estado);

  return (
    <div className={`w-full ${compact ? 'pt-1' : 'pt-1.5'}`} aria-label="Avance del pago">
      <div className="grid grid-cols-[1fr_1fr_1fr] items-start">
        {steps.map((step, index) => (
          <div key={step.key} className="relative flex min-w-0 flex-col items-center gap-1">
            {index > 0 && (
              <span
                className={`absolute right-1/2 top-[7px] h-px w-full -translate-y-1/2 transition-colors duration-300 ${step.rejected
                  ? 'bg-state-error/45'
                  : step.active
                    ? 'bg-gradient-to-r from-brand-primary/70 to-brand-secondary/80'
                    : 'bg-app-border/80'}`}
                aria-hidden="true"
              />
            )}

            <span
              className={`relative z-10 size-3 rounded-full border transition-all duration-300 ${step.rejected
                ? 'border-state-error bg-state-error shadow-[0_0_0_4px_rgba(239,68,68,0.10),0_0_14px_rgba(239,68,68,0.28)]'
                : step.active
                  ? 'border-brand-secondary bg-brand-secondary shadow-[0_0_0_4px_rgba(56,189,248,0.10),0_0_16px_rgba(56,189,248,0.38)]'
                  : 'border-app-border bg-app-bg-alt shadow-[0_0_0_3px_rgba(15,23,42,0.65)]'}`}
              aria-hidden="true"
            />

            <span
              className={`max-w-full truncate px-1 text-center text-[10px] font-medium leading-none transition-colors duration-300 sm:text-[11px] ${step.rejected
                ? 'text-state-error'
                : step.active
                  ? 'text-app-text-primary'
                  : 'text-app-text-secondary/70'}`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
