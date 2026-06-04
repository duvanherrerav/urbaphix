# FASE 3D.6 - Formato de captura de resultados RLS DEV

Este formato debe diligenciarse manualmente con los resultados reales obtenidos en Supabase **DEV**. No debe usarse para PRD ni QA.

## 1. Control de ejecución

| Campo | Valor |
| --- | --- |
| Operador | Pendiente |
| Fecha/hora inicio | Pendiente |
| Fecha/hora fin | Pendiente |
| Proyecto confirmado como DEV | Pendiente |
| PRD cerrado/no seleccionado | Pendiente |
| QA cerrado/no seleccionado | Pendiente |
| SQL ejecutado por operador humano | Pendiente |
| Confirmación de que Codex no ejecutó SQL | Pendiente |
| Confirmación de no DDL/DML | Pendiente |
| Confirmación de no cambios DB/RLS/frontend/env/Vercel | Pendiente |

## 2. SQL ejecutado

| Archivo / bloque | Ejecutado | Resultado / enlace evidencia |
| --- | --- | --- |
| `supabase/validation/fase_3d3_rls_precheck_inventory.sql` completo | Pendiente | Pendiente |
| `fase_3d3_rls_tenant_isolation_checks.sql` bloque 01 | Pendiente | Pendiente |
| `fase_3d3_rls_tenant_isolation_checks.sql` bloque 02 | Pendiente | Pendiente |
| `fase_3d3_rls_tenant_isolation_checks.sql` bloque 03 | Pendiente | Pendiente |
| `fase_3d3_rls_tenant_isolation_checks.sql` bloque 04 | Pendiente | Pendiente |
| `fase_3d3_rls_tenant_isolation_checks.sql` bloque 05 | Pendiente | Pendiente |
| `fase_3d3_rls_tenant_isolation_checks.sql` bloque 06 | Pendiente | Pendiente |
| `fase_3d3_rls_tenant_isolation_checks.sql` bloque 07 | Pendiente | Pendiente |
| `fase_3d3_rls_tenant_isolation_checks.sql` bloque 08 | Pendiente | Pendiente |
| `fase_3d3_rls_tenant_isolation_checks.sql` bloque 09 | Pendiente | Pendiente |
| `fase_3d3_rls_tenant_isolation_checks.sql` bloque 10 | Pendiente | Pendiente |
| `fase_3d3_rls_tenant_isolation_checks.sql` bloque 11 | Pendiente | Pendiente |
| `fase_3d3_rls_tenant_isolation_checks.sql` bloque 12 | Pendiente | Pendiente |
| `supabase/validation/fase_3d3_rls_effective_access_checks.sql` | No autorizado como evidencia final | Reservado para FASE 3D.7 |

## 3. Resultado sección 00 - contexto de conexión

Pegar resultado real DEV:

```text
Pendiente
```

Notas:

```text
Pendiente
```

## 4. Resultado sección 01 - tablas sensibles y RLS/FORCE RLS

| Tabla | Existe | RLS | FORCE RLS | Conteo | Observación |
| --- | --- | --- | --- | --- | --- |
| `usuarios_app` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `tenant_memberships` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `platform_memberships` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `conjuntos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `residentes` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `pagos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `pagos_eventos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `registro_visitas` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `visitantes` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `paquetes` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `incidentes` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `reservas` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `reservas_zonas` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `reservas_eventos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `reservas_documentos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `reservas_bloqueos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `notificaciones` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `archivos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `config_pagos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## 5. Resultado sección 02 - policies por tabla sensible

Pegar tabla o resumen real DEV:

```text
Pendiente
```

Policies que requieren clasificación:

| Tabla | Policy | Motivo de revisión | Severidad preliminar |
| --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente |

## 6. Resultado sección 03 - helper functions

| Helper | Existe | Tipo | Observación |
| --- | --- | --- | --- |
| `fn_auth_conjunto_id()` | Pendiente | Legacy / `usuarios_app` | Pendiente |
| `fn_auth_rol()` | Pendiente | Legacy / `usuarios_app` | Pendiente |
| `fn_auth_residente_id()` | Pendiente | Legacy / `usuarios_app` | Pendiente |
| `fn_is_platform_superadmin()` | Pendiente | Tenant-aware / platform | Pendiente |
| `fn_has_platform_role(text)` | Pendiente | Tenant-aware / platform | Pendiente |
| `fn_has_tenant_access(uuid)` | Pendiente | Tenant-aware / tenant | Pendiente |
| `fn_has_tenant_role(uuid, text)` | Pendiente | Tenant-aware / tenant | Pendiente |

