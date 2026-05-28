import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

const ACTIVE_STATUS = 'active';

export const MEMBERSHIP_RESOLVER_FLAG = 'VITE_ENABLE_MEMBERSHIP_RESOLVER';
export const isMembershipResolverEnabled = () => {
  const value = String(import.meta.env?.[MEMBERSHIP_RESOLVER_FLAG] || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value);
};

export const TENANT_ROLE_TO_LEGACY_ROLE = {
  admin_conjunto: 'admin',
  vigilante: 'vigilancia',
  residente: 'residente'
};

const LEGACY_ROLES = new Set(['admin', 'vigilancia', 'residente']);

const isDevelopment = () => Boolean(import.meta.env?.DEV);

const devWarn = (message, metadata = {}) => {
  if (isDevelopment()) {
    logger.warn(message, {
      module: 'auth',
      action: 'membership_resolution',
      ...metadata
    });
  }
};

const addWarning = (warnings, warning) => {
  if (!warnings.includes(warning)) warnings.push(warning);
};

const resolveUserId = (authenticatedUserOrId) => {
  if (typeof authenticatedUserOrId === 'string') return authenticatedUserOrId;
  return authenticatedUserOrId?.id || authenticatedUserOrId?.user_id || null;
};

const getMembershipIncompatibility = (membership) => {
  const mappedRole = TENANT_ROLE_TO_LEGACY_ROLE[membership?.role_name];

  if (!membership?.conjunto_id) return 'membership_missing_conjunto_id';
  if (!mappedRole) return 'membership_role_not_supported_by_current_navigation';
  if (mappedRole === 'residente' && !membership?.residente_id) return 'resident_membership_missing_residente_id';

  return null;
};

const pickMembership = (memberships, legacyProfile) => {
  const warnings = [];
  const activeMemberships = Array.isArray(memberships)
    ? memberships.filter((membership) => membership?.status === ACTIVE_STATUS)
    : [];

  const compatibleMemberships = activeMemberships.filter((membership) => {
    const incompatibility = getMembershipIncompatibility(membership);
    if (incompatibility) {
      addWarning(warnings, incompatibility);
      return false;
    }

    return true;
  });

  if (!compatibleMemberships.length) {
    return { membership: null, warnings };
  }

  const legacyConjuntoId = legacyProfile?.conjunto_id;
  const matchingLegacyTenant = legacyConjuntoId
    ? compatibleMemberships.find((membership) => membership.conjunto_id === legacyConjuntoId)
    : null;

  return { membership: matchingLegacyTenant || compatibleMemberships[0], warnings };
};

const buildLegacyResolution = (legacyProfile, warnings = []) => {
  if (!legacyProfile) {
    return {
      profile: null,
      source: 'none',
      role_name: null,
      status: null,
      warnings
    };
  }

  const legacyRole = legacyProfile?.rol_id || null;
  if (!LEGACY_ROLES.has(legacyRole)) {
    addWarning(warnings, 'legacy_role_not_supported_by_current_navigation');
  }

  return {
    profile: {
      ...legacyProfile,
      role_name: legacyRole,
      status: legacyProfile?.status || ACTIVE_STATUS,
      membership_source: 'usuarios_app',
      membership_resolution: {
        source: 'usuarios_app',
        role_name: legacyRole,
        status: legacyProfile?.status || ACTIVE_STATUS,
        warnings
      }
    },
    source: 'usuarios_app',
    role_name: legacyRole,
    status: legacyProfile?.status || ACTIVE_STATUS,
    warnings
  };
};

const buildMembershipResolution = ({ authenticatedUser, legacyProfile, membership, memberships, warnings }) => {
  const mappedRole = TENANT_ROLE_TO_LEGACY_ROLE[membership.role_name];

  if (memberships.length > 1) {
    addWarning(warnings, 'multiple_active_memberships_detected');
    devWarn('Membership resolver: múltiples memberships activas detectadas; se usó una membresía compatible.', {
      active_memberships_count: memberships.length,
      selected_conjunto_id: membership.conjunto_id,
      selected_role_name: membership.role_name
    });
  }

  return {
    profile: {
      ...(legacyProfile || {}),
      id: membership.user_id,
      nombre: legacyProfile?.nombre || authenticatedUser?.user_metadata?.name || authenticatedUser?.email || 'Usuario',
      email: legacyProfile?.email || authenticatedUser?.email || null,
      rol_id: mappedRole,
      conjunto_id: membership.conjunto_id,
      residente_id: membership.residente_id || legacyProfile?.residente_id || null,
      role_name: membership.role_name,
      status: membership.status,
      membership_id: membership.id,
      membership_source: 'tenant_memberships',
      membership_resolution: {
        source: 'tenant_memberships',
        role_name: membership.role_name,
        legacy_role: mappedRole,
        conjunto_id: membership.conjunto_id,
        residente_id: membership.residente_id || null,
        status: membership.status,
        warnings
      }
    },
    source: 'tenant_memberships',
    role_name: membership.role_name,
    legacy_role: mappedRole,
    status: membership.status,
    warnings
  };
};

export const resolveUserMembership = async (authenticatedUserOrId) => {
  const userId = resolveUserId(authenticatedUserOrId);
  const authenticatedUser = typeof authenticatedUserOrId === 'object' ? authenticatedUserOrId : null;

  if (!userId) {
    return buildLegacyResolution(null, ['missing_user_id']);
  }

  const warnings = [];

  const [legacyResponse, membershipsResponse] = await Promise.all([
    supabase
      .from('usuarios_app')
      .select('*')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('tenant_memberships')
      .select('id, user_id, conjunto_id, role_name, residente_id, status, created_at, updated_at')
      .eq('user_id', userId)
      .eq('status', ACTIVE_STATUS)
      .order('created_at', { ascending: true })
  ]);

  if (legacyResponse.error) {
    addWarning(warnings, 'legacy_profile_query_failed');
    logger.error('Membership resolver: no se pudo consultar usuarios_app', legacyResponse.error, {
      module: 'auth',
      action: 'membership_resolution_legacy_fallback'
    });
  }

  if (membershipsResponse.error) {
    addWarning(warnings, 'tenant_memberships_query_failed');
    devWarn('Membership resolver: no se pudo consultar tenant_memberships; se usará fallback legacy.', {
      error_code: membershipsResponse.error?.code,
      error_message: membershipsResponse.error?.message
    });
    return buildLegacyResolution(legacyResponse.data || null, warnings);
  }

  const activeMemberships = membershipsResponse.data || [];

  if (!activeMemberships.length) {
    addWarning(warnings, 'no_active_membership');
    return buildLegacyResolution(legacyResponse.data || null, warnings);
  }

  const { membership: selectedMembership, warnings: compatibilityWarnings } = pickMembership(activeMemberships, legacyResponse.data);
  compatibilityWarnings.forEach((warning) => addWarning(warnings, warning));

  if (!selectedMembership) {
    return buildLegacyResolution(legacyResponse.data || null, warnings);
  }

  return buildMembershipResolution({
    authenticatedUser,
    legacyProfile: legacyResponse.data || null,
    membership: selectedMembership,
    memberships: activeMemberships,
    warnings
  });
};

export const resolveUserMembershipProfile = async (authenticatedUserOrId) => {
  const resolution = await resolveUserMembership(authenticatedUserOrId);
  return resolution.profile;
};
