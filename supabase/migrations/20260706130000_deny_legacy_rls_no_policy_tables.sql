begin;

-- FASE 3D.28: hygiene for legacy/unused tables reported by Supabase
-- Advisor as "RLS enabled with no policies".
--
-- These tables are not part of active functional flows. Keep RLS explicit and
-- closed for client roles so the warning is reduced without granting access.

alter table public.operational_events enable row level security;
alter table public.operational_events force row level security;
revoke all on table public.operational_events from anon;
revoke all on table public.operational_events from authenticated;
drop policy if exists operational_events_deny_client_access on public.operational_events;
create policy operational_events_deny_client_access
  on public.operational_events
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table public.trasteos enable row level security;
alter table public.trasteos force row level security;
revoke all on table public.trasteos from anon;
revoke all on table public.trasteos from authenticated;
drop policy if exists trasteos_deny_client_access on public.trasteos;
create policy trasteos_deny_client_access
  on public.trasteos
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table public.vehiculos enable row level security;
alter table public.vehiculos force row level security;
revoke all on table public.vehiculos from anon;
revoke all on table public.vehiculos from authenticated;
drop policy if exists vehiculos_deny_client_access on public.vehiculos;
create policy vehiculos_deny_client_access
  on public.vehiculos
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on policy operational_events_deny_client_access on public.operational_events is
  'FASE 3D.28: closed client policy for legacy/internal table; access remains denied to anon/authenticated.';
comment on policy trasteos_deny_client_access on public.trasteos is
  'FASE 3D.28: closed client policy for legacy table; access remains denied to anon/authenticated.';
comment on policy vehiculos_deny_client_access on public.vehiculos is
  'FASE 3D.28: closed client policy for legacy table; access remains denied to anon/authenticated.';

commit;
