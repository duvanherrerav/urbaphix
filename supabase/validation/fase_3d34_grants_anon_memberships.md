# FASE 3D.34 — Hardening DEV-first grants anon memberships

## Objetivo

Reducir exposición GraphQL/PostgREST causada por grants heredados del rol `anon` sobre tablas sensibles de membresías, manteniendo intacto el modelo RLS y el acceso autenticado existente.

## Alcance de esta fase

Tablas priorizadas:

- `public.tenant_memberships`
- `public.platform_memberships`

Cambio propuesto:

- Revocar `ALL PRIVILEGES` de `anon` sobre ambas tablas.
- Mantener intactos los grants de `authenticated` y `service_role`.
- Mantener intactas las policies RLS existentes.
- No tocar otras tablas.

## Revisión de consumo frontend/API

### `public.tenant_memberships`

Sí existe consumo frontend directo en `src/services/membershipResolver.js`: el resolver consulta `tenant_memberships` para el `user_id` autenticado, filtra `status = 'active'` y ordena por `created_at` después de contar con usuario/sesión de Supabase.

No se encontró consumo directo desde flujos anónimos. Login y bootstrap primero establecen sesión o reciben el usuario autenticado; luego el resolver usa el cliente con JWT autenticado para consultar membresías.

Conclusión: `anon` no necesita privilegios reales sobre `public.tenant_memberships`. Revocar `anon` no debería romper login, bootstrap ni `membershipResolver` siempre que la consulta siga ocurriendo con sesión autenticada y RLS `TO authenticated`.

### `public.platform_memberships`

No se encontró consumo frontend directo en `src/` mediante `.from('platform_memberships')`. La tabla se usa como fuente de membresía plataforma por helpers/RLS (`fn_is_platform_superadmin`, `fn_has_platform_role`) y por operación futura de superadmin con sesión autenticada o service role según diseño.

Conclusión: `anon` no necesita privilegios reales sobre `public.platform_memberships`. Revocar `anon` mantiene el diseño esperado para futuro superadmin: acceso vía rol autenticado/RLS o backend autorizado, no vía sesión anónima.

## Migración

Archivo:

- `supabase/migrations/20260707130000_fase_3d34_revoke_anon_grants_memberships.sql`

SQL aplicado:

```sql
revoke all privileges on table public.tenant_memberships from anon;
revoke all privileges on table public.platform_memberships from anon;
```

## Pruebas esperadas por rol

> Ejecutar primero en DEV. No promover a QA/producción sin confirmar estas pruebas.

### anon

- `GET /rest/v1/tenant_memberships?select=id&limit=1` con `apikey` anon y sin JWT de usuario debe responder `401`/`403` o error equivalente de permiso denegado; no debe devolver filas.
- `GET /rest/v1/platform_memberships?select=id&limit=1` con `apikey` anon y sin JWT de usuario debe responder `401`/`403` o error equivalente de permiso denegado; no debe devolver filas.
- Introspección/uso GraphQL como `anon` no debe exponer acceso efectivo a `tenant_memberships` ni `platform_memberships`.

### residente

- Login con usuario residente debe seguir funcionando.
- Bootstrap de sesión debe resolver perfil/conjunto.
- `membershipResolver` debe poder consultar `tenant_memberships` con JWT autenticado y aplicar fallback legacy si no hay membresía compatible.
- El residente solo debe ver su propia membership activa según la policy RLS vigente.

### vigilancia

- Login de vigilancia debe seguir funcionando.
- Panel/operación de portería debe resolver usuario, rol y conjunto con sesión autenticada.
- No debe existir necesidad funcional de inventariar roles internos desde `anon`.

### admin_conjunto

- Login de administrador de conjunto debe seguir funcionando.
- Bootstrap debe resolver perfil, rol y conjunto.
- Consultas autenticadas a `tenant_memberships` deben seguir sujetas a RLS por `conjunto_id`.

### contador

- Login de contador debe seguir funcionando.
- Bootstrap debe resolver perfil, rol y conjunto.
- Consultas autenticadas a `tenant_memberships` deben seguir sujetas a RLS por `conjunto_id`.

### futuro superadmin

- No se modifican helpers ni policies de `platform_memberships`/`tenant_memberships`.
- La operación futura debe usar rol `authenticated` con membership plataforma activa o `service_role` en backend autorizado, no grants de `anon`.
- Validar que cualquier consola futura de superadmin no dependa de acceso `anon` a tablas de memberships.

## Criterios de no regresión

- No revocar en lote otras tablas.
- No cambiar policies RLS en esta fase.
- No cambiar grants de `authenticated` ni `service_role`.
- No romper login, bootstrap ni `membershipResolver`.
- No introducir SQL destructivo ni cambios de estructura de datos.
