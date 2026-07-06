# FASE 3D.30 — Clasificación de warnings GraphQL exposure de Supabase Advisor

## 1. Propósito

FASE 3D.30 clasifica los warnings `pg_graphql_anon_table_exposed` y `pg_graphql_authenticated_table_exposed` de Supabase Advisor sin ejecutar hardening funcional todavía. El objetivo es separar ruido esperado del modelo Supabase/RLS frente a hallazgos que sí requieren una fase posterior de hardening controlado.

Esta fase está alineada con FASE 3A Superadmin, arquitectura multi tenant y el periodo híbrido `tenant_memberships` + `usuarios_app` legacy. Por tanto, esta documentación **no revoca grants**, **no modifica policies**, **no cambia SQL**, **no altera PostgREST** y **no cambia frontend/Vercel**.

## 2. Alcance y no alcance

### Alcance

- Clasificar tablas del esquema `public` que pueden aparecer como expuestas por GraphQL para roles `anon` o `authenticated`.
- Identificar si el warning es ruido esperado por grants heredados + RLS o si representa hardening real pendiente.
- Definir una matriz de decisión por tabla para futuras fases.
- Mantener compatibilidad con residentes, vigilancia, `admin_conjunto`, `contador` y futuro superadmin.

### Fuera de alcance

- Revocar `GRANT` a `anon` o `authenticated`.
- Alterar RLS, policies, funciones auxiliares, triggers o extensiones.
- Remover tablas de PostgREST/GraphQL.
- Cambiar queries frontend.
- Ejecutar SQL destructivo o correctivo en DEV/QA/PRD.

## 3. Fuentes revisadas

Se revisó la fuente de verdad del repositorio en el orden requerido:

1. `docs/database-schema.md` para inventario funcional, columnas, relaciones y RLS documentado.
2. `supabase/migrations/`, en especial el snapshot base que dejó grants amplios a `anon`/`authenticated` y migraciones posteriores de hardening RLS.
3. `docs/fase-3d2-diseno-hardening-rls-permisos.md` y documentación FASE 3D posterior para mantener la ruta multi tenant.
4. `src/services/membershipResolver.js` como referencia del periodo híbrido frontend entre `tenant_memberships` y `usuarios_app`.

## 4. Cómo interpretar los warnings de Supabase Advisor

Los warnings `pg_graphql_*_table_exposed` señalan que GraphQL puede ver una tabla por privilegios del rol (`anon` o `authenticated`) y por exposición del esquema. En Urbaphix esto no equivale automáticamente a fuga de datos porque:

- El snapshot inicial concedió `GRANT ALL ON TABLE ... TO anon/authenticated` en muchas tablas del esquema `public`.
- RLS está activado y endurecido gradualmente en fases 3D para tablas críticas.
- PostgREST y GraphQL usan la misma frontera de seguridad de Postgres: privilegios + RLS + policies.
- Un warning de exposición GraphQL puede seguir apareciendo aunque RLS devuelva cero filas al rol no autorizado.

Aun así, el warning sí es útil para priorizar hardening porque GraphQL amplía superficie de introspección y consulta sobre tablas que no necesariamente deberían ser consumidas por clientes públicos.

## 5. Taxonomía de clasificación

| Clasificación | Definición | Tratamiento en FASE 3D.30 | Acción futura típica |
| --- | --- | --- | --- |
| Pública controlada | Datos esperados para lectura amplia o catálogo público de bajo riesgo, con RLS o datos no sensibles. | Ruido aceptable si no contiene PII ni secretos. | Mantener o ajustar grants selectivos si Advisor exige reducción de ruido. |
| Catálogo | Tabla de referencia o estructura necesaria para UI, generalmente de lectura. | Ruido esperado si lectura está acotada o los datos son no sensibles. | Evaluar `SELECT` mínimo y asegurar escritura solo admin/service. |
| Tenant scoped | Datos de negocio por `conjunto_id` que deben respetar tenant y rol. | Warning esperado por grants heredados, pero requiere validar RLS efectiva. | Hardening gradual por RLS/memberships; no revocar en bloque sin pruebas. |
| Sensible | PII, datos financieros, seguridad, accesos, visitantes, pagos, notificaciones o auditoría. | Prioridad de hardening real aunque RLS exista; no tratar como solo ruido. | Fase separada para grants/API exposure/RLS según módulo y evidencia. |
| Legacy | Tabla o dependencia de transición (`usuarios_app`, rutas antiguas, tablas no documentadas en inventario actual) que puede sostener frontend o FKs. | No tocar sin inventario de consumo y migración. | Plan de retiro, wrappers o compatibilidad controlada. |
| Plataforma | Tabla de superadmin/operación interna. | No debe quedar públicamente consultable; acceso solo platform explícito. | Revisar exposición GraphQL y policies platform en fase separada. |
| Auditoría/operacional | Eventos internos, trazas o bitácoras. | Tratar como sensible operativa; minimizar exposición directa. | Preferir RPC/admin backend o policies muy restrictivas. |

