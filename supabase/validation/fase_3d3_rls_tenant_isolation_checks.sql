-- FASE 3D.3 - Aislamiento tenant y acceso cruzado DEV/QA
-- Propósito: detectar riesgos de acceso cruzado con consultas read-only.
-- Ambientes permitidos: DEV y QA. PRD está prohibido salvo autorización explícita posterior.
-- Este archivo contiene únicamente consultas SELECT / WITH SELECT.

-- -----------------------------------------------------------------------------
-- 01. Usuarios con memberships activas en más de un conjunto
-- No siempre es incorrecto, pero requiere clasificación antes de FASE 3D.4.
-- -----------------------------------------------------------------------------
select
  user_id,
  count(distinct conjunto_id) as active_conjuntos_count,
  array_agg(distinct conjunto_id order by conjunto_id) as active_conjunto_ids,
  array_agg(distinct role_name order by role_name) as active_roles
from public.tenant_memberships
where status = 'active'
group by user_id
having count(distinct conjunto_id) > 1
order by active_conjuntos_count desc, user_id;

-- -----------------------------------------------------------------------------
-- 02. usuarios_app.conjunto_id diferente de tenant_memberships.conjunto_id
-- -----------------------------------------------------------------------------
select
  ua.id as user_id,
  ua.conjunto_id as usuarios_app_conjunto_id,
  ua.rol_id as usuarios_app_rol_id,
  ua.activo as usuarios_app_activo,
  tm.id as tenant_membership_id,
  tm.conjunto_id as tenant_membership_conjunto_id,
  tm.role_name,
  tm.status,
  tm.residente_id
from public.usuarios_app ua
join public.tenant_memberships tm
  on tm.user_id = ua.id
where tm.status = 'active'
  and ua.conjunto_id is distinct from tm.conjunto_id
order by ua.id, tm.conjunto_id;

-- -----------------------------------------------------------------------------
-- 03. Residentes cuyo conjunto no coincide con la membership activa
-- -----------------------------------------------------------------------------
select
  tm.id as tenant_membership_id,
  tm.user_id,
  tm.conjunto_id as membership_conjunto_id,
  tm.role_name,
  tm.status,
  tm.residente_id,
  r.conjunto_id as residente_conjunto_id,
  r.usuario_id as residente_usuario_id
from public.tenant_memberships tm
join public.residentes r
  on r.id = tm.residente_id
where tm.status = 'active'
  and (
    r.conjunto_id is distinct from tm.conjunto_id
    or r.usuario_id is distinct from tm.user_id
  )
order by tm.user_id, tm.conjunto_id;

