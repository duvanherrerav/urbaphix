-- fase 3d.9 - identificacion read-only de datos candidatos para pruebas negativas rls dev
-- ejecutar solo en supabase dev: polstaxmencetxgctvsw.supabase.co
-- este script no demuestra rls autenticada; sql editor usa un rol privilegiado.
-- no incluir salidas con datos personales en reportes sin saneamiento.

with params as (
  select
    'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid as dev_conjunto_id,
    '565e209b-d7c2-4959-93c1-e2662c925180'::uuid as dev_admin_user_id,
    '02f64392-d964-4bce-a4e9-a25e56621ef6'::uuid as dev_vigilancia_user_id,
    'b46ab33c-9237-4f43-a010-ff95ca1263a6'::uuid as dev_residente_user_id,
    '546c423c-1fa0-4750-b01c-0c24ad89b801'::uuid as dev_residente_id
)
select
  '00_contexto_dev' as seccion,
  dev_conjunto_id,
  dev_admin_user_id,
  dev_vigilancia_user_id,
  dev_residente_user_id,
  dev_residente_id
from params;

with resumen as (
  select 'conjuntos' as tabla, count(*)::bigint as total, count(distinct id)::bigint as conjuntos_distintos from public.conjuntos
  union all select 'residentes', count(*)::bigint, count(distinct conjunto_id)::bigint from public.residentes
  union all select 'usuarios_app', count(*)::bigint, count(distinct conjunto_id)::bigint from public.usuarios_app
  union all select 'pagos', count(*)::bigint, count(distinct conjunto_id)::bigint from public.pagos
  union all select 'paquetes', count(*)::bigint, count(distinct conjunto_id)::bigint from public.paquetes
  union all select 'registro_visitas', count(*)::bigint, count(distinct conjunto_id)::bigint from public.registro_visitas
  union all select 'incidentes', count(*)::bigint, count(distinct conjunto_id)::bigint from public.incidentes
  union all select 'reservas_zonas', count(*)::bigint, count(distinct conjunto_id)::bigint from public.reservas_zonas
  union all select 'config_pagos', count(*)::bigint, count(distinct conjunto_id)::bigint from public.config_pagos
)
select
  '01_resumen_disponibilidad' as seccion,
  tabla,
  total,
  conjuntos_distintos,
  case
    when conjuntos_distintos > 1 then 'apto_cross_tenant'
    when total > 0 then 'solo_un_tenant_visible_en_datos'
    else 'sin_datos'
  end as lectura_preliminar
from resumen
order by tabla;

with params as (
  select
    'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid as dev_conjunto_id,
    '546c423c-1fa0-4750-b01c-0c24ad89b801'::uuid as dev_residente_id
)
select
  '02_residentes_candidatos' as seccion,
  r.id as residente_id,
  r.usuario_id,
  r.conjunto_id,
  case
    when r.id = p.dev_residente_id then 'propio_dev'
    when r.conjunto_id = p.dev_conjunto_id then 'ajeno_mismo_conjunto'
    else 'ajeno_otro_conjunto'
  end as tipo_candidato
from public.residentes r
cross join params p
where r.id = p.dev_residente_id
   or r.conjunto_id = p.dev_conjunto_id
   or r.conjunto_id is distinct from p.dev_conjunto_id
order by tipo_candidato, r.conjunto_id, r.id
limit 50;

with params as (
  select
    'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid as dev_conjunto_id,
    '546c423c-1fa0-4750-b01c-0c24ad89b801'::uuid as dev_residente_id
), candidatos as (
  select 'pagos' as tabla, id as registro_id, conjunto_id, residente_id from public.pagos
  union all select 'paquetes', id, conjunto_id, residente_id from public.paquetes
  union all select 'reservas_zonas', id, conjunto_id, residente_id from public.reservas_zonas
)
select
  '03_candidatos_por_residente' as seccion,
  c.tabla,
  c.registro_id,
  c.conjunto_id,
  c.residente_id,
  case
    when c.residente_id = p.dev_residente_id then 'propio_dev'
    when c.conjunto_id = p.dev_conjunto_id then 'ajeno_mismo_conjunto'
    else 'ajeno_otro_conjunto'
  end as tipo_candidato
