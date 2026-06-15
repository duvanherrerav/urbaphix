# Esquema de Base de Datos - Urbaphix

## Descripción general
Urbaphix usa Supabase Postgres sobre el esquema `public`.

Este documento sirve como fuente de verdad funcional para:
- Codex / ChatGPT conectado al repositorio
- desarrollo frontend/backend
- consultas SQL
- validación de tablas, columnas, relaciones y políticas RLS

## Reglas de uso
- No inventar tablas.
- No inventar columnas.
- No asumir FKs fuera de este documento o de `supabase/migrations`.
- Respetar RLS en toda consulta, inserción o actualización.
- Cuando se agregue una tabla o campo nuevo, actualizar este documento.

---

# Inventario completo de tablas

Tablas detectadas en `public`:

- accesos
- apartamentos
- archivos
- comunicados
- config_pagos
- conjuntos
- incidentes
- multas
- notificaciones
- operational_events
- pagos
- pagos_eventos
- paquetes
- parqueaderos
- pqr
- recursos_comunes
- registro_visitas
- reservas
- reservas_bloqueos
- reservas_documentos
- reservas_eventos
- reservas_zonas
- residentes
- roles
- tipos_documento
- torres
- trasteos
- usuarios_app
- vehiculos
- visitantes
- zonas_comunes
- platform_memberships
- tenant_memberships

---

# Diccionario de tablas

## 1. accesos
**Descripción:** registro operativo de ingreso y salida validado por vigilancia.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `visita_id` (uuid, nullable)
- `vigilante_id` (uuid, nullable)
- `fecha_ingreso` (timestamp without time zone, nullable)
- `fecha_salida` (timestamp without time zone, nullable)

### Relaciones
- `vigilante_id` → `usuarios_app.id`

### RLS
- `insert accesos vigilancia`
  - comando: `INSERT`
  - condición: rol autenticado debe ser `vigilancia`

---

## 2. apartamentos
**Descripción:** unidades habitacionales del conjunto.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `torre_id` (uuid, nullable)
- `numero` (text, nullable)
- `tipo_apartamento` (text, nullable)
- `piso` (integer, nullable)
- `created_at` (timestamp without time zone, nullable)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `torre_id` → `torres.id`

### RLS
- `apartamentos_select_conjunto`
  - comando: `SELECT`
  - condición: `conjunto_id = fn_auth_conjunto_id()`
- `apartamentos_admin_insert`
  - comando: `INSERT`
  - condición: rol `admin` y mismo `conjunto_id` vía `fn_auth_rol()` y `fn_auth_conjunto_id()`
- `apartamentos_admin_update`
  - comando: `UPDATE`
  - condición: rol `admin` y mismo `conjunto_id` vía `fn_auth_rol()` y `fn_auth_conjunto_id()`
- `apartamentos_admin_delete`
  - comando: `DELETE`
  - condición: rol `admin` y mismo `conjunto_id` vía `fn_auth_rol()` y `fn_auth_conjunto_id()`

---

## 3. archivos
**Descripción:** archivos o soportes asociados a módulos internos.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `referencia_id` (uuid, nullable)
- `url` (text, nullable)
- `modulo` (text, nullable)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- No visible FK explícita en los TXT cargados

### RLS
- `archivos por conjunto`
  - comando: `SELECT`
  - condición: `true`

---

## 4. comunicados
**Descripción:** comunicados publicados para residentes.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `titulo` (text, nullable)
- `contenido` (text, nullable)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`

### RLS
- `comunicados por conjunto`
  - comando: `SELECT`
  - condición: mismo `conjunto_id` del usuario autenticado
- `crear comunicados admin`
  - comando: `INSERT`
  - condición: rol `admin`

---

## 5. config_pagos
**Descripción:** configuración de pagos por conjunto.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, NOT NULL)
- `tipo` (text, NOT NULL)
- `url_pago` (text, nullable)
- `instrucciones` (text, nullable)
- `activo` (boolean, nullable, default: `true`)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`

### RLS
- `lectura config pagos`
  - comando: `SELECT`
  - condición: `true`

---

## 6. conjuntos
**Descripción:** entidad principal del multiconjunto.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `nombre` (text, NOT NULL)
- `direccion` (text, nullable)
- `ciudad` (text, nullable)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- tabla padre de múltiples módulos

### RLS
- `conjuntos_select_conjunto`
  - comando: `SELECT`
  - condición: `id = fn_auth_conjunto_id()`
- Sin políticas de escritura para clientes `anon`/`authenticated`; las escrituras deben realizarse por `service_role` o backend administrativo aprobado.

---

## 7. incidentes
**Descripción:** incidentes o novedades de seguridad.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `reportado_por` (uuid, nullable)
- `nivel` (text, nullable)
- `descripcion` (text, nullable)
- `estado` (text, NOT NULL, default: `'nuevo'::text`, check: `nuevo|en_gestion|resuelto|cerrado`)
- `tipo` (text, NOT NULL, default: `'seguridad'::text`, check: `seguridad|convivencia|infraestructura|acceso`)
- `ubicacion_texto` (text, nullable)
- `evidencia_url` (text, nullable)
- `resolucion` (text, nullable)
- `impacto_economico` (text, nullable)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `reportado_por` → `usuarios_app.id`

