# FASE 3D.1 — Auditoría documental de permisos, roles y RLS por módulo post-rollout membership resolver

## 1. Resumen ejecutivo

Esta auditoría revisa el estado documental y de código del modelo de permisos de Urbaphix después de la activación productiva del `membership resolver`, con foco en la relación entre navegación frontend, consultas Supabase, helpers RLS y las dependencias coexistentes de `usuarios_app` y `tenant_memberships`.

Conclusiones principales:

- El frontend ya puede resolver identidad desde `tenant_memberships` cuando `VITE_ENABLE_MEMBERSHIP_RESOLVER` está activo, pero sigue entregando a los módulos una forma legacy compatible (`rol_id`, `conjunto_id`, `residente_id`) para no cambiar navegación ni comportamiento funcional.
- Las políticas RLS de negocio siguen basadas mayoritariamente en los helpers legacy `fn_auth_conjunto_id()`, `fn_auth_rol()` y `fn_auth_residente_id()`, los cuales, según el esquema/migraciones vigentes, derivan su información desde `usuarios_app` y `residentes`, no directamente desde `tenant_memberships`.
- `tenant_memberships` está en uso como capa de resolución de perfil y como tabla protegida por RLS propia, pero todavía no reemplaza de forma transversal a `usuarios_app` en RLS de tablas de negocio.
- La mayoría de módulos críticos incluyen filtros frontend por `conjunto_id`, `residente_id` o `usuario_id`, lo cual reduce superficie de consulta accidental, pero la frontera de seguridad debe seguir siendo RLS.
- Persisten dependencias legacy directas o indirectas de `usuarios_app` en autenticación, notificaciones, relaciones anidadas y servicios operativos.
- No se detecta necesidad de cambios funcionales en esta fase; el siguiente paso recomendado es una FASE 3D.2 de hardening controlado, con diseño explícito para migrar helpers/policies hacia memberships o para declarar formalmente el periodo híbrido.

### Confirmación de alcance

- Esta fase fue **solo documental**.
- No se modificó Supabase.
- No se creó ninguna migración.
- No se modificó frontend funcional.
- No se modificaron variables de entorno.
- No se modificó Vercel ni Production.
- No se cambió comportamiento de usuarios.

## 2. Fuentes revisadas

Se revisaron las fuentes internas en el orden indicado por `AGENTS.md`:

1. `docs/database-schema.md` como inventario funcional de tablas, relaciones y políticas RLS documentadas.
2. `supabase/migrations/`, especialmente:
   - `20260410031821_remote_schema.sql`, donde los helpers legacy consultan `usuarios_app`/`residentes`.
   - migraciones de hardening RLS posteriores.
   - `20260528120000_fase_3c1_memberships_rls_base.sql`, donde se crean `platform_memberships`, `tenant_memberships` y helpers de membership/plataforma.
3. `src/services/`, especialmente `membershipResolver.js` y servicios de módulos.
4. Módulos React que consumen Supabase en `src/modules/` y componentes globales de notificaciones.
5. Documentación previa de FASE 3A, 3B, 3C.1, 3C.3, 3C.4, 3C.5, 3C.6 y 3C.7.

## 3. Estado actual del modelo de permisos

### 3.1 Roles efectivos en frontend

El runtime funcional sigue operando con los roles legacy usados por navegación:

| Rol frontend efectivo | Uso actual | Origen cuando resolver está apagado | Origen cuando resolver está encendido |
| --- | --- | --- | --- |
| `admin` | Dashboard, pagos admin, incidentes admin, reservas admin | `usuarios_app.rol_id` | `tenant_memberships.role_name = 'admin_conjunto'` mapeado a `admin` |
| `vigilancia` | Control visitas, paquetería, reporte incidentes, reservas vigilancia | `usuarios_app.rol_id` | `tenant_memberships.role_name = 'vigilante'` mapeado a `vigilancia` |
| `residente` | Solicitar visita, mis paquetes, mis pagos, reservas residente | `usuarios_app.rol_id` | `tenant_memberships.role_name = 'residente'` mapeado a `residente` |

El resolver descarta memberships sin `conjunto_id`, roles no compatibles con la navegación actual o memberships de residente sin `residente_id`, y conserva fallback hacia `usuarios_app` ante ausencia/error/incompatibilidad.

