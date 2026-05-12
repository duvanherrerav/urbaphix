# Auditoría frontend vs Supabase del módulo de visitas

## Alcance y fuentes revisadas

Auditoría documental del módulo `src/modules/visitas` contra la fuente de verdad local (`docs/database-schema.md` y `supabase/migrations/`). No se modificó Supabase, no se crearon migraciones y no se cambió frontend funcional.

### Archivos revisados en `src/modules/visitas`

| Archivo | Rol en el flujo | Observaciones clave |
| --- | --- | --- |
| `src/modules/visitas/pages/CrearVisita.jsx` | Formulario residente para crear visita, cargar historial y mostrar/compartir QR. | Usa `tipos_documento`, `residentes`, `registro_visitas` con join a `visitantes`, y delega creación a `visitasService.crearVisita`. |
| `src/modules/visitas/pages/EscanearQR.jsx` | Validación operativa de QR desde portería. | Actualiza `registro_visitas` directamente; notifica residente vía `notificaciones` y Edge Function `enviar-notificacion`; registra bitácora local/remota. |
| `src/modules/visitas/pages/PanelVigilancia.jsx` | Panel de vigilancia para listar visitas, registrar ingreso/salida y sincronizar contingencia. | Consulta por `conjunto_id`, usa fallback indirecto por `residentes`/`visitantes`, actualiza estados directo en tabla. |
| `src/modules/visitas/services/visitasService.js` | Servicio de creación y validación de visitas. | Creación usa RPC `fn_crear_o_reutilizar_visitante_y_registro`; validación legacy `validarQR` actualiza directo y tiene riesgo de `usuario_id` incorrecto en notificaciones. |
| `src/modules/visitas/services/porteriaService.js` | Reglas de acceso, bitácora, cola offline y consolidado de seguridad. | Usa tabla `bitacora_porteria` no documentada ni encontrada en migraciones locales; consulta `paquetes` e `incidentes` para consolidado. |
| `src/modules/visitas/components/NotificacionesVisitas.jsx` | Listener realtime para residentes. | Escucha todos los `UPDATE` de `registro_visitas` y filtra en cliente por residente. |
| `src/modules/visitas/components/QRShareCard.jsx` | Presentación/compartir QR. | No accede a Supabase. |

### Archivos relacionados revisados fuera de `src/modules/visitas`

- `src/services/supabaseClient.js`: inicialización del cliente Supabase.
- `src/modules/seguridad/services/seguridadService.js`: dependencia indirecta por notificaciones/seguridad y patrón de notificaciones.
- `docs/database-schema.md`: diccionario funcional documentado.
- `docs/rls-roles-audit.md`: contexto de roles/RLS.
- `supabase/migrations/20260410031821_remote_schema.sql`: esquema remoto base, funciones y políticas.
- `supabase/migrations/20260509064414_hardening_rls_qa.sql`: endurecimiento de `registro_visitas_update_vigilancia_admin` por tenant.
- `supabase/migrations/20260509071639_hardening_reservas_multitenant.sql`: políticas multitenant para `visitantes` y `residentes`.
- `supabase/migrations/20260511120000_normalizar_rls_roles_core.sql`: normalización de roles/RLS core.

## Tablas Supabase usadas por el módulo

