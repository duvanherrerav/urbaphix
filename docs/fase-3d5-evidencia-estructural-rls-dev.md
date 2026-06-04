# FASE 3D.5 - Evidencia estructural RLS DEV

## 1. Resumen ejecutivo

FASE 3D.5 ejecuta y documenta el **primer bloque de evidencia estructural RLS** en Supabase **DEV** a partir de los SQL read-only preparados en FASE 3D.3 y la guía operativa de FASE 3D.4.

El objetivo es obtener evidencia segura sobre el estado real de:

- RLS habilitado o deshabilitado por tabla sensible;
- `FORCE ROW LEVEL SECURITY` cuando aplique;
- policies existentes por tabla sensible;
- helper functions legacy, tenant-aware actuales y tenant-aware objetivo/futuras;
- grants relevantes sobre helpers;
- columnas tenant/residente/usuario (`conjunto_id`, `residente_id`, `user_id`, `usuario_id`);
- conteos estructurales por tabla sensible;
- consistencia documental entre `usuarios_app`, `residentes` y `tenant_memberships`;
- señales estructurales de riesgo cross-tenant antes de validar acceso efectivo autenticado.

Esta fase **no modifica base de datos, frontend, variables de entorno, Vercel ni migraciones**. La salida esperada es una plantilla parcialmente diligenciada con resultados DEV, una matriz de hallazgos P0/P1/P2/P3 y una recomendación explícita sobre si se puede avanzar a FASE 3D.6.

## 2. Alcance de la fase

Alcance autorizado:

- Ambiente único: **Supabase DEV**.
- Herramienta autorizada: **Supabase Dashboard DEV / SQL Editor**.
- Tipo de evidencia: **estructural únicamente**.
- SQL principal autorizado: `supabase/validation/fase_3d3_rls_precheck_inventory.sql`.
- SQL complementario autorizado: solo bloques estructurales de `supabase/validation/fase_3d3_rls_tenant_isolation_checks.sql` que no dependan de `auth.uid()` real ni de claims JWT.
- Resultado documental: registrar evidencia en este documento o en una copia diligenciada de `docs/fase-3d4-plantilla-evidencia-prechecks-dev.md`.

Fuera de alcance:

- Ejecutar SQL contra PRD o QA.
- Ejecutar SQL desde Codex, CLI, scripts locales o conexiones directas a Supabase.
- Validar acceso efectivo con sesión/JWT real de usuario autenticado.
- Usar SQL Editor como prueba final de `auth.uid()` real.
- Crear migraciones.
- Modificar RLS, policies, helpers SQL, tablas, columnas o datos.
- Modificar frontend funcional, `.env`, Vercel, `package.json`, `package-lock.json` o `vite.config.*`.

## 3. Prohibición explícita de PRD y QA

**PRD y QA están prohibidos en FASE 3D.5.**

Antes de ejecutar cualquier consulta, el operador debe confirmar visualmente:

1. que está autenticado en Supabase Dashboard;
2. que el proyecto seleccionado es el proyecto **DEV** de Urbaphix;
3. que el SQL Editor corresponde a DEV;
4. que no hay pestañas abiertas de PRD o QA que puedan confundirse con DEV.

Si se detecta PRD o QA abierto por error:

- detener la ejecución;
- no copiar ni ejecutar SQL;
- registrar el incidente en la matriz como **P0 / No-Go operativo** si se ejecutó cualquier consulta fuera de DEV;
- solicitar validación humana antes de continuar.

## 4. Evidencia estructural vs evidencia efectiva autenticada

### 4.1 Evidencia estructural aceptada en FASE 3D.5

La evidencia estructural responde preguntas de inventario y consistencia documental, por ejemplo:

- ¿La tabla sensible existe en DEV?
- ¿RLS está habilitado?
- ¿`FORCE RLS` está habilitado?
- ¿Qué policies existen y cuál es su definición textual?
- ¿Qué helpers existen y qué grants tienen?
- ¿La tabla tiene columnas de trazabilidad tenant/residente/usuario?
- ¿Cuántas filas existen por tabla sensible?
- ¿Hay memberships duplicadas activas?
- ¿Hay diferencias estructurales entre `usuarios_app` y `tenant_memberships`?
- ¿Hay residentes activos sin `usuario_id` o sin membership esperada?

Esta evidencia puede capturarse desde SQL Editor DEV porque no intenta demostrar el comportamiento real de un usuario autenticado final.

### 4.2 Evidencia efectiva autenticada no cubierta por FASE 3D.5

La evidencia efectiva autenticada responde preguntas como:

- ¿Qué filas ve realmente un `admin_conjunto` con JWT real?
- ¿Qué filas ve realmente un residente con `auth.uid()` real?
- ¿Qué operaciones permite o rechaza PostgREST usando la sesión real del frontend?
- ¿Existe fuga cross-tenant cuando el usuario autenticado intenta consultar otro `conjunto_id`?

Esta evidencia **no se cierra en FASE 3D.5**. Debe obtenerse en FASE 3D.6 o posterior mediante sesión real del frontend, cliente API con JWT válido o mecanismo aprobado que reproduzca fielmente el contexto autenticado final.

> Nota operativa: SQL Editor puede ejecutarse con un rol elevado o distinto al usuario final. Por eso no debe usarse como evidencia final cuando la conclusión dependa de `auth.uid()`, claims JWT o evaluación RLS como usuario autenticado final.

## 5. SQL autorizado para esta fase

### 5.1 SQL principal autorizado

Ejecutar completo en SQL Editor DEV:

```text
supabase/validation/fase_3d3_rls_precheck_inventory.sql
```

Este SQL contiene únicamente consultas de inventario estructural para:

1. contexto de conexión;
2. tablas sensibles esperadas y estado RLS/FORCE RLS;
3. policies por tabla sensible;
4. helpers legacy actuales, helpers tenant-aware existentes y helpers tenant-aware objetivo/futuros;
5. grants `EXECUTE` de helpers relevantes;
6. columnas clave por tabla sensible;
7. conteos por tabla sensible;
8. conteos de `tenant_memberships` por `status` y `role_name`;
9. duplicados activos por `user_id`/`conjunto_id`;
10. residentes con membership residente sin `residente_id`;
11. comparativo general `usuarios_app` vs `tenant_memberships`.

### 5.2 SQL complementario permitido parcialmente

De `supabase/validation/fase_3d3_rls_tenant_isolation_checks.sql`, ejecutar solo bloques que sean estructurales y no dependan de sesión real:

- `01. Usuarios con memberships activas en más de un conjunto`;
- `02. usuarios_app.conjunto_id diferente de tenant_memberships.conjunto_id`;
- `03. Residentes cuyo conjunto no coincide con la membership activa`;
- `04. Datos de tablas sensibles sin conjunto_id cuando deberían tener trazabilidad tenant`;
- `05. Filas con conjunto_id nulo en tablas sensibles con columna conjunto_id`;
- `06. Filas huérfanas por FK lógica / trazabilidad indirecta`;
- `07. Reservas con trazabilidad cruzada inconsistente`;
- `08. Memberships activas con roles no compatibles con UI actual`;
- `09. Policies con condiciones potencialmente amplias según pg_policies`;
- `10. Tablas sensibles sin RLS habilitado`;
- `11. Tablas sensibles con RLS habilitado pero sin policies`;
- `12. Policies permissive para anon/authenticated sin filtro visible tenant/residente`.

Si un bloque devuelve filas, no significa automáticamente fuga efectiva. En FASE 3D.5 se interpreta como señal estructural que requiere clasificación P0/P1/P2/P3 y, cuando aplique, validación efectiva posterior.

## 6. SQL no aceptado como evidencia final en esta fase

No usar como cierre final de FASE 3D.5:

```text
supabase/validation/fase_3d3_rls_effective_access_checks.sql
```

Motivo: sus secciones están diseñadas para validar acceso efectivo de módulos funcionales y pueden depender de `auth.uid()`, rol efectivo, claims JWT o contexto real del usuario final. Si se ejecutan desde SQL Editor, los resultados pueden reflejar un rol elevado o contexto no equivalente al frontend.

El archivo puede revisarse solo para preparar FASE 3D.6, pero sus resultados no deben marcarse como evidencia efectiva final en FASE 3D.5.

## 7. Paso a paso para el operador en Supabase Dashboard DEV

1. Abrir Supabase Dashboard.
2. Confirmar visualmente que el proyecto seleccionado es **DEV**.
3. Abrir SQL Editor.
4. Crear un snippet temporal llamado `FASE 3D5 DEV - evidencia estructural - 01 inventario`.
5. Copiar el contenido completo de `supabase/validation/fase_3d3_rls_precheck_inventory.sql`.
6. Antes de ejecutar, confirmar que el SQL no contiene instrucciones no permitidas:
   - `ALTER`;
   - `CREATE`;
   - `DROP`;
   - `UPDATE`;
   - `DELETE`;
   - `INSERT`;
   - `TRUNCATE`.
