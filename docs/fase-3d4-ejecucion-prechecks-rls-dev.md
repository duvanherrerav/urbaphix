# FASE 3D.4 - Ejecución controlada de prechecks RLS en DEV

## 1. Resumen ejecutivo

FASE 3D.4 documenta la ejecución manual, controlada y **solo read-only** de los prechecks RLS preparados en FASE 3D.3 para validar en **Supabase DEV**:

- inventario real de tablas sensibles, helpers, grants y policies RLS;
- evidencia estructural desde SQL Editor para metadata, conteos y validaciones que no dependan de la sesión real del usuario final;
- evidencia efectiva por rol autenticado desde frontend/app, cliente API con JWT del usuario de prueba o simulación controlada de claims aprobada;
- aislamiento por `conjunto_id`, `residente_id` y `auth.uid()` únicamente cuando la evidencia provenga de un contexto autenticado válido;
- hallazgos P0/P1/P2/P3 antes de cualquier hardening RLS posterior.

Esta fase **no implementa cambios en Supabase**. Su resultado esperado es evidencia técnica suficiente para decidir si Urbaphix puede avanzar a QA o a una FASE 3D.5 de hardening controlado.

## 2. Alcance de ejecución

La ejecución autorizada en esta fase está limitada a:

- ambiente: **DEV**;
- herramienta estructural: Supabase Dashboard / SQL Editor del proyecto DEV;
- herramientas de evidencia efectiva: sesión real de frontend/app, cliente/API con JWT válido del usuario de prueba o simulación controlada de claims previamente documentada y aprobada;
- scripts: archivos `supabase/validation/fase_3d3_*.sql` existentes;
- tipo de operación: consultas de diagnóstico **read-only**;
- evidencia: capturas, exportes CSV, registros Network/API o copias controladas de resultados sin datos sensibles innecesarios.

No se autorizan cambios de schema, datos, policies, helpers, migraciones, frontend, variables de entorno ni configuración de despliegue.

**Limitación obligatoria:** el SQL Editor puede ejecutar bajo un rol elevado/postgres y no necesariamente representa `auth.uid()` ni JWT real de `admin_conjunto`, vigilancia o residente. Por eso, SQL Editor **no es evidencia final válida** para acceso efectivo cuando el resultado depende de `auth.uid()`, claims JWT o RLS evaluado como usuario final.

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

Ejecutar los SQL y evidencias en este orden lógico:

1. `supabase/validation/fase_3d3_rls_precheck_inventory.sql` desde SQL Editor DEV.
   - Objetivo: inventariar estado real de RLS, policies, helpers, grants, columnas clave, conteos y consistencia base.
   - Tipo de evidencia: **estructural**.
2. `supabase/validation/fase_3d3_rls_tenant_isolation_checks.sql` desde SQL Editor DEV solo para validaciones estructurales o de metadata que no dependan de `auth.uid()` real.
   - Objetivo: detectar señales estructurales de fuga cross-tenant, inconsistencias de memberships, filas huérfanas, tablas sensibles sin RLS o policies amplias.
   - Tipo de evidencia: **estructural**.
3. `supabase/validation/fase_3d3_rls_effective_access_checks.sql` mediante camino autenticado válido cuando sus resultados dependan de `auth.uid()` / JWT real.
   - Objetivo: validar acceso efectivo por usuario autenticado de prueba y rol esperado.
   - Repetir una ejecución por cada usuario de prueba disponible.
   - Tipo de evidencia: **efectiva por usuario autenticado**.

No invertir el orden salvo justificación documentada. El inventario debe ejecutarse primero porque confirma qué tablas, helpers y policies existen realmente en DEV antes de interpretar acceso efectivo. La validación efectiva por rol no queda aprobada si solo se ejecutó en SQL Editor con rol elevado.

## 5. Instrucciones exactas de ejecución y separación de evidencia

### 5.1 Evidencia estructural desde Supabase SQL Editor DEV

Usar SQL Editor DEV únicamente para:

- inventario RLS/helpers/policies;
- conteos estructurales;
- revisión de metadata;
- consistencia de memberships y datos huérfanos;
- validaciones que no dependan de `auth.uid()` real del usuario final ni de claims JWT.

Pasos:

1. Abrir Supabase Dashboard.
2. Seleccionar el proyecto **DEV** de Urbaphix.
3. Abrir **SQL Editor**.
4. Crear un nuevo snippet o query temporal con nombre sugerido:
   - `FASE 3D4 DEV - 01 inventory`;
   - `FASE 3D4 DEV - 02 tenant isolation structural`.
