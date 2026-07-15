-- FASE 5.3: lectura lifecycle para Backoffice Superadmin.
--
-- RPC read-only complementaria para no cambiar la firma de
-- public.fn_platform_tenants_summary() ni romper consumidores existentes.
-- No habilita writes directos ni modifica RLS de tablas lifecycle.

create or replace function public.fn_platform_tenants_lifecycle_summary()
returns table (
  conjunto_id uuid,
  lifecycle_status text,
  license_status text,
  plan_code text,
  operational_lock boolean,
  lock_reason text,
  status_reason text,
  activated_at timestamptz,
  suspended_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authenticated session required'
      using errcode = '28000';
  end if;

  if not (
    public.fn_is_platform_superadmin()
    or public.fn_has_platform_role('platform_ops')
  ) then
    raise exception 'platform role required'
      using errcode = '42501';
  end if;

  return query
  select
    tl.conjunto_id,
    tl.lifecycle_status,
    tl.license_status,
    tl.plan_code,
    tl.operational_lock,
    tl.lock_reason,
    tl.status_reason,
    tl.activated_at,
    tl.suspended_at,
    tl.archived_at,
    tl.updated_at
  from public.tenant_lifecycle tl
  order by tl.updated_at desc nulls last, tl.conjunto_id;
end;
$$;

revoke all on function public.fn_platform_tenants_lifecycle_summary() from public;
revoke execute on function public.fn_platform_tenants_lifecycle_summary() from anon;
grant execute on function public.fn_platform_tenants_lifecycle_summary() to authenticated, service_role;
