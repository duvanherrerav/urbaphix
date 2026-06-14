# FASE 3D.12 — Validación RLS `pagos`

## Objetivo

Verificar que la lectura de `public.pagos` quede aislada por `residente_id` para usuarios con rol `residente`, sin romper la lectura administrativa por `conjunto_id`.

## Cambio a validar

La policy legacy `pagos multi conjunto` permitía `SELECT` cuando el usuario pertenecía al mismo `conjunto_id`. Esa condición era demasiado amplia para residentes, porque dos residentes del mismo conjunto podían leer pagos entre sí.

La migración `20260614120000_fase_3d12_pagos_select_rls_residente_propios.sql` reemplaza esa lectura por dos policies:

- `pagos_select_residente_propios`: permite a `tenant_memberships.role_name = 'residente'` leer únicamente pagos donde `pagos.residente_id = tenant_memberships.residente_id`, con membresía activa del mismo `conjunto_id`. Como compatibilidad temporal segura para residentes sin backfill completo, también permite el camino legacy propietario directo `residentes.usuario_id = auth.uid()`, `residentes.id = pagos.residente_id` y `residentes.conjunto_id = pagos.conjunto_id`.
- `pagos_select_admin_conjunto`: mantiene lectura por `conjunto_id` para `superadmin`, `admin_conjunto`, `contador` y el rol legacy `usuarios_app.rol_id = 'admin'`.

## Precondiciones

- RLS habilitado en `public.pagos`.
- Usuario residente principal DEV autenticado:
  - Auth user: `b46ab33c-9237-4f43-a010-ff95ca1263a6`
  - Email: `residente.dev@urbaphix.com`
  - Debe tener una fila activa en `tenant_memberships` con `role_name = 'residente'` y su `residente_id` propio, o una relación legacy directa en `residentes.usuario_id` hacia su usuario autenticado.
- Pago negativo existente de otro residente del mismo conjunto:
  - `residente_id = 11111111-3d10-4000-8000-000000000013`
  - `concepto = DEV-RLS-NEGATIVE-PAGO-SAME`

## Checklist REST/PostgREST

Sustituir `$SUPABASE_URL`, `$RESIDENTE_TOKEN` y `$ADMIN_TOKEN` por valores del entorno DEV. Usar la anon key pública del proyecto en `$SUPABASE_ANON_KEY`; no usar `service_role`.

### R1 negativo — residente intenta leer pago de otro residente del mismo conjunto

```bash
curl -i "$SUPABASE_URL/rest/v1/pagos?select=id,conjunto_id,residente_id,concepto&residente_id=eq.11111111-3d10-4000-8000-000000000013" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $RESIDENTE_TOKEN"
```

Resultado esperado: `200 []` o `403`. No debe retornar `DEV-RLS-NEGATIVE-PAGO-SAME`.

### Positivo residente — residente consulta sus propios pagos

```bash
curl -i "$SUPABASE_URL/rest/v1/pagos?select=id,conjunto_id,residente_id,concepto&residente_id=eq.<RESIDENTE_PROPIO_ID>" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $RESIDENTE_TOKEN"
```

Resultado esperado: `200` con cero o más pagos del mismo `residente_id` propio. Si existen pagos DEV del residente principal, deben seguir visibles tanto por la ruta principal `tenant_memberships` como por la ruta legacy propietaria directa cuando aún no exista membresía activa.

### Positivo admin — admin consulta pagos del conjunto

```bash
curl -i "$SUPABASE_URL/rest/v1/pagos?select=id,conjunto_id,residente_id,concepto&conjunto_id=eq.<CONJUNTO_DEV_ID>" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Resultado esperado: `200` con pagos del conjunto DEV, incluyendo pagos de distintos residentes del conjunto cuando existan.

## Evidencia esperada

Registrar para cada prueba:

- Fecha/hora de ejecución.
- Usuario/token usado (sin exponer el token).
- URL consultada.
- Código HTTP.
- Cuerpo de respuesta.

La prueba R1 solo es aceptable si la respuesta no incluye ningún pago con `residente_id = 11111111-3d10-4000-8000-000000000013` cuando se ejecuta con el token del residente principal DEV.
