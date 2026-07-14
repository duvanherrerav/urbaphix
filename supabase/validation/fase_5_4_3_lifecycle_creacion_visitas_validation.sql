-- FASE 5.4.3 validation DEV.
-- Ejecutar en SQL Editor/psql con rol privilegiado sobre DEV. Todo queda en ROLLBACK.

begin;

create temp table fase_5_4_3_results (
  assertion text primary key,
  pass boolean not null,
  detail text null
) on commit drop;

do $$
declare
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_tenant_a uuid := gen_random_uuid();
  v_tenant_b uuid := gen_random_uuid();
  v_apt_a uuid := gen_random_uuid();
  v_apt_b uuid := gen_random_uuid();
  v_res_a uuid := gen_random_uuid();
  v_res_b uuid := gen_random_uuid();
  v_visitante_count_before bigint;
  v_registro_count_before bigint;
  v_visitante_count_after bigint;
  v_registro_count_after bigint;
  v_result record;
  v_result_2 record;
  v_err text;
  v_returns_ok boolean;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at)
  values
    (v_user_a, 'authenticated', 'authenticated', 'fase543-a@example.invalid', now(), now()),
    (v_user_b, 'authenticated', 'authenticated', 'fase543-b@example.invalid', now(), now());

  insert into public.roles (id, nombre) values ('residente', 'Residente') on conflict (id) do nothing;
  insert into public.tipos_documento (codigo, nombre) values ('CC', 'Cédula') on conflict (codigo) do nothing;

  insert into public.conjuntos (id, nombre, direccion, ciudad)
  values
    (v_tenant_a, 'FASE 5.4.3 Tenant A', 'DEV', 'DEV'),
    (v_tenant_b, 'FASE 5.4.3 Tenant B', 'DEV', 'DEV');

  insert into public.tenant_lifecycle (conjunto_id, lifecycle_status, license_status, plan_code, operational_lock, activated_at)
  values
    (v_tenant_a, 'active', 'active', 'standard', false, now()),
    (v_tenant_b, 'active', 'active', 'standard', false, now());

  insert into public.apartamentos (id, conjunto_id, numero, created_at)
  values
    (v_apt_a, v_tenant_a, '543-A', now()),
    (v_apt_b, v_tenant_b, '543-B', now());

  insert into public.usuarios_app (id, conjunto_id, rol_id, nombre, email, activo)
  values
    (v_user_a, v_tenant_a, 'residente', 'Fase 543 A', 'fase543-a@example.invalid', true),
    (v_user_b, v_tenant_b, 'residente', 'Fase 543 B', 'fase543-b@example.invalid', true);

  insert into public.residentes (id, usuario_id, conjunto_id, apartamento_id)
  values
    (v_res_a, v_user_a, v_tenant_a, v_apt_a),
    (v_res_b, v_user_b, v_tenant_b, v_apt_b);

  insert into public.tenant_memberships (user_id, conjunto_id, role_name, residente_id, status)
  values
    (v_user_a, v_tenant_a, 'residente', v_res_a, 'active'),
    (v_user_b, v_tenant_b, 'residente', v_res_b, 'active');


  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform * from public.fn_crear_o_reutilizar_visitante_y_registro(v_tenant_a, v_res_a, v_apt_a, 'Sin sesión', 'CC', '543000', null, null, current_date);
    insert into fase_5_4_3_results values ('1 sin sesión -> AUTH_REQUIRED', false, 'no falló');
  exception when others then
    insert into fase_5_4_3_results values ('1 sin sesión -> AUTH_REQUIRED', sqlerrm = 'AUTH_REQUIRED', sqlerrm);
  end;

  perform set_config('request.jwt.claim.sub', v_user_a::text, true);
  select * into v_result from public.fn_crear_o_reutilizar_visitante_y_registro(v_tenant_a, v_res_a, v_apt_a, 'Visitante A', 'CC', '543001', null, null, current_date);
  insert into fase_5_4_3_results values ('2 residente same-tenant activo -> éxito', v_result.visitante_id is not null and v_result.registro_id is not null and v_result.qr_code is not null, v_result::text);

  begin
    perform * from public.fn_crear_o_reutilizar_visitante_y_registro(v_tenant_b, v_res_b, v_apt_b, 'Otro residente', 'CC', '543002', null, null, current_date);
    insert into fase_5_4_3_results values ('3 p_residente_id de otro usuario -> rechazo', false, 'no falló');
  exception when others then
    insert into fase_5_4_3_results values ('3 p_residente_id de otro usuario -> rechazo', sqlerrm = 'FORBIDDEN', sqlerrm);
  end;

  begin
    perform * from public.fn_crear_o_reutilizar_visitante_y_registro(v_tenant_b, v_res_a, v_apt_a, 'Cross tenant', 'CC', '543003', null, null, current_date);
    insert into fase_5_4_3_results values ('4 p_conjunto_id cross-tenant -> rechazo', false, 'no falló');
  exception when others then
    insert into fase_5_4_3_results values ('4 p_conjunto_id cross-tenant -> rechazo', sqlerrm = 'FORBIDDEN', sqlerrm);
  end;

  begin
    perform * from public.fn_crear_o_reutilizar_visitante_y_registro(v_tenant_a, v_res_a, v_apt_b, 'Apartamento ajeno', 'CC', '543004', null, null, current_date);
    insert into fase_5_4_3_results values ('5 p_apartamento_id ajeno/cross-tenant -> rechazo', false, 'no falló');
  exception when others then
    insert into fase_5_4_3_results values ('5 p_apartamento_id ajeno/cross-tenant -> rechazo', sqlerrm = 'FORBIDDEN', sqlerrm);
  end;

  select count(*) into v_visitante_count_before from public.visitantes where conjunto_id = v_tenant_a;
  select count(*) into v_registro_count_before from public.registro_visitas where conjunto_id = v_tenant_a;
  update public.tenant_lifecycle set lifecycle_status = 'suspended', operational_lock = true where conjunto_id = v_tenant_a;
  begin
    perform * from public.fn_crear_o_reutilizar_visitante_y_registro(v_tenant_a, v_res_a, v_apt_a, 'Suspendido', 'CC', '543005', null, null, current_date);
    insert into fase_5_4_3_results values ('6 tenant suspended -> TENANT_OPERATIONAL_LOCKED', false, 'no falló');
  exception when others then
    select count(*) into v_visitante_count_after from public.visitantes where conjunto_id = v_tenant_a;
    select count(*) into v_registro_count_after from public.registro_visitas where conjunto_id = v_tenant_a;
    insert into fase_5_4_3_results values ('6 tenant suspended -> TENANT_OPERATIONAL_LOCKED', sqlerrm = 'TENANT_OPERATIONAL_LOCKED' and v_visitante_count_after = v_visitante_count_before and v_registro_count_after = v_registro_count_before, sqlerrm);
  end;

  update public.tenant_lifecycle set lifecycle_status = 'active', operational_lock = true where conjunto_id = v_tenant_a;
  begin
    perform * from public.fn_crear_o_reutilizar_visitante_y_registro(v_tenant_a, v_res_a, v_apt_a, 'Locked', 'CC', '543006', null, null, current_date);
    insert into fase_5_4_3_results values ('7 active lock=true -> bloqueado sin parciales', false, 'no falló');
  exception when others then
    select count(*) into v_visitante_count_after from public.visitantes where conjunto_id = v_tenant_a;
    select count(*) into v_registro_count_after from public.registro_visitas where conjunto_id = v_tenant_a;
    insert into fase_5_4_3_results values ('7 active lock=true -> bloqueado sin parciales', sqlerrm = 'TENANT_OPERATIONAL_LOCKED' and v_visitante_count_after = v_visitante_count_before and v_registro_count_after = v_registro_count_before, sqlerrm);
  end;

  update public.tenant_lifecycle set lifecycle_status = 'active', operational_lock = false where conjunto_id = v_tenant_a;
  select * into v_result from public.fn_crear_o_reutilizar_visitante_y_registro(v_tenant_a, v_res_a, v_apt_a, 'Reutiliza 1', 'CC', '543007', null, null, current_date);
  select * into v_result_2 from public.fn_crear_o_reutilizar_visitante_y_registro(v_tenant_a, v_res_a, v_apt_a, 'Reutiliza 2', 'CC', '543007', null, null, current_date);
  insert into fase_5_4_3_results values ('8 active sin lock -> reutiliza visitante y crea registro pendiente',
    v_result.visitante_id = v_result_2.visitante_id
    and v_result.registro_id <> v_result_2.registro_id
    and exists (select 1 from public.registro_visitas rv where rv.id = v_result_2.registro_id and rv.estado = 'pendiente'),
    v_result::text || ' / ' || v_result_2::text);

  insert into fase_5_4_3_results values ('9 grants finales',
    has_function_privilege('public', 'public.fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)', 'execute') is false
    and has_function_privilege('anon', 'public.fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)', 'execute') is false
    and has_function_privilege('authenticated', 'public.fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)', 'execute') is true
    and has_function_privilege('service_role', 'public.fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)', 'execute') is true,
    null);

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
  ) into v_returns_ok;
  insert into fase_5_4_3_results values ('10 firma y shape sin cambios', v_returns_ok, null);
end $$;

select * from fase_5_4_3_results order by assertion;

rollback;