7. Ejecutar el SQL con **Run**.
8. Capturar cada result set con:
   - nombre de sección;
   - fecha/hora UTC o local;
   - ambiente `DEV`;
   - operador;
   - captura visual o export CSV;
   - resumen textual sin datos sensibles innecesarios.
9. Crear un segundo snippet temporal llamado `FASE 3D5 DEV - evidencia estructural - 02 tenant isolation`.
10. Copiar solamente los bloques estructurales autorizados de `supabase/validation/fase_3d3_rls_tenant_isolation_checks.sql`.
11. Repetir la revisión de SQL no permitido.
12. Ejecutar y capturar resultados.
13. Diligenciar la sección 8 de este documento o una copia de la plantilla de FASE 3D.4.
14. Clasificar hallazgos en la matriz P0/P1/P2/P3.
15. Definir Go/No-Go para FASE 3D.6.

## 8. Plantilla diligenciada parcial de evidencia estructural DEV

> Estado inicial: pendiente de diligenciar por el operador después de ejecutar manualmente en Supabase SQL Editor DEV. Codex no ejecutó SQL contra Supabase.

### 8.1 Metadatos de ejecución

| Campo | Valor |
| --- | --- |
| Fase | FASE 3D.5 |
| Ambiente autorizado | DEV |
| Ambientes prohibidos | PRD, QA |
| Operador | Pendiente |
| Fecha/hora de ejecución | Pendiente |
| Método | Supabase Dashboard DEV / SQL Editor |
| SQL principal | `supabase/validation/fase_3d3_rls_precheck_inventory.sql` |
| SQL complementario | Bloques estructurales autorizados de `supabase/validation/fase_3d3_rls_tenant_isolation_checks.sql` |
| Confirmación sin SQL directo desde Codex | Pendiente |
| Confirmación sin cambios DB | Pendiente |
| Confirmación sin frontend/env/Vercel | Pendiente |

### 8.2 RLS enabled/disabled y FORCE RLS por tabla sensible