### RLS
- `crear incidentes vigilancia`
  - comando: `INSERT`
  - condición: rol `vigilancia`
- `incidentes por conjunto`
  - comando: `SELECT`
  - condición: mismo `conjunto_id`
- `update incidentes admin conjunto`
  - comando: `UPDATE`
  - condición: rol `admin` del mismo `conjunto_id`

---

## 8. multas
**Descripción:** multas aplicadas a residentes.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `residente_id` (uuid, nullable)
- `motivo` (text, nullable)
- `valor` (numeric, nullable)
- `estado` (text, nullable, default: `'pendiente'::text`)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `residente_id` → `residentes.id`

### RLS
- `crear multas admin`
  - comando: `INSERT`
  - condición: rol `admin`
- `multas por conjunto`
  - comando: `SELECT`
  - condición: mismo `conjunto_id`

---

## 9. notificaciones
**Descripción:** notificaciones del sistema por usuario.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `usuario_id` (uuid, nullable)
- `titulo` (text, nullable)
- `mensaje` (text, nullable)
- `tipo` (text, nullable)
- `leido` (boolean, nullable, default: `false`)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `usuario_id` → `usuarios_app.id`

### RLS
- `insert notificaciones permitido`
  - comando: `INSERT`
  - condición: `auth.uid() IS NOT NULL`
- `notificaciones usuario`
  - comando: `SELECT`
  - condición: `usuario_id = auth.uid()`
- `ver mis notificaciones`
  - comando: `SELECT`
  - condición: `usuario_id = auth.uid()`

---

## 10. pagos
**Descripción:** pagos administrativos u otros conceptos. La cartera real PH deriva visualmente un pago como `vencido` cuando `estado IN ('pendiente', 'rechazado')` y `fecha_vencimiento < now()`; no existe job automático para esta normalización.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `residente_id` (uuid, nullable)
- `concepto` (text, nullable)
- `valor` (numeric, nullable)
- `fecha_pago` (timestamp with time zone, nullable)
- `fecha_vencimiento` (timestamp with time zone, nullable)
- `dias_mora` (integer, nullable, default: `0`)
- `estado` (text, nullable, check: `pendiente|vencido|en_revision|pagado|rechazado`; constraint agregado `NOT VALID` para no bloquear registros históricos existentes)
- `comprobante_url` (text, nullable)
- `motivo_rechazo` (text, nullable)
- `fecha_rechazo` (timestamp with time zone, nullable)
- `rechazado_por` (uuid, nullable)
- `tipo_pago` (text, nullable, default: `'administracion'::text`)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `residente_id` → `residentes.id`
- `rechazado_por` → `usuarios_app.id`

### RLS
- `crear pagos admin`
  - comando: `INSERT`
  - condición: usuario admin
- `crear pagos admin conjunto`
  - comando: `INSERT`
  - condición: admin del mismo conjunto
- `pagos_select_admin_conjunto`
  - comando: `SELECT`
  - condición: `superadmin`, membresía activa `admin_conjunto`/`contador` del mismo `conjunto_id`, o admin legacy del mismo `conjunto_id`
- `pagos_select_residente_propios`
  - comando: `SELECT`
  - condición: membresía activa `residente` del mismo `conjunto_id` y `pagos.residente_id = tenant_memberships.residente_id`; fallback legacy propietario estricto con `residentes.usuario_id = auth.uid()`, `residentes.id = pagos.residente_id` y `residentes.conjunto_id = pagos.conjunto_id`
- `update comprobante pagos`
  - comando: `UPDATE`
  - condición: `true`
  - uso residente: al subir comprobante se actualiza `comprobante_url`, `estado = 'en_revision'` y se limpian `motivo_rechazo`, `fecha_rechazo`, `rechazado_por`
- `update pagos admin`
  - comando: `UPDATE`
  - condición: rol `admin`
  - uso admin: al rechazar comprobante se actualizan `estado = 'rechazado'`, `motivo_rechazo`, `fecha_rechazo` y `rechazado_por`

---

## 11. pagos_eventos
**Descripción:** trazabilidad operativa básica del ciclo de vida de pagos. Registra eventos mínimos de cobros y comprobantes sin alcance contable, conciliación ni analítica avanzada.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `pago_id` (uuid, NOT NULL)
- `conjunto_id` (uuid, nullable)
- `residente_id` (uuid, nullable)
- `usuario_id` (uuid, nullable)
- `evento` (text, NOT NULL; valores operativos esperados: `cobro_creado`, `comprobante_subido`, `comprobante_reemplazado`, `pago_aprobado`, `comprobante_rechazado`, `pago_vencido`)
- `estado_anterior` (text, nullable)
- `estado_nuevo` (text, nullable)
- `mensaje` (text, nullable)
- `metadata` (jsonb, NOT NULL, default: `'{}'::jsonb`)
- `created_at` (timestamp with time zone, NOT NULL, default: `now()`)

