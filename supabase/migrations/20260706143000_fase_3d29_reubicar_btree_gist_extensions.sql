-- FASE 3D.29: revision btree_gist en public.
--
-- Hallazgo:
-- - El snapshot inicial instalo btree_gist en public.
-- - reservas_zonas_no_solape depende de btree_gist para comparar recurso_id (uuid)
--   dentro de una exclusion constraint GiST y evitar reservas activas solapadas.
--
-- Propuesta segura:
-- - Mantener btree_gist instalado, pero fuera de public, en el schema extensions.
-- - No modificar tablas, columnas, FKs, RLS ni policies.
-- - No recrear reservas_zonas_no_solape; ALTER EXTENSION SET SCHEMA conserva los
--   objetos de la extension y las dependencias existentes de la constraint.
-- - El aislamiento multi tenant y Superadmin se mantiene en las policies/RPCs
--   existentes; esta migracion solo reduce superficie de objetos extension en public.
--
-- Rollback documentado:
--   ALTER EXTENSION btree_gist SET SCHEMA public;
--
-- Nota: no ejecutar DROP EXTENSION btree_gist porque romperia la exclusion
-- reservas_zonas_no_solape usada por public.reservas_zonas.

create schema if not exists extensions;

create extension if not exists btree_gist with schema extensions;

do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'btree_gist'
      and n.nspname = 'public'
  ) then
    alter extension btree_gist set schema extensions;
  end if;
end
$$;

comment on extension btree_gist is
  'Requerida por reservas_zonas_no_solape para exclusion constraint GiST sobre recurso_id uuid y rango horario; mantener en schema extensions, no en public.';