### 3.2 Roles de plataforma

`platform_memberships` documenta roles `superadmin`, `platform_support`, `platform_auditor` y `platform_ops`. Actualmente estos roles son relevantes para la administración de memberships/plataforma, pero no aparecen como roles de navegación funcional en `App.jsx`. Por tanto, `platform_ops`/superadmin no deben interpretarse automáticamente como operadores de módulos de conjunto.

### 3.3 Helpers RLS legacy

El esquema histórico define:

- `fn_auth_conjunto_id()` leyendo `usuarios_app.conjunto_id` por `auth.uid()`.
- `fn_auth_rol()` leyendo `usuarios_app.rol_id` por `auth.uid()`.
- `fn_auth_residente_id()` leyendo `residentes.id` por `residentes.usuario_id = auth.uid()`.

Estas funciones siguen siendo la base de gran parte de las policies de negocio. En consecuencia, si `tenant_memberships` y `usuarios_app` divergen, la UI puede mostrar permisos según membership mientras RLS evalúa permisos según `usuarios_app`.

### 3.4 Helpers de memberships/plataforma

La FASE 3C.1 agregó helpers nuevos:

- `fn_is_platform_superadmin()`.
- `fn_has_platform_role(target_role_name text)`.
- `fn_has_tenant_access(target_conjunto_id uuid)`.
- `fn_has_tenant_role(target_conjunto_id uuid, target_role_name text)`.

En el estado auditado, estos helpers protegen principalmente `platform_memberships` y `tenant_memberships`. No se observó una migración transversal de policies de tablas de negocio hacia estos helpers.

### 3.5 Patrón híbrido actual

El patrón real es híbrido:

1. Autenticación Supabase (`auth.uid()`).
2. Bootstrap de perfil:
   - resolver apagado: lee `usuarios_app`.
   - resolver encendido: lee `usuarios_app` y `tenant_memberships`, prefiere membership compatible y usa fallback legacy.
3. Navegación frontend consume `usuarioApp.rol_id`, `usuarioApp.conjunto_id` y, para residente, `usuarioApp.residente_id` cuando está disponible.
4. Consultas de módulos aplican filtros frontend por tenant/residente cuando el módulo los implementa.
5. RLS final de negocio evalúa mayormente helpers legacy basados en `usuarios_app`.

## 4. Dependencias de `usuarios_app`

### 4.1 Dependencias directas de lectura/escritura frontend

| Área | Dependencia observada | Uso |
| --- | --- | --- |
| Bootstrap/auth | `usuarios_app` | Perfil legacy y fallback del resolver. |
| Login | `usuarios_app` | Verificación/obtención de usuario app post-login. |
| Membership resolver | `usuarios_app` | Fallback, preferencia por conjunto legacy y metadatos de perfil. |
| Visitas/portería | `usuarios_app` | Búsqueda de admins del conjunto para notificaciones, resolución de conjunto como respaldo, relaciones con vigilante/admin. |
| Incidentes | `usuarios_app` | Resolución de `conjunto_id` cuando el objeto usuario no lo trae. |
| Pagos/eventos | `usuarios_app` | Relación con usuario actor, notificaciones y trazabilidad. |
| Paquetería | `usuarios_app` | Usuarios vinculados a residentes/notificaciones y actor `recibido_por`. |
| Reservas | `usuarios_app` indirecto | Nombres de residentes vía relación `residentes -> usuarios_app`, actores de aprobación/check-in/check-out. |
| Notificaciones | `usuario_id` hacia `usuarios_app.id` | Campana y notificaciones por usuario autenticado. |

### 4.2 Dependencias indirectas por FKs/RLS

Según el esquema documentado, varias tablas sensibles referencian `usuarios_app.id`, incluyendo `accesos`, `incidentes`, `notificaciones`, `paquetes`, `pagos`, `pagos_eventos`, `registro_visitas`, `reservas_*` y `residentes`. Esto mantiene a `usuarios_app` como pieza central de identidad operativa incluso después de activar memberships.

### 4.3 Riesgo de la dependencia legacy

Mientras `fn_auth_rol()` y `fn_auth_conjunto_id()` dependan de `usuarios_app`, cualquier divergencia de rol/conjunto entre `usuarios_app` y `tenant_memberships` puede producir:

