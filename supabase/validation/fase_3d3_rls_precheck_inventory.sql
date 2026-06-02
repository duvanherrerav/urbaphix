-- FASE 3D.3 - Inventario RLS y helpers DEV/QA
-- Propósito: diagnóstico read-only previo a hardening RLS.
-- Ambientes permitidos: DEV y QA.
-- Ambiente prohibido: PRD salvo autorización explícita posterior.
-- Ejecución sugerida: correr sección por sección y guardar resultados.
-- Este archivo contiene únicamente consultas SELECT / WITH SELECT.

-- -----------------------------------------------------------------------------
-- 00. Contexto de conexión
-- -----------------------------------------------------------------------------
select
  current_database() as database_name,
  current_user as current_user_name,
  session_user as session_user_name,
  current_schema() as current_schema_name,
  now() as executed_at;

select
  auth.uid() as auth_uid,
  public.fn_auth_conjunto_id() as legacy_auth_conjunto_id,
  public.fn_auth_rol() as legacy_auth_rol,
  public.fn_auth_residente_id() as legacy_auth_residente_id;

-- -----------------------------------------------------------------------------
-- 01. Tablas sensibles esperadas y estado RLS/FORCE RLS
-- -----------------------------------------------------------------------------
with sensitive_tables(table_name) as (
  values
    ('usuarios_app'),
    ('tenant_memberships'),
    ('platform_memberships'),
    ('conjuntos'),
    ('residentes'),
    ('pagos'),
    ('pagos_eventos'),
    ('registro_visitas'),
    ('visitantes'),
    ('paquetes'),
    ('incidentes'),
    ('reservas'),
    ('reservas_zonas'),
    ('reservas_eventos'),
    ('reservas_documentos'),
    ('reservas_bloqueos'),
    ('notificaciones'),
    ('archivos'),
    ('config_pagos')
)
select
  st.table_name,
  c.oid is not null as table_exists,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  coalesce(c.relforcerowsecurity, false) as force_rls_enabled,
  obj_description(c.oid, 'pg_class') as table_comment
from sensitive_tables st
left join pg_namespace n
  on n.nspname = 'public'
left join pg_class c
  on c.relnamespace = n.oid
 and c.relname = st.table_name
 and c.relkind in ('r', 'p')
order by st.table_name;

-- -----------------------------------------------------------------------------
-- 02. Policies existentes por tabla sensible
-- Interpretación: revisar roles, comando, modo permissive/restrictive, USING y WITH CHECK.
-- -----------------------------------------------------------------------------
with sensitive_tables(table_name) as (
  values
    ('usuarios_app'), ('tenant_memberships'), ('platform_memberships'), ('conjuntos'),
    ('residentes'), ('pagos'), ('pagos_eventos'), ('registro_visitas'),
    ('visitantes'), ('paquetes'), ('incidentes'), ('reservas'), ('reservas_zonas'),
    ('reservas_eventos'), ('reservas_documentos'), ('reservas_bloqueos'),
    ('notificaciones'), ('archivos'), ('config_pagos')
)
select
  p.schemaname,
  p.tablename,
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual as using_expression,
  p.with_check as with_check_expression
from pg_policies p
join sensitive_tables st
  on st.table_name = p.tablename
where p.schemaname = 'public'
order by p.tablename, p.policyname;

-- -----------------------------------------------------------------------------
-- 03. Funciones helper legacy y tenant-aware existentes
-- -----------------------------------------------------------------------------
with expected_helpers(function_name, category) as (
  values
    ('fn_auth_conjunto_id', 'legacy'),
    ('fn_auth_rol', 'legacy'),
    ('fn_auth_residente_id', 'legacy'),
    ('fn_is_platform_superadmin', 'tenant_aware'),
    ('fn_has_platform_role', 'tenant_aware'),
    ('fn_has_tenant_access', 'tenant_aware'),
    ('fn_has_tenant_role', 'tenant_aware')
)
select
  eh.category,
  eh.function_name,
  p.oid is not null as function_exists,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  l.lanname as language_name,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig as function_config
from expected_helpers eh
left join pg_namespace n
  on n.nspname = 'public'
left join pg_proc p
  on p.pronamespace = n.oid
 and p.proname = eh.function_name
left join pg_language l
  on l.oid = p.prolang
order by eh.category, eh.function_name, identity_arguments;

-- -----------------------------------------------------------------------------
-- 04. Grants EXECUTE de funciones relevantes
-- -----------------------------------------------------------------------------
with expected_helpers(function_name) as (
  values
    ('fn_auth_conjunto_id'),
    ('fn_auth_rol'),
    ('fn_auth_residente_id'),
    ('fn_is_platform_superadmin'),
    ('fn_has_platform_role'),
    ('fn_has_tenant_access'),
    ('fn_has_tenant_role')
)
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  r.rolname as grantee,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as has_execute
from expected_helpers eh
join pg_namespace n
  on n.nspname = 'public'
join pg_proc p
  on p.pronamespace = n.oid
 and p.proname = eh.function_name
cross join pg_roles r
where r.rolname in ('anon', 'authenticated', 'service_role', 'public')
order by p.proname, identity_arguments, r.rolname;

