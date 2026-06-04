-- FASE 3D.7 - Identificar usuarios de prueba DEV
-- Solo lectura. Ejecutar manualmente por un operador humano autorizado en DEV.
-- No usar QA ni PRD. No publicar datos personales ni secretos.
-- Propósito: ubicar candidatos por rol antes de la evidencia autenticada real.
--
-- Nota de clasificación legacy:
-- - public.usuarios_app.rol_id es el valor canónico legacy usado por la app/resolver
--   para navegación y fallback: admin, vigilancia, residente.
-- - public.roles.nombre se expone solo como display informativo; no debe conducir
--   candidate_role, readiness_status ni el ordenamiento de buckets.

with auth_profiles as (
  select
    u.id as user_id,
    left(coalesce(u.email, ''), 3) || '***' ||
      case
        when position('@' in coalesce(u.email, '')) > 0 then substring(u.email from position('@' in u.email))
        else ''
      end as masked_email,
    u.email_confirmed_at is not null as email_confirmed,
    u.last_sign_in_at
  from auth.users u
), legacy_profiles as (
  select
    ua.id as user_id,
    ua.conjunto_id,
    ua.rol_id as legacy_role_canonical,
    r.nombre as legacy_role_display_name
  from public.usuarios_app ua
  left join public.roles r on r.id = ua.rol_id
), resident_links as (
  select
    res.id as residente_id,
    res.usuario_id as user_id,
    res.conjunto_id as residente_conjunto_id
  from public.residentes res
), active_memberships as (
  select
    tm.id as membership_id,
    tm.user_id,
    tm.conjunto_id,
    tm.role_name,
    case tm.role_name
      when 'admin_conjunto' then 'admin'
      when 'vigilante' then 'vigilancia'
      when 'residente' then 'residente'
      else tm.role_name
    end as membership_legacy_role_canonical,
    tm.residente_id,
    tm.status,
    tm.source_legacy,
    tm.created_at
  from public.tenant_memberships tm
  where tm.status = 'active'
), inactive_memberships as (
  select
    tm.user_id,
    count(*) as inactive_memberships_count
  from public.tenant_memberships tm
  where tm.status <> 'active'
  group by tm.user_id
), resolved_candidates as (
  select
    ap.user_id,
    ap.masked_email,
    ap.email_confirmed,
    ap.last_sign_in_at,
    coalesce(am.membership_legacy_role_canonical, lp.legacy_role_canonical, 'sin_membership_activa') as candidate_role,
    am.membership_id,
    am.status as membership_status,
    am.role_name as membership_role_name,
    am.membership_legacy_role_canonical,
    am.conjunto_id as membership_conjunto_id,
    lp.conjunto_id as legacy_conjunto_id,
    lp.legacy_role_canonical,
    lp.legacy_role_display_name,
    am.residente_id as membership_residente_id,
    rl.residente_id as linked_residente_id,
    rl.residente_conjunto_id,
    am.source_legacy,
    coalesce(im.inactive_memberships_count, 0) as inactive_memberships_count
  from auth_profiles ap
  left join active_memberships am on am.user_id = ap.user_id
  left join legacy_profiles lp on lp.user_id = ap.user_id
  left join resident_links rl on rl.user_id = ap.user_id
  left join inactive_memberships im on im.user_id = ap.user_id
)
select
  rc.user_id,
  rc.masked_email,
  rc.email_confirmed,
  rc.last_sign_in_at,
  rc.candidate_role,
  rc.legacy_role_canonical,
  rc.legacy_role_display_name,
  rc.membership_id,
  rc.membership_status,
  rc.membership_role_name,
  rc.membership_legacy_role_canonical,
  rc.membership_conjunto_id,
  rc.legacy_conjunto_id,
  rc.membership_residente_id,
  rc.linked_residente_id,
  rc.residente_conjunto_id,
  rc.source_legacy,
  rc.inactive_memberships_count,
  case
    when rc.candidate_role = 'residente'
      and rc.membership_status = 'active'
      and rc.membership_residente_id is not null
      and rc.linked_residente_id is not null
      and rc.membership_conjunto_id = rc.residente_conjunto_id
      then 'residente_dev_suficiente'
    when rc.candidate_role in ('admin', 'vigilancia') and rc.membership_status = 'active'
      then 'rol_tenant_activo'
    when rc.membership_id is null and rc.candidate_role in ('admin', 'vigilancia', 'residente')
      then 'candidato_fallback_legacy'
    when rc.membership_id is null and rc.inactive_memberships_count = 0
      then 'sin_membership_activa'
    when rc.membership_id is null and rc.inactive_memberships_count > 0
      then 'solo_membership_inactiva'
    else 'revisar_coherencia'
  end as readiness_status
from resolved_candidates rc
order by
  case rc.candidate_role
    when 'admin' then 1
    when 'vigilancia' then 2
    when 'residente' then 3
    else 4
  end,
  rc.last_sign_in_at desc nulls last,
  rc.user_id;