- UI autorizada por membership pero RLS denegando datos.
- UI restringida por fallback legacy cuando membership no sea compatible.
- Lecturas/escrituras permitidas por RLS legacy aunque la membership esté suspendida/revocada, si `usuarios_app` no refleja ese estado.

## 5. Dependencias de `tenant_memberships`

### 5.1 Uso actual

`tenant_memberships` se usa en el membership resolver como fuente preferida de perfil cuando el flag está activo. El resolver consulta memberships activas por `user_id`, ordena por `created_at`, filtra compatibilidad con navegación actual y mapea roles de tenant a roles legacy.

### 5.2 Roles tenant actuales

| `tenant_memberships.role_name` | Rol frontend resultante | Estado |
| --- | --- | --- |
| `admin_conjunto` | `admin` | Compatible. |
| `vigilante` | `vigilancia` | Compatible por mapeo frontend; requiere atención porque RLS legacy usa `vigilancia`. |
| `residente` | `residente` | Compatible si trae `residente_id`. |
| `contador` | Sin rol legacy | No compatible con navegación actual; fuerza fallback. |
| `comite` | Sin rol legacy | No compatible con navegación actual; fuerza fallback. |

### 5.3 Uso RLS actual de memberships

`tenant_memberships` tiene RLS propia:

- SELECT: superadmin o usuario con acceso activo al mismo conjunto.
- INSERT/UPDATE: superadmin o `platform_ops`.
- DELETE: denegado.

Sin embargo, las tablas de negocio auditadas no están documentadas como migradas de forma general a `fn_has_tenant_access()`/`fn_has_tenant_role()`. La FASE 3D.2 debe decidir si el hardening ajusta helpers existentes o policies por tabla.

## 6. Matriz rol → módulo → tablas

> Convención: “Dependencia `usuarios_app`” indica uso directo/indirecto actual para perfil, FKs, relaciones, actores o helpers RLS. “Dependencia `tenant_memberships`” indica uso del perfil resuelto por el membership resolver, no necesariamente uso en RLS de negocio.

