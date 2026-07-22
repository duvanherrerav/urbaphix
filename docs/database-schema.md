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

# Extensiones Postgres

Extensiones requeridas por el esquema:

- `btree_gist`
  - schema esperado: `extensions`
  - motivo: requerido por la constraint de exclusión `reservas_zonas_no_solape` en `public.reservas_zonas`, que usa GiST para impedir solapes de reservas activas por `recurso_id` y rango horario.
  - antecedente: el snapshot inicial la creó en `public`; FASE 3D.29 la reubica a `extensions` sin recrear la constraint ni cambiar RLS, tablas, columnas o FKs.
  - rollback documentado si fuese estrictamente necesario: `ALTER EXTENSION btree_gist SET SCHEMA public;`. No usar `DROP EXTENSION btree_gist` mientras exista `reservas_zonas_no_solape`.

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
- tenant_lifecycle
- tenant_lifecycle_events
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
- visitantes
- zonas_comunes
- platform_memberships
- tenant_memberships
- tenant_lifecycle

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

### Grants
- FASE 3D.32 revoca `ALL PRIVILEGES` de `anon` sobre `public.archivos` para reducir exposición GraphQL/PostgREST heredada.
- `authenticated` y `service_role` no se modifican en esta fase.

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
- `config_pagos_select_conjunto`
  - comando: `SELECT`
  - roles: `authenticated`
  - condición: `fn_is_platform_superadmin()` o `fn_has_platform_role('platform_ops')` o membresía activa del mismo `conjunto_id` con rol `admin_conjunto`, `contador` o `residente`; conserva fallback legacy same-tenant autenticado con `conjunto_id = fn_auth_conjunto_id()` para usuarios aún no completamente backfilled en `tenant_memberships`.
  - deniega lectura anónima/no-JWT y lectura cross-tenant; no reabre `roles {public} USING true`.

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

## 7. tenant_lifecycle
**Descripción:** tabla complementaria 1:1 para lifecycle SaaS, licencia y bloqueo operativo de cada tenant/conjunto. FASE 5.1 la agrega sin modificar `public.conjuntos` ni habilitar CRUD frontend.

### Campos
- `conjunto_id` (uuid, NOT NULL, PK, FK `conjuntos.id`)
- `lifecycle_status` (text, NOT NULL, default: `'onboarding'`, check: `onboarding|active|suspended|archived`)
- `license_status` (text, nullable, default: `'active'`, check: `trial|active|suspended|expired|canceled`)
- `plan_code` (text, nullable, default: `'standard'`, check longitud 2..64)
- `operational_lock` (boolean, NOT NULL, default: `false`)
- `lock_reason` (text, nullable, check longitud 1..280 cuando existe)
- `status_reason` (text, nullable, check longitud 1..280 cuando existe)
- `activated_at` (timestamptz, nullable)
- `suspended_at` (timestamptz, nullable)
- `archived_at` (timestamptz, nullable)
- `created_at` (timestamptz, NOT NULL, default: `now()`)
- `created_by` (uuid, nullable, FK `auth.users.id`)
- `updated_at` (timestamptz, NOT NULL, default: `now()`)
- `updated_by` (uuid, nullable, FK `auth.users.id`)

### Relaciones
- `conjunto_id` → `conjuntos.id` (`ON DELETE CASCADE`)
- `created_by` → `auth.users.id` (`ON DELETE SET NULL`)
- `updated_by` → `auth.users.id` (`ON DELETE SET NULL`)

### Índices
- PK: `conjunto_id`
- índice: `(lifecycle_status)`
- índice parcial: `(license_status) where license_status is not null`

