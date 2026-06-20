# FASE 3D.18 — Auditoría RLS de tablas de identidad y memberships

## Alcance y fuentes revisadas

Auditoría documental + plan REST para `usuarios_app`, `tenant_memberships` y `platform_memberships` en DEV. No se modifican migraciones ni policies porque esta fase exige evidencia antes de hardening.

Fuentes validadas en orden requerido:

1. `docs/database-schema.md` como diccionario funcional vigente.
2. `supabase/migrations/20260410031821_remote_schema.sql` para definición/policies legacy de `usuarios_app`.
3. `supabase/migrations/20260528120000_fase_3c1_memberships_rls_base.sql` para definición/helpers/policies de memberships.
4. `src/services/membershipResolver.js` y consumidores frontend que resuelven perfil/membership.

## Inventario SQL requerido

> Ejecutar en DEV con rol autorizado. No incluir resultados con datos de usuarios reales ni secretos en comentarios públicos.

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('usuarios_app', 'tenant_memberships', 'platform_memberships')
order by table_name, ordinal_position;
```

```sql
select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('usuarios_app', 'tenant_memberships', 'platform_memberships')
order by tablename, policyname;
```

## Inventario documental de columnas

| Tabla | Columnas documentadas / migradas | Observación de sensibilidad |
|---|---|---|
| `usuarios_app` | `id`, `conjunto_id`, `rol_id`, `nombre`, `telefono`, `activo`, `created_at`, `email`, `fcm_token` | Alto: identidad, contacto, rol, tenant y token push. |
| `tenant_memberships` | `id`, `user_id`, `conjunto_id`, `role_name`, `residente_id`, `status`, `source_legacy`, `created_at`, `updated_at`, `revoked_at` | Alto: autorización tenant, rol operativo, vínculo residente y estado activo/revocado. |
| `platform_memberships` | `id`, `user_id`, `role_name`, `status`, `granted_by`, `granted_reason`, `created_at`, `updated_at`, `revoked_at` | Alto: roles plataforma/globales e inferencia de superadmin/ops. |

## Inventario documental de RLS actual

| Tabla | Policy | Comando | Regla documental | Riesgo inicial |
|---|---|---:|---|---|
| `usuarios_app` | `lectura usuarios` | SELECT | `true` | **Potencial FAIL P0/P1 si REST confirma lectura cross-tenant o exposición excesiva**. |
| `usuarios_app` | `usuario puede verse` | SELECT | `id = auth.uid()` | Correcta para self-read, pero queda subsumida por `lectura usuarios`. |
| `usuarios_app` | `usuarios actualizar su info` | UPDATE | `id = auth.uid()` | Requiere validar si permite alterar campos sensibles propios (`rol_id`, `conjunto_id`, `activo`, `fcm_token`) desde cliente. |
| `tenant_memberships` | `tenant_memberships_select` | SELECT | `fn_is_platform_superadmin()` o `fn_has_tenant_access(conjunto_id)` | Evita cross-tenant; permite same-tenant a cualquier miembro activo, lo cual puede exponer roles/relaciones internas si REST confirma filas de terceros. |
| `tenant_memberships` | `tenant_memberships_insert` | INSERT | `fn_is_platform_superadmin()` o `fn_has_platform_role('platform_ops')` | No permite self-escalation a usuario tenant normal si helpers están correctos. |
| `tenant_memberships` | `tenant_memberships_update` | UPDATE | `fn_is_platform_superadmin()` o `fn_has_platform_role('platform_ops')` en `USING` y `WITH CHECK` | No permite cambiar `role_name`/`status` a usuario tenant normal si helpers están correctos. |
| `tenant_memberships` | `tenant_memberships_delete_denied` | DELETE | `false` | Deniega deletes cliente. |
| `platform_memberships` | `platform_memberships_select` | SELECT | `user_id = auth.uid()` o `fn_is_platform_superadmin()` | Usuario normal solo debería ver su propia fila; si no tiene fila, `[]`. |
| `platform_memberships` | `platform_memberships_insert` | INSERT | `fn_is_platform_superadmin()` | Sin self-escalation plataforma para tenant normal. |
| `platform_memberships` | `platform_memberships_update` | UPDATE | `fn_is_platform_superadmin()` en `USING` y `WITH CHECK` | Sin self-update plataforma para tenant normal. |
| `platform_memberships` | `platform_memberships_delete_denied` | DELETE | `false` | Deniega deletes cliente. |

## Matriz REST de validación DEV

> Estado de esta PR: matriz preparada para ejecución. No se adjuntan JWT/cookies/keys. Para pruebas autenticadas, un `401` debe registrarse como `SETUP_FAIL`, no como PASS. Para la prueba anónima R0, `401` sí es resultado esperado seguro porque no hay JWT.

| ID | Rol DEV | Endpoint REST | Manipulación | Esperado | Resultado actual | Clasificación |
|---|---|---|---|---|---|---|
| R0 | Anónimo / no-JWT | `/rest/v1/usuarios_app?select=id,conjunto_id,rol_id,email,telefono,activo,fcm_token` | Headers: solo `apikey: <anon key>`, sin `Authorization` Bearer | `401`, `403` o `200 []`; **FAIL P0** si devuelve cualquier fila con `email`, `telefono`, `rol_id`, `conjunto_id` o `fcm_token` | Pendiente de ejecución con anon key DEV, sin JWT | PENDIENTE |
| R1 | Residente DEV | `/rest/v1/usuarios_app?select=id,conjunto_id,rol_id,email,telefono,activo,fcm_token&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | Filtro a conjunto ajeno | `200 []` o `403` | Pendiente de ejecución con token DEV | PENDIENTE |
| R2 | Residente/Admin/Vigilancia DEV | `/rest/v1/usuarios_app?select=id,conjunto_id,rol_id,email,telefono,activo,fcm_token&conjunto_id=eq.<conjunto_propio>` | Filtro mismo conjunto | Solo campos funcionalmente justificados por rol | Pendiente de ejecución con token DEV | PENDIENTE |
| R3 | Residente DEV | `/rest/v1/tenant_memberships?select=id,user_id,conjunto_id,role_name,residente_id,status&conjunto_id=eq.<conjunto_ajeno>` | Filtro a conjunto ajeno | `200 []` o `403` | Pendiente de ejecución con token DEV | PENDIENTE |
| R4 | Residente DEV | `/rest/v1/tenant_memberships?select=id,user_id,conjunto_id,role_name,residente_id,status&conjunto_id=eq.<conjunto_propio>` | Filtro mismo conjunto | Definir si puede ver memberships de terceros; si sí, posible P1 | Pendiente de ejecución con token DEV | PENDIENTE |
| R5a | Residente DEV | `POST /rest/v1/tenant_memberships` | Crear membership propia `admin_conjunto`/`contador`/`vigilante` | `403` o `401 SETUP_FAIL`; nunca inserta | Pendiente de ejecución con token DEV | PENDIENTE |
| R5b | Residente DEV | `PATCH /rest/v1/tenant_memberships?id=eq.<membership_propia>` | Cambiar `role_name` o `status` | `403`/sin filas afectadas; nunca escala | Pendiente de ejecución con token DEV | PENDIENTE |
| R5c | Residente DEV | `DELETE /rest/v1/tenant_memberships?id=eq.<membership_ajena>` | Revocar/eliminar ajena | `403`/sin filas afectadas | Pendiente de ejecución con token DEV | PENDIENTE |
| R6 | Tenant normal DEV | `/rest/v1/platform_memberships?select=id,user_id,role_name,status` | Lectura global plataforma | `200 []` si no tiene fila propia, o solo self-read; nunca roles ajenos | Pendiente de ejecución con token DEV | PENDIENTE |
| R7 | Admin conjunto DEV | `usuarios_app` y `tenant_memberships` filtrando `<conjunto_ajeno>` | Lectura cross-tenant admin | `200 []` o `403` | Pendiente de ejecución con token DEV | PENDIENTE |
| R8 | Vigilancia DEV | `usuarios_app` y `tenant_memberships` mismo conjunto y ajeno | Visibilidad mínima operativa | Sin cross-tenant y sin memberships/roles internos amplios salvo justificación | Pendiente de ejecución con token DEV | PENDIENTE |

