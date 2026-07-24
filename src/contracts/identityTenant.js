export const TENANT_ROLES = Object.freeze([
  'admin_conjunto',
  'vigilante',
  'residente',
  'contador',
  'comite'
]);

export const PLATFORM_ROLES = Object.freeze([
  'superadmin',
  'platform_support',
  'platform_auditor',
  'platform_ops'
]);

export const MEMBERSHIP_STATUSES = Object.freeze([
  'active',
  'suspended',
  'revoked'
]);

export const TENANT_LIFECYCLE_STATUSES = Object.freeze([
  'onboarding',
  'active',
  'suspended',
  'archived'
]);

export const LICENSE_STATUSES = Object.freeze([
  'trial',
  'active',
  'suspended',
  'expired',
  'canceled'
]);

export const BOOTSTRAP_STATUSES = Object.freeze([
  'READY',
  'TENANT_SELECTION_REQUIRED',
  'NO_MEMBERSHIP',
  'USER_DISABLED',
  'MEMBERSHIP_SUSPENDED',
  'TENANT_SUSPENDED',
  'TENANT_ARCHIVED',
  'TENANT_LICENSE_BLOCKED',
  'TENANT_OPERATIONALLY_LOCKED',
  'PROFILE_INCOMPLETE',
  'CONFIGURATION_ERROR'
]);

export const LEGACY_ROLE_BY_TENANT_ROLE = Object.freeze({
  admin_conjunto: 'admin',
  vigilante: 'vigilancia',
  residente: 'residente'
});

export const CAPABILITIES_BY_TENANT_ROLE = Object.freeze({
  residente: [
    'visits.create',
    'visits.read_own',
    'packages.read_own',
    'reservations.create',
    'reservations.read_own',
    'payments.read_own',
    'payments.upload_receipt'
  ],
  vigilante: [
    'visits.read_tenant',
    'visits.check_in',
    'visits.check_out',
    'packages.create',
    'packages.manage_tenant',
    'reservations.check_in',
    'incidents.create'
  ],
  admin_conjunto: [
    'visits.read_tenant',
    'packages.manage_tenant',
    'reservations.approve',
    'payments.manage_tenant',
    'incidents.manage',
    'tenant.manage_users',
    'tenant.manage_configuration'
  ],
  contador: [
    'payments.manage_tenant'
  ],
  comite: []
});

export const isKnownTenantRole = (role) => TENANT_ROLES.includes(role);
export const isKnownPlatformRole = (role) => PLATFORM_ROLES.includes(role);
export const isActiveMembership = (membership) => membership?.status === 'active';
export const getTenantRoleCapabilities = (role) => [...(CAPABILITIES_BY_TENANT_ROLE[role] || [])];
