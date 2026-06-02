-- FASE 3D.3 - Validación efectiva de acceso por rol DEV/QA
-- Propósito: ejecutar consultas read-only como usuarios autenticados de prueba.
-- Ambientes permitidos: DEV y QA. PRD está prohibido salvo autorización explícita posterior.
-- Este archivo contiene únicamente consultas SELECT / WITH SELECT.
--
-- Cómo usar:
-- 1) Ejecutar autenticado con un usuario real de prueba cuando sea posible.
-- 2) Reemplazar placeholders en el CTE params por IDs del dataset DEV/QA.
-- 3) Ejecutar el mismo bloque para roles admin_conjunto, vigilancia/vigilante y residente.
-- 4) Interpretar 0 filas con cuidado: puede ser correcto si no hay datos, pero debe compararse
--    contra el inventario y el dataset esperado del ambiente.
--
-- Placeholders requeridos:
-- - 00000000-0000-0000-0000-000000000001: user_id autenticado de prueba.
-- - 00000000-0000-0000-0000-000000000002: conjunto_id esperado.
-- - 00000000-0000-0000-0000-000000000003: residente_id esperado, si aplica.

-- -----------------------------------------------------------------------------
-- 00. Contexto auth y resolución legacy/membership
-- -----------------------------------------------------------------------------
with params as (
  select
    '00000000-0000-0000-0000-000000000001'::uuid as expected_user_id,
    '00000000-0000-0000-0000-000000000002'::uuid as expected_conjunto_id,
    '00000000-0000-0000-0000-000000000003'::uuid as expected_residente_id
)
select
  auth.uid() as auth_uid,
  p.expected_user_id,
  auth.uid() = p.expected_user_id as auth_matches_expected_user,
  public.fn_auth_conjunto_id() as legacy_conjunto_id,
  p.expected_conjunto_id,
  public.fn_auth_conjunto_id() = p.expected_conjunto_id as legacy_conjunto_matches_expected,
  public.fn_auth_rol() as legacy_rol,
  public.fn_auth_residente_id() as legacy_residente_id,
  p.expected_residente_id,
  public.fn_auth_residente_id() = p.expected_residente_id as legacy_residente_matches_expected
from params p;

with params as (
  select
    '00000000-0000-0000-0000-000000000001'::uuid as expected_user_id,
    '00000000-0000-0000-0000-000000000002'::uuid as expected_conjunto_id,
    '00000000-0000-0000-0000-000000000003'::uuid as expected_residente_id
)
select
  tm.id,
  tm.user_id,
  tm.conjunto_id,
  tm.role_name,
  tm.status,
  tm.residente_id,
  tm.source_legacy,
  tm.user_id = p.expected_user_id as matches_expected_user,
  tm.conjunto_id = p.expected_conjunto_id as matches_expected_conjunto,
  tm.residente_id is not distinct from p.expected_residente_id as matches_expected_residente
from public.tenant_memberships tm
cross join params p
where tm.user_id = auth.uid()
order by tm.status, tm.role_name, tm.conjunto_id;

-- -----------------------------------------------------------------------------
-- 01. Dashboard Admin
-- Depende de usuarios_app para policies legacy y tenant_memberships para checks futuros.
-- Para admin_conjunto: conteos del conjunto esperado deben ser consistentes con inventario DEV/QA.
-- Para vigilancia/residente: validar si el acceso observado coincide con el alcance permitido actual.
-- -----------------------------------------------------------------------------
with params as (
  select '00000000-0000-0000-0000-000000000002'::uuid as expected_conjunto_id
)
select 'residentes' as module_table, count(*) as visible_rows
from public.residentes r, params p
where r.conjunto_id = p.expected_conjunto_id
union all
select 'pagos', count(*)
from public.pagos pg, params p
where pg.conjunto_id = p.expected_conjunto_id
union all
select 'incidentes', count(*)
from public.incidentes i, params p
where i.conjunto_id = p.expected_conjunto_id
union all
select 'reservas_zonas', count(*)
from public.reservas_zonas rz, params p
where rz.conjunto_id = p.expected_conjunto_id
union all
select 'paquetes', count(*)
from public.paquetes pq, params p
where pq.conjunto_id = p.expected_conjunto_id
union all
select 'registro_visitas', count(*)
from public.registro_visitas rv, params p
where rv.conjunto_id = p.expected_conjunto_id;

