-- FASE 3D.10 - Diagnostico pre-seed dataset negativo RLS DEV
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
    '11111111-3d10-4000-8000-000000000001'::uuid AS usuario_same_tenant_id,
    '11111111-3d10-4000-8000-000000000002'::uuid AS usuario_cross_tenant_id,
    'DEV-RLS-NEGATIVE%'::text AS prefijo_like
)
SELECT 'conjunto_principal_dev_existe' AS check_name, EXISTS (
  SELECT 1 FROM public.conjuntos c, constantes k WHERE c.id = k.conjunto_principal_id
) AS ok
UNION ALL
SELECT 'residente_principal_dev_existe', EXISTS (
  SELECT 1 FROM public.residentes r, constantes k WHERE r.id = k.residente_principal_id AND r.conjunto_id = k.conjunto_principal_id
)
UNION ALL
SELECT 'usuario_principal_dev_existe', EXISTS (
  SELECT 1 FROM public.usuarios_app ua, constantes k WHERE ua.id = k.usuario_principal_id AND ua.conjunto_id = k.conjunto_principal_id
)
UNION ALL
SELECT 'auth_user_negativo_mismo_conjunto_existe', EXISTS (
  SELECT 1 FROM auth.users au, constantes k WHERE au.id = k.usuario_same_tenant_id
)
UNION ALL
SELECT 'auth_user_negativo_cross_tenant_existe', EXISTS (
  SELECT 1 FROM auth.users au, constantes k WHERE au.id = k.usuario_cross_tenant_id
)
UNION ALL
SELECT 'tipos_documento_disponibles', EXISTS (
  SELECT 1 FROM public.tipos_documento td WHERE COALESCE(td.activo, true) = true
);

WITH constantes AS (
  SELECT
    'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid AS conjunto_principal_id,
    'DEV-RLS-NEGATIVE%'::text AS prefijo_like
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
WHERE email LIKE 'dev-rls-negative-%@example.invalid' OR nombre LIKE (SELECT prefijo_like FROM constantes)
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
