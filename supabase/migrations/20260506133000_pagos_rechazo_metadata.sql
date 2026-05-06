-- PAGOS-5D.2: metadata mínima para rechazo administrativo de comprobantes.
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS motivo_rechazo text,
  ADD COLUMN IF NOT EXISTS fecha_rechazo timestamptz,
  ADD COLUMN IF NOT EXISTS rechazado_por uuid REFERENCES public.usuarios_app(id);
