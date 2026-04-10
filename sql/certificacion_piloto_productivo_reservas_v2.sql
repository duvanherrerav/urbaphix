-- Urbaphix | Paquete de queries de certificación final (Piloto productivo)
-- Módulo: Reservas Zonas Comunes v2
-- Ejecutar como postgres / rol técnico con permisos suficientes.

-- =========================================================
-- A. Salud estructural mínima
-- =========================================================

-- A1) Objetos críticos v2 presentes
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

-- A2) Constraint anti-solape presente
select conname as constraint_name, conrelid::regclass as table_name
from pg_constraint
where conname = 'reservas_zonas_no_solape';

-- A3) Políticas RLS registradas en tablas v2
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'recursos_comunes',
    'reservas_zonas',
    'reservas_eventos',
    'reservas_documentos',
    'reservas_bloqueos'
  )
order by tablename, policyname;

-- =========================================================
-- B. Integridad funcional (debe tender a 0 hallazgos)
-- =========================================================

-- B1) Rangos inválidos
select count(*) as rangos_invalidos
from public.reservas_zonas
where fecha_fin <= fecha_inicio;

-- B2) Estados fuera de catálogo
select estado, count(*) as total
from public.reservas_zonas
group by estado
having estado not in ('solicitada','aprobada','rechazada','cancelada','en_curso','finalizada','no_show');

-- B3) Vínculos críticos nulos
select count(*) as registros_con_vinculos_nulos
from public.reservas_zonas
where conjunto_id is null
   or recurso_id is null
   or residente_id is null;

-- B4) Traslapes activos (consulta de control)
with activas as (
  select id, recurso_id, fecha_inicio, fecha_fin
  from public.reservas_zonas
  where estado in ('solicitada','aprobada','en_curso')
)
select count(*) as traslapes_activos
from activas a
join activas b
  on a.recurso_id = b.recurso_id
 and a.id < b.id
 and tsrange(a.fecha_inicio, a.fecha_fin, '[)') && tsrange(b.fecha_inicio, b.fecha_fin, '[)');

-- =========================================================
-- C. Evidencia de operación del piloto
-- =========================================================

-- C1) Conteo por estado en últimos 7 días
select estado, count(*) as total
from public.reservas_zonas
where created_at >= (now() - interval '7 days')
group by estado
order by total desc;

-- C2) Recursos más usados en últimos 7 días
select rc.nombre, rc.tipo, count(*) as total
from public.reservas_zonas rz
join public.recursos_comunes rc on rc.id = rz.recurso_id
where rz.created_at >= (now() - interval '7 days')
group by rc.nombre, rc.tipo
order by total desc
limit 20;

-- C3) Tasa de aprobación (7 días)
with base as (
  select count(*) filter (where estado = 'aprobada') as aprobadas,
         count(*) filter (where estado in ('solicitada','aprobada','rechazada','cancelada','en_curso','finalizada','no_show')) as total
  from public.reservas_zonas
  where created_at >= (now() - interval '7 days')
)
select aprobadas, total,
       case when total = 0 then 0 else round((aprobadas::numeric / total::numeric) * 100, 2) end as tasa_aprobacion_pct
from base;

-- C4) No-show ratio (7 días)
with base as (
  select count(*) filter (where estado = 'no_show') as no_show,
         count(*) filter (where estado in ('aprobada','finalizada','no_show')) as universo
  from public.reservas_zonas
  where created_at >= (now() - interval '7 days')
)
select no_show, universo,
       case when universo = 0 then 0 else round((no_show::numeric / universo::numeric) * 100, 2) end as no_show_pct
from base;

-- =========================================================
-- D. Semáforo GO / NO-GO (query única de decisión rápida)
-- =========================================================
with
rng as (
  select count(*) as c from public.reservas_zonas where fecha_fin <= fecha_inicio
),
estado as (
  select count(*) as c
  from (
    select estado
    from public.reservas_zonas
    group by estado
    having estado not in ('solicitada','aprobada','rechazada','cancelada','en_curso','finalizada','no_show')
  ) x
),
vinc as (
  select count(*) as c
  from public.reservas_zonas
  where conjunto_id is null or recurso_id is null or residente_id is null
),
overlap as (
  with activas as (
    select id, recurso_id, fecha_inicio, fecha_fin
    from public.reservas_zonas
    where estado in ('solicitada','aprobada','en_curso')
  )
  select count(*) as c
  from activas a
  join activas b
    on a.recurso_id = b.recurso_id
   and a.id < b.id
   and tsrange(a.fecha_inicio, a.fecha_fin, '[)') && tsrange(b.fecha_inicio, b.fecha_fin, '[)')
)
select
  rng.c as rangos_invalidos,
  estado.c as estados_invalidos,
  vinc.c as vinculos_nulos,
  overlap.c as traslapes_activos,
  case
    when rng.c = 0 and estado.c = 0 and vinc.c = 0 and overlap.c = 0 then 'GO'
    else 'NO_GO'
  end as decision_final;
