-- Readonly verification: POST-PROD 2C-2B-A
-- Solo SELECT: verifica EXECUTE por PUBLIC, anon, authenticated, service_role

SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  has_function_privilege('PUBLIC', p.oid, 'EXECUTE') AS public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'fn_auth_conjunto_id',
    'fn_auth_residente_id',
    'fn_auth_rol',
    'get_user_conjunto_id',
    'get_user_residente_id',
    'get_user_role',
    'is_admin',
    'is_residente',
    'is_vigilancia'
  )
ORDER BY p.proname, args;

SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  has_function_privilege('PUBLIC', p.oid, 'EXECUTE') AS public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'fn_crear_o_reutilizar_visitante_y_registro',
    'fn_registrar_ingreso_visita',
    'fn_registrar_salida_visita'
  )
ORDER BY p.proname, args;

SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  CASE WHEN has_function_privilege('PUBLIC', p.oid, 'EXECUTE') THEN 'WARN_PUBLIC_STILL_HAS_EXECUTE' ELSE 'OK_PUBLIC_REVOKED' END AS public_status,
  CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'WARN_ANON_STILL_HAS_EXECUTE' ELSE 'OK_ANON_REVOKED' END AS anon_status,
  CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'OK_AUTHENTICATED_HAS_EXECUTE' ELSE 'WARN_AUTHENTICATED_MISSING_EXECUTE' END AS authenticated_status,
  CASE WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'OK_SERVICE_ROLE_HAS_EXECUTE' ELSE 'WARN_SERVICE_ROLE_MISSING_EXECUTE' END AS service_role_status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'fn_auth_conjunto_id',
    'fn_auth_residente_id',
    'fn_auth_rol',
    'get_user_conjunto_id',
    'get_user_residente_id',
    'get_user_role',
    'is_admin',
    'is_residente',
    'is_vigilancia'
  )
ORDER BY p.proname, args;
