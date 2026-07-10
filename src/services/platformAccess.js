import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export const PLATFORM_ACCESS_ROLES = ['superadmin', 'platform_ops'];
const PLATFORM_ROLE_PRIORITY = ['superadmin', 'platform_ops'];
const ACTIVE_STATUS = 'active';

const resolveUserId = (authenticatedUserOrId) => {
  if (typeof authenticatedUserOrId === 'string') return authenticatedUserOrId;
  return authenticatedUserOrId?.id || authenticatedUserOrId?.user_id || null;
};

const resolveEffectivePlatformMembership = (memberships) => {
  if (!Array.isArray(memberships) || memberships.length === 0) return null;

  return PLATFORM_ROLE_PRIORITY
    .map((roleName) => memberships.find((membership) => membership.role_name === roleName))
    .find(Boolean) || null;
};

export const resolvePlatformAccess = async (authenticatedUserOrId) => {
  const userId = resolveUserId(authenticatedUserOrId);

  if (!userId) {
    return {
      allowed: false,
      status: 'unauthenticated',
      membership: null,
      error: null
    };
  }

  const { data, error } = await supabase
    .from('platform_memberships')
    .select('id, user_id, role_name, status, created_at, updated_at')
    .eq('user_id', userId)
    .eq('status', ACTIVE_STATUS)
    .in('role_name', PLATFORM_ACCESS_ROLES);

  if (error) {
    logger.error('No se pudo validar acceso plataforma', error, {
      module: 'superadmin',
      action: 'resolve_platform_access'
    });

    return {
      allowed: false,
      status: 'error',
      membership: null,
      error
    };
  }

  const membership = resolveEffectivePlatformMembership(data);

  return {
    allowed: Boolean(membership),
    status: membership ? 'allowed' : 'denied',
    membership,
    error: null
  };
};
