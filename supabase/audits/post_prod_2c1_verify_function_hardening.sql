-- POST-PROD-2C-1 verificación readonly
-- Solo consultas SELECT para validar hardening de funciones/RPC.

-- 1) Funciones del schema public sin search_path explícito en proconfig.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef AS is_security_definer,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
    WHERE cfg LIKE 'search_path=%'
  )
ORDER BY p.proname, identity_args;

-- 2) Funciones SECURITY DEFINER en public.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef AS is_security_definer,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname, identity_args;

-- 3) Funciones ejecutables por anon/authenticated (EXECUTE).
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  r.rolname AS executable_by_role,
  p.prosecdef AS is_security_definer,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.rolname IN ('anon', 'authenticated')
WHERE n.nspname = 'public'
  AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')
ORDER BY p.proname, identity_args, r.rolname;

-- 4) RPC críticas con proconfig y propiedades de seguridad.
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef AS is_security_definer,
  p.provolatile,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'fn_crear_o_reutilizar_visitante_y_registro',
    'fn_registrar_ingreso_visita',
    'fn_registrar_salida_visita',
    'fn_auth_residente_id',
    'fn_auth_conjunto_id',
    'fn_auth_rol',
    'set_updated_at',
    'handle_new_user',
    'get_user_conjunto_id',
    'get_user_residente_id',
    'get_user_role',
    'is_admin',
    'is_residente',
    'is_vigilancia',
    'rls_auto_enable'
  )
ORDER BY p.proname, identity_args;

-- 5) Funciones relacionadas con visitas/auth/roles (búsqueda por nombre).
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef AS is_security_definer,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%visita%'
    OR p.proname ILIKE '%visitante%'
    OR p.proname ILIKE 'fn_auth%'
    OR p.proname ILIKE '%role%'
    OR p.proname ILIKE '%rol%'
  )
ORDER BY p.proname, identity_args;
