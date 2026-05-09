-- =====================================================
-- HARDENING CORE ESTRUCTURA MULTITENANT
-- Tablas:
--   - apartamentos
--   - torres
-- =====================================================

-- =====================================================
-- APARTAMENTOS
-- =====================================================

alter table public.apartamentos
enable row level security;

drop policy if exists "apartamentos_select_conjunto"
on public.apartamentos;

create policy "apartamentos_select_conjunto"
on public.apartamentos
for select
to authenticated
using (
    conjunto_id = public.get_user_conjunto_id()
);

drop policy if exists "apartamentos_admin_write"
on public.apartamentos;

create policy "apartamentos_admin_write"
on public.apartamentos
for all
to authenticated
using (
    public.get_user_role() = 'administrador'
    and conjunto_id = public.get_user_conjunto_id()
)
with check (
    public.get_user_role() = 'administrador'
    and conjunto_id = public.get_user_conjunto_id()
);

-- =====================================================
-- TORRES
-- =====================================================

alter table public.torres
enable row level security;

drop policy if exists "torres_select_conjunto"
on public.torres;

create policy "torres_select_conjunto"
on public.torres
for select
to authenticated
using (
    conjunto_id = public.get_user_conjunto_id()
);

drop policy if exists "torres_admin_write"
on public.torres;

create policy "torres_admin_write"
on public.torres
for all
to authenticated
using (
    public.get_user_role() = 'administrador'
    and conjunto_id = public.get_user_conjunto_id()
)
with check (
    public.get_user_role() = 'administrador'
    and conjunto_id = public.get_user_conjunto_id()
);