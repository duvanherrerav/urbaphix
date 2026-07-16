-- FASE 3D.16: endurece RLS SELECT en visitantes y registro_visitas.
--
-- Hallazgo P0: las policies legacy basadas solo en conjunto_id permitian
-- lectura lateral entre residentes del mismo conjunto. Esta migracion elimina
-- las policies SELECT genericas de conjunto y separa lectura por rol:
-- administracion/contador/superadmin por conjunto, residente propietario
-- estricto y vigilancia operativa por conjunto.
--
-- No se modifican policies de INSERT/UPDATE/DELETE existentes.

alter table public.visitantes enable row level security;
alter table public.registro_visitas enable row level security;

-- VISITANTES: eliminar SELECT legacy/genericos antes de recrear policies separadas.
drop policy if exists visitantes_select_conjunto on public.visitantes;
drop policy if exists visitantes_select_same_conjunto on public.visitantes;
drop policy if exists visitantes_select_propios on public.visitantes;
drop policy if exists visitantes_select_admin_conjunto on public.visitantes;
drop policy if exists visitantes_select_residente_propios on public.visitantes;
drop policy if exists visitantes_select_vigilancia_conjunto on public.visitantes;

create policy visitantes_select_admin_conjunto
on public.visitantes
for select
to authenticated
using (
  public.fn_is_platform_superadmin()
  or exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = visitantes.conjunto_id
      and tm.status = 'active'
      and tm.role_name in ('admin_conjunto', 'contador')
  )
  or exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.conjunto_id = visitantes.conjunto_id
      and ua.rol_id = 'admin'
  )
);

create policy visitantes_select_residente_propios
on public.visitantes
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = visitantes.conjunto_id
      and tm.residente_id = visitantes.residente_id
      and tm.status = 'active'
      and tm.role_name = 'residente'
  )
  or exists (
    select 1
    from public.residentes r
    where r.usuario_id = auth.uid()
      and r.id = visitantes.residente_id
      and r.conjunto_id = visitantes.conjunto_id
  )
);

create policy visitantes_select_vigilancia_conjunto
on public.visitantes
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = visitantes.conjunto_id
      and tm.status = 'active'
      and tm.role_name in ('vigilancia', 'vigilante')
  )
  or exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.conjunto_id = visitantes.conjunto_id
      and ua.rol_id in ('vigilancia', 'vigilante')
  )
);

-- REGISTRO_VISITAS: eliminar SELECT legacy/genericos antes de recrear policies separadas.
drop policy if exists registro_visitas_select_same_conjunto on public.registro_visitas;
drop policy if exists registro_visitas_select_propios on public.registro_visitas;
drop policy if exists registro_visitas_select_admin_conjunto on public.registro_visitas;
drop policy if exists registro_visitas_select_residente_propios on public.registro_visitas;
drop policy if exists registro_visitas_select_vigilancia_conjunto on public.registro_visitas;

create policy registro_visitas_select_admin_conjunto
on public.registro_visitas
for select
to authenticated
using (
  public.fn_is_platform_superadmin()
  or exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = registro_visitas.conjunto_id
      and tm.status = 'active'
      and tm.role_name in ('admin_conjunto', 'contador')
  )
  or exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.conjunto_id = registro_visitas.conjunto_id
      and ua.rol_id = 'admin'
  )
);

create policy registro_visitas_select_residente_propios
on public.registro_visitas
for select
to authenticated
using (
  exists (
    select 1
    from public.visitantes v
    join public.tenant_memberships tm
      on tm.residente_id = v.residente_id
     and tm.conjunto_id = v.conjunto_id
    where v.id = registro_visitas.visitante_id
      and v.conjunto_id = registro_visitas.conjunto_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and tm.role_name = 'residente'
  )
  or exists (
    select 1
    from public.visitantes v
    join public.residentes r
      on r.id = v.residente_id
     and r.conjunto_id = v.conjunto_id
    where v.id = registro_visitas.visitante_id
      and v.conjunto_id = registro_visitas.conjunto_id
      and r.usuario_id = auth.uid()
  )
);

create policy registro_visitas_select_vigilancia_conjunto
on public.registro_visitas
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = auth.uid()
      and tm.conjunto_id = registro_visitas.conjunto_id
      and tm.status = 'active'
      and tm.role_name in ('vigilancia', 'vigilante')
  )
  or exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.conjunto_id = registro_visitas.conjunto_id
      and ua.rol_id in ('vigilancia', 'vigilante')
  )
);
