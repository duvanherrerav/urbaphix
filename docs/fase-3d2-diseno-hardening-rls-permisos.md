# FASE 3D.2 — Diseño técnico de hardening RLS y permisos por módulo

## 1. Resumen ejecutivo

Después del rollout controlado del `membershipResolver`, Urbaphix ya puede resolver el contexto funcional de un usuario desde `tenant_memberships` cuando `VITE_ENABLE_MEMBERSHIP_RESOLVER=true`, manteniendo `usuarios_app` como fallback legacy. La auditoría FASE 3D.1 confirmó que esta convivencia es operativamente segura para navegación, pero también expuso una brecha de diseño: el frontend puede operar con identidad derivada de `tenant_memberships`, mientras muchas policies RLS de negocio siguen evaluando `usuarios_app` mediante `fn_auth_conjunto_id()`, `fn_auth_rol()` y `fn_auth_residente_id()`.

Esta fase reduce el riesgo de improvisar cambios RLS sensibles. Su propósito es dejar una arquitectura objetivo, helpers propuestos, matriz módulo-tablas-permisos, roadmap, rollback y validaciones antes de ejecutar SQL o modificar políticas. En particular, evita que una futura fase endurezca pagos, visitas, reservas, paquetes o notificaciones sin confirmar antes las invariantes de tenant, rol, residente y compatibilidad legacy.

Esta fase **no modifica todavía**:

- Supabase.
- Migraciones.
- Policies RLS.
- Helpers SQL.
- Datos.
- Variables `.env`.
- Vercel.
- Frontend funcional.
- Producción, QA o DEV Supabase.

La decisión técnica que deja preparada es adoptar un hardening gradual con `tenant_memberships` como fuente principal de autorización tenant, sin romper de golpe el periodo híbrido. La recomendación es implementar helpers tenant-aware nuevos por fases y migrar policies por módulo, conservando wrappers o compatibilidad legacy solo como puente controlado y medible.

## 2. Estado actual del modelo de autorización

### 2.1 Uso actual de `usuarios_app`

`usuarios_app` sigue siendo la pieza legacy central para identidad operativa de módulos:

- Bootstrap/login legacy y fallback del resolver.
- `rol_id`, `conjunto_id` y datos básicos entregados como `usuarioApp` a la UI.
- FKs de actor o destinatario en módulos como incidentes, pagos, paquetes, registro de visitas, reservas y notificaciones.
- Helpers RLS legacy que consultan `usuarios_app` para resolver rol y conjunto.
- Relaciones indirectas desde `residentes` para resolver ownership de residentes.

La FASE 3D.1 identificó además que `usuarios_app` aparece con SELECT amplio documentado, por lo que debe tratarse como tabla sensible P1 antes de ampliar roles platform o soporte.

### 2.2 Uso actual de `tenant_memberships`

`tenant_memberships` existe como tabla de membresías por `conjunto_id` para coexistencia con el modelo legacy. Documenta `user_id`, `conjunto_id`, `role_name`, `residente_id`, `status`, `source_legacy` y restricciones de roles `admin_conjunto|vigilante|residente|contador|comite`.

Actualmente se usa principalmente para:

- Resolver perfil funcional desde el frontend cuando el feature flag del resolver está activo.
- Seleccionar memberships activas compatibles con la navegación actual.
- Mapear roles tenant a roles legacy de UI.
- Proteger la propia tabla con RLS basada en helpers de tenant/plataforma.

No gobierna todavía, de forma transversal, las policies RLS de las tablas de negocio.

### 2.3 Rol del `membershipResolver`

El `membershipResolver` es una capa de compatibilidad frontend, no una frontera de seguridad. Cuando el flag está encendido, consulta `usuarios_app` y `tenant_memberships`, prefiere una membership activa compatible y conserva fallback legacy. Sus reglas relevantes son:

| `tenant_memberships.role_name` | Rol entregado a UI | Observación |
| --- | --- | --- |
| `admin_conjunto` | `admin` | Compatible con módulos admin actuales. |
| `vigilante` | `vigilancia` | Requiere normalización en RLS porque legacy usa `vigilancia`. |
| `residente` | `residente` | Requiere `residente_id` no nulo para ser compatible. |
| `contador` | Sin navegación legacy | No debe conceder permisos implícitos hasta diseñar módulo/rol. |
| `comite` | Sin navegación legacy | No debe conceder permisos implícitos hasta diseñar módulo/rol. |

El resolver puede reducir inconsistencias visuales, pero no reemplaza RLS. Si una policy RLS sigue leyendo `usuarios_app`, la autorización efectiva en base de datos puede diferir de la autorización visual del frontend.

### 2.4 Helpers RLS actuales conocidos

Helpers legacy documentados desde el esquema/migraciones:

| Helper actual | Fuente efectiva | Uso actual | Riesgo |
| --- | --- | --- | --- |
| `fn_auth_conjunto_id()` | `usuarios_app.conjunto_id` por `auth.uid()` | Same-tenant en múltiples tablas. | Diverge si `tenant_memberships.conjunto_id` activo no coincide con `usuarios_app`. |
| `fn_auth_rol()` | `usuarios_app.rol_id` por `auth.uid()` | Admin/vigilancia/residente en policies legacy. | Diverge si el rol activo viene de membership o si `vigilante` no está normalizado a `vigilancia`. |
| `fn_auth_residente_id()` | `residentes.id` por `residentes.usuario_id = auth.uid()` | Ownership residente. | Diverge si `tenant_memberships.residente_id` no coincide con `residentes.usuario_id`. |

