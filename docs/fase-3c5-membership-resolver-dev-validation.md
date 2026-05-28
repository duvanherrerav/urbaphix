# FASE 3C.5 — Validación controlada del membership resolver en DEV/local

## Alcance

Esta fase valida el resolver híbrido únicamente en ambiente local/DEV. No modifica Supabase, no agrega migraciones, no cambia RLS, no activa el resolver en QA/PRD y no elimina el fallback legacy hacia `usuarios_app`.

## Orden de resolución runtime

1. `src/App.jsx` obtiene el usuario autenticado con Supabase Auth.
2. Si `VITE_ENABLE_MEMBERSHIP_RESOLVER` está apagado, ausente o tiene un valor distinto de `true`, `1`, `yes` u `on`, el bootstrap usa el flujo legacy directo: consulta `usuarios_app` por `id = auth.user.id` y no consulta `tenant_memberships` desde el resolver.
3. Si el flag está encendido, `src/services/membershipResolver.js` entra al flujo híbrido y consulta en paralelo:
   - `usuarios_app` por `id`, como perfil compatible y fallback.
   - `tenant_memberships` por `user_id`, `status = 'active'`, ordenado por `created_at` ascendente.
4. Si la lectura de `tenant_memberships` falla, el resolver agrega la advertencia `tenant_memberships_query_failed` y retorna el perfil legacy si existe.
5. Si no hay memberships activas, agrega `no_active_membership` y retorna fallback legacy.
6. Si hay memberships activas, descarta las incompatibles antes de construir el perfil del frontend.
7. Si existe una membership compatible, construye un perfil con forma legacy para mantener la navegación actual basada en `usuarioApp.rol_id`.
8. Si ninguna membership activa es compatible, retorna fallback legacy.
9. Si tampoco existe perfil legacy, retorna `profile: null` para que el bootstrap mantenga el mensaje controlado de perfil no cargado.

## Cuándo considera inválida una membership

Una membership activa se descarta si cumple cualquiera de estas condiciones:

- No tiene `conjunto_id` (`membership_missing_conjunto_id`).
- Tiene `role_name` no soportado por la navegación actual (`membership_role_not_supported_by_current_navigation`).
- Tiene `role_name = 'residente'` pero no tiene `residente_id` (`resident_membership_missing_residente_id`).

Estas condiciones no bloquean el login por sí solas: fuerzan fallback a `usuarios_app` cuando no queda una membership compatible.

## Selección cuando hay múltiples memberships activas

El resolver preserva compatibilidad con el modelo actual de una navegación por rol efectivo:

1. Filtra solo memberships activas y compatibles.
2. Si el perfil legacy tiene `conjunto_id`, prioriza la membership compatible con el mismo conjunto.
3. Si no hay coincidencia con legacy, selecciona la primera membership compatible ordenada por `created_at` ascendente.
4. Agrega `multiple_active_memberships_detected` cuando hay más de una membership activa para dejar trazabilidad en DEV.

Este comportamiento evita cambiar navegación principal y mantiene el conjunto legacy como referencia preferente durante la validación controlada.

## Compatibilidad de roles

El resolver traduce `tenant_memberships.role_name` hacia los roles que ya consume el frontend:

| `tenant_memberships.role_name` | `usuarioApp.rol_id` compatible |
| --- | --- |
| `admin_conjunto` | `admin` |
| `vigilante` | `vigilancia` |
| `residente` | `residente` |

La navegación existente continúa evaluando `usuarioApp.rol_id`, por lo que dashboard admin, módulos de vigilancia y módulos de residente no requieren cambios estructurales en esta fase.

## Observabilidad solo en development

Los logs nuevos se emiten únicamente cuando `import.meta.env.DEV` está activo. No incluyen email, token, user id, membership id ni datos personales. La metadata se limita a contadores, roles técnicos y presencia/ausencia de campos operativos.

Eventos trazables en consola DEV:

- Flag habilitado/deshabilitado desde el bootstrap.
- Inicio del resolver híbrido.
- Memberships activas encontradas.
- Membership compatible seleccionada.
- Fallback legacy activo.
- Múltiples memberships activas.
- `role_name` inválido o no soportado.
- `conjunto_id` faltante.
- `residente_id` faltante para residente.
- Abort controlado por ausencia de user id.
- Fallo de lectura de `tenant_memberships` con fallback legacy.

