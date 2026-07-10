-- FASE 5.4.1 validation checklist for DEV/QA.
--
-- Objetivo: validar public.fn_tenant_is_operational(uuid,text) sin dejar cambios
-- persistentes. Ejecutar en SQL Editor/psql sobre DEV o QA y revisar que todas
-- las filas marcadas como assertion retornen pass = true.
--
-- Reemplazar si se desea validar un tenant concreto:
--   \set tenant_id '<tenant uuid with tenant_lifecycle row>'

-- 1) Helper exists, is STABLE, SECURITY DEFINER and has secure search_path.
select
  p.proname,
  p.provolatile = 's' as is_stable,
  p.prosecdef as security_definer,
  p.proconfig::text as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'fn_tenant_is_operational'
  and pg_get_function_identity_arguments(p.oid) = 'p_conjunto_id uuid, p_operation text';

-- 2) anon/public have no EXECUTE; authenticated/service_role can execute.
select
  has_function_privilege('anon', 'public.fn_tenant_is_operational(uuid,text)', 'execute') as anon_execute,
  has_function_privilege('public', 'public.fn_tenant_is_operational(uuid,text)', 'execute') as public_execute,
  has_function_privilege('authenticated', 'public.fn_tenant_is_operational(uuid,text)', 'execute') as authenticated_execute,
  has_function_privilege('service_role', 'public.fn_tenant_is_operational(uuid,text)', 'execute') as service_role_execute;

-- 3) No new direct table capabilities for anon/authenticated.
select
  has_table_privilege('anon', 'public.tenant_lifecycle', 'select') as anon_select,
  has_table_privilege('anon', 'public.tenant_lifecycle', 'insert') as anon_insert,
  has_table_privilege('authenticated', 'public.tenant_lifecycle', 'insert') as authenticated_insert,
  has_table_privilege('authenticated', 'public.tenant_lifecycle', 'update') as authenticated_update,
  has_table_privilege('authenticated', 'public.tenant_lifecycle', 'delete') as authenticated_delete;

-- 4) Matrix completa por estado/operacion, incluyendo operational_lock=true
--    incoherente para active/onboarding. Todo ocurre dentro de una transaccion
--    con rollback para no cambiar lifecycle existente.
begin;

do $$
declare
  v_tenant_id uuid;
  v_missing_lifecycle_id uuid := gen_random_uuid();
