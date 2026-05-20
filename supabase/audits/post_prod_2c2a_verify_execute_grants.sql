-- POST-PROD 2C-2A readonly verification
-- Solo SELECT: auditoría de EXECUTE sobre funciones sensibles.

-- 1) Matriz base: funciones críticas y privilegios efectivos por rol.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef AS is_security_definer,
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
    'fn_crear_o_reutilizar_visitante_y_registro',
    'fn_registrar_ingreso_visita',
    'fn_registrar_salida_visita',
    'get_user_conjunto_id',
    'get_user_residente_id',
    'get_user_role',
    'handle_new_user',
    'is_admin',
    'is_residente',
    'is_vigilancia',
    'rls_auto_enable',
    'set_updated_at'
  )
ORDER BY p.proname, identity_args;

-- 2) SECURITY DEFINER aún ejecutables por anon/authenticated.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND (
    has_function_privilege('anon', p.oid, 'EXECUTE')
    OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
ORDER BY p.proname, identity_args;

-- 3) Funciones trigger/event-trigger expuestas a anon/authenticated.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  t.typname AS return_type,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_type t ON t.oid = p.prorettype
WHERE n.nspname = 'public'
  AND t.typname IN ('trigger', 'event_trigger')
  AND (
    has_function_privilege('anon', p.oid, 'EXECUTE')
    OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
ORDER BY p.proname, identity_args;

-- 4) Comparativo de pendientes vs objetivo de esta fase.
SELECT
  p.proname AS function_name,
  CASE
    WHEN p.proname IN ('fn_crear_o_reutilizar_visitante_y_registro', 'fn_registrar_ingreso_visita', 'fn_registrar_salida_visita') THEN 'rpc_productiva'
    WHEN p.proname IN ('fn_auth_conjunto_id', 'fn_auth_residente_id', 'fn_auth_rol') THEN 'helper_rls'
    WHEN p.proname IN ('rls_auto_enable', 'set_updated_at', 'handle_new_user') THEN 'trigger_internal'
    WHEN p.proname IN ('get_user_conjunto_id', 'get_user_residente_id', 'get_user_role', 'is_admin', 'is_residente', 'is_vigilancia') THEN 'legacy_helper'
    ELSE 'otro'
  END AS function_class,
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
    'fn_crear_o_reutilizar_visitante_y_registro',
    'fn_registrar_ingreso_visita',
    'fn_registrar_salida_visita',
    'get_user_conjunto_id',
    'get_user_residente_id',
    'get_user_role',
    'handle_new_user',
    'is_admin',
    'is_residente',
    'is_vigilancia',
    'rls_auto_enable',
    'set_updated_at'
  )
ORDER BY function_class, function_name;
