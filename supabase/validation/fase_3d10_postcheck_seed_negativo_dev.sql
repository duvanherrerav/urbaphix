-- FASE 3D.10 - Post-check seed dataset negativo RLS DEV
-- READ ONLY
-- DEV ONLY
-- NO EJECUTAR EN QA
-- NO EJECUTAR EN PRD
-- NO EJECUTAR SIN AUTORIZACION HUMANA
-- Project ref DEV esperado: polstaxmencetxgctvsw

WITH k AS (
  SELECT
    'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid AS conjunto_principal_id,
    '546c423c-1fa0-4750-b01c-0c24ad89b801'::uuid AS residente_principal_id,
    '11111111-3d10-4000-8000-000000000010'::uuid AS conjunto_ajeno_id,
    '11111111-3d10-4000-8000-000000000013'::uuid AS residente_same_id,
    '11111111-3d10-4000-8000-000000000023'::uuid AS residente_cross_id,
    'DEV-RLS-NEGATIVE%'::text AS prefijo_like
)
SELECT check_name, ok, detalle
FROM (
  SELECT '01_conjunto_principal_dev_existe' AS check_name,
         EXISTS (SELECT 1 FROM public.conjuntos c, k WHERE c.id = k.conjunto_principal_id) AS ok,
         'Debe existir el conjunto principal DEV autorizado' AS detalle
  UNION ALL
  SELECT '02_conjunto_ajeno_dev_prueba_existe',
         EXISTS (SELECT 1 FROM public.conjuntos c, k WHERE c.id = k.conjunto_ajeno_id AND c.nombre = 'DEV-RLS-NEGATIVE-TENANT'),
         'Debe existir segundo conjunto DEV de prueba con nombre reservado'
  UNION ALL
  SELECT '03_residente_principal_dev_existe',
         EXISTS (SELECT 1 FROM public.residentes r, k WHERE r.id = k.residente_principal_id AND r.conjunto_id = k.conjunto_principal_id),
         'Debe conservarse residente principal DEV'
  UNION ALL
  SELECT '04_residente_ajeno_mismo_conjunto_existe',
         EXISTS (SELECT 1 FROM public.residentes r, k WHERE r.id = k.residente_same_id AND r.conjunto_id = k.conjunto_principal_id),
         'Debe existir residente negativo dentro del conjunto principal'
  UNION ALL
  SELECT '05_residente_ajeno_otro_conjunto_existe',
         EXISTS (SELECT 1 FROM public.residentes r, k WHERE r.id = k.residente_cross_id AND r.conjunto_id = k.conjunto_ajeno_id),
         'Debe existir residente negativo en el conjunto ajeno'
  UNION ALL
  SELECT '06_pago_ajeno_mismo_conjunto_existe',
         EXISTS (SELECT 1 FROM public.pagos p, k WHERE p.residente_id = k.residente_same_id AND p.conjunto_id = k.conjunto_principal_id AND p.concepto LIKE k.prefijo_like),
         'Debe existir pago negativo del residente ajeno mismo conjunto'
  UNION ALL
  SELECT '07_pago_cross_tenant_existe',
         EXISTS (SELECT 1 FROM public.pagos p, k WHERE p.residente_id = k.residente_cross_id AND p.conjunto_id = k.conjunto_ajeno_id AND p.concepto LIKE k.prefijo_like),
         'Debe existir pago negativo cross-tenant'
  UNION ALL
  SELECT '08_paquete_ajeno_mismo_conjunto_existe',
         EXISTS (SELECT 1 FROM public.paquetes p, k WHERE p.residente_id = k.residente_same_id AND p.conjunto_id = k.conjunto_principal_id AND p.descripcion LIKE k.prefijo_like),
         'Debe existir paquete negativo del residente ajeno mismo conjunto'
  UNION ALL
  SELECT '09_paquete_cross_tenant_existe',
         EXISTS (SELECT 1 FROM public.paquetes p, k WHERE p.residente_id = k.residente_cross_id AND p.conjunto_id = k.conjunto_ajeno_id AND p.descripcion LIKE k.prefijo_like),
         'Debe existir paquete negativo cross-tenant'
  UNION ALL
  SELECT '10_registro_visita_ajena_mismo_conjunto_existe',
         EXISTS (SELECT 1 FROM public.registro_visitas rv, public.visitantes v, k WHERE rv.visitante_id = v.id AND v.residente_id = k.residente_same_id AND rv.conjunto_id = k.conjunto_principal_id AND (rv.qr_code LIKE k.prefijo_like OR rv.notas LIKE k.prefijo_like)),
         'Debe existir registro de visita negativo del residente ajeno mismo conjunto'
  UNION ALL
  SELECT '11_incidente_cross_tenant_existe',
         EXISTS (SELECT 1 FROM public.incidentes i, k WHERE i.conjunto_id = k.conjunto_ajeno_id AND i.descripcion LIKE k.prefijo_like),
         'Debe existir incidente negativo cross-tenant'
  UNION ALL
  SELECT '12_reserva_ajena_mismo_conjunto_existe',
         EXISTS (SELECT 1 FROM public.reservas_zonas rz, k WHERE rz.residente_id = k.residente_same_id AND rz.conjunto_id = k.conjunto_principal_id AND (rz.motivo LIKE k.prefijo_like OR rz.observaciones LIKE k.prefijo_like)),
         'Debe existir reserva negativa del residente ajeno mismo conjunto'
  UNION ALL
  SELECT '13_reserva_cross_tenant_existe',
         EXISTS (SELECT 1 FROM public.reservas_zonas rz, k WHERE rz.residente_id = k.residente_cross_id AND rz.conjunto_id = k.conjunto_ajeno_id AND (rz.motivo LIKE k.prefijo_like OR rz.observaciones LIKE k.prefijo_like)),
         'Debe existir reserva negativa cross-tenant'
  UNION ALL
  SELECT '14_config_pagos_cross_tenant_existe',
         EXISTS (SELECT 1 FROM public.config_pagos cp, k WHERE cp.conjunto_id = k.conjunto_ajeno_id AND (cp.tipo LIKE k.prefijo_like OR cp.instrucciones LIKE k.prefijo_like)),
         'Debe existir config_pagos negativa cross-tenant'
  UNION ALL
  SELECT '15_sin_conjunto_negativo_fuera_uuid_reservado',
         NOT EXISTS (SELECT 1 FROM public.conjuntos c, k WHERE c.nombre LIKE k.prefijo_like AND c.id <> k.conjunto_ajeno_id),
         'No deben existir conjuntos negativos adicionales no controlados por FASE 3D.10'
  UNION ALL
  SELECT '16_sin_duplicados_qr_negativo',
         (SELECT count(*) FROM public.registro_visitas WHERE qr_code = 'DEV-RLS-NEGATIVE-QR-SAME-3D10') = 1,
         'Debe existir exactamente un QR negativo controlado'
) checks
ORDER BY check_name;