-- -----------------------------------------------------------------------------
-- 01B. Exposición visible agrupada por tenant real
-- Complementa los checks filtrados: si una policy permite filas de otros conjuntos,
-- este bloque las marca como sospechosas sin ocultarlas por expected_conjunto_id.
-- Aplicar con cada rol de prueba autenticado.
-- -----------------------------------------------------------------------------
with params as (
  select '00000000-0000-0000-0000-000000000002'::uuid as expected_conjunto_id
), visible_by_tenant as (
  select 'usuarios_app' as source_table, ua.conjunto_id, count(*) as visible_rows
  from public.usuarios_app ua
  group by ua.conjunto_id
  union all
  select 'tenant_memberships', tm.conjunto_id, count(*)
  from public.tenant_memberships tm
  group by tm.conjunto_id
  union all
  select 'residentes', r.conjunto_id, count(*)
  from public.residentes r
  group by r.conjunto_id
  union all
  select 'pagos', pgo.conjunto_id, count(*)
  from public.pagos pgo
  group by pgo.conjunto_id
  union all
  select 'pagos_eventos', pe.conjunto_id, count(*)
  from public.pagos_eventos pe
  group by pe.conjunto_id
  union all
  select 'registro_visitas', rv.conjunto_id, count(*)
  from public.registro_visitas rv
  group by rv.conjunto_id
  union all
  select 'visitantes', v.conjunto_id, count(*)
  from public.visitantes v
  group by v.conjunto_id
  union all
  select 'paquetes', pq.conjunto_id, count(*)
  from public.paquetes pq
  group by pq.conjunto_id
  union all
  select 'incidentes', i.conjunto_id, count(*)
  from public.incidentes i
  group by i.conjunto_id
  union all
  select 'reservas_zonas', rz.conjunto_id, count(*)
  from public.reservas_zonas rz
  group by rz.conjunto_id
  union all
  select 'reservas_eventos', re.conjunto_id, count(*)
  from public.reservas_eventos re
  group by re.conjunto_id
  union all
  select 'reservas_documentos', rd.conjunto_id, count(*)
  from public.reservas_documentos rd
  group by rd.conjunto_id
  union all
  select 'reservas_bloqueos', rb.conjunto_id, count(*)
  from public.reservas_bloqueos rb
  group by rb.conjunto_id
  union all
  select 'config_pagos', cp.conjunto_id, count(*)
  from public.config_pagos cp
  group by cp.conjunto_id
)
select
  vbt.source_table,
  vbt.conjunto_id as visible_conjunto_id,
  p.expected_conjunto_id,
  vbt.visible_rows,
  case
    when vbt.conjunto_id is null then 'sospechoso_conjunto_null'
    when vbt.conjunto_id <> p.expected_conjunto_id then 'sospechoso_otro_conjunto_visible'
    else 'esperado_conjunto_actual'
  end as tenant_visibility_status
from visible_by_tenant vbt
cross join params p
order by
  case
    when vbt.conjunto_id is null then 0
    when vbt.conjunto_id <> p.expected_conjunto_id then 1
    else 2
  end,
  vbt.source_table,
  vbt.conjunto_id;

-- -----------------------------------------------------------------------------
-- 02. Pagos / Crear cobro / Mis pagos
-- Admin_conjunto: pagos del conjunto y residentes elegibles para crear cobro.
-- Residente: pagos propios por residente_id. 0 filas puede ser correcto si no hay cartera.
-- -----------------------------------------------------------------------------
with params as (
  select
    '00000000-0000-0000-0000-000000000002'::uuid as expected_conjunto_id,
    '00000000-0000-0000-0000-000000000003'::uuid as expected_residente_id
)
select
  'pagos_admin_conjunto' as check_name,
  count(*) as visible_rows
