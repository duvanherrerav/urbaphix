-- PAGOS-5E: trazabilidad operativa básica para cobros y comprobantes.
-- Migración no destructiva: crea tabla de eventos, índices y RLS mínima por conjunto/residente.
CREATE TABLE IF NOT EXISTS public.pagos_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id uuid NOT NULL REFERENCES public.pagos(id) ON DELETE CASCADE,
  conjunto_id uuid REFERENCES public.conjuntos(id),
  residente_id uuid REFERENCES public.residentes(id),
  usuario_id uuid REFERENCES public.usuarios_app(id),
  evento text NOT NULL,
  estado_anterior text,
  estado_nuevo text,
  mensaje text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_eventos_pago_created_at
  ON public.pagos_eventos (pago_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pagos_eventos_conjunto_created_at
  ON public.pagos_eventos (conjunto_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pagos_eventos_residente_created_at
  ON public.pagos_eventos (residente_id, created_at DESC);

ALTER TABLE public.pagos_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pagos_eventos_select_admin_conjunto" ON public.pagos_eventos;
CREATE POLICY "pagos_eventos_select_admin_conjunto"
  ON public.pagos_eventos
  FOR SELECT
  TO authenticated
  USING (
    conjunto_id = public.fn_auth_conjunto_id()
    AND public.fn_auth_rol() = 'admin'
  );

DROP POLICY IF EXISTS "pagos_eventos_select_residente_propios" ON public.pagos_eventos;
CREATE POLICY "pagos_eventos_select_residente_propios"
  ON public.pagos_eventos
  FOR SELECT
  TO authenticated
  USING (
    residente_id = public.fn_auth_residente_id()
  );

DROP POLICY IF EXISTS "pagos_eventos_insert_flujos_pagos" ON public.pagos_eventos;
CREATE POLICY "pagos_eventos_insert_flujos_pagos"
  ON public.pagos_eventos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND usuario_id = auth.uid()
    AND conjunto_id = public.fn_auth_conjunto_id()
    AND EXISTS (
      SELECT 1
      FROM public.pagos p
      WHERE p.id = pago_id
        AND p.conjunto_id = pagos_eventos.conjunto_id
        AND p.residente_id = pagos_eventos.residente_id
    )
    AND (
      public.fn_auth_rol() = 'admin'
      OR residente_id = public.fn_auth_residente_id()
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'pagos_eventos'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pagos_eventos;
  END IF;
END $$;
