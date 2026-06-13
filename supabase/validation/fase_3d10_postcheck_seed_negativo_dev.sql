-- FASE 3D.10A - Post-check seed dataset negativo RLS DEV
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
    'dev-rls-negative-same@urbaphix.com'::text AS email_same_tenant,
    'dev-rls-negative-cross@urbaphix.com'::text AS email_cross_tenant,
    'DEV-RLS-NEGATIVE%'::text AS prefijo_like
), auth_ids AS (
  SELECT
    k.*,
    au_same.id AS usuario_same_tenant_id,
    au_cross.id AS usuario_cross_tenant_id
  FROM k
  LEFT JOIN auth.users au_same ON lower(au_same.email) = lower(k.email_same_tenant)
  LEFT JOIN auth.users au_cross ON lower(au_cross.email) = lower(k.email_cross_tenant)
)
SELECT check_name, ok, detalle
FROM (
  SELECT '01_auth_user_same_tenant_existe_confirmado' AS check_name,
         EXISTS (SELECT 1 FROM auth.users au, k WHERE lower(au.email) = lower(k.email_same_tenant) AND au.email_confirmed_at IS NOT NULL) AS ok,
         'Auth user same tenant debe existir por email esperado y estar confirmado' AS detalle
  UNION ALL
  SELECT '02_auth_user_cross_tenant_existe_confirmado',
         EXISTS (SELECT 1 FROM auth.users au, k WHERE lower(au.email) = lower(k.email_cross_tenant) AND au.email_confirmed_at IS NOT NULL),
         'Auth user cross tenant debe existir por email esperado y estar confirmado'
  UNION ALL
  SELECT '03_usuarios_app_same_id_email_coincide_auth',
         EXISTS (SELECT 1 FROM public.usuarios_app ua, auth_ids k WHERE ua.id = k.usuario_same_tenant_id AND lower(ua.email) = lower(k.email_same_tenant) AND ua.conjunto_id = k.conjunto_principal_id),
         'usuarios_app.id debe ser el UUID real de auth.users para same tenant y conservar email esperado'
  UNION ALL
  SELECT '04_usuarios_app_cross_id_email_coincide_auth',
         EXISTS (SELECT 1 FROM public.usuarios_app ua, auth_ids k WHERE ua.id = k.usuario_cross_tenant_id AND lower(ua.email) = lower(k.email_cross_tenant) AND ua.conjunto_id = k.conjunto_ajeno_id),
         'usuarios_app.id debe ser el UUID real de auth.users para cross tenant y conservar email esperado'
  UNION ALL
  SELECT '05_residente_same_usa_uuid_real_auth',
         EXISTS (SELECT 1 FROM public.residentes r, auth_ids k WHERE r.id = k.residente_same_id AND r.usuario_id = k.usuario_same_tenant_id AND r.conjunto_id = k.conjunto_principal_id),
         'residente same tenant debe apuntar al UUID real Auth en usuario_id'
  UNION ALL
  SELECT '06_residente_cross_usa_uuid_real_auth',
         EXISTS (SELECT 1 FROM public.residentes r, auth_ids k WHERE r.id = k.residente_cross_id AND r.usuario_id = k.usuario_cross_tenant_id AND r.conjunto_id = k.conjunto_ajeno_id),
         'residente cross tenant debe apuntar al UUID real Auth en usuario_id'
  UNION ALL
  SELECT '07_tenant_membership_same_usa_uuid_real_auth',
         EXISTS (SELECT 1 FROM public.tenant_memberships tm, auth_ids k WHERE tm.user_id = k.usuario_same_tenant_id AND tm.conjunto_id = k.conjunto_principal_id AND tm.residente_id = k.residente_same_id AND tm.role_name = 'residente' AND tm.status = 'active'),
         'tenant_memberships.user_id same tenant debe ser el UUID real Auth'
  UNION ALL
  SELECT '08_tenant_membership_cross_usa_uuid_real_auth',
         EXISTS (SELECT 1 FROM public.tenant_memberships tm, auth_ids k WHERE tm.user_id = k.usuario_cross_tenant_id AND tm.conjunto_id = k.conjunto_ajeno_id AND tm.residente_id = k.residente_cross_id AND tm.role_name = 'residente' AND tm.status = 'active'),
         'tenant_memberships.user_id cross tenant debe ser el UUID real Auth'
  UNION ALL
  SELECT '09_tipo_documento_dev_only_existe_activo',
         EXISTS (SELECT 1 FROM public.tipos_documento WHERE codigo = 'DEV-RLS-NEGATIVE-DOC' AND activo = true),
         'Debe existir tipo_documento DEV-only creado/reutilizado para visitantes negativos'
  UNION ALL
  SELECT '10_conjunto_principal_dev_existe',
         EXISTS (SELECT 1 FROM public.conjuntos c, k WHERE c.id = k.conjunto_principal_id),
         'Debe existir el conjunto principal DEV autorizado'
  UNION ALL
  SELECT '11_conjunto_ajeno_dev_prueba_existe',
         EXISTS (SELECT 1 FROM public.conjuntos c, k WHERE c.id = k.conjunto_ajeno_id AND c.nombre = 'DEV-RLS-NEGATIVE-TENANT'),
         'Debe existir segundo conjunto DEV de prueba con nombre reservado'
  UNION ALL
  SELECT '12_residente_principal_dev_existe',
         EXISTS (SELECT 1 FROM public.residentes r, k WHERE r.id = k.residente_principal_id AND r.conjunto_id = k.conjunto_principal_id),
         'Debe conservarse residente principal DEV'
  UNION ALL
  SELECT '13_pago_ajeno_mismo_conjunto_existe',
         EXISTS (SELECT 1 FROM public.pagos p, k WHERE p.residente_id = k.residente_same_id AND p.conjunto_id = k.conjunto_principal_id AND p.concepto LIKE k.prefijo_like),
         'Debe existir pago negativo del residente ajeno mismo conjunto'
  UNION ALL
  SELECT '14_pago_cross_tenant_existe',
         EXISTS (SELECT 1 FROM public.pagos p, k WHERE p.residente_id = k.residente_cross_id AND p.conjunto_id = k.conjunto_ajeno_id AND p.concepto LIKE k.prefijo_like),
         'Debe existir pago negativo cross-tenant'
  UNION ALL
  SELECT '15_paquete_ajeno_mismo_conjunto_existe',
         EXISTS (SELECT 1 FROM public.paquetes p, k WHERE p.residente_id = k.residente_same_id AND p.conjunto_id = k.conjunto_principal_id AND p.descripcion LIKE k.prefijo_like),
         'Debe existir paquete negativo del residente ajeno mismo conjunto'
  UNION ALL
  SELECT '16_paquete_cross_tenant_existe',
         EXISTS (SELECT 1 FROM public.paquetes p, k WHERE p.residente_id = k.residente_cross_id AND p.conjunto_id = k.conjunto_ajeno_id AND p.descripcion LIKE k.prefijo_like),
         'Debe existir paquete negativo cross-tenant'
  UNION ALL
  SELECT '17_registro_visita_ajena_mismo_conjunto_existe',
         EXISTS (SELECT 1 FROM public.registro_visitas rv, public.visitantes v, k WHERE rv.visitante_id = v.id AND v.residente_id = k.residente_same_id AND rv.conjunto_id = k.conjunto_principal_id AND v.tipo_documento = 'DEV-RLS-NEGATIVE-DOC' AND (rv.qr_code LIKE k.prefijo_like OR rv.notas LIKE k.prefijo_like)),
         'Debe existir registro de visita negativo del residente ajeno mismo conjunto'
  UNION ALL
  SELECT '18_registro_visita_cross_tenant_existe',
         EXISTS (SELECT 1 FROM public.registro_visitas rv, public.visitantes v, k WHERE rv.visitante_id = v.id AND v.residente_id = k.residente_cross_id AND rv.conjunto_id = k.conjunto_ajeno_id AND v.tipo_documento = 'DEV-RLS-NEGATIVE-DOC' AND (rv.qr_code LIKE k.prefijo_like OR rv.notas LIKE k.prefijo_like)),
         'Debe existir registro de visita negativo cross-tenant del conjunto ajeno'
  UNION ALL
  SELECT '19_incidente_cross_tenant_existe',
         EXISTS (SELECT 1 FROM public.incidentes i, k WHERE i.conjunto_id = k.conjunto_ajeno_id AND i.descripcion LIKE k.prefijo_like),
         'Debe existir incidente negativo cross-tenant'
  UNION ALL
  SELECT '20_reserva_ajena_mismo_conjunto_existe',
         EXISTS (SELECT 1 FROM public.reservas_zonas rz, k WHERE rz.residente_id = k.residente_same_id AND rz.conjunto_id = k.conjunto_principal_id AND (rz.motivo LIKE k.prefijo_like OR rz.observaciones LIKE k.prefijo_like)),
         'Debe existir reserva negativa del residente ajeno mismo conjunto'
  UNION ALL
  SELECT '21_reserva_cross_tenant_existe',
         EXISTS (SELECT 1 FROM public.reservas_zonas rz, k WHERE rz.residente_id = k.residente_cross_id AND rz.conjunto_id = k.conjunto_ajeno_id AND (rz.motivo LIKE k.prefijo_like OR rz.observaciones LIKE k.prefijo_like)),
         'Debe existir reserva negativa cross-tenant'
  UNION ALL
  SELECT '22_config_pagos_cross_tenant_existe',
         EXISTS (SELECT 1 FROM public.config_pagos cp, k WHERE cp.conjunto_id = k.conjunto_ajeno_id AND (cp.tipo LIKE k.prefijo_like OR cp.instrucciones LIKE k.prefijo_like)),
         'Debe existir config_pagos negativa cross-tenant'
  UNION ALL
  SELECT '23_sin_conjunto_negativo_fuera_uuid_reservado',
         NOT EXISTS (SELECT 1 FROM public.conjuntos c, k WHERE c.nombre LIKE k.prefijo_like AND c.id <> k.conjunto_ajeno_id),
         'No deben existir conjuntos negativos adicionales no controlados por FASE 3D.10A'
  UNION ALL
  SELECT '24_sin_duplicados_qr_negativo_same',
         (SELECT count(*) FROM public.registro_visitas WHERE qr_code = 'DEV-RLS-NEGATIVE-QR-SAME-3D10') = 1,
         'Debe existir exactamente un QR negativo controlado mismo conjunto'
  UNION ALL
  SELECT '25_sin_duplicados_qr_negativo_cross',
         (SELECT count(*) FROM public.registro_visitas WHERE qr_code = 'DEV-RLS-NEGATIVE-QR-CROSS-3D10') = 1,
         'Debe existir exactamente un QR negativo controlado cross-tenant'
) checks
ORDER BY check_name;