| Módulo | Rol autorizado actual | Tablas consultadas/escritas desde frontend | Filtros esperados | Dependencia `usuarios_app` | Dependencia `tenant_memberships` | Riesgo detectado | Recomendación |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard Admin | `admin` | `pagos`, `incidentes`, `registro_visitas`, `reservas_zonas`, `apartamentos`, `paquetes`, `torres` | `conjunto_id = usuarioApp.conjunto_id`; RLS por `fn_auth_conjunto_id()` | Alta: rol/conjunto de RLS legacy y actores | Media: solo perfil resuelto | Si membership difiere de `usuarios_app`, dashboard puede quedar vacío o RLS puede responder según legacy. | FASE 3D.2: definir helper canónico tenant-aware para dashboard y validar todos los widgets por conjunto. |
| Pagos Admin / Crear Cobro | `admin` | `pagos`, `pagos_eventos`, `residentes`, `apartamentos`, `torres`, `notificaciones`, `usuarios_app` | Admin del mismo conjunto; inserts/updates con `conjunto_id`; eventos con `usuario_id = auth.uid()` | Alta: RLS admin legacy, `rechazado_por`, eventos/notificaciones | Media: perfil resuelto | `update comprobante pagos` documentado como `true` es demasiado amplio si no está restringido por columnas/ownership; pagos son datos financieros sensibles. | P1: separar policies de comprobante residente vs aprobación/rechazo admin; auditar columnas permitidas. |
| Mis Pagos | `residente` | `pagos`, `config_pagos`, `residentes`, `comprobantes` (referencia frontend), `pagos_eventos` indirecto | `residente_id` propio y/o `usuario_id`; `conjunto_id` cuando aplique | Alta: `fn_auth_residente_id()` y relación residente-usuario | Media/Alta para `residente_id` desde membership | Referencia frontend a `comprobantes` no aparece en inventario principal del esquema documentado; riesgo documental. | P2: reconciliar tabla/artefacto `comprobantes` contra esquema real antes de hardening. |
| Incidentes Admin | `admin` | `incidentes`, `notificaciones`, `usuarios_app` | SELECT/UPDATE mismo `conjunto_id`; UPDATE solo admin | Alta: `reportado_por`, helper rol/conjunto legacy | Media: perfil resuelto | Updates por `id` pueden depender exclusivamente de RLS para tenant si no se agrega `conjunto_id` en todos los updates. | P2: agregar patrón defensivo documentado `eq('conjunto_id', usuarioApp.conjunto_id)` en escrituras futuras, sin cambiar en esta fase. |
| Reportar Incidente | `vigilancia` | `incidentes`, `notificaciones`, `usuarios_app` | INSERT con `conjunto_id` del usuario y `reportado_por = usuarioApp.id`; RLS rol vigilancia | Alta: RLS espera `fn_auth_rol() = 'vigilancia'` | Media: membership `vigilante` se mapea a UI `vigilancia` | Mismatch `tenant_memberships.role_name = 'vigilante'` vs RLS legacy `vigilancia` si `usuarios_app` no está sincronizado. | P1: definir normalización/compatibilidad RLS para rol vigilancia en helper tenant-aware. |
| Control de visitas / vigilancia | `vigilancia` | `registro_visitas`, `visitantes`, `residentes`, `usuarios_app`, `notificaciones`, `incidentes`, `paquetes`, `bitacora_porteria` (referencia servicio) | Mismo `conjunto_id`; actualizaciones de estado/validación por vigilancia/admin | Alta: `validado_por`, búsqueda de admins, helper rol | Media: perfil resuelto | Referencia a `bitacora_porteria` no está en inventario documentado; riesgo documental. | P2: reconciliar tabla/servicio y definir RLS o retirar dependencia si es legacy/local. |
| Solicitar visita / residente | `residente` | `visitantes`, `registro_visitas`, `residentes`, `tipos_documento`, `notificaciones`, RPC de creación/reutilización | Visitantes/registros del propio residente; `conjunto_id` del usuario/residente | Alta: `fn_auth_residente_id()`, `residentes.usuario_id` | Alta si membership aporta `residente_id` | Si membership residente trae `residente_id` pero `residentes.usuario_id` no coincide, RLS legacy puede bloquear o permitir según tabla `residentes`. | P1: validar consistencia `tenant_memberships.residente_id = residentes.id` y `residentes.usuario_id = user_id`. |
| Paquetería / vigilancia | `vigilancia` | `paquetes`, `residentes`, `apartamentos`, `torres`, `usuarios_app`, `notificaciones` | `conjunto_id`; entrega por `id` + preferible `conjunto_id`; notificación al residente | Alta: `recibido_por`, usuarios de residentes, RLS rol vigilancia | Media: perfil resuelto | Algunos updates seleccionan por `id` y agregan `conjunto_id` solo si el contexto lo trae; RLS debe ser frontera principal. | P2: estandarizar contratos de servicio para requerir `conjunto_id` en escrituras operativas. |
| Mis paquetes | `residente` | `paquetes`, `residentes` | `residentes.usuario_id = usuarioApp.id`; paquetes por `residente_id`; realtime filtrado por `residente_id` | Alta: relación residente-usuario | Alta si membership aporta `residente_id` | Riesgo bajo si `residente_id` está correctamente sincronizado; sin `residente_id`, el resolver descarta membership residente. | P3: usar `usuarioApp.residente_id` resuelto como fast-path documentado, manteniendo validación DB. |
| Reservas Admin | `admin` | `recursos_comunes`, `reservas_zonas`, `reservas_eventos`, `reservas_bloqueos`, `reservas_documentos`, `residentes` | Mismo `conjunto_id`; admin para escrituras de recursos/bloqueos/aprobaciones | Alta: actores `aprobada_por`, `rechazada_por`, helpers legacy | Media: perfil resuelto | RLS de reservas robustas ya está por conjunto/rol, pero depende de helper legacy. | P1: priorizar migración tenant-aware en reservas por criticidad de operación y estados. |
| Reservas Vigilancia | `vigilancia` | `reservas_zonas`, `reservas_eventos`, `reservas_bloqueos`, `recursos_comunes` | Mismo `conjunto_id`; update de check-in/check-out por vigilancia | Alta: actores `checkin_por`, `checkout_por`, helper rol | Media: perfil resuelto | Mismo riesgo de rol `vigilante` vs `vigilancia` si legacy no está alineado. | P1: validar rol de vigilancia en RLS antes de depender solo de memberships. |
| Reservar zona / residente | `residente` | `recursos_comunes`, `reservas_zonas`, `reservas_eventos`, `reservas_bloqueos`, `reservas_documentos`, `residentes` | Recursos del conjunto; reservas propias por `residente_id` | Alta: `fn_auth_residente_id()` | Alta si membership aporta `residente_id` | Doble fuente para `residente_id`: membership vs tabla `residentes`; divergencia puede causar denegación/filtración por RLS. | P1: invariant obligatorio user→membership→residentes antes de hardening. |
| Configuración / perfil | `admin`, `vigilancia`, `residente` | `usuarios_app`; auth signOut; potencial `notificaciones` | `id = auth.uid()` para ver/actualizar propio usuario | Alta: tabla legacy central | Baja/Media | `usuarios_app` tiene SELECT documentado como amplio (`true`) además de self-policy; exposición de perfiles entre tenants. | P1: endurecer SELECT de `usuarios_app` por self/same tenant/rol justificado. |
| Notificaciones globales | Todos los roles autenticados | `notificaciones`, `residentes`, `visitantes`, `paquetes`, `pagos` | `usuario_id = usuarioApp.id`; eventos por `residente_id`/`conjunto_id` según módulo | Alta: `usuario_id -> usuarios_app.id` | Media: perfil resuelto | Inserts de notificaciones documentados como `auth.uid() IS NOT NULL` pueden permitir notificaciones hacia terceros si no hay checks adicionales. | P1: rediseñar policy de insert/select de notificaciones por emisor permitido y destinatario autorizado. |

