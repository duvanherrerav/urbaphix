import { useEffect, useMemo, useState } from 'react';
import BrandLogo from '../../components/brand/BrandLogo';
import { supabase } from '../../services/supabaseClient';
import { getSuperadminMetrics } from './superadminMetricsService';

const navItems = [
  { label: 'Resumen plataforma', icon: '📡', description: 'KPIs agregados read-only de la operación SaaS.' },
  { label: 'Tenants', icon: '🏢', description: 'Inventario agregado de conjuntos y memberships.' },
  { label: 'Operación', icon: '🛠️', description: 'Señales operativas sin CRUD ni datos sensibles.' },
  { label: 'Auditoría', icon: '🧾', description: 'Trazabilidad futura de eventos de plataforma.' }
];

const metricCards = [
  { key: 'conjuntos', label: 'Conjuntos', icon: '🏢', description: 'Tenants registrados en la plataforma.' },
  { key: 'usuariosApp', label: 'Usuarios app', icon: '👥', description: 'Cuentas internas visibles por RLS.' },
  { key: 'tenantMembershipsActive', label: 'Memberships tenant activos', icon: '🔐', description: 'Accesos activos por conjunto.' },
  { key: 'platformMembershipsActive', label: 'Memberships plataforma activos', icon: '🛡️', description: 'Accesos activos de alcance SaaS.' },
  { key: 'residentes', label: 'Residentes', icon: '🏠', description: 'Registros residenciales agregados.' },
  { key: 'visitas30d', label: 'Visitas 30d', icon: '🚪', description: 'Visitas creadas en los últimos 30 días.' },
  { key: 'paquetesPendientes', label: 'Paquetes pendientes', icon: '📦', description: 'Entregas pendientes sin detalle personal.' },
  { key: 'pagosPendientes', label: 'Pagos pendientes', icon: '💳', description: 'Obligaciones pendientes agregadas.' },
  { key: 'incidentesAbiertos', label: 'Incidentes abiertos', icon: '🚨', description: 'Incidentes nuevos o en gestión.' }
];

const formatMetric = (value) => new Intl.NumberFormat('es-CO').format(value ?? 0);

function MetricSkeleton() {
  return (
    <article className="app-surface-muted animate-pulse p-4">
      <div className="mb-4 h-11 w-11 rounded-2xl bg-white/10" />
      <div className="h-7 w-20 rounded bg-white/10" />
      <div className="mt-3 h-4 w-32 rounded bg-white/10" />
      <div className="mt-2 h-4 w-full rounded bg-white/10" />
    </article>
  );
}

function MetricCard({ metric, value }) {
  return (
    <article className="app-surface-muted p-4">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl">
        {metric.icon}
      </div>
      <p className="text-2xl font-bold tracking-[-0.03em] text-app-text-primary">{formatMetric(value)}</p>
      <h3 className="mt-1 font-semibold text-app-text-primary">{metric.label}</h3>
      <p className="mt-2 text-sm leading-6 text-app-text-secondary">{metric.description}</p>
    </article>
  );
}

function SuperadminShell({ user, platformMembership }) {
  const displayName = user?.user_metadata?.name || user?.email || 'Usuario plataforma';
  const roleName = platformMembership?.role_name || 'platform';
  const [metricsState, setMetricsState] = useState({ status: 'loading', data: null, error: null, generatedAt: null });

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      setMetricsState({ status: 'loading', data: null, error: null, generatedAt: null });
      const result = await getSuperadminMetrics();

      if (!isMounted) return;

      setMetricsState({
        status: result.error ? 'error' : 'success',
        data: result.data,
        error: result.error,
        generatedAt: result.generatedAt
      });
    };

    loadMetrics();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasNoData = useMemo(() => {
    if (metricsState.status !== 'success' || !metricsState.data) return false;
    return metricCards.every((metric) => Number(metricsState.data[metric.key] || 0) === 0);
  }, [metricsState]);

  const generatedAtLabel = metricsState.generatedAt
    ? new Date(metricsState.generatedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Pendiente';

  return (
    <div className="app-shell min-h-screen bg-[radial-gradient(circle_at_12%_10%,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#0f172a_52%,_#020617_100%)] text-app-text-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:p-8">
        <aside className="app-surface-primary flex shrink-0 flex-col gap-6 p-5 lg:w-72">
          <BrandLogo variant="sidebar" className="max-w-full" alt="Urbaphix" />

          <div className="rounded-2xl border border-brand-secondary/20 bg-brand-secondary/[0.08] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-secondary">Dashboard MVP</p>
            <p className="mt-2 text-sm leading-6 text-app-text-secondary">
              Lectura agregada para operación interna multi-conjunto, sin CRUD ni datos sensibles.
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
              <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-app-text-primary">Dashboard Superadmin</h1>
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
                <p className="app-badge-info mb-4 inline-flex">Read-only · sesión autenticada</p>
                <h2 className="text-xl font-semibold text-app-text-primary">Resumen plataforma MVP</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-app-text-secondary">
                  Métricas agregadas para Superadmin y roles plataforma permitidos. Las consultas respetan RLS con la sesión autenticada actual y no exponen documentos, placas, comprobantes ni PII detallada.
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
                    <dt className="text-app-text-secondary">Actualizado</dt>
                    <dd className="text-right text-xs font-medium text-app-text-primary">{generatedAtLabel}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          {metricsState.status === 'error' && (
            <section className="rounded-2xl border border-state-error/30 bg-state-error/10 px-5 py-4 text-sm text-state-error" role="alert">
              No fue posible cargar las métricas plataforma con la sesión actual. Verifica RLS/membership activa y vuelve a intentar.
            </section>
          )}

          {hasNoData && (
            <section className="rounded-2xl border border-state-warning/30 bg-state-warning/10 px-5 py-4 text-sm text-state-warning">
              No hay datos agregados disponibles para mostrar todavía.
            </section>
          )}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy={metricsState.status === 'loading'}>
            {metricsState.status === 'loading'
              ? metricCards.map((metric) => <MetricSkeleton key={metric.key} />)
              : metricCards.map((metric) => (
                  <MetricCard key={metric.key} metric={metric} value={metricsState.data?.[metric.key]} />
                ))}
          </section>
        </main>
      </div>
    </div>
  );
}

export default SuperadminShell;
