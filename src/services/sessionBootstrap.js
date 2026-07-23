import { supabase } from './supabaseClient';
import { BOOTSTRAP_STATUSES } from '../contracts/identityTenant';

const KNOWN_BOOTSTRAP_STATUSES = new Set(BOOTSTRAP_STATUSES);
const PREFERRED_TENANT_STORAGE_KEY = 'urbaphix.preferredTenantId';

export const SESSION_BOOTSTRAP_FLAG = 'VITE_ENABLE_SESSION_BOOTSTRAP';

export const isSessionBootstrapEnabled = () => {
  const value = String(import.meta.env?.[SESSION_BOOTSTRAP_FLAG] || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value);
};

export const getPreferredTenantId = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(PREFERRED_TENANT_STORAGE_KEY);
};

export const setPreferredTenantId = (tenantId) => {
  if (typeof window === 'undefined') return;
  if (tenantId) {
    window.localStorage.setItem(PREFERRED_TENANT_STORAGE_KEY, tenantId);
  } else {
    window.localStorage.removeItem(PREFERRED_TENANT_STORAGE_KEY);
  }
};

export const bootstrapSession = async ({ preferredTenantId = getPreferredTenantId() } = {}) => {
  const { data, error } = await supabase.rpc('fn_session_bootstrap', {
    p_preferred_conjunto_id: preferredTenantId || null
  });

  if (error) throw error;

  const status = data?.status;
  if (!KNOWN_BOOTSTRAP_STATUSES.has(status)) {
    throw new Error(`Unknown bootstrap status: ${status || 'missing'}`);
  }

  if (status === 'READY' && data?.activeContext?.tenantId) {
    setPreferredTenantId(data.activeContext.tenantId);
  }

  return data;
};

export const getBootstrapLegacyProfile = (bootstrap) => {
  const active = bootstrap?.activeContext;
  const user = bootstrap?.user;

  if (!active || !user || bootstrap?.status !== 'READY') return null;

  const legacyRole = {
    admin_conjunto: 'admin',
    vigilante: 'vigilancia',
    residente: 'residente'
  }[active.role] || null;

  return {
    id: user.id,
    nombre: user.displayName || user.email || 'Usuario',
    email: user.email || null,
    telefono: user.phone || null,
    activo: user.active !== false,
    conjunto_id: active.tenantId,
    residente_id: active.residentId || null,
    rol_id: legacyRole,
    role_name: active.role,
    status: active.membershipStatus,
    membership_id: active.membershipId,
    capabilities: active.capabilities || [],
    membership_source: 'fn_session_bootstrap',
    membership_resolution: {
      source: 'fn_session_bootstrap',
      contract_version: bootstrap.contractVersion,
      bootstrap_status: bootstrap.status,
      warnings: bootstrap.warnings || []
    }
  };
};
