# Auditoría frontend vs Supabase — Módulo Paquetería

## 1. Alcance y fuentes revisadas

Auditoría documental del módulo de paquetería contra el esquema Supabase documentado y las migraciones locales. No se aplicaron fixes funcionales, cambios de UI, migraciones ni modificaciones de Supabase.

### Fuentes de verdad revisadas

1. `docs/database-schema.md`
2. `supabase/migrations/20260410031821_remote_schema.sql`
3. `supabase/migrations/20260509064414_hardening_rls_qa.sql`
4. `supabase/migrations/20260509071639_hardening_reservas_multitenant.sql`
5. `supabase/migrations/20260511120000_normalizar_rls_roles_core.sql`
6. `docs/rls-roles-audit.md`
7. `src/modules/paqueteria/**`
8. `src/hooks/useRealtimeConjuntoChannel.js` solo como referencia de patrón reusable de realtime

### Inventario de archivos revisados en `src/modules/paqueteria`

| Archivo | Rol en el módulo | Uso Supabase directo |
| --- | --- | --- |
| `src/modules/paqueteria/services/paquetesService.js` | Servicio central para registrar, listar con detalle y entregar paquetes. | Sí |
| `src/modules/paqueteria/pages/CrearPaquete.jsx` | Formulario operativo para vigilancia: registrar recepción por torre/apartamento. | Sí, carga torres |
| `src/modules/paqueteria/pages/RegistrarPaquete.jsx` | Formulario simple/legacy para registrar por `residente_id`. | No directo; delega al servicio |
| `src/modules/paqueteria/pages/MisPaquetes.jsx` | Vista del residente para consultar sus paquetes. | Sí |
| `src/modules/paqueteria/pages/PanelPaquetes.jsx` | Panel operativo para vigilancia: pendientes, entregados y marcar entrega. | Sí, realtime; delega consultas/mutaciones al servicio |
| `src/modules/paqueteria/components/NotificacionesPaquetes.jsx` | Listener realtime/toast/browser notification para residentes. | Sí |
| `src/modules/paqueteria/components/PaqueteCard.jsx` | Card visual para residente. | No |
| `src/modules/paqueteria/components/PaquetesFiltros.jsx` | Filtros por estado y búsqueda. | No |
| `src/modules/paqueteria/components/PaquetesResumen.jsx` | Resumen agregado de totales. | No |

---

## 2. Tablas Supabase usadas por el módulo

| Tabla | Uso detectado | Documento/esquema |
| --- | --- | --- |
| `paquetes` | Tabla principal: insert, select, update, realtime. | Existe con FKs a `conjuntos`, `apartamentos`, `residentes` y `usuarios_app` vía `recibido_por`. |
| `residentes` | Resolver residente destino, usuario receptor de notificación y residente autenticado. | Existe con `usuario_id`, `conjunto_id`, `apartamento_id`. |
| `usuarios_app` | Obtener `conjunto_id` del usuario que registra y validar auth/RLS indirectamente. | Existe con `id`, `rol_id`, `conjunto_id`. |
| `apartamentos` | Resolver apartamento por número/torre y enriquecer listados. | Existe con `id`, `conjunto_id`, `torre_id`, `numero`. |
| `torres` | Resolver apartamentos por tenant y mostrar ubicación. | Existe con `id`, `nombre`, `conjunto_id`. |
| `notificaciones` | Crear notificaciones in-app para residentes. | Existe con `usuario_id` FK a `usuarios_app.id`. |

No se detectaron llamadas a RPC, edge functions, storage ni tablas adicionales dentro de `src/modules/paqueteria/**`.

---

## 3. Columnas utilizadas por el frontend

### `paquetes`

