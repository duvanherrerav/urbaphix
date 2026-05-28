-- FASE 3C.3 - PRD postcheck memberships/RLS base
-- Ejecución manual posterior a aplicar migración y/o backfill.
-- Proyecto PRD esperado: urbaphix-prd / oamczhwtilkmtxleaakb
-- No destructivo.

-- 0) Confirmar proyecto conectado.
-- PostgreSQL no expone de forma portátil el Supabase project ref dentro de SQL.
-- Validación obligatoria: confirmar en CLI/Dashboard que el proyecto es urbaphix-prd / oamczhwtilkmtxleaakb.
select
  '00_project_identity_manual_confirmation' as check_name,
  'urbaphix-prd' as expected_project_name,
  'oamczhwtilkmtxleaakb' as expected_project_ref,
  current_database() as current_database,
  current_user as current_role_name,
  inet_server_addr() as server_addr,
  'Confirmar manualmente que esta sesión está conectada a oamczhwtilkmtxleaakb antes de continuar.' as required_action;

-- 1) Tablas creadas y RLS habilitada.
select
  '01_tables_and_rls' as check_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('platform_memberships', 'tenant_memberships')
order by c.relname;

-- 2) Funciones creadas.
select
  '02_membership_helpers' as check_name,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'fn_is_platform_superadmin',
    'fn_has_platform_role',
    'fn_has_tenant_access',
    'fn_has_tenant_role'
  )
order by p.proname, arguments;

-- 3) Policies esperadas: deben ser 8.
select
  '03_expected_policies' as check_name,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('platform_memberships', 'tenant_memberships')
order by tablename, policyname;

select
  '03b_expected_policy_count' as check_name,
  count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in ('platform_memberships', 'tenant_memberships');

-- 4) Estado de migración esperada.
select
  '04_expected_migration_applied' as check_name,
  '20260528120000' as expected_version,
  exists (
    select 1
    from supabase_migrations.schema_migrations sm
    where sm.version = '20260528120000'
  ) as migration_applied;

-- 5) Conteo usuarios_app válidos vs tenant_memberships creadas desde legacy.
with expected_valid as (
  select
    ua.id as user_id,
    ua.conjunto_id
  from public.usuarios_app ua
  left join public.residentes r on r.usuario_id = ua.id
  where ua.id is not null
    and ua.conjunto_id is not null
    and ua.rol_id in ('admin', 'administrador', 'vigilancia', 'vigilante', 'residente')
    and (
      ua.rol_id <> 'residente'
      or r.id is not null
    )
)
select
  '05_usuarios_app_vs_tenant_memberships' as check_name,
  (select count(*) from public.usuarios_app) as usuarios_app_total,
  (select count(*) from expected_valid) as usuarios_app_valid_for_backfill,
  (
    select count(*)
    from public.tenant_memberships tm
    where tm.source_legacy = 'usuarios_app'
      and tm.status = 'active'
  ) as active_legacy_tenant_memberships;

-- 6) Roles creados en tenant_memberships.
select
  '06_tenant_memberships_roles' as check_name,
  role_name,
  status,
  count(*) as total
from public.tenant_memberships
group by role_name, status
order by role_name, status;

-- 7) Duplicados activos: debe retornar 0 filas.
select
  '07_active_duplicates' as check_name,
  user_id,
  conjunto_id,
  count(*) as total
from public.tenant_memberships
where status = 'active'
group by user_id, conjunto_id
having count(*) > 1
order by total desc, user_id, conjunto_id;

-- 8) Residentes con role_name residente deben tener residente_id poblado.
select
  '08_residente_memberships_without_residente_id' as check_name,
  id as tenant_membership_id,
  user_id,
  conjunto_id,
  role_name,
  residente_id,
  status
from public.tenant_memberships
where role_name = 'residente'
  and status = 'active'
  and residente_id is null
order by user_id, conjunto_id;

-- 9) Helpers ejecutan sin error.
select
  '09a_fn_is_platform_superadmin_executes' as check_name,
  public.fn_is_platform_superadmin() as result;

select
  '09b_fn_has_platform_role_executes' as check_name,
  public.fn_has_platform_role('platform_ops') as result;

select
  '09c_fn_has_tenant_access_executes' as check_name,
  public.fn_has_tenant_access('00000000-0000-0000-0000-000000000000'::uuid) as result;

select
  '09d_fn_has_tenant_role_executes' as check_name,
  public.fn_has_tenant_role('00000000-0000-0000-0000-000000000000'::uuid, 'admin_conjunto') as result;

-- 10) Comprobación de que no se agregaron policies nuevas en tablas de negocio por esta fase.
-- Debe revisarse contra el baseline previo. Este query excluye tablas nuevas y lista el estado actual.
select
  '10_business_tables_policy_inventory_for_manual_diff' as check_name,
  schemaname,
  tablename,
  count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename not in ('platform_memberships', 'tenant_memberships')
group by schemaname, tablename
order by tablename;

-- 11) Verificación documental frontend legacy.
-- Confirmar manualmente en Network/Logs que producción sigue consultando usuarios_app para login/rol.
select
  '11_frontend_legacy_note' as check_name,
  'Validación manual requerida: frontend productivo sigue usando public.usuarios_app; esta fase no modifica frontend.' as note;
