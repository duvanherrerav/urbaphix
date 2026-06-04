# FASE 3D.5 - Checklist de ejecución estructural RLS DEV

Este checklist acompaña `docs/fase-3d5-evidencia-estructural-rls-dev.md` y debe completarse manualmente por el operador antes, durante y después de ejecutar los SQL autorizados en Supabase Dashboard **DEV**.

## 1. Pre-ejecución

| Check | Estado | Evidencia / nota |
| --- | --- | --- |
| Proyecto Supabase DEV confirmado visualmente | Pendiente | Pendiente |
| PRD cerrado o claramente no seleccionado | Pendiente | Pendiente |
| QA cerrado o claramente no seleccionado | Pendiente | Pendiente |
| Operador identificado | Pendiente | Pendiente |
| Fecha/hora registrada | Pendiente | Pendiente |
| Se confirmó que Codex no ejecutará SQL contra Supabase | Pendiente | Pendiente |
| Se confirmó que no se harán cambios de DB, RLS, helpers ni datos | Pendiente | Pendiente |
| Se confirmó que no se tocarán frontend, `.env`, Vercel ni migraciones | Pendiente | Pendiente |

## 2. SQL autorizado

| Archivo / bloque | Ejecutar en FASE 3D.5 | Estado | Evidencia / nota |
| --- | --- | --- | --- |
| `supabase/validation/fase_3d3_rls_precheck_inventory.sql` completo | Sí | Pendiente | Pendiente |
| Bloques estructurales de `supabase/validation/fase_3d3_rls_tenant_isolation_checks.sql` | Sí, parcial | Pendiente | Pendiente |
| `supabase/validation/fase_3d3_rls_effective_access_checks.sql` | No como evidencia final | Pendiente | Debe reservarse para FASE 3D.6 con sesión/JWT real |

## 3. Validación manual previa del SQL

Antes de presionar **Run**, confirmar que el SQL copiado para esta fase no contiene operaciones no permitidas.

| Patrón prohibido para esta fase | Encontrado | Acción |
| --- | --- | --- |
| `ALTER` | Pendiente | Si aparece, detener y revisar |
| `CREATE` | Pendiente | Si aparece, detener y revisar |
| `DROP` | Pendiente | Si aparece, detener y revisar |
| `UPDATE` | Pendiente | Si aparece, detener y revisar |
| `DELETE` | Pendiente | Si aparece, detener y revisar |
| `INSERT` | Pendiente | Si aparece, detener y revisar |
| `TRUNCATE` | Pendiente | Si aparece, detener y revisar |

## 4. Evidencia mínima a capturar

| Evidencia | Fuente esperada | Capturada | Ubicación / enlace |
| --- | --- | --- | --- |
| Contexto de conexión DEV | SQL principal sección 00 | Pendiente | Pendiente |
| RLS/FORCE RLS por tabla sensible | SQL principal sección 01 | Pendiente | Pendiente |
| Policies por tabla sensible | SQL principal sección 02 | Pendiente | Pendiente |
| Helpers legacy (`fn_auth_*` incluidos), tenant-aware existentes y tenant-aware objetivo/futuros | SQL principal sección 03 | Pendiente | Pendiente |
| Grants `EXECUTE` de helpers | SQL principal sección 04 | Pendiente | Pendiente |
| Columnas `conjunto_id`, `residente_id`, `user_id`, `usuario_id` | SQL principal sección 05 | Pendiente | Pendiente |
| Conteos por tabla sensible | SQL principal sección 06 | Pendiente | Pendiente |
| Conteos `tenant_memberships` por estado/rol | SQL principal sección 07 | Pendiente | Pendiente |
| Duplicados activos por usuario/conjunto | SQL principal sección 08 | Pendiente | Pendiente |
| Residentes/memberships inconsistentes | SQL principal secciones 09-10 y SQL complementario 01-03 | Pendiente | Pendiente |
| Tablas sin trazabilidad tenant directa o con `conjunto_id` nulo | SQL complementario secciones 04-05 | Pendiente | Pendiente |
| Filas huérfanas o trazabilidad cruzada inconsistente | SQL complementario secciones 06-07 | Pendiente | Pendiente |
| Policies amplias, sin filtro visible tenant/residente o dependientes de helpers `fn_auth_*` legacy | SQL complementario secciones 09 y 12; revisión de policies sección 02 | Pendiente | Pendiente |
| Tablas sensibles sin RLS o sin policies | SQL complementario secciones 10-11 | Pendiente | Pendiente |

## 5. Clasificación rápida de hallazgos

| Severidad | Pregunta de decisión | IDs de hallazgos |
| --- | --- | --- |
| P0 | ¿Existe tabla sensible con datos reales sin RLS, sin policies, o señal directa de fuga cross-tenant? | Pendiente |
| P1 | ¿Existen policies amplias, dependencias sensibles de helpers `fn_auth_*` legacy, duplicidades activas o residentes sin trazabilidad clara? | Pendiente |
| P2 | ¿Existen brechas documentales, datos insuficientes, roles no homologados o grants amplios sin fuga directa? | Pendiente |
| P3 | ¿Existen mejoras menores de nombres, comentarios, capturas o formato? | Pendiente |

## 6. Decisión Go / No-Go

| Criterio | Estado | Nota |
| --- | --- | --- |
| Evidencia estructural DEV capturada | Pendiente | Pendiente |
| P0 abiertos igual a 0 | Pendiente | Pendiente |
| P1 con plan documentado | Pendiente | Pendiente |
| Tablas sensibles principales inventariadas | Pendiente | Pendiente |
| Helpers usados por RLS identificados y clasificados como legacy / `usuarios_app`, tenant-aware actual u objetivo/futuro | Pendiente | Pendiente |
| Se mantiene separación con evidencia efectiva autenticada | Pendiente | Pendiente |
| PRD/QA/frontend/env/Vercel/migraciones no tocados | Pendiente | Pendiente |
| Decisión final: Go a FASE 3D.6 | Pendiente | Pendiente |

## 7. Nota obligatoria de cierre

Copiar esta nota en el comentario de cierre:

```text
FASE 3D.5 cerró evidencia estructural DEV únicamente. No se ejecutó SQL contra PRD/QA, no se modificó base de datos y no se validó acceso efectivo por usuario autenticado. La validación con sesión/JWT real queda pendiente para FASE 3D.6.
```
