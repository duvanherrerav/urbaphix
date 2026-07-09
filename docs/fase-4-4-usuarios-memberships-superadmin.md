# FASE 4.4 — Usuarios/Memberships Superadmin read-only

## Objetivo

Agregar al módulo Superadmin una vista read-only para revisar memberships de plataforma y tenant sin habilitar CRUD ni exponer PII innecesaria.

## Alcance implementado

- Nueva sección **Usuarios/Memberships** en la navegación de `/superadmin`.
- Vista read-only con dos bloques separados:
  - `platform_memberships`.
  - `tenant_memberships`.
- Fuente RLS-safe mediante RPC `fn_platform_memberships_summary()` `SECURITY DEFINER`.
- Autorización limitada a sesión autenticada con rol plataforma activo:
  - `fn_is_platform_superadmin()`.
  - `fn_has_platform_role('platform_ops')`.
- Datos expuestos:
  - email mínimo de cuenta autenticada.
  - conjunto para memberships tenant.
  - `role_name`.
  - `status`.
  - `created_at`.
  - `updated_at`.
  - `revoked_at`.

## Fuera de alcance

- Crear memberships.
- Editar memberships.
- Suspender o revocar memberships.
- Cambiar policies RLS.
- Usar `service_role` en frontend.
- Agregar soporte cross-tenant fuera del caso read-only Superadmin.
- Mostrar teléfonos, documentos, placas, comprobantes u otra PII innecesaria.

## Validación esperada DEV

Precheck informado para DEV:

- `platform_memberships` total: 1, active: 1.
- `tenant_memberships` total: 5, active: 5.
- platform roles: `superadmin` active = 1.
- tenant roles activos: `admin_conjunto` = 1, `residente` = 3, `vigilante` = 1.

Checklist manual:

- [ ] Superadmin ve la sección **Usuarios/Memberships** en `/superadmin`.
- [ ] Platform memberships muestra 1 registro en DEV.
- [ ] Tenant memberships muestra 5 registros en DEV.
- [ ] Usuario sin `platform_membership` activa sigue sin entrar a `/superadmin`.
- [ ] No se muestran teléfonos, documentos, placas ni comprobantes.

Checklist técnico:

- [ ] `npm run lint` pasa.
- [ ] `npm run build:dev` pasa.