Helpers de memberships/plataforma ya existentes:

| Helper actual | Propósito actual | Límite actual |
| --- | --- | --- |
| `fn_is_platform_superadmin()` | Identificar superadmin de plataforma. | No debe habilitar módulos tenant sin diseño explícito. |
| `fn_has_platform_role(target_role_name text)` | Validar rol platform específico. | Uso acotado a plataforma/memberships. |
| `fn_has_tenant_access(target_conjunto_id uuid)` | Validar membership activa del usuario en un conjunto. | No valida rol ni ownership residente. |
| `fn_has_tenant_role(target_conjunto_id uuid, target_role_name text)` | Validar membership activa con rol específico. | Usa nombres tenant (`admin_conjunto`, `vigilante`, etc.), no nombres UI legacy. |

### 2.5 Dependencias legacy detectadas

La auditoría FASE 3D.1 detectó dependencias directas o indirectas de `usuarios_app` en:

- Bootstrap/auth y login.
- Membership resolver como fallback.
- Notificaciones por `usuario_id`.
- Visitas/portería por admins del conjunto, vigilante validador y relaciones con residentes/visitantes.
- Incidentes por `reportado_por` y notificaciones.
- Pagos y `pagos_eventos` por actores, aprobaciones/rechazos y notificaciones.
- Paquetería por `recibido_por`, destinatario residente y notificaciones.
- Reservas por actores de aprobación, rechazo, check-in/check-out y relaciones `residentes -> usuarios_app`.

Estas dependencias no son necesariamente errores; varias son FKs de auditoría válidas. El riesgo aparece cuando se usan como fuente canónica de autorización mientras la UI ya puede resolver desde memberships.

### 2.6 Autorización visual/frontend vs autorización efectiva/RLS

- **Autorización visual/frontend:** decide qué rutas, botones, widgets y formularios se muestran. Hoy consume el objeto `usuarioApp` normalizado por login/bootstrap/resolver.
- **Autorización efectiva/RLS:** decide qué filas puede leer/escribir Supabase. Debe ser la frontera de seguridad y no depender de que el frontend filtre correctamente.
- **Defensa en profundidad:** los filtros frontend por `conjunto_id`, `residente_id` y `usuario_id` deben mantenerse, pero nunca considerarse sustituto de RLS.

## 3. Arquitectura objetivo de autorización

### 3.1 Principios

1. `auth.uid()` identifica al usuario autenticado.
2. `tenant_memberships` activas son la fuente principal de membresía tenant y rol operativo.
3. `usuarios_app` se mantiene como perfil legacy, fuente de FKs históricas y fallback temporal, pero no debe ser la fuente final de autorización multi-tenant.
4. RLS debe evaluar tenant, rol y ownership con helpers explícitos y estables.
5. Todo acceso a datos tenant debe quedar acotado por `conjunto_id`, `residente_id` o relación verificable con una fila tenant.
6. Roles platform (`superadmin`, `platform_ops`, `platform_support`, `platform_auditor`) no equivalen automáticamente a roles tenant.
7. Cualquier acceso platform a datos tenant debe ser explícito, auditado y preferiblemente separado de la navegación cotidiana de conjuntos.
8. El periodo híbrido debe ser temporal, medible y reversible.

### 3.2 Separación de dominios

| Dominio | Identidad fuente | Alcance objetivo | Restricción principal |
| --- | --- | --- | --- |
| Plataforma Urbaphix | `platform_memberships` | Operación interna, soporte, auditoría y superadmin. | No concede acceso tenant funcional por defecto. |
| Conjunto cliente | `conjuntos` + `tenant_memberships.conjunto_id` | Datos y operación de un tenant. | Cero acceso cruzado entre conjuntos salvo rol platform explícito y auditado. |
| Usuario autenticado | `auth.uid()` | Sesión Supabase. | Toda policy debe partir de usuario autenticado o service role controlado. |
| Administración de conjunto | `tenant_memberships.role_name = 'admin_conjunto'` | Operación administrativa del mismo conjunto. | Lectura/escritura solo por `conjunto_id`. |
| Vigilancia | `tenant_memberships.role_name = 'vigilante'` | Portería, visitas, paquetes, incidentes operativos y check-in/check-out. | Operación solo del mismo conjunto; sin permisos financieros admin. |
| Residente | `tenant_memberships.role_name = 'residente'` + `residente_id` | Datos propios y flujos propios. | Ownership por `residente_id` y conjunto asociado. |
| Compatibilidad legacy | `usuarios_app` + `residentes` | FKs, fallback y transición. | No debe ampliar permisos si membership está suspendida/revocada en el modelo objetivo. |

### 3.3 Reglas anti acceso cruzado entre conjuntos

- Toda tabla con `conjunto_id` debe filtrar en RLS por membership activa del usuario en ese `conjunto_id`.
- Toda tabla sin `conjunto_id` explícito debe derivar tenant mediante relación obligatoria antes de endurecer; si no hay relación verificable, debe quedar en inventario P2/P3 y no recibir nuevas autorizaciones amplias.
- Escrituras deben exigir que `NEW.conjunto_id` pertenezca al conjunto activo autorizado.
- Updates/deletes deben validar tanto la fila existente (`USING`) como el nuevo estado (`WITH CHECK`).
- Realtime y consultas frontend deben conservar filtros por `conjunto_id`, pero RLS debe seguir bloqueando aunque falte el filtro cliente.

