import { supabase } from '../../services/supabaseClient';
import { logger } from '../../utils/logger';

const ACTIVE_STATUS = 'active';
const PENDING_STATUS = 'pendiente';
const OPEN_INCIDENT_STATUSES = ['nuevo', 'en_gestion'];

const countQuery = async ({ key, table, label, applyFilters }) => {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });

  if (applyFilters) {
    query = applyFilters(query);
  }

  const { count, error } = await query;

  if (error) {
    throw Object.assign(new Error(`No se pudo consultar ${label}`), { cause: error, metricKey: key });
  }

  return [key, count ?? 0];
};

export const getSuperadminMetrics = async () => {
  const visitsSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const metrics = [
    { key: 'conjuntos', label: 'conjuntos', table: 'conjuntos' },
    { key: 'usuariosApp', label: 'usuarios app', table: 'usuarios_app' },
    {
      key: 'tenantMembershipsActive',
      label: 'memberships tenant activos',
      table: 'tenant_memberships',
      applyFilters: (query) => query.eq('status', ACTIVE_STATUS)
    },
    {
      key: 'platformMembershipsActive',
      label: 'memberships plataforma activos',
      table: 'platform_memberships',
      applyFilters: (query) => query.eq('status', ACTIVE_STATUS)
    },
    { key: 'residentes', label: 'residentes', table: 'residentes' },
    {
      key: 'visitas30d',
      label: 'visitas últimos 30 días',
      table: 'registro_visitas',
      applyFilters: (query) => query.gte('created_at', visitsSince)
    },
    {
      key: 'paquetesPendientes',
      label: 'paquetes pendientes',
      table: 'paquetes',
      applyFilters: (query) => query.eq('estado', PENDING_STATUS)
    },
    {
      key: 'pagosPendientes',
      label: 'pagos pendientes',
      table: 'pagos',
      applyFilters: (query) => query.eq('estado', PENDING_STATUS)
    },
    {
      key: 'incidentesAbiertos',
      label: 'incidentes abiertos',
      table: 'incidentes',
      applyFilters: (query) => query.in('estado', OPEN_INCIDENT_STATUSES)
    }
  ];

  try {
    const entries = await Promise.all(metrics.map(countQuery));
    return {
      data: Object.fromEntries(entries),
      error: null,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('No se pudieron cargar métricas plataforma', error, {
      module: 'superadmin',
      action: 'load_platform_metrics',
      metricKey: error?.metricKey
    });

    return {
      data: null,
      error,
      generatedAt: new Date().toISOString()
    };
  }
};
