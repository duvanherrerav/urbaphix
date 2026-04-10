# Esquema de Base de Datos - Urbaphix

## Descripción general
Urbaphix usa Supabase Postgres y trabaja principalmente sobre el esquema `public`.

Este documento es la fuente de verdad funcional para:
- desarrollo asistido con Codex
- consultas SQL
- integración frontend/backend
- validación de tablas, campos, relaciones y políticas RLS

## Convenciones
- Esquema principal: `public`
- Claves primarias mayoritariamente en `uuid`
- Relaciones mediante llaves foráneas
- Seguridad apoyada en políticas RLS
- No asumir columnas o relaciones fuera de este documento y de `supabase/migrations`

---

# Inventario de tablas

Tablas actuales detectadas en `public`:

- accesos
- apartamentos
- archivos
- comunicados
- config_pagos
- conjuntos
- incidentes
- multas
- notificaciones
- pagos
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

---

# Tablas y campos

## Tabla: accesos
**Descripción:** registro operativo de ingresos/salidas validados por vigilancia.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `visita_id` (uuid, nullable)
- `vigilante_id` (uuid, nullable)
- `fecha_ingreso` (timestamp without time zone, nullable)
- `fecha_salida` (timestamp without time zone, nullable)

### Relaciones
- `vigilante_id` → `usuarios_app.id`

### RLS
- INSERT permitido para usuarios con rol `vigilancia`

---

## Tabla: apartamentos
**Descripción:** unidades residenciales dentro de un conjunto.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
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
- No quedaron políticas visibles en los extractos cargados

---

## Tabla: archivos
**Descripción:** archivos asociados a módulos o referencias internas.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `referencia_id` (uuid, nullable)
- `url` (text, nullable)
- `modulo` (text, nullable)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- No se observó FK explícita en los extractos

### RLS
- SELECT permitido (`archivos por conjunto`) con `qual = true`

---

## Tabla: comunicados
**Descripción:** publicaciones o comunicados del conjunto.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `titulo` (text, nullable)
- `contenido` (text, nullable)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`

### RLS
- SELECT por mismo conjunto
- INSERT para rol `admin`

---

## Tabla: config_pagos
**Descripción:** configuración de recaudo o instrucciones de pago por conjunto.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, NOT NULL)
- `tipo` (text, NOT NULL)
- `url_pago` (text, nullable)
- `instrucciones` (text, nullable)
- `activo` (boolean, nullable, default: `true`)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`

### RLS
- SELECT permitido (`lectura config pagos`)

---

## Tabla: conjuntos
**Descripción:** entidad principal de cada conjunto residencial.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `nombre` (text, NOT NULL)
- `direccion` (text, nullable)
- `ciudad` (text, nullable)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- Tabla padre de múltiples módulos multi-conjunto

### RLS
- No quedaron políticas visibles en los extractos cargados

---

## Tabla: incidentes
**Descripción:** incidentes de seguridad o novedades reportadas.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `reportado_por` (uuid, nullable)
- `nivel` (text, nullable)
- `descripcion` (text, nullable)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `reportado_por` → `usuarios_app.id`

### RLS
- INSERT para rol `vigilancia`
- SELECT por mismo conjunto

---

## Tabla: multas
**Descripción:** multas aplicadas a residentes.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `residente_id` (uuid, nullable)
- `motivo` (text, nullable)
- `valor` (numeric, nullable)
- `estado` (text, nullable, default: `'pendiente'`)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `residente_id` → `residentes.id`

### RLS
- INSERT para rol `admin`
- SELECT por mismo conjunto

---

## Tabla: notificaciones
**Descripción:** notificaciones del sistema dirigidas a usuarios.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `usuario_id` (uuid, nullable)
- `titulo` (text, nullable)
- `mensaje` (text, nullable)
- `tipo` (text, nullable)
- `leido` (boolean, nullable, default: `false`)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `usuario_id` → `usuarios_app.id`

### RLS
- INSERT permitido para usuario autenticado
- SELECT de sus propias notificaciones (`usuario_id = auth.uid()`)

---

## Tabla: pagos
**Descripción:** pagos administrativos u otros conceptos por residente/conjunto.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `residente_id` (uuid, nullable)
- `concepto` (text, nullable)
- `valor` (numeric, nullable)
- `fecha_pago` (date, nullable)
- `estado` (text, nullable)
- `comprobante_url` (text, nullable)
- `tipo_pago` (text, nullable, default: `'administracion'`)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `residente_id` → `residentes.id`

### RLS
- INSERT para admin
- INSERT restringido al mismo conjunto del admin
- SELECT por mismo conjunto
- UPDATE general de comprobante
- UPDATE para admin

