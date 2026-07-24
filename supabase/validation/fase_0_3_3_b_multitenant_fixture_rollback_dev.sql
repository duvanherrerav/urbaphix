-- FASE 0.3.3-B — Rollback del fixture multitenant DEV
-- Ejecutar únicamente contra Supabase DEV: polstaxmencetxgctvsw
-- NO ejecutar en QA ni PRD.

begin;

delete from public.tenant_memberships
where user_id = 'b46ab33c-9237-4f43-a010-ff95ca1263a6'::uuid
  and conjunto_id = '11111111-3d10-4000-8000-000000000010'::uuid
  and source_legacy = 'fase_0_3_3_b_fixture';

commit;

-- Postcheck esperado: una sola membresía activa para residente.dev@urbaphix.com
select
  ua.email,
  count(*) filter (where tm.status = 'active') as active_memberships,
  jsonb_agg(
    jsonb_build_object(
      'membership_id', tm.id,
      'tenant_id', tm.conjunto_id,
      'tenant_name', c.nombre,
      'role', tm.role_name,
      'status', tm.status,
      'source', tm.source_legacy
    ) order by c.nombre
  ) filter (where tm.status = 'active') as memberships
from public.usuarios_app ua
left join public.tenant_memberships tm on tm.user_id = ua.id
left join public.conjuntos c on c.id = tm.conjunto_id
where ua.email = 'residente.dev@urbaphix.com'
group by ua.email;