WITH k AS (
  SELECT
    '11111111-3d10-4000-8000-000000000010'::uuid AS conjunto_ajeno_id,
    '11111111-3d10-4000-8000-000000000013'::uuid AS residente_same_id,
    '11111111-3d10-4000-8000-000000000023'::uuid AS residente_cross_id
)
SELECT 'resumen_dataset_negativo' AS seccion,
       (SELECT count(*) FROM public.conjuntos c, k WHERE c.id = k.conjunto_ajeno_id) AS conjuntos_ajenos,
       (SELECT count(*) FROM public.residentes r, k WHERE r.id IN (k.residente_same_id, k.residente_cross_id)) AS residentes_negativos,
       (SELECT count(*) FROM public.pagos WHERE concepto LIKE 'DEV-RLS-NEGATIVE%') AS pagos_negativos,
       (SELECT count(*) FROM public.paquetes WHERE descripcion LIKE 'DEV-RLS-NEGATIVE%') AS paquetes_negativos,
       (SELECT count(*) FROM public.registro_visitas WHERE qr_code LIKE 'DEV-RLS-NEGATIVE%' OR notas LIKE 'DEV-RLS-NEGATIVE%') AS visitas_negativas,
       (SELECT count(*) FROM public.incidentes WHERE descripcion LIKE 'DEV-RLS-NEGATIVE%') AS incidentes_negativos,
       (SELECT count(*) FROM public.reservas_zonas WHERE motivo LIKE 'DEV-RLS-NEGATIVE%' OR observaciones LIKE 'DEV-RLS-NEGATIVE%') AS reservas_negativas,
       (SELECT count(*) FROM public.config_pagos WHERE tipo LIKE 'DEV-RLS-NEGATIVE%' OR instrucciones LIKE 'DEV-RLS-NEGATIVE%') AS config_pagos_negativas;
