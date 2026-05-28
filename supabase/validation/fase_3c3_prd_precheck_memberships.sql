-- FASE 3C.3 - PRD precheck memberships/RLS base
-- Ejecución manual, no destructiva.
-- Proyecto PRD esperado: urbaphix-prd / oamczhwtilkmtxleaakb
-- No modifica datos. No ejecutar contra DEV/QA para aprobación PRD.

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

-- 1) Conteo total usuarios_app.
select
  '01_usuarios_app_count' as check_name,
  count(*) as usuarios_app_count
from public.usuarios_app;

-- 2) Distribución por rol_id.
select
  '02_usuarios_app_role_distribution' as check_name,
  coalesce(rol_id, '<null>') as rol_id,
  count(*) as total
from public.usuarios_app
group by coalesce(rol_id, '<null>')
order by total desc, rol_id;

-- 3) Usuarios con conjunto_id nulo.
select
  '03_usuarios_without_conjunto_id' as check_name,
  id as usuario_app_id,
  email,
  rol_id,
  conjunto_id
from public.usuarios_app
where conjunto_id is null
order by rol_id, email, id;

-- 4) Roles no mapeables al modelo tenant_memberships.
select
  '04_unmappable_roles' as check_name,
  coalesce(rol_id, '<null>') as rol_id,
  count(*) as total
from public.usuarios_app
where rol_id is null
   or rol_id not in ('admin', 'administrador', 'vigilancia', 'vigilante', 'residente')
group by coalesce(rol_id, '<null>')
order by total desc, rol_id;

-- 5) Residentes con rol residente sin registro en residentes.
select
  '05_residente_role_without_residentes_row' as check_name,
  ua.id as usuario_app_id,
  ua.email,
  ua.conjunto_id,
  ua.rol_id
from public.usuarios_app ua
left join public.residentes r
  on r.usuario_id = ua.id
where ua.rol_id = 'residente'
  and r.id is null
order by ua.email, ua.id;

-- 6) Relación usuarios_app ↔ residentes para rol residente.
select
  '06_residente_relationship_summary' as check_name,
  count(*) filter (where ua.rol_id = 'residente') as usuarios_residente,
  count(*) filter (where ua.rol_id = 'residente' and r.id is not null) as usuarios_residente_with_residente_id,
  count(*) filter (where ua.rol_id = 'residente' and r.id is null) as usuarios_residente_without_residente_id,
  count(*) filter (where ua.rol_id <> 'residente' and r.id is not null) as non_residente_roles_with_residentes_row
from public.usuarios_app ua
left join public.residentes r
  on r.usuario_id = ua.id;

-- 7) Detalle relación usuarios_app ↔ residentes, incluyendo diferencias de conjunto.
select
  '07_usuario_residente_relationship_detail' as check_name,
  ua.id as usuario_app_id,
  ua.email,
  ua.rol_id,
  ua.conjunto_id as usuario_conjunto_id,
  r.id as residente_id,
  r.conjunto_id as residente_conjunto_id,
  case
    when r.id is null then 'missing_residente'
    when ua.conjunto_id is distinct from r.conjunto_id then 'conjunto_mismatch'
    else 'ok'
  end as relationship_status
from public.usuarios_app ua
left join public.residentes r
  on r.usuario_id = ua.id
where ua.rol_id = 'residente'
order by relationship_status desc, ua.email, ua.id;

-- 8) Duplicados potenciales por (usuarios_app.id, conjunto_id).
select
  '08_potential_duplicates_user_conjunto' as check_name,
  id as user_id,
  conjunto_id,
  count(*) as total
from public.usuarios_app
where id is not null
  and conjunto_id is not null
group by id, conjunto_id
having count(*) > 1
order by total desc, user_id, conjunto_id;

-- 9) Existencia previa de tablas nuevas.
select
  '09_membership_tables_existence' as check_name,
  c.relname as table_name,
  n.nspname as schema_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('platform_memberships', 'tenant_memberships')
order by c.relname;

-- 10) Columnas existentes si las tablas ya fueron creadas.
select
  '10_existing_membership_columns' as check_name,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('platform_memberships', 'tenant_memberships')
order by table_name, ordinal_position;

-- 11) Estado de migración esperada en schema_migrations.
select
  '11_expected_migration_status' as check_name,
  '20260528120000' as expected_version,
  exists (
    select 1
    from supabase_migrations.schema_migrations sm
    where sm.version = '20260528120000'
  ) as migration_already_applied,
  case
    when exists (
      select 1
      from supabase_migrations.schema_migrations sm
      where sm.version = '20260528120000'
    ) then 'applied'
    else 'pending_expected'
  end as status;

-- 12) Migraciones aplicadas recientes para comparar contra supabase migration list.
select
  '12_recent_applied_migrations' as check_name,
  version
from supabase_migrations.schema_migrations
order by version desc
limit 10;

-- 13) Conteo estimado de filas válidas para backfill y exclusiones.
with source_rows as (
  select
    ua.id as user_id,
    ua.email,
    ua.conjunto_id,
    ua.rol_id,
    case
      when ua.rol_id in ('admin', 'administrador') then 'admin_conjunto'
      when ua.rol_id in ('vigilancia', 'vigilante') then 'vigilante'
      when ua.rol_id = 'residente' then 'residente'
      else null
    end as mapped_role_name,
    r.id as residente_id
  from public.usuarios_app ua
  left join public.residentes r on r.usuario_id = ua.id
), classified as (
  select
    *,
    case
      when user_id is null then 'missing_user_id'
      when conjunto_id is null then 'missing_conjunto_id'
      when mapped_role_name is null then 'unsupported_role'
      when mapped_role_name = 'residente' and residente_id is null then 'missing_residente_for_residente_role'
      else 'valid_for_backfill'
    end as classification
  from source_rows
)
select
  '13_backfill_estimate_by_classification' as check_name,
  classification,
  count(*) as total
from classified
group by classification
order by classification;