---

## Tabla: paquetes
**Descripción:** control de paquetería recibida y entregada.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `apartamento_id` (uuid, nullable)
- `residente_id` (uuid, nullable)
- `recibido_por` (uuid, nullable)
- `descripcion` (text, nullable)
- `estado` (text, nullable, default: `'pendiente'`)
- `fecha_recibido` (timestamp without time zone, nullable, default: `now()`)
- `fecha_entrega` (timestamp without time zone, nullable)
- `created_at` (timestamp without time zone, nullable)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `apartamento_id` → `apartamentos.id`
- `residente_id` → `residentes.id`
- `recibido_por` → `usuarios_app.id`

### RLS
- INSERT para rol `vigilancia`
- SELECT por mismo conjunto
- SELECT para el residente dueño del paquete
- UPDATE para rol `vigilancia`

---

## Tabla: parqueaderos
**Descripción:** parqueaderos del conjunto.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `numero` (text, nullable)
- `tipo` (text, nullable)
- `ocupado` (boolean, nullable, default: `false`)

### Relaciones
- `conjunto_id` → `conjuntos.id`

### RLS
- No quedaron políticas visibles en los extractos cargados

---

## Tabla: pqr
**Descripción:** peticiones, quejas y reclamos generados por residentes.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `residente_id` (uuid, nullable)
- `asunto` (text, nullable)
- `descripcion` (text, nullable)
- `respuesta` (text, nullable)
- `estado` (text, nullable, default: `'abierto'`)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `residente_id` → `residentes.id`

### RLS
- INSERT para rol `residente`
- SELECT solo de PQR del propio residente

---