## Plantilla de evidencia REST saneada

```md
### R<id> — <nombre>
- Ambiente: DEV
- Rol usado: <residente|vigilancia|admin_conjunto|cross_tenant|superadmin>
- user_id autenticado: `<uuid-saneado>`
- Endpoint: `<método> <ruta sin host ni secrets>`
- Filtro manipulado: `<campo=valor>`
- Status code: `<200|403|401|...>`
- Respuesta saneada: `<[] | objeto con ids/emails/teléfonos/token removidos>`
- Cantidad de filas: `<n>`
- Resultado: `<PASS|FAIL P0|FAIL P1|SETUP_FAIL|NO APLICABLE>`
- Recomendación: `<acción concreta>`
```

## Dictamen preliminar por tabla

### `usuarios_app`

- **Riesgo documental:** alto. La policy `lectura usuarios` con condición `true` contradice el aislamiento esperado por `conjunto_id` y puede exponer `email`, `telefono`, `rol_id`, `activo` y `fcm_token` si REST lo confirma.
- **Dictamen sin REST:** no cerrar como PASS. Requiere ejecutar R0/R1/R2/R7/R8, incluyendo lectura anónima con anon key sin `Authorization` porque la policy legacy `lectura usuarios` fue creada sin `TO` y la tabla tiene grant histórico a `anon`.
- **Fix recomendado solo si REST confirma exposición:** reemplazar la lectura amplia por policies explícitas de self-read y lectura same-tenant por roles operativos justificados, evitando exponer `fcm_token` y datos sensibles a roles no necesarios. Cualquier cambio debe ir en migración separada y actualizar `docs/database-schema.md`.

