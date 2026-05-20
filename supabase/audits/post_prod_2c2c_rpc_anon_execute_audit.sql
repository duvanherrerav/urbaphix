-- POST-PROD 2C-2C
-- Auditoría readonly de exposición EXECUTE para funciones/RPC en schema public.
-- Este script usa únicamente SELECTs.

-- 1) Inventario base de funciones en schema public.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS returns,
  l.lanname AS language,
  p.prosecdef AS is_security_definer,
  p.prokind AS prokind,
  p.prorettype::regtype::text AS return_type,
  p.oid::regprocedure::text AS function_signature
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
ORDER BY p.proname, args;

-- 2) Funciones ejecutables por PUBLIC (directo o por herencia).
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.proname AS function_name,
  has_function_privilege('public', p.oid, 'EXECUTE') AS can_public_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND has_function_privilege('public', p.oid, 'EXECUTE')
ORDER BY p.proname;

-- 3) Matriz de permisos por rol de interés (anon, authenticated, service_role).
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.proname AS function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, function_signature;

-- 4) Funciones SECURITY DEFINER.
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.proname AS function_name,
  p.prosecdef AS is_security_definer,
  pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;

-- 5) Funciones sin search_path explícito en configuración local.
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.proname AS function_name,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(coalesce(p.proconfig, '{}'::text[])) AS cfg
    WHERE cfg ILIKE 'search_path=%'
  )
ORDER BY p.proname;

-- 6) Funciones con prefijos objetivo de hardening (fn_*, get_user_*, is_*).
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.proname AS function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE 'fn\_%' ESCAPE '\'
    OR p.proname LIKE 'get_user\_%' ESCAPE '\'
    OR p.proname LIKE 'is\_%' ESCAPE '\'
  )
ORDER BY p.proname;

-- 7) RPC productivas conocidas (visitas/vigilancia).
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.proname AS function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute,
  p.prosecdef AS is_security_definer,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'fn_crear_o_reutilizar_visitante_y_registro',
    'fn_registrar_ingreso_visita',
    'fn_registrar_salida_visita'
  )
ORDER BY p.proname;

-- 8) Funciones tipo trigger/event_trigger.
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.proname AS function_name,
  p.prokind,
  p.prorettype::regtype::text AS return_type,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.prorettype = 'trigger'::regtype
    OR p.prorettype = 'event_trigger'::regtype
  )
ORDER BY p.proname;

-- 9) Matriz compacta función/rol/permiso para reporting.
WITH roles AS (
  SELECT unnest(ARRAY['public', 'anon', 'authenticated', 'service_role']) AS role_name
)
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.proname AS function_name,
  r.role_name,
  has_function_privilege(r.role_name, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN roles r
WHERE n.nspname = 'public'
ORDER BY p.proname, p.oid::regprocedure::text, r.role_name;