| Tabla | Uso frontend detectado | Estado en docs/migraciones |
| --- | --- | --- |
| `usuarios_app` | Resolver `conjunto_id`, rol, admins, `fcm_token`. | Documentada con `id`, `rol_id`, `conjunto_id`; `fcm_token` está en uso frontend reciente, pero no aparece en `docs/database-schema.md`. |
| `residentes` | Resolver residente del usuario (`usuario_id`), apartamento y tenant. | Documentada; RLS por mismo conjunto. |
| `visitantes` | Maestro de visitante; join desde visitas; búsqueda por residente. | Migración confirma columnas usadas (`nombre`, `documento`, `tipo_documento`, `tipo_vehiculo`, `placa`, etc.); docs la marca parcial. |
| `registro_visitas` | Registro principal: create vía RPC, selects, updates de ingreso/salida, realtime. | Documentada y migración confirma check de estados `pendiente|ingresado|salido|cancelado`. |
| `apartamentos` | Ubicación y FK de registro. | Documentada con `torre_id` y `conjunto_id`. |
| `torres` | Join indirecto desde apartamentos en panel. | Documentada. |
| `tipos_documento` | Catálogo para validar creación de visitante. | Documentada con `codigo` como FK de `visitantes.tipo_documento`. |
| `notificaciones` | Insert de avisos por ingreso/alertas. | Documentada; `usuario_id` referencia `usuarios_app.id`. |
| `incidentes` | Consolidado de seguridad en portería. | Documentada; fuera del alcance funcional de visitas pero dependencia directa de `porteriaService`. |
| `paquetes` | Consolidado de seguridad en portería. | Documentada; dependencia directa de `porteriaService`, aunque fuera del alcance de fixes de visitas. |
| `bitacora_porteria` | Insert de auditoría operativa. | **No encontrada** en `docs/database-schema.md` ni en `supabase/migrations/*.sql`. Riesgo alto si no existe en dev/qa. |

## Columnas utilizadas por el frontend

### `registro_visitas`

Columnas usadas:

- `id`
- `visitante_id`
- `conjunto_id`
- `apartamento_id`
- `fecha_visita`
- `estado`
- `qr_code`
- `hora_ingreso`
- `hora_salida`
- `validado_por` (solo vía RPC existente; el frontend directo no lo setea)
- `created_at`
- `updated_at` (solo en funciones SQL)
- `hora_inicio` y `hora_fin` (**usadas por frontend, no confirmadas en esquema/migraciones locales**)

Validación:

- `hora_inicio`/`hora_fin` se seleccionan en `EscanearQR.jsx` y se usan en `validarReglasAcceso`/`calcularSLA`, pero no aparecen en la tabla `registro_visitas` del esquema remoto ni en `docs/database-schema.md`.
- `created_at` tiene inconsistencia documental: `docs/database-schema.md` lo lista como `timestamp with time zone`, mientras la migración base lo crea como `timestamp without time zone`.

### `visitantes`

Columnas usadas:

- `id`
- `conjunto_id`
- `residente_id`
- `nombre`
- `tipo_documento`
- `documento`
- `tipo_vehiculo`
- `placa`
- `activo` (no usado por UI de visitas, pero existe en migración)
- `created_at`/`updated_at` (actualizadas por RPC)

Validación:

- La migración base confirma `visitantes_tipo_doc_fk` hacia `tipos_documento.codigo`.
- La migración base confirma checks de placa para carro/moto; el frontend valida formatos compatibles antes de crear.
- `docs/database-schema.md` todavía describe `visitantes` como “campos confirmados en extractos” y no incluye todos los campos que el frontend usa, aunque sí están en migración.

### `residentes`

Columnas usadas:

- `id`
- `usuario_id`
- `conjunto_id`
- `apartamento_id`

Validación:

- Relación esperada: `residentes.usuario_id` → `usuarios_app.id`.
- El flujo de creación obtiene `residentes.id`/`apartamento_id` desde `auth.uid()` vía `usuario_id`.

### `usuarios_app`

Columnas usadas:

- `id`
- `conjunto_id`
- `rol_id`
- `fcm_token`

Validación:

- `fcm_token` se usa para push en `EscanearQR.jsx`, pero no está documentado en `docs/database-schema.md`. Si la columna existe en Supabase dev/qa por cambios recientes, la documentación quedó desactualizada.

### `apartamentos` y `torres`

Columnas usadas:

- `apartamentos.id`
- `apartamentos.numero`
- `apartamentos.torre_id` (join implícito)
- `apartamentos.conjunto_id` (RLS/tenant)
- `torres.nombre`
- `torres.conjunto_id` (RLS/tenant)

Validación:

- El join de `PanelVigilancia.jsx` usa `registro_visitas.apartamento_id -> apartamentos.id -> torres`.
- En Supabase/PostgREST el join `apartamentos(torres(nombre))` depende de la FK `apartamentos.torre_id -> torres.id`, documentada.

### `notificaciones`

Columnas usadas:

- `usuario_id`
- `tipo`
- `titulo`
- `mensaje`

