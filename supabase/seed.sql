-- =====================================================
-- URBAPHIX SEED DATA
-- Ambiente: DEV
-- =====================================================
-- Roles base oficiales Urbaphix
insert into public.roles (id, nombre)
values ('superadmin', 'Super Administrador'),
  ('admin', 'Administrador'),
  ('residente', 'Residente'),
  ('vigilancia', 'Vigilancia'),
  ('contador', 'Contador'),
  ('auditor', 'Auditor') on conflict (id) do
update
set nombre = excluded.nombre;