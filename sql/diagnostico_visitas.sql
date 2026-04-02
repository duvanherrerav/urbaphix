-- Diagnóstico Urbaphix: tipos_documento + panel vigilancia
-- Ejecutar en Supabase SQL Editor con rol postgres.

-- 1) Verificar catálogo de tipos de documento
select id, codigo, nombre, activo
from public.tipos_documento
order by id;

-- 2) Verificar políticas RLS de tipos_documento (si existen)
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'tipos_documento'
order by policyname;

-- 3) Conteo rápido por conjunto en tablas de visitas
-- Reemplaza :conjunto_id por el UUID/ID real del conjunto.
with params as (
  select ':conjunto_id'::text as conjunto_id
)
select
  (select count(*) from public.residentes r, params p where r.conjunto_id::text = p.conjunto_id) as residentes,
  (select count(*) from public.visitantes v, params p where v.conjunto_id::text = p.conjunto_id) as visitantes_conjunto,
  (select count(*) from public.visitantes v join public.residentes r on r.id = v.residente_id, params p where r.conjunto_id::text = p.conjunto_id) as visitantes_por_residente,
  (select count(*) from public.registro_visitas rv, params p where rv.conjunto_id::text = p.conjunto_id) as registros_por_conjunto;

-- 4) Detectar registros sin visitante_id (rompen enriquecimiento de nombres)
select rv.id, rv.fecha_visita, rv.estado, rv.visitante_id, rv.conjunto_id
from public.registro_visitas rv
where rv.visitante_id is null
order by rv.created_at desc
limit 50;

-- 5) Detectar visitantes huérfanos de residente
select v.id as visitante_id, v.residente_id
from public.visitantes v
left join public.residentes r on r.id = v.residente_id
where r.id is null
limit 50;

-- 6) Ver exactamente qué debería ver vigilancia (vía residente->visitante->registro)
-- Reemplaza :conjunto_id por el valor real.
with params as (
  select ':conjunto_id'::text as conjunto_id
), visitantes_conjunto as (
  select v.id, v.nombre, v.documento, v.placa
  from public.visitantes v
  join public.residentes r on r.id = v.residente_id
  join params p on r.conjunto_id::text = p.conjunto_id
)
select
  rv.id,
  rv.fecha_visita,
  rv.estado,
  rv.hora_ingreso,
  rv.hora_salida,
  vc.nombre as nombre_visitante,
  vc.documento,
  vc.placa
from public.registro_visitas rv
left join visitantes_conjunto vc on vc.id = rv.visitante_id
where vc.id is not null
order by rv.fecha_visita desc, rv.created_at desc
limit 200;

-- 7) Distribución de estados para depurar filtros del panel
-- Reemplaza :conjunto_id por el valor real.
with params as (
  select ':conjunto_id'::text as conjunto_id
)
select lower(trim(rv.estado)) as estado_normalizado, count(*) as total
from public.registro_visitas rv
join public.visitantes v on v.id = rv.visitante_id
join public.residentes r on r.id = v.residente_id
join params p on r.conjunto_id::text = p.conjunto_id
group by lower(trim(rv.estado))
order by total desc;