## 6. Matriz de decisión por tabla

> La columna `Warning esperado` indica si es razonable que Advisor reporte exposición por los grants heredados del snapshot base. No implica aprobación definitiva del estado de seguridad.

| Tabla | Clasificación | Riesgo principal | Ruido esperado vs hardening real | Decisión FASE 3D.30 | Próxima acción recomendada |
| --- | --- | --- | --- | --- | --- |
| `accesos` | Sensible / vigilancia | Bitácora de ingresos/salidas y actor de vigilancia. | Hardening real. | No cambiar grants/policies en esta fase. | Validar RLS efectiva por vigilancia y negar lectura anónima; evaluar exposición GraphQL en fase porterías. |
| `apartamentos` | Tenant scoped / catálogo estructural | Estructura habitacional por conjunto. | Ruido esperado si RLS filtra `conjunto_id`; hardening real para `anon`. | Mantener. | Revisar grants `anon` luego de confirmar consumo público inexistente. |
| `archivos` | Sensible potencial / legacy | URLs o soportes asociados a módulos sin FK explícita visible. | Hardening real por policy `SELECT true` documentada. | Marcar P1 documental. | Inventariar módulos y relaciones antes de modificar; diseñar RLS por `modulo` + `referencia_id`. |
| `comunicados` | Tenant scoped / pública controlada por conjunto | Comunicaciones internas por conjunto. | Ruido esperado para authenticated; hardening real para anon si no hay comunicados públicos. | Mantener. | Confirmar si existen comunicados públicos; si no, restringir GraphQL/anon en fase separada. |
| `config_pagos` | Sensible financiera | URLs/instrucciones de pago por conjunto. | Hardening real, aunque FASE 3D.22 ya acota SELECT autenticado. | Mantener documentación; no tocar. | Verificar que `anon` no obtiene filas por RLS y evaluar revocación GraphQL/anon controlada. |
| `conjuntos` | Catálogo tenant / plataforma | Metadatos de tenants. | Ruido esperado para authenticated same-tenant; hardening real para anon/global. | Mantener. | Alinear futuro superadmin con acceso explícito; no ampliar lectura global. |
| `incidentes` | Sensible / seguridad | Novedades de seguridad y reportes. | Hardening real. | Mantener. | Validar lectura por admin/vigilancia same-tenant y ausencia cross-tenant. |
| `multas` | Sensible financiera/disciplinaria | Valores/sanciones asociadas a residentes/conjunto. | Hardening real. | Mantener. | Revisar ownership residente y lectura administrativa por `tenant_memberships`. |
| `notificaciones` | Sensible personal | Mensajes por `usuario_id`. | Hardening real. | Mantener. | Confirmar policies duplicadas y que GraphQL no permita enumeración de terceros. |
| `operational_events` | Auditoría/operacional | Eventos internos de operación/auditoría. | Hardening real. | Mantener. | Exponer solo a roles platform/admin autorizados o vía backend/RPC. |
| `pagos` | Sensible financiera | Cobros, comprobantes, estados y residente. | Hardening real; FASE 3D.12 redujo lectura residente. | Mantener. | No revocar en bloque; validar flujos admin/contador/residente antes de cambios de grants. |
| `pagos_eventos` | Sensible financiera/auditoría | Historial de eventos de pagos. | Hardening real. | Mantener. | Mantener lectura por admin/residente propia; considerar no exponer GraphQL directamente. |
| `paquetes` | Sensible operativa | Entregas, destinatarios y portería. | Hardening real; FASE 3D.14 acota residente. | Mantener. | Validar vigilancia same-tenant y residente propio. |
| `parqueaderos` | Tenant scoped / legacy | Activos por conjunto y posibles asignaciones. | Hardening real si RLS no está documentada. | Mantener. | Completar inventario RLS antes de grants. |
| `pqr` | Sensible personal | Solicitudes/reclamos de residentes. | Hardening real. | Mantener. | Revisar lectura admin vs propietario; no exposición anon. |
| `recursos_comunes` | Catálogo tenant | Recursos comunes por conjunto. | Ruido esperado authenticated; hardening real para escrituras/anon. | Mantener. | Mantener lectura same-tenant; escritura admin. |
| `registro_visitas` | Sensible / visitas | Registros de visita por visitante/residente. | Hardening real; FASE 3D.16 acota lecturas. | Mantener. | Confirmar que GraphQL anon no devuelve filas; revisar grants directos después. |
| `reservas` | Tenant scoped / sensible moderada | Reservas legacy y relación con zonas. | Hardening real si depende de relaciones indirectas. | Mantener. | Priorizar coherencia con `reservas_zonas`; validar ownership residente. |
| `reservas_bloqueos` | Tenant scoped / catálogo operativo | Bloqueos de recursos por conjunto. | Ruido esperado authenticated; hardening real para anon. | Mantener. | Validar lectura same-tenant y escritura admin. |
| `reservas_documentos` | Sensible potencial | Documentos/soportes de reservas. | Hardening real. | Mantener. | Revisar almacenamiento/URLs y policies por reserva/conjunto. |
| `reservas_eventos` | Auditoría/operacional | Eventos de reservas. | Hardening real. | Mantener. | Mantener same-tenant; evaluar exposición directa GraphQL. |
| `reservas_zonas` | Tenant scoped / sensible moderada | Reservas por residente, recurso y horarios. | Hardening real; FASE 3D.15 ya acota lecturas. | Mantener. | Validar roles admin/contador/vigilancia/residente con evidence cross-tenant. |
| `residentes` | Sensible PII | Datos personales y vínculo usuario/residente. | Hardening real; FASE 3D.13 acota propietario. | Mantener. | No exponer GraphQL anon; revisar mínimos para vigilancia/admin. |
| `roles` | Catálogo / legacy | Enumeración de roles legacy. | Ruido esperado para authenticated; hardening bajo si sin PII. | Mantener. | Conservar lectura autenticada; evitar escritura cliente. |
| `tipos_documento` | Catálogo | Catálogo de tipos de documento. | Ruido aceptable si datos no sensibles. | Mantener. | Puede quedar como catálogo controlado; revisar si anon es necesario. |
| `torres` | Tenant scoped / catálogo estructural | Estructura física por conjunto. | Ruido esperado authenticated; hardening real para anon. | Mantener. | Similar a apartamentos; validar mismo `conjunto_id`. |
| `trasteos` | Sensible operativa / legacy | Mudanzas, fechas y residentes. | Hardening real si RLS no documentada. | Mantener. | Completar RLS/inventario antes de exposición GraphQL. |
| `usuarios_app` | Legacy sensible | Perfil legacy, rol, conjunto, email/datos de usuario. | Hardening real P0/P1; policy `SELECT true` es deuda conocida. | No tocar en esta fase para no romper bootstrap. | Diseñar reemplazo seguro para bootstrap con membership resolver y limitar exposición directa. |
| `vehiculos` | Sensible PII/activos | Placas y asociación a residentes. | Hardening real si existe en snapshot y no en inventario principal actual. | Mantener. | Confirmar estado actual de tabla y RLS; tratar como sensible. |
| `visitantes` | Sensible / visitas | Datos personales de visitantes. | Hardening real; FASE 3D.16 acota lecturas. | Mantener. | Validar ausencia anon y owner/residente/admin/vigilancia same-tenant. |
| `zonas_comunes` | Catálogo tenant | Catálogo de zonas comunes. | Ruido esperado authenticated; hardening real para anon/escrituras. | Mantener. | Revisar si tabla sigue activa frente a `recursos_comunes`. |
| `platform_memberships` | Plataforma sensible | Roles platform, superadmin y operadores. | Hardening real crítico. | Mantener. | Nunca tratar como catálogo público; revisar exposición GraphQL en fase platform. |
| `tenant_memberships` | Plataforma/tenant sensible | Membresías, roles tenant y estado. | Hardening real crítico. | Mantener. | Mantener RLS estricta; validar que usuarios solo lean sus memberships o roles autorizados. |

