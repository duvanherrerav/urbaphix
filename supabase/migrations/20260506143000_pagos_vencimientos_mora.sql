-- PAGOS-5D.4: vencimientos y mora administrativa para cartera PH.
-- Migración segura: agrega columnas sin eliminar datos y amplía estados válidos.
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS fecha_vencimiento timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_pago timestamptz,
  ADD COLUMN IF NOT EXISTS dias_mora integer DEFAULT 0;

ALTER TABLE public.pagos
  ALTER COLUMN dias_mora SET DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pagos'
      AND column_name = 'fecha_pago'
      AND data_type <> 'timestamp with time zone'
  ) THEN
    ALTER TABLE public.pagos
      ALTER COLUMN fecha_pago TYPE timestamptz
      USING fecha_pago::timestamptz;
  END IF;
END $$;

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
  CHECK (estado IS NULL OR estado IN ('pendiente', 'vencido', 'en_revision', 'pagado', 'rechazado'))
  NOT VALID;