### 3.4 Reglas para consultas por `conjunto_id`

- Admin/vigilancia pueden leer datos operativos del mismo `conjunto_id` si el módulo lo permite.
- Residente solo puede leer datos del conjunto cuando además exista ownership propio o el dato sea catálogo visible para residentes.
- Policies de catálogo (`recursos_comunes`, `tipos_documento`, configuraciones visibles) deben distinguir lectura tenant de escritura admin.
- `config_pagos` no debe quedar con lectura global si contiene URLs, instrucciones o datos de recaudo por conjunto.

### 3.5 Reglas para consultas por `residente_id`

- `residente_id` debe validarse contra membership activa y contra `residentes.usuario_id = auth.uid()` durante la transición.
- Para residentes, lectura/escritura propia debe requerir `residente_id = fn_auth_tenant_residente_id(conjunto_id)` o relación equivalente.
- Para admin/vigilancia, lectura de residentes se permite solo dentro del `conjunto_id` activo y según módulo.
- Cualquier discrepancia entre `tenant_memberships.residente_id`, `residentes.id`, `residentes.usuario_id` y `residentes.conjunto_id` debe bloquear hardening productivo.

### 3.6 Reglas para acciones administrativas

Admin de conjunto (`admin_conjunto`) puede, dentro de su conjunto:

- Leer dashboard y datos operativos del conjunto.
- Crear cobros y gestionar pagos administrativos.
- Aprobar/rechazar pagos según módulo.
- Gestionar reservas admin, recursos, bloqueos y documentos.
- Actualizar incidentes administrativos.
- Consultar residentes, apartamentos y torres del conjunto.

No debe:

- Acceder a otros conjuntos.
- Modificar memberships tenant salvo flujo platform/administración diseñado.
- Heredar permisos platform.
- Saltarse ownership de residente en módulos personales.

### 3.7 Reglas para acciones de vigilancia

Vigilancia (`vigilante`) puede, dentro de su conjunto:

- Validar ingreso/salida de visitas.
- Crear o actualizar eventos de portería permitidos.
- Registrar/entregar paquetes.
- Reportar incidentes.
- Ejecutar check-in/check-out de reservas si el módulo lo permite.

No debe:

- Crear cobros, aprobar pagos o modificar configuración financiera.
- Leer datos personales fuera de los necesarios para portería del conjunto.
- Acceder a visitas/paquetes/incidentes de otro conjunto.

### 3.8 Reglas para acciones de residente

Residente puede:

- Leer y actualizar flujos propios por `residente_id`.
- Consultar sus pagos, paquetes, visitas y reservas.
- Crear solicitudes de visita y reservas propias.
- Subir/reemplazar comprobantes de pagos propios dentro del conjunto.

No debe:

- Leer datos de otros residentes salvo catálogos públicos del conjunto.
- Crear notificaciones arbitrarias a terceros.
- Modificar estados administrativos.
- Operar si su membership está `suspended` o `revoked`.

## 4. Helpers RLS objetivo propuestos

> Esta sección diseña helpers. **No se implementan en esta fase**. Los nombres son sugeridos para una futura migración SQL en DEV.

### 4.1 Estrategia recomendada de helpers

Se recomienda no modificar de inmediato `fn_auth_conjunto_id()`, `fn_auth_rol()` y `fn_auth_residente_id()` porque son transversales y un cambio directo puede romper varios módulos al mismo tiempo. La ruta más segura es:

1. Crear helpers nuevos tenant-aware en DEV.
2. Validarlos con prechecks y usuarios reales.
3. Migrar policies por módulo hacia helpers nuevos.
4. Solo al final decidir si los helpers legacy se convierten en wrappers tenant-aware o quedan documentados como legacy.

### 4.2 Catálogo de helpers propuestos

