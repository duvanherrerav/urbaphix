-- POST-PROD 2C-2B-A
-- Objetivo: reducir superficie pública revocando EXECUTE heredado por PUBLIC
-- y explícito de anon en helpers RLS/auth modernos y legacy.
-- Drift-safe: tolera diferencias entre DEV/QA/PRD cuando una función no existe.
-- Fuera de alcance: RPC productivas de visitas/vigilancia y roles authenticated/service_role.

DO $$
BEGIN
  IF to_regprocedure('public.fn_auth_conjunto_id()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fn_auth_conjunto_id() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.fn_auth_conjunto_id() FROM anon;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.fn_auth_residente_id()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fn_auth_residente_id() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.fn_auth_residente_id() FROM anon;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.fn_auth_rol()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fn_auth_rol() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.fn_auth_rol() FROM anon;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.get_user_conjunto_id()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.get_user_conjunto_id() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.get_user_conjunto_id() FROM anon;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.get_user_residente_id()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.get_user_residente_id() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.get_user_residente_id() FROM anon;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.get_user_role()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.is_residente()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.is_residente() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.is_residente() FROM anon;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.is_vigilancia()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.is_vigilancia() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.is_vigilancia() FROM anon;
  END IF;
END $$;