| Columna | Uso frontend | Validación contra esquema |
| --- | --- | --- |
| `id` | Identificador `paquete_id` para actualización y render keys. | Existe. |
| `conjunto_id` | Insert explícito, filtro de listados y filtro realtime del panel. | Existe; FK a `conjuntos.id`. |
| `apartamento_id` | Insert y enriquecimiento de ubicación. | Existe; FK a `apartamentos.id`. |
| `residente_id` | Insert, filtros de residente, realtime y notificaciones. | Existe; FK a `residentes.id`. |
| `descripcion` | Texto persistido; además se usa para codificar categoría con prefijo `[SERVICIO_PUBLICO]`. | Existe. Riesgo: categoría no está normalizada en columna propia. |
| `recibido_por` | Insert con `user.id`. | Existe; FK a `usuarios_app.id`. |
| `estado` | Insert `pendiente`; update `entregado`; filtros y badges. | Existe con default `pendiente`; no se observó check constraint de estados en paquetería. |
| `fecha_recibido` | Ordenamiento y visualización. | Existe con default `now()`. |
| `fecha_entrega` | Update al entregar y visualización. | Existe. |
| `created_at` | No se usa en el frontend auditado. | Existe. |

### `residentes`

| Columna | Uso frontend | Validación contra esquema |
| --- | --- | --- |
| `id` | Se usa como `residente_id`, dueño del paquete y filtro realtime. | Existe. |
| `usuario_id` | Se usa correctamente como `notificaciones.usuario_id`. | Existe; FK a `usuarios_app.id`. |
| `apartamento_id` | Resolver residente por apartamento y fallback de ubicación. | Existe. |
| `conjunto_id` | Filtro en entrega antes de notificar; RLS lo usa por tenant. | Existe. |

### `usuarios_app`

| Columna | Uso frontend | Validación contra esquema |
| --- | --- | --- |
| `id` | Identidad app/auth; usado como `recibido_por` y para consultar `usuarios_app`. | Existe. |
| `conjunto_id` | Fuente de tenant en registro/listado/panel. | Existe. |
| `rol_id` | No se consulta en paquetería, pero RLS lo valida para inserts/updates de vigilancia. | Existe. |

### `apartamentos`

| Columna | Uso frontend | Validación contra esquema |
| --- | --- | --- |
| `id` | `apartamento_id` del paquete. | Existe. |
| `numero` | Búsqueda por número manual y visualización. | Existe. |
| `torre_id` | Desambiguación y enriquecimiento con `torres`. | Existe. |
| `conjunto_id` | RLS exige tenant; el frontend no siempre lo filtra directo al consultar por `torre_id`. | Existe. |

### `torres`

| Columna | Uso frontend | Validación contra esquema |
| --- | --- | --- |
| `id` | Selección de torre y filtro indirecto para apartamentos. | Existe. |
| `nombre` | Visualización. | Existe. |
| `conjunto_id` | Filtro explícito al cargar torres y resolver apartamentos sin torre. | Existe. |

### `notificaciones`

| Columna | Uso frontend | Validación contra esquema |
| --- | --- | --- |
| `usuario_id` | Inserta `residentes.usuario_id`. | Existe; FK a `usuarios_app.id`. Correcto. |
| `tipo` | `paquete_recibido`, `servicio_publico_recibido`, `paquete_entregado`. | Existe; sin catálogo/check documentado. |
| `titulo` | Título para in-app. | Existe. |
| `mensaje` | Mensaje para in-app. | Existe. |
| `leido`, `created_at` | Defaults DB; no se setean desde paquetería. | Existen. |

---

## 4. Joins/selects relevantes

El módulo evita joins embebidos de Supabase y usa selects separados:

1. **Resolver apartamento** (`resolverApartamentoId`):
   - `apartamentos.select('id, torre_id').eq('numero', ...)`
   - opcional `eq('torre_id', torre_id)`
   - si no hay torre, consulta `torres.select('id').eq('conjunto_id', conjunto_id)` y filtra apartamentos con `.in('torre_id', ids)`
   - fallback: `apartamentos.select('id, numero, torre_id')`, filtrado solo por `torre_id` cuando existe

2. **Resolver residente destino** (`resolverUsuarioResidente`):
   - por `residentes.id = residente_id`, select `id, usuario_id, apartamento_id`
   - o por `residentes.apartamento_id = apartamento_id`, select `id, usuario_id, apartamento_id`

3. **Registrar paquete**:
   - `usuarios_app.select('conjunto_id').eq('id', user.id).single()`
   - `paquetes.insert(...).select().single()`
   - `notificaciones.insert(...)`

