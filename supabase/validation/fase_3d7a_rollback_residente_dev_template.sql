-- NO EJECUTAR SIN AUTORIZACION HUMANA
-- DEV ONLY
-- TEMPLATE CONTROLADO DE ROLLBACK
--
-- FASE 3D.7A - Rollback residente DEV
-- Este script revierte únicamente datos de prueba de usuario/residente/membership preparados por esta fase.
-- No usa public.reservas.apartamento_id porque esa columna no existe en el schema actual.
-- No borra automáticamente torres ni apartamentos: el template de preparación puede reutilizar datos existentes.
-- Revisar manualmente cualquier limpieza de torre/apartamento después del rollback automático.
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
-- El rollback automático solo elimina, cuando coincide con los placeholders:
-- - public.tenant_memberships del rol residente;
-- - public.residentes vinculado al usuario;
-- - public.usuarios_app del usuario residente de prueba si ya no tiene residentes.
--
-- Limpieza manual opcional, fuera del rollback automático:
-- - Revisar public.apartamentos por conjunto_id + torre + numero.
-- - Revisar public.torres por conjunto_id + nombre.
-- - Borrar torre/apartamento únicamente si una persona autorizada confirma que fueron creados por esta fase
--   y no son datos reutilizados ni referenciados por otros registros.

begin;

with params as (
  select
    '__AUTH_USER_ID__'::uuid as auth_user_id,
    lower('__RESIDENT_EMAIL__')::text as resident_email,
    '__CONJUNTO_ID__'::uuid as conjunto_id,
    '__TORRE_NOMBRE__'::text as torre_nombre,
    '__APARTAMENTO_NUMERO__'::text as apartamento_numero
), guardrails as (
  select
    p.*,
    p.conjunto_id = 'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid as is_expected_dev_conjunto
  from params p
), preview as (
  select
    g.auth_user_id,
    g.conjunto_id,
    g.is_expected_dev_conjunto,
    ua.id as usuarios_app_id,
    r.id as residente_id,
    tm.id as membership_id,
    a.id as apartamento_id_manual_review,
    a.numero as apartamento_numero_manual_review,
    t.id as torre_id_manual_review,
    t.nombre as torre_nombre_manual_review
  from guardrails g
  left join public.usuarios_app ua
    on ua.id = g.auth_user_id
   and ua.conjunto_id = g.conjunto_id
   and lower(ua.email) = g.resident_email
   and ua.rol_id = 'residente'
  left join public.residentes r
    on r.usuario_id = g.auth_user_id
   and r.conjunto_id = g.conjunto_id
  left join public.tenant_memberships tm
    on tm.user_id = g.auth_user_id
   and tm.conjunto_id = g.conjunto_id
   and tm.role_name = 'residente'
   and tm.residente_id = r.id
  left join public.apartamentos a
    on a.id = r.apartamento_id
   and a.conjunto_id = g.conjunto_id
   and a.numero = g.apartamento_numero
  left join public.torres t
    on t.id = a.torre_id
   and t.conjunto_id = g.conjunto_id
   and lower(t.nombre) = lower(g.torre_nombre)
  where g.is_expected_dev_conjunto
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
)
select
  'fase_3d7a_rollback_residente_dev' as operation,
  (select is_expected_dev_conjunto from guardrails) as is_expected_dev_conjunto,
  (select count(*) from deleted_memberships) as memberships_deleted,
  (select count(*) from deleted_residentes) as residentes_deleted,
  (select count(*) from deleted_usuarios_app) as usuarios_app_deleted,
  (select count(*) from preview where apartamento_id_manual_review is not null) as apartamentos_pending_manual_review,
  (select count(*) from preview where torre_id_manual_review is not null) as torres_pending_manual_review;

commit;