### `tenant_memberships`

- **Riesgo documental:** medio/alto. Cross-tenant parece protegido por `fn_has_tenant_access(conjunto_id)`, pero same-tenant permite a cualquier miembro activo leer memberships del conjunto; esto puede exponer roles, `residente_id`, `status` y relaciones usuario/residente.
- **Self-escalation documental:** INSERT/UPDATE están restringidos a superadmin/platform_ops; DELETE está denegado. Riesgo bajo salvo bug en helpers o token plataforma indebido.
- **Dictamen sin REST:** no hay evidencia P0; requiere ejecutar R3/R4/R5/R7/R8 para clasificar PASS/P1.

### `platform_memberships`

- **Riesgo documental:** bajo/medio. SELECT permite self-read o superadmin, y writes solo superadmin. Para usuario tenant normal sin membership plataforma debería devolver `[]`.
- **Dictamen sin REST:** no hay evidencia P0; requiere ejecutar R6 y, si existe sesión controlada, superadmin para comprobar lectura administrativa esperada.

## Conclusión de fase

No se crea migración de hardening en esta PR porque todavía no existe evidencia REST adjunta. La ruta segura es ejecutar la matriz anterior en DEV y abrir un PR específico si se confirma cualquiera de estos hallazgos:

1. `usuarios_app` devuelve cualquier fila a una request anónima/no-JWT con anon key que exponga `email`, `telefono`, `rol_id`, `conjunto_id` o `fcm_token`: **FAIL P0**.
2. `usuarios_app` devuelve filas de otro `conjunto_id` a residente/admin/vigilancia tenant normal: **FAIL P0**.
3. `tenant_memberships` devuelve filas de otro `conjunto_id`: **FAIL P0**.
4. Usuario tenant normal puede insertar/actualizar/eliminar memberships o asignarse roles: **FAIL P0**.
5. `platform_memberships` expone roles plataforma ajenos a tenant normal: **FAIL P0**.
6. Lectura same-tenant expone roles/metadata sensible sin necesidad funcional clara: **FAIL P1**.