4. **Panel/listado con detalle** (`listarPaquetesConDetalle`):
   - `paquetes.select('id, conjunto_id, apartamento_id, residente_id, descripcion, estado, fecha_recibido, fecha_entrega, recibido_por').eq('conjunto_id', conjunto_id).order('fecha_recibido', { ascending: false })`
   - filtro opcional `eq('estado', estadoNormalizado)`
   - `residentes.select('id, apartamento_id').in('id', idsResidentes)`
   - `apartamentos.select('id, numero, torre_id').in('id', apartamentosIds)`
   - `torres.select('id, nombre').eq('conjunto_id', conjunto_id)`

5. **Mis paquetes** (`MisPaquetes.jsx`):
   - `residentes.select('*').eq('usuario_id', usuarioApp.id).limit(1)`
   - `paquetes.select('*').eq('residente_id', residente.id).order('fecha_recibido', { ascending: false })`

6. **Entrega** (`entregarPaquete`):
   - `paquetes.select('*').eq('id', paquete_id).single()`
   - `paquetes.update({ estado: 'entregado', fecha_entrega }).eq('id', paquete_id)`
   - `residentes.select('id, usuario_id').eq('id', paquete.residente_id)` y, si existe, `.eq('conjunto_id', paquete.conjunto_id)`
   - `notificaciones.insert(...)`

---

## 5. Mutaciones relevantes

| Mutación | Archivo | Campos enviados | Validación/RLS esperada |
| --- | --- | --- | --- |
| Insert `paquetes` | `paquetesService.registrarPaquete` | `conjunto_id`, `apartamento_id`, `residente_id`, `descripcion`, `recibido_por`, `estado='pendiente'` | RLS `insert paquetes vigilancia` exige rol `vigilancia` y, tras hardening, mismo `conjunto_id`. |
| Insert `notificaciones` al recibir | `paquetesService.registrarPaquete` | `usuario_id=residentes.usuario_id`, `tipo`, `titulo`, `mensaje` | RLS permite insert si `auth.uid()` no es null. |
| Update `paquetes` al entregar | `paquetesService.entregarPaquete` | `estado='entregado'`, `fecha_entrega=now ISO` | RLS `update paquetes vigilancia` exige rol `vigilancia` y mismo `conjunto_id` tras hardening. |
| Insert `notificaciones` al entregar | `paquetesService.entregarPaquete` | `usuario_id=residentes.usuario_id`, `tipo='paquete_entregado'`, `titulo`, `mensaje` | RLS permite insert autenticado. |

No se detectaron deletes, RPC ni edge functions.

---

## 6. Validación de IDs y relaciones críticas

### `paquete_id`

- En el frontend se representa como `paquete.id` y se pasa a `entregarPaquete(paquete.id)`.
- `entregarPaquete` valida presencia del ID y consulta `paquetes.eq('id', paquete_id).single()` antes de actualizar.
- **Riesgo:** el update posterior solo filtra por `id`; depende de RLS para limitar tenant/rol. Con RLS hardened esto debería bloquear cross-tenant, pero conviene filtrar también por `conjunto_id` desde el frontend cuando el panel ya lo conoce.

### `residente_id`

- En registro puede llegar explícito desde `RegistrarPaquete.jsx` o resolverse por `apartamento_id`.
- En `CrearPaquete.jsx` se resuelve por apartamento/torre.
- En vistas de residente se resuelve por `residentes.usuario_id = usuarioApp.id`.
- **Riesgo real:** `resolverUsuarioResidente` no recibe ni filtra `conjunto_id`; si se invoca con `residente_id` directo, el frontend no valida explícitamente que pertenezca al mismo tenant del vigilante. RLS de `residentes` y de insert `paquetes` mitiga parcialmente, pero el error sería tardío y dependiente de policy.
- **Riesgo técnico:** `.single()` por `apartamento_id` asume un único residente por apartamento. En propiedad horizontal puede haber más de un residente asociado a una unidad, lo que puede fallar o elegir mal si el modelo admite múltiples filas.

### `residentes.usuario_id` vs `usuarios_app.id`

- La notificación de recepción usa `usuario_id: residenteTarget.usuario_id`.
- La notificación de entrega vuelve a consultar `residentes.usuario_id` y usa ese valor.
- Esto está alineado con `notificaciones.usuario_id -> usuarios_app.id`.
- **Sin acción por bug de ID:** no se detectó uso de `residentes.id` como si fuera `usuarios_app.id` para insertar notificaciones.
- **Riesgo técnico:** si `residentes.usuario_id` es null, el insert de notificación puede crear una fila sin receptor o fallar según DB. En entrega se valida explícitamente; en recepción no se valida antes de insertar.

