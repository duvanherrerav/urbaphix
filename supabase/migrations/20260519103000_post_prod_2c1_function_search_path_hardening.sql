-- POST-PROD-2C-1: hardening pasivo de search_path en funciones public.
-- Alcance: solo ajustar metadata de funciones existentes (sin cambios de lógica, grants, RLS ni datos).

DO $$
BEGIN
  IF to_regprocedure('public.fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)') IS NOT NULL THEN
    ALTER FUNCTION public.fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.fn_registrar_ingreso_visita(text,uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.fn_registrar_ingreso_visita(text,uuid)
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.fn_registrar_salida_visita(uuid,uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.fn_registrar_salida_visita(uuid,uuid)
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.fn_auth_residente_id()') IS NOT NULL THEN
    ALTER FUNCTION public.fn_auth_residente_id()
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.fn_auth_conjunto_id()') IS NOT NULL THEN
    ALTER FUNCTION public.fn_auth_conjunto_id()
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.fn_auth_rol()') IS NOT NULL THEN
    ALTER FUNCTION public.fn_auth_rol()
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.set_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.set_updated_at()
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    ALTER FUNCTION public.handle_new_user()
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.get_user_conjunto_id()') IS NOT NULL THEN
    ALTER FUNCTION public.get_user_conjunto_id()
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.get_user_residente_id()') IS NOT NULL THEN
    ALTER FUNCTION public.get_user_residente_id()
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.get_user_role()') IS NOT NULL THEN
    ALTER FUNCTION public.get_user_role()
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.is_admin()') IS NOT NULL THEN
    ALTER FUNCTION public.is_admin()
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.is_residente()') IS NOT NULL THEN
    ALTER FUNCTION public.is_residente()
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.is_vigilancia()') IS NOT NULL THEN
    ALTER FUNCTION public.is_vigilancia()
    SET search_path = public, auth;
  END IF;

  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    ALTER FUNCTION public.rls_auto_enable()
    SET search_path = public, auth;
  END IF;
END
$$;
