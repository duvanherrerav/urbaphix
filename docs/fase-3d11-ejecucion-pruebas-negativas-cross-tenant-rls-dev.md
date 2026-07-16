# FASE 3D.11 — Ejecución de pruebas negativas/cross-tenant RLS autenticadas en DEV

## 1. Propósito

Documentar la ejecución controlada de pruebas negativas y cross-tenant de RLS en DEV usando sesiones reales de Supabase Auth. La fase demuestra que las políticas RLS no exponen datos de otro residente ni de otro tenant cuando un usuario autenticado manipula filtros REST.

Esta fase no prepara datos, no cambia estructura y no modifica código funcional. El dataset negativo ya fue preparado y verificado en FASE 3D.10 / 3D.10A.

## 2. Fuentes revisadas antes de definir el plan

- `docs/database-schema.md`: inventario de tablas, columnas, relaciones y políticas RLS documentadas.
- `supabase/migrations/`: validación de existencia histórica de helpers, tablas y políticas relevantes.
- `src/services/`: referencia de consumo frontend de Supabase, sin cambios en esta fase.
- Documentación oficial de Supabase Data API: el acceso REST depende de grants y RLS; RLS determina qué filas ve cada rol autenticado.

## 3. Alcance autorizado

Archivos de evidencia y planificación en:

- `docs/`
- `supabase/validation/`

Fuera de alcance:

- QA, PRD y Vercel.
- Migraciones y estructura de datos.
- Helpers SQL, policies y RLS.
- Frontend funcional y `src/`.
- `.env` y `.env.*`.
- Creación de usuarios Auth o nuevos seeds.

## 4. Identificadores DEV usados por la fase

| Concepto | Valor |
|---|---|
| Conjunto principal DEV | `a80af441-80f9-4a6c-8d3b-b8408c97dbe2` |
| Residente principal DEV | `546c423c-1fa0-4750-b01c-0c24ad89b801` |
| Usuario residente principal DEV | `b46ab33c-9237-4f43-a010-ff95ca1263a6` |
| Usuario vigilancia DEV | `02f64392-d964-4bce-a4e9-a25e56621ef6` |
| Usuario admin conjunto DEV | `565e209b-d7c2-4959-93c1-e2662c925180` |
| Conjunto ajeno negativo | `11111111-3d10-4000-8000-000000000010` |
| Residente ajeno mismo conjunto | `11111111-3d10-4000-8000-000000000013` |
| Residente cross-tenant | `11111111-3d10-4000-8000-000000000023` |

## 5. Método de ejecución seguro

1. Iniciar sesión contra DEV con un usuario real del rol probado.
2. Capturar el access token solo en memoria local del operador; nunca pegarlo en documentación, commits, issues, PRs, logs persistentes ni capturas.
3. Ejecutar requests REST de solo lectura contra `/rest/v1/<tabla>` con filtros manipulados.
4. Registrar únicamente evidencia saneada: endpoint sin headers sensibles, status, cantidad de filas y payload sin datos personales ni secretos.
5. Clasificar cada resultado según la sección 6.
6. Repetir cada caso que devuelva `401` autenticado, porque no cuenta como evidencia RLS.

## 6. Clasificación obligatoria

| Resultado | Criterio |
|---|---|
| `PASS` | Sesión autenticada válida y respuesta `200` sin filas ajenas, array vacío, o `403` por policy. |
| `SETUP_FAIL` | `401` en prueba autenticada, token ausente/vencido, usuario incorrecto, tenant no resuelto o request mal formado. |
| `FAIL P0` | Se expone cualquier fila de otro tenant o residente. |
| `FAIL P1` | Se permite una acción inesperada que no expone datos solo por casualidad. |
| `P2` | Evidencia incompleta o endpoint no validable con el mecanismo actual. |
| `P3` | Mejora documental u observabilidad. |

Regla crítica: `401 Unauthorized` solo puede ser un control sin sesión. En pruebas autenticadas es `SETUP_FAIL`, nunca `PASS`.

