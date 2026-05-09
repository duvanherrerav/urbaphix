-- =====================================================
-- HELPERS MULTITENANT URBAPHIX
-- =====================================================

create or replace function public.get_user_conjunto_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select conjunto_id
  from usuarios_app
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.get_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol_id
  from usuarios_app
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_user_role() = 'admin';
$$;

create or replace function public.is_vigilancia()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_user_role() = 'vigilancia';
$$;

create or replace function public.is_residente()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_user_role() = 'residente';
$$;

-- =====================================================
-- ZONAS_COMUNES
-- =====================================================

alter table public.zonas_comunes enable row level security;

drop policy if exists zonas_select_conjunto on public.zonas_comunes;

create policy zonas_select_conjunto
on public.zonas_comunes
for select
to authenticated
using (
  conjunto_id = public.get_user_conjunto_id()
);

-- =====================================================
-- RECURSOS_COMUNES
-- =====================================================

drop policy if exists recursos_admin_write on public.recursos_comunes;
drop policy if exists recursos_select_conjunto on public.recursos_comunes;

create policy recursos_select_conjunto
on public.recursos_comunes
for select
to authenticated
using (
  conjunto_id = public.get_user_conjunto_id()
);

create policy recursos_admin_insert
on public.recursos_comunes
for insert
to authenticated
with check (
  public.is_admin()
  and conjunto_id = public.get_user_conjunto_id()
);

create policy recursos_admin_update
on public.recursos_comunes
for update
to authenticated
using (
  public.is_admin()
  and conjunto_id = public.get_user_conjunto_id()
);

create policy recursos_admin_delete
on public.recursos_comunes
for delete
to authenticated
using (
  public.is_admin()
  and conjunto_id = public.get_user_conjunto_id()
);

-- =====================================================
-- RESERVAS_ZONAS
-- =====================================================

drop policy if exists reservas_insert_residente_admin on public.reservas_zonas;
drop policy if exists reservas_select_admin_vigilancia_residente on public.reservas_zonas;
drop policy if exists reservas_update_admin_vigilancia_residente on public.reservas_zonas;

create policy reservas_zonas_select_conjunto
on public.reservas_zonas
for select
to authenticated
using (
  conjunto_id = public.get_user_conjunto_id()
);

create policy reservas_zonas_insert
on public.reservas_zonas
for insert
to authenticated
with check (
  conjunto_id = public.get_user_conjunto_id()
);

create policy reservas_zonas_update
on public.reservas_zonas
for update
to authenticated
using (
  conjunto_id = public.get_user_conjunto_id()
);

create policy reservas_zonas_delete_admin
on public.reservas_zonas
for delete
to authenticated
using (
  public.is_admin()
  and conjunto_id = public.get_user_conjunto_id()
);

-- =====================================================
-- VISITANTES
-- =====================================================

drop policy if exists visitantes_insert_propios on public.visitantes;
drop policy if exists visitantes_select_propios on public.visitantes;
drop policy if exists visitantes_update_propios on public.visitantes;
drop policy if exists visitantes_select_same_conjunto on public.visitantes;

create policy visitantes_select_conjunto
on public.visitantes
for select
to authenticated
using (
  conjunto_id = public.get_user_conjunto_id()
);

create policy visitantes_insert_residente
on public.visitantes
for insert
to authenticated
with check (
  public.is_residente()
  and conjunto_id = public.get_user_conjunto_id()
);

create policy visitantes_update_residente
on public.visitantes
for update
to authenticated
using (
  public.is_residente()
  and conjunto_id = public.get_user_conjunto_id()
);

-- =====================================================
-- RESIDENTES
-- =====================================================

drop policy if exists "admin ve residentes" on public.residentes;
drop policy if exists "residentes multi conjunto" on public.residentes;
drop policy if exists residentes_select_same_conjunto on public.residentes;

create policy residentes_select_conjunto
on public.residentes
for select
to authenticated
using (
  conjunto_id = public.get_user_conjunto_id()
);

-- =====================================================
-- PARQUEADEROS
-- =====================================================

alter table public.parqueaderos enable row level security;

drop policy if exists parqueaderos_select_conjunto on public.parqueaderos;

create policy parqueaderos_select_conjunto
on public.parqueaderos
for select
to authenticated
using (
  conjunto_id = public.get_user_conjunto_id()
);