5. Copiar el contenido completo del archivo SQL estructural correspondiente desde el repositorio.
6. Antes de ejecutar, confirmar que el SQL no contiene instrucciones DDL/DML no permitidas:
   - `ALTER`;
   - `CREATE`;
   - `DROP`;
   - `UPDATE`;
   - `DELETE`;
   - `INSERT`;
   - `TRUNCATE`.
7. Ejecutar el SQL con el botón **Run** del SQL Editor.
8. Capturar evidencia de cada result set relevante según la sección 8.
9. Registrar método de ejecución como `SQL Editor DEV` en la plantilla `docs/fase-3d4-plantilla-evidencia-prechecks-dev.md`.
10. Si un query falla:
    - copiar mensaje exacto de error;
    - capturar pantalla del error;
    - no modificar el SQL en Supabase para “probar rápido” sin documentarlo;
    - clasificar el error según la matriz P0/P1/P2/P3.

### 5.2 Evidencia efectiva por usuario autenticado

`supabase/validation/fase_3d3_rls_effective_access_checks.sql` **no debe usarse como evidencia final desde SQL Editor** si sus resultados dependen de `auth.uid()`, JWT real o claims del usuario final. Para esos casos, la evidencia válida debe provenir de uno de estos caminos:

1. **Sesión real desde frontend/app + validación Network**:
   - iniciar sesión en DEV con el usuario de prueba;
   - navegar los módulos cubiertos por el rol;
   - capturar requests/responses Network relevantes, ocultando tokens y datos sensibles;
   - confirmar que los datos visibles corresponden al `conjunto_id` / `residente_id` esperado.
2. **Cliente/API con JWT del usuario de prueba**:
   - usar un token válido del usuario de prueba en DEV;
   - ejecutar consultas equivalentes a los módulos validados;
   - registrar endpoint, método, status code, filtros y respuesta sanitizada;
   - no persistir ni publicar el JWT.
3. **Simulación controlada de claims**:
   - permitida solo si el método está previamente documentado y aprobado;
   - debe registrar quién aprobó, alcance, claims simulados y por qué representa al usuario probado;
   - si no existe aprobación, clasificar la evidencia como no válida para Go.

Para cada ejecución efectiva, registrar:

- método usado: `frontend session`, `API/JWT` o `simulación controlada`;
- usuario autenticado probado;
- rol esperado;
- `expected_user_id`, `expected_conjunto_id` y `expected_residente_id`;
- evidencia Network/API o evidencia de claims simulados aprobados;
- limitaciones y datos no cubiertos.

## 6. Parámetros y placeholders que debe reemplazar el operador

El archivo `supabase/validation/fase_3d3_rls_effective_access_checks.sql` sirve como referencia de checks por rol y requiere usuarios autenticados de prueba. Cuando se use mediante cliente/API o simulación aprobada, reemplazar los placeholders por valores reales de DEV. Si se copia al SQL Editor solo para revisión o diagnóstico, marcarlo explícitamente como **no válido para evidencia final de RLS efectivo** cuando dependa de `auth.uid()` / JWT real:

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
- Registrar el método de ejecución y si la evaluación usó `auth.uid()` / JWT real.
- Si falta un usuario de prueba para un rol requerido, registrar hallazgo P2 o No-Go según impacto.
- Si la validación efectiva se hizo solo desde SQL Editor y dependía de `auth.uid()`, no aceptarla como Go.

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

## 8. Evidencia que se debe capturar por tipo de validación

### 8.1 Inventario RLS

Para `fase_3d3_rls_precheck_inventory.sql`, capturar:

- contexto de ejecución: ambiente, usuario de conexión y valor de `auth.uid()` observado solo como diagnóstico del SQL Editor, sin tratarlo como sesión real de usuario final;
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

Para `fase_3d3_rls_effective_access_checks.sql` o checks equivalentes por módulo, capturar una evidencia por usuario de prueba desde un contexto autenticado válido:

- método de ejecución: `frontend session`, `API/JWT` o `simulación controlada aprobada`;
- confirmación de que SQL Editor no fue la única fuente de evidencia si el check dependía de `auth.uid()`;
- usuario autenticado probado y rol usado;
- placeholders reemplazados;
- evidencia Network/API, status code y respuesta sanitizada cuando aplique;
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

- Los SQL estructurales se ejecutan sin errores críticos en SQL Editor DEV.
- Las tablas sensibles están inventariadas.
- Los helpers esperados existen o su ausencia está explicada por diseño vigente.
- Las policies de tablas sensibles muestran filtros por tenant, residente, usuario autenticado o helpers autorizados.
- La evidencia efectiva por rol proviene de sesión autenticada real, API/JWT válido o simulación controlada aprobada.
- Cada usuario de prueba ve datos del `conjunto_id` esperado en evidencia efectiva válida.
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
- Validación de acceso efectivo aceptada solo desde SQL Editor pese a depender de `auth.uid()` / JWT real.
- SQL de validación que contenga DDL/DML no permitido.
- Evidencia de ejecución en PRD.

