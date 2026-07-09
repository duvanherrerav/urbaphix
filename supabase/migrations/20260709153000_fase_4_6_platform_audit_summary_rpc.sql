-- FASE 4.6: fuente RLS-safe para Auditoria Superadmin read-only.
--
-- Expone únicamente agregados de trazabilidad para roles plataforma autorizados.
-- No retorna metadata, mensajes, errores, títulos, detalles, usuarios ni PII.
-- No modifica policies RLS ni habilita CRUD.

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
      coalesce(oe.severity, 'sin_severidad')::text as value,
      oe.created_at::timestamp with time zone as created_at
    from public.operational_events oe

    union all

    select
      'operational_events'::text as source,
      'fuente'::text as dimension,
      coalesce(oe.source, 'sin_fuente')::text as value,
      oe.created_at::timestamp with time zone as created_at
    from public.operational_events oe

    union all

    select
      'operational_events'::text as source,
      'tipo'::text as dimension,
      coalesce(oe.event_type, 'sin_tipo')::text as value,
      oe.created_at::timestamp with time zone as created_at
    from public.operational_events oe

    union all

    select
      'pagos_eventos'::text as source,
      'evento'::text as dimension,
      coalesce(pe.evento, 'sin_evento')::text as value,
      pe.created_at::timestamp with time zone as created_at
    from public.pagos_eventos pe

    union all

    select
      'pagos_eventos'::text as source,
      'estado'::text as dimension,
      coalesce(pe.estado_nuevo, 'sin_estado')::text as value,
      pe.created_at::timestamp with time zone as created_at
    from public.pagos_eventos pe

    union all

    select
      'reservas_eventos'::text as source,
      'accion'::text as dimension,
      coalesce(re.accion, 'sin_accion')::text as value,
      re.created_at::timestamp with time zone as created_at
    from public.reservas_eventos re

    union all

    select
      'notificaciones'::text as source,
      'tipo'::text as dimension,
      coalesce(n.tipo, 'sin_tipo')::text as value,
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
      coalesce(i.estado, 'sin_estado')::text as value,
      i.created_at::timestamp with time zone as created_at
    from public.incidentes i

    union all

    select
      'incidentes'::text as source,
      'tipo'::text as dimension,
      coalesce(i.tipo, 'sin_tipo')::text as value,
      i.created_at::timestamp with time zone as created_at
    from public.incidentes i

    union all

    select
      'incidentes'::text as source,
      'nivel'::text as dimension,
      coalesce(i.nivel, 'sin_nivel')::text as value,
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

revoke all on function public.fn_platform_audit_summary() from public;
revoke execute on function public.fn_platform_audit_summary() from anon;
grant execute on function public.fn_platform_audit_summary() to authenticated, service_role;
