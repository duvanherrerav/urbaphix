-- FASE 0.3.1 — Limpieza final legacy confirmada
-- Forward-only, idempotente y sin CASCADE.
-- Las tablas fueron verificadas vacías y sin consumo funcional activo.

begin;

drop table if exists public.reservas;
drop table if exists public.zonas_comunes;
drop table if exists public.trasteos;
drop table if exists public.vehiculos;

commit;
