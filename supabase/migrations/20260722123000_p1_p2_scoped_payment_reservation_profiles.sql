-- P1/P2: completa la autorización de perfiles dependientes.
--
-- No abre lectura sobre usuarios_app: ambos RPCs devuelven solo user_id y
-- nombre después de validar cada recurso solicitado.

begin;

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
    from unnest(p_pago_ids) requested_pago_id
    where not exists (
      select 1
      from public.pagos p
      where p.id = requested_pago_id
        and (
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
          or exists (
            select 1
            from public.tenant_memberships tm
            where tm.user_id = auth.uid()
              and tm.conjunto_id = p.conjunto_id
              and tm.residente_id = p.residente_id
              and tm.status = 'active'
              and tm.role_name = 'residente'
          )
          or exists (
            select 1
            from public.residentes r
            where r.id = p.residente_id
              and r.conjunto_id = p.conjunto_id
              and r.usuario_id = auth.uid()
          )
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
  join related_user_ids related on related.user_id = ua.id
  order by ua.id;
end;
$$;

alter function public.fn_payment_related_user_profiles(uuid[]) owner to postgres;
revoke all on function public.fn_payment_related_user_profiles(uuid[]) from public;
revoke execute on function public.fn_payment_related_user_profiles(uuid[]) from anon;
grant execute on function public.fn_payment_related_user_profiles(uuid[]) to authenticated, service_role;

create or replace function public.fn_reservation_related_user_profiles(
  p_reserva_ids uuid[]
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

  if coalesce(cardinality(p_reserva_ids), 0) = 0 then
    return;
  end if;

  if exists (
    select 1
    from unnest(p_reserva_ids) requested_reserva_id
    where not exists (
      select 1
      from public.reservas_zonas rz
      where rz.id = requested_reserva_id
        and (
          public.fn_is_platform_superadmin()
          or exists (
            select 1 from public.tenant_memberships tm
            where tm.user_id = auth.uid() and tm.conjunto_id = rz.conjunto_id
              and tm.status = 'active'
              and tm.role_name in ('admin_conjunto', 'contador', 'vigilancia', 'vigilante')
          )
          or exists (
            select 1 from public.usuarios_app caller
            where caller.id = auth.uid() and caller.conjunto_id = rz.conjunto_id
              and coalesce(caller.activo, true)
              and caller.rol_id in ('admin', 'vigilancia', 'vigilante')
          )
          or exists (
            select 1 from public.tenant_memberships tm
            where tm.user_id = auth.uid() and tm.conjunto_id = rz.conjunto_id
              and tm.residente_id = rz.residente_id and tm.status = 'active'
              and tm.role_name = 'residente'
          )
          or exists (
            select 1 from public.residentes r
            where r.id = rz.residente_id and r.conjunto_id = rz.conjunto_id
              and r.usuario_id = auth.uid()
          )
        )
    )
  ) then
    raise exception 'reservation tenant access required' using errcode = '42501';
  end if;

  return query
  select ua.id, ua.nombre
  from public.reservas_zonas rz
  join public.residentes r on r.id = rz.residente_id and r.conjunto_id = rz.conjunto_id
  join public.usuarios_app ua on ua.id = r.usuario_id
  where rz.id = any(p_reserva_ids)
  order by ua.id;
end;
$$;

alter function public.fn_reservation_related_user_profiles(uuid[]) owner to postgres;
revoke all on function public.fn_reservation_related_user_profiles(uuid[]) from public;
revoke execute on function public.fn_reservation_related_user_profiles(uuid[]) from anon;
grant execute on function public.fn_reservation_related_user_profiles(uuid[]) to authenticated, service_role;

do $$
begin
  if to_regprocedure('public.fn_reservation_related_user_profiles(uuid[])') is null then
    raise exception 'Postcheck failed: reservation profile RPC missing';
  end if;
  if has_function_privilege('anon', 'public.fn_payment_related_user_profiles(uuid[])', 'EXECUTE')
    or has_function_privilege('anon', 'public.fn_reservation_related_user_profiles(uuid[])', 'EXECUTE') then
    raise exception 'Postcheck failed: anon retains EXECUTE over a dependent-profile RPC';
  end if;
end;
$$;

commit;