## 7. Resultado sección 04 - grants relevantes

Pegar resultado real DEV:

```text
Pendiente
```

Grants amplios o inesperados:

| Objeto | Grantee | Privilegio | Clasificación |
| --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente |

## 8. Resultado sección 05 - columnas clave

| Tabla | `conjunto_id` | `residente_id` | `user_id` | `usuario_id` | Observación |
| --- | --- | --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## 9. Resultado sección 06 - conteos por tabla sensible

Pegar resultado real DEV:

```text
Pendiente
```

Tablas sin datos suficientes:

| Tabla | Conteo | Impacto para validación | Severidad |
| --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente |

## 10. Resultado sección 07 - `tenant_memberships` por estado/rol

| Status | Role name | Conteo | Observación |
| --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente |

## 11. Resultado sección 08 - duplicados activos

| User ID | Conjunto ID | Conteo | Roles | Acción recomendada |
| --- | --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## 12. Resultado sección 09 - memberships residente sin `residente_id`

| Membership ID | User ID | Conjunto ID | Role | Status | Acción recomendada |
| --- | --- | --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## 13. Resultado sección 10 - `usuarios_app` vs `tenant_memberships`

Pegar resultado real DEV:

```text
Pendiente
```

Resumen de inconsistencias:

| Caso | Conteo | Severidad | Acción recomendada |
| --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente |

## 14. Resultado complementario - riesgos tenant estructurales

| Bloque | Resultado real DEV | Severidad | Hallazgo ID |
| --- | --- | --- | --- |
| 01. Memberships activas en más de un conjunto | Pendiente | Pendiente | Pendiente |
| 02. Divergencia `usuarios_app` vs membership | Pendiente | Pendiente | Pendiente |
| 03. Residentes con conjunto distinto a membership | Pendiente | Pendiente | Pendiente |
| 04. Tablas sin `conjunto_id` directo | Pendiente | Pendiente | Pendiente |
| 05. Filas con `conjunto_id` nulo | Pendiente | Pendiente | Pendiente |
| 06. Filas huérfanas / trazabilidad indirecta | Pendiente | Pendiente | Pendiente |
| 07. Reservas con trazabilidad cruzada inconsistente | Pendiente | Pendiente | Pendiente |
| 08. Roles no compatibles con UI actual | Pendiente | Pendiente | Pendiente |
| 09. Policies potencialmente amplias | Pendiente | Pendiente | Pendiente |
| 10. Tablas sensibles sin RLS | Pendiente | Pendiente | Pendiente |
| 11. Tablas con RLS sin policies | Pendiente | Pendiente | Pendiente |
| 12. Policies sin filtro tenant visible | Pendiente | Pendiente | Pendiente |

## 15. Matriz final de hallazgos

| ID | Severidad | Hallazgo | Evidencia | Impacto | Acción recomendada | Fase destino | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F3D6-P0-001 | P0 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| F3D6-P1-001 | P1 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| F3D6-P2-001 | P2 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| F3D6-P3-001 | P3 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## 16. Decisión Go/No-Go

| Criterio | Estado | Nota |
| --- | --- | --- |
| Evidencia estructural DEV real capturada | Pendiente | Pendiente |
| Cero P0 abiertos | Pendiente | Pendiente |
| P1 con plan documentado | Pendiente | Pendiente |
| RLS/policies principales inventariadas | Pendiente | Pendiente |
| Helpers legacy y tenant-aware clasificados | Pendiente | Pendiente |
| SQL Editor no usado como evidencia efectiva autenticada | Pendiente | Pendiente |
| PRD/QA no tocados | Pendiente | Pendiente |
| Migraciones/frontend/env/Vercel no tocados | Pendiente | Pendiente |
| Decisión final hacia FASE 3D.7 | Pendiente | Pendiente |

## 17. Evidencia visual o enlaces

| Evidencia | Enlace / referencia | Nota |
| --- | --- | --- |
| Captura proyecto DEV | Pendiente | Pendiente |
| Captura resultados SQL principal | Pendiente | Pendiente |
| Captura resultados SQL complementario | Pendiente | Pendiente |
| Evidencia de no PRD/QA | Pendiente | Pendiente |
