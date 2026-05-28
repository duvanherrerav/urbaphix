-- FASE 3C.1: memberships platform/tenant + helpers base + RLS solo para tablas nuevas

create table if not exists public.platform_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_name text not null,
  status text not null default 'active',
  granted_by uuid null references auth.users(id),
  granted_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  constraint platform_memberships_role_chk check (role_name in ('superadmin','platform_support','platform_auditor','platform_ops')),
  constraint platform_memberships_status_chk check (status in ('active','suspended','revoked'))
);

create unique index if not exists ux_platform_memberships_user_role_active
  on public.platform_memberships(user_id, role_name)
  where status = 'active';

create index if not exists ix_platform_memberships_user_status
  on public.platform_memberships(user_id, status);

create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conjunto_id uuid not null references public.conjuntos(id) on delete cascade,
  role_name text not null,
  residente_id uuid null references public.residentes(id) on delete set null,
  status text not null default 'active',
  source_legacy text not null default 'usuarios_app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  constraint tenant_memberships_role_chk check (role_name in ('admin_conjunto','vigilante','residente','contador','comite')),
  constraint tenant_memberships_status_chk check (status in ('active','suspended','revoked'))
);

create unique index if not exists ux_tenant_memberships_user_conjunto_active
  on public.tenant_memberships(user_id, conjunto_id)
  where status = 'active';

create index if not exists ix_tenant_memberships_conjunto_status
  on public.tenant_memberships(conjunto_id, status);

create index if not exists ix_tenant_memberships_residente_not_null
  on public.tenant_memberships(residente_id)
  where residente_id is not null;

create or replace function public.fn_is_platform_superadmin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_memberships pm
    where pm.user_id = auth.uid()
      and pm.role_name = 'superadmin'
      and pm.status = 'active'
  );
$$;

create or replace function public.fn_has_platform_role(target_role_name text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_memberships pm
    where pm.user_id = auth.uid()
      and pm.role_name = target_role_name
      and pm.status = 'active'
  );
$$;

create or replace function public.fn_has_tenant_access(target_conjunto_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = target_conjunto_id
      and tm.status = 'active'
  );
$$;

create or replace function public.fn_has_tenant_role(target_conjunto_id uuid, target_role_name text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = target_conjunto_id
      and tm.role_name = target_role_name
      and tm.status = 'active'
  );
$$;

revoke all on function public.fn_is_platform_superadmin() from public;
revoke all on function public.fn_has_platform_role(text) from public;
revoke all on function public.fn_has_tenant_access(uuid) from public;
revoke all on function public.fn_has_tenant_role(uuid, text) from public;

grant execute on function public.fn_is_platform_superadmin() to authenticated, service_role;
grant execute on function public.fn_has_platform_role(text) to authenticated, service_role;
grant execute on function public.fn_has_tenant_access(uuid) to authenticated, service_role;
grant execute on function public.fn_has_tenant_role(uuid, text) to authenticated, service_role;

alter table public.platform_memberships enable row level security;
alter table public.tenant_memberships enable row level security;

drop policy if exists platform_memberships_select on public.platform_memberships;
create policy platform_memberships_select
on public.platform_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.fn_is_platform_superadmin()
);

drop policy if exists platform_memberships_insert on public.platform_memberships;
create policy platform_memberships_insert
on public.platform_memberships
for insert
to authenticated
with check (public.fn_is_platform_superadmin());

drop policy if exists platform_memberships_update on public.platform_memberships;
create policy platform_memberships_update
on public.platform_memberships
for update
to authenticated
using (public.fn_is_platform_superadmin())
with check (public.fn_is_platform_superadmin());

drop policy if exists platform_memberships_delete_denied on public.platform_memberships;
create policy platform_memberships_delete_denied
on public.platform_memberships
for delete
to authenticated
using (false);

drop policy if exists tenant_memberships_select on public.tenant_memberships;
create policy tenant_memberships_select
on public.tenant_memberships
for select
to authenticated
using (
  public.fn_is_platform_superadmin()
  or public.fn_has_tenant_access(conjunto_id)
);

drop policy if exists tenant_memberships_insert on public.tenant_memberships;
create policy tenant_memberships_insert
on public.tenant_memberships
for insert
to authenticated
with check (
  public.fn_is_platform_superadmin()
  or public.fn_has_platform_role('platform_ops')
);

drop policy if exists tenant_memberships_update on public.tenant_memberships;
create policy tenant_memberships_update
on public.tenant_memberships
for update
to authenticated
using (
  public.fn_is_platform_superadmin()
  or public.fn_has_platform_role('platform_ops')
)
with check (
  public.fn_is_platform_superadmin()
  or public.fn_has_platform_role('platform_ops')
);

drop policy if exists tenant_memberships_delete_denied on public.tenant_memberships;
create policy tenant_memberships_delete_denied
on public.tenant_memberships
for delete
to authenticated
using (false);
