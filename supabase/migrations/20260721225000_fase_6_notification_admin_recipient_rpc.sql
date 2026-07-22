-- ============================================================
-- FASE 6.0
-- Lookup seguro de administradores para notificaciones
--
-- Evita reabrir lectura amplia sobre public.usuarios_app.
-- Retorna únicamente UUID de administradores del tenant autorizado.
-- ============================================================

begin;

create or replace function public.fn_notification_admin_recipient_ids(
  p_conjunto_id uuid
)
returns table (
  user_id uuid
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authenticated session required'
      using errcode = '28000';
  end if;

  if p_conjunto_id is null then
    raise exception 'p_conjunto_id is required'
      using errcode = '22004';
  end if;

  if not (
    public.fn_is_platform_superadmin()
    or public.fn_has_tenant_access(p_conjunto_id)
    or exists (
      select 1
      from public.usuarios_app caller
      where caller.id = auth.uid()
        and caller.conjunto_id = p_conjunto_id
        and coalesce(caller.activo, true)
    )
  ) then
    raise exception 'tenant access required'
      using errcode = '42501';
  end if;

  return query
  select ua.id
  from public.usuarios_app ua
  where ua.conjunto_id = p_conjunto_id
    and ua.rol_id = 'admin'
    and coalesce(ua.activo, true)
  order by ua.id;
end;
$$;

alter function public.fn_notification_admin_recipient_ids(uuid)
owner to postgres;

revoke all
on function public.fn_notification_admin_recipient_ids(uuid)
from public;

revoke execute
on function public.fn_notification_admin_recipient_ids(uuid)
from anon;

grant execute
on function public.fn_notification_admin_recipient_ids(uuid)
to authenticated, service_role;

do $$
begin
  if to_regprocedure(
    'public.fn_notification_admin_recipient_ids(uuid)'
  ) is null then
    raise exception
      'Postcheck failed: fn_notification_admin_recipient_ids(uuid) no existe';
  end if;

  if has_function_privilege(
    'anon',
    'public.fn_notification_admin_recipient_ids(uuid)',
    'EXECUTE'
  ) then
    raise exception
      'Postcheck failed: anon conserva EXECUTE sobre RPC';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.fn_notification_admin_recipient_ids(uuid)',
    'EXECUTE'
  ) then
    raise exception
      'Postcheck failed: authenticated no tiene EXECUTE sobre RPC';
  end if;
end;
$$;

commit;