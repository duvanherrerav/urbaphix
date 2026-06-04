# FASE 3D.6 - Resultados de evidencia estructural RLS DEV

## 1. Resumen ejecutivo

FASE 3D.6 consolida la ejecución controlada de evidencia estructural RLS en Supabase **DEV** con formato listo para registrar resultados reales obtenidos manualmente por el operador desde Supabase Dashboard / SQL Editor.

El objetivo de esta fase es dejar trazabilidad de:

- inventario de tablas sensibles y estado `ROW LEVEL SECURITY` / `FORCE ROW LEVEL SECURITY`;
- policies RLS existentes por tabla sensible;
- helper functions legacy `fn_auth_*`, helper functions tenant-aware actuales y helper functions tenant-aware objetivo/futuras;
- grants relevantes sobre helpers;
- columnas de trazabilidad `conjunto_id`, `residente_id`, `user_id` y `usuario_id`;
- conteos estructurales por tabla sensible;
- consistencia entre `usuarios_app`, `residentes` y `tenant_memberships`;
- señales estructurales de riesgo tenant o cross-tenant;
- hallazgos P0/P1/P2/P3 y decisión Go/No-Go hacia FASE 3D.7.

Codex **no ejecuta SQL** ni obtiene resultados reales de Supabase. Los campos marcados como `Pendiente` deben ser diligenciados por el operador humano después de ejecutar exclusivamente los SQL autorizados en DEV.

## 2. Alcance autorizado

| Dimensión | Alcance FASE 3D.6 |
| --- | --- |
| Ambiente | Supabase DEV únicamente |
| Tipo de evidencia | Estructural con resultados reales pegados manualmente |
| Herramienta | Supabase Dashboard DEV / SQL Editor |
| Ejecutor | Operador humano autorizado |
| Cambios de base de datos | No permitidos |
| Validación efectiva autenticada | No cubierta en esta fase |
| Resultado esperado | Evidencia estructural DEV, hallazgos clasificados y Go/No-Go a FASE 3D.7 |

## 3. Prohibición explícita de PRD y QA

FASE 3D.6 **prohíbe ejecutar cualquier SQL contra PRD o QA**.

Antes de ejecutar cualquier consulta, el operador debe confirmar visualmente:

1. el proyecto seleccionado es **Urbaphix DEV**;
2. el SQL Editor abierto corresponde a DEV;
3. PRD y QA no están seleccionados ni abiertos en pestañas que puedan confundirse;
4. no se usarán credenciales, URLs, llaves ni conexiones de PRD/QA.

Si se ejecuta cualquier consulta en PRD o QA por error, detener la fase, registrar un **P0 / No-Go operativo** y solicitar revisión humana antes de continuar.

## 4. Confirmación sobre evidencia efectiva autenticada

FASE 3D.6 **no valida acceso efectivo autenticado**.

No se debe concluir en esta fase qué filas ve realmente un usuario final con JWT real, `auth.uid()` real o claims reales. SQL Editor puede ejecutarse con un rol de conexión elevado o distinto al usuario final, por lo que sus resultados no son evidencia final para validar comportamiento efectivo de RLS autenticado.

La validación efectiva autenticada queda reservada para **FASE 3D.7**, usando sesión real del frontend, cliente API con JWT válido o mecanismo aprobado que reproduzca el contexto autenticado final.

## 5. SQL autorizado para ejecutar manualmente en DEV

### 5.1 SQL principal autorizado

Ejecutar completo en Supabase SQL Editor DEV:

```text
supabase/validation/fase_3d3_rls_precheck_inventory.sql
```

Este archivo debe usarse para capturar:

- contexto de conexión;
- tablas sensibles esperadas y estado RLS/FORCE RLS;
- policies existentes;
- helper functions;
- grants `EXECUTE`;
- columnas clave tenant/residente/usuario;
- conteos por tabla sensible;
- conteos de `tenant_memberships` por estado/rol;
- duplicados activos por `user_id`/`conjunto_id`;
- memberships residentes sin `residente_id`;
- comparativo `usuarios_app` vs `tenant_memberships`.

### 5.2 SQL complementario autorizado parcialmente

De este archivo:

```text
supabase/validation/fase_3d3_rls_tenant_isolation_checks.sql
```

Ejecutar únicamente los bloques estructurales que no dependan de `auth.uid()` real, JWT real ni claims del usuario final:

| Bloque | Nombre | Autorizado en FASE 3D.6 | Motivo |
| --- | --- | --- | --- |
| 01 | Usuarios con memberships activas en más de un conjunto | Sí | Estructural |
| 02 | `usuarios_app.conjunto_id` diferente de `tenant_memberships.conjunto_id` | Sí | Estructural |
| 03 | Residentes cuyo conjunto no coincide con la membership activa | Sí | Estructural |
| 04 | Datos de tablas sensibles sin `conjunto_id` cuando deberían tener trazabilidad tenant | Sí | Estructural |
| 05 | Filas con `conjunto_id` nulo en tablas sensibles con columna `conjunto_id` | Sí | Estructural |
| 06 | Filas huérfanas por FK lógica / trazabilidad indirecta | Sí | Estructural |
| 07 | Reservas con trazabilidad cruzada inconsistente | Sí | Estructural |
| 08 | Memberships activas con roles no compatibles con UI actual | Sí | Estructural |
| 09 | Policies con condiciones potencialmente amplias según `pg_policies` | Sí | Revisión estructural textual |
| 10 | Tablas sensibles sin RLS habilitado | Sí | Estructural |
| 11 | Tablas sensibles con RLS habilitado pero sin policies | Sí | Estructural |
| 12 | Policies permissive para `anon` / `authenticated` sin filtro visible tenant/residente | Sí | Revisión estructural textual |

## 6. SQL no autorizado como evidencia final en esta fase

No usar como evidencia final de FASE 3D.6:

```text
supabase/validation/fase_3d3_rls_effective_access_checks.sql
```

Ese archivo puede servir como referencia para preparar FASE 3D.7, pero no debe presentarse como resultado final cuando la conclusión dependa de JWT real, `auth.uid()` real, claims del usuario final o evaluación efectiva de policies RLS desde un cliente autenticado.

## 7. Instrucciones paso a paso para el operador

1. Abrir Supabase Dashboard.
2. Confirmar visualmente que el proyecto seleccionado es **DEV**.
3. Confirmar que PRD y QA no están seleccionados.
4. Abrir **SQL Editor** en el proyecto DEV.
5. Copiar el contenido completo de `supabase/validation/fase_3d3_rls_precheck_inventory.sql`.
6. Revisar que el SQL copiado sea read-only y no contenga DDL/DML no autorizado.
7. Ejecutar el SQL principal en DEV.
8. Capturar resultados por sección, respetando los nombres de sección del SQL.
9. Copiar únicamente los bloques estructurales autorizados de `supabase/validation/fase_3d3_rls_tenant_isolation_checks.sql`.
10. Revisar que los bloques copiados sean read-only y no contengan DDL/DML no autorizado.
11. Ejecutar los bloques estructurales autorizados en DEV.
12. Pegar resultados en `docs/fase-3d6-formato-captura-resultados-rls-dev.md` o en una copia diligenciada del formato.
13. Clasificar hallazgos P0/P1/P2/P3 en la matriz de esta fase.
14. Definir decisión Go/No-Go hacia FASE 3D.7.
15. No ejecutar DDL/DML, no modificar datos, no crear migraciones, no cambiar RLS, no tocar frontend, no tocar `.env`, no tocar Vercel.

## 8. Precheck manual de SQL read-only

Antes de presionar **Run**, confirmar que el SQL copiado no contiene operaciones no permitidas para esta fase.

| Patrón | Permitido | Resultado revisión operador | Acción si aparece |
| --- | --- | --- | --- |
| `ALTER` | No | Pendiente | Detener ejecución y revisar |
| `CREATE` | No | Pendiente | Detener ejecución y revisar |
| `DROP` | No | Pendiente | Detener ejecución y revisar |
| `UPDATE` | No | Pendiente | Detener ejecución y revisar |
| `DELETE` | No | Pendiente | Detener ejecución y revisar |
| `INSERT` | No | Pendiente | Detener ejecución y revisar |
| `TRUNCATE` | No | Pendiente | Detener ejecución y revisar |

## 9. Formato de resultados por sección

### 9.1 Metadatos de ejecución

| Campo | Resultado real DEV |
| --- | --- |
| Operador | Pendiente |
| Fecha/hora de ejecución | Pendiente |
| Proyecto Supabase confirmado como DEV | Pendiente |
| SQL principal ejecutado | Pendiente |
| SQL complementario ejecutado | Pendiente |
| Confirmación de no PRD/QA | Pendiente |
| Confirmación de no DDL/DML | Pendiente |
| Confirmación de que Codex no ejecutó SQL | Pendiente |

### 9.2 Tablas sensibles y RLS enabled

| Tabla sensible | Existe | RLS habilitado | FORCE RLS | Conteo filas | Hallazgo asociado |
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

### 9.3 Policies por tabla

| Tabla | Policy | Comando | Roles | `USING` / `WITH CHECK` resumido | Clasificación preliminar |
| --- | --- | --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