## 7. Matriz de tablas sensibles

| Tabla | Sensibilidad | RLS documentada | Riesgo actual | Prioridad |
| --- | --- | --- | --- | --- |
| `usuarios_app` | Identidad, rol, conjunto, PII básica | SELECT amplio `true` + self; UPDATE self | Exposición horizontal de perfiles/roles si SELECT amplio sigue activo. | P1 |
| `tenant_memberships` | Autorización tenant | SELECT same tenant/superadmin; writes platform | Divergencia con `usuarios_app` impacta UI vs RLS; no gobierna todavía tablas negocio. | P1 |
| `platform_memberships` | Autorización plataforma | Self/superadmin; writes superadmin; delete denied | Correcto como base, pero roles plataforma no deben mapearse a módulos tenant. | P2 |
| `pagos` | Financiera/residentes | SELECT por conjunto; inserts/updates admin; comprobante update amplio documentado | Escrituras de comprobante/rechazo requieren separación por rol/propiedad/columnas. | P1 |
| `pagos_eventos` | Auditoría financiera | Admin conjunto / residente propio / insert controlado | Depende de helpers legacy; requiere consistencia con memberships. | P2 |
| `notificaciones` | Mensajes a usuarios | SELECT por `usuario_id = auth.uid()`; INSERT autenticado | INSERT demasiado permisivo si no valida destinatario/contexto. | P1 |
| `residentes` | Vínculo usuario-apto-conjunto | SELECT same conjunto; INSERT admin | Es fuente crítica para `fn_auth_residente_id()`; divergencia con membership afecta residente. | P1 |
| `registro_visitas` | Seguridad física/visitas | Propios/same conjunto; update vigilancia/admin | Depende de rol/conjunto legacy y relaciones visitantes-residentes. | P1 |
| `visitantes` | Datos personales de visitantes | Propios/same conjunto; update propios | Mismo conjunto para vigilancia/admin; propios para residente. | P2 |
| `paquetes` | Operación/privacidad residente | SELECT conjunto/residente; insert/update vigilancia | Updates por contexto incompleto pueden depender solo de RLS. | P2 |
| `incidentes` | Seguridad/convivencia | SELECT conjunto; insert vigilancia; update admin | Inserción de notificaciones asociadas sin destinatario claro. | P2 |
| `reservas_zonas` | Uso de áreas comunes | SELECT admin/vigilancia/residente dueño; insert admin/residente | Buen patrón, pero helpers legacy. | P1 |
| `reservas_eventos` | Auditoría reservas | Select/insert por conjunto | Insert por conjunto sin granularidad de acción/actor por rol. | P2 |
| `reservas_bloqueos` | Restricción de recursos | Admin write; select conjunto | Correcto, depende de helper legacy admin. | P2 |
| `reservas_documentos` | Archivos/anexos | Select/insert por conjunto | Falta ownership granular por reserva/residente. | P2 |
| `recursos_comunes` | Catálogo reservable | Select conjunto; admin write | Correcto, depende de helper legacy admin. | P3 |
| `config_pagos` | Configuración financiera | SELECT `true` documentado | Lectura global de URL/instrucciones si no se filtra por conjunto/RLS. | P2 |
| `archivos` | Soportes internos | SELECT `true` documentado | Posible exposición cruzada si referencia_id no delimita tenant. | P1 |
| `accesos` | Entradas/salidas | INSERT vigilancia documentado | Sin SELECT detallado en doc; posible brecha de consulta/auditoría. | P2 |
| `pqr` | Solicitudes residentes | Insert/select residente propio | No aparece en navegación actual principal, pero debe mantenerse owner-only. | P3 |
| `parqueaderos`, `vehiculos`, `zonas_comunes`, `trasteos` | Datos operativos/residente | Sin RLS visible o parcialmente documentada | Requiere inventario antes de ampliar módulos. | P2 |

