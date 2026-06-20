# FASE 3D.18 — Auditoría RLS de tablas de identidad y memberships

## Alcance y fuentes revisadas

Auditoría documental + plan REST para `usuarios_app`, `tenant_memberships` y `platform_memberships` en DEV. FASE 3D.19 agrega hardening específico para `tenant_memberships_select` después de confirmarse exposición lateral same-tenant para residentes.

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
| `tenant_memberships` | `tenant_memberships_select` | SELECT | FASE 3D.19: `superadmin`/`platform_ops`; `admin_conjunto`/`contador` por mismo `conjunto_id`; `residente` solo self-read activo; `vigilancia`/`vigilante` solo self-read activo. | Corrige exposición lateral same-tenant de memberships para residentes y minimiza lectura de roles internos por vigilancia. |
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
| R3 | Residente DEV | `/rest/v1/tenant_memberships?select=id,user_id,conjunto_id,role_name,residente_id,status&conjunto_id=eq.<conjunto_ajeno>` | Filtro a conjunto ajeno | `200 []` o `403` | FASE 3D.19 esperado post-fix: `[]` o `403`; pendiente ejecución REST DEV con token real | PENDIENTE_POST_FIX |
| R4 | Residente DEV | `/rest/v1/tenant_memberships?select=id,user_id,conjunto_id,role_name,residente_id,status&conjunto_id=eq.<conjunto_propio>` | Filtro mismo conjunto | Solo self-read activo (`user_id = auth.uid()`, `role_name = residente`, `status = active`) | Evidencia recibida: antes del fix devolvió 4 filas same-tenant incluyendo admin/vigilancia/otro residente (**FAIL P1**). FASE 3D.19 esperado post-fix: 1 fila propia | FAIL_P1_CORREGIDO_PENDIENTE_DEV |
| R5a | Residente DEV | `POST /rest/v1/tenant_memberships` | Crear membership propia `admin_conjunto`/`contador`/`vigilante` | `403` o `401 SETUP_FAIL`; nunca inserta | Pendiente de ejecución con token DEV | PENDIENTE |
| R5b | Residente DEV | `PATCH /rest/v1/tenant_memberships?id=eq.<membership_propia>` | Cambiar `role_name` o `status` | `403`/sin filas afectadas; nunca escala | Pendiente de ejecución con token DEV | PENDIENTE |
| R5c | Residente DEV | `DELETE /rest/v1/tenant_memberships?id=eq.<membership_ajena>` | Revocar/eliminar ajena | `403`/sin filas afectadas | Pendiente de ejecución con token DEV | PENDIENTE |
| R6 | Tenant normal DEV | `/rest/v1/platform_memberships?select=id,user_id,role_name,status` | Lectura global plataforma | `200 []` si no tiene fila propia, o solo self-read; nunca roles ajenos | Pendiente de ejecución con token DEV | PENDIENTE |
| R7 | Admin conjunto DEV | `usuarios_app` y `tenant_memberships` filtrando `<conjunto_ajeno>` | Lectura cross-tenant admin | `200 []` o `403` | Pendiente de ejecución con token DEV | PENDIENTE |
| R8 | Vigilancia DEV | `usuarios_app` y `tenant_memberships` mismo conjunto y ajeno | Visibilidad mínima operativa | Sin cross-tenant y sin memberships/roles internos amplios salvo justificación | FASE 3D.19 decisión: vigilancia/vigilante no requiere inventario de memberships; esperado `tenant_memberships` self-read activo o `[]` según exista membership | PENDIENTE_POST_FIX |

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


## FASE 3D.19 — Hardening aplicado a `tenant_memberships_select`

### Decisión de acceso

