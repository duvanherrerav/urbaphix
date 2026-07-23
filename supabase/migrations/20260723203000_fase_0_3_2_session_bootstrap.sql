begin;

create or replace function public.fn_session_bootstrap(p_preferred_conjunto_id uuid default null)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.usuarios_app%rowtype;
  v_active_count integer := 0;
  v_selected jsonb;
  v_status text;
  v_tenants jsonb := '[]'::jsonb;
  v_platform jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_profile
  from public.usuarios_app ua
  where ua.id = v_user_id;

  if found and coalesce(v_profile.activo, true) = false then
    v_status := 'USER_DISABLED';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', pm.id,
      'role', pm.role_name,
      'status', pm.status,
      'createdAt', pm.created_at,
      'updatedAt', pm.updated_at,
      'revokedAt', pm.revoked_at
    ) order by pm.created_at), '[]'::jsonb)
  into v_platform
  from public.platform_memberships pm
  where pm.user_id = v_user_id
    and pm.status = 'active';

  with memberships as (
    select
      tm.id,
      tm.user_id,
      tm.conjunto_id,
      tm.role_name,
      tm.residente_id,
      tm.status,
      tm.created_at,
      tm.updated_at,
      tm.revoked_at,
      c.nombre as tenant_name,
      c.direccion,
      c.ciudad,
      coalesce(tl.lifecycle_status, 'onboarding') as lifecycle_status,
      tl.license_status,
      coalesce(tl.operational_lock, false) as operational_lock,
      tl.lock_reason,
      tl.status_reason,
      case tm.role_name
        when 'residente' then jsonb_build_array('visits.create','visits.read_own','packages.read_own','reservations.create','reservations.read_own','payments.read_own','payments.upload_receipt')
        when 'vigilante' then jsonb_build_array('visits.read_tenant','visits.check_in','visits.check_out','packages.create','packages.manage_tenant','reservations.check_in','incidents.create')
        when 'admin_conjunto' then jsonb_build_array('visits.read_tenant','packages.manage_tenant','reservations.approve','payments.manage_tenant','incidents.manage','tenant.manage_users','tenant.manage_configuration')
        when 'contador' then jsonb_build_array('payments.manage_tenant')
        else '[]'::jsonb
      end as capabilities,
      case
        when coalesce(tl.lifecycle_status, 'onboarding') = 'archived' then 'TENANT_ARCHIVED'
        when coalesce(tl.lifecycle_status, 'onboarding') = 'suspended' then 'TENANT_SUSPENDED'
        when tl.license_status in ('suspended','expired','canceled') then 'TENANT_LICENSE_BLOCKED'
        when coalesce(tl.operational_lock, false) then 'TENANT_OPERATIONALLY_LOCKED'
        when coalesce(tl.lifecycle_status, 'onboarding') in ('active','onboarding') then 'READY'
        else 'CONFIGURATION_ERROR'
      end as access_status
    from public.tenant_memberships tm
    join public.conjuntos c on c.id = tm.conjunto_id
    left join public.tenant_lifecycle tl on tl.conjunto_id = tm.conjunto_id
    where tm.user_id = v_user_id
      and tm.status = 'active'
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'membershipId', id,
      'tenantId', conjunto_id,
      'tenantName', tenant_name,
      'tenantAddress', direccion,
      'tenantCity', ciudad,
      'role', role_name,
      'residentId', residente_id,
      'membershipStatus', status,
      'lifecycleStatus', lifecycle_status,
      'licenseStatus', license_status,
      'operationalLock', operational_lock,
      'lockReason', lock_reason,
      'statusReason', status_reason,
      'capabilities', capabilities,
      'accessStatus', access_status,
      'createdAt', created_at,
      'updatedAt', updated_at,
      'revokedAt', revoked_at
    ) order by created_at), '[]'::jsonb),
    count(*)::integer
  into v_tenants, v_active_count
  from memberships;

  if v_status is null then
    if v_active_count = 0 then
      v_status := 'NO_MEMBERSHIP';
    elsif p_preferred_conjunto_id is not null then
      select elem into v_selected
      from jsonb_array_elements(v_tenants) elem
      where (elem->>'tenantId')::uuid = p_preferred_conjunto_id
      limit 1;

      if v_selected is null then
        v_status := 'TENANT_SELECTION_REQUIRED';
        v_warnings := v_warnings || jsonb_build_array('preferred_tenant_not_available');
      else
        v_status := coalesce(v_selected->>'accessStatus', 'CONFIGURATION_ERROR');
      end if;
    elsif v_active_count = 1 then
      v_selected := v_tenants->0;
      v_status := coalesce(v_selected->>'accessStatus', 'CONFIGURATION_ERROR');
    else
      v_status := 'TENANT_SELECTION_REQUIRED';
    end if;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'user', jsonb_build_object(
      'id', v_user_id,
      'email', coalesce(v_profile.email, (select email from auth.users where id = v_user_id)),
      'displayName', coalesce(v_profile.nombre, (select raw_user_meta_data->>'name' from auth.users where id = v_user_id)),
      'phone', v_profile.telefono,
      'active', coalesce(v_profile.activo, true)
    ),
    'platformMemberships', v_platform,
    'tenantMemberships', v_tenants,
    'activeContext', v_selected,
    'selectableTenants', v_tenants,
    'warnings', v_warnings,
    'contractVersion', '0.3.2'
  );
end;
$$;

revoke all on function public.fn_session_bootstrap(uuid) from public;
revoke all on function public.fn_session_bootstrap(uuid) from anon;
grant execute on function public.fn_session_bootstrap(uuid) to authenticated;
grant execute on function public.fn_session_bootstrap(uuid) to service_role;

comment on function public.fn_session_bootstrap(uuid) is
'FASE 0.3.2: bootstrap canónico de identidad, membresías, lifecycle y tenant activo derivado desde auth.uid().';

commit;