| Tabla sensible | Existe | RLS habilitado | FORCE RLS | Conteo filas | Evidencia capturada | Hallazgo |
| --- | --- | --- | --- | ---: | --- | --- |
| `usuarios_app` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `tenant_memberships` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `platform_memberships` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `conjuntos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `residentes` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `pagos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `pagos_eventos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `registro_visitas` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `visitantes` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `paquetes` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `incidentes` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `reservas` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `reservas_zonas` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `reservas_eventos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `reservas_documentos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `reservas_bloqueos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `notificaciones` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `archivos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| `config_pagos` | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

### 8.3 Policies por tabla

| Tabla | Policy | Comando | Roles | Permissive/Restrictive | Expresión `USING` | Expresión `WITH CHECK` | Interpretación |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

Registrar especialmente:

- policies `permissive` sobre `anon` o `authenticated`;
- expressions con `true`;
- ausencia de filtros visibles por `conjunto_id`, `residente_id`, `user_id`, `usuario_id`, `auth.uid()` o helpers tenant-aware basados en `tenant_memberships`;
- helpers legacy usados sin estrategia tenant-aware clara;
- dependencias de policies sensibles sobre `fn_auth_conjunto_id()`, `fn_auth_rol()` o `fn_auth_residente_id()` que deban quedar registradas como legacy pendiente de revisión.

### 8.4 Helper functions encontradas y grants relevantes

Alinear la clasificación con FASE 3D.1, FASE 3D.2 y FASE 3D.3:

- `fn_auth_conjunto_id()`, `fn_auth_rol()` y `fn_auth_residente_id()` son **helpers legacy / `usuarios_app`** en la arquitectura actual, porque resuelven autorización desde `usuarios_app` y `residentes`, no desde `tenant_memberships`.
- Los helpers tenant-aware objetivo son los basados en `tenant_memberships` o plataforma, por ejemplo `fn_has_tenant_access(uuid)`, `fn_has_tenant_role(uuid, text)`, `fn_is_platform_superadmin()` y `fn_has_platform_role(text)` cuando existan en DEV.
- Si una policy sensible depende de los helpers `fn_auth_*`, registrarla como **dependencia legacy pendiente de revisión** antes de FASE 3D.6/hardening posterior.

| Helper | Categoría esperada | Existe en DEV | Roles con `EXECUTE` | Riesgo documental | Evidencia |
| --- | --- | --- | --- | --- | --- |
| `fn_auth_conjunto_id` | legacy / `usuarios_app` | Pendiente | Pendiente | Dependencia legacy pendiente de revisión si aparece en policy sensible | Pendiente |
| `fn_auth_rol` | legacy / `usuarios_app` | Pendiente | Pendiente | Dependencia legacy pendiente de revisión si aparece en policy sensible | Pendiente |
| `fn_auth_residente_id` | legacy / `usuarios_app` + `residentes` | Pendiente | Pendiente | Dependencia legacy pendiente de revisión si aparece en policy sensible | Pendiente |
| `fn_has_tenant_access` | tenant-aware objetivo / `tenant_memberships` | Pendiente | Pendiente | Pendiente | Pendiente |
| `fn_has_tenant_role` | tenant-aware objetivo / `tenant_memberships` | Pendiente | Pendiente | Pendiente | Pendiente |
| `fn_is_platform_superadmin` | platform-aware objetivo | Pendiente | Pendiente | Pendiente | Pendiente |
| `fn_has_platform_role` | platform-aware objetivo | Pendiente | Pendiente | Pendiente | Pendiente |
| Otros helpers legacy detectados por SQL | legacy pendiente de migración tenant-aware | Pendiente | Pendiente | Pendiente | Pendiente |

### 8.5 Columnas tenant/residente/usuario

| Tabla | `conjunto_id` | `residente_id` | `user_id` | `usuario_id` | Interpretación |
| --- | --- | --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

Marcar como **requiere revisión** toda tabla sensible con datos y sin trazabilidad tenant directa o indirecta documentada.

### 8.6 Conteos y consistencia de memberships

| Control | Resultado esperado | Resultado DEV | Hallazgo |
| --- | --- | --- | --- |
| Conteos por tabla sensible | Conocer volumen real o confirmar tablas vacías | Pendiente | Pendiente |
| Conteos `tenant_memberships` por `status` y `role_name` | Roles esperados y estados controlados | Pendiente | Pendiente |
| Memberships activas duplicadas por `user_id`/`conjunto_id` | 0 o criterio documentado | Pendiente | Pendiente |
| Usuarios con memberships activas en más de un conjunto | Esperado solo si hay caso multi-tenant documentado | Pendiente | Pendiente |
| `usuarios_app.conjunto_id` distinto de membership activa | 0 para usuarios operativos principales, salvo excepción documentada | Pendiente | Pendiente |
| Residentes sin usuario | 0 o justificación documental | Pendiente | Pendiente |
| Residentes sin membership | 0 para residentes operativos con acceso app, salvo excepción documentada | Pendiente | Pendiente |
| Membership residente sin `residente_id` | 0 o plan de corrección | Pendiente | Pendiente |

### 8.7 Señales estructurales tenant/residente

| Control | Resultado DEV | Clasificación inicial | Evidencia |
| --- | --- | --- | --- |
| Filas con `conjunto_id` nulo en tablas sensibles | Pendiente | Pendiente | Pendiente |
| Filas huérfanas por FK lógica / trazabilidad indirecta | Pendiente | Pendiente | Pendiente |
| Reservas con trazabilidad cruzada inconsistente | Pendiente | Pendiente | Pendiente |
| Roles activos no compatibles con UI actual | Pendiente | Pendiente | Pendiente |
| Policies potencialmente amplias por metadata | Pendiente | Pendiente | Pendiente |
| Tablas sensibles sin RLS habilitado | Pendiente | Pendiente | Pendiente |
| Tablas sensibles con RLS habilitado pero sin policies | Pendiente | Pendiente | Pendiente |
| Policies permissive sin filtro visible tenant/residente | Pendiente | Pendiente | Pendiente |

## 9. Matriz de hallazgos P0/P1/P2/P3

| ID | Severidad | Hallazgo | Evidencia | Impacto | Acción requerida | Responsable | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F3D5-001 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

### 9.1 P0 - Bloqueante

Clasificar como **P0** si se observa cualquiera de los siguientes casos:

- tabla sensible con datos reales sin RLS habilitado;
- tabla sensible con datos reales, RLS habilitado, pero sin policies efectivas y sin explicación operativa;
- hallazgo estructural que indique posibilidad directa de acceso cross-tenant;
- inconsistencia crítica entre `tenant_memberships` y `usuarios_app` en usuarios operativos principales;
- ejecución accidental o intento de ejecución en PRD/QA.

### 9.2 P1 - Alto

Clasificar como **P1** si se observa:

- policies demasiado permisivas a nivel documental o estructural;
- helpers legacy, incluidos `fn_auth_conjunto_id()`, `fn_auth_rol()` o `fn_auth_residente_id()`, usados en policies sensibles sin estrategia tenant-aware clara;
- duplicidad de memberships activas para el mismo usuario sin criterio documentado;
- residentes activos sin trazabilidad clara a membership;
- grants `EXECUTE` amplios sobre helpers sensibles que requieren revisión prioritaria.

### 9.3 P2 - Medio

Clasificar como **P2** si se observa:

- documentación de schema desactualizada frente a DEV;
- tablas sin datos suficientes para validar;
- roles activos no homologados sin evidencia de fuga directa;
- grants amplios que requieren revisión pero no demuestran fuga directa;
- columnas tenant/residente ausentes donde existe trazabilidad indirecta pendiente de documentar.

### 9.4 P3 - Bajo

Clasificar como **P3** si se observa:

- comentarios SQL por mejorar;
- nombres poco claros;
- evidencia visual pendiente;
- mejoras de formato en plantilla o checklist.

## 10. Criterios Go para pasar a evidencia efectiva autenticada DEV

Se puede avanzar a FASE 3D.6 si se cumplen todos los criterios:

- evidencia estructural DEV capturada y anexada;
- no hay P0 estructural abierto;
- cada P1 tiene plan documentado, responsable y estado;
- tablas sensibles principales tienen RLS/policies inventariadas;
- helpers usados por RLS están identificados y clasificados como legacy / `usuarios_app`, tenant-aware actual u objetivo/futuro;
- grants relevantes están documentados;
- columnas `conjunto_id`, `residente_id`, `user_id` y `usuario_id` están inventariadas donde existan;
- conteos de tablas sensibles y memberships están registrados;
- diferencias `usuarios_app` vs `tenant_memberships` están revisadas o clasificadas;
- queda explícito que falta evidencia efectiva autenticada con sesión/JWT real;
- PRD, QA, frontend, `.env`, Vercel, migraciones, helpers y policies no fueron tocados.

## 11. Criterios No-Go

No avanzar a FASE 3D.6 si ocurre cualquiera de estos casos:

- se identifica tabla sensible con datos reales sin RLS y sin plan inmediato;
- hay policies claramente permisivas sobre tablas sensibles sin mitigación;
- se confunde SQL Editor con evidencia de usuario autenticado real;
- no se puede identificar la estructura tenant de tablas sensibles principales;
- se ejecutó SQL fuera de DEV;
- se tocó PRD, QA, migraciones, RLS, frontend, `.env` o Vercel por error;
- no se capturó evidencia suficiente para reproducir la interpretación del hallazgo.

## 12. Formato de comentario final para cerrar la fase

Usar el siguiente formato en el PR o issue de cierre:

```markdown
## FASE 3D.5 - Cierre evidencia estructural RLS DEV

