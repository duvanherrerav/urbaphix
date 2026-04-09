-- Backfill de apartamento_id en paquetes a partir del residente asociado.
-- Ejecutar como postgres en Supabase SQL Editor.

begin;

-- 1) Diagnóstico previo
select
  count(*) as paquetes_sin_apto,
  count(*) filter (where residente_id is not null) as sin_apto_con_residente
from public.paquetes
where apartamento_id is null;

-- 2) Backfill principal
update public.paquetes p
set apartamento_id = r.apartamento_id
from public.residentes r
where p.apartamento_id is null
  and p.residente_id = r.id
  and r.apartamento_id is not null;

-- 3) Verificación posterior
select
  count(*) as paquetes_sin_apto_despues
from public.paquetes
where apartamento_id is null;

commit;
