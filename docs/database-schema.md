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
- No visible en los TXT cargados

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
- No visible en los TXT cargados

---

## 7. incidentes
**Descripción:** incidentes o novedades de seguridad.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `reportado_por` (uuid, nullable)
- `nivel` (text, nullable)
- `descripcion` (text, nullable)
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
**Descripción:** pagos administrativos u otros conceptos.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, nullable)
- `residente_id` (uuid, nullable)
- `concepto` (text, nullable)
- `valor` (numeric, nullable)
- `fecha_pago` (date, nullable)
- `estado` (text, nullable)
- `comprobante_url` (text, nullable)
- `tipo_pago` (text, nullable, default: `'administracion'::text`)
- `created_at` (timestamp without time zone, nullable, default: `now()`)

### Relaciones
- `conjunto_id` → `conjuntos.id`
- `residente_id` → `residentes.id`

### RLS
- `crear pagos admin`
  - comando: `INSERT`
  - condición: usuario admin
- `crear pagos admin conjunto`
  - comando: `INSERT`
  - condición: admin del mismo conjunto
- `pagos multi conjunto`
  - comando: `SELECT`
  - condición: mismo `conjunto_id`
- `update comprobante pagos`
  - comando: `UPDATE`
  - condición: `true`
- `update pagos admin`
  - comando: `UPDATE`
  - condición: rol `admin`

---

## 11. paquetes
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
- `paquetes por conjunto`
  - comando: `SELECT`
  - condición: mismo `conjunto_id`
- `paquetes residente`
  - comando: `SELECT`
  - condición: paquete del residente autenticado
- `update paquetes vigilancia`
  - comando: `UPDATE`
  - condición: rol `vigilancia`

---

## 12. parqueaderos
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

## 13. pqr
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

## 14. recursos_comunes
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
- `created_at` (timestamp without time zone, NOT NULL, default: `now()`)
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

## 15. registro_visitas
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
- `created_at` (timestamp without time zone, NOT NULL, default: `now()`)
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

## 16. reservas
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

## 17. reservas_bloqueos
**Descripción:** bloqueos administrativos de un recurso común por fecha/hora.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
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
- `bloqueos_admin_write`
  - comando: `ALL`
  - condición: mismo conjunto y rol `admin`
- `bloqueos_select_conjunto`
  - comando: `SELECT`
  - condición: mismo conjunto

---

## 18. reservas_documentos
**Descripción:** documentos anexos a una reserva de zonas.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
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
- `docs_insert_conjunto`
  - comando: `INSERT`
  - condición: mismo conjunto
- `docs_select_conjunto`
  - comando: `SELECT`
  - condición: mismo conjunto

---

## 19. reservas_eventos
**Descripción:** bitácora de eventos de reservas.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `reserva_id` (uuid, NOT NULL)
- `conjunto_id` (uuid, NOT NULL)
- `actor_id` (uuid, nullable)
- `accion` (text, NOT NULL)
- `detalle` (text, nullable)
- `metadata` (jsonb, NOT NULL, default: `'{}'::jsonb`)
- `created_at` (timestamp without time zone, NOT NULL, default: `now()`)

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

## 20. reservas_zonas
**Descripción:** módulo robusto de reservas de recursos comunes.

### Campos
- `id` (uuid, NOT NULL, default: `gen_random_uuid()`)
- `conjunto_id` (uuid, NOT NULL)
- `recurso_id` (uuid, NOT NULL)
- `residente_id` (uuid, NOT NULL)
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
- `reservas_insert_residente_admin`
  - comando: `INSERT`
  - condición: admin del mismo conjunto o residente dueño
- `reservas_select_admin_vigilancia_residente`
  - comando: `SELECT`
  - condición: admin, vigilancia o residente dueño del mismo conjunto

---

## 21. residentes
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
- `residentes multi conjunto`
  - comando: `SELECT`
  - condición: mismo `conjunto_id`
- `residentes_select_same_conjunto`
  - comando: `SELECT`
  - condición: mismo conjunto por relación con `usuarios_app`

---

## 22. roles
**Descripción:** catálogo de roles de aplicación.

### Campos
- `id` (text, NOT NULL)
- `nombre` (text, NOT NULL)

### Relaciones
- `usuarios_app.rol_id` → `roles.id`

### RLS
- No visible en los TXT cargados

---

## 23. tipos_documento
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

## 24. torres
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
- No visible en los TXT cargados

---

## 25. trasteos
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

## 26. usuarios_app
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

## 27. vehiculos
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

## 28. visitantes
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

## 29. zonas_comunes
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
- paquetes
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
