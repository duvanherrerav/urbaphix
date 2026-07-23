import BrandLogo from '../brand/BrandLogo';

const TenantSelector = ({ tenants = [], isSubmitting = false, error = '', onSelect, onSignOut }) => (
  <div className="app-shell flex min-h-screen items-center justify-center p-6">
    <section className="app-surface-primary w-full max-w-xl space-y-6 px-6 py-7 shadow-app sm:px-8">
      <div className="flex justify-center">
        <BrandLogo variant="loading" decorative />
      </div>

      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold text-app-text-primary">Selecciona el conjunto</h1>
        <p className="text-sm leading-6 text-app-text-secondary">
          Tu cuenta tiene acceso a más de un conjunto. Elige con cuál deseas continuar.
        </p>
      </div>

      {error && (
        <div className="app-badge-error rounded-xl px-4 py-3 text-sm" role="alert">
          {error}
        </div>
      )}

      <div className="space-y-3" aria-label="Conjuntos disponibles">
        {tenants.map((tenant) => (
          <button
            key={tenant.membershipId || tenant.tenantId}
            type="button"
            disabled={isSubmitting}
            onClick={() => onSelect?.(tenant.tenantId)}
            className="app-surface-muted flex w-full items-center justify-between gap-4 p-4 text-left transition hover:border-brand-secondary/40 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-app-text-primary">
                {tenant.tenantName || 'Conjunto residencial'}
              </span>
              <span className="mt-1 block text-xs text-app-text-secondary">
                {tenant.tenantCity || 'Ubicación no registrada'} · {tenant.role || 'membresía'}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-brand-secondary">
              {isSubmitting ? 'Validando…' : 'Ingresar'}
            </span>
          </button>
        ))}
      </div>

      <button type="button" onClick={onSignOut} disabled={isSubmitting} className="app-btn app-btn-secondary w-full">
        Cerrar sesión
      </button>
    </section>
  </div>
);

export default TenantSelector;