begin
  select tl.conjunto_id
    into v_tenant_id
  from public.tenant_lifecycle tl
  order by tl.created_at, tl.conjunto_id
  limit 1;

  if v_tenant_id is null then
    raise exception 'tenant_lifecycle fixture required for validation' using errcode = 'P0002';
  end if;

  while exists (select 1 from public.tenant_lifecycle where conjunto_id = v_missing_lifecycle_id) loop
    v_missing_lifecycle_id := gen_random_uuid();
  end loop;

  create temp table fase_5_4_1_results (
    assertion text,
    expected boolean,
    actual boolean,
    pass boolean
  ) on commit drop;

  update public.tenant_lifecycle
  set lifecycle_status = 'active', operational_lock = false
  where conjunto_id = v_tenant_id;

  insert into fase_5_4_1_results values
    ('active tenant_read', true, public.fn_tenant_is_operational(v_tenant_id, 'tenant_read'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_read') is true),
    ('active tenant_mutation unlocked', true, public.fn_tenant_is_operational(v_tenant_id, 'tenant_mutation'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_mutation') is true),
    ('active tenant_terminal_close', true, public.fn_tenant_is_operational(v_tenant_id, 'tenant_terminal_close'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_terminal_close') is true),
    ('active tenant_onboarding_config', false, public.fn_tenant_is_operational(v_tenant_id, 'tenant_onboarding_config'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_onboarding_config') is false),
    ('active platform_read', true, public.fn_tenant_is_operational(v_tenant_id, 'platform_read'), public.fn_tenant_is_operational(v_tenant_id, 'platform_read') is true);

  update public.tenant_lifecycle
  set operational_lock = true
  where conjunto_id = v_tenant_id;

  insert into fase_5_4_1_results values
    ('active tenant_mutation locked', false, public.fn_tenant_is_operational(v_tenant_id, 'tenant_mutation'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_mutation') is false);

  update public.tenant_lifecycle
  set lifecycle_status = 'onboarding', operational_lock = false
  where conjunto_id = v_tenant_id;

  insert into fase_5_4_1_results values
    ('onboarding tenant_read', true, public.fn_tenant_is_operational(v_tenant_id, 'tenant_read'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_read') is true),
    ('onboarding tenant_mutation', false, public.fn_tenant_is_operational(v_tenant_id, 'tenant_mutation'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_mutation') is false),
    ('onboarding tenant_terminal_close', false, public.fn_tenant_is_operational(v_tenant_id, 'tenant_terminal_close'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_terminal_close') is false),
    ('onboarding tenant_onboarding_config unlocked', true, public.fn_tenant_is_operational(v_tenant_id, 'tenant_onboarding_config'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_onboarding_config') is true),
    ('onboarding platform_read', true, public.fn_tenant_is_operational(v_tenant_id, 'platform_read'), public.fn_tenant_is_operational(v_tenant_id, 'platform_read') is true);

  update public.tenant_lifecycle
  set operational_lock = true
  where conjunto_id = v_tenant_id;

  insert into fase_5_4_1_results values
    ('onboarding tenant_onboarding_config locked', false, public.fn_tenant_is_operational(v_tenant_id, 'tenant_onboarding_config'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_onboarding_config') is false);

  update public.tenant_lifecycle
  set lifecycle_status = 'suspended', operational_lock = true
  where conjunto_id = v_tenant_id;

  insert into fase_5_4_1_results values
    ('suspended tenant_read', true, public.fn_tenant_is_operational(v_tenant_id, 'tenant_read'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_read') is true),
    ('suspended tenant_mutation', false, public.fn_tenant_is_operational(v_tenant_id, 'tenant_mutation'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_mutation') is false),
    ('suspended tenant_terminal_close', true, public.fn_tenant_is_operational(v_tenant_id, 'tenant_terminal_close'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_terminal_close') is true),
    ('suspended tenant_onboarding_config', false, public.fn_tenant_is_operational(v_tenant_id, 'tenant_onboarding_config'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_onboarding_config') is false),
    ('suspended platform_read', true, public.fn_tenant_is_operational(v_tenant_id, 'platform_read'), public.fn_tenant_is_operational(v_tenant_id, 'platform_read') is true);

  update public.tenant_lifecycle
  set lifecycle_status = 'archived', operational_lock = true
  where conjunto_id = v_tenant_id;

  insert into fase_5_4_1_results values
    ('archived tenant_read', false, public.fn_tenant_is_operational(v_tenant_id, 'tenant_read'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_read') is false),
    ('archived tenant_mutation', false, public.fn_tenant_is_operational(v_tenant_id, 'tenant_mutation'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_mutation') is false),
    ('archived tenant_terminal_close', false, public.fn_tenant_is_operational(v_tenant_id, 'tenant_terminal_close'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_terminal_close') is false),
    ('archived tenant_onboarding_config', false, public.fn_tenant_is_operational(v_tenant_id, 'tenant_onboarding_config'), public.fn_tenant_is_operational(v_tenant_id, 'tenant_onboarding_config') is false),
    ('archived platform_read', true, public.fn_tenant_is_operational(v_tenant_id, 'platform_read'), public.fn_tenant_is_operational(v_tenant_id, 'platform_read') is true),
    ('missing lifecycle tenant_mutation', false, public.fn_tenant_is_operational(v_missing_lifecycle_id, 'tenant_mutation'), public.fn_tenant_is_operational(v_missing_lifecycle_id, 'tenant_mutation') is false),
    ('missing lifecycle tenant_read', false, public.fn_tenant_is_operational(v_missing_lifecycle_id, 'tenant_read'), public.fn_tenant_is_operational(v_missing_lifecycle_id, 'tenant_read') is false),
    ('missing lifecycle platform_read', true, public.fn_tenant_is_operational(v_missing_lifecycle_id, 'platform_read'), public.fn_tenant_is_operational(v_missing_lifecycle_id, 'platform_read') is true);
end $$;

select * from fase_5_4_1_results order by assertion;
select bool_and(pass) as all_matrix_assertions_pass from fase_5_4_1_results;

rollback;

-- 5) Errores controlados esperados. Ejecutar individualmente; deben fallar.
-- select public.fn_tenant_is_operational(null, 'tenant_mutation');
-- select public.fn_tenant_is_operational(gen_random_uuid(), null);
-- select public.fn_tenant_is_operational(gen_random_uuid(), '');
-- select public.fn_tenant_is_operational(gen_random_uuid(), 'unknown_operation');
