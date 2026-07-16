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


create or replace function public.fn_reservas_zonas_ocupacion_disponibilidad(
  p_conjunto_id uuid,
  p_recurso_id uuid,
  p_fecha_inicio timestamp without time zone,
  p_fecha_fin timestamp without time zone,
  p_reserva_id_excluir uuid default null
)
returns table (
  recurso_id uuid,
  fecha_inicio timestamp without time zone,
  fecha_fin timestamp without time zone,
  estado text,
  ocupado boolean,
  bloqueo boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    rz.recurso_id,
    rz.fecha_inicio,
    rz.fecha_fin,
    rz.estado,
    true as ocupado,
    false as bloqueo
  from public.reservas_zonas rz
  where rz.conjunto_id = p_conjunto_id
    and rz.recurso_id = p_recurso_id
    and rz.estado in ('solicitada', 'aprobada', 'en_curso')
    and rz.fecha_inicio < p_fecha_fin
    and rz.fecha_fin > p_fecha_inicio
    and (p_reserva_id_excluir is null or rz.id <> p_reserva_id_excluir)
    and (
      public.fn_is_platform_superadmin()
      or exists (
        select 1
        from public.tenant_memberships tm
        where tm.user_id = auth.uid()
          and tm.conjunto_id = rz.conjunto_id
          and tm.status = 'active'
          and tm.role_name in ('admin_conjunto', 'contador', 'residente', 'vigilancia', 'vigilante')
      )
      or exists (
        select 1
        from public.usuarios_app ua
        where ua.id = auth.uid()
          and ua.conjunto_id = rz.conjunto_id
          and ua.rol_id in ('admin', 'residente', 'vigilancia', 'vigilante')
      )
      or exists (
        select 1
        from public.residentes r
        where r.usuario_id = auth.uid()
          and r.conjunto_id = rz.conjunto_id
      )
    );
$$;

revoke all on function public.fn_reservas_zonas_ocupacion_disponibilidad(
  uuid,
  uuid,
  timestamp without time zone,
  timestamp without time zone,
  uuid
) from public;

grant execute on function public.fn_reservas_zonas_ocupacion_disponibilidad(
  uuid,
  uuid,
  timestamp without time zone,
  timestamp without time zone,
  uuid
) to authenticated, service_role;


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
