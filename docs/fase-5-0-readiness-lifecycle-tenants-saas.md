# FASE 5.0 — Readiness lifecycle tenants SaaS

## 1. Objetivo de FASE 5

FASE 5 debe pasar Urbaphix de un backoffice Superadmin **read-only** a una operación SaaS controlada para tenants/conjuntos, sin iniciar todavía CRUD ni provisioning automático.

El objetivo técnico-producto es definir el contrato mínimo para que las siguientes fases puedan crear, activar, suspender, reactivar y archivar tenants con seguridad, auditoría y trazabilidad. Esta fase no modifica runtime: no crea migraciones, no cambia RLS, no cambia frontend y no altera la estructura actual de `public.conjuntos`.

### Estado base validado para este diseño

Según la fuente de verdad actual del repositorio, `public.conjuntos` es la entidad principal del multiconjunto y hoy contiene únicamente:

- `id` (`uuid`, `NOT NULL`, `default gen_random_uuid()`).
- `nombre` (`text`, `NOT NULL`).
- `direccion` (`text`, nullable).
- `ciudad` (`text`, nullable).
- `created_at` (`timestamp without time zone`, nullable, `default now()`).

La tabla tiene una política de lectura por tenant (`id = fn_auth_conjunto_id()`) y no tiene políticas de escritura para clientes `anon`/`authenticated`; las escrituras deben hacerse por `service_role` o backend administrativo aprobado. Por tanto, cualquier CRUD SaaS futuro debe diseñarse explícitamente y no puede depender de escrituras directas desde el frontend.

Precheck DEV recibido para esta fase:

- `public.conjuntos` existe.
- Columnas actuales: `id`, `nombre`, `direccion`, `ciudad`, `created_at`.
- Total conjuntos DEV: 2.
- Conjuntos con `nombre`: 2.
- Conjuntos con `ciudad`: 2.
- Conjuntos con `direccion`: 2.

## 2. Modelo lifecycle recomendado para tenants

El lifecycle recomendado debe ser explícito, auditable y no destructivo. Se propone un modelo de estados equivalente a:

| Estado | Propósito | Operación esperada | Efecto operativo esperado |
| --- | --- | --- | --- |
| `draft` / `onboarding` | Tenant en preparación antes de operación real. | Crear metadata mínima, completar configuración, asignar plan/licencia y validar prerequisitos. | No debe habilitar operación completa ni acceso residencial hasta que pase criterios de activación. |
| `active` | Tenant habilitado para operación normal. | Activar después de validaciones técnicas, comerciales y de datos mínimos. | Permite uso normal de módulos tenant según memberships/RLS existentes. |
| `suspended` | Tenant bloqueado temporalmente. | Suspender por mora, riesgo, soporte, incumplimiento o solicitud operativa. | Debe bloquear o limitar operación sensible sin borrar datos ni romper auditoría histórica. |
| `archived` | Tenant retirado/no operativo. | Archivar al finalizar servicio o después de migración/cierre controlado. | Debe conservar histórico, impedir nuevas operaciones y evitar eliminación destructiva. |

Reglas mínimas del lifecycle:

1. No usar `DELETE` como mecanismo funcional de baja de tenants.
2. Toda transición debe tener actor, razón, timestamp y origen.
3. `archived` debe ser terminal salvo procedimiento excepcional documentado.
4. `suspended` debe ser reversible mediante reactivación auditada.
5. El frontend tenant no debe poder modificar su propio estado lifecycle.
6. El estado lifecycle debe poder evaluarse en puntos operativos críticos antes de permitir acciones futuras de provisioning o administración.

## 3. Campos candidatos para evolucionar `public.conjuntos` o una tabla complementaria

FASE 5.1 debe decidir si extender `public.conjuntos` o crear una tabla complementaria de configuración tenant. Los campos siguientes son **candidatos de diseño**, no columnas existentes ni cambios aplicados en esta fase.

