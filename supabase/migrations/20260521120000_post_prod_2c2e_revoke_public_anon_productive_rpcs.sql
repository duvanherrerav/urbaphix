-- POST-PROD 2C2E
-- Hardening controlado de RPC productivas:
--   - Mantener EXECUTE para authenticated y service_role
--   - Revocar EXECUTE de PUBLIC y anon
-- Migración drift-safe por firma usando to_regprocedure(...)

DO $$
DECLARE
  v_fn regprocedure;
BEGIN
  v_fn := to_regprocedure('public.fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)');
  IF v_fn IS NOT NULL THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', v_fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_fn);
  END IF;
END
$$;

DO $$
DECLARE
  v_fn regprocedure;
BEGIN
  v_fn := to_regprocedure('public.fn_registrar_ingreso_visita(text,uuid)');
  IF v_fn IS NOT NULL THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', v_fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_fn);
  END IF;
END
$$;

DO $$
DECLARE
  v_fn regprocedure;
BEGIN
  v_fn := to_regprocedure('public.fn_registrar_salida_visita(uuid,uuid)');
  IF v_fn IS NOT NULL THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', v_fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_fn);
  END IF;
END
$$;
