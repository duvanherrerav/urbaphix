-- =====================================================
-- NORMALIZAR RLS Y ROLES CORE DEV/QA
--
-- Objetivo:
--   - Alinear políticas RLS de conjuntos, roles, torres y apartamentos.
--   - Usar public.fn_auth_rol() y public.fn_auth_conjunto_id() como helpers canónicos.
--   - Mantener 'admin' como identificador canónico del rol administrador.
--
-- Seguridad operativa:
--   - Migración revisable: no debe aplicarse a Supabase remoto sin validación previa.
--   - Ejecutar primero consultas de prevalidación y respaldos en cada ambiente.
--   - No elimina helpers legacy get_user_role() ni get_user_conjunto_id().
--   - No habilita escrituras cliente sobre public.roles ni public.conjuntos.
-- =====================================================

begin;

-- =====================================================
-- 1) PREVALIDACIÓN Y NORMALIZACIÓN DE ROL HISTÓRICO
-- =====================================================

-- Consulta preventiva recomendada antes de aplicar en cada ambiente:
-- select id, email, rol_id
-- from public.usuarios_app
-- where rol_id = 'administrador'
-- order by created_at, id;
--
-- Si devuelve filas, validar que corresponden realmente a administradores.
-- Esta migración normaliza únicamente el alias histórico 'administrador' al
-- identificador canónico 'admin'. No crea roles ni modifica otros valores.

do $$
begin
  if exists (
    select 1
    from public.usuarios_app
    where rol_id = 'administrador'
  ) and not exists (
    select 1
    from public.roles
    where id = 'admin'
  ) then
    raise exception 'No se puede normalizar rol_id = administrador porque public.roles no contiene id = admin';
  end if;
end $$;

update public.usuarios_app
set rol_id = 'admin'
where rol_id = 'administrador'
  and exists (
    select 1
    from public.roles
    where id = 'admin'
  );

-- =====================================================
-- 2) CONJUNTOS: LECTURA SOLO DEL TENANT AUTENTICADO
-- =====================================================

alter table public.conjuntos
  enable row level security;

-- Política tenant-aware para lectura del conjunto del usuario autenticado.
-- No se agregan políticas de INSERT/UPDATE/DELETE: esas escrituras deben
-- permanecer fuera del cliente y usarse solo vía service_role/backend aprobado.
drop policy if exists "conjuntos mismo tenant"
on public.conjuntos;

drop policy if exists "conjuntos_select_conjunto"
on public.conjuntos;

create policy "conjuntos_select_conjunto"
on public.conjuntos
for select
to authenticated
using (
  id = public.fn_auth_conjunto_id()
);

-- =====================================================
-- 3) ROLES: CATÁLOGO LEGIBLE, SIN ESCRITURAS CLIENTE
-- =====================================================

alter table public.roles
  enable row level security;

-- Permite al frontend autenticado leer el catálogo de roles si lo requiere.
-- Al no existir políticas de INSERT/UPDATE/DELETE para anon/authenticated,
-- RLS no habilita escrituras cliente sobre este catálogo.
drop policy if exists "roles_select_authenticated"
on public.roles;

create policy "roles_select_authenticated"
on public.roles
for select
to authenticated
using (true);

-- =====================================================
-- 4) TORRES: LECTURA POR TENANT, ESCRITURA SOLO ADMIN
-- =====================================================

alter table public.torres
  enable row level security;

drop policy if exists "torres_select_conjunto"
on public.torres;

drop policy if exists "torres_admin_write"
on public.torres;

drop policy if exists "torres_admin_insert"
on public.torres;

drop policy if exists "torres_admin_update"
on public.torres;

drop policy if exists "torres_admin_delete"
on public.torres;

create policy "torres_select_conjunto"
on public.torres
for select
to authenticated
using (
  conjunto_id = public.fn_auth_conjunto_id()
);

create policy "torres_admin_insert"
on public.torres
for insert
to authenticated
with check (
  public.fn_auth_rol() = 'admin'
  and conjunto_id = public.fn_auth_conjunto_id()
);

create policy "torres_admin_update"
on public.torres
for update
to authenticated
using (
  public.fn_auth_rol() = 'admin'
  and conjunto_id = public.fn_auth_conjunto_id()
)
with check (
  public.fn_auth_rol() = 'admin'
  and conjunto_id = public.fn_auth_conjunto_id()
);

create policy "torres_admin_delete"
on public.torres
for delete
to authenticated
using (
  public.fn_auth_rol() = 'admin'
  and conjunto_id = public.fn_auth_conjunto_id()
);

-- =====================================================
-- 5) APARTAMENTOS: LECTURA POR TENANT, ESCRITURA SOLO ADMIN
-- =====================================================

alter table public.apartamentos
  enable row level security;

drop policy if exists "apartamentos_select_conjunto"
on public.apartamentos;

drop policy if exists "apartamentos_admin_write"
on public.apartamentos;

drop policy if exists "apartamentos_admin_insert"
on public.apartamentos;

drop policy if exists "apartamentos_admin_update"
on public.apartamentos;

drop policy if exists "apartamentos_admin_delete"
on public.apartamentos;

create policy "apartamentos_select_conjunto"
on public.apartamentos
for select
to authenticated
using (
  conjunto_id = public.fn_auth_conjunto_id()
);

create policy "apartamentos_admin_insert"
on public.apartamentos
for insert
to authenticated
with check (
  public.fn_auth_rol() = 'admin'
  and conjunto_id = public.fn_auth_conjunto_id()
);

create policy "apartamentos_admin_update"
on public.apartamentos
for update
to authenticated
using (
  public.fn_auth_rol() = 'admin'
  and conjunto_id = public.fn_auth_conjunto_id()
)
with check (
  public.fn_auth_rol() = 'admin'
  and conjunto_id = public.fn_auth_conjunto_id()
);

create policy "apartamentos_admin_delete"
on public.apartamentos
for delete
to authenticated
using (
  public.fn_auth_rol() = 'admin'
  and conjunto_id = public.fn_auth_conjunto_id()
);

commit;
