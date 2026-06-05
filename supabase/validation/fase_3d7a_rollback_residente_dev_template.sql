-- NO EJECUTAR SIN AUTORIZACION HUMANA
-- DEV ONLY
-- TEMPLATE CONTROLADO DE ROLLBACK
--
-- FASE 3D.7A - Rollback residente DEV
-- Este script revierte únicamente datos de prueba preparados por esta fase.
-- No usar en QA ni PRD.
-- El usuario Auth debe eliminarse o deshabilitarse manualmente desde Supabase Dashboard DEV si corresponde.
--
-- Placeholders requeridos:
-- :auth_user_id
-- :resident_email
-- :conjunto_id
-- :torre_nombre
-- :apartamento_numero
--
-- Reemplazar todos los valores __...__ y revisar el preview antes de confirmar.

begin;

with params as (
  select
    '__AUTH_USER_ID__'::uuid as auth_user_id,
    lower('__RESIDENT_EMAIL__')::text as resident_email,
    '__CONJUNTO_ID__'::uuid as conjunto_id,
    '__TORRE_NOMBRE__'::text as torre_nombre,
    '__APARTAMENTO_NUMERO__'::text as apartamento_numero
), preview as (
  select
    p.auth_user_id,
    p.conjunto_id,
    ua.id as usuarios_app_id,
    r.id as residente_id,
    tm.id as membership_id,
    a.id as apartamento_id,
    t.id as torre_id
  from params p
  left join public.usuarios_app ua
    on ua.id = p.auth_user_id
   and ua.conjunto_id = p.conjunto_id
   and lower(ua.email) = p.resident_email
   and ua.rol_id = 'residente'
  left join public.residentes r
    on r.usuario_id = p.auth_user_id
   and r.conjunto_id = p.conjunto_id
  left join public.tenant_memberships tm
    on tm.user_id = p.auth_user_id
   and tm.conjunto_id = p.conjunto_id
   and tm.role_name = 'residente'
   and tm.residente_id = r.id
  left join public.apartamentos a
    on a.id = r.apartamento_id
   and a.conjunto_id = p.conjunto_id
   and a.numero = p.apartamento_numero
  left join public.torres t
    on t.id = a.torre_id
   and t.conjunto_id = p.conjunto_id
   and lower(t.nombre) = lower(p.torre_nombre)
), deleted_memberships as (
  delete from public.tenant_memberships tm
  using preview pr
  where tm.id = pr.membership_id
  returning tm.id
), deleted_residentes as (
  delete from public.residentes r
  using preview pr
  where r.id = pr.residente_id
    and not exists (
      select 1
      from public.tenant_memberships tm
      where tm.residente_id = r.id
    )
  returning r.id
), deleted_usuarios_app as (
  delete from public.usuarios_app ua
  using preview pr
  where ua.id = pr.usuarios_app_id
    and not exists (
      select 1
      from public.residentes r
      where r.usuario_id = ua.id
    )
  returning ua.id
), deleted_apartamentos as (
  delete from public.apartamentos a
  using preview pr
  where a.id = pr.apartamento_id
    and not exists (
      select 1
      from public.residentes r
      where r.apartamento_id = a.id
    )
    and not exists (
      select 1
      from public.paquetes pq
      where pq.apartamento_id = a.id
    )
    and not exists (
      select 1
      from public.reservas rv
      where rv.apartamento_id = a.id
    )
  returning a.id
), deleted_torres as (
  delete from public.torres t
  using preview pr
  where t.id = pr.torre_id
    and not exists (
      select 1
      from public.apartamentos a
      where a.torre_id = t.id
    )
  returning t.id
)
select
  'fase_3d7a_rollback_residente_dev' as operation,
  (select count(*) from deleted_memberships) as memberships_deleted,
  (select count(*) from deleted_residentes) as residentes_deleted,
  (select count(*) from deleted_usuarios_app) as usuarios_app_deleted,
  (select count(*) from deleted_apartamentos) as apartamentos_deleted,
  (select count(*) from deleted_torres) as torres_deleted;

commit;
