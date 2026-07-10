-- FASE 5.4.1: helper central de validacion operativa tenant.
--
-- Evalua public.tenant_lifecycle sin conectar todavia modulos operativos,
-- sin cambiar RLS de tablas existentes y sin registrar auditoria porque es
-- read-only/deterministico.

create or replace function public.fn_tenant_is_operational(
  p_conjunto_id uuid,
  p_operation text default 'tenant_mutation'
)
returns boolean
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_operation text := nullif(btrim(p_operation), '');
  v_lifecycle_status text;
  v_operational_lock boolean;
begin
  if p_conjunto_id is null then
    raise exception 'conjunto_id is required'
      using errcode = '22004';
  end if;

  if v_operation is null then
    raise exception 'operation is required'
      using errcode = '22004';
  end if;

  if v_operation not in (
    'tenant_read',
    'tenant_mutation',
    'tenant_terminal_close',
    'tenant_onboarding_config',
    'platform_read'
  ) then
    raise exception 'invalid tenant operation'
      using errcode = '22023';
  end if;

  select tl.lifecycle_status,
         tl.operational_lock
    into v_lifecycle_status,
         v_operational_lock
  from public.tenant_lifecycle tl
  where tl.conjunto_id = p_conjunto_id;

  if not found then
    return case
      when v_operation = 'platform_read' then true
      else false
    end;
  end if;

  return case v_lifecycle_status
    when 'active' then case v_operation
      when 'tenant_read' then true
      when 'tenant_mutation' then not v_operational_lock
      when 'tenant_terminal_close' then true
      when 'tenant_onboarding_config' then false
      when 'platform_read' then true
      else false
    end
    when 'onboarding' then case v_operation
      when 'tenant_read' then true
      when 'tenant_mutation' then false
      when 'tenant_terminal_close' then false
      when 'tenant_onboarding_config' then not v_operational_lock
      when 'platform_read' then true
      else false
    end
    when 'suspended' then case v_operation
      when 'tenant_read' then true
      when 'tenant_mutation' then false
      when 'tenant_terminal_close' then true
      when 'tenant_onboarding_config' then false
      when 'platform_read' then true
      else false
    end
    when 'archived' then case v_operation
      when 'tenant_read' then false
      when 'tenant_mutation' then false
      when 'tenant_terminal_close' then false
      when 'tenant_onboarding_config' then false
      when 'platform_read' then true
      else false
    end
    else false
  end;
end;
$$;

comment on function public.fn_tenant_is_operational(uuid, text) is
  'FASE 5.4.1: helper read-only para evaluar si una operacion tenant esta permitida por tenant_lifecycle; no valida identidad/rol del actor.';

revoke all on function public.fn_tenant_is_operational(uuid, text) from public;
revoke execute on function public.fn_tenant_is_operational(uuid, text) from anon;
revoke execute on function public.fn_tenant_is_operational(uuid, text) from authenticated;
grant execute on function public.fn_tenant_is_operational(uuid, text) to service_role;
