-- FASE 5.2: RPC controlada para transiciones lifecycle SaaS de tenants.
--
-- No abre escrituras directas sobre public.tenant_lifecycle para authenticated.
-- La auditoria se registra en tabla append-only dedicada para evitar forzar
-- source='rpc' sobre public.operational_events, cuyo constraint solo admite
-- 'frontend' y 'edge_function'.

create table if not exists public.tenant_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conjunto_id uuid not null references public.conjuntos(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_platform_role text not null,
  previous_status text not null,
  lifecycle_status text not null,
  reason text null,
  source text not null default 'rpc',
  metadata jsonb not null default '{}'::jsonb,
  constraint tenant_lifecycle_events_actor_role_chk check (
    actor_platform_role in ('superadmin', 'platform_ops')
  ),
  constraint tenant_lifecycle_events_previous_status_chk check (
    previous_status in ('onboarding', 'active', 'suspended', 'archived')
  ),
  constraint tenant_lifecycle_events_lifecycle_status_chk check (
    lifecycle_status in ('onboarding', 'active', 'suspended', 'archived')
  ),
  constraint tenant_lifecycle_events_reason_len_chk check (
    reason is null
    or char_length(reason) between 1 and 280
  ),
  constraint tenant_lifecycle_events_source_chk check (source = 'rpc'),
  constraint tenant_lifecycle_events_metadata_object_chk check (jsonb_typeof(metadata) = 'object')
);

comment on table public.tenant_lifecycle_events is
  'FASE 5.2: bitacora append-only de transiciones tenant_lifecycle ejecutadas por RPC SECURITY DEFINER.';
comment on column public.tenant_lifecycle_events.actor_platform_role is
  'Rol plataforma efectivo usado por la RPC: superadmin o platform_ops.';
comment on column public.tenant_lifecycle_events.metadata is
  'Metadata tecnica sin PII; incluye origen controlado y nombre de funcion.';

create index if not exists tenant_lifecycle_events_conjunto_created_at_idx
  on public.tenant_lifecycle_events (conjunto_id, created_at desc);

create index if not exists tenant_lifecycle_events_actor_created_at_idx
  on public.tenant_lifecycle_events (actor_user_id, created_at desc);

alter table public.tenant_lifecycle_events enable row level security;
alter table public.tenant_lifecycle_events force row level security;

revoke all on table public.tenant_lifecycle_events from anon;
revoke all on table public.tenant_lifecycle_events from authenticated;
grant select on table public.tenant_lifecycle_events to authenticated;
grant all on table public.tenant_lifecycle_events to service_role;

drop policy if exists tenant_lifecycle_events_select_platform on public.tenant_lifecycle_events;
create policy tenant_lifecycle_events_select_platform
on public.tenant_lifecycle_events
for select
to authenticated
using (
  public.fn_is_platform_superadmin()
  or public.fn_has_platform_role('platform_ops')
);

create or replace function public.fn_platform_transition_tenant_lifecycle(
  p_conjunto_id uuid,
  p_target_status text,
  p_reason text default null
)
returns table (
  conjunto_id uuid,
  previous_status text,
  lifecycle_status text,
  operational_lock boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_previous_status text;
  v_reason text := nullif(btrim(p_reason), '');
  v_requires_reason boolean;
begin
  if v_actor_id is null then
    raise exception 'authenticated session required' using errcode = '28000';
  end if;

  if public.fn_is_platform_superadmin() then
    v_actor_role := 'superadmin';
  elsif public.fn_has_platform_role('platform_ops') then
    v_actor_role := 'platform_ops';
  else
    raise exception 'platform role required' using errcode = '42501';
  end if;

  if p_conjunto_id is null then
    raise exception 'conjunto_id is required' using errcode = '22004';
  end if;

  if p_target_status not in ('onboarding', 'active', 'suspended', 'archived') then
    raise exception 'invalid lifecycle target status' using errcode = '22023';
  end if;

  select tl.lifecycle_status
    into v_previous_status
  from public.tenant_lifecycle tl
  where tl.conjunto_id = p_conjunto_id
  for update;

  if not found then
    if exists (select 1 from public.conjuntos c where c.id = p_conjunto_id) then
      raise exception 'tenant_lifecycle row not found for tenant' using errcode = 'P0002';
    end if;

    raise exception 'tenant not found' using errcode = 'P0002';
  end if;

  if v_previous_status = p_target_status then
    raise exception 'lifecycle transition to same status is not allowed' using errcode = '22023';
  end if;

  if v_previous_status = 'archived' then
    raise exception 'archived tenant lifecycle is terminal in this phase' using errcode = '22023';
  end if;

  if not (
    (v_previous_status = 'onboarding' and p_target_status in ('active', 'archived'))
    or (v_previous_status = 'active' and p_target_status = 'suspended')
    or (v_previous_status = 'suspended' and p_target_status in ('active', 'archived'))
    or (v_previous_status = 'active' and p_target_status = 'archived' and v_actor_role = 'superadmin')
  ) then
    raise exception 'lifecycle transition is not allowed' using errcode = '42501';
  end if;

  v_requires_reason := p_target_status in ('suspended', 'archived')
    or (v_previous_status = 'suspended' and p_target_status = 'active');

  if v_requires_reason and v_reason is null then
    raise exception 'reason is required for this lifecycle transition' using errcode = '22004';
  end if;

  if v_reason is not null and char_length(v_reason) > 280 then
    raise exception 'reason exceeds 280 characters' using errcode = '22001';
  end if;

  update public.tenant_lifecycle tl
  set lifecycle_status = p_target_status,
      operational_lock = (p_target_status in ('suspended', 'archived')),
      lock_reason = case
        when p_target_status in ('suspended', 'archived') then v_reason
        else null
      end,
      status_reason = v_reason,
      activated_at = case
        when p_target_status = 'active' then now()
        else tl.activated_at
      end,
      suspended_at = case
        when p_target_status = 'suspended' then now()
        else tl.suspended_at
      end,
      archived_at = case
        when p_target_status = 'archived' then now()
        else tl.archived_at
      end,
      updated_at = now(),
      updated_by = v_actor_id
  where tl.conjunto_id = p_conjunto_id
  returning tl.conjunto_id, v_previous_status, tl.lifecycle_status, tl.operational_lock, tl.updated_at
  into conjunto_id, previous_status, lifecycle_status, operational_lock, updated_at;

  insert into public.tenant_lifecycle_events (
    conjunto_id,
    actor_user_id,
    actor_platform_role,
    previous_status,
    lifecycle_status,
    reason,
    source,
    metadata
  ) values (
    p_conjunto_id,
    v_actor_id,
    v_actor_role,
    v_previous_status,
    p_target_status,
    v_reason,
    'rpc',
    jsonb_build_object('function', 'fn_platform_transition_tenant_lifecycle')
  );

  return next;
end;
$$;

revoke all on function public.fn_platform_transition_tenant_lifecycle(uuid, text, text) from public;
revoke execute on function public.fn_platform_transition_tenant_lifecycle(uuid, text, text) from anon;
grant execute on function public.fn_platform_transition_tenant_lifecycle(uuid, text, text) to authenticated, service_role;