### Opción A — Evolucionar `public.conjuntos`

Campos candidatos:

- `lifecycle_status`: estado (`draft`/`onboarding`, `active`, `suspended`, `archived`).
- `plan_code`: plan comercial o licencia asignada.
- `license_status`: estado de licencia (`trial`, `active`, `past_due`, `cancelled`, etc.).
- `environment`: ambiente lógico (`dev`, `qa`, `prod`) si aplica al modelo operativo.
- `activated_at`: fecha/hora de activación.
- `suspended_at`: fecha/hora de suspensión vigente o última suspensión.
- `archived_at`: fecha/hora de archivado.
- `status_reason`: razón operativa del estado actual.
- `updated_at`: última modificación.
- `updated_by`: usuario plataforma que realizó el último cambio.

Ventaja: consultas simples cuando el estado es parte de la identidad primaria del tenant.

Riesgo: `public.conjuntos` ya es tabla padre usada por múltiples módulos; cambios directos pueden aumentar el impacto de RLS, dashboards y consultas existentes.

### Opción B — Tabla complementaria de configuración tenant

Tabla candidata conceptual: `tenant_settings`, `tenant_lifecycle` o equivalente, con relación 1:1 a `conjuntos.id`.

Campos candidatos:

- `conjunto_id`: referencia al tenant.
- `lifecycle_status`.
- `plan_code`.
- `license_status`.
- `environment`.
- `operational_lock`: bandera explícita para bloqueo operativo.
- `lock_reason`: razón del bloqueo.
- `activated_at`, `suspended_at`, `archived_at`.
- `created_at`, `created_by`, `updated_at`, `updated_by`.

Ventaja: separa la metadata SaaS de la entidad tenant base y reduce cambios sobre consultas legacy que solo necesitan `nombre`, `direccion` o `ciudad`.

Riesgo: exige políticas/RPC y joins adicionales; si no se diseña bien, puede crear drift entre `conjuntos` y la tabla complementaria.

### Recomendación preliminar

Para CRUD inicial controlado, se recomienda evaluar una tabla complementaria o RPC que encapsule la escritura, antes de añadir múltiples responsabilidades a `public.conjuntos`. Si se determina que el estado lifecycle es atributo core del tenant, `public.conjuntos` puede evolucionar, pero solo con migración explícita, actualización de `docs/database-schema.md`, validación de RLS y pruebas cross-tenant.

## 4. Reglas de seguridad

Las reglas de seguridad para FASE 5.1+ deben partir del modelo plataforma ya existente:

- Acceso operativo global solo para sesiones autenticadas con rol plataforma autorizado.
- `superadmin` de plataforma validado por `fn_is_platform_superadmin()`.
- `platform_ops` validado por `fn_has_platform_role('platform_ops')` cuando la acción permita operación delegada.
- Sin acceso `anon` a operaciones lifecycle.
- Sin uso de `service_role` desde frontend.
- Sin escrituras directas desde componentes React sobre tablas lifecycle.

Matriz preliminar:

| Acción | `platform_superadmin` | `platform_ops` | `anon` | Usuario tenant |
| --- | --- | --- | --- | --- |
| Listar tenants | Sí | Sí | No | Solo su tenant vía RLS existente, si aplica. |
| Crear tenant | Sí | Posible solo si producto lo aprueba. | No | No |
| Editar metadata tenant | Sí | Posible con campos acotados. | No | No |
| Activar tenant | Sí | Posible con checklist y auditoría. | No | No |
| Suspender tenant | Sí | Posible con razón obligatoria. | No | No |
| Reactivar tenant | Sí | Posible con razón obligatoria. | No | No |
| Archivar tenant | Sí | No recomendado para `platform_ops` sin doble control. | No | No |
| Eliminar tenant | No como flujo normal. | No | No | No |

## 5. Reglas de auditoría obligatoria

