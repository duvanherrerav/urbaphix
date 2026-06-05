# FASE 3D.7A - Preparación controlada de usuario residente DEV

## 1. Resumen ejecutivo

FASE 3D.7A define un procedimiento operativo, controlado y repetible para preparar un usuario residente completo en Supabase DEV. El objetivo es dejar lista la cadena mínima requerida para ejecutar después FASE 3D.7 de validación efectiva autenticada RLS por rol:

```text
Auth user DEV
  -> public.usuarios_app
  -> public.residentes
  -> public.tenant_memberships
```

Esta fase no ejecuta cambios automáticos desde Codex, no crea usuarios Auth desde código y no modifica RLS, helpers, migraciones, frontend, variables de ambiente ni configuración de despliegue. La preparación real debe hacerla una persona autorizada en el proyecto Supabase DEV, usando los SQL bajo `supabase/validation/` como guías manuales.

## 2. Ambiente autorizado

Ambiente autorizado: **Supabase DEV únicamente**.

Identificador DEV validado para esta fase:

- Conjunto: `Conjunto Desarrollo Urbaphix`.
- `conjunto_id`: `a80af441-80f9-4a6c-8d3b-b8408c97dbe2`.

Antes de operar, la persona responsable debe confirmar visualmente en Supabase Dashboard:

- Project ref / nombre del proyecto corresponde a `urbaphix-dev`.
- La URL abierta pertenece a DEV.
- No hay pestañas del SQL Editor conectadas a QA o PRD.
- El usuario Auth que se va a crear o vincular es de prueba y no contiene datos reales de residentes.

## 3. Prohibición explícita de QA/PRD

Está prohibido usar QA o PRD durante esta fase para:

- Crear usuarios Auth.
- Consultar o preparar residentes.
- Ejecutar diagnóstico, preparación, post-check o rollback.
- Capturar evidencia con tokens, cookies, JWT, llaves o datos reales.

Si se detecta conexión a QA o PRD, la operación debe detenerse y declararse **NO-GO operativo** hasta revisar el incidente.

## 4. Estructura real validada de tablas

La preparación debe usar solo columnas reales. En particular, no existen `torres.numero`, `apartamentos.codigo`, `residentes.nombres` ni `residentes.apellidos`.

### `public.residentes`

| Columna | Tipo / nulabilidad |
| --- | --- |
| `id` | `uuid not null default gen_random_uuid()` |
| `usuario_id` | `uuid null` |
| `es_propietario` | `boolean null` |
| `created_at` | `timestamp without time zone null default now()` |
| `conjunto_id` | `uuid null` |
| `apartamento_id` | `uuid null` |

### `public.usuarios_app`

| Columna | Tipo / nulabilidad |
| --- | --- |
| `id` | `uuid not null` |
| `conjunto_id` | `uuid null` |
| `rol_id` | `text null` |
| `nombre` | `text null` |
| `telefono` | `text null` |
| `activo` | `boolean null default true` |
| `created_at` | `timestamp without time zone null default now()` |
| `email` | `text null` |
| `fcm_token` | `text null` |

### `public.tenant_memberships`

| Columna | Tipo / nulabilidad |
| --- | --- |
| `id` | `uuid not null default gen_random_uuid()` |
| `user_id` | `uuid not null` |
| `conjunto_id` | `uuid not null` |
| `role_name` | `text not null` |
| `residente_id` | `uuid null` |
| `status` | `text not null default 'active'` |
| `source_legacy` | `text not null default 'usuarios_app'` |
| `created_at` | `timestamptz not null default now()` |
| `updated_at` | `timestamptz not null default now()` |
| `revoked_at` | `timestamptz null` |

### `public.apartamentos`

| Columna | Tipo / nulabilidad |
| --- | --- |
| `id` | `uuid not null default gen_random_uuid()` |
| `torre_id` | `uuid null` |
| `conjunto_id` | `uuid null` |
| `numero` | `text null` |
| `piso` | `integer null` |
| `created_at` | `timestamp without time zone null` |
| `tipo_apartamento` | `text null` |

### `public.torres`

| Columna | Tipo / nulabilidad |
| --- | --- |
| `id` | `uuid not null default gen_random_uuid()` |
| `conjunto_id` | `uuid null` |
| `nombre` | `text null` |
| `pisos` | `integer null` |
| `created_at` | `timestamp without time zone null` |

## 5. Problema actual

En DEV no existe todavía un candidato residente completo para la validación RLS autenticada. La ausencia conocida incluye:

- Sin registros en `public.residentes`.
- Sin `usuarios_app` con `rol_id = 'residente'`.
- Sin `tenant_memberships` con `role_name = 'residente'`.
- Sin apartamentos en `public.apartamentos`.

Por eso debe prepararse, como dato DEV mínimo, una cadena controlada:

```text
Torre DEV
  -> Apartamento DEV
  -> Usuario App residente DEV
  -> Residente DEV
  -> Tenant membership residente activa DEV
```

## 6. Flujo recomendado

1. Confirmar que el proyecto abierto es Supabase DEV.
2. Crear el usuario Auth DEV desde Supabase Dashboard:
   - Abrir **Authentication > Users**.
   - Crear un usuario de prueba con email DEV no real.
   - Usar una contraseña temporal gestionada por la persona responsable.
   - No registrar contraseña, JWT, access token, refresh token ni cookies en evidencia.
