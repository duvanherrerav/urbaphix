-- PAGOS-5D.4: backfill seguro de vencimientos para cartera abierta histórica.
-- Solo afecta pagos abiertos sin fecha de vencimiento; no modifica pagos pagados ni en revisión.
WITH pagos_abiertos AS (
  SELECT
    id,
    (COALESCE(created_at, now()) + interval '10 days') AS fecha_vencimiento_backfill
  FROM public.pagos
  WHERE estado IN ('pendiente', 'rechazado')
    AND fecha_vencimiento IS NULL
)
UPDATE public.pagos AS p
SET
  fecha_vencimiento = pagos_abiertos.fecha_vencimiento_backfill,
  dias_mora = CASE
    WHEN pagos_abiertos.fecha_vencimiento_backfill < now() THEN
      GREATEST(
        (CURRENT_DATE - pagos_abiertos.fecha_vencimiento_backfill::date),
        0
      )
    ELSE 0
  END
FROM pagos_abiertos
WHERE p.id = pagos_abiertos.id;