Validación:

- `usuario_id` debe ser `usuarios_app.id`/`auth.uid()`.
- `EscanearQR.jsx` resuelve correctamente `residentes.usuario_id` antes de insertar.
- `visitasService.validarQR` inserta `usuario_id: visita.visitantes?.residente_id`, lo cual es inconsistente con la FK documentada y apunta a `residentes.id`, no a `usuarios_app.id`. Aunque la función parece no estar importada actualmente, es un error real si se reutiliza.

### `bitacora_porteria`

Columnas usadas por `registrarBitacora`:

- `visita_id`
- `accion`
- `detalle`
- `usuario_id`
- `dispositivo`
- `metadata`
- `created_at`

Validación:

- No existe definición local confirmada. No se puede validar FK/RLS/tipos de `metadata` ni políticas.

## Joins/selects relevantes

| Archivo | Query | Validación/Riesgo |
| --- | --- | --- |
| `CrearVisita.jsx` | `registro_visitas.select(... visitantes!inner(...)).eq('visitantes.residente_id', rid)` | Correcto para historial del residente; depende de RLS de visitante/registro y de FK `registro_visitas.visitante_id`. No filtra `conjunto_id` explícitamente, pero el `rid` proviene del usuario autenticado. |
| `CrearVisita.jsx` | `residentes.select('id, apartamento_id').eq('usuario_id', auth.uid())` | Correcto para resolver `residente_id`; si un usuario tuviera más de un residente, toma el primero por `.limit(1)` sin orden determinístico. |
| `visitasService.js` | `usuarios_app.select('conjunto_id').eq('id', user.id).single()` | Correcto para obtener tenant desde usuario autenticado antes del RPC. |
| `visitasService.js` | `registro_visitas.select(*, visitantes(...)).eq('qr_code', qr_code)` | Función legacy; no filtra tenant explícitamente y luego actualiza directo. La unicidad de `qr_code` reduce colisión, pero no reemplaza validación tenant/rol. |
| `EscanearQR.jsx` | `registro_visitas.select(... visitantes(...)).or(id.eq|qr_code.eq).single()` | Riesgo: si QR plano no trae `conjunto_id`, el filtro tenant depende de RLS y no de `.eq('conjunto_id', usuarioApp.conjunto_id)`. Además selecciona `hora_inicio`/`hora_fin` no confirmadas. |
| `EscanearQR.jsx` | `residentes.select('id, usuario_id').eq('id', residente_id).eq('conjunto_id', visita.conjunto_id).maybeSingle()` | Correcto para convertir `residentes.id` a `usuarios_app.id` antes de notificar. |
| `PanelVigilancia.jsx` | `registro_visitas.select(... apartamentos(torres(nombre))).eq('conjunto_id', conjuntoId)` | Correcto para tenant cuando `registro_visitas.conjunto_id` está poblado. |
| `PanelVigilancia.jsx` | fallback `residentes.eq('conjunto_id') -> visitantes.in('residente_id') -> registro_visitas.in('visitante_id')` | Útil si hay registros sin `conjunto_id`, pero introduce múltiples lecturas y depende de RLS. Debe desaparecer cuando datos históricos estén normalizados. |
| `NotificacionesVisitas.jsx` | Realtime `postgres_changes` sobre `registro_visitas` sin filtro de tenant/residente en la suscripción; luego filtra en cliente. | Riesgo técnico: evento amplio, más ruido y posible exposición de metadatos del payload según configuración Realtime/RLS. |
| `porteriaService.js` | `usuarios_app.select('id').eq('conjunto_id').eq('rol_id','admin')` para alertas QR inválido. | Correcto por tenant si `usuarioApp.conjunto_id` existe; depende de política de lectura amplia de `usuarios_app`. |
| `porteriaService.js` | `registro_visitas`, `incidentes`, `paquetes` por `conjunto_id` en consolidado. | Correcto en visitas/incidentes/paquetes si las tablas tienen `conjunto_id`; `paquetes` está fuera del alcance de cambios de este ticket. |

## Mutaciones relevantes

### Inserts

