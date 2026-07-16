# FASE 5.1 — Diseño implementable lifecycle tenants

## Objetivo
Convertir el readiness de FASE 5.0 en una migración mínima y no destructiva para lifecycle SaaS de tenants, sin crear CRUD frontend ni modificar `public.conjuntos`.

## Decisión técnica
Se crea `public.tenant_lifecycle` como tabla complementaria 1:1 con `public.conjuntos`.

Motivos:
- `public.conjuntos` ya es la entidad base estable del producto.
- `public.conjuntos` tiene múltiples FKs entrantes desde módulos core (`usuarios_app`, `tenant_memberships`, `residentes`, `pagos`, `paquetes`, `registro_visitas`, `reservas`, `torres`, `apartamentos`, `parqueaderos`, `recursos_comunes`, `incidentes`, `comunicados`, entre otros).
- Separar lifecycle evita sobrecargar o alterar semántica operativa existente.
- La fase actual no requiere frontend ni mutaciones cliente.

## Tabla `public.tenant_lifecycle`

### Relación
- `conjunto_id uuid primary key references public.conjuntos(id) on delete cascade`
- Cardinalidad efectiva: una fila lifecycle por cada conjunto.

### Campos mínimos
- `lifecycle_status text not null default 'onboarding'`
- `license_status text null default 'active'`
- `plan_code text null default 'standard'`
- `operational_lock boolean not null default false`
- `lock_reason text null`
- `status_reason text null`
- `activated_at timestamptz null`
- `suspended_at timestamptz null`
- `archived_at timestamptz null`
- `created_at timestamptz not null default now()`
- `created_by uuid null references auth.users(id) on delete set null`
- `updated_at timestamptz not null default now()`
- `updated_by uuid null references auth.users(id) on delete set null`

## Constraints
- `tenant_lifecycle_status_chk`: `onboarding`, `active`, `suspended`, `archived`.
- `tenant_lifecycle_license_status_chk`: `trial`, `active`, `suspended`, `expired`, `canceled` o `null`.
- Checks de longitud para `plan_code`, `lock_reason` y `status_reason`.

## RLS y permisos
- RLS habilitado y forzado.
- `anon` no tiene privilegios sobre la tabla.
- `authenticated` recibe únicamente `SELECT` y queda filtrado por policy.
- Policy `tenant_lifecycle_select_platform`: lectura solo para `fn_is_platform_superadmin()` o `fn_has_platform_role('platform_ops')`.
- No se crean policies de `INSERT`, `UPDATE` ni `DELETE` para `authenticated`.
- No se habilitan writes directos para usuarios tenant.
- Mutaciones lifecycle se dejan para backend autorizado o RPC específica en FASE 5.2.

## Backfill DEV
La migración inserta filas faltantes desde `public.conjuntos` con:

- `lifecycle_status = 'active'`
- `license_status = 'active'`
- `plan_code = 'standard'`
- `activated_at = now()`
- `status_reason = 'Backfill FASE 5.1 para conjuntos existentes en DEV'`

La decisión usa `active` para conjuntos existentes porque el producto ya opera con esos tenants y no debe romper semántica actual.

## Riesgos y mitigaciones
- **Exposición innecesaria:** mitigada con `anon` sin grants, RLS forzado y `SELECT` solo para roles plataforma.
- **Writes desde frontend:** mitigado al no crear policies de escritura para `authenticated`.
- **Acoplamiento con módulos core:** mitigado al no modificar `public.conjuntos` ni RLS de tablas existentes.
- **Estados inválidos:** mitigado con constraints check.

## Validación esperada
Ejecutar en DEV después de aplicar la migración:

```sql
select to_regclass('public.tenant_lifecycle') as tenant_lifecycle_table;

select relrowsecurity, relforcerowsecurity
from pg_class
where oid = 'public.tenant_lifecycle'::regclass;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'tenant_lifecycle'
order by grantee, privilege_type;

select count(*) as tenant_lifecycle_rows
from public.tenant_lifecycle;

insert into public.tenant_lifecycle (conjunto_id, lifecycle_status)
values ('00000000-0000-0000-0000-000000000000', 'invalid_status');
-- Debe fallar por tenant_lifecycle_status_chk o por FK si se usa un UUID inexistente.
```

Criterios DEV esperados:
- `tenant_lifecycle` existe.
- RLS está habilitado y forzado.
- `anon` no tiene privilegios.
- El backfill genera una fila por cada `public.conjuntos`; en DEV se esperaban 2 filas para 2 conjuntos.
- La constraint de `lifecycle_status` rechaza estados no permitidos.
- `docs/database-schema.md` refleja la nueva tabla.

## Plan FASE 5.2
- Diseñar RPC controlada para mutaciones lifecycle si el flujo operativo lo requiere.
- Definir auditoría de cambios lifecycle en `operational_events` u otro mecanismo aprobado.
- Integrar lectura lifecycle en RPCs plataforma existentes solo si es necesario para UI.
- Mantener prohibido `service_role` en frontend.