from public.pagos pgo
join params p on pgo.conjunto_id = p.expected_conjunto_id
union all
select
  'crear_cobro_residentes_elegibles',
  count(*)
from public.residentes r
join params p on r.conjunto_id = p.expected_conjunto_id
union all
select
  'mis_pagos_residente',
  count(*)
from public.pagos pgo
join params p on pgo.residente_id = p.expected_residente_id;

select
  pgo.id,
  pgo.conjunto_id,
  pgo.residente_id,
  pgo.concepto,
  pgo.valor,
  pgo.estado,
  pgo.tipo_pago,
  pgo.fecha_pago,
  pgo.created_at
from public.pagos pgo
where pgo.residente_id = '00000000-0000-0000-0000-000000000003'::uuid
order by pgo.created_at desc
limit 25;

-- -----------------------------------------------------------------------------
-- 03. Pagos eventos
-- Admin_conjunto: eventos de pagos del conjunto. Residente: eventos de pagos propios.
-- Depende de public.pagos para validar conjunto_id/residente_id lógico del evento.
-- -----------------------------------------------------------------------------
with params as (
  select
    '00000000-0000-0000-0000-000000000002'::uuid as expected_conjunto_id,
    '00000000-0000-0000-0000-000000000003'::uuid as expected_residente_id
)
select
  'pagos_eventos_admin_conjunto' as check_name,
  count(*) as visible_rows
from public.pagos_eventos pe
join public.pagos pgo on pgo.id = pe.pago_id
join params p on pgo.conjunto_id = p.expected_conjunto_id
union all
select
  'pagos_eventos_residente_propios',
  count(*)
from public.pagos_eventos pe
join public.pagos pgo on pgo.id = pe.pago_id
join params p on pgo.residente_id = p.expected_residente_id;

-- -----------------------------------------------------------------------------
-- 04. Incidentes / Reportar incidente
-- Admin_conjunto y vigilancia: incidentes del conjunto. Residente/reportante: propios según policy actual.
-- -----------------------------------------------------------------------------
with params as (
  select
    '00000000-0000-0000-0000-000000000001'::uuid as expected_user_id,
    '00000000-0000-0000-0000-000000000002'::uuid as expected_conjunto_id
)
select
  'incidentes_conjunto' as check_name,
  count(*) as visible_rows
from public.incidentes i
join params p on i.conjunto_id = p.expected_conjunto_id
union all
select
  'reportar_incidente_propios_por_usuario',
  count(*)
from public.incidentes i
join params p on i.reportado_por = p.expected_user_id;

-- -----------------------------------------------------------------------------
-- 05. Reservas Admin / Reservas Residente
-- Reservas legacy dependen de zonas_comunes; reservas_zonas usa conjunto_id/residente_id.
-- -----------------------------------------------------------------------------
with params as (
  select
    '00000000-0000-0000-0000-000000000002'::uuid as expected_conjunto_id,
    '00000000-0000-0000-0000-000000000003'::uuid as expected_residente_id
)
select
  'reservas_zonas_admin_conjunto' as check_name,
  count(*) as visible_rows
from public.reservas_zonas rz
join params p on rz.conjunto_id = p.expected_conjunto_id
union all
select
  'reservas_zonas_residente_propias',
  count(*)
from public.reservas_zonas rz
join params p on rz.residente_id = p.expected_residente_id
union all
select
  'reservas_legacy_por_zona_conjunto',
  count(*)
from public.reservas r
join public.zonas_comunes zc on zc.id = r.zona_id
join params p on zc.conjunto_id = p.expected_conjunto_id;

