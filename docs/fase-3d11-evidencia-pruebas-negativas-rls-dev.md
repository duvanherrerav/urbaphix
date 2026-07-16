# FASE 3D.11 — Plantilla de evidencia de pruebas negativas RLS DEV

## 1. Resumen de ejecución

| Campo | Valor |
|---|---|
| Fecha/hora de inicio | `YYYY-MM-DD HH:mm UTC` |
| Fecha/hora de cierre | `YYYY-MM-DD HH:mm UTC` |
| Ambiente | `DEV` |
| Proyecto Supabase | `polstaxmencetxgctvsw.supabase.co` |
| Operador |  |
| Método | `REST autenticado con JWT real` / `Frontend Network autenticado` |
| Evidencia sensible saneada | `sí` / `no` |
| Resultado global | `PASS` / `PASS con P2` / `NO-GO` |

## 2. Confirmación de sesión autenticada

Completar una fila por rol antes de ejecutar casos negativos.

| Rol | user_id esperado | user_id observado | conjunto_id esperado | residente_id esperado | sesión válida | observaciones |
|---|---|---|---|---|---|---|
| residente | `b46ab33c-9237-4f43-a010-ff95ca1263a6` |  | `a80af441-80f9-4a6c-8d3b-b8408c97dbe2` | `546c423c-1fa0-4750-b01c-0c24ad89b801` | `sí/no` |  |
| vigilancia | `02f64392-d964-4bce-a4e9-a25e56621ef6` |  | `a80af441-80f9-4a6c-8d3b-b8408c97dbe2` | `no aplica` | `sí/no` |  |
| admin | `565e209b-d7c2-4959-93c1-e2662c925180` |  | `a80af441-80f9-4a6c-8d3b-b8408c97dbe2` | `no aplica` | `sí/no` |  |

## 3. Registro por caso

Copiar este bloque por cada request.

### Caso `<ID>` — `<rol>` — `<tabla>`

| Campo | Valor |
|---|---|
| Fecha/hora | `YYYY-MM-DD HH:mm UTC` |
| Ambiente | `DEV` |
| Rol autenticado | `residente` / `vigilancia` / `admin` |
| user_id autenticado |  |
| Endpoint REST o módulo probado | `/rest/v1/<tabla>?<filtros>` |
| Filtro propio esperado |  |
| Filtro ajeno manipulado |  |
| Status code | `200` / `401` / `403` / otro |
| Respuesta saneada sin secretos | `[]` / `{...}` |
| Cantidad de filas devueltas |  |
| ¿Alguna fila corresponde a `DEV-RLS-NEGATIVE`? | `sí/no/no evaluable` |
| Resultado | `PASS` / `FAIL` / `SETUP_FAIL` / `P2` |
| Severidad si falla | `P0` / `P1` / `P2` / `P3` |
| Evidencia adjunta | Captura saneada, curl sin headers sensibles o log controlado |
| Observaciones |  |

## 4. Reglas de saneamiento

No registrar nunca:

- JWT reales, access tokens, refresh tokens o cookies.
- `apikey` real, anon key, service role key o contraseñas.
- Headers `Authorization`, `Cookie`, `Set-Cookie` o equivalentes.
- Emails completos, teléfonos, documentos, placas, URLs privadas o QR.
- Payload completo si incluye datos personales o texto libre sensible.

Permitido registrar:

- Endpoint con host y query sin headers sensibles.
- Status code.
- Array vacío.
- Conteo de filas.
- IDs técnicos ya declarados para DEV en esta fase.
- Marcador booleano de presencia o ausencia de datos ajenos.

## 5. Matriz consolidada

| Caso | Rol | Tabla | Filtro ajeno | Status | Filas | DEV-RLS-NEGATIVE visible | Resultado | Severidad | Observaciones |
|---|---|---|---|---:|---:|---|---|---|---|
| R-01 | residente | residentes | id ajeno mismo conjunto |  |  |  |  |  |  |
| R-02 | residente | residentes | id cross-tenant |  |  |  |  |  |  |
| R-03 | residente | pagos | residente ajeno mismo conjunto |  |  |  |  |  |  |
| R-04 | residente | pagos | conjunto ajeno |  |  |  |  |  |  |
| R-05 | residente | paquetes | residente ajeno mismo conjunto |  |  |  |  |  |  |
| R-06 | residente | registro_visitas | conjunto ajeno |  |  |  |  |  |  |
| R-07 | residente | reservas_zonas | residente ajeno mismo conjunto |  |  |  |  |  |  |
| R-08 | residente | reservas_zonas | conjunto ajeno |  |  |  |  |  |  |
| V-01 | vigilancia | registro_visitas | conjunto ajeno |  |  |  |  |  |  |
| V-02 | vigilancia | paquetes | conjunto ajeno |  |  |  |  |  |  |
| V-03 | vigilancia | incidentes | conjunto ajeno |  |  |  |  |  |  |
| V-04 | vigilancia | reservas_zonas | conjunto ajeno |  |  |  |  |  |  |
| V-05 | vigilancia | usuarios_app | conjunto ajeno |  |  |  |  |  |  |
| A-01 | admin | usuarios_app | conjunto ajeno |  |  |  |  |  |  |
| A-02 | admin | residentes | conjunto ajeno |  |  |  |  |  |  |
| A-03 | admin | pagos | conjunto ajeno |  |  |  |  |  |  |
| A-04 | admin | paquetes | conjunto ajeno |  |  |  |  |  |  |
| A-05 | admin | registro_visitas | conjunto ajeno |  |  |  |  |  |  |
| A-06 | admin | incidentes | conjunto ajeno |  |  |  |  |  |  |
| A-07 | admin | reservas_zonas | conjunto ajeno |  |  |  |  |  |  |
| A-08 | admin | config_pagos | conjunto ajeno |  |  |  |  |  |  |

## 6. Cierre y no impacto

| Confirmación | Estado |
|---|---|
| No se tocó QA |  |
| No se tocó PRD |  |
| No se modificó RLS |  |
| No se modificaron policies |  |
| No se modificaron helpers SQL |  |
| No se modificaron migraciones |  |
| No se modificó frontend funcional |  |
| No se modificó `src/` |  |
| No se modificaron `.env` ni `.env.*` |  |
| No se tocó Vercel |  |
| No se expusieron secretos |  |
