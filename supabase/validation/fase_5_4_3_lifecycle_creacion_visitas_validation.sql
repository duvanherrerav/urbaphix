-- FASE 5.4.3 validation DEV.
-- Ejecutar como una única sentencia en Supabase SQL Editor/psql con rol privilegiado sobre DEV.
-- No depende de tablas temporales ni de sesión compartida entre sentencias.
-- Cada assertion falla con RAISE EXCEPTION; si todo pasa emite:
-- NOTICE: FASE_5_4_3_ALL_ASSERTIONS_PASS

do $$
declare
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_user_legacy uuid := gen_random_uuid();
  v_tenant_a uuid := gen_random_uuid();
  v_tenant_b uuid := gen_random_uuid();
  v_tenant_legacy uuid := gen_random_uuid();
  v_apt_a uuid := gen_random_uuid();
  v_apt_b uuid := gen_random_uuid();
  v_apt_legacy uuid := gen_random_uuid();
  v_res_a uuid := gen_random_uuid();
  v_res_b uuid := gen_random_uuid();
  v_res_legacy uuid := gen_random_uuid();
  v_result record;
  v_result_2 record;
  v_err text;
  v_before_visitantes bigint;
  v_before_registros bigint;
  v_after_visitantes bigint;
  v_after_registros bigint;
  v_signature_ok boolean;
  v_grants_ok boolean;
  v_role_residente_existed boolean;
  v_tipo_documento_cc_existed boolean;
  v_cleanup_error text;