- `visitasService.crearVisita`: no inserta directo; llama RPC `fn_crear_o_reutilizar_visitante_y_registro`, que inserta/actualiza `visitantes` e inserta `registro_visitas`.
- `visitasService.validarQR`: inserta en `notificaciones` con `usuario_id` potencialmente incorrecto (`residente_id`).
- `EscanearQR.jsx`: inserta `notificaciones` con `usuario_id = residentes.usuario_id`.
- `porteriaService.registrarIntentoQRInvalido`: inserta notificaciones a admins del conjunto.
- `porteriaService.registrarBitacora`: inserta en `bitacora_porteria`, tabla no confirmada.
- `seguridadService.crearIncidente`: inserta notificación global sin `usuario_id`; no es flujo de visitas, pero confirma patrón de notificaciones permisivo.

### Updates

- RPC `fn_crear_o_reutilizar_visitante_y_registro`: actualiza `visitantes` existente (`nombre`, `tipo_vehiculo`, `placa`, `updated_at`).
- `visitasService.validarQR`: actualiza `registro_visitas` a `ingresado` y `hora_ingreso` directo.
- `EscanearQR.jsx`: actualiza `registro_visitas` a `ingresado`, `hora_ingreso` directo.
- `PanelVigilancia.jsx`: actualiza `registro_visitas` a `ingresado`/`salido`, `hora_ingreso`/`hora_salida` directo.
- `porteriaService.syncOfflineQueue`: reproduce updates offline sobre `registro_visitas` directo.

### Deletes

- No se detectaron `delete()` en `src/modules/visitas`.

### RPC

- Usada: `fn_crear_o_reutilizar_visitante_y_registro`.
- Existentes pero no usadas por el frontend actual de portería/panel:
  - `fn_registrar_ingreso_visita`
  - `fn_registrar_salida_visita`

### Edge Functions / fetch

- `EscanearQR.jsx` llama `POST ${VITE_SUPABASE_URL}/functions/v1/enviar-notificacion` para push FCM.
- La llamada no envía `Authorization` ni `apikey`; si la Edge Function no está configurada pública o requiere JWT, puede fallar silenciosamente (solo `console.warn`).

## Validación de IDs y relaciones

### `registro_visitas.visitante_id`

- FK confirmada hacia `visitantes.id`.
- Los selects de historial y panel dependen de esta relación.
- La creación vía RPC devuelve `visitante_id` y `registro_id`; correcto.

### `visitantes.residente_id`

- FK confirmada hacia `residentes.id`.
- `CrearVisita.jsx` asigna el residente autenticado al crear.
- Políticas endurecidas en `visitantes` exigen mismo residente/conjunto para insert/update de residentes.

### `residentes.usuario_id`

- FK documentada hacia `usuarios_app.id`.
- `CrearVisita.jsx` usa `auth.uid()` para resolver residente.
- `EscanearQR.jsx` usa `residentes.usuario_id` para corregir notificación al usuario real.

### `usuarios_app.id`

- Debe coincidir con `auth.uid()` para RLS y notificaciones.
- Las políticas de `notificaciones` seleccionan `usuario_id = auth.uid()`.
- Riesgo en `visitasService.validarQR`: usa `residentes.id` como `usuario_id`.

### `apartamentos.id`

- FK desde `registro_visitas.apartamento_id` confirmada.
- `CrearVisita.jsx` pasa `residente.apartamento_id` a la RPC; correcto.
- No se valida explícitamente en frontend que el apartamento pertenezca al mismo conjunto que `usuario.conjunto_id`; la RPC tampoco muestra esa validación en la migración local. Hoy depende de que `residente.apartamento_id` venga de la propia fila de residente/RLS.

### `torres.id`

- Relación `apartamentos.torre_id -> torres.id` documentada.
- Solo se usa para mostrar ubicación en panel.

### `conjunto_id`

- `registro_visitas.conjunto_id` y `visitantes.conjunto_id` están confirmados como NOT NULL en migración.
- `CrearVisita` resuelve `usuarios_app.conjunto_id` y lo pasa a la RPC.
- `PanelVigilancia` filtra por `registro_visitas.conjunto_id` y tiene fallback por residentes/visitantes del conjunto.
- `EscanearQR` valida `conjunto_id` solo si viene embebido en el QR; para QR plano debería filtrar también por `usuarioApp.conjunto_id` al consultar.