### `apartamento_id`

- Se inserta en `paquetes.apartamento_id` y se usa para enriquecer ubicación.
- Existe FK a `apartamentos.id`.
- **Riesgo técnico:** cuando `resolverApartamentoId` recibe `apartamento_id` ya resuelto, retorna ese valor sin verificar que pertenezca al `conjunto_id` del usuario autenticado.
- **Riesgo técnico:** el fallback de búsqueda por apartamentos no filtra por `conjunto_id` si no hay `torre_id`. Aunque RLS de `apartamentos_select_conjunto` debe filtrar tenant, sería más robusto conservar filtro explícito por tenant mediante torres o evitar fallback sin scope.

### `conjunto_id`

- En recepción se obtiene desde `usuarios_app.conjunto_id` del usuario autenticado y se inserta en `paquetes`.
- En panel se usa `usuarioApp.conjunto_id` para listar y para realtime.
- En `MisPaquetes.jsx` no se filtra explícitamente por `conjunto_id`; filtra por `residente_id` y depende de RLS `paquetes residente`/`paquetes por conjunto`.
- **Riesgo técnico:** hay mezcla de patrones: panel y servicio usan tenant explícito; vista residente usa `residente_id` + RLS. Es aceptable por RLS, pero conviene estandarizar filtros explícitos donde el dato esté disponible.

### `recibido_por`, `entregado_por`, `vigilante_id`

- `recibido_por` existe y se inserta con `user.id`, consistente con FK a `usuarios_app.id`.
- No existe `entregado_por` en `docs/database-schema.md` ni en la migración base; el frontend no lo usa.
- No existe `vigilante_id` en `paquetes`; el frontend no lo usa.
- **Deuda técnica:** la entrega no conserva auditoría de quién marcó el paquete como entregado porque la tabla no expone `entregado_por`. No se recomienda agregar columna en este ticket documental; debe ser ticket separado si negocio lo requiere.

---

## 7. Validación de estados usados por paquetería

| Estado | Uso detectado | Estado en DB/documentación | Observación |
| --- | --- | --- | --- |
| `pendiente` | Insert inicial, filtros, resumen, badges. | Default documentado en `paquetes.estado`. | Correcto. |
| `entregado` | Update al entregar, filtros, resumen, badges, realtime. | Usado por frontend; no se observó check constraint en `paquetes`. | Correcto funcionalmente; falta catálogo/constraint documentado. |
| `recibido` | Mencionado en alcance a validar. | No detectado en frontend auditado. | Sin acción inmediata. |
| `devuelto` | Mencionado en alcance a validar. | No detectado en frontend auditado. | Sin acción inmediata. |
| `cancelado` | Mencionado en alcance a validar. | No detectado en frontend auditado. | Sin acción inmediata. |
| `todos` | Estado UI para no filtrar. | No se persiste. | Correcto como filtro local. |
| desconocido/otros | `PaqueteCard` muestra estado desconocido si no es pendiente/entregado. | DB permite texto libre según migración auditada. | Riesgo técnico si aparecen valores no esperados. |

**Hallazgo:** `paquetes.estado` parece ser `text` sin check constraint en la migración base y sin normalización central compartida como constante del módulo. El frontend opera realmente con `pendiente` y `entregado`; otros valores quedarían invisibles o como desconocidos según la vista.

---

## 8. Revisión de multitenancy

### Filtros explícitos correctos

- `CrearPaquete.jsx` carga `torres` con `.eq('conjunto_id', usuarioApp.conjunto_id)`.
- `registrarPaquete` obtiene `usuarios_app.conjunto_id` para insertar `paquetes.conjunto_id`.
- `listarPaquetesConDetalle` exige `conjunto_id` y filtra `paquetes.eq('conjunto_id', conjunto_id)`.
- `listarPaquetesConDetalle` carga `torres.eq('conjunto_id', conjunto_id)`.
- `PanelPaquetes.jsx` pasa `usuarioApp.conjunto_id` al servicio y filtra realtime por `conjunto_id`.
- `entregarPaquete` filtra la consulta de `residentes` por `paquete.conjunto_id` antes de notificar.

