-- Urbaphix | Validación post-despliegue Reservas Zonas v2
-- Ejecutar con rol postgres o usuario técnico con permisos de lectura.

-- 1) Existencia de tablas v2
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'recursos_comunes',
    'reservas_zonas',
    'reservas_eventos',
    'reservas_documentos',
    'reservas_bloqueos'
  )
order by table_name;

-- 2) Verificar constraint anti-solape
select conname as constraint_name, conrelid::regclass as table_name
from pg_constraint
where conname = 'reservas_zonas_no_solape';

-- 3) Conteos por tabla
select 'recursos_comunes' as tabla, count(*) as total from public.recursos_comunes
union all
select 'reservas_zonas' as tabla, count(*) as total from public.reservas_zonas
union all
select 'reservas_eventos' as tabla, count(*) as total from public.reservas_eventos
union all
select 'reservas_documentos' as tabla, count(*) as total from public.reservas_documentos
union all
select 'reservas_bloqueos' as tabla, count(*) as total from public.reservas_bloqueos;

-- 4) Estados fuera de catálogo esperado
select estado, count(*) as total
from public.reservas_zonas
group by estado
having estado not in ('solicitada','aprobada','rechazada','cancelada','en_curso','finalizada','no_show');

-- 5) Rangos inválidos (no deberían existir)
select id, fecha_inicio, fecha_fin
from public.reservas_zonas
where fecha_fin <= fecha_inicio
limit 50;

-- 6) Registros sin vínculo mínimo esperado
select id, conjunto_id, recurso_id, residente_id
from public.reservas_zonas
where conjunto_id is null
   or recurso_id is null
   or residente_id is null
limit 50;

-- 7) Detección de posibles traslapes legacy (solo consulta de seguridad)
with reservas_activas as (
  select id, recurso_id, fecha_inicio, fecha_fin
  from public.reservas_zonas
  where estado in ('solicitada','aprobada','en_curso')
)
select a.id as reserva_a, b.id as reserva_b, a.recurso_id
from reservas_activas a
join reservas_activas b
  on a.recurso_id = b.recurso_id
 and a.id < b.id
 and tsrange(a.fecha_inicio, a.fecha_fin, '[)') && tsrange(b.fecha_inicio, b.fecha_fin, '[)')
limit 50;

-- 8) Calidad de migración desde legacy
-- 8.1 Reservas migradas con observación
select count(*) as migradas_reservas
from public.reservas_zonas
where observaciones ilike '%Migrado desde public.reservas%';

-- 8.2 Trasteos migrados con observación
select count(*) as migradas_trasteos
from public.reservas_zonas
where observaciones ilike '%Migrado desde public.trasteos%';

-- 9) Recursos por conjunto/tipo
select conjunto_id, tipo, count(*) as total
from public.recursos_comunes
group by conjunto_id, tipo
order by conjunto_id, tipo;
