# FASE 3D.9 — Formato de evidencia negativa RLS DEV

## 1. Instrucciones de uso

Usar esta plantilla para cada prueba negativa/cross-tenant ejecutada con una sesión autenticada real en DEV. La evidencia debe sanear datos personales, documentos, placas, teléfonos, emails, URLs de comprobantes, QR y cualquier texto libre sensible.

No usar resultados del SQL Editor como evidencia efectiva de RLS autenticada. El SQL Editor solo puede adjuntarse como evidencia estructural de disponibilidad de candidatos y plan de checks.

## 2. Resumen de ejecución

| Campo | Valor |
|---|---|
| Fecha de ejecución | `YYYY-MM-DD` |
| Ambiente | `DEV` |
| App local | `http://localhost:5173` |
| Supabase project | `polstaxmencetxgctvsw.supabase.co` |
| Ejecutado por |  |
| Método | `Frontend Network` / `REST con JWT real` / `Simulación aprobada` |
| Scripts estructurales usados | `fase_3d9_identificar_datos_negativos_dev.sql`, `fase_3d9_plan_checks_negativos_rls_dev.sql` |
| Decisión preliminar | `GO para ejecutar validación negativa/cross-tenant DEV` / `GO condicionado` / `NO-GO` |

## 3. Registro por caso

Copiar un bloque por cada caso probado.

### Caso `<ID>` — `<rol>` — `<tabla>`

| Campo | Valor |
|---|---|
| Rol autenticado | `admin` / `vigilancia` / `residente` |
| `auth.uid()` esperado |  |
| `conjunto_id` propio esperado |  |
| `residente_id` propio esperado, si aplica |  |
| Endpoint REST probado | `/rest/v1/<tabla>?<filtros>` |
| Método HTTP | `GET` |
| Parámetro manipulado | `conjunto_id` / `residente_id` / `id` / `usuario_id` |
| Valor propio esperado |  |
| Valor ajeno probado |  |
| Status code | `200` / `401` / `403` / otro |
| Respuesta saneada | `[]` / `{...}` saneado / error saneado |
| Resultado | `PASS` / `FAIL` |
| Clasificación | `P0` / `P1` / `P2` / `P3` |
| Evidencia adjunta | Captura Network, curl saneado o log controlado |
| Observaciones |  |

#### Criterio PASS

Marcar `PASS` solo si el resultado fue uno de estos:

- `200 OK` con array vacío.
- `401 Unauthorized` por ausencia o invalidez de sesión.
- `403 Forbidden` por bloqueo de política.

#### Criterio FAIL

Marcar `FAIL` si la respuesta contiene cualquier dato de otro `conjunto_id`, otro `residente_id` o usuario fuera del alcance autorizado.

## 4. Evidencia estructural

Adjuntar salida saneada de:

```bash
# ejecutado manualmente en SQL Editor DEV, no desde CI
supabase/validation/fase_3d9_identificar_datos_negativos_dev.sql
supabase/validation/fase_3d9_plan_checks_negativos_rls_dev.sql
```

La evidencia estructural debe indicar si hay datos suficientes o si falta seed DEV controlado.

## 5. Clasificación de hallazgos

| Severidad | Cuándo usarla |
|---|---|
| P0 | Hay exposición real de datos de otro tenant/residente |
| P1 | La consulta manipulada queda habilitada de forma no esperada aunque no devuelva datos por falta de dataset |
| P2 | DEV no tiene datos suficientes para ejecutar la prueba negativa |
| P3 | Mejora documental, observabilidad o formato de evidencia |

## 6. Cierre de fase

| Campo | Valor |
|---|---|
| Total casos PASS |  |
| Total casos FAIL P0 |  |
| Total casos FAIL P1 |  |
| Total casos P2 por falta de datos |  |
| Total P3 |  |
| Decisión final propuesta | `GO para ejecutar validación negativa/cross-tenant DEV` / `GO condicionado` / `NO-GO` |
| Justificación |  |

## 7. Confirmación de no impacto

Confirmar explícitamente al cierre:

- No se tocó Supabase estructural.
- No se tocó QA.
- No se tocó PRD.
- No se cambió RLS.
- No se cambiaron helpers.
- No se cambiaron policies.
- No se crearon migraciones.
- No se modificó frontend funcional.
- No se modificaron `.env` ni `.env.*`.
- No se tocó Vercel.
