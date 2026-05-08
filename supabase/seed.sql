-- =====================================================
-- URBAPHIX SEED DATA
-- Ambiente: DEV
-- =====================================================

-- Roles base
insert into public.roles (id, nombre)
values
  ('superadmin', 'Super Administrador'),
  ('admin', 'Administrador'),
  ('residente', 'Residente'),
  ('vigilante', 'Vigilancia')
on conflict (id) do nothing;