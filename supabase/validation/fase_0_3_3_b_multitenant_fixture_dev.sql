-- FASE 0.3.3-B — Fixture E2E multitenant controlado
-- Alcance exclusivo: Supabase DEV
-- Ejecutar manualmente desde Visual Studio Code contra el proyecto DEV.
-- No aplicar en QA ni PRD.

begin;

insert into public.tenant_memberships (
  user_id,
  conjunto_id,
  role_name,
  residente_id,
  status,
  source_legacy
)
select
  'b46ab33c-9237-4f43-a010-ff95ca1263a6'::uuid,
  '11111111-3d10-4000-8000-000000000010'::uuid,
  'residente',
  null,
  'active',
  'fase_0_3_3_b_fixture'
where not exists (
  select 1
  from public.tenant_memberships
  where user_id = 'b46ab33c-9237-4f43-a010-ff95ca1263a6'::uuid
    and conjunto_id = '11111111-3d10-4000-8000-000000000010'::uuid
    and status = 'active'
);

commit;

-- Postcheck
select
  tm.id,
  au.email,
  tm.user_id,
  tm.conjunto_id,
  c.nombre as tenant_name,
  tm.role_name,
  tm.residente_id,
  tm.status,
  tm.source_legacy
from public.tenant_memberships tm
join auth.users au on au.id = tm.user_id
join public.conjuntos c on c.id = tm.conjunto_id
where tm.user_id = 'b46ab33c-9237-4f43-a010-ff95ca1263a6'::uuid
order by tm.created_at;

-- Rollback manual después de las pruebas E2E:
-- delete from public.tenant_memberships
-- where user_id = 'b46ab33c-9237-4f43-a010-ff95ca1263a6'::uuid
--   and conjunto_id = '11111111-3d10-4000-8000-000000000010'::uuid
--   and source_legacy = 'fase_0_3_3_b_fixture';
