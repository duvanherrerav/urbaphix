-- FASE 4.2: fuente RLS-safe para métricas globales del Dashboard plataforma MVP.
--
-- Expone únicamente contadores agregados para roles plataforma autorizados.
-- No retorna PII, no habilita CRUD y mantiene service_role fuera del frontend.

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

revoke all on function public.fn_platform_dashboard_metrics() from public;
revoke execute on function public.fn_platform_dashboard_metrics() from anon;
grant execute on function public.fn_platform_dashboard_metrics() to authenticated, service_role;
