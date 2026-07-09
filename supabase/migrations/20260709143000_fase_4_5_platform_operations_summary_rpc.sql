-- FASE 4.5: fuente RLS-safe para Operacion Superadmin read-only.
--
-- Expone únicamente agregados operativos cross-tenant para roles plataforma autorizados.
-- No retorna PII, no habilita CRUD y no modifica policies RLS.

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
      coalesce(pg.estado, 'sin_estado')::text as estado,
      pg.created_at::timestamp with time zone as created_at,
      (pg.estado in ('pendiente', 'vencido', 'en_revision', 'rechazado')) as is_open
    from public.pagos pg

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

revoke all on function public.fn_platform_operations_summary() from public;
revoke execute on function public.fn_platform_operations_summary() from anon;
grant execute on function public.fn_platform_operations_summary() to authenticated, service_role;