| Nombre sugerido | Propósito | Entrada / salida esperada | Tablas que dependerían de él | Riesgos | Reemplaza helper legacy | DEV primero |
| --- | --- | --- | --- | --- | --- | --- |
| `fn_auth_active_tenant_membership(target_conjunto_id uuid)` | Validar que `auth.uid()` tiene membership activa en el conjunto. | Entrada: `target_conjunto_id`; salida: boolean. | Todas las tablas con `conjunto_id`: pagos, incidentes, paquetes, registro_visitas, reservas_*, recursos_comunes, config_pagos, apartamentos, torres. | Si hay backfill incompleto puede denegar usuarios válidos legacy. | Complementa/reemplaza gradualmente `fn_auth_conjunto_id() = conjunto_id`. | Sí. |
| `fn_auth_active_tenant_role(target_conjunto_id uuid, target_role_name text)` | Validar rol tenant activo exacto. | Entrada: conjunto y rol tenant; salida: boolean. | Policies admin/vigilancia/residente por módulo. | Mismatch de nombres `vigilante`/`vigilancia`; roles futuros no diseñados. | Complementa/reemplaza `fn_auth_rol()`. | Sí. |
| `fn_auth_active_tenant_role_any(target_conjunto_id uuid, target_role_names text[])` | Validar cualquiera de varios roles tenant. | Entrada: conjunto y arreglo de roles; salida: boolean. | Lecturas admin/vigilancia, reservas, visitas, paquetes. | Arreglos demasiado amplios pueden conceder permisos no previstos. | Reemplaza patrones `fn_auth_rol() = ANY (...)`. | Sí. |
| `fn_auth_tenant_residente_id(target_conjunto_id uuid)` | Obtener `residente_id` activo para el usuario en ese conjunto. | Entrada: conjunto; salida: uuid nullable. | pagos, paquetes, registro_visitas, visitantes, reservas_zonas, residentes. | Múltiples memberships activas o dato nulo; requiere unicidad y validación de invariantes. | Complementa/reemplaza `fn_auth_residente_id()`. | Sí. |
| `fn_auth_is_tenant_residente(target_conjunto_id uuid, target_residente_id uuid)` | Validar que un residente pertenece al usuario autenticado en ese tenant. | Entrada: conjunto y residente; salida: boolean. | Mis pagos, mis paquetes, reservas residente, visitas residente. | Divergencia `tenant_memberships.residente_id` vs `residentes.usuario_id`; debe decidir si exigir ambos durante transición. | Reemplaza checks directos de `fn_auth_residente_id()`. | Sí. |
| `fn_auth_is_tenant_admin(target_conjunto_id uuid)` | Validar admin del conjunto. | Entrada: conjunto; salida: boolean. | Dashboard, pagos admin, reservas admin, incidentes admin, recursos/bloqueos/configuración. | Si se usa para notificaciones sin contexto puede ampliar demasiado. | Reemplaza `fn_auth_rol() = 'admin' AND fn_auth_conjunto_id() = ...`. | Sí. |
| `fn_auth_is_tenant_vigilancia(target_conjunto_id uuid)` | Validar vigilancia del conjunto aceptando naming tenant `vigilante`. | Entrada: conjunto; salida: boolean. | Control visitas, paquetes vigilancia, incidentes vigilancia, reservas vigilancia. | Normalización incompleta si existen datos legacy `vigilancia` en memberships o `vigilante` en usuarios_app. | Reemplaza `fn_auth_rol() = 'vigilancia'`. | Sí. |
| `fn_auth_is_tenant_residente_role(target_conjunto_id uuid)` | Validar rol residente activo del conjunto. | Entrada: conjunto; salida: boolean. | Flujos propios de residentes y catálogos visibles. | Rol residente sin `residente_id` debe devolver false. | Complementa `fn_auth_residente_id()`. | Sí. |
| `fn_auth_is_platform_operator(target_role_names text[])` | Validar rol platform explícito para operaciones internas. | Entrada: roles platform; salida: boolean. | Solo tablas platform/memberships y futuras pantallas platform. | Mezclarlo en módulos tenant puede crear bypass cross-tenant. | No reemplaza helpers tenant. | Sí, con uso restringido. |
| `fn_auth_can_access_tenant_for_support(target_conjunto_id uuid, purpose text)` | Diseñar acceso platform auditado a tenant para soporte. | Entrada: conjunto y propósito; salida: boolean o futuro registro auditado. | Futuro soporte/superadmin, no módulos actuales. | Puede convertirse en super-bypass si no exige auditoría y propósito. | No aplica. | Sí, solo si se implementa auditoría. |
| `fn_auth_legacy_conjunto_id_compat()` | Compatibilidad temporal con `usuarios_app` cuando no hay membership activa validada. | Sin entrada; salida: uuid nullable. | Solo fase híbrida controlada. | Si se usa indefinidamente perpetúa permisos de usuarios suspendidos en memberships. | Wrapper temporal de `fn_auth_conjunto_id()`. | Sí, si se justifica. |
| `fn_auth_legacy_role_compat()` | Compatibilidad temporal de rol legacy. | Sin entrada; salida: text nullable normalizado. | Solo fase híbrida controlada. | Puede mantener mismatch y deuda. Debe registrar fecha de retiro. | Wrapper temporal de `fn_auth_rol()`. | Sí, si se justifica. |

### 4.3 Reglas de diseño para helpers

- Todos los helpers SECURITY DEFINER deben fijar `search_path = public, pg_temp`.
- Deben retornar `false`/`null` de forma segura ante ausencia de membership.
- No deben conceder permisos por roles `contador` o `comite` hasta que exista diseño funcional.
- Para residentes, deben exigir membership activa con `residente_id` y validar consistencia con `residentes` durante la transición.
- Para vigilancia, deben aceptar el rol tenant canónico `vigilante` y traducirlo conceptualmente a permiso operativo `vigilancia`.
- Para platform, deben mantenerse separados de helpers tenant.

## 5. Matriz módulo-tablas-permisos objetivo

