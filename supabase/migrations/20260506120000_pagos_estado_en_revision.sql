-- PAGOS-5D.1: normaliza estados financieros persistidos para pagos.
-- No transforma registros históricos ambiguos; el constraint NOT VALID evita
-- bloquear datos existentes y sí controla nuevos inserts/updates hacia adelante.
DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.pagos'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%estado%'
  LOOP
    EXECUTE format('ALTER TABLE public.pagos DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;
END $$;

ALTER TABLE public.pagos
  ADD CONSTRAINT pagos_estado_check
  CHECK (estado IS NULL OR estado IN ('pendiente', 'en_revision', 'pagado', 'rechazado'))
  NOT VALID;