## Diferencias esperadas por feature flag

### `VITE_ENABLE_MEMBERSHIP_RESOLVER=false`

- `App.jsx` usa `usuarios_app` directamente.
- No hay lectura del resolver a `tenant_memberships` durante bootstrap.
- Login y navegación conservan el comportamiento legacy.
- Es el valor seguro por defecto para QA/PRD mientras no exista aprobación explícita.

### `VITE_ENABLE_MEMBERSHIP_RESOLVER=true`

- `App.jsx` usa `resolveUserMembershipProfile`.
- El resolver consulta `tenant_memberships` y `usuarios_app` en paralelo.
- Si encuentra membership compatible, retorna perfil con `rol_id` legacy traducido.
- Si no encuentra membership compatible o hay error leyendo memberships, retorna fallback legacy.
- Los módulos siguen recibiendo `usuarioApp` con `rol_id`, `conjunto_id` y `residente_id` cuando aplique.

## Checklist operativo DEV/local

### Preparación

- [ ] Confirmar que se está usando `.env.development` local, no QA/PRD.
- [ ] Definir `VITE_ENABLE_MEMBERSHIP_RESOLVER=false` y levantar la app.
- [ ] Iniciar sesión con usuario admin, vigilancia y residente legacy.
- [ ] Confirmar en Network que el bootstrap no consulta `tenant_memberships` cuando el flag está apagado.
- [ ] Confirmar navegación legacy estable por rol.

### Activación controlada

- [ ] Cambiar localmente a `VITE_ENABLE_MEMBERSHIP_RESOLVER=true`.
- [ ] Reiniciar Vite para asegurar que el env fue recompilado.
- [ ] Abrir consola del navegador y filtrar por `Membership resolver`.
- [ ] Validar que aparece el log DEV de flag habilitado.

### Admin

- [ ] Iniciar sesión con usuario que tenga membership activa `admin_conjunto`.
- [ ] Confirmar que el perfil resuelve `usuarioApp.rol_id = 'admin'`.
- [ ] Confirmar que dashboard, pagos, incidentes y reservas admin cargan.
- [ ] Confirmar que el `conjunto_id` efectivo mantiene filtros del conjunto esperado.

### Vigilancia

- [ ] Iniciar sesión con usuario que tenga membership activa `vigilante`.
- [ ] Confirmar que el perfil resuelve `usuarioApp.rol_id = 'vigilancia'`.
- [ ] Confirmar que control de visitas, paquetería, incidentes y reservas de vigilancia cargan.

### Residente

- [ ] Iniciar sesión con usuario que tenga membership activa `residente` y `residente_id`.
- [ ] Confirmar que el perfil resuelve `usuarioApp.rol_id = 'residente'`.
- [ ] Confirmar que solicitar visitas, mis paquetes, mis pagos y reservas cargan.
- [ ] Confirmar que una membership residente sin `residente_id` genera warning DEV y cae a fallback legacy.

### Fallback y casos defensivos

- [ ] Validar usuario legacy sin membership activa: debe entrar por `usuarios_app`.
- [ ] Validar membership activa sin `conjunto_id`: debe descartarse y usar fallback si existe.
- [ ] Validar `role_name` no soportado: debe descartarse y usar fallback si existe.
- [ ] Validar múltiples memberships activas: debe quedar warning DEV y selección determinística.
- [ ] Validar error controlado de lectura de memberships en DEV/local: no debe bloquear bootstrap si existe perfil legacy.
- [ ] Confirmar que no quedan errores críticos en consola.
- [ ] Confirmar que Network responde 200/esperado para módulos existentes y no hay llamadas a entornos QA/PRD.

## Criterios de cierre local

- [ ] Sin cambios en `supabase/migrations`.
- [ ] Sin cambios en RLS ni estructura de datos.
- [ ] Flag apagado conserva flujo legacy.
- [ ] Flag encendido permite resolver memberships compatibles.
- [ ] Fallback legacy funciona ante ausencia, incompatibilidad o error de memberships.
- [ ] Logs DEV entregan trazabilidad suficiente sin exponer información sensible.