## 7. Casos mínimos

### A. Residente principal DEV autenticado

| Caso | Endpoint manipulado | Esperado |
|---|---|---|
| R-01 | `/rest/v1/residentes?select=id,conjunto_id&id=eq.11111111-3d10-4000-8000-000000000013` | No ver residente ajeno del mismo conjunto. |
| R-02 | `/rest/v1/residentes?select=id,conjunto_id&id=eq.11111111-3d10-4000-8000-000000000023` | No ver residente cross-tenant. |
| R-03 | `/rest/v1/pagos?select=id,residente_id&residente_id=eq.11111111-3d10-4000-8000-000000000013` | No ver pagos de otro residente. |
| R-04 | `/rest/v1/pagos?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver pagos de otro tenant. |
| R-05 | `/rest/v1/paquetes?select=id,residente_id&residente_id=eq.11111111-3d10-4000-8000-000000000013` | No ver paquetes de otro residente. |
| R-06 | `/rest/v1/registro_visitas?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver visitas de otro tenant. |
| R-07 | `/rest/v1/reservas_zonas?select=id,residente_id&residente_id=eq.11111111-3d10-4000-8000-000000000013` | No ver reservas de otro residente. |
| R-08 | `/rest/v1/reservas_zonas?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver reservas de otro tenant. |

### B. Vigilancia DEV autenticado

| Caso | Endpoint manipulado | Esperado |
|---|---|---|
| V-01 | `/rest/v1/registro_visitas?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver visitas de otro tenant. |
| V-02 | `/rest/v1/paquetes?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver paquetes de otro tenant. |
| V-03 | `/rest/v1/incidentes?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver incidentes de otro tenant. |
| V-04 | `/rest/v1/reservas_zonas?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver reservas de otro tenant. |
| V-05 | `/rest/v1/usuarios_app?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver usuarios de otro tenant. |

### C. Admin conjunto DEV autenticado

| Caso | Endpoint manipulado | Esperado |
|---|---|---|
| A-01 | `/rest/v1/usuarios_app?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver usuarios de otro tenant. |
| A-02 | `/rest/v1/residentes?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver residentes de otro tenant. |
| A-03 | `/rest/v1/pagos?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver pagos de otro tenant. |
| A-04 | `/rest/v1/paquetes?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver paquetes de otro tenant. |
| A-05 | `/rest/v1/registro_visitas?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver visitas de otro tenant. |
| A-06 | `/rest/v1/incidentes?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver incidentes de otro tenant. |
| A-07 | `/rest/v1/reservas_zonas?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver reservas de otro tenant. |
| A-08 | `/rest/v1/config_pagos?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | No ver configuración de otro tenant. |

## 8. Comandos sugeridos para ejecución manual

Usar variables locales no versionadas. No pegar valores reales en la evidencia.

```bash
export SUPABASE_DEV_REST_URL="https://<project-ref>.supabase.co/rest/v1"
export SUPABASE_DEV_ANON_KEY="<anon-key-local-no-commit>"
export SUPABASE_DEV_ACCESS_TOKEN="<jwt-local-no-commit>"

curl --silent --show-error --fail-with-body \
  --header "apikey: ${SUPABASE_DEV_ANON_KEY}" \
  --header "Authorization: Bearer ${SUPABASE_DEV_ACCESS_TOKEN}" \
  --header "Accept: application/json" \
  "${SUPABASE_DEV_REST_URL}/pagos?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010"
```

## 9. Cierre esperado

Al cerrar la fase, completar la plantilla de evidencia y el checklist. Confirmar explícitamente:

- No se tocó QA.
- No se tocó PRD.
- No se modificó RLS.
- No se modificaron policies.
- No se modificaron helpers SQL.
- No se modificaron migraciones.
- No se modificó frontend funcional.
- No se modificó `src/`.
- No se modificaron `.env` ni `.env.*`.
- No se tocó Vercel.