-- -----------------------------------------------------------------------------
-- 06. Reservas eventos/documentos/bloqueos
-- Admin_conjunto: objetos del conjunto. Residente: validar contra reservas_zonas propias cuando aplique.
-- -----------------------------------------------------------------------------
with params as (
  select
    '00000000-0000-0000-0000-000000000002'::uuid as expected_conjunto_id,
    '00000000-0000-0000-0000-000000000003'::uuid as expected_residente_id
)
select 'reservas_eventos_conjunto' as check_name, count(*) as visible_rows
from public.reservas_eventos re
join params p on re.conjunto_id = p.expected_conjunto_id
union all
select 'reservas_documentos_conjunto', count(*)
from public.reservas_documentos rd
join params p on rd.conjunto_id = p.expected_conjunto_id
union all
select 'reservas_bloqueos_conjunto', count(*)
from public.reservas_bloqueos rb
join params p on rb.conjunto_id = p.expected_conjunto_id
union all
select 'reservas_documentos_residente_propias', count(*)
from public.reservas_documentos rd
join public.reservas_zonas rz on rz.id = rd.reserva_id
join params p on rz.residente_id = p.expected_residente_id;

-- -----------------------------------------------------------------------------
-- 07. Control de visitas / vigilancia y Solicitar visita / residente
-- Vigilancia/admin: visitas del conjunto. Residente: visitantes y visitas propios.
-- -----------------------------------------------------------------------------
with params as (
  select
    '00000000-0000-0000-0000-000000000002'::uuid as expected_conjunto_id,
    '00000000-0000-0000-0000-000000000003'::uuid as expected_residente_id
)
select 'registro_visitas_conjunto' as check_name, count(*) as visible_rows
from public.registro_visitas rv
join params p on rv.conjunto_id = p.expected_conjunto_id
union all
select 'visitantes_conjunto', count(*)
from public.visitantes v
join params p on v.conjunto_id = p.expected_conjunto_id
union all
select 'solicitar_visita_visitantes_propios', count(*)
from public.visitantes v
join params p on v.residente_id = p.expected_residente_id
union all
select 'solicitar_visita_registros_propios', count(*)
from public.registro_visitas rv
join public.visitantes v on v.id = rv.visitante_id
join params p on v.residente_id = p.expected_residente_id;

-- -----------------------------------------------------------------------------
-- 08. Paquetería vigilancia/admin y Mis paquetes residente
-- -----------------------------------------------------------------------------
with params as (
  select
    '00000000-0000-0000-0000-000000000002'::uuid as expected_conjunto_id,
    '00000000-0000-0000-0000-000000000003'::uuid as expected_residente_id
)
select 'paquetes_conjunto' as check_name, count(*) as visible_rows
from public.paquetes pq
join params p on pq.conjunto_id = p.expected_conjunto_id
union all
select 'mis_paquetes_residente', count(*)
from public.paquetes pq
join params p on pq.residente_id = p.expected_residente_id;

-- -----------------------------------------------------------------------------
-- 09. Notificaciones
-- Usuario autenticado: solo usuario_id = auth.uid().
-- -----------------------------------------------------------------------------
with params as (
  select '00000000-0000-0000-0000-000000000001'::uuid as expected_user_id
)
select
  'notificaciones_usuario' as check_name,
  count(*) as visible_rows
from public.notificaciones n
join params p on n.usuario_id = p.expected_user_id;

select
  id,
  usuario_id,
  tipo,
  titulo,
  leido,
  created_at
from public.notificaciones
where usuario_id = '00000000-0000-0000-0000-000000000001'::uuid
order by created_at desc
limit 25;

-- -----------------------------------------------------------------------------
-- 10. Config pagos
-- Policy actual legacy permite lectura amplia; validar si se observan otros conjuntos.
-- -----------------------------------------------------------------------------
with params as (
  select '00000000-0000-0000-0000-000000000002'::uuid as expected_conjunto_id
)
select
  cp.conjunto_id,
  count(*) as visible_config_rows,
  bool_or(cp.conjunto_id <> p.expected_conjunto_id) as includes_other_conjunto
from public.config_pagos cp
cross join params p
group by cp.conjunto_id
order by includes_other_conjunto desc, cp.conjunto_id;

-- -----------------------------------------------------------------------------
-- 11. Archivos/documentos
-- archivos no tiene conjunto_id en el esquema actual; validar exposición efectiva por modulo.
-- -----------------------------------------------------------------------------
select
  modulo,
  count(*) as visible_archivos
from public.archivos
group by modulo
order by visible_archivos desc, modulo;