-- -----------------------------------------------------------------------------
-- 04. Datos de tablas sensibles sin conjunto_id cuando deberían tener trazabilidad tenant
-- Revisión de metadata: tablas sin columna conjunto_id directa.
-- -----------------------------------------------------------------------------
with tenant_tracked_tables(table_name) as (
  values
    ('usuarios_app'),
    ('tenant_memberships'),
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
  ttt.table_name,
  c.column_name is not null as has_direct_conjunto_id,
  case
    when ttt.table_name in ('pagos_eventos', 'reservas', 'notificaciones', 'archivos') then 'requiere_trazabilidad_indirecta_o_clasificacion'
    when c.column_name is null then 'riesgo_revisar'
    else 'ok_columna_directa'
  end as interpretation
from tenant_tracked_tables ttt
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = ttt.table_name
 and c.column_name = 'conjunto_id'
order by interpretation desc, ttt.table_name;

-- -----------------------------------------------------------------------------
-- 05. Filas con conjunto_id nulo en tablas sensibles con columna conjunto_id
-- Esperado: 0 en tablas con NOT NULL; revisar legacy nullable.
-- -----------------------------------------------------------------------------
select 'usuarios_app' as table_name, count(*) as null_conjunto_id_rows from public.usuarios_app where conjunto_id is null
union all select 'residentes', count(*) from public.residentes where conjunto_id is null
union all select 'pagos', count(*) from public.pagos where conjunto_id is null
union all select 'registro_visitas', count(*) from public.registro_visitas where conjunto_id is null
union all select 'visitantes', count(*) from public.visitantes where conjunto_id is null
union all select 'paquetes', count(*) from public.paquetes where conjunto_id is null
union all select 'incidentes', count(*) from public.incidentes where conjunto_id is null
union all select 'reservas_zonas', count(*) from public.reservas_zonas where conjunto_id is null
union all select 'reservas_eventos', count(*) from public.reservas_eventos where conjunto_id is null
union all select 'reservas_documentos', count(*) from public.reservas_documentos where conjunto_id is null
union all select 'reservas_bloqueos', count(*) from public.reservas_bloqueos where conjunto_id is null
union all select 'config_pagos', count(*) from public.config_pagos where conjunto_id is null
order by null_conjunto_id_rows desc, table_name;

-- -----------------------------------------------------------------------------
-- 06. Filas huérfanas por FK lógica / trazabilidad indirecta
-- -----------------------------------------------------------------------------
select
  'pagos_residente_missing' as check_name,
  p.id as row_id,
  p.conjunto_id,
  p.residente_id as related_id
from public.pagos p
left join public.residentes r on r.id = p.residente_id
where p.residente_id is not null
  and r.id is null
union all
select
  'pagos_residente_conjunto_mismatch',
  p.id,
  p.conjunto_id,
  p.residente_id
from public.pagos p
join public.residentes r on r.id = p.residente_id
where p.conjunto_id is distinct from r.conjunto_id
union all
select
  'paquetes_residente_missing',
  pq.id,
  pq.conjunto_id,
  pq.residente_id
from public.paquetes pq
left join public.residentes r on r.id = pq.residente_id
where pq.residente_id is not null
  and r.id is null
union all
select
  'paquetes_residente_conjunto_mismatch',
  pq.id,
  pq.conjunto_id,
  pq.residente_id
from public.paquetes pq
join public.residentes r on r.id = pq.residente_id
where pq.conjunto_id is distinct from r.conjunto_id
union all
select
  'visitantes_residente_conjunto_mismatch',
  v.id,
  v.conjunto_id,
  v.residente_id
from public.visitantes v
join public.residentes r on r.id = v.residente_id
where v.conjunto_id is distinct from r.conjunto_id
union all
select
  'registro_visitas_visitante_conjunto_mismatch',
  rv.id,
  rv.conjunto_id,
  rv.visitante_id
from public.registro_visitas rv
join public.visitantes v on v.id = rv.visitante_id
where rv.conjunto_id is distinct from v.conjunto_id
order by check_name, row_id;

-- -----------------------------------------------------------------------------
-- 07. Reservas con trazabilidad cruzada inconsistente
-- -----------------------------------------------------------------------------
select
  'reservas_zonas_residente_conjunto_mismatch' as check_name,
  rz.id as row_id,
  rz.conjunto_id,
  rz.residente_id as related_id
from public.reservas_zonas rz
join public.residentes r on r.id = rz.residente_id
where rz.conjunto_id is distinct from r.conjunto_id
union all
select
  'reservas_eventos_reserva_missing',
  re.id,
  re.conjunto_id,
  re.reserva_id
from public.reservas_eventos re
left join public.reservas_zonas rz on rz.id = re.reserva_id
where rz.id is null
union all
select
  'reservas_eventos_reserva_conjunto_mismatch',
  re.id,
  re.conjunto_id,
  re.reserva_id
from public.reservas_eventos re
join public.reservas_zonas rz on rz.id = re.reserva_id
where re.conjunto_id is distinct from rz.conjunto_id
union all
select
  'reservas_documentos_reserva_missing',
  rd.id,
  rd.conjunto_id,
  rd.reserva_id
from public.reservas_documentos rd
left join public.reservas_zonas rz on rz.id = rd.reserva_id
where rz.id is null
union all
select
  'reservas_documentos_reserva_conjunto_mismatch',
  rd.id,
  rd.conjunto_id,
  rd.reserva_id
from public.reservas_documentos rd
join public.reservas_zonas rz on rz.id = rd.reserva_id
where rd.conjunto_id is distinct from rz.conjunto_id
order by check_name, row_id;

-- -----------------------------------------------------------------------------
-- 08. Memberships activas con roles no compatibles con UI actual
-- UI actual esperada: admin_conjunto, vigilante, residente. Contador/comite requieren clasificación.
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
  and role_name not in ('admin_conjunto', 'vigilante', 'residente')
order by role_name, created_at desc;

-- -----------------------------------------------------------------------------
-- 09. Policies con condiciones potencialmente amplias según pg_policies
-- Revisión manual requerida: no todo match es P0, pero todo match debe quedar clasificado.
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
  p.with_check as with_check_expression,
  case
    when coalesce(p.qual, '') in ('true', '(true)') then 'using_true'
    when coalesce(p.with_check, '') in ('true', '(true)') then 'with_check_true'
    when coalesce(p.qual, '') !~* '(conjunto_id|residente_id|usuario_id|user_id|auth\.uid|fn_auth|fn_has_tenant|fn_is_platform)' then 'sin_filtro_tenant_visible'
    else 'requiere_revision'
  end as risk_signal
from pg_policies p
join sensitive_tables st on st.table_name = p.tablename
where p.schemaname = 'public'
  and (
    coalesce(p.qual, '') in ('true', '(true)')
    or coalesce(p.with_check, '') in ('true', '(true)')
    or coalesce(p.qual, '') !~* '(conjunto_id|residente_id|usuario_id|user_id|auth\.uid|fn_auth|fn_has_tenant|fn_is_platform)'
  )
order by risk_signal, p.tablename, p.policyname;

-- -----------------------------------------------------------------------------
-- 10. Tablas sensibles sin RLS habilitado
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
  st.table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls_enabled
from sensitive_tables st
join pg_namespace n on n.nspname = 'public'
join pg_class c
  on c.relnamespace = n.oid
 and c.relname = st.table_name
 and c.relkind in ('r', 'p')
where c.relrowsecurity is false
order by st.table_name;

-- -----------------------------------------------------------------------------
-- 11. Tablas sensibles con RLS habilitado pero sin policies
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
  st.table_name,
  c.relrowsecurity as rls_enabled,
  count(p.policyname) as policies_count
from sensitive_tables st
join pg_namespace n on n.nspname = 'public'
join pg_class c
  on c.relnamespace = n.oid
 and c.relname = st.table_name
 and c.relkind in ('r', 'p')
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = st.table_name
where c.relrowsecurity is true
group by st.table_name, c.relrowsecurity
having count(p.policyname) = 0
order by st.table_name;

-- -----------------------------------------------------------------------------
-- 12. Policies permissive para anon/authenticated sin filtro visible tenant/residente
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
  p.roles,
  p.cmd,
  p.qual as using_expression,
  p.with_check as with_check_expression
from pg_policies p
join sensitive_tables st on st.table_name = p.tablename
where p.schemaname = 'public'
  and p.permissive = 'PERMISSIVE'
  and (p.roles && array['anon'::name, 'authenticated'::name, 'public'::name])
  and concat_ws(' ', p.qual, p.with_check) !~* '(conjunto_id|residente_id|usuario_id|user_id|auth\.uid|fn_auth|fn_has_tenant|fn_is_platform)'
order by p.tablename, p.policyname;
