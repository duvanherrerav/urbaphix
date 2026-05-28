-- FASE 3C.3 - PRD backfill controlado tenant_memberships
-- Ejecución manual posterior a aplicar la migración 20260528120000 y aprobar Go.
-- Proyecto PRD esperado: urbaphix-prd / oamczhwtilkmtxleaakb
-- Idempotente. No modifica usuarios_app. No hace deletes físicos.
-- Debe permanecer fuera de supabase/migrations.

begin;

-- 0) Confirmación obligatoria de proyecto.
-- PostgreSQL no expone de forma portátil el Supabase project ref dentro de SQL.
-- Antes de continuar, confirmar en CLI/Dashboard que la sesión apunta a urbaphix-prd / oamczhwtilkmtxleaakb.
select
  '00_project_identity_manual_confirmation' as check_name,
  'urbaphix-prd' as expected_project_name,
  'oamczhwtilkmtxleaakb' as expected_project_ref,
  current_database() as current_database,
  current_user as current_role_name,
  inet_server_addr() as server_addr,
  'ABORTAR manualmente si esta sesión no está conectada a oamczhwtilkmtxleaakb.' as required_action;

-- 1) Conteo esperado antes del backfill.
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
  '01_before_expected_counts' as check_name,
  classification,
  count(*) as total
from classified
group by classification
order by classification;

-- 2) Exclusiones documentadas: revisar antes de confirmar commit.
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
      else null
    end as exclusion_reason
  from source_rows
)
select
  '02_documented_exclusions' as check_name,
  user_id,
  email,
  rol_id,
  conjunto_id,
  residente_id,
  exclusion_reason
from classified
where exclusion_reason is not null
order by exclusion_reason, email, user_id;

-- 3) Filas válidas que ya tienen membership activa y no serán duplicadas.
with valid_rows as (
  select
    ua.id as user_id,
    ua.email,
    ua.conjunto_id,
    case
      when ua.rol_id in ('admin', 'administrador') then 'admin_conjunto'
      when ua.rol_id in ('vigilancia', 'vigilante') then 'vigilante'
      when ua.rol_id = 'residente' then 'residente'
      else null
    end as role_name,
    r.id as residente_id
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
  '03_existing_active_memberships_to_skip' as check_name,
  vr.user_id,
  vr.email,
  vr.conjunto_id,
  vr.role_name,
  tm.id as existing_tenant_membership_id
from valid_rows vr
join public.tenant_memberships tm
  on tm.user_id = vr.user_id
 and tm.conjunto_id = vr.conjunto_id
 and tm.status = 'active'
order by vr.email, vr.user_id;

-- 4) Backfill idempotente.
with source_rows as (
  select
    ua.id as user_id,
    ua.conjunto_id,
    case
      when ua.rol_id in ('admin', 'administrador') then 'admin_conjunto'
      when ua.rol_id in ('vigilancia', 'vigilante') then 'vigilante'
      when ua.rol_id = 'residente' then 'residente'
      else null
    end as role_name,
    r.id as residente_id
  from public.usuarios_app ua
  left join public.residentes r on r.usuario_id = ua.id
), valid_rows as (
  select *
  from source_rows
  where user_id is not null
    and conjunto_id is not null
    and role_name is not null
    and (
      role_name <> 'residente'
      or residente_id is not null
    )
), inserted_rows as (
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
    vr.role_name,
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
  )
  returning id, user_id, conjunto_id, role_name, residente_id
)
select
  '04_inserted_rows' as check_name,
  count(*) as inserted_count
from inserted_rows;

-- 5) Conteo posterior por rol.
select
  '05_after_tenant_memberships_by_role' as check_name,
  role_name,
  status,
  count(*) as total
from public.tenant_memberships
where source_legacy = 'usuarios_app'
group by role_name, status
order by role_name, status;

-- 6) Conteo esperado vs creado desde legacy.
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
  '06_expected_vs_active_legacy_memberships' as check_name,
  (select count(*) from expected_valid) as expected_valid_users,
  (
    select count(*)
    from public.tenant_memberships tm
    where tm.source_legacy = 'usuarios_app'
      and tm.status = 'active'
  ) as active_legacy_memberships;

-- 7) Duplicados activos: debe retornar 0 filas.
select
  '07_active_duplicate_check' as check_name,
  user_id,
  conjunto_id,
  count(*) as total
from public.tenant_memberships
where status = 'active'
group by user_id, conjunto_id
having count(*) > 1
order by total desc, user_id, conjunto_id;

commit;