3. Copiar el `auth.users.id` del usuario Auth DEV.
4. Ejecutar el diagnóstico read-only:
   - `supabase/validation/fase_3d7a_diagnostico_residente_dev.sql`.
5. Diligenciar una copia local del template:
   - `supabase/validation/fase_3d7a_preparacion_residente_dev_template.sql`.
   - Reemplazar placeholders por valores DEV reales.
   - Revisar que `conjunto_id` sea `a80af441-80f9-4a6c-8d3b-b8408c97dbe2`.
6. Ejecutar la preparación solo con autorización humana explícita.
7. Ejecutar el post-check read-only:
   - `supabase/validation/fase_3d7a_postcheck_residente_dev.sql`.
8. Re-ejecutar:
   - `supabase/validation/fase_3d7_identificar_usuarios_prueba_dev.sql`.
9. Continuar FASE 3D.7 si el usuario queda apto.

## 7. Checklist previo

- [ ] Proyecto Supabase DEV confirmado visualmente.
- [ ] QA y PRD cerrados o claramente separados.
- [ ] `conjunto_id` DEV confirmado.
- [ ] Email de prueba definido y no asociado a persona real.
- [ ] Usuario Auth DEV creado desde Dashboard o identificado como candidato existente.
- [ ] `auth.users.id` copiado sin exponer secretos.
- [ ] Diagnóstico read-only ejecutado y archivado como evidencia saneada.
- [ ] No hay duplicados activos conflictivos para el usuario/conjunto/rol.

## 8. Checklist posterior

- [ ] Existe `auth.users.id` DEV para el residente.
- [ ] Existe `public.usuarios_app.id = auth_user_id`.
- [ ] `public.usuarios_app.rol_id = 'residente'`.
- [ ] Existe `public.residentes.usuario_id = auth_user_id`.
- [ ] `public.residentes.conjunto_id` coincide con DEV.
- [ ] Existe `public.tenant_memberships.user_id = auth_user_id`.
- [ ] `public.tenant_memberships.role_name = 'residente'`.
- [ ] `public.tenant_memberships.status = 'active'`.
- [ ] `public.tenant_memberships.conjunto_id` coincide con DEV.
- [ ] `public.tenant_memberships.residente_id` apunta al `public.residentes.id` correcto.
- [ ] No hay memberships activas duplicadas para el mismo usuario/conjunto/rol.
- [ ] `fase_3d7_identificar_usuarios_prueba_dev.sql` identifica al residente como listo o equivalente válido.

## 9. Criterios GO

Se considera **GO** si:

- Existe usuario Auth DEV residente.
- Existe `usuarios_app` con `rol_id = 'residente'`.
- Existe `residentes` vinculado al usuario y conjunto DEV.
- Existe `tenant_memberships` activa con `role_name = 'residente'`.
- `tenant_memberships.residente_id` apunta al residente correcto.
- No hay duplicados activos conflictivos.
- `fase_3d7_identificar_usuarios_prueba_dev.sql` muestra `readiness_status = 'residente_dev_suficiente'`, `readiness_status = 'rol_tenant_residente_activo'` o un estado equivalente aceptado por la persona responsable.
- No se tocó QA ni PRD.
- No se modificó RLS, helpers, migraciones, frontend, `.env` ni Vercel.

## 10. Criterios NO-GO

No avanzar si:

- Se crea el usuario Auth en un proyecto equivocado.
- Se toca QA o PRD.
- Se usan datos reales de residentes.
- Se prepara información con `conjunto_id` incorrecto.
- El usuario queda sin membership activa.
- El usuario queda sin `residente_id` coherente.
- Aparecen duplicados activos conflictivos.
- No se puede iniciar sesión con el usuario residente.
- Se expone password, JWT, access token, refresh token, cookies o llaves en evidencia.

## 11. Rollback controlado DEV

Si algo sale mal, usar únicamente el template DEV:

- `supabase/validation/fase_3d7a_rollback_residente_dev_template.sql`.

Reglas del rollback:

- Debe ejecutarse solo en Supabase DEV.
- Debe apuntar al `auth_user_id`, `resident_email`, `torre_nombre` y `apartamento_numero` de prueba usados en esta fase.
- Debe borrar solo datos de prueba creados por esta fase.
- No debe borrar usuarios o datos reales.
- El usuario Auth del Dashboard debe eliminarse o deshabilitarse manualmente desde Supabase Dashboard DEV si corresponde.

## 12. Evidencia requerida

La evidencia debe ser saneada y no incluir secretos. Capturar:

- Fecha y responsable humano.
- Confirmación visual de ambiente DEV.
- `conjunto_id` DEV.
- Email de prueba enmascarado.
- `auth.users.id` parcial o enmascarado si la política interna lo exige.
- Resultado del diagnóstico read-only.
- Parámetros usados en el template, saneados.
- Resultado del post-check read-only.
- Resultado de `fase_3d7_identificar_usuarios_prueba_dev.sql`.
- Confirmación de que QA/PRD no fueron tocados.

## 13. Comentario sugerido de cierre

```text
FASE 3D.7A completada en DEV. Se preparó usuario residente de prueba con cadena Auth -> usuarios_app -> residentes -> tenant_memberships, conjunto DEV confirmado, post-check sin duplicados activos conflictivos y sin tocar QA/PRD. Evidencia saneada adjunta. Continúa FASE 3D.7 validación efectiva autenticada RLS por rol.
```
