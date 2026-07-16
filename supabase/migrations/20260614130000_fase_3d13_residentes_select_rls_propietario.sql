-- FASE 3D.13: corrige aislamiento RLS de lectura en residentes.
--
-- Hallazgo P0: la policy vigente residentes_select_conjunto permitía que
-- cualquier usuario autenticado del mismo conjunto leyera filas de otros
-- residentes. Para rol residente la lectura debe quedar limitada a su propia
-- fila por tenant_memberships activa o por fallback legacy residentes.usuario_id.
--
-- Vigilancia/vigilante conserva un lookup operativo acotado al mismo conjunto
-- para portería/paquetería; no se restaura lectura amplia para todo usuario
-- del conjunto. Los roles administrativos conservan lectura por conjunto.

alter table public.residentes enable row level security;

drop policy if exists "admin ve residentes" on public.residentes;
drop policy if exists "residentes multi conjunto" on public.residentes;
drop policy if exists residentes_select_same_conjunto on public.residentes;
drop policy if exists residentes_select_conjunto on public.residentes;
drop policy if exists residentes_select_admin_conjunto on public.residentes;
drop policy if exists residentes_select_residente_propio on public.residentes;
drop policy if exists residentes_select_vigilancia_lookup_paquetes on public.residentes;

create policy residentes_select_admin_conjunto
on public.residentes
for select
to authenticated
using (
  public.fn_is_platform_superadmin()
  or exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = residentes.conjunto_id
      and tm.status = 'active'
      and tm.role_name in ('admin_conjunto', 'contador')
  )
  or exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = 'admin'
      and ua.conjunto_id = residentes.conjunto_id
  )
);

create policy residentes_select_residente_propio
on public.residentes
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.residente_id = residentes.id
      and tm.conjunto_id = residentes.conjunto_id
      and tm.status = 'active'
      and tm.role_name = 'residente'
  )
  or residentes.usuario_id = auth.uid()
);


create policy residentes_select_vigilancia_lookup_paquetes
on public.residentes
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = residentes.conjunto_id
      and tm.status = 'active'
      and tm.role_name in ('vigilancia', 'vigilante')
  )
  or exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.conjunto_id = residentes.conjunto_id
      and ua.rol_id in ('vigilancia', 'vigilante')
  )
);
