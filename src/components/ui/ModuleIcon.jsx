import { createElement } from 'react';

const ICONS = {
  dashboard: (
    <>
      <path d="M4 13h6V4H4v9Z" />
      <path d="M14 20h6V4h-6v16Z" />
      <path d="M4 20h6v-3H4v3Z" />
    </>
  ),
  visitas: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <path d="M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="m16 11 2 2 4-5" />
    </>
  ),
  pagos: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </>
  ),
  cobros: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h3" />
    </>
  ),
  reservas: (
    <>
      <path d="M7 3v3" />
      <path d="M17 3v3" />
      <path d="M4 8h16" />
      <path d="M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" />
      <path d="m9 15 2 2 4-5" />
    </>
  ),
  paquetes: (
    <>
      <path d="m21 8-9-5-9 5 9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </>
  ),
  seguridad: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-5" />
    </>
  ),
  parqueaderos: (
    <>
      <path d="M5 17h14l-1.5-6.5A3 3 0 0 0 14.6 8H9.4a3 3 0 0 0-2.9 2.5L5 17Z" />
      <path d="M7 17v2" />
      <path d="M17 17v2" />
      <path d="M8 13h.01" />
      <path d="M16 13h.01" />
    </>
  ),
  incidentes: (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 4.3 2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  default: (
    <>
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
      <path d="M12 12 4 7" />
      <path d="M12 12v9" />
      <path d="m12 12 8-5" />
    </>
  )
};

export default function ModuleIcon({ name = 'default', className = '', decorative = true }) {
  const icon = ICONS[name] || ICONS.default;

  return (
    <span
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-brand-primary/30 bg-brand-primary/10 text-brand-secondary shadow-[0_0_24px_rgba(168,85,247,0.16)] ${className}`}
      aria-hidden={decorative ? 'true' : undefined}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        focusable="false"
      >
        {icon}
      </svg>
    </span>
  );
}

export function ModuleTitle({ icon, title, as: Heading = 'h2', className = '', iconClassName = '', containerClassName = '', ...headingProps }) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${containerClassName}`}>
      <ModuleIcon name={icon} className={iconClassName} />
      {createElement(Heading, { className, ...headingProps }, title)}
    </div>
  );
}
