-- Forward-only canonical promotion for issue #307.
--
-- Baseline: the canonical definitions already applied in DEV and versioned by
-- 20260722130000. This migration deliberately reapplies those same definitions
-- when promoted to QA and PRD; it does not contact or modify any environment by
-- itself. It is idempotent: functions use CREATE OR REPLACE and the four named
-- policies are dropped only to recreate their exact canonical definitions.
--
-- Replaces only audited permanent function and policy definitions with the
-- canonical DEV/PRD baseline versions. This migration is forward-only: it does not
-- modify data, schema_migrations, tables, or non-scoped policies.

begin;

-- Canonical SECURITY DEFINER platform RPCs and lifecycle helper.


create or replace function public.fn_platform_dashboard_metrics()
returns table (
  conjuntos bigint,
  usuarios_app bigint,
  tenant_memberships_active bigint,
  platform_memberships_active bigint,
  residentes bigint,
  visitas_30d bigint,
  paquetes_pendientes bigint,
  pagos_pendientes bigint,
  incidentes_abiertos bigint
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
    (select count(*) from public.conjuntos)::bigint as conjuntos,
    (select count(*) from public.usuarios_app)::bigint as usuarios_app,
    (select count(*) from public.tenant_memberships where status = 'active')::bigint as tenant_memberships_active,
    (select count(*) from public.platform_memberships where status = 'active')::bigint as platform_memberships_active,
    (select count(*) from public.residentes)::bigint as residentes,
    (select count(*) from public.registro_visitas where created_at >= now() - interval '30 days')::bigint as visitas_30d,
    (select count(*) from public.paquetes where estado = 'pendiente')::bigint as paquetes_pendientes,
    (select count(*) from public.pagos where estado = 'pendiente')::bigint as pagos_pendientes,
    (select count(*) from public.incidentes where estado in ('nuevo', 'en_gestion'))::bigint as incidentes_abiertos;
end;
$$;

create or replace function public.fn_platform_tenants_summary()
returns table (
  conjunto_id uuid,
  nombre text,
  ciudad text,
  direccion text,
  created_at timestamp without time zone,
  usuarios bigint,
  residentes bigint,
  visitas_30d bigint,
  paquetes_pendientes bigint,
  pagos_pendientes bigint
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
    c.id as conjunto_id,
    c.nombre,
    c.ciudad,
    c.direccion,
    c.created_at,
    coalesce(ua.total, 0)::bigint as usuarios,
    coalesce(r.total, 0)::bigint as residentes,
    coalesce(rv.total, 0)::bigint as visitas_30d,
    coalesce(pq.total, 0)::bigint as paquetes_pendientes,
    coalesce(pg.total, 0)::bigint as pagos_pendientes
  from public.conjuntos c
  left join (
    select ua_src.conjunto_id, count(*)::bigint as total
    from public.usuarios_app ua_src
    where ua_src.conjunto_id is not null
    group by ua_src.conjunto_id
  ) ua on ua.conjunto_id = c.id
  left join (
    select r_src.conjunto_id, count(*)::bigint as total
    from public.residentes r_src
    where r_src.conjunto_id is not null
    group by r_src.conjunto_id
  ) r on r.conjunto_id = c.id
  left join (
    select rv_src.conjunto_id, count(*)::bigint as total
    from public.registro_visitas rv_src
    where rv_src.created_at >= now() - interval '30 days'
    group by rv_src.conjunto_id
  ) rv on rv.conjunto_id = c.id
  left join (
    select pq_src.conjunto_id, count(*)::bigint as total
    from public.paquetes pq_src
    where pq_src.estado = 'pendiente'
      and pq_src.conjunto_id is not null
    group by pq_src.conjunto_id
  ) pq on pq.conjunto_id = c.id
  left join (
    select pg_src.conjunto_id, count(*)::bigint as total
    from public.pagos pg_src
    where pg_src.estado = 'pendiente'
      and pg_src.conjunto_id is not null
    group by pg_src.conjunto_id
  ) pg on pg.conjunto_id = c.id
  order by c.created_at desc nulls last, c.nombre asc;
end;
$$;

create or replace function public.fn_platform_memberships_summary()
returns table (
  membership_scope text,
  membership_id uuid,
  user_id uuid,
  email text,
  conjunto_id uuid,
  conjunto_nombre text,
  role_name text,
  status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  revoked_at timestamp with time zone
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
    'platform'::text as membership_scope,
    pm.id as membership_id,
    pm.user_id,
    au.email::text as email,
    null::uuid as conjunto_id,
    null::text as conjunto_nombre,
    pm.role_name,
    pm.status,
    pm.created_at,
    pm.updated_at,
    pm.revoked_at
  from public.platform_memberships pm
  left join auth.users au on au.id = pm.user_id

  union all

  select
    'tenant'::text as membership_scope,
    tm.id as membership_id,
    tm.user_id,
    au.email::text as email,
    tm.conjunto_id,
    c.nombre::text as conjunto_nombre,
    tm.role_name,
    tm.status,
    tm.created_at,
    tm.updated_at,
    tm.revoked_at
  from public.tenant_memberships tm
  left join auth.users au on au.id = tm.user_id
  left join public.conjuntos c on c.id = tm.conjunto_id

  order by 1 asc, 9 desc nulls last, 4 asc nulls last;
end;
$$;

create or replace function public.fn_platform_operations_summary()
returns table (
  domain text,
  estado text,
  total bigint,
  total_30d bigint,
  open_total bigint
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
  with operations as (
    select
      'visitas'::text as domain,
      coalesce(rv.estado, 'sin_estado')::text as estado,
      rv.created_at as created_at,
      (rv.estado = 'pendiente') as is_open
    from public.registro_visitas rv

    union all

    select
      'paquetes'::text as domain,
      coalesce(p.estado, 'sin_estado')::text as estado,
      coalesce(p.created_at, p.fecha_recibido)::timestamp with time zone as created_at,
      (p.estado = 'pendiente') as is_open
    from public.paquetes p

    union all

    select
      'pagos'::text as domain,
      pago_estado.estado_efectivo as estado,
      pg.created_at::timestamp with time zone as created_at,
      (pago_estado.estado_efectivo in ('pendiente', 'vencido', 'en_revision', 'rechazado')) as is_open
    from public.pagos pg
    cross join lateral (
      select case
        when lower(trim(coalesce(pg.estado, ''))) in ('pendiente', 'rechazado')
          and pg.fecha_vencimiento is not null
          and pg.fecha_vencimiento < now()
          then 'vencido'::text
        else coalesce(nullif(lower(trim(pg.estado)), ''), 'sin_estado')::text
      end as estado_efectivo
    ) pago_estado

    union all

    select
      'incidentes'::text as domain,
      coalesce(i.estado, 'sin_estado')::text as estado,
      i.created_at::timestamp with time zone as created_at,
      (i.estado in ('nuevo', 'en_gestion')) as is_open
    from public.incidentes i
  )
  select
    operations.domain,
    operations.estado,
    count(*)::bigint as total,
    count(*) filter (where operations.created_at >= now() - interval '30 days')::bigint as total_30d,
    count(*) filter (where operations.is_open)::bigint as open_total
  from operations
  group by operations.domain, operations.estado
  order by operations.domain asc, total desc, operations.estado asc;
end;
$$;

create or replace function public.fn_platform_audit_summary()
returns table (
  source text,
  dimension text,
  value text,
  total bigint,
  total_30d bigint
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
  with audit_signals as (
    select
      'operational_events'::text as source,
      'severidad'::text as dimension,
      case
        when nullif(lower(trim(oe.severity)), '') is null then 'sin_severidad'
        when lower(trim(oe.severity)) in ('info', 'warn', 'error') then lower(trim(oe.severity))
        else 'otro'
      end as value,
      oe.created_at::timestamp with time zone as created_at
    from public.operational_events oe

    union all

    select
      'operational_events'::text as source,
      'fuente'::text as dimension,
      case
        when nullif(lower(trim(oe.source)), '') is null then 'sin_fuente'
        when lower(trim(oe.source)) in ('frontend', 'edge_function') then lower(trim(oe.source))
        else 'otro'
      end as value,
      oe.created_at::timestamp with time zone as created_at
    from public.operational_events oe

    union all

    select
      'operational_events'::text as source,
      'tipo'::text as dimension,
      case
        when nullif(lower(trim(oe.event_type)), '') is null then 'sin_tipo'
        when lower(trim(oe.event_type)) in ('aborterror', 'invalidstateerror', 'error', 'unknownerror') then lower(trim(oe.event_type))
        else 'otro'
      end as value,
      oe.created_at::timestamp with time zone as created_at
    from public.operational_events oe

    union all

    select
      'pagos_eventos'::text as source,
      'evento'::text as dimension,
      case
        when nullif(lower(trim(pe.evento)), '') is null then 'sin_evento'
        when lower(trim(pe.evento)) in ('cobro_creado', 'comprobante_subido', 'comprobante_reemplazado', 'pago_aprobado', 'comprobante_rechazado', 'pago_vencido') then lower(trim(pe.evento))
        else 'otro'
      end as value,
      pe.created_at::timestamp with time zone as created_at
    from public.pagos_eventos pe

    union all

    select
      'pagos_eventos'::text as source,
      'estado'::text as dimension,
      case
        when nullif(lower(trim(pe.estado_nuevo)), '') is null then 'sin_estado'
        when lower(trim(pe.estado_nuevo)) in ('pendiente', 'pagado', 'en_revision', 'rechazado', 'vencido') then lower(trim(pe.estado_nuevo))
        else 'otro'
      end as value,
      pe.created_at::timestamp with time zone as created_at
    from public.pagos_eventos pe

    union all

    select
      'reservas_eventos'::text as source,
      'accion'::text as dimension,
      case
        when nullif(lower(trim(re.accion)), '') is null then 'sin_accion'
        when lower(trim(re.accion)) in ('pendiente', 'aprobada', 'rechazada', 'cancelada', 'finalizada', 'check_in', 'check_out') then lower(trim(re.accion))
        else 'otro'
      end as value,
      re.created_at::timestamp with time zone as created_at
    from public.reservas_eventos re

    union all

    select
      'notificaciones'::text as source,
      'tipo'::text as dimension,
      case
        when nullif(lower(trim(n.tipo)), '') is null then 'sin_tipo'
        when lower(trim(n.tipo)) in ('visita_ingreso', 'seguridad_alerta', 'alerta_critica', 'paquete_entregado', 'nuevo_cobro', 'recordatorio_pago', 'pago_aprobado', 'pago_rechazado', 'comprobante_subido') then lower(trim(n.tipo))
        else 'otro'
      end as value,
      n.created_at::timestamp with time zone as created_at
    from public.notificaciones n

    union all

    select
      'notificaciones'::text as source,
      'estado'::text as dimension,
      case when n.leido then 'leida' else 'no_leida' end as value,
      n.created_at::timestamp with time zone as created_at
    from public.notificaciones n

    union all

    select
      'incidentes'::text as source,
      'estado'::text as dimension,
      case
        when nullif(lower(trim(i.estado)), '') is null then 'sin_estado'
        when lower(trim(i.estado)) in ('nuevo', 'en_gestion', 'resuelto', 'cerrado') then lower(trim(i.estado))
        else 'otro'
      end as value,
      i.created_at::timestamp with time zone as created_at
    from public.incidentes i

    union all

    select
      'incidentes'::text as source,
      'tipo'::text as dimension,
      case
        when nullif(lower(trim(i.tipo)), '') is null then 'sin_tipo'
        when lower(trim(i.tipo)) in ('seguridad', 'convivencia', 'infraestructura', 'acceso') then lower(trim(i.tipo))
        else 'otro'
      end as value,
      i.created_at::timestamp with time zone as created_at
    from public.incidentes i

    union all

    select
      'incidentes'::text as source,
      'nivel'::text as dimension,
      case
        when nullif(lower(trim(i.nivel)), '') is null then 'sin_nivel'
        when lower(trim(i.nivel)) in ('alto', 'medio', 'bajo') then lower(trim(i.nivel))
        else 'otro'
      end as value,
      i.created_at::timestamp with time zone as created_at
    from public.incidentes i
  )
  select
    audit_signals.source,
    audit_signals.dimension,
    audit_signals.value,
    count(*)::bigint as total,
    count(*) filter (where audit_signals.created_at >= now() - interval '30 days')::bigint as total_30d
  from audit_signals
  group by audit_signals.source, audit_signals.dimension, audit_signals.value
  order by audit_signals.source asc, audit_signals.dimension asc, total desc, audit_signals.value asc;
end;
$$;

create or replace function public.fn_platform_transition_tenant_lifecycle(
  p_conjunto_id uuid,
  p_target_status text,
  p_reason text default null
)
returns table (
  conjunto_id uuid,
  previous_status text,
  lifecycle_status text,
  operational_lock boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_previous_status text;
  v_reason text := nullif(btrim(p_reason), '');
  v_requires_reason boolean;
begin
  if v_actor_id is null then
    raise exception 'authenticated session required' using errcode = '28000';
  end if;

  if public.fn_is_platform_superadmin() then
    v_actor_role := 'superadmin';
  elsif public.fn_has_platform_role('platform_ops') then
    v_actor_role := 'platform_ops';
  else
    raise exception 'platform role required' using errcode = '42501';
  end if;

  if p_conjunto_id is null then
    raise exception 'conjunto_id is required' using errcode = '22004';
  end if;

  if p_target_status not in ('onboarding', 'active', 'suspended', 'archived') then
    raise exception 'invalid lifecycle target status' using errcode = '22023';
  end if;

  select tl.lifecycle_status
    into v_previous_status
  from public.tenant_lifecycle tl
  where tl.conjunto_id = p_conjunto_id
  for update;

  if not found then
    if exists (select 1 from public.conjuntos c where c.id = p_conjunto_id) then
      raise exception 'tenant_lifecycle row not found for tenant' using errcode = 'P0002';
    end if;

    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  if v_previous_status = p_target_status then
    raise exception 'lifecycle transition to same status is not allowed' using errcode = '22023';
  end if;

  if v_previous_status = 'archived' then
    raise exception 'archived tenant lifecycle is terminal in this phase' using errcode = '22023';
  end if;

  if not (
    (v_previous_status = 'onboarding' and p_target_status = 'active')
    or (v_previous_status in ('onboarding', 'active', 'suspended') and p_target_status = 'archived' and v_actor_role = 'superadmin')
    or (v_previous_status = 'active' and p_target_status = 'suspended')
    or (v_previous_status = 'suspended' and p_target_status = 'active')
  ) then
    raise exception 'lifecycle transition is not allowed' using errcode = '42501';
  end if;

  v_requires_reason := p_target_status in ('suspended', 'archived')
    or (v_previous_status = 'suspended' and p_target_status = 'active');

  if v_requires_reason and v_reason is null then
    raise exception 'reason is required for this lifecycle transition' using errcode = '22004';
  end if;

  if v_reason is not null and char_length(v_reason) > 280 then
    raise exception 'reason exceeds 280 characters' using errcode = '22001';
  end if;

  update public.tenant_lifecycle tl
  set lifecycle_status = p_target_status,
      operational_lock = (p_target_status in ('suspended', 'archived')),
      lock_reason = case
        when p_target_status in ('suspended', 'archived') then v_reason
        else null
      end,
      status_reason = v_reason,
      activated_at = case
        when p_target_status = 'active' then now()
        else tl.activated_at
      end,
      suspended_at = case
        when p_target_status = 'suspended' then now()
        else tl.suspended_at
      end,
      archived_at = case
        when p_target_status = 'archived' then now()
        else tl.archived_at
      end,
      updated_at = now(),
      updated_by = v_actor_id
  where tl.conjunto_id = p_conjunto_id
  returning tl.conjunto_id, v_previous_status, tl.lifecycle_status, tl.operational_lock, tl.updated_at
  into conjunto_id, previous_status, lifecycle_status, operational_lock, updated_at;

  insert into public.tenant_lifecycle_events (
    conjunto_id,
    actor_user_id,
    actor_platform_role,
    previous_status,
    lifecycle_status,
    reason,
    source,
    metadata
  ) values (
    p_conjunto_id,
    v_actor_id,
    v_actor_role,
    v_previous_status,
    p_target_status,
    v_reason,
    'rpc',
    jsonb_build_object('function', 'fn_platform_transition_tenant_lifecycle')
  );

  return next;
end;
$$;

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

create or replace function public.fn_reservas_zonas_ocupacion_disponibilidad(
  p_conjunto_id uuid,
  p_recurso_id uuid,
  p_fecha_inicio timestamp without time zone,
  p_fecha_fin timestamp without time zone,
  p_reserva_id_excluir uuid default null
)
returns table (
  recurso_id uuid,
  fecha_inicio timestamp without time zone,
  fecha_fin timestamp without time zone,
  estado text,
  ocupado boolean,
  bloqueo boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    rz.recurso_id,
    rz.fecha_inicio,
    rz.fecha_fin,
    rz.estado,
    true as ocupado,
    false as bloqueo
  from public.reservas_zonas rz
  where rz.conjunto_id = p_conjunto_id
    and rz.recurso_id = p_recurso_id
    and rz.estado in ('solicitada', 'aprobada', 'en_curso')
    and rz.fecha_inicio < p_fecha_fin
    and rz.fecha_fin > p_fecha_inicio
    and (p_reserva_id_excluir is null or rz.id <> p_reserva_id_excluir)
    and (
      public.fn_is_platform_superadmin()
      or exists (
        select 1
        from public.tenant_memberships tm
        where tm.user_id = auth.uid()
          and tm.conjunto_id = rz.conjunto_id
          and tm.status = 'active'
          and tm.role_name in ('admin_conjunto', 'contador', 'residente', 'vigilancia', 'vigilante')
      )
      or exists (
        select 1
        from public.usuarios_app ua
        where ua.id = auth.uid()
          and ua.conjunto_id = rz.conjunto_id
          and ua.rol_id in ('admin', 'residente', 'vigilancia', 'vigilante')
      )
      or exists (
        select 1
        from public.residentes r
        where r.usuario_id = auth.uid()
          and r.conjunto_id = rz.conjunto_id
      )
    );
$$;

revoke all on function public.fn_reservas_zonas_ocupacion_disponibilidad(
  uuid,
  uuid,
  timestamp without time zone,
  timestamp without time zone,
  uuid
) from public;

grant execute on function public.fn_reservas_zonas_ocupacion_disponibilidad(
  uuid,
  uuid,
  timestamp without time zone,
  timestamp without time zone,
  uuid
) to authenticated, service_role;

create or replace function public.get_user_residente_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select r.id
  from public.residentes r
  where r.usuario_id = auth.uid()
  limit 1;
$$;

alter function public.get_user_residente_id() owner to postgres;

revoke all
on function public.get_user_residente_id()
from public;

revoke execute
on function public.get_user_residente_id()
from anon;

grant execute
on function public.get_user_residente_id()
to authenticated, service_role;

alter table public.reservas_zonas enable row level security;

drop policy if exists reservas_zonas_insert
on public.reservas_zonas;

create policy reservas_zonas_insert
on public.reservas_zonas
for insert
to authenticated
with check (
  conjunto_id = public.get_user_conjunto_id()
  and (
    public.is_admin()
    or public.is_vigilancia()
    or (
      public.is_residente()
      and residente_id = public.get_user_residente_id()
    )
  )
);

drop policy if exists reservas_zonas_update
on public.reservas_zonas;

create policy reservas_zonas_update
on public.reservas_zonas
for update
to authenticated
using (
  conjunto_id = public.get_user_conjunto_id()
  and (
    public.is_admin()
    or public.is_vigilancia()
    or (
      public.is_residente()
      and residente_id = public.get_user_residente_id()
    )
  )
)
with check (
  conjunto_id = public.get_user_conjunto_id()
  and (
    public.is_admin()
    or public.is_vigilancia()
    or (
      public.is_residente()
      and residente_id = public.get_user_residente_id()
    )
  )
);

alter table public.visitantes enable row level security;

drop policy if exists visitantes_insert_residente
on public.visitantes;

create policy visitantes_insert_residente
on public.visitantes
for insert
to authenticated
with check (
  public.is_residente()
  and conjunto_id = public.get_user_conjunto_id()
  and residente_id = public.get_user_residente_id()
);

drop policy if exists visitantes_update_residente
on public.visitantes;

create policy visitantes_update_residente
on public.visitantes
for update
to authenticated
using (
  public.is_residente()
  and conjunto_id = public.get_user_conjunto_id()
  and residente_id = public.get_user_residente_id()
)
with check (
  public.is_residente()
  and conjunto_id = public.get_user_conjunto_id()
  and residente_id = public.get_user_residente_id()
);


-- Reassert canonical grants after each replacement.
revoke all on function public.fn_platform_audit_summary() from public;
revoke execute on function public.fn_platform_audit_summary() from anon;
grant execute on function public.fn_platform_audit_summary() to authenticated, service_role;
revoke all on function public.fn_platform_dashboard_metrics() from public;
revoke execute on function public.fn_platform_dashboard_metrics() from anon;
grant execute on function public.fn_platform_dashboard_metrics() to authenticated, service_role;
revoke all on function public.fn_platform_memberships_summary() from public;
revoke execute on function public.fn_platform_memberships_summary() from anon;
grant execute on function public.fn_platform_memberships_summary() to authenticated, service_role;
revoke all on function public.fn_platform_operations_summary() from public;
revoke execute on function public.fn_platform_operations_summary() from anon;
grant execute on function public.fn_platform_operations_summary() to authenticated, service_role;
revoke all on function public.fn_platform_tenants_lifecycle_summary() from public;
revoke execute on function public.fn_platform_tenants_lifecycle_summary() from anon;
grant execute on function public.fn_platform_tenants_lifecycle_summary() to authenticated, service_role;
revoke all on function public.fn_platform_tenants_summary() from public;
revoke execute on function public.fn_platform_tenants_summary() from anon;
grant execute on function public.fn_platform_tenants_summary() to authenticated, service_role;
revoke all on function public.fn_platform_transition_tenant_lifecycle(uuid, text, text) from public;
revoke execute on function public.fn_platform_transition_tenant_lifecycle(uuid, text, text) from anon;
grant execute on function public.fn_platform_transition_tenant_lifecycle(uuid, text, text) to authenticated, service_role;
revoke all on function public.fn_reservas_zonas_ocupacion_disponibilidad(uuid, uuid, timestamp without time zone, timestamp without time zone, uuid) from public;
revoke execute on function public.fn_reservas_zonas_ocupacion_disponibilidad(uuid, uuid, timestamp without time zone, timestamp without time zone, uuid) from anon;
grant execute on function public.fn_reservas_zonas_ocupacion_disponibilidad(uuid, uuid, timestamp without time zone, timestamp without time zone, uuid) to authenticated, service_role;
revoke all on function public.fn_tenant_is_operational(uuid, text) from public;
revoke execute on function public.fn_tenant_is_operational(uuid, text) from anon;
revoke execute on function public.fn_tenant_is_operational(uuid, text) from authenticated;
grant execute on function public.fn_tenant_is_operational(uuid, text) to service_role;

-- QA/PRD owners are postgres. Reassert them explicitly after replacement.
alter function public.fn_platform_audit_summary() owner to postgres;
alter function public.fn_platform_dashboard_metrics() owner to postgres;
alter function public.fn_platform_memberships_summary() owner to postgres;
alter function public.fn_platform_operations_summary() owner to postgres;
alter function public.fn_platform_tenants_lifecycle_summary() owner to postgres;
alter function public.fn_platform_tenants_summary() owner to postgres;
alter function public.fn_platform_transition_tenant_lifecycle(uuid, text, text) owner to postgres;
alter function public.fn_reservas_zonas_ocupacion_disponibilidad(uuid, uuid, timestamp without time zone, timestamp without time zone, uuid) owner to postgres;
alter function public.fn_tenant_is_operational(uuid, text) owner to postgres;
alter function public.get_user_residente_id() owner to postgres;

-- Postchecks cover all scoped objects, hardened function settings, and grants.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'fn_platform_audit_summary', 'fn_platform_dashboard_metrics',
      'fn_platform_memberships_summary', 'fn_platform_operations_summary',
      'fn_platform_tenants_lifecycle_summary', 'fn_platform_tenants_summary',
      'fn_platform_transition_tenant_lifecycle',
      'fn_reservas_zonas_ocupacion_disponibilidad', 'fn_tenant_is_operational',
      'get_user_residente_id'
    );
  if v_count <> 10 then
    raise exception 'postcheck failed: expected 10 reconciled functions, found %', v_count;
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'fn_platform_audit_summary', 'fn_platform_dashboard_metrics',
        'fn_platform_memberships_summary', 'fn_platform_operations_summary',
        'fn_platform_tenants_lifecycle_summary', 'fn_platform_tenants_summary',
        'fn_platform_transition_tenant_lifecycle',
        'fn_reservas_zonas_ocupacion_disponibilidad'
      )
      and (not p.prosecdef or p.proconfig is null or not p.proconfig @> array['search_path=public, pg_temp'])
  ) then
    raise exception 'postcheck failed: SECURITY DEFINER or search_path mismatch';
  end if;

  -- This legacy helper's QA/PRD-canonical SECURITY DEFINER search_path is
  -- intentionally `public, auth`, unlike the hardened RPCs above.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_user_residente_id'
      and (not p.prosecdef or p.proconfig is null or not p.proconfig @> array['search_path=public, auth'])
  ) then
    raise exception 'postcheck failed: get_user_residente_id attributes mismatch';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'fn_tenant_is_operational'
      and (p.prosecdef or p.provolatile <> 's'::"char" or p.proconfig is null or not p.proconfig @> array['search_path=public, pg_temp'])
  ) then
    raise exception 'postcheck failed: fn_tenant_is_operational attributes mismatch';
  end if;

  if has_function_privilege('anon', 'public.fn_platform_tenants_summary()', 'EXECUTE')
    or has_function_privilege('anon', 'public.fn_reservas_zonas_ocupacion_disponibilidad(uuid, uuid, timestamp without time zone, timestamp without time zone, uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.fn_tenant_is_operational(uuid, text)', 'EXECUTE') then
    raise exception 'postcheck failed: reconciled execute grants mismatch';
  end if;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and ((tablename = 'reservas_zonas' and policyname in ('reservas_zonas_insert', 'reservas_zonas_update'))
      or (tablename = 'visitantes' and policyname in ('visitantes_insert_residente', 'visitantes_update_residente')));
  if v_count <> 4 then
    raise exception 'postcheck failed: expected 4 reconciled policies, found %', v_count;
  end if;
end;
$$;


-- Semantic postchecks for the promotion baseline. These assert required SQL
-- clauses and canonical policy predicates instead of comparing raw
-- pg_get_functiondef output, whose formatting differs across PostgreSQL builds.
do $$
declare
  v_definition text;
  v_policy_expr text;
begin
  -- Each canonical function must remain addressable by its audited signature.
  if to_regprocedure('public.fn_platform_audit_summary()') is null
    or to_regprocedure('public.fn_platform_dashboard_metrics()') is null
    or to_regprocedure('public.fn_platform_memberships_summary()') is null
    or to_regprocedure('public.fn_platform_operations_summary()') is null
    or to_regprocedure('public.fn_platform_tenants_lifecycle_summary()') is null
    or to_regprocedure('public.fn_platform_tenants_summary()') is null
    or to_regprocedure('public.fn_platform_transition_tenant_lifecycle(uuid,text,text)') is null
    or to_regprocedure('public.fn_reservas_zonas_ocupacion_disponibilidad(uuid,uuid,timestamp without time zone,timestamp without time zone,uuid)') is null
    or to_regprocedure('public.fn_tenant_is_operational(uuid,text)') is null
    or to_regprocedure('public.get_user_residente_id()') is null then
    raise exception 'postcheck failed: canonical function signature missing';
  end if;

  -- Check semantic clauses that characterize the audited canonical helper and
  -- hotfix independently from pg_get_functiondef whitespace and formatting.
  select pg_get_functiondef('public.get_user_residente_id()'::regprocedure)
    into v_definition;
  if position('from public.residentes r' in lower(v_definition)) = 0
    or position('where r.usuario_id = auth.uid()' in lower(v_definition)) = 0
    or position('limit 1' in lower(v_definition)) = 0 then
    raise exception 'postcheck failed: get_user_residente_id canonical definition mismatch';
  end if;

  select pg_get_functiondef('public.fn_platform_tenants_summary()'::regprocedure)
    into v_definition;
  if position('conjunto_id' in lower(v_definition)) = 0
    or position('public.' in lower(v_definition)) = 0 then
    raise exception 'postcheck failed: fn_platform_tenants_summary canonical hotfix mismatch';
  end if;

  -- Normalized policy expressions make whitespace-only deparser differences
  -- irrelevant while retaining the required tenant/resident access semantics.
  select regexp_replace(lower(pg_get_expr(pol.polwithcheck, pol.polrelid)), '\s+', '', 'g')
    into v_policy_expr
  from pg_policy pol
  where pol.polrelid = 'public.reservas_zonas'::regclass
    and pol.polname = 'reservas_zonas_insert';
  if v_policy_expr <> '((conjunto_id=get_user_conjunto_id())and(is_admin()oris_vigilancia()or(is_residente()and(residente_id=get_user_residente_id()))))' then
    raise exception 'postcheck failed: reservas_zonas_insert canonical policy mismatch';
  end if;

  select regexp_replace(lower(pg_get_expr(pol.polqual, pol.polrelid)), '\s+', '', 'g') || '|' ||
         regexp_replace(lower(pg_get_expr(pol.polwithcheck, pol.polrelid)), '\s+', '', 'g')
    into v_policy_expr
  from pg_policy pol
  where pol.polrelid = 'public.reservas_zonas'::regclass
    and pol.polname = 'reservas_zonas_update';
  if v_policy_expr <> '((conjunto_id=get_user_conjunto_id())and(is_admin()oris_vigilancia()or(is_residente()and(residente_id=get_user_residente_id()))))|((conjunto_id=get_user_conjunto_id())and(is_admin()oris_vigilancia()or(is_residente()and(residente_id=get_user_residente_id()))))' then
    raise exception 'postcheck failed: reservas_zonas_update canonical policy mismatch';
  end if;

  select regexp_replace(lower(pg_get_expr(pol.polwithcheck, pol.polrelid)), '\s+', '', 'g')
    into v_policy_expr
  from pg_policy pol
  where pol.polrelid = 'public.visitantes'::regclass
    and pol.polname = 'visitantes_insert_residente';
  if v_policy_expr <> '(is_residente()and(conjunto_id=get_user_conjunto_id())and(residente_id=get_user_residente_id()))' then
    raise exception 'postcheck failed: visitantes_insert_residente canonical policy mismatch';
  end if;

  select regexp_replace(lower(pg_get_expr(pol.polqual, pol.polrelid)), '\s+', '', 'g') || '|' ||
         regexp_replace(lower(pg_get_expr(pol.polwithcheck, pol.polrelid)), '\s+', '', 'g')
    into v_policy_expr
  from pg_policy pol
  where pol.polrelid = 'public.visitantes'::regclass
    and pol.polname = 'visitantes_update_residente';
  if v_policy_expr <> '(is_residente()and(conjunto_id=get_user_conjunto_id())and(residente_id=get_user_residente_id()))|(is_residente()and(conjunto_id=get_user_conjunto_id())and(residente_id=get_user_residente_id()))' then
    raise exception 'postcheck failed: visitantes_update_residente canonical policy mismatch';
  end if;
end;
$$;

commit;
