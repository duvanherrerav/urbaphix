-- FASE 3D.36: Hardening DEV-first de grants anon para visitas.
-- Retira privilegios heredados del rol anon sobre tablas de visitantes
-- sin modificar authenticated, service_role ni policies RLS existentes.

revoke all privileges on table public.visitantes from anon;
revoke all privileges on table public.registro_visitas from anon;