## 7. Separación de ruido esperado vs hardening real

### Ruido esperado controlado

Puede considerarse ruido esperado cuando se cumplen todas estas condiciones:

- La tabla no contiene PII, datos financieros, secretos, seguridad ni auditoría.
- RLS limita lectura a `authenticated` y al `conjunto_id` correspondiente, o el catálogo es global por diseño.
- No existen policies `USING true` para tablas sensibles.
- El frontend depende de lectura directa vía Supabase/PostgREST y no hay alternativa backend todavía.

Tablas candidatas a ruido controlado: `tipos_documento`, `roles`, `recursos_comunes`, `zonas_comunes`, `torres`, `apartamentos`, `reservas_bloqueos` y, condicionalmente, `comunicados` si se confirma que su visibilidad por conjunto es intencional.

### Hardening real pendiente

Debe tratarse como hardening real cuando la tabla cumple una o más condiciones:

- Contiene PII, datos financieros, visitantes, residentes, pagos, notificaciones, eventos operativos o trazabilidad.
- Tiene policy amplia como `SELECT true` o RLS incompleta/no documentada.
- Es parte de identidad, memberships o superadmin.
- Podría permitir enumeración de tenants, usuarios, roles o residentes.
- Su consumo frontend puede reemplazarse por policies más finas sin romper módulos.

