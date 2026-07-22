-- ============================================================
-- FASE 6.0
-- Reconciliación canónica de helper y policies RLS divergentes
-- Alcance:
--   - get_user_residente_id()
--   - reservas_zonas
--   - visitantes
--   - usuarios_app
--
-- Esta migración no copia datos ni modifica schema_migrations.
-- ============================================================

begin;

-- ============================================================
-- PRECHECKS
-- ============================================================

do $$
begin
  if to_regclass('public.residentes') is null then
    raise exception 'Precheck failed: public.residentes no existe';
  end if;

  if to_regclass('public.reservas_zonas') is null then
    raise exception 'Precheck failed: public.reservas_zonas no existe';
  end if;

  if to_regclass('public.visitantes') is null then
    raise exception 'Precheck failed: public.visitantes no existe';
  end if;

  if to_regclass('public.usuarios_app') is null then
    raise exception 'Precheck failed: public.usuarios_app no existe';
  end if;
end;
$$;

-- ============================================================
-- 1. HELPER CANÓNICO
-- ============================================================

create or replace function public.get_user_residente_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select r.id
  from public.residentes r
  where r.usuario_id = auth.uid()
  limit 1;
$$;

alter function public.get_user_residente_id() owner to postgres;

revoke all
on function public.get_user_residente_id()
from public;

revoke execute
on function public.get_user_residente_id()
from anon;

grant execute
on function public.get_user_residente_id()
to authenticated, service_role;

-- ============================================================
-- 2. RESERVAS_ZONAS
-- ============================================================

alter table public.reservas_zonas enable row level security;

drop policy if exists reservas_zonas_insert
on public.reservas_zonas;

create policy reservas_zonas_insert
on public.reservas_zonas
for insert
to authenticated
with check (
  conjunto_id = public.get_user_conjunto_id()
  and (
    public.is_admin()
    or public.is_vigilancia()
    or (
      public.is_residente()
      and residente_id = public.get_user_residente_id()
    )
  )
);

drop policy if exists reservas_zonas_update
on public.reservas_zonas;

create policy reservas_zonas_update
on public.reservas_zonas
for update
to authenticated
using (
  conjunto_id = public.get_user_conjunto_id()
  and (
    public.is_admin()
    or public.is_vigilancia()
    or (
      public.is_residente()
      and residente_id = public.get_user_residente_id()
    )
  )
)
with check (
  conjunto_id = public.get_user_conjunto_id()
  and (
    public.is_admin()
    or public.is_vigilancia()
    or (
      public.is_residente()
      and residente_id = public.get_user_residente_id()
    )
  )
);

-- ============================================================
-- 3. VISITANTES
-- ============================================================

alter table public.visitantes enable row level security;

drop policy if exists visitantes_insert_residente
on public.visitantes;

create policy visitantes_insert_residente
on public.visitantes
for insert
to authenticated
with check (
  public.is_residente()
  and conjunto_id = public.get_user_conjunto_id()
  and residente_id = public.get_user_residente_id()
);

drop policy if exists visitantes_update_residente
on public.visitantes;

create policy visitantes_update_residente
on public.visitantes
for update
to authenticated
using (
  public.is_residente()
  and conjunto_id = public.get_user_conjunto_id()
  and residente_id = public.get_user_residente_id()
)
with check (
  public.is_residente()
  and conjunto_id = public.get_user_conjunto_id()
  and residente_id = public.get_user_residente_id()
);

-- ============================================================
-- 4. USUARIOS_APP
-- ============================================================

alter table public.usuarios_app enable row level security;

-- Se eliminan variantes amplias o redundantes detectadas entre ambientes.
drop policy if exists "lectura usuarios"
on public.usuarios_app;

drop policy if exists "usuario puede verse"
on public.usuarios_app;

drop policy if exists "usuarios mismo conjunto"
on public.usuarios_app;

create policy "usuario puede verse"
on public.usuarios_app
for select
to authenticated
using (
  id = auth.uid()
);

-- Se conserva la policy existente de actualización propia.
-- No se reemplaza aquí para no ampliar el alcance de esta reconciliación.

-- ============================================================
-- POSTCHECKS
-- ============================================================

do $$
declare
  v_count integer;
begin
  if to_regprocedure('public.get_user_residente_id()') is null then
    raise exception
      'Postcheck failed: public.get_user_residente_id() no fue creada';
  end if;

  select count(*)
  into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'reservas_zonas'
    and policyname in (
      'reservas_zonas_insert',
      'reservas_zonas_update'
    );

  if v_count <> 2 then
    raise exception
      'Postcheck failed: policies esperadas de reservas_zonas = 2, encontradas = %',
      v_count;
  end if;

  select count(*)
  into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'visitantes'
    and policyname in (
      'visitantes_insert_residente',
      'visitantes_update_residente'
    );

  if v_count <> 2 then
    raise exception
      'Postcheck failed: policies esperadas de visitantes = 2, encontradas = %',
      v_count;
  end if;

  select count(*)
  into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'usuarios_app'
    and policyname = 'usuario puede verse'
    and cmd = 'SELECT';

  if v_count <> 1 then
    raise exception
      'Postcheck failed: policy usuario puede verse no quedó canónica';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'usuarios_app'
      and coalesce(qual, '') = 'true'
  ) then
    raise exception
      'Postcheck failed: usuarios_app conserva una policy SELECT USING (true)';
  end if;
end;
$$;

commit;