from candidatos c
cross join params p
where c.residente_id = p.dev_residente_id
   or c.residente_id is distinct from p.dev_residente_id
order by c.tabla, tipo_candidato, c.registro_id
limit 100;

with params as (
  select
    'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid as dev_conjunto_id,
    '546c423c-1fa0-4750-b01c-0c24ad89b801'::uuid as dev_residente_id
)
select
  '04_visitas_candidatas' as seccion,
  rv.id as registro_visita_id,
  rv.conjunto_id,
  v.residente_id,
  rv.visitante_id,
  case
    when v.residente_id = p.dev_residente_id then 'propio_dev'
    when rv.conjunto_id = p.dev_conjunto_id then 'ajeno_mismo_conjunto'
    else 'ajeno_otro_conjunto'
  end as tipo_candidato
from public.registro_visitas rv
join public.visitantes v on v.id = rv.visitante_id
cross join params p
order by tipo_candidato, rv.conjunto_id, rv.id
limit 100;

with params as (
  select 'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid as dev_conjunto_id
), candidatos as (
  select 'usuarios_app' as tabla, id as registro_id, conjunto_id from public.usuarios_app
  union all select 'incidentes', id, conjunto_id from public.incidentes
  union all select 'config_pagos', id, conjunto_id from public.config_pagos
)
select
  '05_candidatos_por_conjunto' as seccion,
  c.tabla,
  c.registro_id,
  c.conjunto_id,
  case
    when c.conjunto_id = p.dev_conjunto_id then 'propio_conjunto_dev'
    else 'ajeno_otro_conjunto'
  end as tipo_candidato
from candidatos c
cross join params p
order by c.tabla, tipo_candidato, c.registro_id
limit 100;

with params as (
  select
    'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid as dev_conjunto_id,
    '546c423c-1fa0-4750-b01c-0c24ad89b801'::uuid as dev_residente_id
), disponibilidad as (
  select 'conjuntos_multiples' as requisito, (select count(*) from public.conjuntos) > 1 as cumple
  union all select 'residentes_multiples', (select count(*) from public.residentes) > 1
  union all select 'residentes_ajenos_al_dev', exists (select 1 from public.residentes r, params p where r.id is distinct from p.dev_residente_id)
  union all select 'pagos_ajenos', exists (select 1 from public.pagos x, params p where x.residente_id is distinct from p.dev_residente_id or x.conjunto_id is distinct from p.dev_conjunto_id)
  union all select 'paquetes_ajenos', exists (select 1 from public.paquetes x, params p where x.residente_id is distinct from p.dev_residente_id or x.conjunto_id is distinct from p.dev_conjunto_id)
  union all select 'visitas_ajenas', exists (select 1 from public.registro_visitas x, params p where x.conjunto_id is distinct from p.dev_conjunto_id)
  union all select 'incidentes_ajenos', exists (select 1 from public.incidentes x, params p where x.conjunto_id is distinct from p.dev_conjunto_id)
  union all select 'reservas_ajenas', exists (select 1 from public.reservas_zonas x, params p where x.residente_id is distinct from p.dev_residente_id or x.conjunto_id is distinct from p.dev_conjunto_id)
  union all select 'config_pagos_ajena', exists (select 1 from public.config_pagos x, params p where x.conjunto_id is distinct from p.dev_conjunto_id)
)
select
  '06_decision_preparacion' as seccion,
  requisito,
  cumple,
  case when cumple then 'disponible' else 'requiere_seed_dev_controlado_o_no_aplica' end as accion
from disponibilidad
order by requisito;