| Módulo | Rol | Tablas | Permiso esperado | Filtro esperado | Dependencia actual | Estado objetivo | Prioridad |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard Admin | `admin_conjunto` | `pagos`, `incidentes`, `registro_visitas`, `reservas_zonas`, `apartamentos`, `paquetes`, `torres` | SELECT agregado del conjunto. | `conjunto_id` con membership admin activa. | UI `usuarioApp`; RLS legacy `fn_auth_conjunto_id()`/`fn_auth_rol()`. | RLS tenant-aware por `fn_auth_is_tenant_admin` o lectura admin same-tenant. | P1 |
| Pagos | `admin_conjunto` | `pagos`, `pagos_eventos`, `residentes`, `apartamentos`, `torres`, `notificaciones`, `usuarios_app` | SELECT/INSERT/UPDATE administrativo; eventos financieros. | `pagos.conjunto_id`; eventos del mismo conjunto; actor `auth.uid()`. | Helpers legacy; hardening pagos posterior pendiente de reconciliación documental por ambiente. | Policies de pagos/eventos por admin tenant y residente owner; notificaciones acotadas por destinatario/contexto. | P0/P1 |
| Crear cobro | `admin_conjunto` | `pagos`, `pagos_eventos`, `residentes`, `apartamentos`, `torres`, `notificaciones` | INSERT cobro y evento; lectura de residentes del conjunto. | `conjunto_id` del admin; residentes del mismo conjunto. | UI filtra conjunto; RLS legacy admin. | INSERT con `WITH CHECK fn_auth_is_tenant_admin(conjunto_id)` y evento actor consistente. | P0/P1 |
| Mis pagos | `residente` | `pagos`, `pagos_eventos`, `config_pagos`, `residentes`, storage `comprobantes` | SELECT propios; update comprobante propio; lectura config del conjunto. | `residente_id = fn_auth_tenant_residente_id(conjunto_id)` y same tenant. | `fn_auth_residente_id()`/residentes; referencia storage comprobantes. | Owner-only por membership residente; storage/config por conjunto y ownership. | P0/P1 |
| Incidentes | `admin_conjunto` | `incidentes`, `notificaciones`, `usuarios_app` | SELECT/UPDATE incidentes del conjunto. | `incidentes.conjunto_id`; admin tenant. | RLS legacy; algunos updates por `id`. | Updates con same-tenant en RLS y, en futuras mejoras, filtro cliente defensivo por conjunto. | P1/P2 |
| Reportar incidente | `vigilante` | `incidentes`, `notificaciones`, `usuarios_app` | INSERT incidente operativo; notificar admin autorizado. | `conjunto_id` de membership vigilancia; `reportado_por = auth.uid()` o actor válido. | RLS espera rol legacy `vigilancia`. | Helper `fn_auth_is_tenant_vigilancia`; notificaciones solo a admins del mismo conjunto. | P1 |
| Reservas Admin | `admin_conjunto` | `recursos_comunes`, `reservas_zonas`, `reservas_eventos`, `reservas_bloqueos`, `reservas_documentos`, `residentes` | SELECT/INSERT/UPDATE admin; aprobar/rechazar; bloquear recursos. | `conjunto_id` del admin. | Buen patrón por conjunto pero helpers legacy. | Migrar a helpers tenant-aware y granular eventos/documentos. | P1 |
| Reservas Residente | `residente` | `recursos_comunes`, `reservas_zonas`, `reservas_eventos`, `reservas_documentos`, `residentes` | SELECT recursos visibles; crear/listar reservas propias; documentos propios. | `conjunto_id` + `residente_id` propio. | `fn_auth_residente_id()` y relaciones residentes. | Owner-only por membership residente y validación de `residentes`. | P1 |
| Control de visitas / vigilancia | `vigilante` | `registro_visitas`, `visitantes`, `residentes`, `usuarios_app`, `notificaciones`, `incidentes`, `paquetes`, referencia `bitacora_porteria` | SELECT/UPDATE visitas del conjunto; registrar ingreso/salida; lectura operativa. | `registro_visitas.conjunto_id`; rol vigilancia tenant. | RLS legacy; RPCs y servicio portería; referencia no reconciliada `bitacora_porteria`. | Helper vigilancia tenant; reconciliar `bitacora_porteria` antes de endurecer. | P1/P2 |
| Solicitar visita / residente | `residente` | `visitantes`, `registro_visitas`, `residentes`, `tipos_documento`, `notificaciones`, RPC creación/reutilización | INSERT/SELECT propias; notificar contexto permitido. | `residente_id` propio y `conjunto_id` asociado. | `fn_auth_residente_id()` y RPCs. | RPC/policies owner-only por membership residente + consistencia residentes. | P1 |
| Paquetería vigilancia/admin | `vigilante`, `admin_conjunto` | `paquetes`, `residentes`, `apartamentos`, `torres`, `usuarios_app`, `notificaciones` | Vigilancia insert/update entrega; admin/vigilancia lectura del conjunto. | `paquetes.conjunto_id`; destinatario residente del conjunto. | RLS legacy; algunos updates dependen de contexto. | RLS tenant-aware por vigilancia/admin; exigir conjunto en escrituras futuras. | P1/P2 |
| Mis paquetes residente | `residente` | `paquetes`, `residentes` | SELECT paquetes propios; realtime propio. | `paquetes.residente_id = residente_id activo` y same tenant. | Relación `residentes.usuario_id`; membership aporta `residente_id` si compatible. | Owner-only por membership y validación residente. | P2/P3 |
| Perfil/configuración | `admin_conjunto`, `vigilante`, `residente` | `usuarios_app`, `notificaciones`, auth | SELECT/UPDATE propio; configuración segura por rol. | `usuarios_app.id = auth.uid()`; same tenant solo si rol lo permite. | `usuarios_app` central y SELECT amplio documentado. | Restringir `usuarios_app` a self/same-tenant justificado; platform separado. | P1 |
| Notificaciones globales | Todos según módulo | `notificaciones` y tablas origen (`pagos`, `paquetes`, `visitantes`, `residentes`) | SELECT propias; INSERT solo si emisor/contexto/destinatario autorizado. | `usuario_id = auth.uid()` para lectura; destinatario del mismo conjunto/contexto para insert. | INSERT autenticado amplio documentado. | Policies por contexto o RPC segura para creación de notificaciones. | P1 |
| Configuración pagos | `admin_conjunto`, `residente` lectura acotada | `config_pagos` | Admin gestiona; residente lee solo config de su conjunto para pagar. | `conjunto_id` tenant. | SELECT `true` documentado. | Lectura same-tenant; escritura admin tenant. | P2 |
| Archivos/documentos | Según módulo | `archivos`, `reservas_documentos`, storage `comprobantes` | Acceso por tenant y ownership del recurso. | Relación a recurso dueño + `conjunto_id`. | `archivos` SELECT amplio documentado; storage no inventariado en tabla. | Inventario previo y policies por bucket/recurso. | P1/P2 |

