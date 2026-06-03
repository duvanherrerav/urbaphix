# FASE 3D.4 - Ejecución controlada de prechecks RLS en DEV

## 1. Resumen ejecutivo

FASE 3D.4 documenta la ejecución manual, controlada y **solo read-only** de los prechecks RLS preparados en FASE 3D.3 para validar en **Supabase DEV**:

- inventario real de tablas sensibles, helpers, grants y policies RLS;
- acceso efectivo por rol autenticado de prueba;
- aislamiento por `conjunto_id`, `residente_id` y `auth.uid()`;
- hallazgos P0/P1/P2/P3 antes de cualquier hardening RLS posterior.

Esta fase **no implementa cambios en Supabase**. Su resultado esperado es evidencia técnica suficiente para decidir si Urbaphix puede avanzar a QA o a una FASE 3D.5 de hardening controlado.

## 2. Alcance de ejecución

La ejecución autorizada en esta fase está limitada a:

- ambiente: **DEV**;
- herramienta: Supabase Dashboard / SQL Editor del proyecto DEV;
- scripts: archivos `supabase/validation/fase_3d3_*.sql` existentes;
- tipo de operación: consultas de diagnóstico **read-only**;
- evidencia: capturas, exportes CSV o copias controladas de resultados sin datos sensibles innecesarios.

No se autorizan cambios de schema, datos, policies, helpers, migraciones, frontend, variables de entorno ni configuración de despliegue.

## 3. Prohibición explícita de PRD

**PRD está prohibido.**

Antes de ejecutar cualquier SQL, el operador debe confirmar visualmente que el proyecto abierto en Supabase corresponde a DEV. Si existe duda sobre el proyecto activo, se debe detener la actividad y pedir validación humana del ambiente.

Si por error se abre PRD o se ejecuta cualquier consulta en PRD:

1. detener la ejecución inmediatamente;
2. no continuar con los siguientes SQL;
3. registrar fecha, hora, usuario operador y query ejecutada;
4. reportar el incidente como **No-Go operativo**;
5. no avanzar a QA ni a FASE 3D.5 hasta cerrar el incidente.

## 4. Archivos SQL a ejecutar y orden recomendado

Ejecutar los SQL en este orden:

1. `supabase/validation/fase_3d3_rls_precheck_inventory.sql`
   - Objetivo: inventariar estado real de RLS, policies, helpers, grants, columnas clave, conteos y consistencia base.
2. `supabase/validation/fase_3d3_rls_effective_access_checks.sql`
   - Objetivo: validar acceso efectivo por usuario autenticado de prueba y rol esperado.
   - Repetir una ejecución por cada usuario de prueba disponible.
3. `supabase/validation/fase_3d3_rls_tenant_isolation_checks.sql`
   - Objetivo: detectar señales de fuga cross-tenant, inconsistencias de memberships, filas huérfanas, tablas sensibles sin RLS o policies amplias.

No invertir el orden salvo justificación documentada. El inventario debe ejecutarse primero porque confirma qué tablas, helpers y policies existen realmente en DEV antes de interpretar acceso efectivo.

## 5. Instrucciones exactas de ejecución en Supabase SQL Editor DEV

Para cada archivo SQL:

1. Abrir Supabase Dashboard.
2. Seleccionar el proyecto **DEV** de Urbaphix.
3. Abrir **SQL Editor**.
4. Crear un nuevo snippet o query temporal con nombre sugerido:
   - `FASE 3D4 DEV - 01 inventory`;
   - `FASE 3D4 DEV - 02 effective access - <rol>`;
   - `FASE 3D4 DEV - 03 tenant isolation`.
5. Copiar el contenido completo del archivo SQL correspondiente desde el repositorio.
6. Antes de ejecutar, confirmar que el SQL no contiene instrucciones DDL/DML no permitidas:
   - `ALTER`;
   - `CREATE`;
   - `DROP`;
   - `UPDATE`;
   - `DELETE`;
   - `INSERT`;
   - `TRUNCATE`.