Toda mutación lifecycle futura debe producir auditoría append-only. La auditoría debe capturar como mínimo:

- `tenant_id` / `conjunto_id` afectado.
- Acción: `create`, `update`, `activate`, `suspend`, `reactivate`, `archive`.
- Estado anterior y estado nuevo cuando aplique.
- Campos modificados o resumen de diff.
- Razón obligatoria para suspensión, reactivación y archivado.
- `actor_user_id` (`auth.uid()`).
- Rol plataforma efectivo (`superadmin` o `platform_ops`).
- Timestamp server-side.
- Origen (`rpc`, `admin_backoffice`, `system_job`, etc.).
- Correlation/request id si existe en la capa backend.

Reglas por acción:

- **Crear:** auditar metadata inicial, plan/licencia inicial y usuario creador.
- **Editar:** auditar diff y evitar cambios silenciosos de estado lifecycle.
- **Suspender:** exigir razón, marcar bloqueo operativo y registrar impacto esperado.
- **Reactivar:** exigir razón o ticket de resolución y validar que no queda bloqueo activo incompatible.
- **Archivar:** exigir razón, validación de no-go destructivo y confirmación de retención histórica.

## 6. Estrategia DEV-first para CRUD controlado de tenants

FASE 5.1 debe implementarse primero en DEV con un alcance pequeño y reversible:

1. Diseñar migración mínima y no destructiva.
2. Actualizar `docs/database-schema.md` en la misma fase que cambie tablas/RLS.
3. Mantener datos existentes de `public.conjuntos` sin backfill destructivo.
4. Crear o adaptar RPC `SECURITY DEFINER` para escritura controlada si se adopta ese camino.
5. Validar grants: no `anon`, no escritura directa para `authenticated` normal.
6. Validar que `platform_superadmin` y `platform_ops` tienen solo las acciones permitidas.
7. Validar que usuarios tenant no pueden modificar lifecycle ni leer metadata no autorizada.
8. Verificar que dashboards/read-only existentes no rompen con los campos nuevos.
9. Ejecutar pruebas negativas cross-tenant y de roles plataforma.
10. Solo después de DEV estable, preparar promoción QA/PROD con checklist explícito.

## 7. Decisión recomendada: CRUD directo vs RPC `SECURITY DEFINER`

El CRUD inicial **debe implementarse mediante RPC `SECURITY DEFINER` autorizada**, no mediante acceso directo del frontend a `public.conjuntos` o a una tabla lifecycle.

Justificación:

- La documentación actual indica que `public.conjuntos` no tiene políticas de escritura para clientes `anon`/`authenticated`.
- El lifecycle requiere validaciones transaccionales: autorización por rol plataforma, transición válida de estado, razón obligatoria y auditoría.
- Una RPC permite centralizar reglas y evitar que el frontend manipule campos sensibles.
- El patrón ya usado en FASE 4 para Superadmin read-only consume RPCs `SECURITY DEFINER` autorizadas por `superadmin` o `platform_ops`; FASE 5 debe extender ese patrón para mutaciones, con mayor auditoría.

Condiciones obligatorias de la RPC futura:

- `SECURITY DEFINER` con `search_path` seguro.
- Validación explícita de `auth.uid()` no nulo.
- Validación explícita de `fn_is_platform_superadmin()` o `fn_has_platform_role('platform_ops')` según acción.
- No grant a `anon`.
- Parámetros mínimos y tipados.
- Transiciones de estado validadas server-side.
- Auditoría en la misma transacción.
- Errores claros sin filtrar datos de otros tenants.

## 8. Riesgos principales

### Borrar tenants

Eliminar filas de `public.conjuntos` puede romper FKs, módulos relacionados, auditoría histórica y reportes. La baja funcional debe modelarse como `archived`, no como `DELETE`.

### Datos históricos

Pagos, visitas, residentes, reservas, incidentes, auditoría y memberships pueden requerir retención aunque el tenant esté suspendido o archivado. La estrategia debe preservar histórico y evitar cascadas destructivas.

