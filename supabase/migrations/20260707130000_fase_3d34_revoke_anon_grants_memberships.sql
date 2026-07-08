-- FASE 3D.34: hardening DEV-first de grants anon para memberships.
--
-- Objetivo: retirar privilegios heredados del rol anon sobre tablas sensibles
-- de membresías sin modificar authenticated, service_role ni policies RLS.

revoke all privileges on table public.tenant_memberships from anon;
revoke all privileges on table public.platform_memberships from anon;
