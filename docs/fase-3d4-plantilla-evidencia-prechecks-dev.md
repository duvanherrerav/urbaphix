# FASE 3D.4 - Plantilla de evidencia de prechecks RLS DEV

> Usar una copia de esta plantilla por ejecución controlada en Supabase DEV. No pegar secretos, tokens, credenciales ni datos personales innecesarios. SQL Editor solo es evidencia estructural; no es evidencia final de acceso efectivo si el resultado depende de `auth.uid()` / JWT real.

## 1. Metadatos de ejecución

| Campo | Valor |
| --- | --- |
| Ambiente | DEV |
| Proyecto Supabase confirmado visualmente | Pendiente |
| Fecha de ejecución | Pendiente |
| Hora de inicio / fin | Pendiente |
| Operador | Pendiente |
| Revisor | Pendiente |
| Rama / commit del repositorio usado | Pendiente |
| Confirmación PRD no tocado | Pendiente |
| Ubicación de evidencias externas | Pendiente |
| Método(s) de ejecución usados | SQL Editor / frontend session / API-JWT / simulación controlada |

## 2. Validación previa read-only

| Validación | Resultado | Evidencia / notas |
| --- | --- | --- |
| `fase_3d3_rls_precheck_inventory.sql` no contiene DDL/DML prohibido | Pendiente |  |
| `fase_3d3_rls_effective_access_checks.sql` no contiene DDL/DML prohibido | Pendiente |  |
| `fase_3d3_rls_tenant_isolation_checks.sql` no contiene DDL/DML prohibido | Pendiente |  |
| No se modificaron migraciones | Pendiente |  |
| No se modificó frontend/package/Vite | Pendiente |  |
| No se modificaron `.env` | Pendiente |  |
| Limitación de SQL Editor para `auth.uid()` registrada | Pendiente |  |
| Método de evidencia efectiva aprobado antes de ejecutar checks por rol | Pendiente |  |

DDL/DML prohibido para esta fase: `ALTER`, `CREATE`, `DROP`, `UPDATE`, `DELETE`, `INSERT`, `TRUNCATE`.

## 3. Usuarios de prueba DEV

| Perfil | Disponible | `user_id` | `conjunto_id` esperado | `residente_id` esperado | Estado membership | Fuente del dato | Notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `admin_conjunto` | Pendiente | Pendiente | Pendiente | N/A | Pendiente | Pendiente |  |
| vigilancia / `vigilante` | Pendiente | Pendiente | Pendiente | N/A | Pendiente | Pendiente |  |
| `residente` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |
| Sin membership activa | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |
| Datos inconsistentes | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |

## 4. Evidencia estructural SQL 01 - Inventario RLS

| Item | Resultado | Evidencia / archivo | Hallazgo asociado |
| --- | --- | --- | --- |
| Contexto de ejecución DEV confirmado | Pendiente |  |  |
| Método de ejecución: SQL Editor DEV | Pendiente |  |  |
| `auth.uid()` observado tratado solo como diagnóstico, no como sesión real | Pendiente |  |  |
| Tablas sensibles existentes/faltantes | Pendiente |  |  |
| RLS habilitado por tabla sensible | Pendiente |  |  |
| FORCE RLS por tabla sensible | Pendiente |  |  |
| Policies por tabla/comando | Pendiente |  |  |
| Helpers legacy presentes | Pendiente |  |  |
| Helpers tenant-aware presentes | Pendiente |  |  |
| Grants `EXECUTE` relevantes | Pendiente |  |  |
| Columnas clave por tabla sensible | Pendiente |  |  |
| Conteos por tabla sensible | Pendiente |  |  |
| `tenant_memberships` por `status` y `role_name` | Pendiente |  |  |
| Duplicados activos por `user_id` / `conjunto_id` | Pendiente |  |  |
| Memberships residentes activas sin `residente_id` | Pendiente |  |  |
| Comparativo `usuarios_app` vs `tenant_memberships` | Pendiente |  |  |

## 5. Evidencia efectiva 02 - Acceso por rol autenticado

Duplicar esta sección por cada usuario ejecutado. Esta sección solo es válida para Go si el método fue `frontend session`, `API/JWT` o `simulación controlada aprobada`. Si el método fue solo `SQL Editor` y el check dependía de `auth.uid()` / JWT real, marcar como **No válido para Go**.

### 5.1 Usuario de prueba

| Campo | Valor |
| --- | --- |
| Perfil ejecutado | Pendiente |
| Método de ejecución | frontend session / API-JWT / simulación controlada / SQL Editor diagnóstico |
| ¿Depende de `auth.uid()` / JWT real? | Pendiente |
| ¿SQL Editor fue la única evidencia? | Pendiente |
| Validez para Go | Pendiente |
| Usuario autenticado probado | Pendiente |
| `expected_user_id` | Pendiente |
| `expected_conjunto_id` | Pendiente |
| `expected_residente_id` | Pendiente |
| Origen de placeholders | Pendiente |
| Evidencia Network/API o aprobación de simulación | Pendiente |
| Tokens/JWT ocultos o no persistidos | Pendiente |
| Resultado general | Pendiente |