## 10. Matriz de hallazgos P0/P1/P2/P3

| Severidad | Definición | Hallazgos esperados | Acción requerida |
| --- | --- | --- | --- |
| P0 - Bloqueante | Exposición real o riesgo operativo que impide avanzar. | Acceso visible a `conjunto_id` diferente al esperado; tablas sensibles sin RLS y con datos reales; usuario sin membership activa con acceso a datos protegidos; residentes visibles de otro conjunto; pagos visibles de otro conjunto; visitas/paquetes/incidentes/reservas visibles de otro conjunto; PRD tocado por error; SQL no read-only; acceso efectivo aprobado solo con SQL Editor cuando dependía de `auth.uid()` / JWT real. | Detener avance. Abrir issue/hotfix de seguridad. No ir a QA ni FASE 3D.5 hasta mitigar o aislar. |
| P1 - Alto | Debilidad relevante sin fuga directa confirmada o inconsistencia que puede habilitar fuga. | Policies demasiado amplias pero sin evidencia directa de fuga; helpers legacy inconsistentes con `tenant_memberships`; `usuarios_app` y `tenant_memberships` no reconciliados para usuarios críticos; datos huérfanos que puedan afectar RLS. | Crear plan de corrección priorizado y owner. Puede avanzar solo con aceptación explícita si no hay P0. |
| P2 - Medio | Brecha de validación, documentación o normalización sin acceso indebido confirmado. | Documentación desactualizada frente a policies reales; tablas sin datos para validar módulo; roles no homologados encontrados pero sin acceso indebido; falta de usuario negativo si no bloquea cobertura mínima. | Documentar y planificar antes o durante FASE 3D.5. |
| P3 - Bajo | Mejora menor sin impacto de seguridad inmediato. | Mejoras de nomenclatura; comentarios SQL incompletos; evidencia visual pendiente; ajustes de formato del reporte. | Corregir cuando sea conveniente; no bloquea por sí solo. |

## 11. Criterios Go para avanzar

Se puede avanzar a QA o a FASE 3D.5 si se cumple todo lo siguiente:

- Los SQL se mantienen read-only.
- DEV ejecuta el inventario estructural sin errores críticos desde SQL Editor.
- No se detecta acceso cross-tenant P0.
- Los usuarios de prueba por rol están identificados.
- Las tablas sensibles están inventariadas.
- La evidencia efectiva por rol proviene de sesión autenticada real, API/JWT válido o simulación controlada aprobada.
- Ninguna validación de acceso efectivo que dependa de `auth.uid()` fue aceptada como Go usando solo SQL Editor.
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
- la única evidencia de acceso efectivo por rol proviene de SQL Editor y depende de `auth.uid()` / JWT real;
- no existe sesión autenticada real, API/JWT válido ni simulación controlada aprobada para los roles mínimos;
- un usuario sin membership activa accede a datos protegidos;
- el rol residente ve pagos, visitas, paquetes, incidentes o reservas de otro residente/conjunto sin justificación funcional explícita.

## 13. Plan de manejo de hallazgos

1. Registrar cada hallazgo en la plantilla de evidencia.
2. Asignar severidad P0/P1/P2/P3.
3. Asociar módulo, tabla, policy/helper implicado y usuario de prueba.
4. Adjuntar evidencia mínima:
   - query, módulo o endpoint ejecutado;
   - método de ejecución;
   - result set, respuesta Network/API o screenshot relevante;
   - placeholders usados;
   - limitación explícita si proviene de SQL Editor.
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
- [ ] Acceso efectivo ejecutado para `admin_conjunto` mediante sesión real, API/JWT válido o simulación aprobada.
- [ ] Acceso efectivo ejecutado para vigilancia / `vigilante` mediante sesión real, API/JWT válido o simulación aprobada.
- [ ] Acceso efectivo ejecutado para `residente` mediante sesión real, API/JWT válido o simulación aprobada.
- [ ] Ningún check dependiente de `auth.uid()` fue aceptado como Go usando solo SQL Editor.
- [ ] Usuario sin membership activa validado o documentado como no disponible.
- [ ] Usuario con datos inconsistentes validado o documentado como no disponible.
- [ ] Hallazgos clasificados P0/P1/P2/P3.
- [ ] Criterio Go/No-Go documentado.
- [ ] Plan para P1/P2 definido.
- [ ] Recomendación para FASE 3D.5 registrada.