## 6. Priorización de hardening

### P0 — Crítico

Criterio: exposición financiera, acceso cruzado sensible o escritura amplia con impacto directo.

1. Pagos/Mis pagos/Crear cobro si la policy efectiva de comprobantes/admin no coincide con el hardening esperado en algún ambiente.
2. Storage/bucket `comprobantes` si permite lectura/escritura pública o cross-tenant no controlada.
3. Evidencia de usuario con membership suspendida/revocada que conserva escritura por `usuarios_app` activo.
4. Evidencia real de fuga cross-tenant en pagos, visitantes, paquetes, reservas o archivos.

### P1 — Alto

1. Definir y validar helpers tenant-aware sin afectar producción.
2. `usuarios_app`: restringir SELECT amplio a self/same-tenant/roles justificados.
3. `notificaciones`: rediseñar INSERT autenticado amplio.
4. Invariantes `tenant_memberships` ↔ `residentes` para flujos residentes.
5. Rol vigilancia: normalizar `vigilante` tenant vs `vigilancia` legacy.
6. Reservas robustas: migrar helpers legacy por criticidad operativa.
7. Visitas y paquetes: endurecer vigilancia/admin/residente por tenant.

### P2 — Medio

1. Reconciliar `docs/database-schema.md` con hardening de pagos aplicado por ambiente.
2. Reconciliar referencias `comprobantes` y `bitacora_porteria` con schema/migraciones/storage.
3. Endurecer `config_pagos` por conjunto.
4. Endurecer `archivos` por tenant/ownership real.
5. Estandarizar servicios para incluir `conjunto_id` defensivo en escrituras futuras.
6. Revisar tablas con RLS no visible o parcial (`parqueaderos`, `vehiculos`, `zonas_comunes`, `trasteos`).

### P3 — Bajo

1. Documentar contrato de `usuarioApp` post-resolver por rol.
2. Retirar deuda de naming en documentación cuando haya helpers nuevos.
3. Mantener checklist de nuevos módulos con filtros `conjunto_id`/`residente_id`.
4. Diseñar roles `contador` y `comite` antes de habilitar navegación o RLS específica.

### Orden recomendado de implementación

1. FASE 3D.3: precheck SQL y validación efectiva de policies en DEV/QA, sin cambios productivos.
2. FASE 3D.4: helpers tenant-aware en DEV y pruebas unitarias/manuales de autorización.
3. FASE 3D.5: hardening P0/P1 por módulo en DEV, empezando por pagos/notificaciones/usuarios_app/invariantes residente.
4. FASE 3D.6: validación QA con matriz completa por rol y multi-conjunto.
5. FASE 3D.7: piloto Production controlado, con rollback SQL preparado por policy/helper.
6. FASE 3D.8: limpieza legacy y decisión sobre wrappers `fn_auth_*`.

## 7. Roadmap de implementación por fases

### FASE 3D.3 — Precheck SQL y validación efectiva de policies en DEV/QA

Objetivo: observar el estado real antes de cambiar nada.

Entregables:

- Consultas de inventario de policies efectivas por tabla.
- Comparativo `usuarios_app` vs `tenant_memberships` por `user_id`, `conjunto_id`, rol y estado.
- Validación de invariantes residentes.
- Validación de buckets/storage relacionados con comprobantes/archivos.
- Matriz de ambientes DEV/QA con diferencias documentadas.
- Confirmación de que pagos hardening está aplicado o no por ambiente.

No debe modificar policies ni datos productivos.

### FASE 3D.4 — Helpers tenant-aware mínimos en DEV

Objetivo: implementar helpers nuevos en DEV con migración reversible.

Entregables:

- Migración SQL solo DEV/branch para helpers nuevos.
- Grants mínimos a `authenticated` y `service_role` según necesidad.
- Tests SQL manuales por rol.
- Rollback SQL de cada helper.
- Sin migrar aún todas las policies de negocio.

### FASE 3D.5 — Hardening RLS mínimo en DEV por módulos P0/P1

Objetivo: migrar policies críticas en DEV, una tabla/módulo a la vez.

Orden sugerido:

1. `usuarios_app` SELECT/UPDATE.
2. `notificaciones` SELECT/INSERT.
3. `pagos`, `pagos_eventos` y storage `comprobantes`.
4. Invariantes residentes y flujos Mis pagos/Mis paquetes/Solicitar visita/Reservas residente.
5. `registro_visitas`/`visitantes`.
6. `reservas_zonas`/`reservas_eventos`/`reservas_bloqueos`/`reservas_documentos`.
7. `paquetes`.