### Ambiente
- DEV confirmado: Sí/No
- PRD/QA tocados: No/Sí, detalle
- Fecha/hora ejecución:
- Operador:

### SQL ejecutado
- `supabase/validation/fase_3d3_rls_precheck_inventory.sql`: Sí/No
- Bloques estructurales de `supabase/validation/fase_3d3_rls_tenant_isolation_checks.sql`: Sí/No
- SQL efectivo autenticado usado como evidencia final: No

### Evidencia capturada
- RLS/FORCE RLS por tabla: Sí/No
- Policies por tabla: Sí/No
- Helpers y grants: Sí/No
- Columnas tenant/residente/usuario: Sí/No
- Conteos por tabla sensible: Sí/No
- Conteos y consistencia de memberships: Sí/No
- Señales estructurales cross-tenant: Sí/No

### Hallazgos
| Severidad | Cantidad | IDs |
| --- | ---: | --- |
| P0 | 0 | N/A |
| P1 | 0 | N/A |
| P2 | 0 | N/A |
| P3 | 0 | N/A |

### Decisión
- Go a FASE 3D.6: Sí/No
- Justificación:
- Plan para P1/P2/P3:

### Nota obligatoria
Esta fase cerró evidencia estructural DEV. No reemplaza la validación efectiva autenticada con sesión/JWT real requerida para FASE 3D.6.
```

## 13. Recomendación para FASE 3D.6

FASE 3D.6 debe enfocarse en **evidencia efectiva autenticada DEV** usando usuarios reales o de prueba controlados, JWT válido y rutas funcionales del frontend/API. Debe validar, como mínimo:

- `admin_conjunto` solo accede a datos de su `conjunto_id`;
- residente solo accede a datos asociados a su `residente_id`, `usuario_id` o membership;
- vigilancia solo accede a módulos permitidos por su rol y tenant;
- intentos cross-tenant son rechazados o devuelven 0 filas;
- resultados desde SQL Editor no se aceptan como sustituto del contexto autenticado;
- toda evidencia conserva capturas Network/API, usuario de prueba, rol, tenant y resultado esperado/observado.

No iniciar FASE 3D.6 mientras exista un P0 abierto de FASE 3D.5.