### Consultas sin tenant explícito o con dependencia fuerte de RLS

- `resolverUsuarioResidente` consulta `residentes` por `id` o `apartamento_id` sin `.eq('conjunto_id', conjunto_id)`.
- `resolverApartamentoId` retorna `apartamento_id` recibido sin verificar tenant.
- Fallback de `resolverApartamentoId` lista `apartamentos` sin `conjunto_id` directo; si no hay `torre_id`, solo depende de RLS para scope.
- `MisPaquetes.jsx` consulta `residentes` por `usuario_id` y luego `paquetes` por `residente_id` sin `conjunto_id` explícito.
- `NotificacionesPaquetes.jsx` obtiene residente por `usuario_id` sin `conjunto_id` explícito y escucha una suscripción global a `paquetes` sin filtro server-side.
- `entregarPaquete` lee y actualiza `paquetes` solo por `id`; depende de RLS de update para tenant/rol.

### Dependencia de `usuarioApp.conjunto_id`

- Panel y formulario principal dependen de `usuarioApp.conjunto_id` para listar/crear.
- El servicio `registrarPaquete` no confía solo en el prop: vuelve a consultar `usuarios_app.conjunto_id` por `user.id`, lo cual es positivo.
- Sería conveniente aplicar el mismo patrón a operaciones de entrega o pasar `conjunto_id` al servicio para filtros explícitos.

---

## 9. Revisión de notificaciones

### In-app (`notificaciones`)

- Recepción: inserta notificación con `usuario_id = residenteTarget.usuario_id`.
- Entrega: consulta `residentes.usuario_id` y luego inserta notificación con ese valor.
- Esto corrige el riesgo típico de usar `residentes.id` como `usuarios_app.id`.

### Riesgos detectados

1. **Recepción sin validar `usuario_id`:** si `residenteTarget.usuario_id` es null, se intenta insertar notificación con receptor null. La entrega sí valida y registra warning.
2. **RLS de notificaciones permisiva para insert:** `insert notificaciones permitido` acepta cualquier usuario autenticado, sin validar que el emisor tenga permiso de notificar al destinatario. Esto ya existía en DB; para paquetería es riesgo de plataforma, no fix de este ticket.
3. **Tipos no normalizados:** `tipo` acepta texto libre; paquetería usa `paquete_recibido`, `servicio_publico_recibido`, `paquete_entregado` sin catálogo/check documentado.

---

## 10. Revisión de push/FCM

- No se detectó uso de Firebase Cloud Messaging ni del servicio `src/services/firebase.js` dentro de `src/modules/paqueteria/**`.
- `NotificacionesPaquetes.jsx` usa la API del navegador `Notification` si el permiso ya está en `granted`.
- No solicita permisos de Notification en este componente.
- No hay envío push server-side ni edge function asociada.

**Conclusión:** paquetería tiene notificación in-app por tabla `notificaciones` y notificación local/browser por realtime, no push FCM.

---

## 11. Revisión de realtime subscriptions

### Suscripciones detectadas

| Archivo | Canal | Filtro server-side | Cleanup | Observación |
| --- | --- | --- | --- | --- |
| `NotificacionesPaquetes.jsx` | `paquetes-realtime` | No tiene filtro; escucha `event='*'` sobre toda la tabla. | Sí, `removeChannel(channel)`. | Riesgo de listener global; filtra cliente por `residente_id`. |
| `MisPaquetes.jsx` | `mis-paquetes-${residente.id}` | `residente_id=eq.${residente.id}`. | Sí. | Mejor scope; callback recarga lista completa. |
| `PanelPaquetes.jsx` | `paqueteria-panel-${conjunto_id}` | `conjunto_id=eq.${usuarioApp.conjunto_id}`. | Sí. | Scope correcto; callback recarga lista completa. |

### Comparación con `useRealtimeConjuntoChannel`

- El hook reusable existe fuera del alcance modificable de este ticket y encapsula patrón de canal por `conjunto_id`, cleanup y debounce.
- `PanelPaquetes.jsx` ya filtra por `conjunto_id`, pero implementa el canal manualmente y recarga en cada evento.
- `NotificacionesPaquetes.jsx` es el caso más alejado del patrón: canal global sin filtro de Postgres y sin debounce.
- `MisPaquetes.jsx` filtra por `residente_id`; podría seguir con filtro específico, pero conviene revisar si el hook puede adaptarse o si se crea un patrón equivalente por residente.