## 8. Riesgos detectados

### 8.1 Divergencia entre membership y legacy

Riesgo central: el frontend puede resolver `rol_id`/`conjunto_id` desde `tenant_memberships`, pero las policies de negocio siguen evaluando `usuarios_app` mediante helpers legacy. Esto puede causar comportamiento inconsistente o autorizaciones basadas en datos no vigentes.

### 8.2 Roles con nombres distintos

`tenant_memberships` usa `vigilante`, mientras que frontend/RLS legacy usan `vigilancia`. El mapeo frontend existe, pero RLS no evalúa `tenant_memberships.role_name` para tablas de negocio. Si `usuarios_app.rol_id` no está normalizado a `vigilancia`, módulos de vigilancia pueden fallar o comportarse de manera no determinística.

### 8.3 Policies documentadas como amplias

Tablas como `usuarios_app`, `config_pagos` y `archivos` aparecen con lectura amplia (`true`) en la documentación. Aunque RLS/cliente pueden mitigar parcialmente con filtros frontend, deben revisarse porque contienen o pueden enlazar información sensible entre tenants.

### 8.4 Notificaciones con insert autenticado amplio

`notificaciones` permite insert a usuarios autenticados según documentación. Si no se valida destinatario y contexto, un usuario podría crear notificaciones arbitrarias para otros usuarios.

### 8.5 Tablas o referencias no reconciliadas documentalmente

El código referencia `comprobantes` y `bitacora_porteria`, pero esas tablas no aparecen en el inventario principal de `docs/database-schema.md`. No se asume su estructura; se recomienda reconciliarlas con Supabase/migraciones antes de cualquier hardening.

### 8.6 Dependencia fuerte de `residentes`

Los módulos de residente dependen de que `residentes.usuario_id`, `residentes.conjunto_id` y `tenant_memberships.residente_id` estén sincronizados. Cualquier inconsistencia impacta visitas, pagos, paquetes y reservas.

### 8.7 Realtime y filtros frontend

Los filtros realtime por `conjunto_id`/`residente_id` reducen ruido, pero no reemplazan RLS. Deben mantenerse como defensa en profundidad, no como control primario.

## 9. Hallazgos priorizados

### P0 — Crítico

No se identifica un P0 que obligue a revertir inmediatamente el rollout del membership resolver desde esta auditoría documental, siempre que se mantenga la coexistencia con `usuarios_app`, el fallback legacy y la ausencia de cambios funcionales/RLS en esta fase.

Condiciones que sí convertirían el riesgo en P0 durante validación operativa:

- Evidencia de fuga cross-tenant en tablas financieras, visitantes, paquetes o reservas.
- Usuario con membership suspendida/revocada que conserva acceso por `usuarios_app` activo.
- `usuarios_app` divergente permitiendo escritura RLS no autorizada para rol/conjunto incorrecto.
- Superadmin/platform role recibiendo navegación tenant sin membership tenant explícita.

