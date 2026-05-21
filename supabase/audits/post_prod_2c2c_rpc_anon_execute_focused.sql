-- POST-PROD 2C-2C (focused complement)
-- Auditoría readonly enfocada en funciones propias/relevantes de Urbaphix.
-- Solo SELECT. No modifica permisos ni estructura.

WITH urbaphix_function_base AS (
  SELECT
    p.oid,
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS args,
    p.oid::regprocedure::text AS function_signature,
    p.prosecdef AS is_security_definer,
    p.proconfig,
    EXISTS (
      SELECT 1
      FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      WHERE acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) AS public_grant_detected
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (
      p.proname ~ '^fn_'
      OR p.proname ~ '^get_user_'
      OR p.proname ~ '^is_'
      OR p.proname IN (
        'handle_new_user',
        'set_updated_at',
        'rls_auto_enable',
        'fn_crear_o_reutilizar_visitante_y_registro',
        'fn_registrar_ingreso_visita',
        'fn_registrar_salida_visita'
      )
    )
    AND p.proname !~ '^gbt_'
    AND p.proname !~ '^gbtreekey'
    AND p.proname !~ '_dist$'
)
SELECT
  schema_name,
  function_name,
  args,
  function_signature,
  public_grant_detected AS public_execute,
  has_function_privilege('anon', oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', oid, 'EXECUTE') AS service_role_execute,
  is_security_definer,
  proconfig
FROM urbaphix_function_base
ORDER BY function_name, args;
