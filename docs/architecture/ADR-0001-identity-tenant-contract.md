# ADR-0001 — Contrato canónico de identidad y tenant

## Estado

Aceptado para implementación gradual desde FASE 0.3.1.

## Contexto

Urbaphix opera temporalmente con un modelo híbrido entre `auth.users`, `usuarios_app`, `tenant_memberships` y `platform_memberships`. La aplicación Web todavía requiere compatibilidad legacy, mientras que Mobile debe nacer sobre un contrato explícito y multitenant.

## Decisiones

1. `auth.users` es la identidad técnica global y la única fuente de autenticación.
2. `usuarios_app` se conserva temporalmente como perfil global y compatibilidad legacy; deja de ser la fuente canónica de autorización.
3. `tenant_memberships` es la fuente canónica de acceso, rol y estado por conjunto.
4. `platform_memberships` es la fuente canónica de roles globales de plataforma.
5. `conjuntos` representa el tenant; `tenant_lifecycle` determina si puede operar.
6. El tenant activo se resuelve después del login a partir de membresías activas y lifecycle válido.
7. Las interfaces consumen capacidades; RLS y funciones SQL siguen siendo la autoridad de seguridad.
8. Un usuario con varias membresías debe seleccionar tenant explícitamente, salvo que exista una selección previa todavía válida.
9. Los roles legacy se mantienen solo como adaptación temporal:
   - `admin_conjunto` → `admin`
   - `vigilante` → `vigilancia`
   - `residente` → `residente`
10. `contador` y `comite` no deben descartarse por no existir todavía en la navegación legacy.

## Contratos

### AuthUser

```ts
type AuthUser = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  createdAt: string;
};
```

### UserProfile

```ts
type UserProfile = {
  userId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string | null;
};
```

### TenantMembership

```ts
type TenantRole =
  | 'admin_conjunto'
  | 'vigilante'
  | 'residente'
  | 'contador'
  | 'comite';

type MembershipStatus = 'active' | 'suspended' | 'revoked';

type TenantMembership = {
  id: string;
  userId: string;
  tenantId: string;
  role: TenantRole;
  residentId: string | null;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};
```

### PlatformMembership

```ts
type PlatformRole =
  | 'superadmin'
  | 'platform_support'
  | 'platform_auditor'
  | 'platform_ops';
```

### ActiveTenantContext

```ts
type ActiveTenantContext = {
  tenantId: string;
  membershipId: string;
  role: TenantRole;
  residentId: string | null;
  lifecycleStatus: 'onboarding' | 'active' | 'suspended' | 'archived';
  licenseStatus: 'trial' | 'active' | 'suspended' | 'expired' | 'canceled' | null;
  operationalLock: boolean;
  capabilities: string[];
  source: 'tenant_memberships' | 'legacy_fallback';
};
```

## Reglas de bootstrap

1. Validar sesión.
2. Cargar perfil global.
3. Cargar membresías plataforma activas.
4. Cargar membresías tenant activas.
5. Validar lifecycle y licencia.
6. Resolver selección automática solo cuando exista una única opción válida.
7. Exigir selector cuando existan varias opciones válidas.
8. Devolver un resultado explícito, nunca un perfil parcialmente autorizado.

Estados mínimos:

- `READY`
- `TENANT_SELECTION_REQUIRED`
- `NO_MEMBERSHIP`
- `USER_DISABLED`
- `MEMBERSHIP_SUSPENDED`
- `TENANT_SUSPENDED`
- `TENANT_ARCHIVED`
- `TENANT_LICENSE_BLOCKED`
- `TENANT_OPERATIONALLY_LOCKED`
- `PROFILE_INCOMPLETE`
- `CONFIGURATION_ERROR`

## Consecuencias

- Web puede migrar progresivamente sin reescritura masiva.
- Mobile comparte dominio e identidad, no componentes visuales.
- `usuarios_app.conjunto_id`, `usuarios_app.rol_id` y `usuarios_app.fcm_token` quedan marcados para retiro futuro.
- Toda eliminación posterior requiere inventario de consumidores, datos y dependencias.
