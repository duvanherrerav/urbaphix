-- POST-PROD 2C-2D
-- Auditoría readonly de contexto de seguridad para RPC productivas de visitas/portería.
-- Solo SELECT. No aplicar cambios.

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as signature,
  p.prosecdef as security_definer,
  coalesce(
    (select split_part(cfg, '=', 2)
     from unnest(coalesce(p.proconfig, array[]::text[])) as cfg
     where cfg like 'search_path=%'
     limit 1),
    current_setting('search_path')
  ) as search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'fn_crear_o_reutilizar_visitante_y_registro',
    'fn_registrar_ingreso_visita',
    'fn_registrar_salida_visita'
  )
order by p.proname, signature;

select
  r.routine_schema,
  r.routine_name,
  r.specific_name,
  p.grantee,
  p.privilege_type,
  p.is_grantable
from information_schema.routines r
join information_schema.routine_privileges p
  on p.specific_schema = r.specific_schema
 and p.specific_name = r.specific_name
where r.routine_schema = 'public'
  and r.routine_name in (
    'fn_crear_o_reutilizar_visitante_y_registro',
    'fn_registrar_ingreso_visita',
    'fn_registrar_salida_visita'
  )
order by r.routine_name, p.grantee;

select
  r.routine_name,
  bool_or(p.grantee = 'PUBLIC' and p.privilege_type = 'EXECUTE') as public_execute,
  bool_or(p.grantee = 'anon' and p.privilege_type = 'EXECUTE') as anon_execute,
  bool_or(p.grantee = 'authenticated' and p.privilege_type = 'EXECUTE') as authenticated_execute,
  bool_or(p.grantee = 'service_role' and p.privilege_type = 'EXECUTE') as service_role_execute
from information_schema.routines r
left join information_schema.routine_privileges p
  on p.specific_schema = r.specific_schema
 and p.specific_name = r.specific_name
where r.routine_schema = 'public'
  and r.routine_name in (
    'fn_crear_o_reutilizar_visitante_y_registro',
    'fn_registrar_ingreso_visita',
    'fn_registrar_salida_visita'
  )
group by r.routine_name
order by r.routine_name;
