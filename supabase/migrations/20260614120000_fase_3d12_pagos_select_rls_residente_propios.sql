-- FASE 3D.12: corrige aislamiento RLS de lectura en pagos.
-- Hallazgo P0: la policy legacy "pagos multi conjunto" permitía que cualquier
-- usuario autenticado del mismo conjunto leyera pagos de otros residentes.
-- La lectura de residentes queda limitada estrictamente a su residente_id activo
-- en tenant_memberships o a la relación legacy directa residentes.usuario_id.
-- Roles administrativos conservan lectura por conjunto.

alter table public.pagos enable row level security;

drop policy if exists "pagos multi conjunto" on public.pagos;
drop policy if exists "pagos_select_admin_conjunto" on public.pagos;
drop policy if exists "pagos_select_residente_propios" on public.pagos;

create policy "pagos_select_admin_conjunto"
on public.pagos
for select
to authenticated
using (
  public.fn_is_platform_superadmin()
  or exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = pagos.conjunto_id
      and tm.status = 'active'
      and tm.role_name in ('admin_conjunto', 'contador')
  )
  or exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = 'admin'
      and ua.conjunto_id = pagos.conjunto_id
  )
);

create policy "pagos_select_residente_propios"
on public.pagos
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = pagos.conjunto_id
      and tm.residente_id = pagos.residente_id
      and tm.status = 'active'
      and tm.role_name = 'residente'
  )
  or exists (
    select 1
    from public.residentes r
    where r.usuario_id = auth.uid()
      and r.id = pagos.residente_id
      and r.conjunto_id = pagos.conjunto_id
  )
);
