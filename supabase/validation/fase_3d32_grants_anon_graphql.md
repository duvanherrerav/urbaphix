# FASE 3D.32 — Hardening controlado grants anon GraphQL

## Objetivo

Reducir exposición GraphQL/PostgREST causada por grants heredados del rol `anon` sin hacer revocaciones masivas ni cambiar policies RLS.

## Alcance de esta fase

Tablas priorizadas:

- `public.archivos`
- `public.usuarios_app`

Cambio propuesto:

- Revocar `ALL PRIVILEGES` de `anon` sobre esas dos tablas.
- Mantener intactos los grants de `authenticated` y `service_role`.
- Mantener intactas las policies RLS existentes.

## Revisión de consumo frontend/API

### `public.archivos`

No se encontró consumo directo en `src/` mediante `.from('archivos')` ni referencias operativas equivalentes. La tabla aparece documentada como soporte interno/futuro, pero no como dependencia actual de bootstrap, login, membershipResolver ni módulos del frontend.

Conclusión: `anon` no necesita privilegios reales sobre `public.archivos` en esta fase.

### `public.usuarios_app`

Sí existe consumo frontend directo, pero ocurre después de autenticación:

- `src/App.jsx` carga el perfil legacy con `.from('usuarios_app')` después de tener `auth.uid()`/usuario de Supabase.
- `src/modules/auth/Login.jsx` consulta `rol_id` tras `signInWithPassword` exitoso.
- `src/services/membershipResolver.js` consulta `usuarios_app` como fallback legacy/híbrido del perfil autenticado.
- Módulos operativos de visitas, paquetería, contabilidad y seguridad consultan `usuarios_app` dentro de sesiones autenticadas.

El endpoint de autenticación de Supabase no depende de grants de tabla `anon` sobre `public.usuarios_app`; el acceso a tabla para resolver perfil debe ocurrir con rol `authenticated`.

Conclusión: `anon` no necesita privilegios reales sobre `public.usuarios_app`. Revocar `anon` no debería romper login, bootstrap ni membershipResolver siempre que la sesión autenticada se establezca antes de consultar perfil.

## Migración

Archivo:

- `supabase/migrations/20260707120000_fase_3d32_revoke_anon_grants_archivos_usuarios_app.sql`

SQL aplicado:

```sql
revoke all privileges on table public.archivos from anon;
revoke all privileges on table public.usuarios_app from anon;
```

## Pruebas esperadas por rol

> Ejecutar primero en DEV. No promover a QA/producción sin confirmar estas pruebas.

### anon

- `GET /rest/v1/archivos?select=id&limit=1` con `apikey` anon y sin JWT de usuario debe responder `401`/`403` o error equivalente de permiso denegado; no debe devolver filas.
- `GET /rest/v1/usuarios_app?select=id&limit=1` con `apikey` anon y sin JWT de usuario debe responder `401`/`403` o error equivalente de permiso denegado; no debe devolver filas.
- Introspección/uso GraphQL como `anon` no debe exponer acceso efectivo a `archivos` ni `usuarios_app`.

### residente

- Login con usuario residente debe seguir funcionando.
- Bootstrap de sesión debe resolver perfil/conjunto.
- `membershipResolver` debe poder consultar `usuarios_app` con JWT autenticado.
- Módulos de residente que hacen selects anidados hacia `usuarios_app` deben conservar el comportamiento previo sujeto a RLS.

### vigilancia

- Login de vigilancia debe seguir funcionando.
- Panel/operación de portería debe poder resolver usuario, rol y conjunto.
- Consultas operativas que referencian `usuarios_app` deben conservar el comportamiento previo sujeto a RLS.

### admin_conjunto

- Login de administrador de conjunto debe seguir funcionando.
- Bootstrap debe resolver perfil, rol y conjunto.
- Paneles administrativos que consultan usuarios/residentes/pagos/visitas con referencias a `usuarios_app` deben conservar comportamiento previo sujeto a RLS.

### contador

- Login de contador debe seguir funcionando.
- Bootstrap debe resolver perfil, rol y conjunto.
- Vistas de contabilidad que consultan pagos/residentes con referencias a `usuarios_app` deben conservar comportamiento previo sujeto a RLS.

### futuro superadmin

- No se modifica `platform_memberships`, `tenant_memberships`, helpers ni policies.
- El futuro superadmin debe operar con rol autenticado y/o service role según diseño, no con grants directos de `anon` sobre tablas sensibles.
- Validar que cualquier consola futura de superadmin use sesión autenticada y no dependa de acceso `anon` a `usuarios_app`.

## Criterios de no regresión

- No revocar en lote otras tablas.
- No cambiar policies RLS en esta fase.
- No cambiar grants de `authenticated`.
- No romper login, bootstrap ni membershipResolver.
- No introducir SQL destructivo ni cambios de estructura de datos.
