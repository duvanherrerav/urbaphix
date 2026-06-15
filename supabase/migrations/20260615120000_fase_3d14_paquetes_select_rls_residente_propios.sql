-- FASE 3D.14: corrige aislamiento RLS de lectura en paquetes.
--
-- Hallazgo P0/R5: la policy legacy "paquetes por conjunto" permitía que un
-- residente autenticado leyera paquetes de otros residentes del mismo conjunto.
-- La lectura de residentes queda limitada estrictamente a sus propios paquetes
-- por tenant_memberships activa o por fallback legacy residentes.usuario_id.
--
-- Roles administrativos conservan lectura por conjunto. Vigilancia/vigilante
-- conserva lectura operativa por conjunto para recepción y entrega de paquetes.

alter table public.paquetes enable row level security;

drop policy if exists "paquetes por conjunto" on public.paquetes;
drop policy if exists "paquetes residente" on public.paquetes;
drop policy if exists paquetes_select_admin_conjunto on public.paquetes;
drop policy if exists paquetes_select_residente_propios on public.paquetes;
drop policy if exists paquetes_select_vigilancia_conjunto on public.paquetes;

create policy paquetes_select_admin_conjunto
on public.paquetes
for select
to authenticated
using (
  public.fn_is_platform_superadmin()
  or exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = paquetes.conjunto_id
      and tm.status = 'active'
      and tm.role_name in ('admin_conjunto', 'contador')
  )
  or exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = 'admin'
      and ua.conjunto_id = paquetes.conjunto_id
  )
);

create policy paquetes_select_residente_propios
on public.paquetes
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = paquetes.conjunto_id
      and tm.residente_id = paquetes.residente_id
      and tm.status = 'active'
      and tm.role_name = 'residente'
  )
  or exists (
    select 1
    from public.residentes r
    where r.usuario_id = auth.uid()
      and r.id = paquetes.residente_id
      and r.conjunto_id = paquetes.conjunto_id
  )
);

create policy paquetes_select_vigilancia_conjunto
on public.paquetes
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = paquetes.conjunto_id
      and tm.status = 'active'
      and tm.role_name in ('vigilancia', 'vigilante')
  )
  or exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.conjunto_id = paquetes.conjunto_id
      and ua.rol_id in ('vigilancia', 'vigilante')
  )
);
