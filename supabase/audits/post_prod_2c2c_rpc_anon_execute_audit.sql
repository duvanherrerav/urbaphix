-- POST-PROD 2C-2C
-- Auditoría readonly de exposición EXECUTE para funciones/RPC en schema public.
-- Este script usa únicamente SELECTs.
-- Nota: PUBLIC se audita por ACL/default privileges (proacl + aclexplode),
-- sin evaluar PUBLIC como usuario real.

-- CTE base reutilizable: inventario de funciones + señal de EXECUTE para PUBLIC.
WITH function_base AS (
  SELECT
    p.oid,
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS args,
    pg_get_function_result(p.oid) AS returns,
    l.lanname AS language,
    p.prosecdef AS is_security_definer,
    p.prokind,
    p.prorettype::regtype::text AS return_type,
    p.oid::regprocedure::text AS function_signature,
    p.proconfig,
    p.proacl,
    EXISTS (
      SELECT 1
      FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      WHERE acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) AS public_grant_detected
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
)

-- 1) Inventario base de funciones en schema public.
SELECT
  schema_name,
  function_name,
  args,
  returns,
  language,
  is_security_definer,
  prokind,
  return_type,
  function_signature,
  public_grant_detected
FROM function_base
ORDER BY function_name, args;

-- 2) Funciones con EXECUTE para PUBLIC detectado por ACL/default privileges.
WITH function_base AS (
  SELECT
    p.oid,
    p.proname AS function_name,
    p.oid::regprocedure::text AS function_signature,
    EXISTS (
      SELECT 1
      FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      WHERE acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) AS public_grant_detected
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT
  function_signature,
  function_name,
  public_grant_detected
FROM function_base
WHERE public_grant_detected
ORDER BY function_name;

-- 3) Matriz de permisos por rol de interés (anon, authenticated, service_role).
-- public_execute se reporta vía public_grant_detected (ACL/default privileges).
WITH function_base AS (
  SELECT
    p.oid,
    p.proname AS function_name,
    p.oid::regprocedure::text AS function_signature,
    EXISTS (
      SELECT 1
      FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      WHERE acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) AS public_grant_detected
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT
  function_signature,
  function_name,
  public_grant_detected AS public_execute,
  has_function_privilege('anon', oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', oid, 'EXECUTE') AS service_role_execute
FROM function_base
ORDER BY function_name, function_signature;

-- 4) Funciones SECURITY DEFINER.
WITH function_base AS (
  SELECT
    p.oid,
    p.proname AS function_name,
    p.oid::regprocedure::text AS function_signature,
    p.prosecdef AS is_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT
  function_signature,
  function_name,
  is_security_definer,
  pg_get_userbyid(p.proowner) AS owner
FROM function_base fb
JOIN pg_proc p ON p.oid = fb.oid
WHERE is_security_definer = true
ORDER BY function_name;

-- 5) Funciones sin search_path explícito en configuración local.
WITH function_base AS (
  SELECT
    p.oid::regprocedure::text AS function_signature,
    p.proname AS function_name,
    p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT
  function_signature,
  function_name,
  proconfig
FROM function_base
WHERE NOT EXISTS (
  SELECT 1
  FROM unnest(coalesce(proconfig, '{}'::text[])) AS cfg
  WHERE cfg ILIKE 'search_path=%'
)
ORDER BY function_name;

-- 6) Funciones con prefijos objetivo de hardening (fn_*, get_user_*, is_*).
WITH function_base AS (
  SELECT
    p.oid,
    p.proname AS function_name,
    p.oid::regprocedure::text AS function_signature,
    EXISTS (
      SELECT 1
      FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      WHERE acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) AS public_grant_detected
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT
  function_signature,
  function_name,
  public_grant_detected AS public_execute,
  has_function_privilege('anon', oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', oid, 'EXECUTE') AS service_role_execute
FROM function_base
WHERE (
  function_name LIKE 'fn\_%' ESCAPE '\'
  OR function_name LIKE 'get_user\_%' ESCAPE '\'
  OR function_name LIKE 'is\_%' ESCAPE '\'
)
ORDER BY function_name;

-- 7) RPC productivas conocidas (visitas/vigilancia).
WITH function_base AS (
  SELECT
    p.oid,
    p.proname AS function_name,
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
)
SELECT
  function_signature,
  function_name,
  public_grant_detected AS public_execute,
  has_function_privilege('anon', oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', oid, 'EXECUTE') AS service_role_execute,
  is_security_definer,
  proconfig
FROM function_base
WHERE function_name IN (
  'fn_crear_o_reutilizar_visitante_y_registro',
  'fn_registrar_ingreso_visita',
  'fn_registrar_salida_visita'
)
ORDER BY function_name;

-- 8) Funciones tipo trigger/event_trigger.
WITH function_base AS (
  SELECT
    p.oid,
    p.proname AS function_name,
    p.prokind,
    p.prorettype::regtype::text AS return_type,
    p.oid::regprocedure::text AS function_signature,
    EXISTS (
      SELECT 1
      FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      WHERE acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) AS public_grant_detected
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT
  function_signature,
  function_name,
  prokind,
  return_type,
  public_grant_detected AS public_execute,
  has_function_privilege('anon', oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', oid, 'EXECUTE') AS service_role_execute
FROM function_base
WHERE (
  return_type = 'trigger'
  OR return_type = 'event_trigger'
)
ORDER BY function_name;

-- 9) Matriz compacta función/rol/permiso para reporting.
-- Incluye PUBLIC por ACL/default privileges y roles reales por has_function_privilege.
WITH function_base AS (
  SELECT
    p.oid,
    p.proname AS function_name,
    p.oid::regprocedure::text AS function_signature,
    EXISTS (
      SELECT 1
      FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      WHERE acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) AS public_grant_detected
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
), role_matrix AS (
  SELECT
    oid,
    function_signature,
    function_name,
    'public'::text AS role_name,
    public_grant_detected AS can_execute
  FROM function_base

  UNION ALL

  SELECT
    oid,
    function_signature,
    function_name,
    'anon'::text AS role_name,
    has_function_privilege('anon', oid, 'EXECUTE') AS can_execute
  FROM function_base

  UNION ALL

  SELECT
    oid,
    function_signature,
    function_name,
    'authenticated'::text AS role_name,
    has_function_privilege('authenticated', oid, 'EXECUTE') AS can_execute
  FROM function_base

  UNION ALL

  SELECT
    oid,
    function_signature,
    function_name,
    'service_role'::text AS role_name,
    has_function_privilege('service_role', oid, 'EXECUTE') AS can_execute
  FROM function_base
)
SELECT
  function_signature,
  function_name,
  role_name,
  can_execute
FROM role_matrix
ORDER BY function_name, function_signature, role_name;
