-- FASE 3D.32 — Hardening controlado de grants anon expuestos vía GraphQL/PostgREST.
--
-- Alcance DEV-first:
-- - Solo revoca privilegios heredados del rol anon sobre public.archivos y public.usuarios_app.
-- - No modifica grants de authenticated ni service_role.
-- - No modifica policies RLS para evitar regresiones funcionales en esta fase.
--
-- Justificación:
-- - El frontend no requiere acceso anon directo a estas tablas; login/bootstrap y membershipResolver
--   consultan usuarios_app después de autenticación, por lo que operan con rol authenticated.
-- - No se encontró consumo frontend directo de public.archivos.
-- - REVOKE es seguro/idempotente: si el privilegio no existe, PostgreSQL no falla.

revoke all privileges on table public.archivos from anon;
revoke all privileges on table public.usuarios_app from anon;
