import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export const PLATFORM_ACCESS_ROLES = ['superadmin', 'platform_ops'];
const ACTIVE_STATUS = 'active';

const resolveUserId = (authenticatedUserOrId) => {
  if (typeof authenticatedUserOrId === 'string') return authenticatedUserOrId;
  return authenticatedUserOrId?.id || authenticatedUserOrId?.user_id || null;
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
    .in('role_name', PLATFORM_ACCESS_ROLES)
    .order('created_at', { ascending: true });

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

  const membership = Array.isArray(data) && data.length > 0 ? data[0] : null;

  return {
    allowed: Boolean(membership),
    status: membership ? 'allowed' : 'denied',
    membership,
    error: null
  };
};
