-- FASE 3D.26
-- Harden RPC anon EXECUTE en funciones SECURITY DEFINER.
--
-- Contexto:
-- Supabase Security Advisors reporto funciones SECURITY DEFINER ejecutables por anon.
-- Las pruebas RPC anon confirmaron ejecucion publica sin explotacion funcional confirmada.
-- Este cambio reduce superficie revocando solo EXECUTE a anon.
--
-- Importante:
-- No se revoca EXECUTE a authenticated para no romper flujos autenticados existentes.

revoke execute on function public.fn_is_platform_superadmin()
from anon;

revoke execute on function public.fn_has_platform_role(text)
from anon;

revoke execute on function public.fn_has_tenant_access(uuid)
from anon;

revoke execute on function public.fn_has_tenant_role(uuid, text)
from anon;

revoke execute on function public.fn_reservas_zonas_ocupacion_disponibilidad(
  uuid,
  uuid,
  timestamp without time zone,
  timestamp without time zone,
  uuid
)
from anon;
