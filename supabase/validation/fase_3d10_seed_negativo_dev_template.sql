-- DEV ONLY
-- NO EJECUTAR EN QA
-- NO EJECUTAR EN PRD
-- NO EJECUTAR SIN AUTORIZACION HUMANA
-- TEMPLATE CONTROLADO PARA DATASET NEGATIVO RLS
-- FASE 3D.10 - Seed controlado DEV dataset negativo RLS
-- Project ref DEV esperado: polstaxmencetxgctvsw
--
-- PRECONDICION MANUAL:
--   Crear/verificar en Supabase Dashboard DEV los auth.users de prueba antes de ejecutar:
--   11111111-3d10-4000-8000-000000000001 -> dev-rls-negative-same-tenant@example.invalid
--   11111111-3d10-4000-8000-000000000002 -> dev-rls-negative-cross-tenant@example.invalid
--   Si el Dashboard genera otros UUID, reemplazarlos en las constantes de este template.

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

  v_tipo_documento text;
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

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_usuario_same_id) THEN
    RAISE EXCEPTION 'ABORTADO: falta auth.users de prueba mismo conjunto %. Crearlo manualmente en Supabase Dashboard DEV o ajustar UUID.', v_usuario_same_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_usuario_cross_id) THEN
    RAISE EXCEPTION 'ABORTADO: falta auth.users de prueba cross-tenant %. Crearlo manualmente en Supabase Dashboard DEV o ajustar UUID.', v_usuario_cross_id;
  END IF;

  SELECT td.codigo
    INTO v_tipo_documento
  FROM public.tipos_documento td
  WHERE COALESCE(td.activo, true) = true
  ORDER BY td.codigo
  LIMIT 1;

  IF v_tipo_documento IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: no existe tipos_documento activo para crear visitante negativo DEV.';
  END IF;

  INSERT INTO public.conjuntos (id, nombre, direccion, ciudad)
  VALUES (v_conjunto_ajeno_id, 'DEV-RLS-NEGATIVE-TENANT', 'DEV-RLS-NEGATIVE-DIRECCION', 'DEV-RLS-NEGATIVE-CIUDAD')
  ON CONFLICT (id) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        direccion = EXCLUDED.direccion,
        ciudad = EXCLUDED.ciudad;

  INSERT INTO public.torres (id, conjunto_id, nombre, pisos, created_at)
  VALUES
    (v_torre_same_id, v_conjunto_principal_id, 'DEV-RLS-NEGATIVE-TORRE-SAME', 1, now()),
    (v_torre_cross_id, v_conjunto_ajeno_id, 'DEV-RLS-NEGATIVE-TORRE-CROSS', 1, now())
  ON CONFLICT (id) DO UPDATE
    SET conjunto_id = EXCLUDED.conjunto_id,
        nombre = EXCLUDED.nombre,
        pisos = EXCLUDED.pisos;

  INSERT INTO public.apartamentos (id, torre_id, conjunto_id, numero, piso, tipo_apartamento, created_at)
  VALUES
    (v_apto_same_id, v_torre_same_id, v_conjunto_principal_id, 'DEV-RLS-NEGATIVE-APT-SAME', 1, 'pequeno', now()),
    (v_apto_cross_id, v_torre_cross_id, v_conjunto_ajeno_id, 'DEV-RLS-NEGATIVE-APT-CROSS', 1, 'pequeno', now())
  ON CONFLICT (id) DO UPDATE
    SET torre_id = EXCLUDED.torre_id,
        conjunto_id = EXCLUDED.conjunto_id,
        numero = EXCLUDED.numero,
        piso = EXCLUDED.piso,
        tipo_apartamento = EXCLUDED.tipo_apartamento;

  INSERT INTO public.usuarios_app (id, conjunto_id, rol_id, nombre, telefono, activo, email)
  VALUES
    (v_usuario_same_id, v_conjunto_principal_id, 'residente', 'DEV-RLS-NEGATIVE-RESIDENTE-SAME', NULL, true, 'dev-rls-negative-same-tenant@example.invalid'),
    (v_usuario_cross_id, v_conjunto_ajeno_id, 'residente', 'DEV-RLS-NEGATIVE-RESIDENTE-CROSS', NULL, true, 'dev-rls-negative-cross-tenant@example.invalid')
  ON CONFLICT (id) DO UPDATE
    SET conjunto_id = EXCLUDED.conjunto_id,
        rol_id = EXCLUDED.rol_id,
        nombre = EXCLUDED.nombre,
        telefono = EXCLUDED.telefono,
        activo = EXCLUDED.activo,
        email = EXCLUDED.email;

  INSERT INTO public.residentes (id, usuario_id, es_propietario, conjunto_id, apartamento_id)
  VALUES
    (v_residente_same_id, v_usuario_same_id, false, v_conjunto_principal_id, v_apto_same_id),
    (v_residente_cross_id, v_usuario_cross_id, false, v_conjunto_ajeno_id, v_apto_cross_id)
  ON CONFLICT (id) DO UPDATE
    SET usuario_id = EXCLUDED.usuario_id,
        es_propietario = EXCLUDED.es_propietario,
        conjunto_id = EXCLUDED.conjunto_id,
        apartamento_id = EXCLUDED.apartamento_id;

  INSERT INTO public.recursos_comunes (id, conjunto_id, nombre, tipo, descripcion, activo, capacidad, requiere_aprobacion, requiere_deposito, deposito_valor, tiempo_buffer_min, reglas)
  VALUES
    (v_recurso_same_id, v_conjunto_principal_id, 'DEV-RLS-NEGATIVE-RECURSO-SAME', 'salon_social', 'DEV-RLS-NEGATIVE recurso mismo conjunto', true, 1, true, false, NULL, 0, '{}'::jsonb),
    (v_recurso_cross_id, v_conjunto_ajeno_id, 'DEV-RLS-NEGATIVE-RECURSO-CROSS', 'salon_social', 'DEV-RLS-NEGATIVE recurso cross tenant', true, 1, true, false, NULL, 0, '{}'::jsonb)
  ON CONFLICT (id) DO UPDATE
    SET conjunto_id = EXCLUDED.conjunto_id,
        nombre = EXCLUDED.nombre,
        tipo = EXCLUDED.tipo,
        descripcion = EXCLUDED.descripcion,
        activo = EXCLUDED.activo,
        capacidad = EXCLUDED.capacidad,
        requiere_aprobacion = EXCLUDED.requiere_aprobacion,
        requiere_deposito = EXCLUDED.requiere_deposito,
        deposito_valor = EXCLUDED.deposito_valor,
        tiempo_buffer_min = EXCLUDED.tiempo_buffer_min,
        reglas = EXCLUDED.reglas,
        updated_at = now();

  INSERT INTO public.pagos (id, residente_id, concepto, valor, estado, fecha_pago, conjunto_id, comprobante_url, tipo_pago)
  VALUES
    (v_pago_same_id, v_residente_same_id, 'DEV-RLS-NEGATIVE-PAGO-SAME', 1000, 'pendiente', NULL, v_conjunto_principal_id, NULL, 'administracion'),
    (v_pago_cross_id, v_residente_cross_id, 'DEV-RLS-NEGATIVE-PAGO-CROSS', 1000, 'pendiente', NULL, v_conjunto_ajeno_id, NULL, 'administracion')
  ON CONFLICT (id) DO UPDATE
    SET residente_id = EXCLUDED.residente_id,
        concepto = EXCLUDED.concepto,
        valor = EXCLUDED.valor,
        estado = EXCLUDED.estado,
        fecha_pago = EXCLUDED.fecha_pago,
        conjunto_id = EXCLUDED.conjunto_id,
        comprobante_url = EXCLUDED.comprobante_url,
        tipo_pago = EXCLUDED.tipo_pago;

  INSERT INTO public.paquetes (id, conjunto_id, residente_id, descripcion, recibido_por, estado, fecha_recibido, fecha_entrega, apartamento_id)
  VALUES
    (v_paquete_same_id, v_conjunto_principal_id, v_residente_same_id, 'DEV-RLS-NEGATIVE-PAQUETE-SAME', v_usuario_principal_id, 'pendiente', now(), NULL, v_apto_same_id),
    (v_paquete_cross_id, v_conjunto_ajeno_id, v_residente_cross_id, 'DEV-RLS-NEGATIVE-PAQUETE-CROSS', v_usuario_cross_id, 'pendiente', now(), NULL, v_apto_cross_id)
  ON CONFLICT (id) DO UPDATE
    SET conjunto_id = EXCLUDED.conjunto_id,
        residente_id = EXCLUDED.residente_id,
        descripcion = EXCLUDED.descripcion,
        recibido_por = EXCLUDED.recibido_por,
        estado = EXCLUDED.estado,
        apartamento_id = EXCLUDED.apartamento_id;

  INSERT INTO public.visitantes (id, conjunto_id, residente_id, nombre, tipo_documento, documento, tipo_vehiculo, placa, activo)
  VALUES (v_visitante_same_id, v_conjunto_principal_id, v_residente_same_id, 'DEV-RLS-NEGATIVE-VISITANTE-SAME', v_tipo_documento, 'DEV3D10SAME', NULL, NULL, true)
  ON CONFLICT (id) DO UPDATE
    SET conjunto_id = EXCLUDED.conjunto_id,
        residente_id = EXCLUDED.residente_id,
        nombre = EXCLUDED.nombre,
        tipo_documento = EXCLUDED.tipo_documento,
        documento = EXCLUDED.documento,
        activo = EXCLUDED.activo,
        updated_at = now();

  INSERT INTO public.registro_visitas (id, visitante_id, conjunto_id, apartamento_id, fecha_visita, estado, qr_code, validado_por, notas)
  VALUES (v_registro_visita_same_id, v_visitante_same_id, v_conjunto_principal_id, v_apto_same_id, current_date + 1, 'pendiente', 'DEV-RLS-NEGATIVE-QR-SAME-3D10', NULL, 'DEV-RLS-NEGATIVE-REGISTRO-VISITA-SAME')
  ON CONFLICT (id) DO UPDATE
    SET visitante_id = EXCLUDED.visitante_id,
        conjunto_id = EXCLUDED.conjunto_id,
        apartamento_id = EXCLUDED.apartamento_id,
        fecha_visita = EXCLUDED.fecha_visita,
        estado = EXCLUDED.estado,
        qr_code = EXCLUDED.qr_code,
        validado_por = EXCLUDED.validado_por,
        notas = EXCLUDED.notas,
        updated_at = now();

  INSERT INTO public.incidentes (id, conjunto_id, reportado_por, descripcion, nivel)
  VALUES (v_incidente_cross_id, v_conjunto_ajeno_id, v_usuario_cross_id, 'DEV-RLS-NEGATIVE-INCIDENTE-CROSS', 'bajo')
  ON CONFLICT (id) DO UPDATE
    SET conjunto_id = EXCLUDED.conjunto_id,
        reportado_por = EXCLUDED.reportado_por,
        descripcion = EXCLUDED.descripcion,
        nivel = EXCLUDED.nivel;

  INSERT INTO public.reservas_zonas (id, conjunto_id, recurso_id, residente_id, apartamento_id, fecha_inicio, fecha_fin, tipo_reserva, subtipo, estado, motivo, observaciones, metadata)
  VALUES
    (v_reserva_same_id, v_conjunto_principal_id, v_recurso_same_id, v_residente_same_id, v_apto_same_id, now() + interval '2 days', now() + interval '2 days 1 hour', 'recreativa', 'DEV-RLS-NEGATIVE', 'solicitada', 'DEV-RLS-NEGATIVE-RESERVA-SAME', 'DEV-RLS-NEGATIVE reserva mismo conjunto', jsonb_build_object('fase', '3D.10', 'dataset', 'negative-rls')),
    (v_reserva_cross_id, v_conjunto_ajeno_id, v_recurso_cross_id, v_residente_cross_id, v_apto_cross_id, now() + interval '3 days', now() + interval '3 days 1 hour', 'recreativa', 'DEV-RLS-NEGATIVE', 'solicitada', 'DEV-RLS-NEGATIVE-RESERVA-CROSS', 'DEV-RLS-NEGATIVE reserva cross tenant', jsonb_build_object('fase', '3D.10', 'dataset', 'negative-rls'))
  ON CONFLICT (id) DO UPDATE
    SET conjunto_id = EXCLUDED.conjunto_id,
        recurso_id = EXCLUDED.recurso_id,
        residente_id = EXCLUDED.residente_id,
        apartamento_id = EXCLUDED.apartamento_id,
        fecha_inicio = EXCLUDED.fecha_inicio,
        fecha_fin = EXCLUDED.fecha_fin,
        tipo_reserva = EXCLUDED.tipo_reserva,
        subtipo = EXCLUDED.subtipo,
        estado = EXCLUDED.estado,
        motivo = EXCLUDED.motivo,
        observaciones = EXCLUDED.observaciones,
        metadata = EXCLUDED.metadata,
        updated_at = now();

  INSERT INTO public.config_pagos (id, conjunto_id, tipo, url_pago, instrucciones, activo)
  VALUES (v_config_pagos_cross_id, v_conjunto_ajeno_id, 'DEV-RLS-NEGATIVE-CONFIG-PAGOS-CROSS', NULL, 'DEV-RLS-NEGATIVE config pagos cross tenant', true)
  ON CONFLICT (id) DO UPDATE
    SET conjunto_id = EXCLUDED.conjunto_id,
        tipo = EXCLUDED.tipo,
        url_pago = EXCLUDED.url_pago,
        instrucciones = EXCLUDED.instrucciones,
        activo = EXCLUDED.activo;

  RAISE NOTICE 'FASE 3D.10 seed DEV completado/reutilizado. conjunto_principal=%, conjunto_ajeno=%, residente_same=%, residente_cross=%',
    v_conjunto_principal_id, v_conjunto_ajeno_id, v_residente_same_id, v_residente_cross_id;
END $$;

SELECT 'fase_3d10_seed_ids' AS resultado,
       '11111111-3d10-4000-8000-000000000010'::uuid AS conjunto_ajeno_id,
       '11111111-3d10-4000-8000-000000000013'::uuid AS residente_mismo_conjunto_id,
       '11111111-3d10-4000-8000-000000000023'::uuid AS residente_cross_tenant_id;
