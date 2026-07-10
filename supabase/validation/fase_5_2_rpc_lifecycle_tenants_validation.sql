-- FASE 5.2 validation checklist for DEV/QA.
-- Replace the psql variables before running:
--   \set tenant_id '<tenant uuid with tenant_lifecycle row>'
--   \set platform_ops_jwt '<JWT for authenticated platform_ops>'
--   \set superadmin_jwt '<JWT for authenticated superadmin>'
--   \set tenant_user_jwt '<JWT for authenticated tenant user without platform role>'

-- 1) RPC exists, is SECURITY DEFINER and has secure search_path.
select
  p.proname,
  p.prosecdef as security_definer,
  p.proconfig::text as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'fn_platform_transition_tenant_lifecycle';

-- 2) anon/public have no EXECUTE and authenticated/service_role have EXECUTE.
select
  has_function_privilege('anon', 'public.fn_platform_transition_tenant_lifecycle(uuid,text,text)', 'execute') as anon_execute,
  has_function_privilege('public', 'public.fn_platform_transition_tenant_lifecycle(uuid,text,text)', 'execute') as public_execute,
  has_function_privilege('authenticated', 'public.fn_platform_transition_tenant_lifecycle(uuid,text,text)', 'execute') as authenticated_execute,
  has_function_privilege('service_role', 'public.fn_platform_transition_tenant_lifecycle(uuid,text,text)', 'execute') as service_role_execute;

-- 3) Direct client writes remain closed.
select
  has_table_privilege('authenticated', 'public.tenant_lifecycle', 'insert') as authenticated_insert,
  has_table_privilege('authenticated', 'public.tenant_lifecycle', 'update') as authenticated_update,
  has_table_privilege('authenticated', 'public.tenant_lifecycle', 'delete') as authenticated_delete;

-- 4) Tenant user without platform role must fail with platform role required.
-- select set_config('request.jwt.claim.sub', '<tenant-user-uuid>', true);
-- select public.fn_platform_transition_tenant_lifecycle(:'tenant_id'::uuid, 'suspended', 'Validacion negativa tenant normal');

-- 5) Valid transition works and writes audit in same transaction.
begin;
-- select set_config('request.jwt.claim.sub', '<platform-ops-user-uuid>', true);
select * from public.fn_platform_transition_tenant_lifecycle(:'tenant_id'::uuid, 'suspended', 'Validacion FASE 5.2 suspension');
select lifecycle_status, operational_lock, lock_reason, updated_by
from public.tenant_lifecycle
where conjunto_id = :'tenant_id'::uuid;
select previous_status, lifecycle_status, reason, source, metadata
from public.tenant_lifecycle_events
where conjunto_id = :'tenant_id'::uuid
order by created_at desc
limit 1;
rollback;

-- 6) Invalid transition fails without mutation: active -> onboarding is not allowed.
-- select public.fn_platform_transition_tenant_lifecycle(:'tenant_id'::uuid, 'onboarding', 'Debe fallar');

-- 7) Reason required for suspended/reactivated/archived transitions.
-- select public.fn_platform_transition_tenant_lifecycle(:'tenant_id'::uuid, 'suspended', null);

-- 8) platform_ops cannot archive from any state, including the bypass path
-- active -> suspended -> archived. Run with a platform_ops session and a disposable
-- tenant row currently in suspended state; this must fail without mutation.
-- select public.fn_platform_transition_tenant_lifecycle(:'tenant_id'::uuid, 'archived', 'Debe fallar para platform_ops');

-- 9) superadmin can archive from onboarding/active/suspended according to the approved matrix.
-- Run each case with disposable DEV/QA tenants prepared in the corresponding status.
-- select public.fn_platform_transition_tenant_lifecycle(:'tenant_id'::uuid, 'archived', 'Validacion superadmin archive');

-- 10) archived terminal: archived -> active must fail.
-- Prepare a disposable tenant lifecycle row in archived state in DEV/QA, then run:
-- select public.fn_platform_transition_tenant_lifecycle(:'tenant_id'::uuid, 'active', 'Debe fallar por terminal');