### 9.4 Helper functions encontradas

| Helper | Existe en DEV | Tipo | Grants relevantes | Uso observado en policies | Hallazgo asociado |
| --- | --- | --- | --- | --- | --- |
| `fn_auth_conjunto_id()` | Pendiente | Legacy / `usuarios_app` | Pendiente | Pendiente | Pendiente |
| `fn_auth_rol()` | Pendiente | Legacy / `usuarios_app` | Pendiente | Pendiente | Pendiente |
| `fn_auth_residente_id()` | Pendiente | Legacy / `usuarios_app` | Pendiente | Pendiente | Pendiente |
| `fn_is_platform_superadmin()` | Pendiente | Tenant-aware / platform | Pendiente | Pendiente | Pendiente |
| `fn_has_platform_role(text)` | Pendiente | Tenant-aware / platform | Pendiente | Pendiente | Pendiente |
| `fn_has_tenant_access(uuid)` | Pendiente | Tenant-aware / tenant | Pendiente | Pendiente | Pendiente |
| `fn_has_tenant_role(uuid, text)` | Pendiente | Tenant-aware / tenant | Pendiente | Pendiente | Pendiente |

### 9.5 Grants relevantes

| Función / objeto | Grantee | Privilegio | Riesgo preliminar | Hallazgo asociado |
| --- | --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

### 9.6 Columnas tenant/residente/user

| Tabla | `conjunto_id` | `residente_id` | `user_id` | `usuario_id` | Observación |
| --- | --- | --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

### 9.7 Conteos estructurales

| Tabla | Conteo DEV | Datos suficientes para validar estructura | Observación |
| --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente |

### 9.8 `tenant_memberships` por estado/rol

| `status` | `role_name` | Conteo | Observación |
| --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente |

### 9.9 Duplicados de memberships activas

| `user_id` | `conjunto_id` | Conteo memberships activas | Roles involucrados | Hallazgo asociado |
| --- | --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

### 9.10 `usuarios_app` vs `tenant_memberships`

| Caso | Conteo / filas | Riesgo preliminar | Hallazgo asociado |
| --- | --- | --- | --- |
| Usuario operativo sin membership activa | Pendiente | Pendiente | Pendiente |
| Membership activa sin usuario en `usuarios_app` | Pendiente | Pendiente | Pendiente |
| `conjunto_id` divergente entre ambas fuentes | Pendiente | Pendiente | Pendiente |
| Rol divergente entre ambas fuentes | Pendiente | Pendiente | Pendiente |

### 9.11 Residentes sin usuario/membership

| Caso | Conteo / filas | Riesgo preliminar | Hallazgo asociado |
| --- | --- | --- | --- |
| Residente activo sin `usuario_id` | Pendiente | Pendiente | Pendiente |
| Residente con usuario sin membership residente activa | Pendiente | Pendiente | Pendiente |
| Membership residente activa sin `residente_id` | Pendiente | Pendiente | Pendiente |
| Residente con `conjunto_id` distinto al de membership | Pendiente | Pendiente | Pendiente |

### 9.12 Riesgos estructurales tenant

| Riesgo | Evidencia real DEV | Severidad preliminar | Requiere validación efectiva FASE 3D.7 |
| --- | --- | --- | --- |
| Tabla sensible con datos y RLS deshabilitado | Pendiente | Pendiente | Pendiente |
| Tabla sensible con RLS habilitado pero sin policies | Pendiente | Pendiente | Pendiente |
| Policy amplia sin filtro tenant/residente/user/helper visible | Pendiente | Pendiente | Pendiente |
| Fila con `conjunto_id` nulo en tabla sensible | Pendiente | Pendiente | Pendiente |
| Trazabilidad cruzada inconsistente | Pendiente | Pendiente | Pendiente |
| Dependencia legacy `fn_auth_*` en tabla sensible | Pendiente | Pendiente | Pendiente |
| Grants amplios sobre helpers o tablas sensibles | Pendiente | Pendiente | Pendiente |

## 10. Matriz de hallazgos P0/P1/P2/P3

| ID | Severidad | Hallazgo | Evidencia real DEV | Impacto | Acción recomendada | Fase destino | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F3D6-P0-001 | P0 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| F3D6-P1-001 | P1 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| F3D6-P2-001 | P2 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| F3D6-P3-001 | P3 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## 11. Clasificación de severidad

### P0 - Bloqueante

Clasificar como P0 si aparece cualquiera de estos casos:

- tabla sensible con datos reales sin RLS habilitado;
- tabla sensible con datos reales sin policies;
- evidencia estructural de posible exposición cross-tenant directa;
- inconsistencia crítica entre `usuarios_app` y `tenant_memberships` en usuarios operativos principales;
- dependencia estructural que impida validar roles `admin_conjunto`, vigilancia/residente o residente en FASE 3D.7;
- consulta ejecutada por error fuera de DEV.

### P1 - Alto

Clasificar como P1 si aparece cualquiera de estos casos:

- policies demasiado permisivas a nivel estructural;
- uso de helpers legacy `fn_auth_*` en policies sensibles sin estrategia tenant-aware definida;
- duplicidad de memberships activas sin regla clara;
- residentes activos sin trazabilidad clara;
- grants amplios sobre tablas sensibles o helpers relevantes.

### P2 - Medio

Clasificar como P2 si aparece cualquiera de estos casos:

- documentación de schema desactualizada;
- tablas sin datos suficientes para validación estructural;
- roles no homologados sin evidencia de fuga;
- columnas tenant/residente inconsistentes sin impacto directo confirmado.

### P3 - Bajo

Clasificar como P3 si aparece cualquiera de estos casos:

- evidencia visual pendiente;
- comentarios SQL mejorables;
- nomenclatura o formato del reporte por mejorar;
- mejoras menores de presentación.

## 12. Tabla de decisiones por hallazgo

| Hallazgo | Severidad | Evidencia | Impacto | Acción recomendada | Fase destino | Decisión |
| --- | --- | --- | --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## 13. Criterios Go hacia FASE 3D.7

Se puede avanzar a FASE 3D.7 si todos estos criterios quedan satisfechos:

- se capturó evidencia estructural DEV real;
- no hay P0 estructural abierto;
- todos los P1 tienen plan documentado;
- RLS y policies de tablas sensibles principales quedaron inventariadas;
- helpers legacy y tenant-aware quedaron clasificados;
- no se confundió SQL Editor con evidencia efectiva autenticada;
- PRD y QA no fueron tocados;
- no hubo cambios en migraciones, RLS, helpers, tablas, datos, frontend, `.env` o Vercel.

## 14. Criterios No-Go

No avanzar a FASE 3D.7 si ocurre cualquiera de estos casos:

- aparece tabla sensible con datos reales sin RLS y sin plan inmediato;
- aparece tabla sensible con datos reales sin policies y sin plan inmediato;
- se detecta posible fuga cross-tenant estructural;
- no se puede identificar trazabilidad tenant en tablas sensibles;
- se intenta usar SQL Editor como evidencia final de `auth.uid()` real;
- se toca PRD, QA, migraciones, RLS, helpers, frontend, `.env` o Vercel por error;
- quedan usuarios operativos principales sin trazabilidad mínima para ejecutar validación efectiva autenticada.

## 15. Decisión final FASE 3D.6

| Campo | Resultado |
| --- | --- |
| Evidencia estructural DEV capturada | Pendiente |
| P0 abiertos | Pendiente |
| P1 con plan documentado | Pendiente |
| PRD/QA no tocados | Pendiente |
| SQL Editor no usado como evidencia efectiva autenticada | Pendiente |
| Decisión Go/No-Go a FASE 3D.7 | Pendiente |
| Responsable de decisión | Pendiente |
| Fecha de decisión | Pendiente |

## 16. Comentario sugerido para cierre del issue

```text
FASE 3D.6 ejecutó y documentó evidencia estructural RLS DEV únicamente. La evidencia fue capturada manualmente por el operador en Supabase DEV / SQL Editor usando SQL read-only autorizado. Codex no ejecutó SQL contra Supabase. No se tocó PRD, QA, migraciones, RLS, helpers, tablas, datos, frontend, .env ni Vercel. No se validó acceso efectivo autenticado ni se usó SQL Editor como evidencia final de auth.uid() real. La decisión Go/No-Go hacia FASE 3D.7 queda registrada con hallazgos P0/P1/P2/P3 y planes asociados.
```

## 17. Recomendación de siguiente fase

Si la decisión final es **Go**, iniciar **FASE 3D.7 - Validación efectiva autenticada RLS DEV** con usuarios reales de prueba por rol y mecanismo aprobado de sesión/JWT real.

FASE 3D.7 debe validar, como mínimo:

- `admin_conjunto` autenticado;
- vigilancia / `vigilante` autenticado;
- residente autenticado;
- acceso esperado por módulo;
- ausencia de exposición cross-tenant efectiva;
- diferencias entre resultados estructurales FASE 3D.6 y comportamiento real autenticado.

Si la decisión final es **No-Go**, abrir fase correctiva específica para resolver P0/P1 antes de ejecutar validación efectiva autenticada.
