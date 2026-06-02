# FASE 3D.3 - Precheck SQL y validación efectiva de RLS en DEV/QA

## 1. Resumen ejecutivo

FASE 3D.3 prepara una validación operativa, manual y **read-only** para confirmar el estado real de helpers, policies RLS, roles, tablas sensibles y aislamiento por `conjunto_id` / `residente_id` antes de cualquier hardening RLS posterior.

Esta fase no modifica Supabase, no crea migraciones, no cambia policies y no toca frontend funcional. Los entregables son documentación y scripts SQL de diagnóstico bajo `supabase/validation/`, carpeta que permanece fuera del pipeline automático de migraciones.

Los SQL están diseñados para:

- inventariar tablas sensibles, RLS, FORCE RLS, policies y helpers;
- validar acceso efectivo con usuarios autenticados de prueba por rol;
- detectar señales de acceso cruzado entre conjuntos;
- documentar criterios Go/No-Go para decidir si FASE 3D.4 puede avanzar a implementación controlada.

## 2. Ambientes permitidos

Solo se permite ejecutar los SQL en:

- **DEV**;
- **QA**.

Cada ejecución debe registrar:

- ambiente;
- fecha/hora;
- usuario de conexión;
- usuario autenticado de prueba cuando aplique;
- `conjunto_id` y `residente_id` usados como placeholders;
- resultados relevantes y hallazgos.

## 3. Ambientes prohibidos

**PRD está prohibido** para esta fase, salvo autorización explícita posterior y documentada fuera de este PR.

No se debe ejecutar ningún SQL de esta fase en Production como validación exploratoria. Si se detecta que una sesión apunta a PRD, detener la ejecución y reportar el incidente operativo.

## 4. Orden recomendado de ejecución

1. Ejecutar `supabase/validation/fase_3d3_rls_precheck_inventory.sql` en DEV.
2. Revisar que todas las tablas sensibles existan y que los helpers esperados estén presentes.
3. Identificar usuarios de prueba por rol:
   - `admin_conjunto`;
   - `vigilante` / vigilancia;
   - `residente`.
4. Reemplazar placeholders en `supabase/validation/fase_3d3_rls_effective_access_checks.sql`.
5. Ejecutar `supabase/validation/fase_3d3_rls_effective_access_checks.sql` en DEV con cada usuario de prueba.
6. Ejecutar `supabase/validation/fase_3d3_rls_tenant_isolation_checks.sql` en DEV.
7. Repetir el mismo orden en QA.
8. Consolidar hallazgos, clasificar riesgos y documentar conteos esperados por módulo.
9. Decidir Go/No-Go para FASE 3D.4.

## 5. Descripción de cada SQL de validación

### 5.1 `fase_3d3_rls_precheck_inventory.sql`

Inventario read-only para revisar:

- proyecto actual, usuario de conexión y contexto `auth.uid()`;
- existencia de tablas sensibles;
- RLS habilitado por tabla;
- FORCE RLS por tabla;
- policies existentes según `pg_policies`;
- funciones helper legacy:
  - `fn_auth_conjunto_id()`;
  - `fn_auth_rol()`;
  - `fn_auth_residente_id()`;
- funciones helper tenant-aware:
  - `fn_is_platform_superadmin()`;
  - `fn_has_platform_role(text)`;
  - `fn_has_tenant_access(uuid)`;
  - `fn_has_tenant_role(uuid, text)`;
- grants `EXECUTE` relevantes para helpers;
- columnas clave por tabla sensible;
- conteos por tabla sensible;
- conteos de `tenant_memberships` por `status` y `role_name`;
- duplicados activos por `user_id` / `conjunto_id`;
- memberships residentes activas sin `residente_id`;
- comparativo general `usuarios_app` vs `tenant_memberships`.

### 5.2 `fase_3d3_rls_effective_access_checks.sql`

Validación read-only para ejecutar con usuarios autenticados de prueba.

Incluye placeholders claros para:

- `expected_user_id`;
- `expected_conjunto_id`;
- `expected_residente_id`.

Debe ejecutarse al menos para:

- `admin_conjunto`;
- vigilancia / `vigilante`;
- `residente`.

Cubre módulos mínimos:

- Dashboard Admin;
- Pagos;
- Crear cobro;
- Mis pagos;
- Incidentes;
- Reportar incidente;
- Reservas Admin;
- Reservas Residente;
- Control de visitas / vigilancia;
- Solicitar visita / residente;
- Paquetería vigilancia/admin;
- Mis paquetes residente;
- Notificaciones;
- Config pagos;
- Archivos/documentos.

Cada bloque indica si el resultado depende principalmente de `usuarios_app`, de `tenant_memberships` o de trazabilidad indirecta por tablas relacionadas.

Los checks filtrados por `expected_conjunto_id` validan que el dataset esperado del usuario/rol esté disponible. Para no ocultar exposición cross-tenant, el SQL también incluye checks complementarios agrupados por el `conjunto_id` real visible para el usuario autenticado; cualquier fila visible con `conjunto_id` diferente del placeholder esperado se marca como sospechosa y debe clasificarse antes de FASE 3D.4.

### 5.3 `fase_3d3_rls_tenant_isolation_checks.sql`

Validación read-only para detectar posibles riesgos de acceso cruzado:

