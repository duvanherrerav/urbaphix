-- FASE 3D.15: corrige aislamiento RLS de lectura en reservas_zonas.
--
-- Hallazgo P0/R7: la policy legacy "reservas_zonas_select_conjunto"
-- permitia que un residente autenticado leyera reservas de otros residentes
-- del mismo conjunto. La lectura de residentes queda limitada estrictamente
-- a sus propias reservas por tenant_memberships activa o por fallback legacy
-- residentes.usuario_id.
--
-- Roles administrativos conservan lectura por conjunto. Vigilancia/vigilante
-- conserva lectura operativa por conjunto para check-in/check-out y control
-- de zonas comunes. Superadmin conserva lectura global.
--
-- No se modifican policies de INSERT/UPDATE/DELETE.

alter table public.reservas_zonas enable row level security;

drop policy if exists reservas_select_admin_vigilancia_residente on public.reservas_zonas;
drop policy if exists reservas_zonas_select_conjunto on public.reservas_zonas;
drop policy if exists reservas_zonas_select_admin_conjunto on public.reservas_zonas;
drop policy if exists reservas_zonas_select_residente_propias on public.reservas_zonas;
drop policy if exists reservas_zonas_select_vigilancia_conjunto on public.reservas_zonas;

create policy reservas_zonas_select_admin_conjunto
on public.reservas_zonas
for select
to authenticated
using (
  public.fn_is_platform_superadmin()
  or exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = reservas_zonas.conjunto_id
      and tm.status = 'active'
      and tm.role_name in ('admin_conjunto', 'contador')
  )
  or exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = 'admin'
      and ua.conjunto_id = reservas_zonas.conjunto_id
  )
);

create policy reservas_zonas_select_residente_propias
on public.reservas_zonas
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = reservas_zonas.conjunto_id
      and tm.residente_id = reservas_zonas.residente_id
      and tm.status = 'active'
      and tm.role_name = 'residente'
  )
  or exists (
    select 1
    from public.residentes r
    where r.usuario_id = auth.uid()
      and r.id = reservas_zonas.residente_id
      and r.conjunto_id = reservas_zonas.conjunto_id
  )
);

create policy reservas_zonas_select_vigilancia_conjunto
on public.reservas_zonas
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = reservas_zonas.conjunto_id
      and tm.status = 'active'
      and tm.role_name in ('vigilancia', 'vigilante')
  )
  or exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.conjunto_id = reservas_zonas.conjunto_id
      and ua.rol_id in ('vigilancia', 'vigilante')
  )
);