-- -----------------------------------------------------------------------------
-- 05. Columnas clave por tabla sensible
-- -----------------------------------------------------------------------------
with sensitive_tables(table_name) as (
  values
    ('usuarios_app'), ('tenant_memberships'), ('platform_memberships'), ('conjuntos'),
    ('residentes'), ('pagos'), ('pagos_eventos'), ('registro_visitas'),
    ('visitantes'), ('paquetes'), ('incidentes'), ('reservas'), ('reservas_zonas'),
    ('reservas_eventos'), ('reservas_documentos'), ('reservas_bloqueos'),
    ('notificaciones'), ('archivos'), ('config_pagos')
), key_columns(column_name) as (
  values
    ('conjunto_id'),
    ('residente_id'),
    ('usuario_id'),
    ('user_id'),
    ('created_by'),
    ('admin_id'),
    ('status'),
    ('estado'),
    ('rol_id'),
    ('role_name'),
    ('reportado_por'),
    ('recibido_por'),
    ('validado_por'),
    ('subido_por'),
    ('actor_id')
)
select
  st.table_name,
  kc.column_name,
  c.column_name is not null as column_exists,
  c.data_type,
  c.is_nullable,
  c.column_default
from sensitive_tables st
cross join key_columns kc
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = st.table_name
 and c.column_name = kc.column_name
where c.column_name is not null
order by st.table_name, kc.column_name;

-- -----------------------------------------------------------------------------
-- 06. Conteos por tabla sensible
-- Nota: si una tabla no existe en DEV/QA, esta sección fallará; validar antes con sección 01.
-- -----------------------------------------------------------------------------
select 'usuarios_app' as table_name, count(*) as row_count from public.usuarios_app
union all select 'tenant_memberships', count(*) from public.tenant_memberships
union all select 'platform_memberships', count(*) from public.platform_memberships
union all select 'conjuntos', count(*) from public.conjuntos
union all select 'residentes', count(*) from public.residentes
union all select 'pagos', count(*) from public.pagos
union all select 'pagos_eventos', count(*) from public.pagos_eventos
union all select 'registro_visitas', count(*) from public.registro_visitas
union all select 'visitantes', count(*) from public.visitantes
union all select 'paquetes', count(*) from public.paquetes
union all select 'incidentes', count(*) from public.incidentes
union all select 'reservas', count(*) from public.reservas
union all select 'reservas_zonas', count(*) from public.reservas_zonas
union all select 'reservas_eventos', count(*) from public.reservas_eventos
union all select 'reservas_documentos', count(*) from public.reservas_documentos
union all select 'reservas_bloqueos', count(*) from public.reservas_bloqueos
union all select 'notificaciones', count(*) from public.notificaciones
union all select 'archivos', count(*) from public.archivos
union all select 'config_pagos', count(*) from public.config_pagos
order by table_name;

-- -----------------------------------------------------------------------------
-- 07. Conteos tenant_memberships por status y role_name
-- -----------------------------------------------------------------------------
select
  status,
  role_name,
  count(*) as memberships_count
from public.tenant_memberships
group by status, role_name
order by status, role_name;

-- -----------------------------------------------------------------------------
-- 08. Duplicados activos por user_id/conjunto_id
-- Esperado: 0 filas por índice único ux_tenant_memberships_user_conjunto_active.
-- -----------------------------------------------------------------------------
select
  user_id,
  conjunto_id,
  count(*) as active_memberships_count,
  array_agg(id order by created_at) as membership_ids
from public.tenant_memberships
where status = 'active'
group by user_id, conjunto_id
having count(*) > 1
order by active_memberships_count desc, user_id, conjunto_id;

-- -----------------------------------------------------------------------------
-- 09. Residentes con membership residente sin residente_id
-- Esperado: 0 filas para usuarios residentes de prueba activos.
-- -----------------------------------------------------------------------------
select
  id,
  user_id,
  conjunto_id,
  role_name,
  status,
  residente_id,
  created_at
from public.tenant_memberships
where status = 'active'
  and role_name = 'residente'
  and residente_id is null
order by created_at desc;

-- -----------------------------------------------------------------------------
-- 10. usuarios_app vs tenant_memberships comparativo general
-- -----------------------------------------------------------------------------
select
  coalesce(ua.id, tm.user_id) as user_id,
  ua.conjunto_id as usuarios_app_conjunto_id,
  ua.rol_id as usuarios_app_rol_id,
  ua.activo as usuarios_app_activo,
  tm.conjunto_id as tenant_membership_conjunto_id,
  tm.role_name as tenant_membership_role_name,
  tm.status as tenant_membership_status,
  tm.residente_id as tenant_membership_residente_id,
  case
    when ua.id is null then 'solo_tenant_memberships'
    when tm.user_id is null then 'solo_usuarios_app'
    when ua.conjunto_id is distinct from tm.conjunto_id then 'conjunto_mismatch'
    when ua.activo is false and tm.status = 'active' then 'legacy_inactive_membership_active'
    else 'comparativo_ok_o_requiere_revision_role_mapping'
  end as comparison_status
from public.usuarios_app ua
full outer join public.tenant_memberships tm
  on tm.user_id = ua.id
order by comparison_status, user_id;