WITH k AS (
  SELECT
    '11111111-3d10-4000-8000-000000000010'::uuid AS conjunto_ajeno_id,
    '11111111-3d10-4000-8000-000000000013'::uuid AS residente_same_id,
    '11111111-3d10-4000-8000-000000000023'::uuid AS residente_cross_id,
    'dev-rls-negative-same@urbaphix.com'::text AS email_same_tenant,
    'dev-rls-negative-cross@urbaphix.com'::text AS email_cross_tenant
)
SELECT 'resumen_dataset_negativo' AS seccion,
       (SELECT count(*) FROM auth.users au, k WHERE lower(au.email) IN (lower(k.email_same_tenant), lower(k.email_cross_tenant))) AS auth_users_negativos,
       (SELECT count(*) FROM public.usuarios_app ua, auth.users au, k WHERE ua.id = au.id AND lower(au.email) IN (lower(k.email_same_tenant), lower(k.email_cross_tenant))) AS usuarios_app_con_uuid_auth_real,
       (SELECT count(*) FROM public.tenant_memberships tm, auth.users au, k WHERE tm.user_id = au.id AND lower(au.email) IN (lower(k.email_same_tenant), lower(k.email_cross_tenant)) AND tm.status = 'active') AS memberships_con_uuid_auth_real,
       (SELECT count(*) FROM public.conjuntos c, k WHERE c.id = k.conjunto_ajeno_id) AS conjuntos_ajenos,
       (SELECT count(*) FROM public.residentes r, k WHERE r.id IN (k.residente_same_id, k.residente_cross_id)) AS residentes_negativos,
       (SELECT count(*) FROM public.tipos_documento WHERE codigo = 'DEV-RLS-NEGATIVE-DOC') AS tipos_documento_dev_only,
       (SELECT count(*) FROM public.pagos WHERE concepto LIKE 'DEV-RLS-NEGATIVE%') AS pagos_negativos,
       (SELECT count(*) FROM public.paquetes WHERE descripcion LIKE 'DEV-RLS-NEGATIVE%') AS paquetes_negativos,
       (SELECT count(*) FROM public.registro_visitas WHERE qr_code LIKE 'DEV-RLS-NEGATIVE%' OR notas LIKE 'DEV-RLS-NEGATIVE%') AS visitas_negativas,
       (SELECT count(*) FROM public.incidentes WHERE descripcion LIKE 'DEV-RLS-NEGATIVE%') AS incidentes_negativos,
       (SELECT count(*) FROM public.reservas_zonas WHERE motivo LIKE 'DEV-RLS-NEGATIVE%' OR observaciones LIKE 'DEV-RLS-NEGATIVE%') AS reservas_negativas,
       (SELECT count(*) FROM public.config_pagos WHERE tipo LIKE 'DEV-RLS-NEGATIVE%' OR instrucciones LIKE 'DEV-RLS-NEGATIVE%') AS config_pagos_negativas;