### Relaciones
- `pago_id` → `pagos.id` (`ON DELETE CASCADE`)
- `conjunto_id` → `conjuntos.id`
- `residente_id` → `residentes.id`
- `usuario_id` → `usuarios_app.id`

### RLS
- `pagos_eventos_select_admin_conjunto`
  - comando: `SELECT`
  - condición: admin autenticado del mismo `conjunto_id` vía `fn_auth_conjunto_id()` y `fn_auth_rol()`
- `pagos_eventos_select_residente_propios`
  - comando: `SELECT`
  - condición: residente autenticado solo lee eventos donde `residente_id = fn_auth_residente_id()`
- `pagos_eventos_insert_flujos_pagos`
  - comando: `INSERT`
  - condición: usuario autenticado inserta eventos del mismo conjunto, asociados a un pago existente y con `usuario_id = auth.uid()`; admin puede registrar eventos administrativos del flujo (`cobro_creado`, `pago_aprobado`, `comprobante_rechazado`, `pago_vencido`) y residente solo puede registrar eventos propios de comprobante (`comprobante_subido`, `comprobante_reemplazado`) para sus pagos

---

## 12. paquetes
**Descripción:** recepción y entrega de paquetes.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `apartamento_id` (uuid, nullable)
- `residente_id` (uuid, nullable)
- `recibido_por` (uuid, nullable)
- `descripcion` (text, nullable)
- `estado` (text, nullable, default: `'pendiente'::text`)
- `fecha_recibido` (timestamp without time zone, nullable, default: `now()`)
- `fecha_entrega` (timestamp without time zone, nullable)
- `created_at` (timestamp without time zone, nullable)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `apartamento_id` → `apartamentos.id`
- `residente_id` → `residentes.id`
- `recibido_por` → `usuarios_app.id`

### RLS
- `insert paquetes vigilancia`
  - comando: `INSERT`
  - condición: rol `vigilancia`
- `paquetes_select_admin_conjunto`
  - comando: `SELECT`
  - condición: `superadmin`, membresía activa `admin_conjunto`/`contador` del mismo `conjunto_id`, o admin legacy del mismo `conjunto_id`
- `paquetes_select_residente_propios`
  - comando: `SELECT`
  - condición: residente autenticado solo lee paquetes donde `residente_id` corresponde a su membresía activa de residente y al mismo `conjunto_id`, o fallback legacy `residentes.usuario_id = auth.uid()` con el mismo `conjunto_id`
- `paquetes_select_vigilancia_conjunto`
  - comando: `SELECT`
  - condición: lectura operativa de portería/paquetería para `vigilancia`/`vigilante` del mismo `conjunto_id` vía membresía activa o fallback legacy `usuarios_app`
- `update paquetes vigilancia`
  - comando: `UPDATE`
  - condición: rol `vigilancia`
- Nota FASE 3D.14: se elimina la lectura amplia `paquetes por conjunto`; un residente no puede leer paquetes de otros residentes aunque compartan conjunto, y todos los accesos conservados validan `conjunto_id` para evitar lectura cross-tenant.

### Checklist REST/PostgREST FASE 3D.14
- Residente DEV autenticado (`residente.dev@urbaphix.com`) consultando un paquete de otro residente del mismo conjunto por `residente_id=eq.<residente_ajeno>` debe recibir `200 []` o `403`.
- Residente DEV autenticado consultando sus paquetes propios por `residente_id=eq.<residente_propio>` debe recibir únicamente sus filas.
- Admin DEV autenticado debe poder consultar paquetes donde `conjunto_id=eq.<conjunto_dev>`.
- Vigilancia DEV autenticado debe poder consultar paquetes donde `conjunto_id=eq.<conjunto_dev>` para operación de recepción/entrega.
- Residente DEV autenticado consultando paquetes de otro tenant por `conjunto_id=eq.<conjunto_ajeno>` o `residente_id=eq.<residente_ajeno_cross_tenant>` debe recibir `200 []` o `403`.
- Vigilancia DEV autenticado consultando paquetes de otro tenant por `conjunto_id=eq.<conjunto_ajeno>` debe recibir `200 []` o `403`.

---

## 13. parqueaderos
**Descripción:** parqueaderos definidos para el conjunto.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `numero` (text, nullable)
- `tipo` (text, nullable)
- `ocupado` (boolean, nullable, default: `false`)

### Relaciones
- `conjunto_id` → `conjuntos.id`

### RLS
- No visible en los TXT cargados

---

## 14. pqr
**Descripción:** peticiones, quejas y reclamos.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `residente_id` (uuid, nullable)
- `asunto` (text, nullable)
- `descripcion` (text, nullable)
- `respuesta` (text, nullable)
- `estado` (text, nullable, default: `'abierto'::text`)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `residente_id` → `residentes.id`

### RLS
- `crear pqr residente`
  - comando: `INSERT`
  - condición: rol `residente`
- `pqr por residente`
  - comando: `SELECT`
  - condición: PQR del propio residente

