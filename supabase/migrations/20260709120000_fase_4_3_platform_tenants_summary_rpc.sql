-- FASE 4.3: fuente RLS-safe para Gestión de conjuntos / tenants read-only.
--
-- Expone únicamente datos seguros del tenant y contadores agregados por conjunto.
-- No retorna PII, no habilita CRUD, no modifica RLS policies y mantiene service_role fuera del frontend.

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
    select conjunto_id, count(*)::bigint as total
    from public.usuarios_app
    where conjunto_id is not null
    group by conjunto_id
  ) ua on ua.conjunto_id = c.id
  left join (
    select conjunto_id, count(*)::bigint as total
    from public.residentes
    where conjunto_id is not null
    group by conjunto_id
  ) r on r.conjunto_id = c.id
  left join (
    select conjunto_id, count(*)::bigint as total
    from public.registro_visitas
    where created_at >= now() - interval '30 days'
    group by conjunto_id
  ) rv on rv.conjunto_id = c.id
  left join (
    select conjunto_id, count(*)::bigint as total
    from public.paquetes
    where estado = 'pendiente'
      and conjunto_id is not null
    group by conjunto_id
  ) pq on pq.conjunto_id = c.id
  left join (
    select conjunto_id, count(*)::bigint as total
    from public.pagos
    where estado = 'pendiente'
      and conjunto_id is not null
    group by conjunto_id
  ) pg on pg.conjunto_id = c.id
  order by c.created_at desc nulls last, c.nombre asc;
end;
$$;

revoke all on function public.fn_platform_tenants_summary() from public;
revoke execute on function public.fn_platform_tenants_summary() from anon;
grant execute on function public.fn_platform_tenants_summary() to authenticated, service_role;
