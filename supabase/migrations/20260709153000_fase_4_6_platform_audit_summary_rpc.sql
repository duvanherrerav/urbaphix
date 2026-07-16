-- FASE 4.6: fuente RLS-safe para Auditoria Superadmin read-only.
--
-- Expone únicamente agregados de trazabilidad para roles plataforma autorizados.
-- No retorna metadata, mensajes, errores, títulos, detalles, usuarios ni PII.
-- Bucketiza labels libres con whitelist segura; valores fuera de whitelist se agrupan como otro.
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

revoke all on function public.fn_platform_audit_summary() from public;
revoke execute on function public.fn_platform_audit_summary() from anon;
grant execute on function public.fn_platform_audit_summary() to authenticated, service_role;
