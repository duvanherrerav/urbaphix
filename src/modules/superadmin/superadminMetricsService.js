import { supabase } from '../../services/supabaseClient';
import { logger } from '../../utils/logger';

const METRIC_KEY_MAP = Object.freeze({
  conjuntos: 'conjuntos',
  usuarios_app: 'usuariosApp',
  tenant_memberships_active: 'tenantMembershipsActive',
  platform_memberships_active: 'platformMembershipsActive',
  residentes: 'residentes',
  visitas_30d: 'visitas30d',
  paquetes_pendientes: 'paquetesPendientes',
  pagos_pendientes: 'pagosPendientes',
  incidentes_abiertos: 'incidentesAbiertos'
});

const normalizeMetricValue = (value) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const normalizeMetrics = (row) => Object.entries(METRIC_KEY_MAP).reduce((acc, [rpcKey, uiKey]) => ({
  ...acc,
  [uiKey]: normalizeMetricValue(row?.[rpcKey])
}), {});

const normalizeTenant = (row) => ({
  id: row?.conjunto_id || '',
  nombre: row?.nombre || 'Sin nombre',
  ciudad: row?.ciudad || 'Sin ciudad',
  direccion: row?.direccion || null,
  createdAt: row?.created_at || null,
  usuarios: normalizeMetricValue(row?.usuarios),
  residentes: normalizeMetricValue(row?.residentes),
  visitas30d: normalizeMetricValue(row?.visitas_30d),
  paquetesPendientes: normalizeMetricValue(row?.paquetes_pendientes),
  pagosPendientes: normalizeMetricValue(row?.pagos_pendientes)
});

export const getSuperadminMetrics = async () => {
  const generatedAt = new Date().toISOString();

  try {
    const { data, error } = await supabase.rpc('fn_platform_dashboard_metrics');

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;

    return {
      data: normalizeMetrics(row),
      error: null,
      generatedAt
    };
  } catch (error) {
    logger.error('No se pudieron cargar métricas plataforma', error, {
      module: 'superadmin',
      action: 'load_platform_metrics',
      rpc: 'fn_platform_dashboard_metrics'
    });

    return {
      data: null,
      error,
      generatedAt
    };
  }
};

export const getSuperadminTenantsSummary = async () => {
  const generatedAt = new Date().toISOString();

  try {
    const { data, error } = await supabase.rpc('fn_platform_tenants_summary');

    if (error) {
      throw error;
    }

    return {
      data: (Array.isArray(data) ? data : []).map(normalizeTenant),
      error: null,
      generatedAt
    };
  } catch (error) {
    logger.error('No se pudo cargar resumen de tenants plataforma', error, {
      module: 'superadmin',
      action: 'load_platform_tenants_summary',
      rpc: 'fn_platform_tenants_summary'
    });

    return {
      data: [],
      error,
      generatedAt
    };
  }
};