### RLS / permisos
- RLS habilitado y forzado.
- `anon`: sin privilegios directos.
- `authenticated`: solo `SELECT` mediante policy `tenant_lifecycle_select_platform` para `fn_is_platform_superadmin()` o `fn_has_platform_role('platform_ops')`.
- Sin policies `INSERT`, `UPDATE` ni `DELETE` para `authenticated`; usuarios tenant no pueden escribir lifecycle directamente.
- Mutaciones lifecycle expuestas solo por RPC `fn_platform_transition_tenant_lifecycle(uuid, text, text)`, `SECURITY DEFINER`, con `search_path = public, pg_temp`, `EXECUTE` para `authenticated` y `service_role`, y sin `EXECUTE` para `anon`/`public`.
- Helper read-only FASE 5.4.1: `fn_tenant_is_operational(uuid, text)` evalúa `lifecycle_status` y `operational_lock` para operaciones permitidas sin cambiar datos, sin validar identidad/rol del actor y sin `EXECUTE` directo para `authenticated` en esta fase.
- La RPC exige `auth.uid()` y rol plataforma activo `superadmin` o `platform_ops`; cualquier transición hacia `archived` queda limitada a `superadmin`.
- Transiciones permitidas FASE 5.2: `onboarding -> active`, `active -> suspended` y `suspended -> active` para `superadmin` o `platform_ops`; `onboarding -> archived`, `active -> archived` y `suspended -> archived` solo para `superadmin`; `archived` es terminal.
- La razón es obligatoria para suspender, reactivar desde `suspended` y archivar; opcional para activar desde `onboarding`; longitud máxima 280.

### Backfill FASE 5.1
- La migración inserta una fila por cada `public.conjuntos` existente que aún no tenga lifecycle.
- Estado inicial documentado para DEV: `lifecycle_status = 'active'`, `license_status = 'active'`, `plan_code = 'standard'`, `activated_at = now()`.


---

## 8. tenant_lifecycle_events
**Descripción:** bitácora append-only dedicada para auditoría de transiciones lifecycle ejecutadas por la RPC de FASE 5.2. Se crea como tabla separada porque `operational_events.source` solo admite `frontend` o `edge_function`, y forzar `source = 'rpc'` requeriría cambiar el constraint y mezclar semánticas de auditoría operacional con lifecycle SaaS crítico.

### Campos
- `id` (uuid, NOT NULL, PK, default: `gen_random_uuid()`)
- `created_at` (timestamptz, NOT NULL, default: `now()`)
- `conjunto_id` (uuid, NOT NULL, FK `conjuntos.id`)
- `actor_user_id` (uuid, NOT NULL, FK `auth.users.id`)
- `actor_platform_role` (text, NOT NULL, check: `superadmin|platform_ops`)
- `previous_status` (text, NOT NULL, check: `onboarding|active|suspended|archived`)
- `lifecycle_status` (text, NOT NULL, check: `onboarding|active|suspended|archived`)
- `reason` (text, nullable, check longitud 1..280 cuando existe)
- `source` (text, NOT NULL, default: `'rpc'`, check fijo `rpc`)
- `metadata` (jsonb, NOT NULL, default: `{}`, check objeto)

### Relaciones
- `conjunto_id` → `conjuntos.id` (`ON DELETE RESTRICT`)
- `actor_user_id` → `auth.users.id` (`ON DELETE RESTRICT`)

### Índices
- PK: `id`
- índice: `(conjunto_id, created_at desc)`
- índice: `(actor_user_id, created_at desc)`

### RLS / permisos
- RLS habilitado y forzado.
- `anon`: sin privilegios directos.
- `authenticated`: solo `SELECT` mediante policy `tenant_lifecycle_events_select_platform` para `fn_is_platform_superadmin()` o `fn_has_platform_role('platform_ops')`.
- Sin grants `INSERT`, `UPDATE` ni `DELETE` para `authenticated`; la escritura ocurre únicamente dentro de `fn_platform_transition_tenant_lifecycle` en la misma transacción que actualiza `tenant_lifecycle`.
- `service_role`: `ALL` para operación backend controlada.

### RPC relacionada
- `fn_platform_transition_tenant_lifecycle(p_conjunto_id uuid, p_target_status text, p_reason text)` retorna `conjunto_id`, `previous_status`, `lifecycle_status`, `operational_lock`, `updated_at`.
- La RPC registra una fila append-only con actor, rol plataforma efectivo, tenant, estado anterior, estado nuevo, razón, timestamp y metadata técnica sin PII.

---

## 9. incidentes
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
- `registro_visitas_select_admin_conjunto`
  - comando: `SELECT`
  - condición: `superadmin` lee todos los conjuntos; `admin_conjunto`/`contador` con membresía activa en `tenant_memberships` leen registros de visita de su `conjunto_id`; fallback legacy `usuarios_app.rol_id = 'admin'` solo lee su mismo `conjunto_id`.
- `registro_visitas_select_residente_propios`
  - comando: `SELECT`
  - condición: residente autenticado solo lee registros asociados a visitantes propios por `tenant_memberships.residente_id` activo del mismo `conjunto_id`; fallback legacy estricto con `residentes.usuario_id = auth.uid()` y visitante del mismo residente/conjunto.
