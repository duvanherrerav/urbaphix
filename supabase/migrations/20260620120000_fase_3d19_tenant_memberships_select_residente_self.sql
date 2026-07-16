-- FASE 3D.19: hardening SELECT en tenant_memberships para minimizar exposición lateral.
--
-- Hallazgo: la policy anterior permitía a cualquier miembro activo del tenant
-- leer todos los memberships del mismo conjunto vía fn_has_tenant_access(conjunto_id).
-- Cambio: residentes y vigilancia/vigilante quedan acotados a self-read activo;
-- roles administrativos/contables conservan lectura del conjunto por necesidad operativa.

alter table public.tenant_memberships enable row level security;

drop policy if exists tenant_memberships_select on public.tenant_memberships;
create policy tenant_memberships_select
on public.tenant_memberships
for select
to authenticated
using (
  public.fn_is_platform_superadmin()
  or public.fn_has_platform_role('platform_ops')
  or public.fn_has_tenant_role(conjunto_id, 'admin_conjunto')
  or public.fn_has_tenant_role(conjunto_id, 'contador')
  or (
    user_id = auth.uid()
    and status = 'active'
    and role_name = 'residente'
  )
  or (
    user_id = auth.uid()
    and status = 'active'
    and role_name in ('vigilancia', 'vigilante')
  )
);
