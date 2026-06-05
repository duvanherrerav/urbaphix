-- FASE 3D.7A - Post-check residente DEV
-- Solo lectura. Ejecutar únicamente en Supabase DEV después de la preparación manual autorizada.
-- No usar en QA ni PRD.

with params as (
  select
    '__AUTH_USER_ID__'::uuid as auth_user_id,
    'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid as conjunto_id,
    lower('__RESIDENT_EMAIL__')::text as resident_email
), auth_user as (
  select
    u.id as user_id,
    case
      when u.email is null then null
      else left(u.email, 2) || '***@' || split_part(u.email, '@', 2)
    end as masked_email,
    u.email_confirmed_at is not null as email_confirmed,
    case
      when u.email_confirmed_at is not null then 'email_confirmado'
      else 'email_pendiente_o_no_confirmado'
    end as email_status,
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  join params p on p.auth_user_id = u.id
), usuario_app as (
  select
    ua.id as user_id,
    ua.conjunto_id,
    ua.rol_id,
    ua.nombre,
    case
      when ua.email is null then null
      else left(ua.email, 2) || '***@' || split_part(ua.email, '@', 2)
    end as masked_email,
    ua.activo,
    ua.created_at
  from public.usuarios_app ua
  join params p on p.auth_user_id = ua.id
), residente as (
  select
    r.id as residente_id,
    r.usuario_id as user_id,
    r.conjunto_id,
    r.apartamento_id,
    r.es_propietario,
    r.created_at
  from public.residentes r
  join params p on p.auth_user_id = r.usuario_id
), membership as (
  select
    tm.id as membership_id,
    tm.user_id,
    tm.conjunto_id,
    tm.role_name,
    tm.residente_id,
    tm.status,
    tm.source_legacy,
    tm.created_at,
    tm.updated_at,
    tm.revoked_at
  from public.tenant_memberships tm
  join params p on p.auth_user_id = tm.user_id and p.conjunto_id = tm.conjunto_id
  where tm.role_name = 'residente'
), active_duplicate_counts as (
  select
    tm.user_id,
    tm.conjunto_id,
    tm.role_name,
    count(*) as active_count
  from public.tenant_memberships tm
  join params p on p.auth_user_id = tm.user_id and p.conjunto_id = tm.conjunto_id
  where tm.role_name = 'residente'
    and tm.status = 'active'
  group by tm.user_id, tm.conjunto_id, tm.role_name
), resolved as (
  select
    p.auth_user_id,
    p.conjunto_id as expected_conjunto_id,
    au.user_id is not null as auth_user_exists,
    au.masked_email as auth_masked_email,
    au.email_confirmed,
    coalesce(au.email_status, 'auth_user_no_encontrado') as email_status,
    ua.user_id is not null as usuarios_app_exists,
    ua.rol_id as usuarios_app_rol_id,
    ua.conjunto_id as usuarios_app_conjunto_id,
    ua.activo as usuarios_app_activo,
    r.residente_id,
    r.conjunto_id as residente_conjunto_id,
    r.apartamento_id,
    m.membership_id,
    m.role_name as membership_role_name,
    m.status as membership_status,
    m.conjunto_id as membership_conjunto_id,
    m.residente_id as membership_residente_id,
    coalesce(adc.active_count, 0) as active_duplicate_count
  from params p
  left join auth_user au on au.user_id = p.auth_user_id
  left join usuario_app ua on ua.user_id = p.auth_user_id
  left join residente r on r.user_id = p.auth_user_id and r.conjunto_id = p.conjunto_id
  left join membership m on m.user_id = p.auth_user_id and m.conjunto_id = p.conjunto_id
  left join active_duplicate_counts adc on adc.user_id = p.auth_user_id and adc.conjunto_id = p.conjunto_id and adc.role_name = 'residente'
)
select
  auth_user_id,
  expected_conjunto_id,
  auth_user_exists,
  auth_masked_email,
  email_confirmed,
  email_status,
  usuarios_app_exists,
  usuarios_app_rol_id,
  usuarios_app_conjunto_id,
  usuarios_app_activo,
  residente_id,
  residente_conjunto_id,
  apartamento_id,
  membership_id,
  membership_role_name,
  membership_status,
  membership_conjunto_id,
  membership_residente_id,
  active_duplicate_count,
  case
    when not auth_user_exists then 'NO_GO_auth_user_no_existe'
    when not usuarios_app_exists then 'NO_GO_usuarios_app_no_existe'
    when usuarios_app_rol_id <> 'residente' then 'NO_GO_usuarios_app_rol_no_residente'
    when usuarios_app_conjunto_id <> expected_conjunto_id then 'NO_GO_usuarios_app_conjunto_incorrecto'
    when residente_id is null then 'NO_GO_residente_no_existe'
    when residente_conjunto_id <> expected_conjunto_id then 'NO_GO_residente_conjunto_incorrecto'
    when membership_id is null then 'NO_GO_membership_no_existe'
    when membership_role_name <> 'residente' then 'NO_GO_membership_rol_no_residente'
    when membership_status <> 'active' then 'NO_GO_membership_no_activa'
    when membership_conjunto_id <> expected_conjunto_id then 'NO_GO_membership_conjunto_incorrecto'
    when membership_residente_id is distinct from residente_id then 'NO_GO_membership_residente_incoherente'
    when active_duplicate_count <> 1 then 'NO_GO_memberships_activas_duplicadas'
    else 'GO_residente_dev_apto_fase_3d7'
  end as readiness_status
from resolved;
