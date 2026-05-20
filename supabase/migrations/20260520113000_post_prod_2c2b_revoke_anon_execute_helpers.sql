-- POST-PROD 2C-2B-A
-- Objetivo: bloquear ejecución anónima (PUBLIC/anon) preservando ejecución autenticada.
-- Drift-safe: tolera diferencias entre DEV/QA/PRD cuando una función no existe.
-- Fuera de alcance: RPC productivas de visitas/vigilancia.

DO $$
BEGIN
  IF to_regprocedure('public.fn_auth_conjunto_id()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.fn_auth_conjunto_id() TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.fn_auth_conjunto_id() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.fn_auth_conjunto_id() FROM anon;
    GRANT EXECUTE ON FUNCTION public.fn_auth_conjunto_id() TO authenticated, service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.fn_auth_residente_id()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.fn_auth_residente_id() TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.fn_auth_residente_id() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.fn_auth_residente_id() FROM anon;
    GRANT EXECUTE ON FUNCTION public.fn_auth_residente_id() TO authenticated, service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.fn_auth_rol()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.fn_auth_rol() TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.fn_auth_rol() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.fn_auth_rol() FROM anon;
    GRANT EXECUTE ON FUNCTION public.fn_auth_rol() TO authenticated, service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.get_user_conjunto_id()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_user_conjunto_id() TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.get_user_conjunto_id() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.get_user_conjunto_id() FROM anon;
    GRANT EXECUTE ON FUNCTION public.get_user_conjunto_id() TO authenticated, service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.get_user_residente_id()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_user_residente_id() TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.get_user_residente_id() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.get_user_residente_id() FROM anon;
    GRANT EXECUTE ON FUNCTION public.get_user_residente_id() TO authenticated, service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.get_user_role()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon;
    GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
    GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.is_residente()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.is_residente() TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.is_residente() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.is_residente() FROM anon;
    GRANT EXECUTE ON FUNCTION public.is_residente() TO authenticated, service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.is_vigilancia()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.is_vigilancia() TO authenticated, service_role;
    REVOKE EXECUTE ON FUNCTION public.is_vigilancia() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.is_vigilancia() FROM anon;
    GRANT EXECUTE ON FUNCTION public.is_vigilancia() TO authenticated, service_role;
  END IF;
END $$;
