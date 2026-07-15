-- FASE 5.1: lifecycle SaaS de tenants.
--
-- Crea una tabla complementaria 1:1 para estado operativo/licenciamiento de tenants
-- sin modificar public.conjuntos ni abrir CRUD frontend.

create table if not exists public.tenant_lifecycle (
  conjunto_id uuid primary key references public.conjuntos(id) on delete cascade,
  lifecycle_status text not null default 'onboarding',
  license_status text null default 'active',
  plan_code text null default 'standard',
  operational_lock boolean not null default false,
  lock_reason text null,
  status_reason text null,
  activated_at timestamptz null,
  suspended_at timestamptz null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint tenant_lifecycle_status_chk check (
    lifecycle_status in ('onboarding', 'active', 'suspended', 'archived')
  ),
  constraint tenant_lifecycle_license_status_chk check (
    license_status is null
    or license_status in ('trial', 'active', 'suspended', 'expired', 'canceled')
  ),
  constraint tenant_lifecycle_plan_code_len_chk check (
    plan_code is null
    or char_length(plan_code) between 2 and 64
  ),
  constraint tenant_lifecycle_lock_reason_len_chk check (
    lock_reason is null
    or char_length(lock_reason) between 1 and 280
  ),
  constraint tenant_lifecycle_status_reason_len_chk check (
    status_reason is null
    or char_length(status_reason) between 1 and 280
  )
);

comment on table public.tenant_lifecycle is
  'FASE 5.1: estado lifecycle/licencia/operational lock 1:1 por conjunto; sin CRUD frontend.';
comment on column public.tenant_lifecycle.conjunto_id is
  'PK y FK 1:1 hacia public.conjuntos.id.';
comment on column public.tenant_lifecycle.lifecycle_status is
  'Estado SaaS permitido: onboarding, active, suspended, archived.';
comment on column public.tenant_lifecycle.license_status is
  'Estado de licencia permitido: trial, active, suspended, expired, canceled; nullable para fases posteriores.';
comment on column public.tenant_lifecycle.operational_lock is
  'Bloqueo operativo global del tenant; no se consume por frontend en FASE 5.1.';

create index if not exists tenant_lifecycle_status_idx
  on public.tenant_lifecycle (lifecycle_status);

create index if not exists tenant_lifecycle_license_status_idx
  on public.tenant_lifecycle (license_status)
  where license_status is not null;

alter table public.tenant_lifecycle enable row level security;
alter table public.tenant_lifecycle force row level security;

revoke all on table public.tenant_lifecycle from anon;
revoke all on table public.tenant_lifecycle from authenticated;
grant select on table public.tenant_lifecycle to authenticated;
grant all on table public.tenant_lifecycle to service_role;

drop policy if exists tenant_lifecycle_select_platform on public.tenant_lifecycle;
create policy tenant_lifecycle_select_platform
on public.tenant_lifecycle
for select
to authenticated
using (
  public.fn_is_platform_superadmin()
  or public.fn_has_platform_role('platform_ops')
);

-- No se crean policies INSERT/UPDATE/DELETE para authenticated: las mutaciones quedan
-- reservadas para backend/service_role o RPC controlada en FASE 5.2.

insert into public.tenant_lifecycle (
  conjunto_id,
  lifecycle_status,
  license_status,
  plan_code,
  activated_at,
  status_reason
)
select
  c.id,
  'active',
  'active',
  'standard',
  now(),
  'Backfill FASE 5.1 para conjuntos existentes en DEV'
from public.conjuntos c
where not exists (
  select 1
  from public.tenant_lifecycle tl
  where tl.conjunto_id = c.id
);