## Validación de estados utilizados

Estados confirmados por migración/check:

- `pendiente`
- `ingresado`
- `salido`
- `cancelado`

Uso frontend:

- `CrearVisita.jsx` muestra `pendiente`, `ingresado`, `salido`, `cancelado`.
- `PanelVigilancia.jsx` normaliza variantes textuales (`pend`, `ingres`, `curso`, `sal`, `final`) hacia estados canónicos para UI.
- `EscanearQR.jsx` bloquea ingreso si `estado` es `ingresado` o `salido`, pero no bloquea explícitamente `cancelado`; como `validarReglasAcceso` solo rechaza esos dos estados, una visita cancelada podría pasar si fecha/ventana coinciden. Este es un error real de regla de negocio.
- `fn_registrar_ingreso_visita` en SQL solo actualiza si `estado = 'pendiente'`; usar RPC mitigaría ingresos desde `cancelado`.
- `fn_registrar_salida_visita` permite salida si `estado in ('ingresado','pendiente')`; permitir salida desde `pendiente` puede ser intencional para cerrar visita sin ingreso o puede requerir validación de negocio.

## Revisión de multitenancy

### Fortalezas

- Creación de visita obtiene `conjunto_id` desde `usuarios_app` y no desde input libre del formulario.
- Listado de vigilancia filtra por `registro_visitas.conjunto_id`.
- Fallback de panel deriva residentes por `conjunto_id` antes de consultar visitantes/registros.
- Notificación push de `EscanearQR` reconsulta residente con `residente_id` y `conjunto_id` de la visita.
- RLS de `registro_visitas_update_vigilancia_admin` fue endurecida en migración QA para exigir rol `vigilancia|admin` y mismo `conjunto_id`.

### Riesgos

- `EscanearQR.jsx` no aplica `.eq('conjunto_id', usuarioApp.conjunto_id)` al buscar por QR plano; depende de RLS. Recomendado como fix pequeño.
- `NotificacionesVisitas.jsx` suscribe todos los updates de `registro_visitas` y filtra después en cliente; recomendado agregar filtro Postgres Changes por tenant/registro si es viable, o suscribir vía canal más acotado.
- `visitasService.validarQR` legacy no filtra tenant explícitamente y actualiza directo; recomendado eliminarlo si no se usa o migrarlo a RPC/tenant check.
- La RPC de creación aceptaría `p_conjunto_id`, `p_residente_id` y `p_apartamento_id` como parámetros; al ser `SECURITY DEFINER`, conviene validar internamente que `p_residente_id` y `p_apartamento_id` pertenecen a `p_conjunto_id`/`auth.uid()`. No implementar en este ticket.

## Revisión de notificaciones relacionadas con visitas

| Flujo | Destinatario | Validación |
| --- | --- | --- |
| `EscanearQR.jsx` ingreso | `residentes.usuario_id` | Correcto: convierte `visitantes.residente_id` a `residentes.usuario_id`. |
| `visitasService.validarQR` ingreso legacy | `visitantes.residente_id` | Incorrecto frente a FK `notificaciones.usuario_id -> usuarios_app.id`; error real si se usa. |
| `NotificacionesVisitas.jsx` realtime | Residente autenticado, filtrado en cliente | Funcional como UX local, pero la suscripción es amplia. |
| `porteriaService.registrarIntentoQRInvalido` | Admins del conjunto | Correcto si `usuarios_app` lectura y `usuarioApp.conjunto_id` están disponibles. |

## Revisión de push/FCM

- `EscanearQR.jsx` consulta `usuarios_app.fcm_token` y llama Edge Function `enviar-notificacion`.
- `fcm_token` no figura en `docs/database-schema.md`; debe documentarse si está en dev/qa.
- No se encontró uso directo de `src/services/firebase.js` en `src/modules/visitas`; visitas consume solo el token ya persistido.
- La Edge Function se invoca con `fetch` directo y sin validar respuesta HTTP (`response.ok`). El fallo no rompe el ingreso, lo cual es correcto operativamente, pero reduce observabilidad.

