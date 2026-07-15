-- fase 3d.9 - plan read-only de checks negativos rls dev
-- ejecutar solo en supabase dev para generar endpoints y filtros candidatos.
-- no usar esta salida como evidencia efectiva de rls autenticada.

with params as (
  select
    'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid as dev_conjunto_id,
    '565e209b-d7c2-4959-93c1-e2662c925180'::uuid as dev_admin_user_id,
    '02f64392-d964-4bce-a4e9-a25e56621ef6'::uuid as dev_vigilancia_user_id,
    'b46ab33c-9237-4f43-a010-ff95ca1263a6'::uuid as dev_residente_user_id,
    '546c423c-1fa0-4750-b01c-0c24ad89b801'::uuid as dev_residente_id
), otro_residente as (
  select r.id, r.usuario_id, r.conjunto_id
  from public.residentes r
  cross join params p
  where r.id is distinct from p.dev_residente_id
  order by case when r.conjunto_id = p.dev_conjunto_id then 0 else 1 end, r.id
  limit 1
), otro_conjunto as (
  select c.id
  from public.conjuntos c
  cross join params p
  where c.id is distinct from p.dev_conjunto_id
  order by c.id
  limit 1
), plan_base as (
  select 'R-01' as caso, 'residente' as rol, 'residentes' as tabla, 'id' as parametro, (select dev_residente_id::text from params) as valor_propio, (select id::text from otro_residente) as valor_ajeno
  union all select 'R-02', 'residente', 'pagos', 'residente_id', (select dev_residente_id::text from params), (select id::text from otro_residente)
  union all select 'R-03', 'residente', 'paquetes', 'residente_id', (select dev_residente_id::text from params), (select id::text from otro_residente)
  union all select 'R-04', 'residente', 'registro_visitas', 'conjunto_id', (select dev_conjunto_id::text from params), coalesce((select conjunto_id::text from otro_residente where conjunto_id is distinct from (select dev_conjunto_id from params)), (select id::text from otro_conjunto))
  union all select 'R-05', 'residente', 'reservas_zonas', 'residente_id', (select dev_residente_id::text from params), (select id::text from otro_residente)
  union all select 'R-06', 'residente', 'pagos', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'V-01', 'vigilancia', 'registro_visitas', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'V-02', 'vigilancia', 'paquetes', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'V-03', 'vigilancia', 'incidentes', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'V-04', 'vigilancia', 'reservas_zonas', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'V-05', 'vigilancia', 'usuarios_app', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'A-01', 'admin', 'usuarios_app', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'A-02', 'admin', 'residentes', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'A-03', 'admin', 'pagos', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'A-04', 'admin', 'paquetes', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'A-05', 'admin', 'registro_visitas', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'A-06', 'admin', 'incidentes', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'A-07', 'admin', 'reservas_zonas', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
  union all select 'A-08', 'admin', 'config_pagos', 'conjunto_id', (select dev_conjunto_id::text from params), (select id::text from otro_conjunto)
)
select
  caso,
  rol,
  tabla,
  'get' as metodo_http,
  '/rest/v1/' || tabla || '?select=id,' || parametro || '&' || parametro || '=eq.' || coalesce(valor_ajeno, '<sin_candidato>') as endpoint_rest_manipulado,
  parametro as parametro_manipulado,
  valor_propio,
  coalesce(valor_ajeno, '<sin_candidato>') as valor_ajeno,
  case when valor_ajeno is null then 'p2_sin_datos_candidatos' else 'listo_para_ejecucion_autenticada' end as estado_preparacion,
  '200_con_array_vacio_o_403_por_policy' as resultado_aceptable,
  'nunca_debe_retornar_datos_ajenos' as condicion_bloqueante
from plan_base
order by caso;
