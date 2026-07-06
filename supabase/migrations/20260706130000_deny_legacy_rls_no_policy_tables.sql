-- FASE 3D.28
-- Hygiene de tablas legacy con RLS activo y sin policies.
--
-- Objetivo:
-- - Quitar el warning RLS Enabled No Policy sin habilitar acceso funcional.
-- - Mantener estas tablas cerradas hasta confirmar uso real en el modelo Superadmin/Multi-tenant.
-- - No crear permisos nuevos ni tocar flujos activos.
--
-- Tablas:
-- - public.operational_events
-- - public.trasteos
-- - public.vehiculos

create policy "deny_all_operational_events"
on public.operational_events
as restrictive
for all
to public
using (false)
with check (false);

create policy "deny_all_trasteos"
on public.trasteos
as restrictive
for all
to public
using (false)
with check (false);

create policy "deny_all_vehiculos"
on public.vehiculos
as restrictive
for all
to public
using (false)
with check (false);