- `registro_visitas_select_vigilancia_conjunto`
  - comando: `SELECT`
  - condición: `vigilancia`/`vigilante` con membresía activa en `tenant_memberships` o fallback legacy `usuarios_app` lee registros de visita de su mismo `conjunto_id` para operación de portería.
- `registro_visitas_update_vigilancia_admin`
  - comando: `UPDATE`
  - condición: rol `vigilancia` o `admin`

### Permisos / grants
- FASE 3D.36: se revocan privilegios heredados de `anon` sobre `public.registro_visitas` para reducir exposición GraphQL/PostgREST sin modificar `authenticated`, `service_role` ni policies RLS.
- FASE 5.4.2A: las RPC `fn_registrar_ingreso_visita(text, uuid)` y `fn_registrar_salida_visita(uuid, uuid)` revocan `EXECUTE` a `public`/`anon` y mantienen ejecución solo para `authenticated` y `service_role`.
- FASE 5.4.3: la RPC `fn_crear_o_reutilizar_visitante_y_registro(uuid, uuid, uuid, text, text, text, text, text, date)` revoca `EXECUTE` a `public`/`anon` y mantiene ejecución solo para `authenticated` y `service_role`.
- El flujo funcional de residentes, vigilancia, admin de conjunto, QR y realtime debe continuar usando sesión autenticada y controles RLS por `conjunto_id`, `residente_id` y `auth.uid()`.

### RPC operativas FASE 5.4.2A / 5.4.3
- `fn_crear_o_reutilizar_visitante_y_registro(p_conjunto_id uuid, p_residente_id uuid, p_apartamento_id uuid, p_nombre text, p_tipo_documento text, p_documento text, p_tipo_vehiculo text, p_placa text, p_fecha_visita date)` conserva firma y retorno (`visitante_id`, `registro_id`, `qr_code`), valida `auth.uid()`, resuelve el residente real desde `residentes` y exige ownership por `tenant_memberships` activa `role_name='residente'`; si existe cualquier membership para el mismo usuario/residente/tenant/rol, esa tabla es autoridad y solo `status='active'` autoriza. El vínculo legacy `residentes.usuario_id` aplica únicamente cuando no existe esa membership. Rechaza `p_conjunto_id`, `p_residente_id` y `p_apartamento_id` que no correspondan al mismo tenant/residente autenticado. Antes de reutilizar/actualizar `visitantes` o insertar `registro_visitas`, exige `fn_tenant_is_operational(conjunto_id, 'tenant_mutation')`; si el tenant no permite mutaciones falla con `TENANT_OPERATIONAL_LOCKED` sin exponer lifecycle, lock ni PII. La reutilización queda acotada al mismo `conjunto_id` + `residente_id` + tipo/documento validados, y la operación permanece atómica.
- `fn_registrar_ingreso_visita(p_qr_code text, p_vigilante_id uuid)` conserva firma y retorno (`registro_id`, `estado`), pero valida `auth.uid()`, exige que `p_vigilante_id` coincida con la identidad autenticada y autoriza solo actores same-tenant de portería/admin antes de mutar. Resuelve `conjunto_id` desde `registro_visitas` y exige `fn_tenant_is_operational(conjunto_id, 'tenant_mutation')`; si el tenant no permite nuevas mutaciones falla con el código lógico `TENANT_OPERATIONAL_LOCKED` sin exponer datos de lifecycle. Mantiene el fallo de QR inválido/usado y solo ingresa registros `pendiente`.
- `fn_registrar_salida_visita(p_registro_id uuid, p_vigilante_id uuid)` conserva firma y retorno (`registro_id`, `estado`, `hora_salida`), valida `auth.uid()`, exige identidad coincidente con `p_vigilante_id` y autoriza solo actores same-tenant de portería/admin. Resuelve `conjunto_id` desde el registro objetivo y exige `fn_tenant_is_operational(conjunto_id, 'tenant_terminal_close')`; permite cerrar únicamente visitas realmente `ingresado`, rechaza `pendiente`, y repetir salida sobre `salido` retorna la fila existente sin actualizar `hora_salida` ni consultar lifecycle después de validar actor/same-tenant. Según la matriz actual del helper, tenants `suspended` permiten cierre terminal y tenants `archived` bloquean nuevas salidas terminales de registros aún `ingresado`; los retries de registros ya `salido` siguen siendo idempotentes.

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

