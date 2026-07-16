# FASE 5.3 — Backoffice Superadmin lifecycle limitado

## Objetivo

Incorporar en la sección **Tenants** del Backoffice Superadmin una UI mínima para consultar lifecycle SaaS por tenant y ejecutar transiciones permitidas mediante la RPC existente `public.fn_platform_transition_tenant_lifecycle(uuid,text,text)`.

## Alcance implementado

- La vista Tenants conserva el patrón existente de carga lazy dentro de `SuperadminShell`.
- La lectura combina:
  - `public.fn_platform_tenants_summary()` para datos básicos y métricas agregadas del tenant.
  - `public.fn_platform_tenants_lifecycle_summary()` para lifecycle SaaS read-only.
- La UI muestra por tenant:
  - `lifecycle_status`.
  - `license_status`.
  - `plan_code`.
  - `operational_lock`.
  - `lock_reason` y `status_reason` truncadas de forma acotada en frontend.
  - `activated_at`, `suspended_at`, `archived_at`, `updated_at`.
- Las acciones lifecycle disponibles se calculan desde el estado actual y el rol plataforma:
  - `onboarding -> active`.
  - `active -> suspended`.
  - `suspended -> active`.
  - `onboarding|active|suspended -> archived` solo si `role_name = superadmin`.
- Cada transición solicita confirmación explícita antes de invocar la RPC.
- Suspender, archivar y reactivar desde `suspended` exigen razón no vacía antes de enviar.
- Se bloquea doble envío mientras una transición está en curso.
- Tras una transición exitosa se refresca únicamente la sección Tenants.

## Diseño técnico

### RPC read-only complementaria

Se creó `public.fn_platform_tenants_lifecycle_summary()` como RPC `SECURITY DEFINER` de solo lectura para evitar cambiar la firma de `public.fn_platform_tenants_summary()` y no romper consumidores existentes.

La RPC exige:

- sesión autenticada (`auth.uid()` no nulo);
- rol plataforma activo `superadmin` o `platform_ops` mediante `fn_is_platform_superadmin()` / `fn_has_platform_role('platform_ops')`.

La RPC no escribe tablas y no modifica policies RLS existentes.

### Mutación lifecycle

El frontend invoca exclusivamente:

```sql
public.fn_platform_transition_tenant_lifecycle(p_conjunto_id uuid, p_target_status text, p_reason text)
```

No se implementan `insert`, `update` ni `delete` directos sobre `tenant_lifecycle` ni `tenant_lifecycle_events` desde frontend.

## Seguridad y límites

- No se usa `service_role` en frontend.
- No se expone `actor_user_id` ni metadata de auditoría en esta fase.
- `platform_ops` no ve acción `archive` en la UI.
- Si un usuario tiene memberships activas `superadmin` y `platform_ops`, el rol efectivo de UI se resuelve explícitamente como `superadmin`, sin depender de `created_at` ni orden alfabético.
- La validación real de permisos, transición terminal `archived` y matriz de estados se conserva server-side en la RPC FASE 5.2.
- No se implementa gestión de plan/licencia ni bloqueo operativo en módulos tenant.

## Checklist manual por rol/estado

- [ ] Superadmin ve campos lifecycle de cada tenant.
- [ ] Platform ops ve campos lifecycle de cada tenant.
- [ ] Platform ops no ve botón `Archivar`.
- [ ] Usuario con memberships activas `superadmin` y `platform_ops`, sin importar `created_at`, ve botón `Archivar` y muestra rol efectivo `superadmin`.
- [ ] Usuario sin roles plataforma activos mantiene acceso denegado.
- [ ] Superadmin puede ejecutar `active -> suspended` con razón.
- [ ] Superadmin puede ejecutar `suspended -> active` con razón.
- [ ] Superadmin puede ejecutar `onboarding|active|suspended -> archived` con razón.
- [ ] La UI rechaza razón vacía para `suspended`, `archived` y reactivación desde `suspended`.
- [ ] La UI solicita confirmación explícita antes de invocar la mutación.
- [ ] Tras éxito, la sección Tenants refresca y refleja el nuevo estado.
- [ ] Un error de RPC se muestra al usuario sin mostrar actor ni metadata de auditoría.

## Validaciones ejecutadas

- `npm run lint` sin errores. Se mantienen warnings preexistentes de hooks en módulos no modificados.
- `npm run build:dev` exitoso.
