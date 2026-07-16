-- FASE 5.4.3: aplica lifecycle operativo y ownership estricto a creación de visitas.
-- No cambia firma ni shape de retorno; no modifica RLS ni estructura de tablas.

create or replace function public.fn_crear_o_reutilizar_visitante_y_registro(
  p_conjunto_id uuid,
  p_residente_id uuid,
  p_apartamento_id uuid,
  p_nombre text,
  p_tipo_documento text,
  p_documento text,
  p_tipo_vehiculo text,
  p_placa text,
  p_fecha_visita date
)
returns table(visitante_id uuid, registro_id uuid, qr_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_residente_id uuid;
  v_conjunto_id uuid;
  v_apartamento_id uuid;
  v_visitante_id uuid;
  v_qr text;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '28000';
  end if;

  select r.id, r.conjunto_id, r.apartamento_id
    into v_residente_id, v_conjunto_id, v_apartamento_id
  from public.residentes r
  where r.id = p_residente_id
    and r.conjunto_id = p_conjunto_id
    and (
      exists (
        select 1
        from public.tenant_memberships tm
        where tm.user_id = v_actor_id
          and tm.conjunto_id = r.conjunto_id
          and tm.residente_id = r.id
          and tm.role_name = 'residente'
          and tm.status = 'active'
      )
      or (
        r.usuario_id = v_actor_id
        and not exists (
          select 1
          from public.tenant_memberships tm_any
          where tm_any.user_id = v_actor_id
            and tm_any.conjunto_id = r.conjunto_id
            and tm_any.residente_id = r.id
            and tm_any.role_name = 'residente'
        )
      )
    )
  limit 1;

  if v_residente_id is null or v_conjunto_id is null then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if p_apartamento_id is not null then
    if p_apartamento_id is distinct from v_apartamento_id then
      raise exception 'FORBIDDEN'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.apartamentos a
      where a.id = p_apartamento_id
        and a.conjunto_id = v_conjunto_id
    ) then
      raise exception 'FORBIDDEN'
        using errcode = '42501';
    end if;
  end if;

  if not public.fn_tenant_is_operational(v_conjunto_id, 'tenant_mutation') then
    raise exception 'TENANT_OPERATIONAL_LOCKED'
      using errcode = 'P0001';
  end if;

  select v.id into v_visitante_id
  from public.visitantes v
  where v.conjunto_id = v_conjunto_id
    and v.residente_id = v_residente_id
    and v.tipo_documento = upper(p_tipo_documento)
    and v.documento = p_documento
  order by v.created_at asc, v.id asc
  limit 1
  for update;

  if v_visitante_id is null then
    insert into public.visitantes(
      conjunto_id, residente_id, nombre, tipo_documento, documento, tipo_vehiculo, placa
    )
    values (
      v_conjunto_id,
      v_residente_id,
      p_nombre,
      upper(p_tipo_documento),
      p_documento,
      p_tipo_vehiculo,
      nullif(upper(coalesce(p_placa, '')), '')
    )
    returning id into v_visitante_id;
  else
    update public.visitantes v
    set nombre = p_nombre,
        tipo_vehiculo = p_tipo_vehiculo,
        placa = nullif(upper(coalesce(p_placa, '')), ''),
        updated_at = now()
    where v.id = v_visitante_id;
  end if;

  v_qr := gen_random_uuid()::text;

  insert into public.registro_visitas(
    visitante_id, conjunto_id, apartamento_id, fecha_visita, estado, qr_code, created_at
  )
  values (
    v_visitante_id, v_conjunto_id, p_apartamento_id, p_fecha_visita, 'pendiente', v_qr, now()
  )
  returning id into registro_id;

  visitante_id := v_visitante_id;
  qr_code := v_qr;
  return next;
end;
$$;

comment on function public.fn_crear_o_reutilizar_visitante_y_registro(uuid, uuid, uuid, text, text, text, text, text, date) is
  'FASE 5.4.3: crea/reutiliza visitante y registro de visita solo para residente autenticado same-tenant; bloquea tenant_mutation si lifecycle no está operativo.';

revoke all on function public.fn_crear_o_reutilizar_visitante_y_registro(uuid, uuid, uuid, text, text, text, text, text, date) from public;
revoke execute on function public.fn_crear_o_reutilizar_visitante_y_registro(uuid, uuid, uuid, text, text, text, text, text, date) from anon;
grant execute on function public.fn_crear_o_reutilizar_visitante_y_registro(uuid, uuid, uuid, text, text, text, text, text, date) to authenticated, service_role;
