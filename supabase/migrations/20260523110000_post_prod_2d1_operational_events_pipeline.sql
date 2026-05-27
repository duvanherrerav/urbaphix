begin;

create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conjunto_id uuid null references public.conjuntos(id),
  actor_user_id uuid null references auth.users(id),
  actor_role text null,
  module text not null,
  action text not null,
  severity text not null,
  event_type text null,
  message text not null,
  error_type text null,
  error_code text null,
  http_status integer null,
  metadata jsonb not null default '{}'::jsonb,
  environment text null,
  source text not null default 'frontend',
  constraint operational_events_severity_check check (severity in ('info', 'warn', 'error')),
  constraint operational_events_module_len_check check (char_length(module) between 2 and 64),
  constraint operational_events_action_len_check check (char_length(action) between 2 and 64),
  constraint operational_events_message_len_check check (char_length(message) between 1 and 280),
  constraint operational_events_source_check check (source in ('frontend', 'edge_function')),
  constraint operational_events_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

alter table public.operational_events enable row level security;
alter table public.operational_events force row level security;

revoke all on table public.operational_events from anon;
revoke all on table public.operational_events from authenticated;

create index if not exists operational_events_created_at_desc_idx
  on public.operational_events (created_at desc);

create index if not exists operational_events_conjunto_created_at_desc_idx
  on public.operational_events (conjunto_id, created_at desc);

create index if not exists operational_events_module_action_created_at_desc_idx
  on public.operational_events (module, action, created_at desc);

create index if not exists operational_events_severity_created_at_desc_idx
  on public.operational_events (severity, created_at desc);

comment on table public.operational_events is
  'POST-PROD 2D-1: eventos operativos sanitizados ingestados por backend (service_role) para auditoria.';

commit;
