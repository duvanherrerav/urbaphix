# FASE 3D.36 — Hardening DEV-first grants anon visitas

## Objetivo

Reducir exposición GraphQL/PostgREST causada por grants heredados del rol `anon` sobre tablas del flujo de visitas, manteniendo intacto el modelo RLS y el acceso funcional autenticado existente.

## Alcance de esta fase

Tablas priorizadas:

- `public.visitantes`
- `public.registro_visitas`

Cambio propuesto:

- Revocar `ALL PRIVILEGES` de `anon` sobre ambas tablas.
- Mantener intactos los grants de `authenticated` y `service_role`.
- Mantener intactas las policies RLS existentes.
- No tocar otras tablas.

## Revisión de consumo frontend/API

### `public.visitantes`

Sí existe consumo frontend directo desde flujos autenticados:

- Residentes crean/consultan visitantes frecuentes desde el módulo de visitas.
- Vigilancia consulta visitantes del conjunto para operación de portería.
- Notificaciones y paneles resuelven datos de visitante asociados a registros de visita.

No se encontró un flujo funcional esperado que requiera consultar `visitantes` como sesión anónima. El acceso esperado debe ocurrir con JWT de usuario autenticado y quedar limitado por RLS según `residente_id`, `conjunto_id`, `auth.uid()` y memberships vigentes.

Conclusión: `anon` no necesita privilegios reales sobre `public.visitantes`. Revocar `anon` no debería romper residentes, vigilancia, admin de conjunto, QR, portería ni realtime siempre que esos flujos operen con sesión autenticada.

### `public.registro_visitas`

Sí existe consumo frontend directo desde flujos autenticados:

- Residentes crean y consultan sus visitas.
- Vigilancia consulta el panel del conjunto y actualiza estados de ingreso/salida.
- Admin de conjunto consulta registros del conjunto.
- QR, notificaciones y realtime observan cambios de `registro_visitas` dentro del contexto autenticado.

No se encontró un flujo funcional esperado que requiera consultar o modificar `registro_visitas` como sesión anónima. Los registros contienen datos operativos sensibles y deben permanecer sujetos a RLS por rol autenticado, conjunto y residente.

Conclusión: `anon` no necesita privilegios reales sobre `public.registro_visitas`. Revocar `anon` mantiene el diseño esperado: acceso por sesión autenticada/RLS o backend autorizado con `service_role`, nunca por grants directos de `anon`.

## Migración

Archivo:

- `supabase/migrations/20260708120000_fase_3d36_revoke_anon_grants_visitas.sql`

SQL aplicado:

```sql
revoke all privileges on table public.visitantes from anon;
revoke all privileges on table public.registro_visitas from anon;
```

## Pruebas esperadas por rol

> Ejecutar primero en DEV. No promover a QA/producción sin confirmar estas pruebas.

### anon

- `GET /rest/v1/visitantes?select=id&limit=1` con `apikey` anon y sin JWT de usuario debe responder `401`/`403` o error equivalente de permiso denegado; no debe devolver filas.
- `GET /rest/v1/registro_visitas?select=id&limit=1` con `apikey` anon y sin JWT de usuario debe responder `401`/`403` o error equivalente de permiso denegado; no debe devolver filas.
- Introspección/uso GraphQL como `anon` no debe exponer acceso efectivo a `visitantes` ni `registro_visitas`.

### residente

- Login con usuario residente debe seguir funcionando.
- Crear visita debe seguir creando/actualizando visitante propio y registro asociado con JWT autenticado.
- Historial/frecuentes debe mostrar únicamente visitantes y registros propios según `residente_id` y `conjunto_id`.
- QR asociado a visita propia debe seguir disponible en contexto autenticado.

### vigilancia

- Login de vigilancia debe seguir funcionando.
- Panel de portería debe listar visitantes/registros del conjunto con sesión autenticada.
- Escaneo/validación QR debe seguir consultando y actualizando registros permitidos por RLS.
- Realtime de `registro_visitas` debe seguir operando para usuarios autenticados autorizados.

### admin_conjunto

- Login de administrador de conjunto debe seguir funcionando.
- Dashboard debe consultar visitantes/registros de su `conjunto_id` con sesión autenticada.
- No debe existir acceso a datos de otros conjuntos.

### futuro superadmin / multi-tenant

- No se modifican helpers, memberships ni policies.
- La operación futura debe usar rol autenticado con autorización multi-tenant/plataforma o backend autorizado con `service_role`, no grants de `anon`.
- Mantener filtros por `conjunto_id`, `residente_id` y `auth.uid()` en cualquier evolución del flujo.

## Criterios de no regresión

- No revocar en lote otras tablas.
- No cambiar policies RLS en esta fase.
- No cambiar grants de `authenticated` ni `service_role`.
- No romper portería, visitas, QR, notificaciones ni realtime.
- No introducir SQL destructivo ni cambios de estructura de datos.