## Tabla: recursos_comunes
**Descripción:** catálogo operativo de recursos comunes reservables.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, NOT NULL)
- `nombre` (text, NOT NULL)
- `tipo` (text, NOT NULL)
- `descripcion` (text, nullable)
- `capacidad` (integer, nullable)
- `activo` (boolean, NOT NULL, default: `true`)
- `requiere_aprobacion` (boolean, NOT NULL, default: `true`)
- `requiere_deposito` (boolean, NOT NULL, default: `false`)
- `deposito_valor` (numeric, nullable)
- `reglas` (jsonb, NOT NULL, default: `{}`)
- `tiempo_buffer_min` (integer, NOT NULL, default: `0`)
- `created_at` (timestamp without time zone, NOT NULL, default: `now()`)
- `updated_at` (timestamp without time zone, NOT NULL, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`

### RLS
- SELECT por mismo conjunto
- ALL para admin del mismo conjunto mediante `fn_auth_conjunto_id()` y `fn_auth_rol()`

---

## Tabla: registro_visitas
**Descripción:** flujo principal de visitas, validación, QR e ingreso/salida.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `visitante_id` (uuid, NOT NULL)
- `conjunto_id` (uuid, NOT NULL)
- `apartamento_id` (uuid, nullable)
- `validado_por` (uuid, nullable)
- `fecha_visita` (date, NOT NULL)
- `hora_ingreso` (timestamp without time zone, nullable)
- `hora_salida` (timestamp without time zone, nullable)
- `estado` (text, NOT NULL, default: `'pendiente'`)
- `qr_code` (text, NOT NULL)
- `notas` (text, nullable)
- `created_at` (timestamp without time zone, NOT NULL, default: `now()`)
- `updated_at` (timestamp without time zone, NOT NULL, default: `now()`)

### Relaciones
- `visitante_id` → `visitantes.id`
- `conjunto_id` → `conjuntos.id`
- `apartamento_id` → `apartamentos.id`
- `validado_por` → `usuarios_app.id`

### RLS
- INSERT para visitas del propio residente
- SELECT de visitas propias
- SELECT para usuarios del mismo conjunto
- UPDATE para `vigilancia` o `admin`

---

## Tabla: reservas
**Descripción:** módulo de reservas simple asociado a zonas comunes.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `zona_id` (uuid, nullable)
- `residente_id` (uuid, nullable)
- `fecha` (date, nullable)
- `hora_inicio` (time without time zone, nullable)
- `hora_fin` (time without time zone, nullable)
- `estado` (text, nullable, default: `'pendiente'`)

### Relaciones
- `zona_id` → `zonas_comunes.id`
- `residente_id` → `residentes.id`

### RLS
- INSERT para rol `residente`
- SELECT por conjunto a través de `zonas_comunes`

---

## Tabla: reservas_bloqueos
**Descripción:** bloqueos administrativos de recursos comunes por rango de tiempo.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, NOT NULL)
- `recurso_id` (uuid, NOT NULL)
- `creado_por` (uuid, nullable)
- `motivo` (text, NOT NULL)
- `fecha_inicio` (timestamp without time zone, NOT NULL)
- `fecha_fin` (timestamp without time zone, NOT NULL)
- `created_at` (timestamp without time zone, NOT NULL, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `recurso_id` → `recursos_comunes.id`
- `creado_por` → `usuarios_app.id`

### RLS
- SELECT por mismo conjunto
- ALL para admin del mismo conjunto

---

## Tabla: reservas_documentos
**Descripción:** documentos asociados a reservas de zonas.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `reserva_id` (uuid, NOT NULL)
- `conjunto_id` (uuid, NOT NULL)
- `subido_por` (uuid, nullable)
- `nombre_archivo` (text, NOT NULL)
- `ruta_storage` (text, NOT NULL)
- `tipo_documento` (text, nullable)
- `created_at` (timestamp without time zone, NOT NULL, default: `now()`)

### Relaciones
- `reserva_id` → `reservas_zonas.id`
- `conjunto_id` → `conjuntos.id`
- `subido_por` → `usuarios_app.id`

### RLS
- INSERT por mismo conjunto
- SELECT por mismo conjunto

---

## Tabla: reservas_eventos
**Descripción:** bitácora de eventos/acciones de una reserva de zonas.

### Campos
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `reserva_id` (uuid, NOT NULL)
- `conjunto_id` (uuid, NOT NULL)
- `actor_id` (uuid, nullable)
- `accion` (text, NOT NULL)
- `detalle` (text, nullable)
- `metadata` (jsonb, NOT NULL, default: `{}`)
- `created_at` (timestamp without time zone, NOT NULL, default: `now()`)

### Relaciones
- `reserva_id` → `reservas_zonas.id`
- `conjunto_id` → `conjuntos.id`
- `actor_id` → `usuarios_app.id`

### RLS
- INSERT por mismo conjunto
- SELECT por mismo conjunto

---

## Tabla: reservas_zonas
**Descripción:** módulo más robusto de reservas de recursos comunes.

### Campos confirmados
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, NOT NULL)
- `recurso_id` (uuid, NOT NULL)
- `residente_id` (uuid, FK)
- `apartamento_id` (uuid, FK)
- `aprobada_por` (uuid, FK)
- `rechazada_por` (uuid, FK)
- `checkin_por` (uuid, FK)
- `checkout_por` (uuid, FK)
- `estado` (text, NOT NULL, default: `'solicitada'`)
- `tipo_reserva` (text, NOT NULL, default: `'recreativa'`)
- `subtipo` (text, nullable)
- `motivo` (text, nullable)
- `observaciones` (text, nullable)
- `created_at` (timestamp without time zone, NOT NULL, default: `now()`)
- `updated_at` (timestamp without time zone, NOT NULL, default: `now()`)

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
- INSERT para admin o residente del mismo conjunto
- SELECT para admin, vigilancia o residente dueño
- UPDATE para admin, vigilancia o residente dueño

---

## Tabla: residentes
**Descripción:** relación entre usuario app y unidad residencial.

### Campos confirmados
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `usuario_id` (uuid, nullable)
- `conjunto_id` (uuid, nullable)
- `apartamento_id` (uuid, nullable)

### Relaciones
- `usuario_id` → `usuarios_app.id`
- `conjunto_id` → `conjuntos.id`
- `apartamento_id` → `apartamentos.id`

### RLS
- SELECT para admin
- INSERT para admin
- SELECT multi-conjunto
- SELECT mismo conjunto

---

## Tabla: roles
**Descripción:** catálogo de roles de la aplicación.

### Campos confirmados
- `id` (text, PK lógica)
- `nombre` (text, NOT NULL)

### Relaciones
- Referenciada por `usuarios_app.rol_id`

### RLS
- No quedaron políticas visibles en los extractos cargados

---

## Tabla: tipos_documento
**Descripción:** catálogo de tipos de documento.

### Campos confirmados
- `id` (bigint, NOT NULL)
- `codigo` (text, NOT NULL)
- `nombre` (text, NOT NULL)
- `activo` (boolean, NOT NULL, default: `true`)

### Relaciones
- Referenciada por `visitantes.tipo_documento` → `tipos_documento.codigo`

### RLS
- SELECT para usuarios autenticados

---

## Tabla: torres
**Descripción:** torres o bloques por conjunto.

### Campos confirmados
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `nombre` (text, nullable)
- `pisos` (integer, nullable)
- `conjunto_id` (uuid, nullable)
- `created_at` (timestamp without time zone, nullable)

### Relaciones
- `conjunto_id` → `conjuntos.id`

### RLS
- No quedaron políticas visibles en los extractos cargados

---

## Tabla: trasteos
**Descripción:** solicitudes o registros de trasteos.

### Campos confirmados
- `id` (uuid, PK, default: `gen_random_uuid()`)
- `residente_id` (uuid, nullable)
- `conjunto_id` (uuid, nullable)
- `fecha` (date, nullable)
- `estado` (text, nullable, default: `'pendiente'`)

### Relaciones
- `residente_id` → `residentes.id`
- `conjunto_id` → `conjuntos.id`

### RLS
- No quedaron políticas visibles en los extractos cargados

---

## Tabla: usuarios_app
**Descripción:** usuarios de la aplicación asociados a auth y conjunto.

### Campos confirmados en extractos
- `id` (uuid, PK lógica esperada)
- `nombre` (text, nullable)
- `email` (text, nullable)
- `telefono` (text, nullable)
- `rol_id` (text / FK)
- `conjunto_id` (uuid / FK)

### Relaciones
- `rol_id` → `roles.id`
- `conjunto_id` → `conjuntos.id`

### RLS
- SELECT general (`lectura usuarios`)
- SELECT propio (`id = auth.uid()`)
- UPDATE propio (`id = auth.uid()`)

---

## Tabla: vehiculos
**Descripción:** vehículos asociados a residentes.

### Campos confirmados en extractos
- `residente_id` (uuid, FK)

### Relaciones
- `residente_id` → `residentes.id`

### RLS
- No quedaron políticas visibles en los extractos cargados

---

## Tabla: visitantes
**Descripción:** visitantes registrados por residentes o administrados por conjunto.

### Campos confirmados en extractos
- `id` (uuid, PK lógica esperada)
- `residente_id` (uuid, FK)
- `conjunto_id` (uuid, FK)
- `tipo_documento` (text, FK a código)

### Relaciones
- `residente_id` → `residentes.id`
- `conjunto_id` → `conjuntos.id`
- `tipo_documento` → `tipos_documento.codigo`

### RLS
- INSERT propios
- SELECT propios
- SELECT mismo conjunto
- UPDATE propios

---

## Tabla: zonas_comunes
**Descripción:** catálogo simple de zonas comunes.

### Campos confirmados en extractos
- `conjunto_id` (uuid, FK)

### Relaciones
- `conjunto_id` → `conjuntos.id`

### RLS
- La tabla `reservas` la usa para filtrar por conjunto
- No quedaron políticas directas visibles en los extractos cargados

---

# Relaciones clave (resumen)

## Multi-conjunto
Las tablas con relación explícita a `conjuntos` incluyen, entre otras:
- apartamentos
- comunicados
- config_pagos
- incidentes
- multas
- pagos
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

## Usuario / Auth
Las tablas relacionadas con `usuarios_app` incluyen:
- accesos
- incidentes
- notificaciones
- paquetes
- registro_visitas
- reservas_bloqueos
- reservas_documentos
- reservas_eventos
- reservas_zonas
- residentes

## Residente
Las tablas relacionadas con `residentes` incluyen:
- multas
- pagos
- paquetes
- pqr
- reservas
- reservas_zonas
- trasteos
- vehiculos
- visitantes

---

# Resumen de RLS por tabla

## Seguridad basada en rol
Se observan reglas explícitas para:
- `admin`
- `vigilancia`
- `residente`
- `authenticated`
- `public`

## Tablas con políticas visibles en los TXT
- accesos
- archivos
- comunicados
- config_pagos
- incidentes
- multas
- notificaciones
- pagos
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

## Funciones usadas en políticas
Se observan referencias a:
- `auth.uid()`
- `fn_auth_conjunto_id()`
- `fn_auth_rol()`
- `fn_auth_residente_id()`

---

# Reglas para desarrollo con IA / Codex

- No inventar tablas ni columnas.
- No asumir FKs si no están documentadas aquí o en migraciones.
- Antes de cambiar backend, revisar este archivo y `supabase/migrations/`.
- Respetar siempre RLS.
- Cuando se agregue una nueva tabla o columna, actualizar este documento.

---

# Estado actual del documento

Este documento fue construido a partir de:
- listado de tablas
- extracto de campos
- extracto de llaves foráneas
- extracto de políticas RLS

Si en el futuro se requiere una versión 100% exhaustiva, se debe complementar con:
- constraints únicos
- índices
- triggers
- funciones SQL
- columnas faltantes de tablas parcialmente visibles en los TXT