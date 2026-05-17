SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  pg_catalog.obj_description(c.oid, 'pg_class') AS table_comment
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

SELECT
  schemaname AS schema_name,
  tablename AS table_name,
  policyname AS policy_name,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  r.rolname AS role_name,
  pg_catalog.has_table_privilege(r.oid, c.oid, 'SELECT') AS can_select
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_roles r ON r.rolname IN ('anon', 'authenticated')
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v', 'm')
ORDER BY c.relname, r.rolname;

SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  COUNT(p.polname) AS policy_count
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
GROUP BY n.nspname, c.relname, c.relrowsecurity
HAVING COUNT(p.polname) = 0
ORDER BY c.relname;

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
  l.lanname AS language_name,
  p.prosecdef AS security_definer,
  p.provolatile AS volatility,
  p.proconfig AS function_config
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname, arguments;

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
  r.rolname AS executable_by
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_roles r ON r.rolname IN ('anon', 'authenticated')
WHERE n.nspname = 'public'
  AND pg_catalog.has_function_privilege(r.oid, p.oid, 'EXECUTE')
ORDER BY p.proname, arguments, executable_by;

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(setting)
    WHERE cfg.setting LIKE 'search_path=%'
  )
ORDER BY p.proname, arguments;

SELECT
  n.nspname AS schema_name,
  p.proname AS rpc_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_catalog.pg_get_function_result(p.oid) AS result_type,
  p.prosecdef AS security_definer,
  p.provolatile AS volatility,
  p.proconfig AS function_config
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, arguments;

SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  'anon' AS role_name,
  pg_catalog.has_table_privilege('anon', c.oid, 'SELECT') AS can_select
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v', 'm')
  AND pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')
ORDER BY c.relname;

SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  'authenticated' AS role_name,
  pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT') AS can_select
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v', 'm')
  AND pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT')
ORDER BY c.relname;

SELECT
  e.extname AS extension_name,
  n.nspname AS schema_name,
  e.extversion AS extension_version
FROM pg_catalog.pg_extension e
JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
WHERE n.nspname = 'public'
ORDER BY e.extname;

SELECT
  event_object_schema AS table_schema,
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND (
    action_statement ILIKE '%set_%'
    OR action_statement ILIKE '%audit%'
    OR trigger_name ILIKE '%audit%'
  )
ORDER BY event_object_table, trigger_name, event_manipulation;
