-- POST-PROD 2C2E (readonly)
-- Verificación de grants EXECUTE y propiedades de seguridad para RPC productivas.

WITH target_signatures AS (
  SELECT unnest(ARRAY[
    'public.fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)',
    'public.fn_registrar_ingreso_visita(text,uuid)',
    'public.fn_registrar_salida_visita(uuid,uuid)'
  ]) AS signature
), resolved AS (
  SELECT
    t.signature AS expected_signature,
    to_regprocedure(t.signature) AS proc_oid
  FROM target_signatures t
)
SELECT
  r.expected_signature,
  r.proc_oid::text AS resolved_signature,
  r.proc_oid IS NOT NULL AS function_exists,
  CASE WHEN r.proc_oid IS NOT NULL THEN has_function_privilege('public', r.proc_oid, 'EXECUTE') END AS public_execute,
  CASE WHEN r.proc_oid IS NOT NULL THEN has_function_privilege('anon', r.proc_oid, 'EXECUTE') END AS anon_execute,
  CASE WHEN r.proc_oid IS NOT NULL THEN has_function_privilege('authenticated', r.proc_oid, 'EXECUTE') END AS authenticated_execute,
  CASE WHEN r.proc_oid IS NOT NULL THEN has_function_privilege('service_role', r.proc_oid, 'EXECUTE') END AS service_role_execute,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config,
  (
    SELECT cfg
    FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
    WHERE cfg LIKE 'search_path=%'
    LIMIT 1
  ) AS search_path_config,
  (r.proc_oid IS NOT NULL AND NOT has_function_privilege('public', r.proc_oid, 'EXECUTE')) AS expected_public_execute_false,
  (r.proc_oid IS NOT NULL AND NOT has_function_privilege('anon', r.proc_oid, 'EXECUTE')) AS expected_anon_execute_false,
  (r.proc_oid IS NOT NULL AND has_function_privilege('authenticated', r.proc_oid, 'EXECUTE')) AS expected_authenticated_execute_true,
  (r.proc_oid IS NOT NULL AND has_function_privilege('service_role', r.proc_oid, 'EXECUTE')) AS expected_service_role_execute_true
FROM resolved r
LEFT JOIN pg_proc p ON p.oid = r.proc_oid
ORDER BY r.expected_signature;