### FASE 3D.6 — Validación QA

Objetivo: probar con datos representativos sin afectar Production.

Entregables:

- Usuarios QA por rol: admin, vigilancia, residente, sin membership, membership inactiva y multi-membership.
- Matriz de lectura/escritura permitida/denegada.
- Evidencia Network de filtros esperados.
- Evidencia consola sin errores críticos.
- Comparación de comportamiento con resolver encendido.
- Ensayo de rollback en QA.

### FASE 3D.7 — Piloto Production controlado

Objetivo: aplicar cambios mínimos y monitoreados en Production solo con aprobación explícita.

Requisitos Go:

- DEV y QA verdes.
- Rollback SQL revisado.
- Ventana operativa definida.
- Responsable humano asignado.
- Evidencia baseline capturada.
- Módulo piloto acotado; no desplegar todo el hardening a la vez.

### FASE 3D.8 — Limpieza legacy

Objetivo: retirar deuda cuando el modelo tenant-aware esté probado.

Opciones:

- Convertir `fn_auth_conjunto_id()`, `fn_auth_rol()` y `fn_auth_residente_id()` en wrappers tenant-aware documentados.
- Mantenerlos solo como legacy y prohibir su uso en nuevas policies.
- Diseñar roles `contador`/`comite` y platform support con auditoría.

## 8. Estrategia de rollback

### 8.1 Principios generales

- Todo cambio futuro debe tener rollback escrito antes de aplicarse.
- Rollback de RLS no debe incluir `drop table`, `truncate`, `delete` de datos ni cambios destructivos.
- Si falla un módulo crítico, revertir la policy/helper puntual antes de intentar correcciones amplias.
- El feature flag del resolver puede revertir autorización visual, pero no revierte RLS. Para fallos RLS se requiere rollback SQL controlado.

### 8.2 Rollback en DEV

- Revertir migración local o crear migración inversa según práctica del equipo.
- Restaurar policy anterior con `drop policy if exists ...` + `create policy ...` a partir del baseline capturado.
- Restaurar helper anterior con `create or replace function ...` usando la definición baseline.
- Ejecutar matriz mínima por rol después de revertir.

### 8.3 Rollback en QA

- Aplicar script de rollback validado previamente en DEV.
- Capturar antes de revertir:
  - policy/helper que falló;
  - usuario/rol afectado;
  - módulo y acción;
  - error Supabase/Network;
  - timestamp y deployment asociado.
- Confirmar que QA recupera flujo legacy/híbrido esperado.

### 8.4 Rollback en Production

Condiciones para rollback inmediato:

- Admin no puede operar pagos, reservas o dashboard crítico del conjunto.
- Residente no puede ver pagos propios o subir comprobante propio.
- Vigilancia no puede registrar ingreso/salida o paquetes.
- Cualquier evidencia de acceso cross-tenant.
- Spike de errores RLS/403 en módulos críticos.
- Usuario suspendido/revocado conserva permisos efectivos.

Procedimiento:

1. Congelar nuevos cambios.
2. Capturar evidencia mínima antes de revertir.
3. Aplicar rollback SQL específico de la policy/helper afectado.
4. Validar usuario admin, vigilancia y residente.
5. Registrar hora, responsable, módulo, causa y resultado.
6. No tocar datos ni ejecutar SQL destructivo.
7. Si el fallo es visual/resolver, revertir feature flag; si el fallo es RLS, revertir policy/helper.

### 8.5 Recuperar flujo legacy si algo falla

- Mantener `usuarios_app` consistente durante todo el periodo híbrido.
- No eliminar helpers legacy hasta completar FASE 3D.8.
- Diseñar helpers compat temporales solo si una policy necesita transición.
- Validar que `VITE_ENABLE_MEMBERSHIP_RESOLVER=false` siga permitiendo login legacy cuando el problema sea frontend/resolver.
- No asumir que apagar el resolver corrige policies ya migradas a `tenant_memberships`.

## 9. Estrategia de validación

### 9.1 Usuarios/escenarios obligatorios

| Escenario | Validación esperada |
| --- | --- |
| `admin_conjunto` | Lee/escribe solo módulos admin del mismo conjunto; no accede a otro conjunto. |
| `vigilancia` / tenant `vigilante` | Opera visitas, paquetes e incidentes del mismo conjunto; no opera pagos admin. |
| `residente` | Lee/escribe solo datos propios por `residente_id`; no ve otros residentes. |
| Usuario sin membership | No obtiene acceso tenant por helpers nuevos; fallback legacy solo donde esté explícitamente permitido durante transición. |
| Usuario con membership inactiva | `suspended`/`revoked` no concede permisos; validar que `usuarios_app` no lo reautorice en policies endurecidas. |
| Usuario con múltiples memberships | Solo accede al `conjunto_id` consultado si tiene membership activa para ese conjunto; validar selección de conjunto activo. |
| Acceso cruzado entre conjuntos | Lectura/escritura denegada aunque el frontend envíe otro `conjunto_id`. |
| Rol platform sin membership tenant | No obtiene navegación/permiso tenant salvo flujo platform auditado y diseñado. |

### 9.2 Lectura/escritura permitida y denegada

Validar por módulo:

- Lectura permitida con usuario correcto y `conjunto_id`/`residente_id` correcto.
- Lectura denegada con otro conjunto.
- Lectura denegada con otro residente.
- Escritura permitida con rol correcto.
- Escritura denegada con rol incorrecto.
- Escritura denegada si `WITH CHECK` intenta cambiar `conjunto_id`, `residente_id` o actor a otro tenant.
- Updates por `id` deben fallar si la fila pertenece a otro conjunto.

### 9.3 Validación Network/frontend

- Confirmar que consultas de módulos admin incluyen `conjunto_id` cuando corresponde.
- Confirmar que módulos residente usan `residente_id` propio o relación derivada.
- Confirmar que realtime mantiene filtros por `conjunto_id`/`residente_id`.
- Confirmar que no aparecen consultas inesperadas a tablas amplias.
- Confirmar ausencia de errores críticos en consola.
- Confirmar respuestas 401/403 esperadas en casos denegados, sin romper la sesión global.

### 9.4 Matriz manual mínima por módulo

| Módulo | Admin | Vigilancia | Residente | Sin membership | Cross-tenant |
| --- | --- | --- | --- | --- | --- |
| Dashboard Admin | Lee propio conjunto. | Denegado. | Denegado. | Denegado. | Denegado. |
| Pagos / Crear cobro | Crea/actualiza propio conjunto. | Denegado. | Solo propios en Mis pagos. | Denegado. | Denegado. |
| Incidentes | Lee/actualiza propio conjunto. | Crea propio conjunto. | Solo si existe flujo diseñado propio. | Denegado. | Denegado. |
| Reservas Admin | Gestiona propio conjunto. | Solo operaciones vigilancia diseñadas. | Solo reservas propias. | Denegado. | Denegado. |
| Visitas | Lee/gestiona si admin/vigilancia del conjunto. | Ingresa/sale propio conjunto. | Solicita/lee propias. | Denegado. | Denegado. |
| Paquetes | Lee propio conjunto si admin. | Registra/entrega propio conjunto. | Lee propios. | Denegado. | Denegado. |
| Perfil/configuración | Self y permisos admin diseñados. | Self. | Self. | Self mínimo auth si aplica. | Denegado para otros perfiles. |

## 10. Riesgos y decisiones pendientes

### 10.1 Riesgos

- Policies demasiado restrictivas pueden romper módulos completos aunque el frontend esté correcto.
- Duplicidad `usuarios_app`/`tenant_memberships` puede permitir o denegar accesos de forma inconsistente.
- Algunos módulos aún dependen de filtros frontend como defensa principal visible; RLS debe ser frontera real.
- Tablas o recursos sin `conjunto_id` explícito requieren relación verificable antes de hardening.
- Pagos/comprobantes requieren validación de policies efectivas y storage, no solo documentación.
- `notificaciones` puede ser vector de escritura amplia si no se acota destinatario/contexto.
- `usuarios_app` amplio puede exponer perfiles, roles o conjuntos.
- Superadmin/platform ops futuro puede convertirse en bypass tenant si se mezcla con navegación de conjunto.
- Multi-conjunto real requiere seleccionar contexto activo de forma explícita; no basta con primera membership.
- Usuarios con rol mixto necesitan reglas de precedencia por conjunto y módulo.
- Roles `contador` y `comite` existen en membership pero no tienen autorización funcional definida.
- Referencias `comprobantes` y `bitacora_porteria` deben reconciliarse con schema/migraciones/storage antes de policies finales.

### 10.2 Decisiones pendientes

1. ¿Se migrarán policies módulo por módulo a helpers nuevos o se modificarán helpers legacy como wrappers tenant-aware?
2. ¿Cómo se seleccionará el conjunto activo para usuarios multi-membership en UI y RLS?
3. ¿Cuál será la semántica final de `usuarios_app` después del hardening: perfil, cache legacy o fuente secundaria?
4. ¿Qué permisos exactos tendrán `contador` y `comite`?
5. ¿Qué acceso platform auditado se permitirá a soporte/superadmin sobre tenants?
6. ¿Cómo se modelará RLS/storage para bucket `comprobantes` y archivos por módulo?
7. ¿Se crearán RPCs seguras para notificaciones en lugar de INSERT directo desde frontend?
8. ¿Cuándo se retirará el fallback legacy como fuente de autorización RLS?

## 11. Recomendación para la siguiente fase

La siguiente fase sana debe ser:

**FASE 3D.3 — Precheck SQL y validación efectiva de policies RLS en DEV/QA sin cambios productivos.**

Objetivo recomendado:

- Inventariar policies efectivas por ambiente.
- Confirmar diferencias entre documentación y migraciones aplicadas.
- Validar `usuarios_app` vs `tenant_memberships` sin alterar datos.
- Confirmar invariantes de residentes.
- Verificar pagos/comprobantes y notificaciones.
- Producir scripts de verificación y baseline de rollback antes de implementar helpers o policies.

No se recomienda implementar RLS directamente en Production ni modificar helpers legacy transversales sin completar ese precheck.

## 12. Confirmación explícita de alcance de FASE 3D.2

Confirmo que este entregable es exclusivamente documental y de diseño técnico:

- No se modificó Supabase.
- No se creó ninguna migración.
- No se modificó `supabase/`.
- No se modificó RLS.
- No se ejecutó SQL.
- No se modificó frontend funcional.
- No se modificaron variables `.env`.
- No se modificó Vercel.
- No se modificó Production.
- No se modificó QA.
- No se modificó DEV Supabase.
- No se cambió comportamiento de usuarios.