---

## 15. recursos_comunes
**Descripción:** catálogo detallado de recursos comunes reservables.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, NOT NULL)
- `nombre` (text, NOT NULL)
- `tipo` (text, NOT NULL)
- `descripcion` (text, nullable)
- `capacidad` (integer, nullable)
- `activo` (boolean, NOT NULL, default: `true`)
- `requiere_aprobacion` (boolean, NOT NULL, default: `true`)
- `requiere_deposito` (boolean, NOT NULL, default: `false`)
- `deposito_valor` (numeric, nullable)
- `reglas` (jsonb, NOT NULL, default: `'{}'::jsonb`)
- `tiempo_buffer_min` (integer, NOT NULL, default: `0`)
- `created_at` (timestamp with time zone, NOT NULL, default: `now()`)
- `updated_at` (timestamp without time zone, NOT NULL, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`

### RLS
- `recursos_admin_write`
  - comando: `ALL`
  - condición: mismo conjunto y rol `admin`
- `recursos_select_conjunto`
  - comando: `SELECT`
  - condición: mismo conjunto vía `fn_auth_conjunto_id()`

---

## 16. registro_visitas
**Descripción:** flujo principal de visitas, QR, validación e ingreso/salida.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `visitante_id` (uuid, NOT NULL)
- `conjunto_id` (uuid, NOT NULL)
- `apartamento_id` (uuid, nullable)
- `validado_por` (uuid, nullable)
- `fecha_visita` (date, NOT NULL)
- `hora_ingreso` (timestamp without time zone, nullable)
- `hora_salida` (timestamp without time zone, nullable)
- `estado` (text, NOT NULL, default: `'pendiente'::text`)
- `qr_code` (text, NOT NULL)
- `notas` (text, nullable)
- `created_at` (timestamp with time zone, NOT NULL, default: `now()`)
- `updated_at` (timestamp without time zone, NOT NULL, default: `now()`)

### Relaciones
- `visitante_id` → `visitantes.id`
- `conjunto_id` → `conjuntos.id`
- `apartamento_id` → `apartamentos.id`
- `validado_por` → `usuarios_app.id`

### RLS
- `registro_visitas_insert_propios`
  - comando: `INSERT`
  - condición: el visitante pertenece a un residente autenticado
- `registro_visitas_select_propios`
  - comando: `SELECT`
  - condición: visitas del propio residente
- `registro_visitas_select_same_conjunto`
  - comando: `SELECT`
  - condición: usuario del mismo conjunto o relación indirecta por visitante/residente
- `registro_visitas_update_vigilancia_admin`
  - comando: `UPDATE`
  - condición: rol `vigilancia` o `admin`

---

## 17. reservas
**Descripción:** módulo simple de reservas de zonas comunes.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `zona_id` (uuid, nullable)
- `residente_id` (uuid, nullable)
- `fecha` (date, nullable)
- `hora_inicio` (time without time zone, nullable)
- `hora_fin` (time without time zone, nullable)
- `estado` (text, nullable, default: `'pendiente'::text`)

### Relaciones
- `zona_id` → `zonas_comunes.id`
- `residente_id` → `residentes.id`

### RLS
- `crear reservas residente`
  - comando: `INSERT`
  - condición: rol `residente`
- `reservas por conjunto`
  - comando: `SELECT`
  - condición: zona del mismo conjunto

---

## 18. reservas_bloqueos
**Descripción:** bloqueos administrativos de un recurso común por fecha/hora.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, NOT NULL)
- `recurso_id` (uuid, NOT NULL)
- `creado_por` (uuid, nullable)
- `motivo` (text, NOT NULL)
- `fecha_inicio` (timestamp without time zone, NOT NULL)
- `fecha_fin` (timestamp without time zone, NOT NULL)
- `created_at` (timestamp with time zone, NOT NULL, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `recurso_id` → `recursos_comunes.id`
- `creado_por` → `usuarios_app.id`

### RLS
- `bloqueos_admin_write`
  - comando: `ALL`
  - condición: mismo conjunto y rol `admin`
- `bloqueos_select_conjunto`
  - comando: `SELECT`
  - condición: mismo conjunto

---

## 19. reservas_documentos
**Descripción:** documentos anexos a una reserva de zonas.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `reserva_id` (uuid, NOT NULL)
- `conjunto_id` (uuid, NOT NULL)
- `subido_por` (uuid, nullable)
- `nombre_archivo` (text, NOT NULL)
- `ruta_storage` (text, NOT NULL)
- `tipo_documento` (text, nullable)
- `created_at` (timestamp with time zone, NOT NULL, default: `now()`)

### Relaciones
- `reserva_id` → `reservas_zonas.id`
- `conjunto_id` → `conjuntos.id`
- `subido_por` → `usuarios_app.id`

### RLS
- `docs_insert_conjunto`
  - comando: `INSERT`
  - condición: mismo conjunto
- `docs_select_conjunto`
  - comando: `SELECT`
  - condición: mismo conjunto

---

## 20. reservas_eventos
**Descripción:** bitácora de eventos de reservas.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `reserva_id` (uuid, NOT NULL)
- `conjunto_id` (uuid, NOT NULL)
- `actor_id` (uuid, nullable)
- `accion` (text, NOT NULL)
- `detalle` (text, nullable)
- `metadata` (jsonb, NOT NULL, default: `'{}'::jsonb`)
- `created_at` (timestamp with time zone, NOT NULL, default: `now()`)

### Relaciones
- `reserva_id` → `reservas_zonas.id`
- `conjunto_id` → `conjuntos.id`
- `actor_id` → `usuarios_app.id`

### RLS
- `eventos_insert_conjunto`
  - comando: `INSERT`
  - condición: mismo conjunto
- `eventos_select_conjunto`
  - comando: `SELECT`
  - condición: mismo conjunto

---

## 21. reservas_zonas
**Descripción:** módulo robusto de reservas de recursos comunes.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, NOT NULL)
- `recurso_id` (uuid, NOT NULL)
- `residente_id` (uuid, nullable)
- `apartamento_id` (uuid, nullable)
- `aprobada_por` (uuid, nullable)
- `rechazada_por` (uuid, nullable)
- `checkin_por` (uuid, nullable)
- `checkout_por` (uuid, nullable)
- `tipo_reserva` (text, NOT NULL, default: `'recreativa'::text`)
- `subtipo` (text, nullable)
- `motivo` (text, nullable)
- `observaciones` (text, nullable)
- `estado` (text, NOT NULL, default: `'solicitada'::text`)
- `created_at` (timestamp with time zone, NOT NULL, default: `now()`)
- `updated_at` (timestamp with time zone, NOT NULL, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `recurso_id` → `recursos_comunes.id`
- `residente_id` → `residentes.id`
- `apartamento_id` → `apartamentos.id`
- `aprobada_por` → `usuarios_app.id`
- `rechazada_por` → `usuarios_app.id`
- `checkin_por` → `usuarios_app.id`
- `checkout_por` → `usuarios_app.id`

### RLS
- `reservas_insert_residente_admin`
  - comando: `INSERT`
  - condición: admin del mismo conjunto o residente dueño
- `reservas_zonas_select_admin_conjunto`
  - comando: `SELECT`
  - condición: `superadmin` vía `fn_is_platform_superadmin()` lee todos los conjuntos; `admin_conjunto`/`contador` con membresía activa en `tenant_memberships` leen reservas de su `conjunto_id`; fallback legacy `usuarios_app.rol_id = 'admin'` solo lee su mismo `conjunto_id`.
- `reservas_zonas_select_residente_propias`
  - comando: `SELECT`
  - condición: residente autenticado solo lee filas donde `reservas_zonas.residente_id` coincide con su `tenant_memberships.residente_id` activo del mismo `conjunto_id`; fallback legacy estricto con `residentes.usuario_id = auth.uid()`, `residentes.id = reservas_zonas.residente_id` y `residentes.conjunto_id = reservas_zonas.conjunto_id`.
- `reservas_zonas_select_vigilancia_conjunto`
  - comando: `SELECT`
  - condición: `vigilancia`/`vigilante` con membresía activa en `tenant_memberships` o fallback legacy `usuarios_app` lee reservas de su mismo `conjunto_id` para operación de check-in/check-out y control de zonas comunes.
- `fn_reservas_zonas_ocupacion_disponibilidad(p_conjunto_id, p_recurso_id, p_fecha_inicio, p_fecha_fin, p_reserva_id_excluir)`
  - tipo: RPC privacy-safe para disponibilidad
  - devuelve únicamente `recurso_id`, `fecha_inicio`, `fecha_fin`, `estado`, `ocupado`, `bloqueo`; no expone `residente_id`, `apartamento_id`, `motivo`, `observaciones`, `metadata` ni usuarios operativos/aprobadores de reservas de terceros.
  - condición: sesión autenticada con acceso al `conjunto_id` por `superadmin`, `tenant_memberships` activa (`admin_conjunto`, `contador`, `residente`, `vigilancia`/`vigilante`) o fallback legacy controlado; filtra por recurso, rango y estados activos (`solicitada`, `aprobada`, `en_curso`).

### Checklist REST/PostgREST FASE 3D.15
- [ ] Residente DEV autenticado consulta una reserva de otro residente del mismo conjunto mediante `/rest/v1/reservas_zonas?...&residente_id=eq.<residente_ajeno>` y obtiene `200 []` o `403`.
- [ ] Residente DEV autenticado consulta sus propias reservas mediante `/rest/v1/reservas_zonas?...&residente_id=eq.<residente_propio>` y solo recibe filas propias.
- [ ] Residente DEV calcula disponibilidad de un recurso con reservas activas de otros residentes mediante `rpc/fn_reservas_zonas_ocupacion_disponibilidad` o el flujo frontend `getDisponibilidadRecurso` y obtiene ocupación correcta sin consultar filas completas de terceros.
- [ ] La respuesta de disponibilidad contiene solo `recurso_id`, `fecha_inicio`, `fecha_fin`, `estado`, `ocupado`, `bloqueo` y no filtra `residente_id`, `apartamento_id`, `motivo`, `observaciones`, `metadata`, `aprobada_por`, `rechazada_por`, `checkin_por` ni `checkout_por`.
- [ ] Admin DEV consulta `/rest/v1/reservas_zonas?select=id,conjunto_id,residente_id,estado` y solo recibe filas de su conjunto, salvo sesión platform superadmin.
- [ ] Vigilancia/vigilante DEV consulta reservas operativas del conjunto para check-in/check-out o control de zonas comunes y no recibe filas cross-tenant.
- [ ] Residente DEV intenta filtrar `conjunto_id` cross-tenant y obtiene `200 []` o `403`.
- [ ] Confirmar que `INSERT`, `UPDATE` y `DELETE` conservan las policies existentes y no cambian respecto a la fase anterior.

---

## 22. residentes
**Descripción:** puente entre usuario app, apartamento y conjunto.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `usuario_id` (uuid, nullable)
- `conjunto_id` (uuid, nullable)
- `apartamento_id` (uuid, nullable)

### Relaciones
- `usuario_id` → `usuarios_app.id`
- `conjunto_id` → `conjuntos.id`
- `apartamento_id` → `apartamentos.id`

### RLS
- `residentes crear admin`
  - comando: `INSERT`
  - condición: rol `admin`
- `residentes_select_admin_conjunto`
  - comando: `SELECT`
  - condición: `superadmin`, membresía activa `admin_conjunto`/`contador` del mismo `conjunto_id`, o admin legacy del mismo `conjunto_id`
- `residentes_select_residente_propio`
  - comando: `SELECT`
  - condición: propietario estricto por membresía activa `residente` (`tenant_memberships.user_id = auth.uid()`, `tenant_memberships.residente_id = residentes.id`, `tenant_memberships.status = 'active'`) o fallback legacy directo `residentes.usuario_id = auth.uid()`
- `residentes_select_vigilancia_lookup_paquetes`
  - comando: `SELECT`
  - condición: lookup operativo de portería/paquetería para `vigilancia`/`vigilante` del mismo `conjunto_id` vía membresía activa (`tenant_memberships.user_id = auth.uid()`, `tenant_memberships.conjunto_id = residentes.conjunto_id`, `tenant_memberships.status = 'active'`) o fallback legacy controlado (`usuarios_app.id = auth.uid()`, `usuarios_app.conjunto_id = residentes.conjunto_id`)
- Nota FASE 3D.13: usuarios con rol `residente` no pueden leer otras filas de `residentes` solo por compartir `conjunto_id`; vigilancia/vigilante conserva únicamente lookup acotado al mismo conjunto para operación de portería/paquetería.

---

## 23. roles
**Descripción:** catálogo de roles de aplicación.

### Campos
- `id` (text, NOT NULL)
- `nombre` (text, NOT NULL)

### Valores oficiales
- `admin`: administración del conjunto.
- `residente`: usuario residente.
- `vigilancia`: operación de accesos, paquetes, visitas, reservas e incidentes. Es el único valor válido para el rol de vigilancia en RBAC/RLS.

### Valores legacy/no válidos
- `vigilante`: drift histórico/legacy observado en seeds/ambientes. No debe usarse como rol válido; si existe en datos, debe normalizarse a `vigilancia` mediante migración revisable.

### Relaciones
- `usuarios_app.rol_id` → `roles.id`

### RLS
- `roles_select_authenticated`
  - comando: `SELECT`
  - condición: `true` para usuarios autenticados
- Sin políticas de escritura para clientes `anon`/`authenticated`; el catálogo se administra por migraciones o consola protegida.

---

## 24. tipos_documento
**Descripción:** catálogo de tipos de documento.

### Campos
- `id` (bigint, NOT NULL)
- `codigo` (text, NOT NULL)
- `nombre` (text, NOT NULL)
- `activo` (boolean, NOT NULL, default: `true`)

### Relaciones
- `visitantes.tipo_documento` → `tipos_documento.codigo`

### RLS
- `tipos_documento_select_authenticated`
  - comando: `SELECT`
  - condición: `true`

---

## 25. torres
**Descripción:** torres o bloques del conjunto.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `nombre` (text, nullable)
- `created_at` (timestamp without time zone, nullable)
- `pisos` (integer, nullable)
- `conjunto_id` (uuid, nullable)

### Relaciones
- `conjunto_id` → `conjuntos.id`

### RLS
- `torres_select_conjunto`
  - comando: `SELECT`
  - condición: `conjunto_id = fn_auth_conjunto_id()`
- `torres_admin_insert`
  - comando: `INSERT`
  - condición: rol `admin` y mismo `conjunto_id` vía `fn_auth_rol()` y `fn_auth_conjunto_id()`
- `torres_admin_update`
  - comando: `UPDATE`
  - condición: rol `admin` y mismo `conjunto_id` vía `fn_auth_rol()` y `fn_auth_conjunto_id()`
- `torres_admin_delete`
  - comando: `DELETE`
  - condición: rol `admin` y mismo `conjunto_id` vía `fn_auth_rol()` y `fn_auth_conjunto_id()`

---

## 26. trasteos
**Descripción:** solicitudes o registros de mudanzas/trasteos.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `residente_id` (uuid, nullable)
- `conjunto_id` (uuid, nullable)
- `fecha` (date, nullable)
- `estado` (text, nullable, default: `'pendiente'::text`)

### Relaciones
- `residente_id` → `residentes.id`
- `conjunto_id` → `conjuntos.id`

### RLS
- No visible en los TXT cargados

---

## 27. usuarios_app
**Descripción:** usuarios internos de la aplicación ligados a auth.

### Campos
- `id` (uuid, PK lógica / visible por relación)
- `nombre` (text, nullable)
- `email` (text, nullable)
- `telefono` (text, nullable)
- `rol_id` (text, nullable)
- `conjunto_id` (uuid, nullable)

### Relaciones
- `rol_id` → `roles.id`
- `conjunto_id` → `conjuntos.id`

### RLS
- `lectura usuarios`
  - comando: `SELECT`
  - condición: `true`
- `usuario puede verse`
  - comando: `SELECT`
  - condición: `id = auth.uid()`
- `usuarios actualizar su info`
  - comando: `UPDATE`
  - condición: `id = auth.uid()`

---

## 28. vehiculos
**Descripción:** vehículos asociados a residentes.

### Campos confirmados en extractos
- `residente_id` (uuid, nullable)

### Relaciones
- `residente_id` → `residentes.id`

### RLS
- No visible en los TXT cargados

### Nota
- Los TXT cargados no mostraron más columnas de `vehiculos`

---

## 29. visitantes
**Descripción:** visitantes registrados por residentes.

### Campos confirmados en extractos
- `id` (uuid, PK lógica esperada)
- `residente_id` (uuid, nullable)
- `conjunto_id` (uuid, nullable)
- `tipo_documento` (text, nullable)

### Relaciones
- `residente_id` → `residentes.id`
- `conjunto_id` → `conjuntos.id`
- `tipo_documento` → `tipos_documento.codigo`

### RLS
- `visitantes_insert_propios`
  - comando: `INSERT`
  - condición: visitante ligado a residente del usuario autenticado
- `visitantes_select_propios`
  - comando: `SELECT`
  - condición: visitantes del propio residente
- `visitantes_select_same_conjunto`
  - comando: `SELECT`
  - condición: mismo conjunto
- `visitantes_update_propios`
  - comando: `UPDATE`
  - condición: visitante del propio residente

---

## 30. zonas_comunes
**Descripción:** catálogo simple de zonas comunes.

### Campos confirmados en extractos
- `conjunto_id` (uuid, nullable)

### Relaciones
- `conjunto_id` → `conjuntos.id`

### RLS
- No visible en los TXT cargados

### Nota
- La tabla `reservas` depende de `zonas_comunes.id`
- Los TXT cargados no mostraron más columnas de `zonas_comunes`

---

# Mapa de relaciones clave

## Relación con conjuntos
Tablas con FK directa a `conjuntos.id`:
- apartamentos
- comunicados
- config_pagos
- incidentes
- multas
- pagos
- pagos_eventos
- paquetes
- parqueaderos
- recursos_comunes
- registro_visitas
- reservas_bloqueos
- reservas_documentos
- reservas_eventos
- reservas_zonas
- residentes
- torres
- trasteos
- usuarios_app
- visitantes
- zonas_comunes

## Relación con usuarios_app
Tablas con FK a `usuarios_app.id`:
- accesos
- incidentes
- notificaciones
- operational_events
- paquetes
- pagos
- pagos_eventos
- registro_visitas
- reservas_bloqueos
- reservas_documentos
- reservas_eventos
- reservas_zonas
- residentes

## Relación con residentes
Tablas con FK a `residentes.id`:
- multas
- pagos
- pagos_eventos
- paquetes
- pqr
- reservas
- reservas_zonas
- trasteos
- vehiculos
- visitantes

---

# Resumen general de RLS

## Roles y patrones detectados
Patrones de control vistos en las políticas:
- `admin`
- `vigilancia`
- `residente`
- `authenticated`
- `public`

`vigilancia` es el identificador canónico para el personal de portería/vigilancia. `vigilante` no es un rol válido; corresponde a drift histórico y debe migrarse a `vigilancia` si aparece en `roles.id` o `usuarios_app.rol_id`.

## Funciones usadas en políticas
- `auth.uid()`
- `fn_auth_conjunto_id()`
- `fn_auth_rol()`
- `fn_auth_residente_id()`

## Tablas con políticas visibles
- accesos
- archivos
- comunicados
- config_pagos
- incidentes
- multas
- notificaciones
- operational_events
- pagos
- pagos_eventos
- paquetes
- pqr
- recursos_comunes
- registro_visitas
- reservas
- reservas_bloqueos
- reservas_documentos
- reservas_eventos
- reservas_zonas
- residentes
- tipos_documento
- usuarios_app
- visitantes

---

# Notas para Codex

1. Urbaphix es multi-conjunto y muchas consultas deben filtrar por `conjunto_id`.
2. En varias tablas el acceso depende de `auth.uid()` y de relaciones con `residentes`.
3. No asumir que todas las tablas tienen RLS visible en este documento.
4. Si una implementación requiere una columna no listada aquí, revisar primero `supabase/migrations/` o confirmar en Supabase.
5. Para tablas parcialmente visibles (`vehiculos`, `visitantes`, `zonas_comunes`), no inventar columnas faltantes.

---

# Estado del documento

Este archivo fue construido desde:
- `Tablas.txt`
- `Campos.txt`
- `Llaves_FK.txt`
- `Politicas.txt`

Puede ampliarse más adelante con:
- índices
- constraints únicos
- triggers
- funciones SQL
- columnas faltantes de tablas no completamente visibles en los TXT

## 10. operational_events
**Descripción:** auditoría operativa backend para eventos frontend saneados (POST-PROD 2D-1).

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `created_at` (timestamp with time zone, NOT NULL, default: `now()`)
- `conjunto_id` (uuid, nullable, FK `conjuntos.id`)
- `actor_user_id` (uuid, nullable, FK `auth.users.id`)
- `actor_role` (text, nullable)
- `module` (text, NOT NULL, check longitud 2..64)
- `action` (text, NOT NULL, check longitud 2..64)
- `severity` (text, NOT NULL, check `info|warn|error`)
- `event_type` (text, nullable)
- `message` (text, NOT NULL, check longitud 1..280)
- `error_type` (text, nullable)
- `error_code` (text, nullable)
- `http_status` (integer, nullable)
- `metadata` (jsonb, NOT NULL, default `'{}'::jsonb`, check objeto JSON)
- `environment` (text, nullable)
- `source` (text, NOT NULL, default `'frontend'`, check `frontend|edge_function`)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `actor_user_id` → `auth.users.id`

### RLS
- RLS habilitado (`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`).
- `anon`: sin permisos de lectura/escritura.
- `authenticated`: sin permisos de lectura/escritura.
- Sin policies públicas en esta fase; inserción prevista únicamente vía Edge Function con `service_role`.

### Índices
- `operational_events_created_at_desc_idx` (`created_at desc`)
- `operational_events_conjunto_created_at_desc_idx` (`conjunto_id`, `created_at desc`)
- `operational_events_module_action_created_at_desc_idx` (`module`, `action`, `created_at desc`)
- `operational_events_severity_created_at_desc_idx` (`severity`, `created_at desc`)


## 32. platform_memberships
**Descripción:** membresías de alcance plataforma (global SaaS).

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `user_id` (uuid, NOT NULL)
- `role_name` (text, NOT NULL, check: `superadmin|platform_support|platform_auditor|platform_ops`)
- `status` (text, NOT NULL, default: `'active'`, check: `active|suspended|revoked`)
- `granted_by` (uuid, nullable)
- `granted_reason` (text, nullable)
- `created_at` (timestamptz, NOT NULL, default: `now()`)
- `updated_at` (timestamptz, NOT NULL, default: `now()`)
- `revoked_at` (timestamptz, nullable)

### Relaciones
- `user_id` → `auth.users.id`
- `granted_by` → `auth.users.id`

### Índices
- único parcial: `(user_id, role_name) where status = 'active'`
- índice: `(user_id, status)`

### RLS
- SELECT: propio usuario o `superadmin` (`fn_is_platform_superadmin()`).
- INSERT/UPDATE: solo `superadmin`.
- DELETE: denegado por política.

## 33. tenant_memberships
**Descripción:** membresías por tenant (`conjunto_id`) para coexistencia con modelo legacy.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `user_id` (uuid, NOT NULL)
- `conjunto_id` (uuid, NOT NULL)
- `role_name` (text, NOT NULL, check: `admin_conjunto|vigilante|residente|contador|comite`)
- `residente_id` (uuid, nullable)
- `status` (text, NOT NULL, default: `'active'`, check: `active|suspended|revoked`)
- `source_legacy` (text, NOT NULL, default: `'usuarios_app'`)
- `created_at` (timestamptz, NOT NULL, default: `now()`)
- `updated_at` (timestamptz, NOT NULL, default: `now()`)
- `revoked_at` (timestamptz, nullable)

### Relaciones
- `user_id` → `auth.users.id`
- `conjunto_id` → `conjuntos.id`
- `residente_id` → `residentes.id`

### Índices
- único parcial: `(user_id, conjunto_id) where status = 'active'`
- índice: `(conjunto_id, status)`
- índice parcial: `residente_id where residente_id is not null`

### RLS
- SELECT: `superadmin` o usuarios con acceso activo al mismo conjunto (`fn_has_tenant_access`).
- INSERT/UPDATE: `superadmin` o rol plataforma autorizado (`platform_ops`).
- DELETE: denegado por política.
