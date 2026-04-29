-- Fase 1 Incidentes: ampliación mínima no destructiva
-- Agrega campos operativos para alinear Vigilancia/Admin

ALTER TABLE public.incidentes
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS ubicacion_texto text,
  ADD COLUMN IF NOT EXISTS evidencia_url text,
  ADD COLUMN IF NOT EXISTS resolucion text,
  ADD COLUMN IF NOT EXISTS impacto_economico text;

-- Backfill mínimo solicitado
UPDATE public.incidentes
SET estado = 'nuevo'
WHERE estado IS NULL;

UPDATE public.incidentes
SET tipo = 'seguridad'
WHERE tipo IS NULL;

-- Defaults y nullabilidad mínima segura
ALTER TABLE public.incidentes
  ALTER COLUMN estado SET DEFAULT 'nuevo',
  ALTER COLUMN estado SET NOT NULL,
  ALTER COLUMN tipo SET DEFAULT 'seguridad',
  ALTER COLUMN tipo SET NOT NULL;

-- Constraints de dominio (idempotentes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'incidentes_estado_check'
      AND conrelid = 'public.incidentes'::regclass
  ) THEN
    ALTER TABLE public.incidentes
      ADD CONSTRAINT incidentes_estado_check
      CHECK (estado IN ('nuevo', 'en_gestion', 'resuelto', 'cerrado'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'incidentes_tipo_check'
      AND conrelid = 'public.incidentes'::regclass
  ) THEN
    ALTER TABLE public.incidentes
      ADD CONSTRAINT incidentes_tipo_check
      CHECK (tipo IN ('seguridad', 'convivencia', 'infraestructura', 'acceso'));
  END IF;
END $$;

-- RLS: permitir UPDATE a admin del mismo conjunto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'incidentes'
      AND policyname = 'update incidentes admin conjunto'
  ) THEN
    CREATE POLICY "update incidentes admin conjunto"
      ON public.incidentes
      FOR UPDATE
      USING (
        conjunto_id = (
          SELECT usuarios_app.conjunto_id
          FROM public.usuarios_app
          WHERE usuarios_app.id = auth.uid()
            AND usuarios_app.rol_id = 'admin'
        )
      )
      WITH CHECK (
        conjunto_id = (
          SELECT usuarios_app.conjunto_id
          FROM public.usuarios_app
          WHERE usuarios_app.id = auth.uid()
            AND usuarios_app.rol_id = 'admin'
        )
      );
  END IF;
END $$;
