-- FASE 3D.7A - Diagnóstico residente DEV
-- Solo lectura. Ejecutar únicamente en Supabase DEV.
-- No usar en QA ni PRD.
-- Columnas inexistentes evitadas: torres.numero, apartamentos.codigo, residentes.nombres, residentes.apellidos.

with params as (
  select
    'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid as conjunto_id,
    null::uuid as auth_user_id,
    null::text as resident_email
), dev_conjunto as (
  select
    c.id as conjunto_id,
    c.nombre as conjunto_nombre
  from public.conjuntos c
  join params p on p.conjunto_id = c.id
), auth_candidates as (
  select
    u.id as user_id,
    case
      when u.email is null then null
      else left(u.email, 2) || '***@' || split_part(u.email, '@', 2)
    end as masked_email,
    u.email_confirmed_at is not null as email_confirmed,
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  cross join params p
  where (p.auth_user_id is not null and u.id = p.auth_user_id)
     or (p.resident_email is not null and lower(u.email) = lower(p.resident_email))
     or exists (
       select 1
       from public.usuarios_app ua
       where ua.id = u.id
         and ua.conjunto_id = p.conjunto_id
         and ua.rol_id = 'residente'
     )
     or exists (
       select 1
       from public.residentes r
       where r.usuario_id = u.id
         and r.conjunto_id = p.conjunto_id
     )
     or exists (
       select 1
       from public.tenant_memberships tm
       where tm.user_id = u.id
         and tm.conjunto_id = p.conjunto_id
         and tm.role_name = 'residente'
     )
), duplicate_auth_email as (
  select
    lower(u.email) as normalized_email,
    count(*) as auth_users_count
  from auth.users u
  cross join params p
  where p.resident_email is not null
    and lower(u.email) = lower(p.resident_email)
  group by lower(u.email)
), torres_dev as (
  select
    t.id as torre_id,
    t.conjunto_id,
    t.nombre,
    t.pisos,
    t.created_at
  from public.torres t
  join params p on p.conjunto_id = t.conjunto_id
), apartamentos_dev as (
  select
    a.id as apartamento_id,
    a.conjunto_id,
    a.torre_id,
    t.nombre as torre_nombre,
    a.numero,
    a.piso,
    a.tipo_apartamento,
    a.created_at
  from public.apartamentos a
  left join public.torres t on t.id = a.torre_id
  join params p on p.conjunto_id = a.conjunto_id
), usuarios_app_residentes as (
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
  join params p on p.conjunto_id = ua.conjunto_id
  where ua.rol_id = 'residente'
     or p.auth_user_id = ua.id
     or (p.resident_email is not null and lower(ua.email) = lower(p.resident_email))
), residentes_dev as (
  select
    r.id as residente_id,
    r.usuario_id,
    r.conjunto_id,
    r.apartamento_id,
    a.numero as apartamento_numero,
    a.torre_id,
    t.nombre as torre_nombre,
    r.es_propietario,
    r.created_at
  from public.residentes r
  left join public.apartamentos a on a.id = r.apartamento_id
  left join public.torres t on t.id = a.torre_id
  join params p on p.conjunto_id = r.conjunto_id
  where p.auth_user_id is null
     or r.usuario_id = p.auth_user_id
), tenant_residentes as (
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
  join params p on p.conjunto_id = tm.conjunto_id
  where tm.role_name = 'residente'
     or p.auth_user_id = tm.user_id
), duplicate_active_memberships as (
  select
    tm.user_id,
    tm.conjunto_id,
    tm.role_name,
    count(*) as active_memberships_count,
    array_agg(tm.id order by tm.created_at) as membership_ids
  from public.tenant_memberships tm
  join params p on p.conjunto_id = tm.conjunto_id
  where tm.status = 'active'
    and tm.role_name = 'residente'
  group by tm.user_id, tm.conjunto_id, tm.role_name
  having count(*) > 1
), duplicate_usuarios_app_email as (
  select
    lower(ua.email) as normalized_email,
    count(*) as usuarios_app_count,
    array_agg(ua.id order by ua.created_at) as user_ids
  from public.usuarios_app ua
  join params p on p.conjunto_id = ua.conjunto_id
  where p.resident_email is not null
    and lower(ua.email) = lower(p.resident_email)
  group by lower(ua.email)
), duplicate_residentes_user as (
  select
    r.usuario_id,
    r.conjunto_id,
    count(*) as residentes_count,
    array_agg(r.id order by r.created_at) as residente_ids
  from public.residentes r
  join params p on p.conjunto_id = r.conjunto_id
  where r.usuario_id is not null
  group by r.usuario_id, r.conjunto_id
  having count(*) > 1
), summary as (
  select
    (select count(*) from dev_conjunto) as conjuntos_count,
    (select count(*) from torres_dev) as torres_count,
    (select count(*) from apartamentos_dev) as apartamentos_count,
    (select count(*) from auth_candidates) as auth_candidates_count,
    (select count(*) from usuarios_app_residentes) as usuarios_app_residentes_count,
    (select count(*) from residentes_dev) as residentes_count,
    (select count(*) from tenant_residentes) as tenant_residentes_count,
    (select count(*) from duplicate_auth_email) as duplicate_auth_email_count,
    (select count(*) from duplicate_usuarios_app_email) as duplicate_usuarios_app_email_count,
    (select count(*) from duplicate_residentes_user) as duplicate_residentes_user_count,
    (select count(*) from duplicate_active_memberships) as duplicate_active_memberships_count
)
select '00_summary' as check_name, to_jsonb(summary) as payload from summary
union all
select '01_conjunto_dev' as check_name, to_jsonb(dev_conjunto) as payload from dev_conjunto
union all
select '02_torres_dev', to_jsonb(torres_dev) from torres_dev
union all
select '03_apartamentos_dev', to_jsonb(apartamentos_dev) from apartamentos_dev
union all
select '04_auth_candidates', to_jsonb(auth_candidates) from auth_candidates
union all
select '05_usuarios_app_residentes', to_jsonb(usuarios_app_residentes) from usuarios_app_residentes
union all
select '06_residentes_dev', to_jsonb(residentes_dev) from residentes_dev
union all
select '07_tenant_memberships_residente', to_jsonb(tenant_residentes) from tenant_residentes
union all
select '08_duplicate_auth_email', to_jsonb(duplicate_auth_email) from duplicate_auth_email
union all
select '09_duplicate_usuarios_app_email', to_jsonb(duplicate_usuarios_app_email) from duplicate_usuarios_app_email
union all
select '10_duplicate_residentes_user', to_jsonb(duplicate_residentes_user) from duplicate_residentes_user
union all
select '11_duplicate_active_memberships', to_jsonb(duplicate_active_memberships) from duplicate_active_memberships
order by check_name;
