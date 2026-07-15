import { supabase } from '../../services/supabaseClient';
import { logger } from '../../utils/logger';

const sanitizeReason = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
};

export const emptyTenantLifecycle = Object.freeze({
  lifecycleStatus: 'sin_estado',
  licenseStatus: 'sin_licencia',
  planCode: 'sin_plan',
  operationalLock: false,
  lockReason: null,
  statusReason: null,
  activatedAt: null,
  suspendedAt: null,
  archivedAt: null,
  updatedAt: null
});

const normalizeLifecycle = (row) => ({
  conjuntoId: row?.conjunto_id || '',
  lifecycleStatus: row?.lifecycle_status || 'sin_estado',
  licenseStatus: row?.license_status || 'sin_licencia',
  planCode: row?.plan_code || 'sin_plan',
  operationalLock: Boolean(row?.operational_lock),
  lockReason: sanitizeReason(row?.lock_reason),
  statusReason: sanitizeReason(row?.status_reason),
  activatedAt: row?.activated_at || null,
  suspendedAt: row?.suspended_at || null,
  archivedAt: row?.archived_at || null,
  updatedAt: row?.updated_at || null
});

export const getSuperadminTenantsLifecycleSummary = async () => {
  try {
    const { data, error } = await supabase.rpc('fn_platform_tenants_lifecycle_summary');

    if (error) {
      throw error;
    }

    return {
      data: (Array.isArray(data) ? data : []).map(normalizeLifecycle),
      error: null
    };
  } catch (error) {
    logger.error('No se pudo cargar lifecycle de tenants plataforma', error, {
      module: 'superadmin',
      action: 'load_platform_tenants_lifecycle_summary',
      rpc: 'fn_platform_tenants_lifecycle_summary'
    });

    return { data: [], error };
  }
};

export const transitionSuperadminTenantLifecycle = async ({ tenantId, targetStatus, reason }) => {
  try {
    const { data, error } = await supabase.rpc('fn_platform_transition_tenant_lifecycle', {
      p_conjunto_id: tenantId,
      p_target_status: targetStatus,
      p_reason: reason || null
    });

    if (error) {
      throw error;
    }

    return {
      data: Array.isArray(data) ? data[0] : data,
      error: null
    };
  } catch (error) {
    logger.error('No se pudo ejecutar transición lifecycle tenant', error, {
      module: 'superadmin',
      action: 'transition_tenant_lifecycle',
      rpc: 'fn_platform_transition_tenant_lifecycle'
    });

    return { data: null, error };
  }
};