### Riesgos realtime

1. Listener global en `NotificacionesPaquetes.jsx` puede recibir eventos de otros tenants/residentes antes del filtro cliente.
2. No hay debounce; eventos múltiples pueden disparar múltiples recargas/toasts.
3. Canales y callbacks manuales duplican lógica que ya se está estandarizando en otros módulos.
4. `NotificacionesPaquetes.jsx` usa `payload.old?.estado`, pero para UPDATE la disponibilidad de `old` depende de configuración replica identity; si no está completo, la condición puede comportarse distinto.

---

## 12. Revisión de offline/contingencia

- No se detectó soporte offline, cola local, reintentos persistentes ni modo contingencia.
- Las operaciones de recepción y entrega dependen de Supabase online.
- La actualización visual se coordina con `window.dispatchEvent(new CustomEvent('paqueteria:changed', ...))`, útil solo en sesión activa.

**Riesgo operativo:** para portería/vigilancia, caídas de red impiden registrar recepción/entrega desde el módulo. Recomendación: ticket separado de contingencia, no mezclar con hardening Supabase.

---

## 13. Revisión de RLS/policies relacionadas

### `paquetes`

Documentación y migraciones muestran:

- `insert paquetes vigilancia`: inserción por rol `vigilancia`; migración de hardening agrega condición de mismo `conjunto_id`.
- `paquetes por conjunto`: SELECT por mismo tenant.
- `paquetes residente`: SELECT si el paquete pertenece al residente autenticado.
- `update paquetes vigilancia`: update por rol `vigilancia`; migración de hardening agrega mismo `conjunto_id` en `using` y `with check`.

**Validación:** el frontend presupone que usuarios de vigilancia pueden insertar y actualizar. Si el usuario tiene rol legacy `vigilante`, RLS no lo permitirá porque el rol canónico es `vigilancia`.

### `residentes`

- La documentación lista políticas de select por conjunto.
- La migración `20260509071639_hardening_reservas_multitenant.sql` reemplaza políticas legacy por `residentes_select_conjunto` usando helper legacy `get_user_conjunto_id()`.
- `docs/database-schema.md` todavía menciona nombres legacy (`residentes multi conjunto`, `residentes_select_same_conjunto`) y no refleja completamente el nombre final `residentes_select_conjunto` de esa migración.

**Hallazgo documental:** existe drift entre documentación y migración en nombres de policies de `residentes`. No bloquea paquetería, pero conviene actualizar `docs/database-schema.md` en un ticket de documentación/RLS separado.

### `apartamentos` y `torres`

- Migraciones recientes normalizan RLS a helpers `fn_auth_conjunto_id()` y `fn_auth_rol()`.
- Lectura tenant-aware para usuarios autenticados.
- Escrituras solo admin.

### `notificaciones`

- SELECT solo por `usuario_id = auth.uid()`.
- INSERT permitido para cualquier autenticado (`auth.uid() IS NOT NULL`).
- Paquetería depende de esta policy para crear notificaciones como usuario de vigilancia.

---

## 14. Hallazgos priorizados

### P0 / Error real

No se confirma un error funcional crítico de datos en el flujo principal, pero sí hay puntos de alto riesgo que deben tratarse antes de fixes mayores.

### P1 / Riesgo técnico alto

1. **Realtime global en `NotificacionesPaquetes.jsx`.** Escucha todos los cambios de `paquetes` sin filtro server-side por `residente_id` ni `conjunto_id`; filtra solo en cliente. Impacta privacidad/performance y se aparta del patrón hardened.
2. **Resolución de residente sin tenant explícito.** `resolverUsuarioResidente` no filtra por `conjunto_id`; el registro por `residente_id` directo depende de RLS/insert posterior para impedir cruces.
3. **Entrega actualiza por `id` sin filtro explícito de tenant.** RLS hardening debe proteger, pero el frontend puede endurecer con `conjunto_id` conocido.
4. **Notificación de recepción no valida `residentes.usuario_id`.** Riesgo de insertar notificaciones sin receptor real o warnings silenciosos inconsistentes con entrega.