### P1 — Alto

1. **RLS de negocio sigue anclada a `usuarios_app` mientras UI puede operar desde `tenant_memberships`.** Requiere decisión de hardening: migrar helpers existentes o crear policies tenant-aware por módulo.
2. **`usuarios_app` con SELECT amplio documentado.** Debe restringirse a self/same tenant/roles operativos justificados antes de ampliar superadmin o soporte.
3. **`notificaciones` con INSERT autenticado amplio documentado.** Debe limitarse por emisor/destinatario/contexto.
4. **Pagos requiere separación fina de permisos.** La policy de actualización de comprobante documentada como `true` debe revisarse para evitar escrituras no autorizadas.
5. **Invariante residente obligatoria.** `tenant_memberships.residente_id`, `residentes.usuario_id` y `residentes.conjunto_id` deben validarse antes de migrar RLS residente.
6. **Rol vigilancia/vigilante.** Se debe resolver formalmente en RLS tenant-aware para evitar drift.
7. **Reservas robustas dependen de helper legacy.** Por criticidad operativa, conviene priorizar hardening tenant-aware en `reservas_zonas` y eventos.

### P2 — Medio

1. Reconciliar referencias frontend a `comprobantes` y `bitacora_porteria` con schema/migraciones.
2. Endurecer lectura de `config_pagos` por conjunto.
3. Endurecer `archivos` por módulo/tenant/ownership real.
4. Estandarizar escrituras operativas para incluir `conjunto_id` defensivo además de confiar en RLS.
5. Revisar tablas con RLS no visible/parcial (`parqueaderos`, `vehiculos`, `zonas_comunes`, `trasteos`).
6. Definir política de auditoría para eventos de reservas/paquetes/incidentes con actor y rol consistentes.

### P3 — Bajo

1. Documentar contratos de `usuarioApp` post-resolver por rol y módulo.
2. Normalizar naming en documentación: `admin_conjunto` → `admin`, `vigilante` → `vigilancia` en frontend/RLS legacy.
3. Agregar checklist recurrente para validar que todo nuevo módulo filtre por `conjunto_id`/`residente_id` y no lea tablas amplias.
4. Mantener `platform_ops`/superadmin fuera de navegación tenant hasta que exista diseño explícito.

## 10. Recomendaciones para FASE 3D.2

### 10.1 Decisión arquitectónica obligatoria

Elegir una de estas estrategias antes de tocar RLS productiva:

- **Opción A — Helpers legacy tenant-aware:** modificar de forma controlada `fn_auth_conjunto_id()`, `fn_auth_rol()` y `fn_auth_residente_id()` para preferir `tenant_memberships` activas compatibles y fallback legacy. Ventaja: menor cantidad de policies a cambiar. Riesgo: cambio transversal con impacto amplio.
- **Opción B — Policies por módulo con helpers nuevos:** mantener helpers legacy y migrar tabla por tabla hacia `fn_has_tenant_access()`/`fn_has_tenant_role()`. Ventaja: hardening gradual. Riesgo: coexistencia prolongada y mayor superficie de inconsistencias.
- **Opción C — Periodo híbrido formal:** declarar `usuarios_app` como fuente RLS productiva mientras `tenant_memberships` solo resuelve UI, con jobs/checks de sincronía obligatorios. Ventaja: mínimo riesgo inmediato. Riesgo: deuda de seguridad si se prolonga.

### 10.2 Orden sugerido de hardening

1. Validación de datos/invariantes sin modificar policies:
   - usuarios legacy válidos vs memberships activas.
   - residentes con membership y `residentes.usuario_id` consistente.
   - roles `vigilante`/`vigilancia` normalizados por capa.
2. `usuarios_app`: restringir SELECT amplio.
3. `notificaciones`: limitar insert/select/update por destinatario/contexto.
4. `pagos` y `pagos_eventos`: separar permisos admin/residente por acción/columnas.
5. `registro_visitas`/`visitantes`: validar same tenant y ownership residente.
6. `reservas_zonas` + eventos/documentos/bloqueos: migrar a tenant-aware o confirmar helper legacy actualizado.
7. `paquetes`: exigir conjunto en operaciones y RLS consistente por vigilancia/residente.
8. `archivos`/`config_pagos`: cerrar lecturas amplias.
9. Tablas parcialmente documentadas: completar inventario antes de nuevas funciones.

