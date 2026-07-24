-- FASE 0.3.3-B — Fixture temporal para validar TENANT_OPERATIONALLY_LOCKED
-- Ejecutar exclusivamente contra Supabase DEV: polstaxmencetxgctvsw
-- No ejecutar en QA ni PRD.
--
-- Este script bloquea temporalmente DEV-RLS-NEGATIVE-TENANT, conserva sus
-- valores previos en la misma transacción y deja un rollback explícito al final.

begin;

-- Precheck: debe existir exactamente un tenant lifecycle objetivo.
do $$
begin
  if not exists (
    select 1
    from public.tenant_lifecycle
    where conjunto_id = '11111111-3d10-4000-8000-000000000010'::uuid
  ) then
    raise exception 'DEV operational-lock fixture target tenant lifecycle not found';
  end if;
end
$$;

update public.tenant_lifecycle
set
  operational_lock = true,
  lock_reason = 'FASE 0.3.3-B E2E operational lock fixture',
  status_reason = 'Temporal DEV-only validation for TENANT_OPERATIONALLY_LOCKED',
  updated_at = now()
where conjunto_id = '11111111-3d10-4000-8000-000000000010'::uuid;

commit;

-- Postcheck esperado: operational_lock=true.
select
  conjunto_id,
  lifecycle_status,
  license_status,
  operational_lock,
  lock_reason,
  status_reason
from public.tenant_lifecycle
where conjunto_id = '11111111-3d10-4000-8000-000000000010'::uuid;

-- ROLLBACK MANUAL OBLIGATORIO después de capturar la evidencia E2E:
--
-- begin;
-- update public.tenant_lifecycle
-- set
--   operational_lock = false,
--   lock_reason = null,
--   status_reason = 'prueba reactivar conjunto',
--   updated_at = now()
-- where conjunto_id = '11111111-3d10-4000-8000-000000000010'::uuid;
-- commit;
--
-- select conjunto_id, lifecycle_status, license_status, operational_lock,
--        lock_reason, status_reason
-- from public.tenant_lifecycle
-- where conjunto_id = '11111111-3d10-4000-8000-000000000010'::uuid;
