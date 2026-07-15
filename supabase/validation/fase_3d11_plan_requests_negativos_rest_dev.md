# FASE 3D.11 — Plan de requests negativos REST autenticados DEV

Este archivo es una plantilla de ejecución manual de solo lectura. No contiene secretos ni comandos SQL. Los tokens se deben mantener fuera del repositorio.

## Variables locales no versionadas

```bash
export SUPABASE_DEV_REST_URL="https://<project-ref>.supabase.co/rest/v1"
export SUPABASE_DEV_ANON_KEY="<anon-key-local-no-commit>"
export SUPABASE_DEV_ACCESS_TOKEN="<jwt-del-usuario-autenticado-local-no-commit>"
```

## Wrapper curl seguro

```bash
curl --silent --show-error --fail-with-body \
  --header "apikey: ${SUPABASE_DEV_ANON_KEY}" \
  --header "Authorization: Bearer ${SUPABASE_DEV_ACCESS_TOKEN}" \
  --header "Accept: application/json" \
  "${SUPABASE_DEV_REST_URL}/<tabla>?select=<columnas>&<filtro>=eq.<valor-ajeno>"
```

Al guardar evidencia, borrar headers, tokens, cookies y datos personales. Registrar solo status, endpoint, conteo y respuesta saneada.

## Residente principal DEV

Sesión esperada: `b46ab33c-9237-4f43-a010-ff95ca1263a6`.

| Caso | Request path | Criterio aceptable |
|---|---|---|
| R-01 | `/residentes?select=id,conjunto_id&id=eq.11111111-3d10-4000-8000-000000000013` | `200` sin filas ajenas o `403`. |
| R-02 | `/residentes?select=id,conjunto_id&id=eq.11111111-3d10-4000-8000-000000000023` | `200` sin filas ajenas o `403`. |
| R-03 | `/pagos?select=id,residente_id&residente_id=eq.11111111-3d10-4000-8000-000000000013` | `200` sin filas ajenas o `403`. |
| R-04 | `/pagos?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| R-05 | `/paquetes?select=id,residente_id&residente_id=eq.11111111-3d10-4000-8000-000000000013` | `200` sin filas ajenas o `403`. |
| R-06 | `/registro_visitas?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| R-07 | `/reservas_zonas?select=id,residente_id&residente_id=eq.11111111-3d10-4000-8000-000000000013` | `200` sin filas ajenas o `403`. |
| R-08 | `/reservas_zonas?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |

## Vigilancia DEV

Sesión esperada: `02f64392-d964-4bce-a4e9-a25e56621ef6`.

| Caso | Request path | Criterio aceptable |
|---|---|---|
| V-01 | `/registro_visitas?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| V-02 | `/paquetes?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| V-03 | `/incidentes?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| V-04 | `/reservas_zonas?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| V-05 | `/usuarios_app?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |

## Admin conjunto DEV

Sesión esperada: `565e209b-d7c2-4959-93c1-e2662c925180`.

| Caso | Request path | Criterio aceptable |
|---|---|---|
| A-01 | `/usuarios_app?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| A-02 | `/residentes?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| A-03 | `/pagos?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| A-04 | `/paquetes?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| A-05 | `/registro_visitas?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| A-06 | `/incidentes?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| A-07 | `/reservas_zonas?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |
| A-08 | `/config_pagos?select=id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `200` sin filas ajenas o `403`. |

## Control no autenticado separado

Un request sin `Authorization` puede devolver `401` y sirve solo como control anónimo. No cuenta como evidencia RLS autenticada.
