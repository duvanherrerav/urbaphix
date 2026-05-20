-- POST-PROD 2C-2A
-- Reducción quirúrgica de EXECUTE solo para funciones internas/trigger-only.
-- Sin cambios en RPC productivas, RLS, tablas ni policies.

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
