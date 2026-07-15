-- FASE 3D.10A - Diagnostico pre-seed dataset negativo RLS DEV
-- READ ONLY
-- DEV ONLY
-- NO EJECUTAR EN QA
-- NO EJECUTAR EN PRD
-- NO EJECUTAR SIN AUTORIZACION HUMANA
-- Project ref DEV esperado: polstaxmencetxgctvsw

WITH constantes AS (
  SELECT
    'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid AS conjunto_principal_id,
    '546c423c-1fa0-4750-b01c-0c24ad89b801'::uuid AS residente_principal_id,
    'b46ab33c-9237-4f43-a010-ff95ca1263a6'::uuid AS usuario_principal_id,
    'DEV-RLS-NEGATIVE%'::text AS prefijo_like
)
SELECT 'conjunto_principal_dev_existe' AS check_name, EXISTS (
  SELECT 1 FROM public.conjuntos c, constantes k WHERE c.id = k.conjunto_principal_id
) AS ok, 'Debe existir el conjunto principal DEV esperado antes del seed.' AS detalle
UNION ALL
SELECT 'residente_principal_dev_existe', EXISTS (
  SELECT 1 FROM public.residentes r, constantes k WHERE r.id = k.residente_principal_id AND r.conjunto_id = k.conjunto_principal_id
), 'Debe existir el residente principal DEV esperado antes del seed.'
UNION ALL
SELECT 'usuario_principal_dev_existe', EXISTS (
  SELECT 1 FROM public.usuarios_app ua, constantes k WHERE ua.id = k.usuario_principal_id AND ua.conjunto_id = k.conjunto_principal_id
), 'Debe existir el usuario principal DEV esperado antes del seed.'
UNION ALL
SELECT 'tipos_documento_disponibles_o_seed_dev_only', true,
       CASE
         WHEN EXISTS (SELECT 1 FROM public.tipos_documento td WHERE COALESCE(td.activo, true) = true)
           THEN 'GO: existe al menos un tipo_documento activo; el seed lo reutilizara.'
         WHEN EXISTS (SELECT 1 FROM public.tipos_documento td WHERE td.codigo = 'DEV-RLS-NEGATIVE-DOC')
           THEN 'GO: existe el tipo_documento DEV-RLS-NEGATIVE-DOC; el seed lo activara/reutilizara.'
         ELSE 'GO condicionado: no hay tipo_documento activo; el seed DEV-only creara DEV-RLS-NEGATIVE-DOC y el rollback lo limpiara si no queda referenciado.'
       END;

WITH auth_requeridos AS (
  SELECT 'same_tenant'::text AS caso, 'dev-rls-negative-same@urbaphix.com'::text AS email
  UNION ALL
  SELECT 'cross_tenant', 'dev-rls-negative-cross@urbaphix.com'
)
SELECT
  ar.caso,
  ar.email,
  au.id AS auth_user_id_real,
  au.email_confirmed_at,
  (au.email_confirmed_at IS NOT NULL) AS email_confirmado,
  CASE
    WHEN au.id IS NULL THEN 'PENDIENTE_CREAR_AUTH_USER_EN_DASHBOARD_DEV'
    WHEN au.email_confirmed_at IS NULL THEN 'PENDIENTE_AUTOCONFIRMAR_AUTH_USER_EN_DASHBOARD_DEV'
    ELSE 'GO_COPIAR_UUID_REAL_EN_TEMPLATE_SEED_Y_ROLLBACK'
  END AS estado_prerequisito
FROM auth_requeridos ar
LEFT JOIN auth.users au ON lower(au.email) = lower(ar.email)
ORDER BY ar.email;

WITH constantes AS (
  SELECT 'DEV-RLS-NEGATIVE%'::text AS prefijo_like
)
SELECT 'conjuntos_prefijo' AS objeto, count(*) AS total
FROM public.conjuntos
WHERE nombre LIKE (SELECT prefijo_like FROM constantes)
UNION ALL
SELECT 'torres_prefijo', count(*)
FROM public.torres
WHERE nombre LIKE (SELECT prefijo_like FROM constantes)
UNION ALL
SELECT 'apartamentos_prefijo', count(*)
FROM public.apartamentos
WHERE numero LIKE (SELECT prefijo_like FROM constantes)
UNION ALL
SELECT 'usuarios_app_prefijo', count(*)
FROM public.usuarios_app
WHERE email IN ('dev-rls-negative-same@urbaphix.com', 'dev-rls-negative-cross@urbaphix.com') OR nombre LIKE (SELECT prefijo_like FROM constantes)
UNION ALL
SELECT 'tenant_memberships_prefijo', count(*)
FROM public.tenant_memberships
WHERE source_legacy = 'fase_3d10_negative_rls'
UNION ALL
SELECT 'tipos_documento_prefijo', count(*)
FROM public.tipos_documento
WHERE codigo = 'DEV-RLS-NEGATIVE-DOC' OR nombre LIKE (SELECT prefijo_like FROM constantes)
UNION ALL
SELECT 'pagos_prefijo', count(*)
FROM public.pagos
WHERE concepto LIKE (SELECT prefijo_like FROM constantes)
UNION ALL
SELECT 'paquetes_prefijo', count(*)
FROM public.paquetes
WHERE descripcion LIKE (SELECT prefijo_like FROM constantes)
UNION ALL
SELECT 'visitantes_prefijo', count(*)
FROM public.visitantes
WHERE nombre LIKE (SELECT prefijo_like FROM constantes) OR documento LIKE 'DEV3D10%'
UNION ALL
SELECT 'registro_visitas_prefijo', count(*)
FROM public.registro_visitas
WHERE qr_code LIKE (SELECT prefijo_like FROM constantes) OR notas LIKE (SELECT prefijo_like FROM constantes)
UNION ALL
SELECT 'incidentes_prefijo', count(*)
FROM public.incidentes
WHERE descripcion LIKE (SELECT prefijo_like FROM constantes)
UNION ALL
SELECT 'recursos_comunes_prefijo', count(*)
FROM public.recursos_comunes
WHERE nombre LIKE (SELECT prefijo_like FROM constantes)
UNION ALL
SELECT 'reservas_zonas_prefijo', count(*)
FROM public.reservas_zonas
WHERE motivo LIKE (SELECT prefijo_like FROM constantes) OR observaciones LIKE (SELECT prefijo_like FROM constantes)
UNION ALL
SELECT 'config_pagos_prefijo', count(*)
FROM public.config_pagos
WHERE tipo LIKE (SELECT prefijo_like FROM constantes) OR instrucciones LIKE (SELECT prefijo_like FROM constantes);
