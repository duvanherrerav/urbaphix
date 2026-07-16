-- FASE 4.4: fuente RLS-safe para Usuarios/Memberships Superadmin read-only.
--
-- Expone únicamente datos mínimos de memberships plataforma y tenant para roles plataforma autorizados.
-- No retorna teléfonos, documentos, placas, comprobantes ni PII innecesaria; no habilita CRUD ni modifica RLS policies.

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

revoke all on function public.fn_platform_memberships_summary() from public;
revoke execute on function public.fn_platform_memberships_summary() from anon;
grant execute on function public.fn_platform_memberships_summary() to authenticated, service_role;
