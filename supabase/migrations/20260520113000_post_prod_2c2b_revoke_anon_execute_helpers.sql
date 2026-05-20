-- POST-PROD 2C-2B-A
-- Objetivo: reducir superficie pública revocando EXECUTE solo para anon
-- Alcance: helpers RLS/auth modernos y helpers legacy
-- Fuera de alcance: RPC productivas de visitas/vigilancia y roles authenticated/service_role

REVOKE EXECUTE ON FUNCTION public.fn_auth_conjunto_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_auth_residente_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_auth_rol() FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_user_conjunto_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_residente_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_residente() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_vigilancia() FROM anon;