### 10.3 Validaciones previas a cualquier cambio RLS

- Ejecutar consultas de conteo comparativo `usuarios_app` vs `tenant_memberships` por ambiente.
- Validar usuarios reales de `admin`, `vigilancia` y `residente` en DEV/QA antes de PRD.
- Preparar rollback SQL por policy/helper antes de aplicar cambios.
- No aplicar SQL destructivo sin aprobación explícita.
- No modificar Production desde frontend.

## 11. Checklist de validación manual

### Identidad y resolver

- [ ] Confirmar usuario `admin` con `tenant_memberships.role_name = 'admin_conjunto'` y `usuarios_app.rol_id = 'admin'`.
- [ ] Confirmar usuario `vigilancia` con `tenant_memberships.role_name = 'vigilante'` y `usuarios_app.rol_id = 'vigilancia'`.
- [ ] Confirmar usuario `residente` con `tenant_memberships.role_name = 'residente'`, `tenant_memberships.residente_id` no nulo y `residentes.usuario_id = auth.uid()`.
- [ ] Confirmar fallback a `usuarios_app` cuando no hay membership activa compatible.
- [ ] Confirmar que roles `contador`/`comite` no habilitan navegación no diseñada.
- [ ] Confirmar que `platform_ops`/superadmin no reciben módulos tenant sin membership tenant.

### Módulos admin

- [ ] Dashboard muestra solo datos del conjunto del admin.
- [ ] Pagos admin lista, crea, aprueba/rechaza solo pagos del conjunto.
- [ ] Incidentes admin lista/actualiza solo incidentes del conjunto.
- [ ] Reservas admin lista/aprueba/rechaza solo reservas del conjunto.

### Módulos vigilancia

- [ ] Control visitas lista/actualiza solo visitas del conjunto.
- [ ] Paquetería crea/entrega solo paquetes del conjunto.
- [ ] Reporte de incidentes inserta `conjunto_id` correcto.
- [ ] Reservas vigilancia solo permite operaciones esperadas de check-in/check-out/seguimiento.

### Módulos residente

- [ ] Solicitar visita usa el residente correcto y genera visita en su conjunto.
- [ ] Mis paquetes muestra solo paquetes del residente autenticado.
- [ ] Mis pagos muestra solo pagos del residente autenticado.
- [ ] Reservar zona crea/lista reservas propias y recursos del conjunto.

### Tablas/policies sensibles

- [ ] `usuarios_app` no expone perfiles de otros tenants salvo justificación por rol.
- [ ] `notificaciones` no permite insertar mensajes arbitrarios a terceros.
- [ ] `archivos` no expone soportes cross-tenant.
- [ ] `config_pagos` no expone configuración de otros conjuntos.
- [ ] `pagos` no permite updates cruzados ni modificación de columnas no autorizadas.
- [ ] `tenant_memberships` no permite self-escalation.

### Operación y rollback

- [ ] Confirmar que el flag del resolver puede revertirse sin SQL.
- [ ] Confirmar que cualquier cambio RLS futuro tiene rollback preparado.
- [ ] Confirmar que logs/observabilidad capturan errores de resolver y módulos críticos.

## 12. Evidencia de no modificación de Supabase

Esta auditoría no modifica Supabase por diseño.

Validación esperada del PR:

```bash
if git diff --name-only HEAD~1..HEAD | grep '^supabase/'; then echo 'Supabase touched'; else echo 'No supabase files touched'; fi
```

Resultado esperado: `No supabase files touched`.

Adicionalmente, el único archivo de entrega de esta fase debe ser:

```text
docs/fase-3d1-auditoria-permisos-rls-por-modulo.md
```

## 13. Confirmación explícita final

Confirmo explícitamente que en la FASE 3D.1:

- No se modificó Supabase.
- No se creó ninguna migración.
- No se modificó `supabase/migrations/`.
- No se modificó `docs/database-schema.md` porque no hubo cambios de tablas, columnas, FKs o policies.
- No se modificó frontend funcional.
- No se modificaron variables de entorno.
- No se modificó Vercel.
- No se modificó Production.
- No se cambió comportamiento de usuarios.