### Restricciones e índices relevantes
- `reservas_zonas_no_solape`: exclusion constraint GiST sobre `recurso_id` y `tsrange(fecha_inicio, fecha_fin, '[)')` para estados activos (`solicitada`, `aprobada`, `en_curso`). Depende de la extensión `btree_gist`, alojada en `extensions` desde FASE 3D.29 para no mantener objetos de extensión en `public`.

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
- RLS habilitado (`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`).
- `anon`: sin permisos de lectura/escritura.
- `authenticated`: sin permisos de lectura/escritura.
- Policy cerrada `trasteos_deny_client_access` (`FOR ALL TO anon, authenticated`) con `USING (false)` y `WITH CHECK (false)`.
- Objetivo FASE 3D.28: mantener la tabla legacy cerrada y reducir el warning de Supabase Advisor por RLS activo sin policies, sin habilitar flujos funcionales.

---

## 27. usuarios_app
**Descripción:** usuarios internos de la aplicación ligados a auth.

### Campos
- `id` (uuid, PK lógica / visible por relación)
- `nombre` (text, nullable)
- `email` (text, nullable)
- `telefono` (text, nullable)
- `fcm_token` (text, nullable; token de push, no disponible por lectura directa de perfiles ajenos)
- `rol_id` (text, nullable)
- `conjunto_id` (uuid, nullable)

### Relaciones
- `rol_id` → `roles.id`
- `conjunto_id` → `conjuntos.id`

### RLS

- `usuario puede verse`
  - comando: `SELECT`
  - roles: `authenticated`
  - condición: `id = auth.uid()`
  - alcance: cada usuario autenticado solo puede leer su propia fila.

- `usuarios actualizar su info`
  - comando: `UPDATE`
  - condición: `id = auth.uid()`

- Se eliminan las variantes amplias:
  - `lectura usuarios`
  - `usuarios mismo conjunto`

- La consulta de destinatarios administrativos para notificaciones no
  utiliza lectura directa amplia de `usuarios_app`; usa la RPC
  `fn_notification_admin_recipient_ids(uuid)`, que retorna únicamente
  UUID de administradores del tenant autorizado.
- Los consumidores de visitas y pagos tampoco embeben perfiles ajenos:
  usan RPCs con autorización específica y retornos mínimos.

### Grants
- FASE 3D.32 revoca `ALL PRIVILEGES` de `anon` sobre `public.usuarios_app` para reducir exposición GraphQL/PostgREST heredada.
- `authenticated` y `service_role` no se modifican en esta fase porque login/bootstrap/membershipResolver consultan esta tabla con sesión autenticada.

---

## 28. vehiculos
**Descripción:** vehículos asociados a residentes.

### Campos confirmados en extractos
- `residente_id` (uuid, nullable)

### Relaciones
- `residente_id` → `residentes.id`

### RLS
- RLS habilitado (`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`).
- `anon`: sin permisos de lectura/escritura.
- `authenticated`: sin permisos de lectura/escritura.
- Policy cerrada `vehiculos_deny_client_access` (`FOR ALL TO anon, authenticated`) con `USING (false)` y `WITH CHECK (false)`.
- Objetivo FASE 3D.28: mantener la tabla legacy cerrada y reducir el warning de Supabase Advisor por RLS activo sin policies, sin habilitar flujos funcionales.

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
- `visitantes_select_admin_conjunto`
  - comando: `SELECT`
  - condición: `superadmin` lee todos los conjuntos; `admin_conjunto`/`contador` con membresía activa en `tenant_memberships` leen visitantes de su `conjunto_id`; fallback legacy `usuarios_app.rol_id = 'admin'` solo lee su mismo `conjunto_id`.
- `visitantes_select_residente_propios`
  - comando: `SELECT`
  - condición: residente autenticado solo lee visitantes donde `visitantes.residente_id` coincide con su `tenant_memberships.residente_id` activo del mismo `conjunto_id`; fallback legacy estricto con `residentes.usuario_id = auth.uid()`, `residentes.id = visitantes.residente_id` y `residentes.conjunto_id = visitantes.conjunto_id`.
