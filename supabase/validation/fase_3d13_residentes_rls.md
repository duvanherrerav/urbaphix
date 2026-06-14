# FASE 3D.13 — Validación RLS `residentes`

## Cambio esperado

La migración `20260614130000_fase_3d13_residentes_select_rls_propietario.sql` reemplaza las policies de lectura amplia por conjunto sobre `public.residentes` y separa dos rutas de lectura:

1. `residentes_select_admin_conjunto`: permite lectura por `conjunto_id` a `superadmin`, memberships activas `admin_conjunto`/`contador`, o admin legacy (`usuarios_app.rol_id = 'admin'`) del mismo conjunto.
2. `residentes_select_residente_propio`: permite al rol residente leer únicamente su propia fila si existe una membership activa `tenant_memberships.user_id = auth.uid()`, `tenant_memberships.residente_id = residentes.id`, `tenant_memberships.status = 'active'`, `tenant_memberships.role_name = 'residente'`; o por fallback legacy directo `residentes.usuario_id = auth.uid()`.

No se mantiene lectura amplia para `vigilancia`/`vigilante` sobre `residentes`, porque no hay una policy previa funcionalmente necesaria que justifique exponer el directorio completo de residentes a portería.

## Precheck recomendado

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'residentes'
order by policyname;
```

Antes de aplicar la migración deben existir policies legacy o vigentes equivalentes a `residentes_select_conjunto`, `residentes multi conjunto` o `residentes_select_same_conjunto` que permiten lectura por mismo conjunto. Después de aplicar la migración solo deben quedar las policies de SELECT `residentes_select_admin_conjunto` y `residentes_select_residente_propio`, además de las policies de escritura existentes que no forman parte de este fix.

## Validaciones REST mínimas en DEV

Usar tokens reales de DEV y la anon key del proyecto. Reemplazar `<SUPABASE_URL>`, `<ANON_KEY>`, `<TOKEN_RESIDENTE_DEV>` y `<TOKEN_ADMIN_DEV>`.

### R2 negativo — residente no puede leer otra fila del mismo conjunto

```bash
curl -i \
  '<SUPABASE_URL>/rest/v1/residentes?select=id,usuario_id,conjunto_id&id=eq.11111111-3d10-4000-8000-000000000013' \
  -H 'apikey: <ANON_KEY>' \
  -H 'Authorization: Bearer <TOKEN_RESIDENTE_DEV>'
```

Esperado: `200 []` o `403`. No debe retornar la fila objetivo.

### Positivo residente — residente puede leer su propia fila

```bash
curl -i \
  '<SUPABASE_URL>/rest/v1/residentes?select=id,usuario_id,conjunto_id&id=eq.546c423c-1fa0-4750-b01c-0c24ad89b801' \
  -H 'apikey: <ANON_KEY>' \
  -H 'Authorization: Bearer <TOKEN_RESIDENTE_DEV>'
```

Esperado: `200` con la propia fila. Si el dataset no contiene una relación visible para ese usuario, `200 []` es compatible; no debe ser `401` ni un error inesperado.

### Positivo admin — admin puede leer residentes de su conjunto

```bash
curl -i \
  '<SUPABASE_URL>/rest/v1/residentes?select=id,usuario_id,conjunto_id&conjunto_id=eq.a80af441-80f9-4a6c-8d3b-b8408c97dbe2' \
  -H 'apikey: <ANON_KEY>' \
  -H 'Authorization: Bearer <TOKEN_ADMIN_DEV>'
```

Esperado: `200` con residentes del conjunto DEV.

### Cross-tenant — no se ven residentes de otro conjunto

```bash
curl -i \
  '<SUPABASE_URL>/rest/v1/residentes?select=id,usuario_id,conjunto_id&conjunto_id=eq.11111111-3d10-4000-8000-000000000010' \
  -H 'apikey: <ANON_KEY>' \
  -H 'Authorization: Bearer <TOKEN_RESIDENTE_DEV>'
```

Esperado: `200 []` o `403`.
