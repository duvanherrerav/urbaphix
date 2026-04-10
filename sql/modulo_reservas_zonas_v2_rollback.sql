-- Urbaphix | Rollback complementario módulo Reservas Zonas Comunes (v2)
-- Ejecutar en Supabase SQL Editor con rol postgres.
-- Este rollback elimina únicamente artefactos v2 y NO borra tablas legacy:
-- public.zonas_comunes, public.reservas, public.trasteos.

begin;

-- 1) Desactivar RLS y eliminar políticas (si existen)
alter table if exists public.recursos_comunes disable row level security;
alter table if exists public.reservas_zonas disable row level security;
alter table if exists public.reservas_eventos disable row level security;
alter table if exists public.reservas_documentos disable row level security;
alter table if exists public.reservas_bloqueos disable row level security;

drop policy if exists "recursos_select_conjunto" on public.recursos_comunes;
drop policy if exists "recursos_admin_write" on public.recursos_comunes;

drop policy if exists "reservas_select_admin_vigilancia_residente" on public.reservas_zonas;
drop policy if exists "reservas_insert_residente_admin" on public.reservas_zonas;
drop policy if exists "reservas_update_admin_vigilancia_residente" on public.reservas_zonas;

drop policy if exists "eventos_select_conjunto" on public.reservas_eventos;
drop policy if exists "eventos_insert_conjunto" on public.reservas_eventos;

drop policy if exists "docs_select_conjunto" on public.reservas_documentos;
drop policy if exists "docs_insert_conjunto" on public.reservas_documentos;

drop policy if exists "bloqueos_select_conjunto" on public.reservas_bloqueos;
drop policy if exists "bloqueos_admin_write" on public.reservas_bloqueos;

-- 2) Eliminar triggers v2
drop trigger if exists trg_recursos_comunes_updated_at on public.recursos_comunes;
drop trigger if exists trg_reservas_zonas_updated_at on public.reservas_zonas;

-- 3) Eliminar tablas v2 (orden por dependencias)
drop table if exists public.reservas_documentos;
drop table if exists public.reservas_eventos;
drop table if exists public.reservas_bloqueos;
drop table if exists public.reservas_zonas;
drop table if exists public.recursos_comunes;

-- 4) Eliminar funciones helper v2
drop function if exists public.fn_auth_residente_id();
drop function if exists public.fn_auth_rol();
drop function if exists public.fn_auth_conjunto_id();
drop function if exists public.set_updated_at();

commit;