- `visitantes_select_vigilancia_conjunto`
  - comando: `SELECT`
  - condición: `vigilancia`/`vigilante` con membresía activa en `tenant_memberships` o fallback legacy `usuarios_app` lee visitantes de su mismo `conjunto_id` para operación de portería.
- `visitantes_update_propios`
  - comando: `UPDATE`
  - condición: visitante del propio residente

### Permisos / grants
- FASE 3D.36: se revocan privilegios heredados de `anon` sobre `public.visitantes` para reducir exposición GraphQL/PostgREST sin modificar `authenticated`, `service_role` ni policies RLS.
- El flujo funcional de residentes, vigilancia, admin de conjunto, QR y realtime debe continuar usando sesión autenticada y controles RLS por `conjunto_id`, `residente_id` y `auth.uid()`.

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
- tenant_lifecycle
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
- `fn_is_platform_superadmin()`
- `fn_has_platform_role(target_role_name)`
- `fn_tenant_is_operational(p_conjunto_id uuid, p_operation text default 'tenant_mutation')`

## RPCs operativas autorizadas

### `fn_notification_admin_recipient_ids(p_conjunto_id uuid)`

- tipo: RPC read-only `STABLE`, `SECURITY DEFINER`.
- objetivo: resolver destinatarios administrativos para notificaciones
  de pagos y alertas de seguridad sin exponer filas completas de
  `usuarios_app`.
- autorización: requiere sesión autenticada y acceso al tenant mediante
  `fn_has_tenant_access`, superadmin o fallback legacy same-tenant activo.
- retorno: únicamente `user_id uuid` de usuarios con `rol_id = 'admin'`
  y estado activo.
- privacidad: no retorna nombre, email, teléfono, rol, tenant ni
  `fcm_token`.
- permisos: `EXECUTE` para `authenticated` y `service_role`;
  `anon` y `public` sin ejecución.

### `fn_visit_push_recipient(p_registro_id uuid)`

- tipo: RPC read-only `STABLE`, `SECURITY DEFINER`, con `search_path = public, pg_temp`.
- objetivo: resolver exclusivamente el `user_id` y `fcm_token` del residente destinatario de una visita concreta.
- autorización: requiere sesión autenticada y rol operativo same-tenant (`admin_conjunto`/`vigilancia`/`vigilante` activo, o fallback legacy equivalente); valida el tenant desde `registro_visitas` antes de retornar datos.
- privacidad: solo resuelve el residente ligado al registro solicitado mediante `registro_visitas → visitantes → residentes`; no depende de `usuarios_app.conjunto_id`, que es legacy y puede ser nulo, ni permite lectura genérica de perfiles. No retorna nombre, email, teléfono o rol.
- permisos: `EXECUTE` para `authenticated` y `service_role`; `anon` y `public` sin ejecución.

### `fn_payment_related_user_profiles(p_pago_ids uuid[])`

- tipo: RPC read-only `STABLE`, `SECURITY DEFINER`, con `search_path = public, pg_temp`.
- objetivo: resolver únicamente `user_id` y `nombre` de los residentes y actores vinculados a los pagos solicitados.
- autorización: requiere sesión autenticada; cada `pago_id` solicitado debe existir y pertenecer a un tenant autorizado para `superadmin`, membresía activa `admin_conjunto`/`contador`, o fallback legacy admin del mismo tenant. Un residente autenticado también puede solicitar el lookup únicamente cuando **todos** los pagos pertenecen a su propio `residente_id` (por membresía activa o relación legacy directa).
- privacidad: retorna solo perfiles asociados a `pagos.residente_id` o `pagos_eventos.usuario_id` de los pagos autorizados; no habilita lectura same-tenant genérica de `usuarios_app`.
- permisos: `EXECUTE` para `authenticated` y `service_role`; `anon` y `public` sin ejecución.

### `fn_reservation_related_user_profiles(p_reserva_ids uuid[])`

- tipo: RPC read-only `STABLE`, `SECURITY DEFINER`, con `search_path = public, pg_temp`.
- objetivo: resolver exclusivamente `user_id` y `nombre` del residente asociado a reservas concretas, para no embeber `residentes ( usuarios_app ( nombre ) )` en consultas REST.
- autorización: requiere sesión autenticada y valida **cada** reserva solicitada. Permite superadmin, roles operativos activos del mismo tenant (`admin_conjunto`, `contador`, `vigilancia`/`vigilante`) o fallback legacy equivalente; un residente solo puede solicitar sus propias reservas mediante `residente_id` coincidente.
- privacidad: no habilita lectura genérica de `usuarios_app`, no retorna email, teléfono, rol, token, tenant ni perfiles de reservas fuera del conjunto o residente autorizado.
- permisos: `EXECUTE` para `authenticated` y `service_role`; `anon` y `public` sin ejecución.