Tablas prioritarias para fases posteriores: `usuarios_app`, `archivos`, `residentes`, `visitantes`, `registro_visitas`, `pagos`, `pagos_eventos`, `config_pagos`, `paquetes`, `notificaciones`, `platform_memberships`, `tenant_memberships`, `operational_events`, `accesos`, `incidentes`, `multas`, `pqr`, `reservas_documentos`, `reservas_eventos`, `vehiculos` y `trasteos`.

## 8. Reglas de decisión para fases posteriores

1. No revocar grants globales a `anon`/`authenticated` por lote.
2. Para cada tabla sensible, validar primero:
   - consumo frontend actual;
   - policies RLS efectivas por rol;
   - consultas GraphQL/PostgREST con JWT real;
   - impacto en residentes, vigilancia, admin y contador.
3. Si se decide reducir exposición GraphQL, hacerlo tabla por tabla y ambiente por ambiente.
4. Priorizar `anon` antes que `authenticated` cuando no haya consumo público explícito.
5. No tocar `usuarios_app` hasta tener reemplazo probado para bootstrap/login y fallback legacy.
6. No tocar `tenant_memberships`/`platform_memberships` sin pruebas específicas de superadmin y roles platform.
7. Mantener filtros frontend por `conjunto_id`, `residente_id` y `auth.uid()`, pero considerar RLS como frontera real.
8. Documentar cualquier cambio futuro en `docs/database-schema.md` y crear migración SQL separada.

## 9. Query read-only sugerida para capturar warnings reales

Cuando se ejecute en Supabase DEV/QA, adjuntar evidencia real por tabla antes de abrir fase de hardening:

```sql
select
  schemaname,
  tablename,
  rowsecurity,
  has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'select') as anon_select,
  has_table_privilege('authenticated', format('%I.%I', schemaname, tablename), 'select') as authenticated_select
from pg_tables
where schemaname = 'public'
order by tablename;
```

Consulta complementaria de policies:

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Estas consultas son de solo lectura y no sustituyen pruebas efectivas con JWT real para `anon`, `authenticated`, residente, vigilancia, admin de conjunto, contador y superadmin.

## 10. Recomendación de cierre

FASE 3D.30 debe cerrarse como **documentación de clasificación**. La recomendación es abrir fases posteriores separadas:

1. FASE 3D.31: evidencia real DEV de warnings GraphQL por tabla y rol.
2. FASE 3D.32: plan de hardening `anon` para tablas sensibles sin consumo público.
3. FASE 3D.33: plan de hardening `authenticated` por grupos de módulos, iniciando con identidad/memberships y datos financieros.
4. FASE 3D.34: validación PostgREST/GraphQL/frontend para evitar regresiones en residentes, vigilancia, admin_conjunto, contador y superadmin.