begin
  begin
    insert into auth.users (id, aud, role, email, created_at, updated_at)
    values
      (v_user_a, 'authenticated', 'authenticated', 'fase543-a@example.invalid', now(), now()),
      (v_user_b, 'authenticated', 'authenticated', 'fase543-b@example.invalid', now(), now()),
      (v_user_legacy, 'authenticated', 'authenticated', 'fase543-legacy@example.invalid', now(), now());

    select exists (
      select 1
      from public.roles
      where id = 'residente'
    ) into v_role_residente_existed;

    select exists (
      select 1
      from public.tipos_documento
      where codigo = 'CC'
    ) into v_tipo_documento_cc_existed;

    insert into public.roles (id, nombre)
    values ('residente', 'Residente')
    on conflict (id) do nothing;

    insert into public.tipos_documento (codigo, nombre)
    values ('CC', 'Cédula')
    on conflict (codigo) do nothing;

    insert into public.conjuntos (id, nombre, direccion, ciudad)
    values
      (v_tenant_a, 'FASE 5.4.3 Tenant A', 'DEV', 'DEV'),
      (v_tenant_b, 'FASE 5.4.3 Tenant B', 'DEV', 'DEV'),
      (v_tenant_legacy, 'FASE 5.4.3 Tenant Legacy', 'DEV', 'DEV');

    insert into public.tenant_lifecycle (conjunto_id, lifecycle_status, license_status, plan_code, operational_lock, activated_at)
    values
      (v_tenant_a, 'active', 'active', 'standard', false, now()),
      (v_tenant_b, 'active', 'active', 'standard', false, now()),
      (v_tenant_legacy, 'active', 'active', 'standard', false, now());

    insert into public.apartamentos (id, conjunto_id, numero, created_at)
    values
      (v_apt_a, v_tenant_a, '543-A', now()),
      (v_apt_b, v_tenant_b, '543-B', now()),
      (v_apt_legacy, v_tenant_legacy, '543-L', now());

    insert into public.usuarios_app (id, conjunto_id, rol_id, nombre, email, activo)
    values
      (v_user_a, v_tenant_a, 'residente', 'Fase 543 A', 'fase543-a@example.invalid', true),
      (v_user_b, v_tenant_b, 'residente', 'Fase 543 B', 'fase543-b@example.invalid', true),
      (v_user_legacy, v_tenant_legacy, 'residente', 'Fase 543 Legacy', 'fase543-legacy@example.invalid', true);

    insert into public.residentes (id, usuario_id, conjunto_id, apartamento_id)
    values
      (v_res_a, v_user_a, v_tenant_a, v_apt_a),
      (v_res_b, v_user_b, v_tenant_b, v_apt_b),
      (v_res_legacy, v_user_legacy, v_tenant_legacy, v_apt_legacy);

    insert into public.tenant_memberships (user_id, conjunto_id, role_name, residente_id, status)
    values
      (v_user_a, v_tenant_a, 'residente', v_res_a, 'active'),
      (v_user_b, v_tenant_b, 'residente', v_res_b, 'active');

    perform set_config('request.jwt.claim.sub', '', true);
    begin
      perform *
      from public.fn_crear_o_reutilizar_visitante_y_registro(
        v_tenant_a, v_res_a, v_apt_a, 'Sin sesión', 'CC', '543000', null, null, current_date
      );
      raise exception 'ASSERTION_FAILED: 1 sin sesión -> AUTH_REQUIRED no falló';
    exception when others then
      v_err := sqlerrm;
      if v_err <> 'AUTH_REQUIRED' then
        raise exception 'ASSERTION_FAILED: 1 sin sesión esperaba AUTH_REQUIRED y recibió %', v_err;
      end if;
    end;

    perform set_config('request.jwt.claim.sub', v_user_a::text, true);
    select * into v_result
    from public.fn_crear_o_reutilizar_visitante_y_registro(
      v_tenant_a, v_res_a, v_apt_a, 'Visitante A', 'CC', '543001', null, null, current_date
    );
    if v_result.visitante_id is null or v_result.registro_id is null or v_result.qr_code is null then
      raise exception 'ASSERTION_FAILED: 2 residente same-tenant activo -> éxito retornó %', v_result;
    end if;

    begin
      perform *
      from public.fn_crear_o_reutilizar_visitante_y_registro(
        v_tenant_b, v_res_b, v_apt_b, 'Otro residente', 'CC', '543002', null, null, current_date
      );
      raise exception 'ASSERTION_FAILED: 3 p_residente_id de otro usuario -> rechazo no falló';
    exception when others then
      v_err := sqlerrm;
      if v_err <> 'FORBIDDEN' then
        raise exception 'ASSERTION_FAILED: 3 p_residente_id de otro usuario esperaba FORBIDDEN y recibió %', v_err;
      end if;
    end;

    begin
      perform *
      from public.fn_crear_o_reutilizar_visitante_y_registro(
        v_tenant_b, v_res_a, v_apt_a, 'Cross tenant', 'CC', '543003', null, null, current_date
      );
      raise exception 'ASSERTION_FAILED: 4 p_conjunto_id cross-tenant -> rechazo no falló';
    exception when others then
      v_err := sqlerrm;
      if v_err <> 'FORBIDDEN' then
        raise exception 'ASSERTION_FAILED: 4 p_conjunto_id cross-tenant esperaba FORBIDDEN y recibió %', v_err;
      end if;
    end;

    begin
      perform *
      from public.fn_crear_o_reutilizar_visitante_y_registro(
        v_tenant_a, v_res_a, v_apt_b, 'Apartamento ajeno', 'CC', '543004', null, null, current_date
      );
      raise exception 'ASSERTION_FAILED: 5 p_apartamento_id ajeno/cross-tenant -> rechazo no falló';
    exception when others then
      v_err := sqlerrm;
      if v_err <> 'FORBIDDEN' then
        raise exception 'ASSERTION_FAILED: 5 p_apartamento_id ajeno/cross-tenant esperaba FORBIDDEN y recibió %', v_err;
      end if;
    end;

    update public.tenant_memberships
    set status = 'suspended', updated_at = now()
    where user_id = v_user_a
      and conjunto_id = v_tenant_a
      and residente_id = v_res_a
      and role_name = 'residente';

    begin
      perform *
      from public.fn_crear_o_reutilizar_visitante_y_registro(
        v_tenant_a, v_res_a, v_apt_a, 'Membership suspendida', 'CC', '543004A', null, null, current_date
      );
      raise exception 'ASSERTION_FAILED: 5a membership no activa + legacy presente -> FORBIDDEN no falló';
    exception when others then
      v_err := sqlerrm;
      if v_err <> 'FORBIDDEN' then
        raise exception 'ASSERTION_FAILED: 5a membership no activa + legacy presente esperaba FORBIDDEN y recibió %', v_err;
      end if;
    end;

    perform set_config('request.jwt.claim.sub', v_user_legacy::text, true);
    select * into v_result
    from public.fn_crear_o_reutilizar_visitante_y_registro(
      v_tenant_legacy, v_res_legacy, v_apt_legacy, 'Legacy permitido', 'CC', '543004B', null, null, current_date
    );
    if v_result.visitante_id is null or v_result.registro_id is null then
      raise exception 'ASSERTION_FAILED: 5b sin membership + legacy válido -> permitido retornó %', v_result;
    end if;

    perform set_config('request.jwt.claim.sub', v_user_a::text, true);
    update public.tenant_memberships
    set status = 'active', updated_at = now()
    where user_id = v_user_a
      and conjunto_id = v_tenant_a
      and residente_id = v_res_a
      and role_name = 'residente';

    select count(*) into v_before_visitantes from public.visitantes where conjunto_id = v_tenant_a;
    select count(*) into v_before_registros from public.registro_visitas where conjunto_id = v_tenant_a;
    update public.tenant_lifecycle set lifecycle_status = 'suspended', operational_lock = true where conjunto_id = v_tenant_a;
    begin
      perform *
      from public.fn_crear_o_reutilizar_visitante_y_registro(
        v_tenant_a, v_res_a, v_apt_a, 'Suspendido', 'CC', '543005', null, null, current_date
      );
      raise exception 'ASSERTION_FAILED: 6 tenant suspended -> TENANT_OPERATIONAL_LOCKED no falló';
    exception when others then
      v_err := sqlerrm;
      select count(*) into v_after_visitantes from public.visitantes where conjunto_id = v_tenant_a;
      select count(*) into v_after_registros from public.registro_visitas where conjunto_id = v_tenant_a;
      if v_err <> 'TENANT_OPERATIONAL_LOCKED'
        or v_after_visitantes <> v_before_visitantes
        or v_after_registros <> v_before_registros then
        raise exception 'ASSERTION_FAILED: 6 tenant suspended esperaba lock y cero parciales; err=%, visitantes %->%, registros %->%',
          v_err, v_before_visitantes, v_after_visitantes, v_before_registros, v_after_registros;
      end if;
    end;

    update public.tenant_lifecycle set lifecycle_status = 'active', operational_lock = true where conjunto_id = v_tenant_a;
    begin
      perform *
      from public.fn_crear_o_reutilizar_visitante_y_registro(
        v_tenant_a, v_res_a, v_apt_a, 'Locked', 'CC', '543006', null, null, current_date
      );
      raise exception 'ASSERTION_FAILED: 7 active lock=true -> bloqueado sin parciales no falló';
    exception when others then
      v_err := sqlerrm;
      select count(*) into v_after_visitantes from public.visitantes where conjunto_id = v_tenant_a;
      select count(*) into v_after_registros from public.registro_visitas where conjunto_id = v_tenant_a;
      if v_err <> 'TENANT_OPERATIONAL_LOCKED'
        or v_after_visitantes <> v_before_visitantes
        or v_after_registros <> v_before_registros then
        raise exception 'ASSERTION_FAILED: 7 active lock=true esperaba lock y cero parciales; err=%, visitantes %->%, registros %->%',
          v_err, v_before_visitantes, v_after_visitantes, v_before_registros, v_after_registros;
      end if;
    end;

    update public.tenant_lifecycle set lifecycle_status = 'active', operational_lock = false where conjunto_id = v_tenant_a;
    select * into v_result
    from public.fn_crear_o_reutilizar_visitante_y_registro(
      v_tenant_a, v_res_a, v_apt_a, 'Reutiliza 1', 'CC', '543007', null, null, current_date
    );
    select * into v_result_2
    from public.fn_crear_o_reutilizar_visitante_y_registro(
      v_tenant_a, v_res_a, v_apt_a, 'Reutiliza 2', 'CC', '543007', null, null, current_date
    );
    if v_result.visitante_id is distinct from v_result_2.visitante_id
      or v_result.registro_id is null
      or v_result_2.registro_id is null
      or v_result.registro_id = v_result_2.registro_id
      or not exists (
        select 1
        from public.registro_visitas rv
        where rv.id = v_result_2.registro_id
          and rv.estado = 'pendiente'
      ) then
      raise exception 'ASSERTION_FAILED: 8 active sin lock -> reutiliza visitante y crea registro pendiente retornó % / %', v_result, v_result_2;
    end if;

    select
      has_function_privilege('public', 'public.fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)', 'execute') is false
      and has_function_privilege('anon', 'public.fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)', 'execute') is false
      and has_function_privilege('authenticated', 'public.fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)', 'execute') is true
      and has_function_privilege('service_role', 'public.fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)', 'execute') is true
    into v_grants_ok;
    if not v_grants_ok then
      raise exception 'ASSERTION_FAILED: 9 grants finales no coinciden';
    end if;

    select exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'fn_crear_o_reutilizar_visitante_y_registro'
        and pg_get_function_identity_arguments(p.oid) = 'p_conjunto_id uuid, p_residente_id uuid, p_apartamento_id uuid, p_nombre text, p_tipo_documento text, p_documento text, p_tipo_vehiculo text, p_placa text, p_fecha_visita date'
        and pg_get_function_result(p.oid) = 'TABLE(visitante_id uuid, registro_id uuid, qr_code text)'
        and p.prosecdef is true
        and p.proconfig @> array['search_path=public, pg_temp']
    ) into v_signature_ok;
    if not v_signature_ok then
      raise exception 'ASSERTION_FAILED: 10 firma y shape sin cambios no coinciden';
    end if;

    delete from public.registro_visitas
    where conjunto_id in (v_tenant_a, v_tenant_b, v_tenant_legacy);
    delete from public.visitantes
    where conjunto_id in (v_tenant_a, v_tenant_b, v_tenant_legacy);
    delete from public.tenant_memberships
    where user_id in (v_user_a, v_user_b, v_user_legacy)
       or conjunto_id in (v_tenant_a, v_tenant_b, v_tenant_legacy)
       or residente_id in (v_res_a, v_res_b, v_res_legacy);
    delete from public.residentes
    where id in (v_res_a, v_res_b, v_res_legacy);
    delete from public.usuarios_app
    where id in (v_user_a, v_user_b, v_user_legacy);
    delete from public.apartamentos
    where id in (v_apt_a, v_apt_b, v_apt_legacy);
    delete from public.tenant_lifecycle
    where conjunto_id in (v_tenant_a, v_tenant_b, v_tenant_legacy);
    delete from public.conjuntos
    where id in (v_tenant_a, v_tenant_b, v_tenant_legacy);
    delete from auth.users
    where id in (v_user_a, v_user_b, v_user_legacy);
    delete from public.tipos_documento
    where codigo = 'CC'
      and v_tipo_documento_cc_existed is false;
    delete from public.roles
    where id = 'residente'
      and v_role_residente_existed is false;

    raise notice 'FASE_5_4_3_ALL_ASSERTIONS_PASS';
  exception when others then
    v_err := sqlerrm;
    begin
      delete from public.registro_visitas
      where conjunto_id in (v_tenant_a, v_tenant_b, v_tenant_legacy);
      delete from public.visitantes
      where conjunto_id in (v_tenant_a, v_tenant_b, v_tenant_legacy);
      delete from public.tenant_memberships
      where user_id in (v_user_a, v_user_b, v_user_legacy)
         or conjunto_id in (v_tenant_a, v_tenant_b, v_tenant_legacy)
         or residente_id in (v_res_a, v_res_b, v_res_legacy);
      delete from public.residentes
      where id in (v_res_a, v_res_b, v_res_legacy);
      delete from public.usuarios_app
      where id in (v_user_a, v_user_b, v_user_legacy);
      delete from public.apartamentos
      where id in (v_apt_a, v_apt_b, v_apt_legacy);
      delete from public.tenant_lifecycle
      where conjunto_id in (v_tenant_a, v_tenant_b, v_tenant_legacy);
      delete from public.conjuntos
      where id in (v_tenant_a, v_tenant_b, v_tenant_legacy);
      delete from auth.users
      where id in (v_user_a, v_user_b, v_user_legacy);
      delete from public.tipos_documento
      where codigo = 'CC'
        and v_tipo_documento_cc_existed is false;
      delete from public.roles
      where id = 'residente'
        and v_role_residente_existed is false;
    exception when others then
      v_cleanup_error := sqlerrm;
      raise exception '%; además falló limpieza: %', v_err, v_cleanup_error;
    end;
    raise exception '%', v_err;
  end;
end $$;