## Revisión de offline/contingencia

- `porteriaService` mantiene cola local `urbaphix_porteria_queue_v1`, bitácora local `urbaphix_porteria_bitacora_local_v1` y contador QR inválido `urbaphix_invalid_qr_counter_v1`.
- `EscanearQR.jsx` encola ingreso cuando falla el update de `registro_visitas`.
- `PanelVigilancia.jsx` permite sincronizar cola con `syncOfflineQueue`.
- Riesgo: la cola offline reproduce updates directos sin volver a validar fecha/estado/tenant al sincronizar; queda protegida parcialmente por RLS, pero no por una función transaccional de negocio.
- Riesgo: si `bitacora_porteria` no existe o no tiene políticas, `registrarBitacora` cae a local sin visibilidad centralizada.

## Revisión de `porteriaService.js` y `bitacora_porteria`

`porteriaService.js` cumple tres roles: reglas de acceso, contingencia offline y métricas/consolidado de vigilancia.

Hallazgos:

1. `bitacora_porteria` no está en `docs/database-schema.md` ni en migraciones locales. Si existe solo en Supabase, la documentación/migraciones están incompletas; si no existe, las bitácoras remotas siempre fallan y se guardan solo en local.
2. `validarReglasAcceso` usa `fecha_visita`, `estado`, `hora_inicio`, `hora_fin`; las dos últimas columnas no están confirmadas.
3. `calcularSLA` usa `hora_inicio` aunque el panel no la selecciona y la tabla no la confirma. En la práctica cae a `'00:00'`, lo que puede inflar métricas de demora.
4. `obtenerSeguridadConsolidada` consulta `paquetes` e `incidentes`, dependencias directas de portería, pero fuera del alcance de fixes del módulo visitas.

## Revisión de RPC existentes y uso frontend

### `fn_crear_o_reutilizar_visitante_y_registro`

- Existe en migración base.
- Usada por `visitasService.crearVisita`.
- Inserta o actualiza `visitantes` y crea `registro_visitas` con estado `pendiente` y `qr_code` UUID.
- Riesgo por ser `SECURITY DEFINER`: la validación tenant/residente/apartamento debería estar dentro de la función, no solo en frontend/RLS. La versión local no muestra validación interna contra `auth.uid()`.

### `fn_registrar_ingreso_visita`

- Existe en migración base.
- No usada por `EscanearQR.jsx`, `PanelVigilancia.jsx` ni `visitasService.validarQR`.
- Ventaja: solo actualiza desde `pendiente`, setea `validado_por` y `updated_at`.
- Ticket recomendado: migrar ingreso a RPC, manteniendo validaciones frontend de UX.

### `fn_registrar_salida_visita`

- Existe en migración base.
- No usada por `PanelVigilancia.jsx` ni cola offline.
- Ventaja: setea `validado_por`, `updated_at` y centraliza transición.
- Revisión pendiente: definir si salida desde `pendiente` debe permitirse.

## Hallazgos priorizados

### Error real

1. **`visitasService.validarQR` inserta notificación con `residentes.id` en `notificaciones.usuario_id`.** La FK/documentación indican `usuarios_app.id`; si esta función se usa, la notificación no llegará al usuario correcto o violará FK.
2. **`EscanearQR.jsx` puede permitir ingreso de visitas `cancelado`.** La regla solo bloquea `ingresado` y `salido`; la DB sí reconoce `cancelado` como estado válido.
3. **Uso de columnas no confirmadas `hora_inicio`/`hora_fin`.** `EscanearQR.jsx` las selecciona; si no existen en dev/qa, la query falla. Si existen solo en Supabase, faltan migración y documentación.
4. **`bitacora_porteria` no está versionada/documentada.** El servicio intenta insertar; si la tabla no existe o RLS bloquea, se pierde auditoría centralizada.

### Riesgo técnico

