# FASE 4.0 — Readiness Superadmin MVP

## 1. Propósito y alcance de esta fase

FASE 4.0 deja documentado el punto de partida para iniciar el desarrollo del módulo **Superadmin MVP** de Urbaphix como plataforma SaaS multi-conjunto. Esta fase es exclusivamente documental: no crea migraciones, no modifica frontend, no cambia RLS, no toca configuración de Vercel y no altera datos de producción.

El objetivo es declarar que el hardening mínimo requerido para empezar Superadmin ya no bloquea el trabajo de producto. Los pendientes de seguridad y consistencia continúan como backlog paralelo, pero el desarrollo del módulo de plataforma puede arrancar con guardas explícitas, validaciones por ambiente y límites claros de acceso.

## 2. Estado de readiness técnico

### 2.1 Base de datos y modelo de membresías

La base técnica para Superadmin existe en el modelo actual:

- `platform_memberships` está documentada como tabla de membresías de alcance global SaaS, con roles `superadmin`, `platform_support`, `platform_auditor` y `platform_ops`.
- `tenant_memberships` está documentada como tabla de membresías por `conjunto_id`, con roles tenant `admin_conjunto`, `vigilante`, `residente`, `contador` y `comite`.
- `fn_is_platform_superadmin()` permite identificar sesiones autenticadas con rol plataforma `superadmin` activo.
- `fn_has_platform_role(target_role_name text)` permite validar roles plataforma específicos, incluyendo `platform_ops`.
- Los grants `anon` heredados sobre memberships fueron reducidos en FASE 3D.34; login, bootstrap y operación deben consultar memberships únicamente con sesión autenticada o backend autorizado.

### 2.2 Hardening mínimo completado antes de FASE 4.0

Para iniciar el MVP Superadmin se consideran completados como base mínima:

| Fase       | Resultado relevante para readiness                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| FASE 3D.32 | Revocación controlada de grants `anon` sobre `archivos` y `usuarios_app`, reduciendo exposición heredada por GraphQL/PostgREST.                 |
| FASE 3D.34 | Revocación controlada de grants `anon` sobre `platform_memberships` y `tenant_memberships`, manteniendo acceso autenticado y RLS.               |
| FASE 3D.36 | Revocación controlada de grants `anon` sobre `visitantes` y `registro_visitas`, reduciendo exposición de datos operativos sensibles de visitas. |

Estas fases no eliminan toda la deuda de hardening, pero sí bajan el riesgo de iniciar un módulo interno de plataforma basado en autenticación y roles plataforma.

### 2.3 Premisas de implementación

- Superadmin no debe depender de acceso anónimo a tablas internas.
- Superadmin no debe reutilizar navegación tenant como bypass de permisos.
- Superadmin debe operar sobre datos multi-conjunto con intención explícita: cada consulta cross-tenant debe estar justificada por rol plataforma, caso de uso y auditoría.
- Las operaciones de plataforma deben respetar el modelo existente y no inventar tablas, columnas ni relaciones.
- Cualquier cambio futuro de tabla, columna, FK o policy deberá implementarse en una fase posterior con migración SQL y actualización de `docs/database-schema.md`.

## 3. Alcance MVP Superadmin

El MVP Superadmin será el módulo central de operación SaaS para muchos conjuntos. Su primera versión debe priorizar visibilidad, control operativo y soporte seguro antes que automatizaciones complejas.

### 3.1 Incluido en MVP

- Vista central de estado de plataforma.
- Inventario y gestión básica de conjuntos/tenants existentes.
- Administración de membresías plataforma y membresías tenant desde flujos controlados.
- Herramientas de soporte cross-tenant con búsqueda y contexto mínimo necesario.
- Auditoría/actividad para entender acciones administrativas y operativas relevantes.
- Configuración de parámetros de plataforma que no pertenezcan a un conjunto específico.
- Observabilidad operativa para incidentes, errores, eventos y señales de salud.

### 3.2 Fuera del MVP inicial

- Rediseño completo de módulos tenant existentes.
- Cambios masivos de RLS de negocio.
- Automatización de billing avanzado, facturación electrónica o conciliaciones complejas.
- Migraciones destructivas o backfills productivos sin validación explícita.
- Acceso anónimo a cualquier recurso Superadmin.
- Copia de UX o funcionalidades de plataformas de mercado como Properix; se podrán usar solo como referencia conceptual de categoría.

## 4. Módulos Superadmin priorizados

### 4.1 Dashboard plataforma

Objetivo: entregar una vista ejecutiva y operativa del estado SaaS.

Contenido esperado:

- Conteo de conjuntos activos/inactivos.
- Conteo de usuarios por rol plataforma y tenant.
- Señales de salud operativa por módulo crítico.
- Indicadores de actividad reciente.
- Alertas de configuración incompleta o riesgos conocidos.

Guardas:

- Solo `platform_superadmin` y `platform_ops` deben acceder a métricas operativas globales.
- Métricas agregadas no deben filtrar datos sensibles innecesarios de residentes.

### 4.2 Gestión de conjuntos/tenants

Objetivo: permitir operación centralizada sobre conjuntos clientes.

Contenido esperado:

- Listado de conjuntos existentes.
- Vista detalle de un conjunto.
- Estado operativo del tenant.
- Resumen de torres, apartamentos, residentes y módulos activos cuando existan datos documentados.
- Acceso contextual a incidencias o señales de soporte del conjunto.

Guardas:

- Cualquier consulta por tenant debe mantener `conjunto_id` explícito.
- Acceso cross-tenant solo desde rol plataforma autorizado.
- No crear ni modificar estructura de datos en esta fase documental.

### 4.3 Gestión de usuarios y memberships

Objetivo: administrar relación usuario ↔ plataforma ↔ tenant de forma segura.

Contenido esperado:

- Vista de `platform_memberships` por usuario y rol.
- Vista de `tenant_memberships` por conjunto y usuario.
- Estado de membresía: `active`, `suspended`, `revoked`.
- Flujos futuros para crear, suspender o revocar memberships con auditoría.
- Detección de inconsistencias entre `usuarios_app`, `residentes` y `tenant_memberships` como herramienta de soporte, no como bypass.

Guardas:

- `superadmin` puede operar membresías plataforma y tenant según RLS vigente.
- `platform_ops` puede participar en operación tenant donde las policies lo permitan.
- No debe existir self-escalation: un usuario no puede concederse privilegios plataforma.
- Eliminar memberships debe seguir denegado si las policies actuales lo deniegan; revocación lógica debe diseñarse en fases posteriores.

### 4.4 Soporte cross-tenant

Objetivo: permitir diagnóstico y soporte a múltiples conjuntos sin romper aislamiento tenant.

Contenido esperado:

- Búsqueda por conjunto, usuario, residente o identificadores documentados.
- Vista contextual de datos mínimos necesarios para soporte.
- Enlaces hacia módulos tenant con contexto explícito y restricciones de rol.
- Registro de acciones de soporte.

Guardas:

- Toda acción cross-tenant debe requerir sesión autenticada y rol plataforma autorizado.
- Las consultas deben declarar el `conjunto_id` objetivo cuando apliquen.
- No se debe habilitar navegación tenant funcional a roles plataforma sin diseño explícito.

### 4.5 Auditoría/actividad

Objetivo: dar trazabilidad a acciones administrativas, soporte y eventos operativos.

Contenido esperado:

- Actividad reciente de plataforma.
- Acciones sobre memberships.
- Eventos operativos relevantes por módulo.
- Filtros por usuario, conjunto, módulo, severidad y fecha cuando existan campos documentados.

Guardas:

- No exponer `operational_events` a clientes si la tabla continúa cerrada a `anon` y `authenticated`.
- Si se requiere lectura desde frontend Superadmin, diseñar una vía segura posterior, por ejemplo RPC/Edge Function/service role con auditoría, sin relajar RLS de forma implícita.

### 4.6 Configuración plataforma

Objetivo: separar parámetros globales SaaS de configuraciones tenant.

Contenido esperado:

- Parámetros globales de operación.
- Feature flags plataforma si el modelo existe o se define en una fase posterior.
- Políticas de soporte, límites operativos y defaults SaaS.

Guardas:

- No inventar tabla de configuración si no existe en el esquema vigente.
- Cualquier nueva estructura debe ir en fase posterior con migración, RLS y documentación.

### 4.7 Observabilidad operativa

Objetivo: ofrecer señales para operar Urbaphix como SaaS.

Contenido esperado:

- Errores o incidentes recientes.
- Estado de integraciones relevantes.
- Volumen de eventos por módulo.
- Señales de degradación por tenant.

Guardas:

- Observabilidad no debe exponer datos personales innecesarios.
- El acceso a logs/eventos debe ser por rol plataforma y vía backend seguro si las tablas no son legibles desde cliente.

## 5. Guardas de acceso

Para Superadmin MVP se adopta esta convención de producto:

| Nombre de producto    | Base técnica actual                                                                        | Uso previsto                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `platform_superadmin` | `platform_memberships.role_name = 'superadmin'` + `fn_is_platform_superadmin()`            | Administración global de plataforma, memberships y operación SaaS.           |
| `platform_ops`        | `platform_memberships.role_name = 'platform_ops'` + `fn_has_platform_role('platform_ops')` | Operación de soporte y administración tenant donde las policies lo permitan. |

Reglas obligatorias:

- Requerir sesión autenticada para todo Superadmin.
- Denegar acceso a `anon`.
- No mezclar roles plataforma con roles tenant sin una membership tenant explícita o una policy platform-aware diseñada.
- No usar `service_role` en frontend.
- No confiar en ocultar rutas como frontera de seguridad; RLS/backend deben sostener la autorización.
- Registrar y auditar acciones administrativas sensibles en fases posteriores antes de habilitarlas productivamente.