7. Para el SQL de acceso efectivo, reemplazar todos los placeholders requeridos según la sección 6.
8. Ejecutar el SQL con el botón **Run** del SQL Editor.
9. Capturar evidencia de cada result set relevante según la sección 8.
10. Registrar hallazgos en la plantilla `docs/fase-3d4-plantilla-evidencia-prechecks-dev.md`.
11. Si un query falla:
    - copiar mensaje exacto de error;
    - capturar pantalla del error;
    - no modificar el SQL en Supabase para “probar rápido” sin documentarlo;
    - clasificar el error según la matriz P0/P1/P2/P3.

## 6. Parámetros y placeholders que debe reemplazar el operador

El archivo `supabase/validation/fase_3d3_rls_effective_access_checks.sql` requiere ejecutar el mismo set de checks con usuarios autenticados de prueba. Antes de cada ejecución, reemplazar los placeholders por valores reales de DEV:

| Placeholder | Valor requerido | Fuente sugerida | Validación esperada |
| --- | --- | --- | --- |
| `expected_user_id` | UUID del usuario autenticado de prueba | `auth.users.id`, `usuarios_app.user_id` o `tenant_memberships.user_id` | Debe corresponder al usuario con sesión/claims que se desea simular o validar. |
| `expected_conjunto_id` | UUID del conjunto esperado para el usuario | `tenant_memberships.conjunto_id`, `usuarios_app.conjunto_id` o fixture DEV controlado | Toda fila sensible visible debe pertenecer a este conjunto o quedar justificada. |
| `expected_residente_id` | UUID del residente asociado, cuando aplique | `tenant_memberships.residente_id` o `residentes.id` | Obligatorio para rol residente; puede ser `null` o placeholder controlado para roles no residentes si el SQL lo documenta. |

Reglas para placeholders:

- No usar IDs de PRD.
- No inventar UUIDs.
- No mezclar `user_id`, `conjunto_id` o `residente_id` de distintos usuarios salvo que se esté validando explícitamente un caso inconsistente.
- Registrar en evidencia el origen de cada ID usado.
- Si falta un usuario de prueba para un rol requerido, registrar hallazgo P2 o No-Go según impacto.

## 7. Usuarios de prueba requeridos en DEV

Identificar y registrar al menos estos perfiles:

| Perfil | Requerido | Propósito |
| --- | --- | --- |
| `admin_conjunto` DEV | Sí | Validar acceso administrativo limitado al `conjunto_id` asignado. |
| vigilancia / `vigilante` DEV | Sí | Validar acceso operativo a visitas, paquetes e incidentes sin fuga cross-tenant. |
| `residente` DEV | Sí | Validar acceso limitado a su propio residente, pagos, visitas, paquetes, reservas y notificaciones. |
| Usuario sin membership activa | Si existe | Confirmar que no accede a datos protegidos. Si no existe, documentar brecha de cobertura. |
| Usuario con datos inconsistentes | Si existe | Confirmar que inconsistencias no producen acceso indebido. Si no existe, documentar como no aplicable. |

Para cada usuario registrar:

- UUID de `auth.users.id` o `tenant_memberships.user_id`;
- rol esperado;
- `conjunto_id` esperado;
- `residente_id` esperado si aplica;
- estado de membership;
- evidencia que demuestre por qué el usuario es válido para la prueba.

## 8. Evidencia que se debe capturar por SQL

### 8.1 Inventario RLS

Para `fase_3d3_rls_precheck_inventory.sql`, capturar:

- contexto de ejecución: ambiente, usuario de conexión, `auth.uid()` observado;
- tablas sensibles existentes y faltantes;
- estado `rls_enabled` y `force_rls` por tabla sensible;
- policies por tabla y comando;
- helpers encontrados y grants `EXECUTE` relevantes;
- columnas clave por tabla sensible;
- conteos por tabla;
- conteos de `tenant_memberships` por `status` y `role_name`;
- duplicados activos y memberships residentes sin `residente_id`;
- comparativo `usuarios_app` vs `tenant_memberships`.

### 8.2 Acceso efectivo por rol

Para `fase_3d3_rls_effective_access_checks.sql`, capturar una evidencia por usuario de prueba:

- usuario/rol usado;
- placeholders reemplazados;
- módulos con filas visibles esperadas;
- módulos sin datos disponibles para validar;
- cualquier fila visible con `conjunto_id` distinto al esperado;
- cualquier fila visible de otro `residente_id` para rol residente;
- errores de ejecución por tabla, columna, policy o permiso.

### 8.3 Aislamiento tenant

Para `fase_3d3_rls_tenant_isolation_checks.sql`, capturar:

- memberships activas en más de un conjunto;
- diferencias entre `usuarios_app.conjunto_id` y `tenant_memberships.conjunto_id`;
- residentes cuyo conjunto o usuario no coincide con la membership;
- tablas sensibles sin `conjunto_id` directo cuando requieren trazabilidad indirecta;
- filas con `conjunto_id` nulo;
- filas huérfanas o inconsistentes por FK lógica;
- roles activos no compatibles con UI actual;
- policies potencialmente amplias;
- tablas sensibles sin RLS;
- tablas sensibles con RLS pero sin policies.

## 9. Cómo interpretar resultados

### 9.1 Señales esperadas sanas

- Los SQL se ejecutan sin errores críticos.
- Las tablas sensibles están inventariadas.
- Los helpers esperados existen o su ausencia está explicada por diseño vigente.
- Las policies de tablas sensibles muestran filtros por tenant, residente, usuario autenticado o helpers autorizados.
- Cada usuario de prueba ve datos del `conjunto_id` esperado.
- El rol residente no ve datos de otros residentes salvo información explícitamente común del conjunto.
- Un usuario sin membership activa no ve datos protegidos.

### 9.2 Señales que requieren clasificación

- Result sets vacíos por falta de datos DEV: usualmente P2 si impiden validar un módulo.
- Policies con `USING (true)` o `WITH CHECK (true)`: P1/P0 según tabla, datos y exposición efectiva.
- Tablas sensibles con RLS deshabilitado: P0/P1 según existencia de datos reales y acceso.
- Helpers legacy inconsistentes con `tenant_memberships`: P1 si puede afectar decisiones de acceso.
- Roles no homologados: P2 si no generan acceso indebido; P1 si impactan usuarios críticos.

### 9.3 Señales bloqueantes

- Cualquier fila visible de `conjunto_id` diferente al esperado sin justificación funcional.
- Pagos, visitas, paquetes, incidentes, reservas o residentes visibles de otro conjunto.
- Usuario sin membership activa con acceso a datos protegidos.
- SQL de validación que contenga DDL/DML no permitido.
- Evidencia de ejecución en PRD.

## 10. Matriz de hallazgos P0/P1/P2/P3

| Severidad | Definición | Hallazgos esperados | Acción requerida |
| --- | --- | --- | --- |
| P0 - Bloqueante | Exposición real o riesgo operativo que impide avanzar. | Acceso visible a `conjunto_id` diferente al esperado; tablas sensibles sin RLS y con datos reales; usuario sin membership activa con acceso a datos protegidos; residentes visibles de otro conjunto; pagos visibles de otro conjunto; visitas/paquetes/incidentes/reservas visibles de otro conjunto; PRD tocado por error; SQL no read-only. | Detener avance. Abrir issue/hotfix de seguridad. No ir a QA ni FASE 3D.5 hasta mitigar o aislar. |
| P1 - Alto | Debilidad relevante sin fuga directa confirmada o inconsistencia que puede habilitar fuga. | Policies demasiado amplias pero sin evidencia directa de fuga; helpers legacy inconsistentes con `tenant_memberships`; `usuarios_app` y `tenant_memberships` no reconciliados para usuarios críticos; datos huérfanos que puedan afectar RLS. | Crear plan de corrección priorizado y owner. Puede avanzar solo con aceptación explícita si no hay P0. |
| P2 - Medio | Brecha de validación, documentación o normalización sin acceso indebido confirmado. | Documentación desactualizada frente a policies reales; tablas sin datos para validar módulo; roles no homologados encontrados pero sin acceso indebido; falta de usuario negativo si no bloquea cobertura mínima. | Documentar y planificar antes o durante FASE 3D.5. |
| P3 - Bajo | Mejora menor sin impacto de seguridad inmediato. | Mejoras de nomenclatura; comentarios SQL incompletos; evidencia visual pendiente; ajustes de formato del reporte. | Corregir cuando sea conveniente; no bloquea por sí solo. |

