-- Ticket: Hotfix estructural timezone Reservas
-- Objetivo:
-- 1) Mantener tiempos operativos de negocio (fecha_inicio/fecha_fin) como timestamp without time zone.
-- 2) Migrar timestamps de auditoría/sistema de Reservas a timestamptz.
-- 3) Corregir histórico desfasado (guardado como UTC naive) reinterpretándolo como UTC.

BEGIN;

-- Auditoría del módulo Reservas -> timestamptz
-- Supuesto de corrección histórica:
-- los valores naive actuales de created_at/updated_at se registraron en UTC.
-- Por eso se usa "AT TIME ZONE 'UTC'" para preservar instante real y verlos correctamente en Bogotá.

ALTER TABLE public.reservas_eventos
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.reservas_zonas
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at TYPE timestamptz
  USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.reservas_documentos
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.reservas_bloqueos
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT now();

-- Detección post-migración (referencia operativa):
-- registros de eventos que todavía luzcan adelantados 5h al comparar UTC vs Bogotá.
-- SELECT id, created_at,
--        created_at AT TIME ZONE 'America/Bogota' AS created_at_bogota
-- FROM public.reservas_eventos
-- ORDER BY created_at DESC
-- LIMIT 100;

COMMIT;
