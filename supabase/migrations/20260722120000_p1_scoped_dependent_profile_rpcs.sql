-- P1: perfiles dependientes acotados
--
-- Mantiene usuarios_app en self-read. Estos lookups devuelven solamente los
-- campos imprescindibles después de validar el tenant y el rol del actor.

begin;

create or replace function public.fn_visit_push_recipient(
  p_registro_id uuid
)
returns table (
  user_id uuid,
  fcm_token text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_conjunto_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authenticated session required' using errcode = '28000';
  end if;

  if p_registro_id is null then
    raise exception 'p_registro_id is required' using errcode = '22004';
  end if;

  select rv.conjunto_id
    into v_conjunto_id
  from public.registro_visitas rv
  where rv.id = p_registro_id;

  if v_conjunto_id is null then
    raise exception 'visit not found' using errcode = 'P0002';
  end if;

  if not (
    exists (
      select 1
      from public.tenant_memberships tm
      where tm.user_id = auth.uid()
        and tm.conjunto_id = v_conjunto_id
        and tm.status = 'active'
        and tm.role_name in ('admin_conjunto', 'vigilancia', 'vigilante')
    )
    or exists (
      select 1
      from public.usuarios_app caller
      where caller.id = auth.uid()
        and caller.conjunto_id = v_conjunto_id
        and coalesce(caller.activo, true)
        and caller.rol_id in ('admin', 'vigilancia', 'vigilante')
    )
  ) then
    raise exception 'operational tenant access required' using errcode = '42501';
  end if;

  return query
  select recipient.id, recipient.fcm_token
  from public.registro_visitas rv
  join public.visitantes v
    on v.id = rv.visitante_id
   and v.conjunto_id = rv.conjunto_id
  join public.residentes r
    on r.id = v.residente_id
   and r.conjunto_id = rv.conjunto_id
  join public.usuarios_app recipient
    on recipient.id = r.usuario_id
   and recipient.conjunto_id = rv.conjunto_id
  where rv.id = p_registro_id
    and rv.conjunto_id = v_conjunto_id
    and coalesce(recipient.activo, true);
end;
$$;

alter function public.fn_visit_push_recipient(uuid) owner to postgres;
revoke all on function public.fn_visit_push_recipient(uuid) from public;
revoke execute on function public.fn_visit_push_recipient(uuid) from anon;
grant execute on function public.fn_visit_push_recipient(uuid) to authenticated, service_role;

create or replace function public.fn_payment_related_user_profiles(
  p_pago_ids uuid[]
)
returns table (
  user_id uuid,
  nombre text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authenticated session required' using errcode = '28000';
  end if;

  if coalesce(cardinality(p_pago_ids), 0) = 0 then
    return;
  end if;

  if exists (
    select 1
    from public.pagos p
    where p.id = any(p_pago_ids)
      and not (
        public.fn_is_platform_superadmin()
        or exists (
          select 1
          from public.tenant_memberships tm
          where tm.user_id = auth.uid()
            and tm.conjunto_id = p.conjunto_id
            and tm.status = 'active'
            and tm.role_name in ('admin_conjunto', 'contador')
        )
        or exists (
          select 1
          from public.usuarios_app caller
          where caller.id = auth.uid()
            and caller.conjunto_id = p.conjunto_id
            and coalesce(caller.activo, true)
            and caller.rol_id = 'admin'
        )
      )
  ) then
    raise exception 'payment tenant access required' using errcode = '42501';
  end if;

  return query
  with authorized_pagos as (
    select p.id, p.conjunto_id, r.usuario_id as residente_user_id
    from public.pagos p
    left join public.residentes r
      on r.id = p.residente_id
     and r.conjunto_id = p.conjunto_id
    where p.id = any(p_pago_ids)
  ), related_user_ids as (
    select ap.residente_user_id as user_id
    from authorized_pagos ap
    where ap.residente_user_id is not null

    union

    select pe.usuario_id
    from public.pagos_eventos pe
    join authorized_pagos ap
      on ap.id = pe.pago_id
     and ap.conjunto_id = pe.conjunto_id
    where pe.usuario_id is not null
  )
  select ua.id, ua.nombre
  from public.usuarios_app ua
  join related_user_ids related
    on related.user_id = ua.id
  order by ua.id;
end;
$$;

alter function public.fn_payment_related_user_profiles(uuid[]) owner to postgres;
revoke all on function public.fn_payment_related_user_profiles(uuid[]) from public;
revoke execute on function public.fn_payment_related_user_profiles(uuid[]) from anon;
grant execute on function public.fn_payment_related_user_profiles(uuid[]) to authenticated, service_role;

do $$
begin
  if to_regprocedure('public.fn_visit_push_recipient(uuid)') is null
    or to_regprocedure('public.fn_payment_related_user_profiles(uuid[])') is null then
    raise exception 'Postcheck failed: scoped dependent-profile RPC missing';
  end if;

  if has_function_privilege('anon', 'public.fn_visit_push_recipient(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.fn_payment_related_user_profiles(uuid[])', 'EXECUTE') then
    raise exception 'Postcheck failed: anon retains EXECUTE over a dependent-profile RPC';
  end if;

  if not has_function_privilege('authenticated', 'public.fn_visit_push_recipient(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.fn_payment_related_user_profiles(uuid[])', 'EXECUTE') then
    raise exception 'Postcheck failed: authenticated lacks EXECUTE over a dependent-profile RPC';
  end if;
end;
$$;

commit;