### `fn_crear_o_reutilizar_visitante_y_registro(p_conjunto_id uuid, p_residente_id uuid, p_apartamento_id uuid, p_nombre text, p_tipo_documento text, p_documento text, p_tipo_vehiculo text, p_placa text, p_fecha_visita date)`
- tipo: RPC `SECURITY DEFINER` FASE 5.4.3 para crear/reutilizar visitante y crear el registro de visita de forma atómica.
- retorno: `TABLE(visitante_id uuid, registro_id uuid, qr_code text)` sin cambios de shape para el frontend.
- `search_path`: `public, pg_temp`; no incluye `auth` y usa `auth.uid()` explícito.
- autorización: requiere sesión autenticada; valida que el actor sea el residente indicado por membresía activa `tenant_memberships.role_name='residente'` y que `p_conjunto_id` corresponda al tenant real del residente. Si existe cualquier membership para el mismo usuario/residente/tenant/rol, `tenant_memberships` prevalece y solo `status='active'` autoriza. El fallback legacy `residentes.usuario_id` solo aplica cuando no existe esa membership.
- validación de apartamento: si `p_apartamento_id` no es nulo, debe coincidir con `residentes.apartamento_id` y pertenecer al mismo `conjunto_id`.
- lifecycle: antes de cualquier escritura invoca `fn_tenant_is_operational(conjunto_id, 'tenant_mutation')`; si retorna falso falla con `TENANT_OPERATIONAL_LOCKED` fail-closed y sin exponer detalles de lifecycle.
- reutilización: limitada a visitante del mismo `conjunto_id`, `residente_id`, `tipo_documento` y `documento` validados.
- permisos: `EXECUTE` solo para `authenticated` y `service_role`; `public`/`anon` sin ejecución directa.

### `fn_tenant_is_operational(p_conjunto_id uuid, p_operation text default 'tenant_mutation')`
- tipo: helper read-only `STABLE` FASE 5.4.1 para validación operativa centralizada por lifecycle SaaS de tenant.
- `search_path`: `public, pg_temp`.
- seguridad: `SECURITY INVOKER` para no elevar privilegios ni permitir inferencia directa de lifecycle por clientes autenticados; no retorna filas ni datos lifecycle, solo booleano.
- alcance de autorización: no valida identidad ni rol del actor; la autorización continúa en RLS/RPC llamante con `auth.uid()`, `conjunto_id`, `residente_id` y roles existentes.
- operaciones reconocidas: `tenant_read`, `tenant_mutation`, `tenant_terminal_close`, `tenant_onboarding_config`, `platform_read`.
- errores controlados: `p_conjunto_id` nulo, `p_operation` nula/vacía u operación no reconocida fallan con excepción.
- ausencia de lifecycle: retorna `false` para operaciones tenant y `true` para `platform_read`; no asume `active`.
- matriz: `active` permite `tenant_read`, `tenant_terminal_close`, `platform_read` y `tenant_mutation` solo sin `operational_lock`; `onboarding` permite `tenant_read`, `platform_read` y `tenant_onboarding_config` solo sin `operational_lock`; `suspended` permite `tenant_read`, `tenant_terminal_close` y `platform_read`; `archived` solo permite `platform_read`.
- permisos: `EXECUTE` solo para `service_role`; `anon`/`public`/`authenticated` sin ejecución directa. No concede acceso directo adicional sobre `tenant_lifecycle` y no registra auditoría por ser evaluación read-only.

### `fn_platform_transition_tenant_lifecycle(p_conjunto_id uuid, p_target_status text, p_reason text)`
- tipo: RPC `SECURITY DEFINER` para mutaciones controladas de lifecycle SaaS de tenants.
- `search_path`: `public, pg_temp`.
- autorización: requiere sesión autenticada y rol plataforma activo `superadmin` (`fn_is_platform_superadmin()`) o `platform_ops` (`fn_has_platform_role('platform_ops')`); cualquier transición hacia `archived` requiere `superadmin`.
- permisos: `EXECUTE` para `authenticated` y `service_role`; `anon`/`public` sin ejecución directa.
- retorno: `conjunto_id`, `previous_status`, `lifecycle_status`, `operational_lock`, `updated_at`.
- auditoría: inserta en `tenant_lifecycle_events` en la misma transacción, sin PII y con `source = 'rpc'`.

