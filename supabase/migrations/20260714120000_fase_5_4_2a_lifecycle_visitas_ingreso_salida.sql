-- FASE 5.4.2A: aplica lifecycle tenant al backend de ingreso/salida de visitas.
-- No cambia firmas ni shape de retorno; no modifica RLS ni estructura de tablas.

create or replace function public.fn_registrar_ingreso_visita(
  p_qr_code text,
  p_vigilante_id uuid
)
returns table(registro_id uuid, estado text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_registro_id uuid;
  v_conjunto_id uuid;
  v_estado text;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '28000';
  end if;

  if p_vigilante_id is distinct from v_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  select rv.id, rv.conjunto_id, rv.estado
    into v_registro_id, v_conjunto_id, v_estado
  from public.registro_visitas rv
  where rv.qr_code = p_qr_code
  for update;

  if v_registro_id is null or v_estado <> 'pendiente' then
    raise exception 'QR inválido o ya usado';
  end if;

  if not (
    exists (
      select 1
      from public.tenant_memberships tm
      where tm.user_id = v_actor_id
        and tm.conjunto_id = v_conjunto_id
        and tm.status = 'active'
        and tm.role_name in ('admin_conjunto', 'vigilancia', 'vigilante')
    )
    or exists (
      select 1
      from public.usuarios_app ua
      where ua.id = v_actor_id
        and ua.conjunto_id = v_conjunto_id
        and ua.rol_id in ('admin', 'vigilancia', 'vigilante')
    )
  ) then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if not public.fn_tenant_is_operational(v_conjunto_id, 'tenant_mutation') then
    raise exception 'TENANT_OPERATIONAL_LOCKED'
      using errcode = 'P0001';
  end if;

  update public.registro_visitas rv
  set estado = 'ingresado',
      hora_ingreso = now(),
      validado_por = v_actor_id,
      updated_at = now()
  where rv.id = v_registro_id
    and rv.estado = 'pendiente'
  returning rv.id, rv.estado
  into registro_id, estado;

  if registro_id is null then
    raise exception 'QR inválido o ya usado';
  end if;

  return next;
end;
$$;

create or replace function public.fn_registrar_salida_visita(
  p_registro_id uuid,
  p_vigilante_id uuid
)
returns table(registro_id uuid, estado text, hora_salida timestamp without time zone)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_conjunto_id uuid;
  v_estado text;
  v_hora_salida timestamp without time zone;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '28000';
  end if;

  if p_vigilante_id is distinct from v_actor_id then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  select rv.conjunto_id, rv.estado, rv.hora_salida
    into v_conjunto_id, v_estado, v_hora_salida
  from public.registro_visitas rv
  where rv.id = p_registro_id
  for update;

  if v_conjunto_id is null then
    raise exception 'No se pudo registrar salida: registro no encontrado o estado inválido';
  end if;

  if not (
    exists (
      select 1
      from public.tenant_memberships tm
      where tm.user_id = v_actor_id
        and tm.conjunto_id = v_conjunto_id
        and tm.status = 'active'
        and tm.role_name in ('admin_conjunto', 'vigilancia', 'vigilante')
    )
    or exists (
      select 1
      from public.usuarios_app ua
      where ua.id = v_actor_id
        and ua.conjunto_id = v_conjunto_id
        and ua.rol_id in ('admin', 'vigilancia', 'vigilante')
    )
  ) then
    raise exception 'FORBIDDEN'
      using errcode = '42501';
  end if;

  if v_estado = 'salido' then
    registro_id := p_registro_id;
    estado := v_estado;
    hora_salida := v_hora_salida;
    return next;
  end if;

  if v_estado <> 'ingresado' then
    raise exception 'No se pudo registrar salida: registro no encontrado o estado inválido';
  end if;

  if not public.fn_tenant_is_operational(v_conjunto_id, 'tenant_terminal_close') then
    raise exception 'TENANT_OPERATIONAL_LOCKED'
      using errcode = 'P0001';
  end if;

  update public.registro_visitas rv
  set estado = 'salido',
      hora_salida = now(),
      validado_por = v_actor_id,
      updated_at = now()
  where rv.id = p_registro_id
    and rv.estado = 'ingresado'
  returning rv.id, rv.estado, rv.hora_salida
  into registro_id, estado, hora_salida;

  if registro_id is null then
    raise exception 'No se pudo registrar salida: registro no encontrado o estado inválido';
  end if;

  return next;
end;
$$;

comment on function public.fn_registrar_ingreso_visita(text, uuid) is
  'FASE 5.4.2A: registra ingreso de visita autenticado y same-tenant; bloquea nuevas mutaciones si tenant_lifecycle no permite tenant_mutation.';

comment on function public.fn_registrar_salida_visita(uuid, uuid) is
  'FASE 5.4.2A: registra cierre terminal de visita autenticado y same-tenant; permite solo cierres de visitas ingresadas segun tenant_terminal_close.';

revoke all on function public.fn_registrar_ingreso_visita(text, uuid) from public;
revoke execute on function public.fn_registrar_ingreso_visita(text, uuid) from anon;
grant execute on function public.fn_registrar_ingreso_visita(text, uuid) to authenticated, service_role;

revoke all on function public.fn_registrar_salida_visita(uuid, uuid) from public;
revoke execute on function public.fn_registrar_salida_visita(uuid, uuid) from anon;
grant execute on function public.fn_registrar_salida_visita(uuid, uuid) to authenticated, service_role;
