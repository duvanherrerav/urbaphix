# FASE 3C.1 — Implementación controlada DEV/QA de memberships y helpers RLS base

## 1) Resumen de implementación
Se implementó infraestructura mínima de autorización plataforma/tenant en Supabase para DEV/QA sin cambios en frontend, PRD, rutas o login. Esta fase crea tablas nuevas, helpers RLS nuevos, políticas RLS solo para tablas nuevas, y artefactos SQL de backfill/pruebas para coexistencia con `usuarios_app`.

## 2) Migraciones creadas
- `supabase/migrations/20260528120000_fase_3c1_memberships_rls_base.sql`

## 3) Tablas creadas
- `public.platform_memberships`
- `public.tenant_memberships`

Ambas incluyen estado (`active|suspended|revoked`), trazabilidad temporal y restricciones/índices de unicidad parcial para evitar duplicados activos.

## 4) Helpers creados
- `public.fn_is_platform_superadmin()`
- `public.fn_has_platform_role(role_name text)`
- `public.fn_has_tenant_access(target_conjunto_id uuid)`
- `public.fn_has_tenant_role(target_conjunto_id uuid, role_name text)`

Notas de seguridad:
- Definidas con `SECURITY DEFINER` y `search_path` fijo (`public, pg_temp`).
- Se revoca `PUBLIC` y se concede `EXECUTE` solo a `authenticated` y `service_role`.
- No se modifican `fn_auth_conjunto_id()`, `fn_auth_rol()` ni `fn_auth_residente_id()`.

## 5) RLS aplicada únicamente a tablas nuevas
Se habilitó RLS solo en:
- `public.platform_memberships`
- `public.tenant_memberships`

Políticas aplicadas:
- `platform_memberships`
  - SELECT: self + superadmin.
  - INSERT/UPDATE: solo superadmin.
  - DELETE: denegado (`using false`).
- `tenant_memberships`
  - SELECT: superadmin o miembros activos del mismo conjunto.
  - INSERT/UPDATE: superadmin o `platform_ops` activo.
  - DELETE: denegado (`using false`).

## 6) Backfill propuesto (idempotente y controlado)

```sql
with source_rows as (
  select
    ua.id as user_id,
    ua.conjunto_id,
    case
      when ua.rol_id in ('admin', 'administrador') then 'admin_conjunto'
      when ua.rol_id in ('vigilancia', 'vigilante') then 'vigilante'
      when ua.rol_id = 'residente' then 'residente'
      else null
    end as tenant_role,
    r.id as residente_id,
    ua.id as usuario_app_id
  from public.usuarios_app ua
  left join public.residentes r on r.usuario_id = ua.id
), valid_rows as (
  select *
  from source_rows
  where user_id is not null
    and conjunto_id is not null
    and tenant_role is not null
    and (
      tenant_role <> 'residente'
      or residente_id is not null
    )
)
insert into public.tenant_memberships (
  user_id,
  conjunto_id,
  role_name,
  residente_id,
  status,
  source_legacy
)
select
  vr.user_id,
  vr.conjunto_id,
  vr.tenant_role,
  vr.residente_id,
  'active',
  'usuarios_app'
from valid_rows vr
where not exists (
  select 1
  from public.tenant_memberships tm
  where tm.user_id = vr.user_id
    and tm.conjunto_id = vr.conjunto_id
    and tm.status = 'active'
);
```

### Registro de filas excluidas sugerido

```sql
select *
from (
  select
    ua.id as usuario_app_id,
    ua.id as user_id,
    ua.conjunto_id,
    ua.rol_id,
    r.id as residente_id,
    case
      when ua.id is null then 'missing_user_id'
      when ua.conjunto_id is null then 'missing_conjunto_id'
      when ua.rol_id not in ('admin','administrador','vigilancia','vigilante','residente') then 'unsupported_role'
      when ua.rol_id = 'residente' and r.id is null then 'missing_residente_for_residente_role'
      else null
    end as exclusion_reason
  from public.usuarios_app ua
  left join public.residentes r on r.usuario_id = ua.id
) x
where x.exclusion_reason is not null;
```

## 7) Pruebas SQL

### 7.1 RLS platform_memberships
```sql
select * from public.platform_memberships; -- esperado: self o todo si superadmin
```

### 7.2 RLS tenant_memberships
```sql
select * from public.tenant_memberships; -- esperado: solo conjuntos propios o todo si superadmin
```

### 7.3 Sin membership activa => sin acceso tenant
```sql
select public.fn_has_tenant_access('00000000-0000-0000-0000-000000000000'::uuid);
```

### 7.4 Aislamiento A/B
```sql
select *
from public.tenant_memberships tm
where tm.conjunto_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
-- usuario miembro de B no debe ver resultados de A
```

### 7.5 Superadmin global
```sql
select public.fn_is_platform_superadmin();
```

### 7.6 No delete duro
```sql
-- Prueba documental (no ejecutar como script automático):
-- intentar DELETE manual en sesión de prueba y verificar que RLS lo deniega.
-- ejemplo de referencia (manual):
-- delete from public.platform_memberships where id = '<uuid_existente>'::uuid;
-- delete from public.tenant_memberships where id = '<uuid_existente>'::uuid;
```

### 7.7 No duplicados activos
```sql
select user_id, conjunto_id, count(*)
from public.tenant_memberships
where status = 'active'
group by 1,2
having count(*) > 1;
```

### 7.8 Conteo backfill
```sql
select
  (select count(*) from public.usuarios_app where id is not null and conjunto_id is not null) as usuarios_app_count,
  (select count(*) from public.tenant_memberships where source_legacy = 'usuarios_app') as tenant_memberships_from_legacy;
```

### 7.9 Helpers
```sql
select public.fn_has_platform_role('platform_ops');
select public.fn_has_tenant_role('00000000-0000-0000-0000-000000000000'::uuid, 'admin_conjunto');
```

### 7.10 Compatibilidad login actual
Validación de no-regresión funcional: el frontend continúa leyendo `usuarios_app` y no se tocaron archivos de login/ruteo.

## 8) Rollback (controlado)
1. Revocar uso operativo en DEV/QA (detener backfill incremental si lo hay).
2. Ejecutar rollback manual en ventana controlada:
   - `drop table if exists public.tenant_memberships cascade;`
   - `drop table if exists public.platform_memberships cascade;`
   - `drop function if exists public.fn_has_tenant_role(uuid, text);`
   - `drop function if exists public.fn_has_tenant_access(uuid);`
   - `drop function if exists public.fn_has_platform_role(text);`
   - `drop function if exists public.fn_is_platform_superadmin();`
3. Confirmar que `usuarios_app` permanece intacta.

## 9) Checklist DEV
- [ ] Ejecutar migración en entorno DEV.
- [ ] Correr backfill en modo controlado.
- [ ] Revisar exclusiones del backfill.
- [ ] Ejecutar pruebas SQL 7.1–7.9.
- [ ] Verificar login y módulos actuales sin cambios.

## 10) Checklist QA
- [ ] Repetir migración y backfill en QA.
- [ ] Validar aislamiento entre conjuntos A/B.
- [ ] Validar restricción de delete duro.
- [ ] Validar unicidad activa por `(user_id, conjunto_id)`.
- [ ] Confirmar sin regresión en flujo de autenticación actual.

## 11) Confirmación explícita
- No se modifica frontend.
- No se modifica PRD.
- No se alteran helpers `fn_auth_*` existentes.
- No se altera RLS de tablas de negocio existentes.