1. **Ingreso/salida se actualizan directo en `registro_visitas` en vez de usar RPC existentes.** Se omite `validado_por`, `updated_at` y validaciones transaccionales.
2. **Búsqueda de QR plano sin filtro tenant explícito en `EscanearQR.jsx`.** Depende de RLS; debe reforzarse con `.eq('conjunto_id', usuarioApp.conjunto_id)` cuando esté disponible.
3. **Realtime amplio en `NotificacionesVisitas.jsx`.** Suscribe updates de toda la tabla y filtra en cliente.
4. **RPC de creación `SECURITY DEFINER` acepta IDs de tenant/residente/apartamento desde cliente.** Conviene validar internamente contra `auth.uid()`/helpers antes de asumir seguridad.
5. **Edge Function push sin `Authorization`, sin `apikey` y sin validar `response.ok`.** Puede fallar silenciosamente según configuración.
6. **Cola offline sincroniza updates sin revalidación de reglas de negocio.** RLS mitiga tenant/rol, pero no estado/fecha.

### Deuda técnica

1. **`docs/database-schema.md` incompleto/desactualizado para `visitantes` y `usuarios_app.fcm_token`.** Migración confirma más columnas de `visitantes`; frontend usa `fcm_token`.
2. **Inconsistencia de tipo `registro_visitas.created_at` entre docs y migración.** Documentar tipo real por ambiente.
3. **`visitasService.validarQR` parece no estar importado.** Mantener código legacy aumenta riesgo de uso accidental.
4. **`PanelVigilancia.jsx` usa fallback por residentes/visitantes.** Útil para datos históricos, pero agrega complejidad; debería retirarse tras backfill/validación de `registro_visitas.conjunto_id`.
5. **Selección de primer residente sin orden determinístico.** Si un usuario puede estar asociado a más de una unidad, se requiere UX o regla explícita.

### Sin acción inmediata

1. `QRShareCard.jsx` no tiene dependencia Supabase.
2. Validación frontend de placa coincide con checks de migración para carro/moto.
3. Estados UI principales (`pendiente`, `ingresado`, `salido`, `cancelado`) coinciden con check de migración.
4. Creación vía RPC reduce duplicación de lógica de insert para visitante/registro frente a inserts manuales.

## Tickets recomendados posteriores

1. **Fix pequeño: corregir o retirar `visitasService.validarQR`.** Si se mantiene, resolver `residentes.usuario_id`, filtrar tenant y bloquear `cancelado`; idealmente delegar a `fn_registrar_ingreso_visita`.
2. **Fix pequeño: bloquear `cancelado` en `validarReglasAcceso`.** Ajustar `porteriaService.validarReglasAcceso` y cubrir con test unitario simple si el stack lo permite.
3. **Fix pequeño: confirmar `hora_inicio`/`hora_fin`.** Si no existen, retirar selección/uso o crear ticket explícito de migración + docs con aprobación. Si existen en dev/qa, agregar migración/documentación faltante.
4. **Fix pequeño: documentar o versionar `bitacora_porteria`.** Antes de tocar frontend, confirmar si la tabla existe en Supabase dev; luego crear migración/docs/RLS o reemplazar por una tabla existente.
5. **Fix pequeño: filtrar QR por tenant en `EscanearQR.jsx`.** Agregar `.eq('conjunto_id', usuarioApp.conjunto_id)` cuando se busque por `qr_code`/`id` y mantener manejo de QR con `conjunto_id` embebido.
6. **Ticket RPC ingreso: migrar ingreso de portería/panel a `fn_registrar_ingreso_visita`.** Debe setear `validado_por`, `updated_at` y conservar notificaciones como post-acción.
7. **Ticket RPC salida: migrar salida de panel a `fn_registrar_salida_visita`.** Definir primero si salida desde `pendiente` es válida.
8. **Ticket Realtime: acotar `NotificacionesVisitas.jsx`.** Evaluar filtro por tenant/usuario o reemplazo por tabla `notificaciones` por usuario.
9. **Ticket docs DB: actualizar `docs/database-schema.md` para `visitantes`, `usuarios_app.fcm_token`, `bitacora_porteria` y tipo real de `registro_visitas.created_at`.** No mezclar con fixes funcionales.
10. **Ticket observabilidad push: validar respuesta de Edge Function y documentar contrato/auth.** Mantener ingreso exitoso aunque falle push.