- usuarios con memberships activas en más de un conjunto;
- diferencias entre `usuarios_app.conjunto_id` y `tenant_memberships.conjunto_id`;
- residentes cuyo conjunto o usuario no coincide con la membership;
- tablas sensibles sin `conjunto_id` directo cuando requieren trazabilidad tenant;
- filas con `conjunto_id` nulo;
- filas huérfanas o inconsistentes por FK lógica;
- roles activos aún no compatibles con UI actual;
- policies con condiciones potencialmente amplias;
- tablas sensibles sin RLS;
- tablas sensibles con RLS pero sin policies;
- policies permissive para `anon` / `authenticated` sin filtro visible de conjunto, residente, usuario o helper.

## 6. Criterios de interpretación de resultados

### 6.1 Tablas y RLS

- Tabla sensible inexistente: hallazgo mínimo P1; puede ser P0 si el módulo está activo en DEV/QA.
- RLS deshabilitado en tabla sensible: hallazgo P0/P1 según exposición y uso real del módulo.
- FORCE RLS deshabilitado no bloquea por sí solo, pero debe clasificarse antes de hardening.
- RLS habilitado sin policies: puede bloquear todo acceso; validar si es intencional.

### 6.2 Policies

- `USING (true)` o `WITH CHECK (true)` en tabla sensible requiere análisis explícito.
- Policies sin filtro visible por `conjunto_id`, `residente_id`, `usuario_id`, `user_id`, `auth.uid()` o helpers deben clasificarse.
- Una policy amplia puede ser aceptable solo si existe justificación funcional, datos no sensibles y control compensatorio documentado.

### 6.3 Helpers

- Helper legacy inexistente o sin grant esperado: No-Go si una policy actual depende de ese helper.
- Helper tenant-aware inexistente: No-Go para avanzar a hardening basado en memberships.
- Helpers `security definer` deben mantener `search_path` controlado y grants mínimos.

### 6.4 Conteos y acceso efectivo

- `0` filas puede ser correcto si el dataset no contiene datos del módulo.
- `0` filas no debe asumirse como bloqueo RLS sin comparar contra inventario y dataset esperado.
- Los conteos filtrados por `expected_conjunto_id` sirven para validar datos esperados, pero no bastan para descartar exposición cruzada.
- Los conteos agrupados por tenant real visible deben revisarse en cada ejecución; cualquier `conjunto_id` distinto del esperado es hallazgo P0 salvo justificación documentada.
- Filas de otro `conjunto_id` visibles para un usuario de prueba tenant-scoped son hallazgo P0 salvo justificación documentada.
- Usuarios sin membership activa no deberían ver datos tenant-scoped.
- Membership `residente` activa sin `residente_id` debe corregirse o clasificarse antes de FASE 3D.4.

## 7. Criterios Go para FASE 3D.4

FASE 3D.4 puede avanzar solo si:

- los SQL ejecutados son read-only;
- no hay archivos nuevos o modificados en `supabase/migrations/`;
- DEV y QA pueden ejecutar inventarios sin error;
- existen usuarios de prueba identificados por rol;
- se documentan conteos esperados por módulo;
- no hay hallazgos P0 sin plan de mitigación;
- no hay acceso cruzado confirmado sin plan de rollback;
- se documenta claramente que PRD no fue tocado.

## 8. Criterios No-Go

No avanzar a FASE 3D.4 si:

- algún SQL contiene instrucciones DDL o DML destructivas;
- se toca `supabase/migrations/`;
- se propone ejecutar en PRD sin autorización;
- no existen usuarios de prueba por rol;
- hay diferencias graves entre `usuarios_app` y `tenant_memberships` sin análisis;
- hay tablas sensibles sin RLS y sin clasificación de riesgo;
- hay policies amplias no entendidas;
- se confirma acceso cruzado entre conjuntos sin plan de mitigación.

## 9. Riesgos

- Ejecutar desde una sesión con rol elevado puede ocultar problemas de RLS si no se valida también como usuario autenticado real.
- Conteos en cero pueden confundirse con protección RLS cuando en realidad no hay datos de prueba.
- `usuarios_app` y `tenant_memberships` pueden coexistir con mapeos de rol no equivalentes durante la transición.
- Tablas con trazabilidad indirecta, como `pagos_eventos`, `reservas`, `notificaciones` o `archivos`, requieren análisis adicional para hardening.
- Policies legacy amplias pueden estar sosteniendo flujos actuales; clasificarlas antes de cambiarlas evita rupturas funcionales.

## 10. Rollback

No aplica rollback técnico porque esta fase no debe modificar datos, tablas, functions, policies ni configuración.

Si accidentalmente se ejecuta algo que no sea read-only:

1. detener la sesión;
2. registrar ambiente, usuario, hora y sentencia ejecutada;
3. reportar el incidente;
4. no continuar con FASE 3D.4 hasta clasificar impacto y definir mitigación.

## 11. Recomendación para FASE 3D.4

Avanzar a FASE 3D.4 únicamente después de consolidar resultados DEV/QA y crear una matriz de hallazgos por módulo con:

- tabla afectada;
- policy/helper relacionado;
- rol afectado;
- evidencia SQL;
- severidad;
- decisión de hardening;
- plan de rollback o mitigación.

FASE 3D.4 debería implementar cambios controlados y versionados solo sobre hallazgos clasificados, manteniendo consistencia entre migraciones, documentación de esquema y comportamiento RLS efectivo.
