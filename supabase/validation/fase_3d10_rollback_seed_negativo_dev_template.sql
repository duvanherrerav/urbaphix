-- DEV ONLY
-- NO EJECUTAR EN QA
-- NO EJECUTAR EN PRD
-- NO EJECUTAR SIN AUTORIZACION HUMANA
-- TEMPLATE CONTROLADO PARA DATASET NEGATIVO RLS
-- FASE 3D.10 - Rollback controlado DEV dataset negativo RLS
-- Project ref DEV esperado: polstaxmencetxgctvsw
--
-- Este rollback elimina SOLO datos con UUIDs reservados o prefijo DEV-RLS-NEGATIVE.
-- No elimina auth.users; si se crearon usuarios Auth manuales, eliminarlos manualmente en Dashboard DEV si procede.

DO $$
DECLARE
  v_conjunto_principal_id uuid := 'a80af441-80f9-4a6c-8d3b-b8408c97dbe2';
  v_residente_principal_id uuid := '546c423c-1fa0-4750-b01c-0c24ad89b801';
  v_usuario_principal_id uuid := 'b46ab33c-9237-4f43-a010-ff95ca1263a6';

  v_conjunto_ajeno_id uuid := '11111111-3d10-4000-8000-000000000010';
  v_torre_same_id uuid := '11111111-3d10-4000-8000-000000000011';
  v_apto_same_id uuid := '11111111-3d10-4000-8000-000000000012';
  v_usuario_same_id uuid := '11111111-3d10-4000-8000-000000000001';
  v_residente_same_id uuid := '11111111-3d10-4000-8000-000000000013';
  v_recurso_same_id uuid := '11111111-3d10-4000-8000-000000000014';
  v_pago_same_id uuid := '11111111-3d10-4000-8000-000000000015';
  v_paquete_same_id uuid := '11111111-3d10-4000-8000-000000000016';
  v_visitante_same_id uuid := '11111111-3d10-4000-8000-000000000017';
  v_registro_visita_same_id uuid := '11111111-3d10-4000-8000-000000000018';
  v_reserva_same_id uuid := '11111111-3d10-4000-8000-000000000019';

  v_torre_cross_id uuid := '11111111-3d10-4000-8000-000000000021';
  v_apto_cross_id uuid := '11111111-3d10-4000-8000-000000000022';
  v_usuario_cross_id uuid := '11111111-3d10-4000-8000-000000000002';
  v_residente_cross_id uuid := '11111111-3d10-4000-8000-000000000023';
  v_recurso_cross_id uuid := '11111111-3d10-4000-8000-000000000024';
  v_pago_cross_id uuid := '11111111-3d10-4000-8000-000000000025';
  v_paquete_cross_id uuid := '11111111-3d10-4000-8000-000000000026';
  v_incidente_cross_id uuid := '11111111-3d10-4000-8000-000000000027';
  v_reserva_cross_id uuid := '11111111-3d10-4000-8000-000000000028';
  v_config_pagos_cross_id uuid := '11111111-3d10-4000-8000-000000000029';
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
  WHERE id = v_registro_visita_same_id
    AND (qr_code LIKE 'DEV-RLS-NEGATIVE%' OR notas LIKE 'DEV-RLS-NEGATIVE%');

  DELETE FROM public.visitantes
  WHERE id = v_visitante_same_id
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

  DELETE FROM public.residentes
  WHERE id IN (v_residente_same_id, v_residente_cross_id)
    AND id <> v_residente_principal_id;

  DELETE FROM public.apartamentos
  WHERE id IN (v_apto_same_id, v_apto_cross_id)
    AND numero LIKE 'DEV-RLS-NEGATIVE%';

  DELETE FROM public.torres
  WHERE id IN (v_torre_same_id, v_torre_cross_id)
    AND nombre LIKE 'DEV-RLS-NEGATIVE%';

  DELETE FROM public.usuarios_app
  WHERE id IN (v_usuario_same_id, v_usuario_cross_id)
    AND id <> v_usuario_principal_id
    AND (nombre LIKE 'DEV-RLS-NEGATIVE%' OR email LIKE 'dev-rls-negative-%@example.invalid');

  DELETE FROM public.conjuntos
  WHERE id = v_conjunto_ajeno_id
    AND nombre = 'DEV-RLS-NEGATIVE-TENANT';

  RAISE NOTICE 'FASE 3D.10 rollback DEV completado. Auth users manuales no fueron eliminados.';
END $$;

SELECT 'fase_3d10_rollback_completado' AS resultado,
       'Reejecutar fase_3d10_postcheck_seed_negativo_dev.sql para confirmar limpieza o ausencia controlada.' AS siguiente_paso;
