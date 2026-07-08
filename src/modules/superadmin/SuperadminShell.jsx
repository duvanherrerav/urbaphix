import BrandLogo from '../../components/brand/BrandLogo';
import { supabase } from '../../services/supabaseClient';

const navItems = [
  { label: 'Resumen plataforma', icon: '📡', description: 'Placeholder del overview operacional.' },
  { label: 'Tenants', icon: '🏢', description: 'Inventario futuro de conjuntos y estado.' },
  { label: 'Operación', icon: '🛠️', description: 'Acciones internas pendientes de diseño.' },
  { label: 'Auditoría', icon: '🧾', description: 'Trazabilidad y eventos de plataforma.' }
];

function SuperadminShell({ user, platformMembership }) {
  const displayName = user?.user_metadata?.name || user?.email || 'Usuario plataforma';
  const roleName = platformMembership?.role_name || 'platform';

  return (
    <div className="app-shell min-h-screen bg-[radial-gradient(circle_at_12%_10%,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#0f172a_52%,_#020617_100%)] text-app-text-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:p-8">
        <aside className="app-surface-primary flex shrink-0 flex-col gap-6 p-5 lg:w-72">
          <BrandLogo variant="sidebar" className="max-w-full" alt="Urbaphix" />

          <div className="rounded-2xl border border-brand-secondary/20 bg-brand-secondary/[0.08] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-secondary">Superadmin MVP</p>
            <p className="mt-2 text-sm leading-6 text-app-text-secondary">
              Shell inicial protegido para operación interna de plataforma.
            </p>
          </div>

          <nav className="space-y-2" aria-label="Navegación Superadmin">
            {navItems.map((item, index) => (
              <button
                key={item.label}
                type="button"
                className={`app-sidebar-item w-full ${index === 0 ? 'app-sidebar-item-active' : ''}`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-5">
          <header className="app-header flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-secondary">Plataforma Urbaphix</p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-app-text-primary">Panel Superadmin</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-app-text-primary">{displayName}</p>
                <p className="text-xs text-app-text-secondary">{roleName}</p>
              </div>
              <button type="button" onClick={() => supabase.auth.signOut()} className="app-btn app-btn-secondary">
                Cerrar sesión
              </button>
            </div>
          </header>

          <section className="app-surface-primary overflow-hidden p-6 shadow-app">
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="app-badge-info mb-4 inline-flex">Acceso plataforma validado</p>
                <h2 className="text-xl font-semibold text-app-text-primary">Shell base listo para FASE 4.1</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-app-text-secondary">
                  Esta vista no ejecuta CRUD de negocio ni amplía permisos tenant. Solo confirma sesión autenticada con membership plataforma activa para roles superadmin o platform_ops.
                </p>
              </div>

              <div className="rounded-2xl border border-app-border bg-app-bg-alt p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-secondary">Estado</p>
                <dl className="mt-3 space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-app-text-secondary">Sesión</dt>
                    <dd className="font-medium text-state-success">Autenticada</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-app-text-secondary">Rol plataforma</dt>
                    <dd className="font-medium text-app-text-primary">{roleName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-app-text-secondary">Membership</dt>
                    <dd className="max-w-[12rem] truncate font-mono text-xs text-app-text-primary">{platformMembership?.id}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {navItems.map((item) => (
              <article key={item.label} className="app-surface-muted p-4">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl">
                  {item.icon}
                </div>
                <h3 className="font-semibold text-app-text-primary">{item.label}</h3>
                <p className="mt-2 text-sm leading-6 text-app-text-secondary">{item.description}</p>
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}

export default SuperadminShell;