- `platform_superadmin`: conserva lectura global por operación y auditoría plataforma.
- `platform_ops`: conserva lectura operativa requerida para soporte plataforma, sin ampliar INSERT/UPDATE/DELETE.
- `admin_conjunto`: conserva lectura de memberships de su `conjunto_id` para administración del tenant.
- `contador`: conserva lectura de memberships del `conjunto_id` porque varias políticas 3D.12–3D.16 lo tratan como rol operativo/administrativo de lectura por conjunto.
- `residente`: queda restringido a su propia fila activa, con `user_id = auth.uid()`, `role_name = 'residente'` y `status = 'active'`.
- `vigilancia`/`vigilante`: no tiene necesidad funcional de inventariar roles internos; queda limitado a self-read activo.

### Checklist REST T1–T7 post-fix

> No se adjuntan JWT, cookies, anon keys ni service keys. Ejecutar solo en DEV. No tocar QA/PRD.

| ID | Token | Endpoint / acción | Esperado post-fix | Estado documental |
|---|---|---|---|---|
| T1 | `$TOKEN_RESIDENTE` | `GET /rest/v1/tenant_memberships?select=id,user_id,conjunto_id,role_name,residente_id,status` | `HTTP 200`, 1 fila propia; `user_id = auth.uid()`, `role_name = residente`, `status = active`, `conjunto_id = a80af441-80f9-4a6c-8d3b-b8408c97dbe2` | Pendiente ejecución DEV |
| T2 | `$TOKEN_RESIDENTE` | Misma lectura sin filtro | No devuelve `admin_conjunto`, `vigilante`/`vigilancia`, otro `user_id` ni otro `residente_id` | Pendiente ejecución DEV |
| T3 | `$TOKEN_RESIDENTE` | `GET ...&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `[]` o `403`; nunca filas cross-tenant | Pendiente ejecución DEV |
| T4 | `$TOKEN_ADMIN` | `GET ...&conjunto_id=eq.a80af441-80f9-4a6c-8d3b-b8408c97dbe2` | Admin conserva lectura de memberships de su conjunto | Pendiente ejecución DEV |
| T5 | `$TOKEN_ADMIN` | `GET ...&conjunto_id=eq.11111111-3d10-4000-8000-000000000010` | `[]` o `403`; nunca filas cross-tenant | Pendiente ejecución DEV |
| T6 | Token vigilancia | `GET /rest/v1/tenant_memberships?select=id,user_id,conjunto_id,role_name,residente_id,status` | Solo self-read activo o `[]`; no inventario de roles internos | Pendiente ejecución DEV |
| T7 | `$TOKEN_RESIDENTE` | `POST`, `PATCH role_name/status`, `DELETE` sobre `tenant_memberships` | `403` o sin filas afectadas; sin INSERT/UPDATE/DELETE y sin self-escalation | Pendiente ejecución DEV |

### Confirmaciones

- No se toca QA ni PRD; el cambio es una migración versionada para aplicar por el flujo normal en DEV.
- No se modifica `usuarios_app`, `platform_memberships` ni frontend funcional.
- INSERT/UPDATE siguen restringidos a `superadmin`/`platform_ops` y DELETE sigue denegado, por lo que la corrección no abre self-escalation a residentes.

## Conclusión de fase

FASE 3D.19 crea una migración de hardening para `tenant_memberships_select` porque la evidencia REST confirmó lectura same-tenant de memberships ajenos por residente (**FAIL P1**). Se mantiene pendiente ejecutar la matriz post-fix T1–T7 en DEV con tokens reales saneando la evidencia.

1. `usuarios_app` devuelve cualquier fila a una request anónima/no-JWT con anon key que exponga `email`, `telefono`, `rol_id`, `conjunto_id` o `fcm_token`: **FAIL P0**.
2. `usuarios_app` devuelve filas de otro `conjunto_id` a residente/admin/vigilancia tenant normal: **FAIL P0**.
3. `tenant_memberships` devuelve filas de otro `conjunto_id`: **FAIL P0**.
4. Usuario tenant normal puede insertar/actualizar/eliminar memberships o asignarse roles: **FAIL P0**.
5. `platform_memberships` expone roles plataforma ajenos a tenant normal: **FAIL P0**.
6. Lectura same-tenant expone roles/metadata sensible sin necesidad funcional clara: **FAIL P1**.