### P2 / Riesgo técnico medio

5. **Estados no centralizados ni restringidos.** UI y servicio usan `pendiente`/`entregado`; DB parece permitir texto libre. Valores como `recibido`, `devuelto` o `cancelado` no tienen manejo funcional.
6. **Categoría `servicio_publico` codificada en `descripcion`.** Funciona sin migración, pero mezcla datos semánticos con texto visible y complica consultas/reportes.
7. **Asunción de un residente por apartamento.** `.single()` por `apartamento_id` puede fallar si hay múltiples residentes válidos.
8. **Recargas realtime sin debounce.** Panel y Mis paquetes recargan listas completas por cada evento.

### P3 / Deuda técnica

9. `RegistrarPaquete.jsx` parece formulario simple/legacy por ID manual de residente; no aplica selección tenant-aware ni UX del flujo principal.
10. Falta auditoría de `entregado_por` porque la tabla `paquetes` no tiene esa columna.
11. `docs/database-schema.md` tiene posible drift en nombres de policies de `residentes` respecto a migraciones recientes.
12. No hay modo offline/contingencia para portería.
13. No hay FCM/push real; solo `Notification` del navegador si ya existe permiso.

### Sin acción inmediata

- Uso de `residentes.usuario_id` para `notificaciones.usuario_id` está correcto.
- `recibido_por` usa `usuarios_app.id`, correcto contra FK.
- Panel principal filtra listados por `conjunto_id`.
- No se detectan deletes, SQL destructivo ni modificaciones Supabase desde frontend.

---

## 15. Tickets recomendados posteriores

1. **Hardening realtime paquetería residente.** Reemplazar listener global de `NotificacionesPaquetes.jsx` por canal filtrado server-side (`residente_id` o `conjunto_id` + validación) y agregar debounce/cleanup siguiendo patrón `useRealtimeConjuntoChannel` cuando aplique.
2. **Tenant explícito en resolución de residente/apartamento.** Pasar `conjunto_id` a `resolverUsuarioResidente` y validar `residentes.conjunto_id`; validar `apartamento_id` contra tenant antes de insertar.
3. **Entrega tenant-aware.** Cambiar `entregarPaquete` para recibir `conjunto_id`/usuario y aplicar `.eq('conjunto_id', ...)` en select/update, manteniendo RLS como segunda barrera.
4. **Validación de receptor de notificación.** En recepción, validar `residenteTarget.usuario_id` antes de insertar en `notificaciones`; si falta, registrar warning y mantener operación principal.
5. **Centralizar estados de paquetería.** Crear constantes frontend (`pendiente`, `entregado`) y decidir formalmente si se soportarán `recibido`, `devuelto`, `cancelado`. Si se requiere constraint DB, crear ticket separado con migración y actualización de docs.
6. **Separar categoría de paquete.** Evaluar columna `categoria` o tabla/catálogo para evitar prefijo en `descripcion`; requiere migración explícita y backfill validado, por tanto ticket separado.
7. **Revisar múltiples residentes por apartamento.** Definir regla de negocio: notificar titular, todos los residentes, o seleccionar residente al registrar.
8. **Actualizar documentación RLS de `residentes`.** Alinear `docs/database-schema.md` con la policy efectiva `residentes_select_conjunto` si esa migración es la fuente vigente del ambiente.
9. **Contingencia/offline para portería.** Diseñar flujo de cola local o registro manual controlado para caídas de red.
10. **Auditoría de entrega (`entregado_por`).** Si negocio requiere trazabilidad, diseñar cambio estructural con migración, docs y UI en ticket independiente.

---

## 16. Conclusión

El módulo de paquetería está mayormente alineado con las tablas reales documentadas (`paquetes`, `residentes`, `usuarios_app`, `apartamentos`, `torres`, `notificaciones`) y no inventa columnas en los flujos actuales. Los riesgos principales no son de existencia de columnas, sino de hardening: filtros tenant explícitos incompletos en helpers, realtime global, estados/categoría sin normalización y dependencia fuerte de RLS en algunas operaciones. Los fixes deben abordarse en tickets pequeños y separados para no mezclar cambios funcionales, RLS/migraciones y UI.