## 6. Reglas multi-tenant y no acceso anon

- Toda lectura o escritura tenant-scoped debe declarar el `conjunto_id` objetivo o derivarlo de una relación documentada.
- Las vistas globales solo pueden existir para roles plataforma autenticados.
- Los usuarios tenant (`admin_conjunto`, `vigilante`, `residente`, `contador`, `comite`) no reciben acceso global por estar autenticados.
- Los roles plataforma no reciben automáticamente permisos funcionales dentro de módulos tenant si no existe policy o flujo diseñado.
- El flujo anónimo no debe consultar `platform_memberships`, `tenant_memberships`, `usuarios_app`, visitas ni datos operativos sensibles.
- Las inconsistencias entre `usuarios_app`, `residentes` y `tenant_memberships` deben tratarse como riesgo operativo, no como permiso alternativo.

## 7. Roadmap de issues FASE 4.1 en adelante

### FASE 4.1 — Shell Superadmin y guard de rutas

- Crear layout base Superadmin.
- Implementar guardas frontend basadas en sesión autenticada y rol plataforma resuelto.
- Definir navegación inicial sin exponer módulos tenant por defecto.
- Validar estados de carga, denegado y sesión expirada.

### FASE 4.2 — Dashboard plataforma MVP

- Implementar métricas iniciales de plataforma con consultas seguras.
- Priorizar agregados no sensibles.
- Documentar queries y dependencias de tablas.

### FASE 4.3 — Gestión de conjuntos/tenants

- Implementar listado y detalle de conjuntos.
- Definir filtros por estado y búsqueda.
- Mantener `conjunto_id` explícito en todo drill-down.

### FASE 4.4 — Usuarios y memberships

- Implementar vistas de `platform_memberships` y `tenant_memberships`.
- Diseñar flujos de alta/suspensión/revocación con RLS y auditoría antes de habilitar escrituras.
- Agregar validaciones de no self-escalation.

### FASE 4.5 — Soporte cross-tenant

- Implementar búsqueda segura por tenant/usuario/residente.
- Diseñar pantalla de contexto mínimo para soporte.
- Registrar acciones de soporte sensibles.

### FASE 4.6 — Auditoría y actividad

- Definir fuente segura para eventos operativos.
- Si `operational_events` continúa cerrada a clientes, diseñar RPC/Edge Function para lectura Superadmin.
- Crear filtros por fecha, módulo, tenant y severidad si están soportados por el esquema.

### FASE 4.7 — Configuración plataforma

- Inventariar parámetros globales reales existentes.
- Diseñar tabla/configuración si falta estructura, con migración y RLS en PR separado.
- Separar configuración plataforma de configuración por conjunto.

### FASE 4.8 — Observabilidad operativa

- Consolidar señales de errores, eventos y salud.
- Definir alertas internas y estados por tenant.
- Evitar exposición de PII y secretos.

### Backlog paralelo de hardening

- Continuar reducción de exposición `anon` donde aplique.
- Validar consistencia `usuarios_app` ↔ `tenant_memberships` ↔ `residentes`.
- Evaluar migración gradual de helpers legacy hacia autorización tenant-aware.
- Fortalecer pruebas negativas cross-tenant y evidencia por rol.

## 8. Riesgos y no-go

### Riesgos principales

- Divergencia entre `usuarios_app` y `tenant_memberships` que cause discrepancias UI/RLS.
- Roles plataforma usados accidentalmente como bypass de aislamiento tenant.
- Consultas globales que expongan datos personales o sensibles innecesarios.
- Falta de auditoría para acciones administrativas de alto impacto.
- Dependencia indebida de `service_role` desde cliente.
- Crecimiento del alcance MVP hacia billing, analytics avanzados o automatizaciones antes de cerrar guardas básicas.

### No-go para habilitar una funcionalidad Superadmin productiva

- Requiere acceso `anon` a tablas internas.
- Requiere modificar RLS sin migración, revisión y documentación.
- Requiere inventar columnas/tablas no documentadas.
- Permite self-escalation de platform roles.
- Permite navegación tenant funcional sin `conjunto_id` explícito o autorización platform-aware clara.
- Expone datos cross-tenant sin justificación de soporte, operación o auditoría.
- Usa `service_role` en frontend.

## 9. Decisión FASE 4.0

Urbaphix está listo para iniciar **FASE 4.1 — Shell Superadmin y guard de rutas** como desarrollo del MVP Superadmin, manteniendo el hardening restante como backlog paralelo y no como bloqueo principal.

La implementación deberá avanzar en PRs pequeños, verificando en cada fase:

- fuente de verdad de esquema antes de consultar Supabase;
- guardas por `platform_superadmin`/`platform_ops`;
- aislamiento por `conjunto_id`;
- ausencia de acceso anónimo;
- documentación actualizada cuando haya cambios estructurales.