### 5.2 Resultado por módulo

| Módulo / check | Método | Endpoint/query equivalente | Filas esperadas visibles | Filas visibles fuera de tenant/residente | Status/resultado | Evidencia Network/API sanitizada | Hallazgo asociado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard Admin | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Pagos | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Crear cobro | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Mis pagos | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Incidentes | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Reportar incidente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Reservas Admin | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Reservas Residente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Control de visitas / vigilancia | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Solicitar visita / residente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Paquetería vigilancia/admin | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Mis paquetes residente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Notificaciones | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Config pagos | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |
| Archivos/documentos | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |  |  |

## 6. Evidencia estructural SQL 03 - Aislamiento tenant

| Check | Método de ejecución | Depende de `auth.uid()` real | Resultado | Evidencia / archivo | Severidad preliminar | Hallazgo asociado |
| --- | --- | --- | --- | --- | --- | --- |
| Memberships activas en más de un conjunto | SQL Editor DEV | No | Pendiente |  | Pendiente |  |
| Diferencias `usuarios_app` vs `tenant_memberships` | SQL Editor DEV | No | Pendiente |  | Pendiente |  |
| Residentes inconsistentes con membership | SQL Editor DEV | No | Pendiente |  | Pendiente |  |
| Tablas sensibles sin `conjunto_id` directo | SQL Editor DEV | No | Pendiente |  | Pendiente |  |
| Filas con `conjunto_id` nulo | SQL Editor DEV | No | Pendiente |  | Pendiente |  |
| Filas huérfanas o inconsistentes | SQL Editor DEV | No | Pendiente |  | Pendiente |  |
| Reservas con trazabilidad cruzada inconsistente | SQL Editor DEV | No | Pendiente |  | Pendiente |  |
| Roles activos no compatibles con UI actual | SQL Editor DEV | No | Pendiente |  | Pendiente |  |
| Policies potencialmente amplias | SQL Editor DEV | No | Pendiente |  | Pendiente |  |
| Tablas sensibles sin RLS | SQL Editor DEV | No | Pendiente |  | Pendiente |  |
| Tablas sensibles con RLS pero sin policies | SQL Editor DEV | No | Pendiente |  | Pendiente |  |
| Policies permissive para `anon` / `authenticated` sin filtro visible | SQL Editor DEV | No | Pendiente |  | Pendiente |  |

## 7. Registro de hallazgos

| ID | Severidad | Estado | Módulo | Tabla/policy/helper | Usuario afectado | Descripción | Evidencia | Owner | Acción siguiente |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F3D4-001 | Pendiente | Abierto | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

### Guía rápida de severidad

- **P0 - Bloqueante:** fuga cross-tenant, tabla sensible sin RLS con datos reales, usuario sin membership con acceso protegido, PRD tocado, SQL no read-only o acceso efectivo aceptado solo desde SQL Editor cuando dependía de `auth.uid()` / JWT real.
- **P1 - Alto:** policy demasiado amplia sin fuga confirmada, helpers legacy inconsistentes, datos críticos no reconciliados, datos huérfanos con impacto RLS.
- **P2 - Medio:** documentación desactualizada, falta de datos para validar módulo, roles no homologados sin acceso indebido.
- **P3 - Bajo:** nomenclatura, comentarios, formato o evidencia visual pendiente.

## 8. Decisión Go / No-Go

| Criterio | Cumple | Evidencia / notas |
| --- | --- | --- |
| SQL read-only confirmado | Pendiente |  |
| Inventario DEV sin errores críticos | Pendiente |  |
| Evidencia efectiva por rol viene de frontend session, API/JWT o simulación aprobada | Pendiente |  |
| Ningún check dependiente de `auth.uid()` fue aprobado solo con SQL Editor | Pendiente |  |
| Sin P0 cross-tenant | Pendiente |  |
| Usuarios de prueba por rol identificados | Pendiente |  |
| Tablas sensibles inventariadas | Pendiente |  |
| P1/P2 con plan claro | Pendiente |  |
| PRD no tocado | Pendiente |  |
| Network/API evidencia sanitizada y tokens ocultos cuando aplica | Pendiente |  |

Decisión final:

- [ ] Go a QA
- [ ] Go a FASE 3D.5
- [ ] No-Go

Justificación:

```text
Pendiente.
```

## 9. Recomendación para FASE 3D.5

```text
Pendiente. Indicar si se recomienda hardening RLS controlado, investigación adicional, creación de fixtures DEV o corrección inmediata de P0/P1.
```