### `fn_platform_dashboard_metrics()`
- tipo: RPC `SECURITY DEFINER` para Dashboard plataforma MVP read-only.
- autorización: requiere sesión autenticada y rol plataforma activo `superadmin` (`fn_is_platform_superadmin()`) o `platform_ops` (`fn_has_platform_role('platform_ops')`).
- retorno: una fila con contadores globales agregados `conjuntos`, `usuarios_app`, `tenant_memberships_active`, `platform_memberships_active`, `residentes`, `visitas_30d`, `paquetes_pendientes`, `pagos_pendientes`, `incidentes_abiertos`.
- privacidad: no retorna documentos, placas, comprobantes, emails, teléfonos ni PII detallada; solo métricas agregadas para operación SaaS multi-conjunto.
- permisos: `EXECUTE` para `authenticated` y `service_role`; `anon`/`public` sin ejecución directa. El frontend debe invocarla con la sesión autenticada del usuario plataforma, nunca con `service_role`.

### `fn_platform_tenants_summary()`
- tipo: RPC `SECURITY DEFINER` para Gestión de conjuntos / tenants read-only.
- autorización: requiere sesión autenticada y rol plataforma activo `superadmin` (`fn_is_platform_superadmin()`) o `platform_ops` (`fn_has_platform_role('platform_ops')`).
- retorno: una fila por conjunto con campos seguros `conjunto_id`, `nombre`, `ciudad`, `direccion`, `created_at` y contadores agregados `usuarios`, `residentes`, `visitas_30d`, `paquetes_pendientes`, `pagos_pendientes`.
- privacidad: no retorna documentos, placas, comprobantes, emails, teléfonos ni PII detallada; solo identificación básica del tenant y métricas operativas agregadas por conjunto.
- permisos: `EXECUTE` para `authenticated` y `service_role`; `anon`/`public` sin ejecución directa. El frontend debe invocarla con la sesión autenticada del usuario plataforma, nunca con `service_role`.

### `fn_platform_tenants_lifecycle_summary()`
- tipo: RPC `SECURITY DEFINER` read-only complementaria para Backoffice Superadmin FASE 5.3.
- motivo: exponer lifecycle SaaS sin cambiar la firma de `fn_platform_tenants_summary()` ni romper consumidores existentes.
- autorización: requiere sesión autenticada y rol plataforma activo `superadmin` (`fn_is_platform_superadmin()`) o `platform_ops` (`fn_has_platform_role('platform_ops')`).
- retorno: una fila por `tenant_lifecycle` con `conjunto_id`, `lifecycle_status`, `license_status`, `plan_code`, `operational_lock`, `lock_reason`, `status_reason`, `activated_at`, `suspended_at`, `archived_at`, `updated_at`.
- privacidad: no retorna `actor_user_id`, `created_by`, `updated_by`, metadata de auditoría ni eventos lifecycle; las razones se exponen como campos operativos acotados por constraints de 280 caracteres.
- permisos: `EXECUTE` para `authenticated` y `service_role`; `anon`/`public` sin ejecución directa. El frontend debe invocarla con la sesión autenticada del usuario plataforma, nunca con `service_role`.

### `fn_platform_memberships_summary()`
- tipo: RPC `SECURITY DEFINER` para Usuarios/Memberships Superadmin read-only.
- autorización: requiere sesión autenticada y rol plataforma activo `superadmin` (`fn_is_platform_superadmin()`) o `platform_ops` (`fn_has_platform_role('platform_ops')`).
- retorno: una fila por membership plataforma o tenant con campos seguros `membership_scope`, `membership_id`, `user_id`, `email`, `conjunto_id`, `conjunto_nombre`, `role_name`, `status`, `created_at`, `updated_at`, `revoked_at`.
- privacidad: retorna email como identificador mínimo operativo cuando es necesario, pero no retorna teléfonos, documentos, placas, comprobantes, direcciones residenciales ni PII adicional.
- permisos: `EXECUTE` para `authenticated` y `service_role`; `anon`/`public` sin ejecución directa. El frontend debe invocarla con la sesión autenticada del usuario plataforma, nunca con `service_role`.