### RLS y acceso cross-tenant

Cualquier nuevo campo/tabla debe respetar filtros por `conjunto_id`, `residente_id` cuando aplique y `auth.uid()`. Las funciones auxiliares legacy y platform-aware deben mantenerse coherentes para no abrir lectura global accidental.

### Registros relacionados

`conjuntos` es tabla padre de múltiples módulos. Cambios de estado tenant deben definir efectos sobre `tenant_memberships`, usuarios, configuración de pagos, visitas, reservas, comunicados y demás tablas con FK a `conjuntos.id`, sin inventar relaciones no documentadas.

### Regresiones en dashboard/tenants

FASE 4 dejó pantallas Superadmin read-only. Agregar lifecycle no debe romper listados existentes ni cambiar semántica de métricas sin actualización explícita de RPCs, documentación y validaciones.

### Drift documentación/migraciones

Si FASE 5.1 cambia tablas, columnas, FKs o policies, debe actualizar `docs/database-schema.md` en el mismo PR y verificar consistencia contra `supabase/migrations/`.

## 9. No-go criteria antes de FASE 5.1

No avanzar a implementación si ocurre cualquiera de estos puntos:

- No existe decisión explícita entre extender `public.conjuntos` o crear tabla complementaria.
- No está definido el conjunto exacto de estados lifecycle y transiciones permitidas.
- No está definida la matriz de permisos por acción entre `platform_superadmin` y `platform_ops`.
- No existe diseño de auditoría append-only para mutaciones lifecycle.
- Se pretende usar `service_role` desde frontend.
- Se pretende habilitar escritura directa de `authenticated` normal sobre `public.conjuntos`.
- No hay estrategia para evitar `DELETE` destructivo de tenants.
- No se validó impacto en dashboards/listados Superadmin read-only.
- No se definieron pruebas negativas para `anon`, usuario tenant normal y cross-tenant.
- No se planificó actualización de `docs/database-schema.md` junto con cualquier migración futura.

## 10. Roadmap sugerido FASE 5.1 a 5.5

### FASE 5.1 — Diseño implementable y migración mínima DEV

- Decidir estructura: columnas en `public.conjuntos` o tabla complementaria.
- Crear migración no destructiva en DEV.
- Actualizar `docs/database-schema.md`.
- Definir constraints/checks de estados si aplica.
- Preparar auditoría base.

### FASE 5.2 — RPC lifecycle controlada

- Implementar RPC(s) `SECURITY DEFINER` para crear/editar/transicionar tenants.
- Autorizar por `fn_is_platform_superadmin()` y `fn_has_platform_role('platform_ops')` según acción.
- Registrar auditoría transaccional.
- Agregar pruebas negativas de grants y roles.

### FASE 5.3 — Backoffice Superadmin CRUD limitado

- Añadir UI mínima sobre patrones existentes.
- Consumir solo RPCs autorizadas, no writes directos a tablas.
- Mostrar estados lifecycle y razones operativas.
- Mantener alcance DEV-first.

### FASE 5.4 — Bloqueo operativo por estado tenant

- Definir puntos donde `suspended`/`archived` limita operación.
- Evitar ruptura de lecturas históricas necesarias.
- Validar tenant normal, admin tenant, residente y plataforma.

### FASE 5.5 — Promoción QA/PROD y readiness provisioning

- Ejecutar checklist QA/PROD.
- Validar migraciones, RLS, grants y auditoría.
- Preparar criterios para provisioning futuro sin mezclarlo con CRUD inicial.
- Documentar rollback no destructivo.

## Validación de esta fase documental

- Documento creado para guiar FASE 5.1.
- Sin cambios de runtime.
- Sin migraciones.
- Sin cambios de frontend.
- Sin cambios de RLS.
- Validación recomendada para este PR: `git diff --check`.
