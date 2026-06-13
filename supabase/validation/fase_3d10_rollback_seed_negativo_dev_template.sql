-- DEV ONLY
-- NO EJECUTAR EN QA
-- NO EJECUTAR EN PRD
-- NO EJECUTAR SIN AUTORIZACION HUMANA
-- TEMPLATE CONTROLADO PARA DATASET NEGATIVO RLS
-- FASE 3D.10A - Rollback controlado DEV dataset negativo RLS con UUID reales Auth
-- Project ref DEV esperado: polstaxmencetxgctvsw
--
-- Este rollback elimina SOLO datos DEV controlados por UUIDs reales de usuarios negativos,
-- UUIDs determinísticos de FASE 3D.10A o prefijo DEV-RLS-NEGATIVE.
-- No elimina auth.users; si se crearon usuarios Auth manuales, eliminarlos manualmente en Dashboard DEV si procede.

DO $$
DECLARE
  v_conjunto_principal_id uuid := 'a80af441-80f9-4a6c-8d3b-b8408c97dbe2';
  v_residente_principal_id uuid := '546c423c-1fa0-4750-b01c-0c24ad89b801';
  v_usuario_principal_id uuid := 'b46ab33c-9237-4f43-a010-ff95ca1263a6';

  -- Reemplazar manualmente con los mismos UUID reales usados en el seed 3D.10A.
  v_usuario_same_tenant_id_text text := '<UUID_REAL_AUTH_SAME_TENANT>';
  v_usuario_cross_tenant_id_text text := '<UUID_REAL_AUTH_CROSS_TENANT>';
  v_usuario_same_tenant_id uuid;
  v_usuario_cross_tenant_id uuid;
  v_email_same_tenant text := 'dev-rls-negative-same@urbaphix.com';
  v_email_cross_tenant text := 'dev-rls-negative-cross@urbaphix.com';

  v_conjunto_ajeno_id uuid := '11111111-3d10-4000-8000-000000000010';
  v_torre_same_id uuid := '11111111-3d10-4000-8000-000000000011';
  v_apto_same_id uuid := '11111111-3d10-4000-8000-000000000012';
  v_residente_same_id uuid := '11111111-3d10-4000-8000-000000000013';
  v_recurso_same_id uuid := '11111111-3d10-4000-8000-000000000014';
  v_pago_same_id uuid := '11111111-3d10-4000-8000-000000000015';
  v_paquete_same_id uuid := '11111111-3d10-4000-8000-000000000016';
  v_visitante_same_id uuid := '11111111-3d10-4000-8000-000000000017';
  v_registro_visita_same_id uuid := '11111111-3d10-4000-8000-000000000018';
  v_reserva_same_id uuid := '11111111-3d10-4000-8000-000000000019';

  v_torre_cross_id uuid := '11111111-3d10-4000-8000-000000000021';
  v_apto_cross_id uuid := '11111111-3d10-4000-8000-000000000022';
  v_residente_cross_id uuid := '11111111-3d10-4000-8000-000000000023';
  v_recurso_cross_id uuid := '11111111-3d10-4000-8000-000000000024';
  v_pago_cross_id uuid := '11111111-3d10-4000-8000-000000000025';
  v_paquete_cross_id uuid := '11111111-3d10-4000-8000-000000000026';
  v_incidente_cross_id uuid := '11111111-3d10-4000-8000-000000000027';
  v_reserva_cross_id uuid := '11111111-3d10-4000-8000-000000000028';
  v_config_pagos_cross_id uuid := '11111111-3d10-4000-8000-000000000029';
  v_visitante_cross_id uuid := '11111111-3d10-4000-8000-000000000030';
  v_registro_visita_cross_id uuid := '11111111-3d10-4000-8000-000000000031';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.conjuntos WHERE id = v_conjunto_principal_id) THEN
    RAISE EXCEPTION 'ABORTADO: conjunto principal DEV % no existe. Verifique que está en Supabase DEV polstaxmencetxgctvsw.', v_conjunto_principal_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.residentes
    WHERE id = v_residente_principal_id
      AND conjunto_id = v_conjunto_principal_id
  ) THEN
    RAISE EXCEPTION 'ABORTADO: residente principal DEV % no existe o no pertenece al conjunto DEV esperado.', v_residente_principal_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios_app
    WHERE id = v_usuario_principal_id
      AND conjunto_id = v_conjunto_principal_id
  ) THEN
    RAISE EXCEPTION 'ABORTADO: usuario principal DEV % no existe o no pertenece al conjunto DEV esperado.', v_usuario_principal_id;
  END IF;

  IF v_usuario_same_tenant_id_text = '<UUID_REAL_AUTH_SAME_TENANT>' OR v_usuario_cross_tenant_id_text = '<UUID_REAL_AUTH_CROSS_TENANT>' THEN
    RAISE EXCEPTION 'ABORTADO: reemplazar placeholders UUID reales Auth antes de ejecutar el rollback.';
  END IF;

  v_usuario_same_tenant_id := v_usuario_same_tenant_id_text::uuid;
  v_usuario_cross_tenant_id := v_usuario_cross_tenant_id_text::uuid;

  IF v_usuario_same_tenant_id = v_usuario_cross_tenant_id THEN
    RAISE EXCEPTION 'ABORTADO: los UUID reales Auth same/cross no pueden ser iguales.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_usuario_same_tenant_id)
     AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_usuario_same_tenant_id AND lower(email) = lower(v_email_same_tenant)) THEN
    RAISE EXCEPTION 'ABORTADO: UUID Auth same tenant % existe pero no coincide con email esperado %.', v_usuario_same_tenant_id, v_email_same_tenant;
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_usuario_cross_tenant_id)
     AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_usuario_cross_tenant_id AND lower(email) = lower(v_email_cross_tenant)) THEN
    RAISE EXCEPTION 'ABORTADO: UUID Auth cross tenant % existe pero no coincide con email esperado %.', v_usuario_cross_tenant_id, v_email_cross_tenant;
  END IF;

  DELETE FROM public.reservas_eventos
  WHERE reserva_id IN (v_reserva_same_id, v_reserva_cross_id)
    AND (detalle LIKE 'DEV-RLS-NEGATIVE%' OR metadata ->> 'dataset' = 'negative-rls');

  DELETE FROM public.reservas_documentos
  WHERE reserva_id IN (v_reserva_same_id, v_reserva_cross_id)
    AND (nombre_archivo LIKE 'DEV-RLS-NEGATIVE%' OR ruta_storage LIKE 'DEV-RLS-NEGATIVE%');

  DELETE FROM public.reservas_zonas
  WHERE id IN (v_reserva_same_id, v_reserva_cross_id)
    AND (motivo LIKE 'DEV-RLS-NEGATIVE%' OR observaciones LIKE 'DEV-RLS-NEGATIVE%' OR metadata ->> 'dataset' = 'negative-rls');

  DELETE FROM public.registro_visitas
  WHERE id IN (v_registro_visita_same_id, v_registro_visita_cross_id)
    AND (qr_code LIKE 'DEV-RLS-NEGATIVE%' OR notas LIKE 'DEV-RLS-NEGATIVE%');

  DELETE FROM public.visitantes
  WHERE id IN (v_visitante_same_id, v_visitante_cross_id)
    AND (nombre LIKE 'DEV-RLS-NEGATIVE%' OR documento LIKE 'DEV3D10%');

  DELETE FROM public.paquetes
  WHERE id IN (v_paquete_same_id, v_paquete_cross_id)
    AND descripcion LIKE 'DEV-RLS-NEGATIVE%';

  DELETE FROM public.pagos
  WHERE id IN (v_pago_same_id, v_pago_cross_id)
    AND concepto LIKE 'DEV-RLS-NEGATIVE%';

  DELETE FROM public.incidentes
  WHERE id = v_incidente_cross_id
    AND descripcion LIKE 'DEV-RLS-NEGATIVE%';

  DELETE FROM public.config_pagos
  WHERE id = v_config_pagos_cross_id
    AND (tipo LIKE 'DEV-RLS-NEGATIVE%' OR instrucciones LIKE 'DEV-RLS-NEGATIVE%');

  DELETE FROM public.recursos_comunes
  WHERE id IN (v_recurso_same_id, v_recurso_cross_id)
    AND nombre LIKE 'DEV-RLS-NEGATIVE%';

  DELETE FROM public.tenant_memberships
  WHERE user_id IN (v_usuario_same_tenant_id, v_usuario_cross_tenant_id)
    AND source_legacy = 'fase_3d10_negative_rls'
    AND role_name = 'residente'
    AND status = 'active';

  DELETE FROM public.residentes
  WHERE id IN (v_residente_same_id, v_residente_cross_id)
    AND usuario_id IN (v_usuario_same_tenant_id, v_usuario_cross_tenant_id)
    AND id <> v_residente_principal_id;

  DELETE FROM public.apartamentos
  WHERE id IN (v_apto_same_id, v_apto_cross_id)
    AND numero LIKE 'DEV-RLS-NEGATIVE%';

  DELETE FROM public.torres
  WHERE id IN (v_torre_same_id, v_torre_cross_id)
    AND nombre LIKE 'DEV-RLS-NEGATIVE%';

  DELETE FROM public.usuarios_app
  WHERE id IN (v_usuario_same_tenant_id, v_usuario_cross_tenant_id)
    AND id <> v_usuario_principal_id
    AND (nombre LIKE 'DEV-RLS-NEGATIVE%' OR email IN (v_email_same_tenant, v_email_cross_tenant));

  DELETE FROM public.tipos_documento
  WHERE codigo = 'DEV-RLS-NEGATIVE-DOC'
    AND nombre = 'DEV-RLS-NEGATIVE-DOC'
    AND NOT EXISTS (SELECT 1 FROM public.visitantes WHERE tipo_documento = 'DEV-RLS-NEGATIVE-DOC');

  DELETE FROM public.conjuntos
  WHERE id = v_conjunto_ajeno_id
    AND nombre = 'DEV-RLS-NEGATIVE-TENANT';

  RAISE NOTICE 'FASE 3D.10 rollback DEV completado. Auth users manuales no fueron eliminados.';
END $$;

SELECT 'fase_3d10a_rollback_completado' AS resultado,
       'Reejecutar fase_3d10_postcheck_seed_negativo_dev.sql para confirmar limpieza o ausencia controlada.' AS siguiente_paso;