### `fn_platform_operations_summary()`
- tipo: RPC `SECURITY DEFINER` para Operación Superadmin read-only.
- autorización: requiere sesión autenticada y rol plataforma activo `superadmin` (`fn_is_platform_superadmin()`) o `platform_ops` (`fn_has_platform_role('platform_ops')`).
- retorno: filas agregadas por `domain` (`visitas`, `paquetes`, `pagos`, `incidentes`) y `estado`, con contadores `total`, `total_30d` y `open_total`. En `pagos`, el `estado` es financiero efectivo: `pendiente`/`rechazado` con `fecha_vencimiento < now()` se agrupa como `vencido`, porque no existe job automático que normalice ese estado en DB.
- privacidad: no retorna registros individuales, personas, documentos, placas, comprobantes, teléfonos, descripciones, notas ni PII detallada; solo señales operativas agregadas cross-tenant.
- permisos: `EXECUTE` para `authenticated` y `service_role`; `anon`/`public` sin ejecución directa. El frontend debe invocarla con la sesión autenticada del usuario plataforma, nunca con `service_role`.


### `fn_platform_audit_summary()`
- tipo: RPC `SECURITY DEFINER` para Auditoría Superadmin read-only.
- autorización: requiere sesión autenticada y rol plataforma activo `superadmin` (`fn_is_platform_superadmin()`) o `platform_ops` (`fn_has_platform_role('platform_ops')`).
- retorno: filas agregadas por `source` (`operational_events`, `pagos_eventos`, `reservas_eventos`, `notificaciones`, `incidentes`), `dimension` (`fuente`, `tipo`, `estado`, `severidad`, `evento`, `accion`, `nivel`) y `value`, con contadores `total` y `total_30d`.
- privacidad: no retorna eventos individuales, metadata, mensajes, errores, títulos, detalles, usuarios, documentos, placas, teléfonos, comprobantes, URLs ni PII; además sanitiza/bucketiza labels antes de agruparlos y cualquier valor fuera de whitelist se devuelve como `otro`. Solo expone señales agregadas cross-tenant.
- permisos: `EXECUTE` para `authenticated` y `service_role`; `anon`/`public` sin ejecución directa. El frontend debe invocarla con la sesión autenticada del usuario plataforma, nunca con `service_role`.

## Tablas con políticas visibles
- accesos
- archivos
- comunicados
- config_pagos
- incidentes
- multas
- notificaciones
- operational_events
- tenant_lifecycle
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
- trasteos
- tipos_documento
- usuarios_app
- vehiculos
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
- Policy cerrada `operational_events_deny_client_access` (`FOR ALL TO anon, authenticated`) con `USING (false)` y `WITH CHECK (false)`.
- Inserción prevista únicamente vía Edge Function con `service_role`; no se habilita acceso directo desde clientes.
- Objetivo FASE 3D.28: reducir el warning de Supabase Advisor por RLS activo sin policies manteniendo la tabla cerrada para roles cliente.

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

### Permisos / grants
- FASE 3D.34: se revocan privilegios heredados de `anon` sobre `public.platform_memberships` para reducir exposición GraphQL/PostgREST sin modificar `authenticated`, `service_role` ni policies RLS.
- La operación plataforma/superadmin debe continuar usando sesión autenticada con membership plataforma activa o backend autorizado con `service_role`, nunca grants directos de `anon`.

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
- SELECT: `superadmin` y `platform_ops` pueden leer memberships requeridos para operación plataforma; `admin_conjunto` y `contador` con membresía activa leen memberships de su mismo `conjunto_id`; `residente` solo lee su propia fila activa (`user_id = auth.uid()`, `role_name = 'residente'`, `status = 'active'`); `vigilancia`/`vigilante` no tiene necesidad funcional de inventariar roles internos y queda limitado a self-read activo.
- INSERT/UPDATE: `superadmin` o rol plataforma autorizado (`platform_ops`).
- DELETE: denegado por política.

### Permisos / grants
- FASE 3D.34: se revocan privilegios heredados de `anon` sobre `public.tenant_memberships` para reducir exposición GraphQL/PostgREST sin modificar `authenticated`, `service_role` ni policies RLS.
- `membershipResolver`, login y bootstrap deben consultar esta tabla únicamente con sesión autenticada; el flujo anónimo no requiere acceso directo a memberships.
