# FASE 3D.9 — Diseño de validación negativa/cross-tenant RLS DEV

## 1. Propósito y alcance

Esta fase prepara la validación negativa/cross-tenant de Row Level Security (RLS) en **Supabase DEV** para Urbaphix. El objetivo es demostrar, de forma controlada y auditable, que las sesiones autenticadas no exponen datos fuera del `conjunto_id` o `residente_id` esperado.

La fase es **solo diseño/preparación read-only**. No declara `GO global` ni marca la validación como ejecutada.

## 2. Ambiente autorizado

| Elemento | Valor |
|---|---|
| App local | `http://localhost:5173` |
| Supabase DEV | `polstaxmencetxgctvsw.supabase.co` |
| Conjunto DEV validado | `a80af441-80f9-4a6c-8d3b-b8408c97dbe2` |
| Admin DEV | `565e209b-d7c2-4959-93c1-e2662c925180` |
| Vigilancia DEV | `02f64392-d964-4bce-a4e9-a25e56621ef6` |
| Residente DEV | `b46ab33c-9237-4f43-a010-ff95ca1263a6` |
| Residente ID DEV | `546c423c-1fa0-4750-b01c-0c24ad89b801` |

## 3. Restricciones obligatorias

- No tocar QA ni PRD.
- No tocar Vercel.
- No modificar frontend funcional ni `src/`.
- No modificar `package.json`, `package-lock.json`, `.env` ni `.env.*`.
- No modificar Supabase estructuralmente.
- No crear migraciones.
- No modificar `supabase/migrations/`.
- No cambiar RLS, helpers ni policies.
- No ejecutar DDL ni DML.
- No insertar, actualizar ni borrar datos.
- No ejecutar pruebas finales dependientes de `auth.uid()` desde SQL Editor como evidencia efectiva autenticada.

## 4. Fuentes de verdad revisadas

Este diseño se basa en las tablas, columnas y políticas documentadas para el esquema `public`:

- `docs/database-schema.md`
- `supabase/migrations/`
- `src/services/`
- módulos existentes que consumen Supabase

No se inventan tablas, columnas ni relaciones. Las pruebas propuestas usan las relaciones documentadas con `conjunto_id`, `residente_id`, `usuario_id` y los helpers `fn_auth_conjunto_id()`, `fn_auth_rol()` y `fn_auth_residente_id()`.

## 5. Evidencia estructural vs evidencia efectiva autenticada

| Tipo | Medio permitido | Qué demuestra | Limitación |
|---|---|---|---|
| Estructural | SQL Editor DEV ejecutando los scripts read-only de `supabase/validation/` | Existencia de datos candidatos, cantidad de tenants/residentes y plan de checks | SQL Editor corre con rol de base de datos privilegiado, no representa una sesión real de usuario autenticado |
| Efectiva autenticada | Frontend local + Network, REST API con JWT real de usuario DEV o simulación explícitamente aprobada | Comportamiento real de RLS para `authenticated` con JWT y claims reales | Requiere tokens/sesiones DEV controladas y saneamiento de capturas |

La evidencia final de RLS debe venir de sesiones autenticadas reales o de una simulación explícitamente aprobada. El SQL Editor solo sirve para preparar y seleccionar candidatos de prueba.

## 6. Datos mínimos necesarios

Antes de ejecutar las pruebas negativas debe confirmarse, con `supabase/validation/fase_3d9_identificar_datos_negativos_dev.sql`, que DEV contiene al menos:

1. Más de un `conjunto_id` en `conjuntos` o en tablas operativas con `conjunto_id`.
2. Más de un residente en `residentes`.
3. Al menos un residente ajeno al residente DEV validado.
4. Candidatos ajenos para los módulos que se van a probar:
   - `pagos`
   - `paquetes`
   - `registro_visitas`
   - `incidentes`
   - `reservas_zonas`
   - `config_pagos`
   - `usuarios_app`

Si no existen datos suficientes, la decisión esperada será `GO condicionado` o `NO-GO` según el nivel de cobertura alcanzable sin seed DEV controlado.

## 7. Matriz de casos negativos por rol

### 7.1 Residente

