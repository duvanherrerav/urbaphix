-- FASE 3D.7 - Identificar usuarios de prueba DEV
-- Solo lectura. Ejecutar manualmente por un operador humano autorizado en DEV.
-- No usar QA ni PRD. No publicar datos personales ni secretos.
-- Propósito: ubicar candidatos por rol antes de la evidencia autenticada real.

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
    r.nombre as legacy_role_name
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
)
select
  ap.user_id,
  ap.masked_email,
  ap.email_confirmed,
  ap.last_sign_in_at,
  coalesce(am.role_name, lp.legacy_role_name, 'sin_membership_activa') as candidate_role,
  am.membership_id,
  am.status as membership_status,
  am.conjunto_id as membership_conjunto_id,
  lp.conjunto_id as legacy_conjunto_id,
  am.residente_id as membership_residente_id,
  rl.residente_id as linked_residente_id,
  rl.residente_conjunto_id,
  am.source_legacy,
  coalesce(im.inactive_memberships_count, 0) as inactive_memberships_count,
  case
    when am.role_name = 'residente'
      and am.status = 'active'
      and am.residente_id is not null
      and rl.residente_id is not null
      and am.conjunto_id = rl.residente_conjunto_id
      then 'residente_dev_suficiente'
    when am.role_name in ('admin_conjunto', 'vigilante') and am.status = 'active'
      then 'rol_tenant_activo'
    when am.membership_id is null and coalesce(im.inactive_memberships_count, 0) = 0
      then 'sin_membership_activa'
    when am.membership_id is null and coalesce(im.inactive_memberships_count, 0) > 0
      then 'solo_membership_inactiva'
    else 'revisar_coherencia'
  end as readiness_status
from auth_profiles ap
left join active_memberships am on am.user_id = ap.user_id
left join legacy_profiles lp on lp.user_id = ap.user_id
left join resident_links rl on rl.user_id = ap.user_id
left join inactive_memberships im on im.user_id = ap.user_id
order by
  case coalesce(am.role_name, lp.legacy_role_name, 'sin_membership_activa')
    when 'admin_conjunto' then 1
    when 'vigilante' then 2
    when 'vigilancia' then 3
    when 'residente' then 4
    else 5
  end,
  ap.last_sign_in_at desc nulls last,
  ap.user_id;