## 11. Criterios Go para avanzar

Se puede avanzar a QA o a FASE 3D.5 si se cumple todo lo siguiente:

- Los SQL se mantienen read-only.
- DEV ejecuta el inventario sin errores críticos.
- No se detecta acceso cross-tenant P0.
- Los usuarios de prueba por rol están identificados.
- Las tablas sensibles están inventariadas.
- Los hallazgos P1/P2 tienen plan claro, owner y decisión documentada.
- PRD no fue tocado.
- No se modificaron migraciones, RLS, helpers, frontend funcional, `.env`, Vercel ni feature flags.

## 12. Criterios No-Go

No avanzar si ocurre cualquiera de estos casos:

- exposición cross-tenant confirmada;
- tablas sensibles sin RLS y con datos reales sin plan inmediato;
- falta de usuarios de prueba suficientes para cubrir roles mínimos;
- inventario SQL falla de forma generalizada;
- algún SQL no es read-only;
- PRD fue tocado por error;
- no hay evidencia suficiente para sustentar la decisión;
- un usuario sin membership activa accede a datos protegidos;
- el rol residente ve pagos, visitas, paquetes, incidentes o reservas de otro residente/conjunto sin justificación funcional explícita.

## 13. Plan de manejo de hallazgos

1. Registrar cada hallazgo en la plantilla de evidencia.
2. Asignar severidad P0/P1/P2/P3.
3. Asociar módulo, tabla, policy/helper implicado y usuario de prueba.
4. Adjuntar evidencia mínima:
   - query o bloque ejecutado;
   - result set relevante;
   - screenshot o exporte;
   - placeholders usados.
5. Definir owner y acción siguiente:
   - documentación;
   - investigación;
   - migración futura;
   - ajuste RLS futuro;
   - limpieza de datos DEV;
   - creación de fixtures DEV.
6. Para P0:
   - detener avance;
   - abrir ticket de seguridad;
   - definir mitigación antes de cualquier promoción.
7. Para P1:
   - documentar riesgo residual;
   - decidir si bloquea FASE 3D.5 según exposición y criticidad.
8. Para P2/P3:
   - programar corrección sin bloquear si los criterios Go siguen satisfechos.

## 14. Recomendación para FASE 3D.5

La recomendación por defecto es avanzar a FASE 3D.5 **solo si DEV cumple criterios Go** y no existen P0 abiertos.

FASE 3D.5 debería enfocarse en hardening RLS controlado y trazable, partiendo de los hallazgos confirmados en DEV:

- priorizar tablas con datos sensibles y policies amplias;
- reconciliar `usuarios_app` y `tenant_memberships` para usuarios críticos;
- decidir estrategia de helpers legacy vs helpers tenant-aware;
- preparar migraciones pequeñas, reversibles y revisables;
- mantener documentación sincronizada con `docs/database-schema.md` cuando cambien tablas, columnas, FKs o policies;
- repetir validaciones read-only antes y después de cada cambio.

Si aparecen P0, la recomendación cambia a **No-Go** y FASE 3D.5 debe convertirse en una fase de corrección inmediata del riesgo confirmado, no en hardening incremental.

## 15. Checklist operativo final

Antes de cerrar FASE 3D.4, confirmar:

- [ ] Ejecución realizada únicamente en DEV.
- [ ] PRD no fue abierto ni usado para ejecutar SQL.
- [ ] Los tres SQL de FASE 3D.3 fueron revisados como read-only.
- [ ] Inventario ejecutado y evidenciado.
- [ ] Acceso efectivo ejecutado para `admin_conjunto`.
- [ ] Acceso efectivo ejecutado para vigilancia / `vigilante`.
- [ ] Acceso efectivo ejecutado para `residente`.
- [ ] Usuario sin membership activa validado o documentado como no disponible.
- [ ] Usuario con datos inconsistentes validado o documentado como no disponible.
- [ ] Hallazgos clasificados P0/P1/P2/P3.
- [ ] Criterio Go/No-Go documentado.
- [ ] Plan para P1/P2 definido.
- [ ] Recomendación para FASE 3D.5 registrada.