| Caso | Tabla/endpoint REST | Manipulación | Resultado esperado |
|---|---|---|---|
| R-01 | `residentes` | Consultar `id` o `usuario_id` de otro residente | `200 OK` con array vacío o `403` por policy; nunca datos ajenos |
| R-02 | `pagos` | Filtrar por `residente_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca pagos ajenos |
| R-03 | `paquetes` | Filtrar por `residente_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca paquetes ajenos |
| R-04 | `registro_visitas` | Consultar visitas asociadas a visitante/residente ajeno | `200 OK` con array vacío o `403` por policy; nunca visitas ajenas |
| R-05 | `reservas_zonas` | Filtrar por `residente_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca reservas ajenas |
| R-06 | Tablas con `conjunto_id` | Cambiar filtro al `conjunto_id` de otro tenant | `200 OK` con array vacío o `403` por policy; nunca datos de otro conjunto |

### 7.2 Vigilancia

| Caso | Tabla/endpoint REST | Manipulación | Resultado esperado |
|---|---|---|---|
| V-01 | `registro_visitas` | Filtrar por `conjunto_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca visitas de otro conjunto |
| V-02 | `paquetes` | Filtrar por `conjunto_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca paquetes de otro conjunto |
| V-03 | `incidentes` | Filtrar por `conjunto_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca incidentes de otro conjunto |
| V-04 | `reservas_zonas` | Filtrar por `conjunto_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca reservas de otro conjunto |
| V-05 | `usuarios_app` | Filtrar perfiles fuera de su tenant | `200 OK` con array vacío o `403` por policy; nunca perfiles ajenos |

### 7.3 Admin conjunto

| Caso | Tabla/endpoint REST | Manipulación | Resultado esperado |
|---|---|---|---|
| A-01 | `usuarios_app` | Filtrar por `conjunto_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca usuarios ajenos |
| A-02 | `residentes` | Filtrar por `conjunto_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca residentes ajenos |
| A-03 | `pagos` | Filtrar por `conjunto_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca pagos ajenos |
| A-04 | `paquetes` | Filtrar por `conjunto_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca paquetes ajenos |
| A-05 | `registro_visitas` | Filtrar por `conjunto_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca visitas ajenas |
| A-06 | `incidentes` | Filtrar por `conjunto_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca incidentes ajenos |
| A-07 | `reservas_zonas` | Filtrar por `conjunto_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca reservas ajenas |
| A-08 | `config_pagos` | Filtrar por `conjunto_id` ajeno | `200 OK` con array vacío o `403` por policy; nunca configuración ajena |

## 8. Controles no autenticados vs pruebas negativas autenticadas

### 8.1 Control no autenticado separado

El control `control_no_autenticado_sin_jwt` puede ejecutarse sin JWT para confirmar que un endpoint no permite acceso anónimo. En ese control, `401 Unauthorized` es un resultado esperado porque valida ausencia de sesión, token ausente, token expirado o token inválido.

Este control **no cuenta como evidencia de aislamiento RLS autenticado**, porque no ejercita correctamente `auth.uid()` ni las policies bajo una sesión real de usuario `authenticated`.

### 8.2 Pruebas negativas autenticadas RLS

Toda prueba negativa RLS debe ejecutarse con sesión válida y JWT real del rol DEV correspondiente. Una prueba autenticada pasa solo cuando ocurre uno de estos resultados:

- `200 OK` con array vacío por filtrado correcto de RLS.
- `403 Forbidden` por bloqueo de policy.

En pruebas autenticadas RLS, `401 Unauthorized` debe registrarse como `SETUP_FAIL`, no como `PASS`, porque indica que la sesión/JWT no fue válido y la prueba no validó aislamiento RLS.

Una prueba falla como `FAIL P0` si aparece cualquier dato de otro `tenant` o de otro `residente_id` no autorizado, incluso si el status es `200 OK`.

## 9. Método recomendado de ejecución efectiva

1. Ejecutar `supabase/validation/fase_3d9_identificar_datos_negativos_dev.sql` en SQL Editor DEV para seleccionar candidatos.
2. Ejecutar `supabase/validation/fase_3d9_plan_checks_negativos_rls_dev.sql` en SQL Editor DEV para generar la matriz concreta de endpoints y filtros.
3. Iniciar la app local contra Supabase DEV.
4. Autenticarse con cada rol DEV autorizado.
5. Desde Network o cliente REST con JWT real, repetir los endpoints generados manipulando filtros como `residente_id=eq.<uuid-ajeno>` o `conjunto_id=eq.<uuid-ajeno>`.
6. Registrar la evidencia en `docs/fase-3d9-formato-evidencia-negativa-rls-dev.md`.
7. Sanear respuestas antes de adjuntarlas al PR o al reporte.

## 10. Clasificación de hallazgos

| Severidad | Definición | Acción esperada |
|---|---|---|
| PASS | `200 OK` con array vacío o `403 Forbidden` por policy en una prueba autenticada con JWT válido | Registrar evidencia saneada y continuar |
| SETUP_FAIL | `401 Unauthorized` en una prueba autenticada | Corregir sesión/JWT antes de evaluar aislamiento RLS; no contar como PASS |
| FAIL P0 | Exposición real de datos de otro tenant o residente | Bloquear avance; corregir RLS/policies antes de cualquier GO |
| P2 | No existen datos suficientes en DEV para ejecutar una prueba negativa | Preparar seed DEV controlado o limitar decisión a `GO condicionado` |
| P3 | Mejora documental, trazabilidad u observabilidad | Registrar mejora sin bloquear si no afecta aislamiento |

## 11. Decisión final esperada de la fase

Al terminar la preparación y revisar datos candidatos, documentar una de estas decisiones, sin marcar la validación como ejecutada en esta fase:

- `GO para ejecutar validación negativa/cross-tenant DEV`: existe plan y datos suficientes.
- `GO condicionado`: faltan datos negativos y se requiere seed DEV controlado.
- `NO-GO`: no hay forma segura de validar sin preparar dataset.

## 12. Confirmación de no impacto

Esta fase no modifica Supabase estructuralmente, no cambia RLS/helpers/policies, no crea migraciones, no modifica frontend funcional, no cambia `.env`, no toca QA, no toca PRD y no toca Vercel.
