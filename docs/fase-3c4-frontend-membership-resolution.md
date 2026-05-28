# FASE 3C.4 — Resolución frontend de memberships con fallback legacy

## Alcance de esta fase

Esta fase prepara el frontend para leer `tenant_memberships` de forma controlada sin reemplazar todavía `usuarios_app` como modelo legacy. No incluye migraciones, cambios de RLS, cambios de estructura Supabase ni ajustes de producción.

El cambio técnico central es `src/services/membershipResolver.js`, que resuelve un perfil compatible con la forma que el frontend ya consume (`usuarioApp.id`, `usuarioApp.rol_id`, `usuarioApp.conjunto_id` y, cuando aplica, `usuarioApp.residente_id`).

## Auditoría de uso actual

### Consultas directas a `usuarios_app`

Archivos que consultan o proyectan explícitamente `usuarios_app`:

- `src/App.jsx`: cargaba el perfil autenticado desde `usuarios_app` y decide navegación por `usuarioApp.rol_id`.
- `src/modules/auth/Login.jsx`: cargaba `usuarios_app.rol_id` para mostrar el destino posterior al login.
- `src/modules/visitas/services/visitasService.js`: obtiene contexto de usuario/residente y datos relacionados para visitas.
- `src/modules/visitas/services/porteriaService.js`: obtiene usuarios para operación de portería/vigilancia.
- `src/modules/visitas/pages/PanelVigilancia.jsx`: consulta usuario para acciones operativas de vigilancia.
- `src/modules/visitas/pages/EscanearQR.jsx`: consulta usuario para validación operativa.
- `src/modules/paqueteria/services/paquetesService.js`: consulta usuario para flujos de paquetes.
- `src/modules/seguridad/services/seguridadService.js`: consulta usuario para contexto de incidentes.
- `src/modules/contabilidad/services/contabilidadService.js`: consulta usuario/residente para pagos.
- `src/modules/contabilidad/services/pagosEventosService.js`: consulta/proyecta usuario en eventos de pagos.
- `src/modules/contabilidad/pages/PanelPagosAdmin.jsx`: proyecta `residentes.usuarios_app.nombre` y eventos de usuario.
- `src/modules/contabilidad/components/CarteraResumen.jsx`: proyecta `residentes.usuarios_app` para nombres.
- `src/modules/contabilidad/components/EstadoCuenta.jsx`: proyecta `residentes.usuarios_app` para estado de cuenta.
- `src/modules/contabilidad/utils/pagosEstados.js`: usa nombres proyectados desde `residentes.usuarios_app`.
- `src/modules/reservas/services/reservasService.js`: proyecta `residentes.usuarios_app` para reservas.
- `src/modules/reservas/utils/reservaFormatters.js`: formatea nombres de residentes desde `residentes.usuarios_app`.
- `src/types/database.types.ts`: contiene tipos generados con relaciones a `usuarios_app`.

### Dependencias de `rol_id`, `conjunto_id` y `residente_id`

- `src/App.jsx` es el punto principal de routing visual por `usuarioApp.rol_id` (`admin`, `vigilancia`, `residente`).
- Los módulos funcionales reciben `usuarioApp` y filtran por `usuarioApp.conjunto_id` para mantener aislamiento por conjunto.
- Los flujos de residente siguen resolviendo el registro de `residentes` cuando necesitan un `residente_id` operativo; el nuevo resolver expone `usuarioApp.residente_id` si viene de `tenant_memberships`, pero no obliga todavía a todos los módulos a consumirlo.
- Los servicios de visitas, reservas, paquetería, contabilidad y seguridad mantienen sus consultas existentes para evitar una migración masiva en esta fase.

## Flujo actual de autenticación/permisos antes de esta fase

1. `supabase.auth.getUser()` o `onAuthStateChange` obtiene el usuario autenticado.
2. `src/App.jsx` consulta `usuarios_app` por `id = auth.user.id`.
3. El frontend guarda ese registro como `usuarioApp`.
4. La navegación se decide con `usuarioApp.rol_id`:
   - `admin` → dashboard/pagos/incidentes/reservas.
   - `vigilancia` → visitas/paquetes/incidentes/reservas.
   - `residente` → visitas/paquetes/pagos/reservas.
5. Los módulos reciben `usuarioApp` y aplican filtros por `conjunto_id`, `residente_id` o relaciones existentes.

## Nuevo flujo compatible

1. `src/App.jsx` obtiene el usuario autenticado igual que antes.
2. `src/services/membershipResolver.js` consulta en paralelo:
   - `tenant_memberships` por `user_id` y `status = 'active'`.
   - `usuarios_app` por `id`, como fuente legacy y fallback.
3. Si existe una membership activa y compatible, el resolver construye un perfil compatible con el frontend actual.
4. Si no existe membership activa compatible, si la consulta falla por RLS/red, o si los datos mínimos no son seguros, el resolver vuelve a `usuarios_app`.
5. La navegación principal permanece estable porque sigue usando `usuarioApp.rol_id`.

## Mapeo de roles

`tenant_memberships.role_name` se traduce a `usuarioApp.rol_id` así:

| `tenant_memberships.role_name` | `usuarioApp.rol_id` legacy |
| --- | --- |
| `admin_conjunto` | `admin` |
| `vigilante` | `vigilancia` |
| `residente` | `residente` |

Roles existentes en memberships pero no navegables todavía (`contador`, `comite`) no se activan en UI en esta fase. Si un usuario solo tiene esos roles, el resolver usa fallback legacy cuando exista.

## Validaciones defensivas del resolver

- **Usuario sin membership activa:** usa `usuarios_app` si existe.
- **Error al consultar `tenant_memberships`:** no bloquea login; usa fallback legacy y registra warning solo en desarrollo.
- **Usuario legacy sin registro en `tenant_memberships`:** mantiene comportamiento anterior con `usuarios_app`.
- **Múltiples memberships activas:** selecciona primero la membership cuyo `conjunto_id` coincida con `usuarios_app.conjunto_id`; si no hay coincidencia, usa la primera por `created_at` y registra warning solo en desarrollo.
- **Membership sin `conjunto_id`:** se considera incompatible y cae a legacy.
- **Membership residente sin `residente_id`:** se considera incompleta para transición y cae a legacy.
- **Rol de membership sin mapeo UI:** se considera incompatible en esta fase y cae a legacy.
- **Usuario sin perfil legacy y sin membership válida:** retorna `null` para que la UI muestre el estado de error existente.

## Estrategia de fallback

`usuarios_app` sigue siendo la red de seguridad. La adopción de `tenant_memberships` es preferente únicamente cuando el registro activo aporta datos completos y compatibles con la UI actual.

El perfil final conserva la forma legacy:

```js
{
  id,
  nombre,
  email,
  rol_id,
  conjunto_id,
  residente_id,
  role_name,
  status,
  membership_source,
  membership_resolution
}
```

Esto permite que futuras fases migren módulos gradualmente a `membership_resolution` sin romper componentes que todavía esperan `usuarioApp.rol_id`.

## Riesgos

- RLS de `tenant_memberships` puede impedir lectura en escenarios de datos incompletos; por eso la consulta no debe ser bloqueante.
- Usuarios con más de un tenant activo siguen siendo ambiguos para una UI que todavía asume un solo `conjunto_id`.
- Roles nuevos (`contador`, `comite`) requieren diseño de navegación antes de exponerse.
- Si un residente tiene membership sin `residente_id`, algunos módulos podrían perder alcance; por eso se mantiene fallback legacy.
- Los servicios internos siguen consultando relaciones con `usuarios_app`, por lo que esta fase no elimina dependencias legacy.

## Criterios de validación por rol

### Admin

- Login con usuario `admin_conjunto` activo resuelve `usuarioApp.rol_id = 'admin'`.
- Dashboard admin carga con `usuarioApp.conjunto_id` correcto.
- Pagos, incidentes y reservas admin siguen filtrando por el conjunto.
- Si no hay membership, el usuario admin legacy continúa entrando con `usuarios_app.rol_id = 'admin'`.

### Vigilancia

- Login con usuario `vigilante` activo resuelve `usuarioApp.rol_id = 'vigilancia'`.
- Control de visitas carga sin cambiar navegación.
- Paquetería e incidentes siguen recibiendo el mismo objeto `usuarioApp` compatible.
- Si no hay membership, el usuario vigilancia legacy continúa entrando con `usuarios_app.rol_id = 'vigilancia'`.

### Residente

- Login con usuario `residente` activo resuelve `usuarioApp.rol_id = 'residente'`.
- La membership debe incluir `residente_id`; si falta, se usa fallback legacy.
- Solicitar visita, mis paquetes, mis pagos y reservas siguen cargando con el mismo `conjunto_id`.
- Si no hay membership, el usuario residente legacy continúa entrando con `usuarios_app.rol_id = 'residente'`.

## Pruebas manuales esperadas

- Login admin exitoso.
- Login vigilancia exitoso.
- Login residente exitoso.
- Dashboard admin carga.
- Control visitas vigilancia carga.
- Solicitar visita residente carga.
- No hay errores críticos en consola.
- Las respuestas Network esperadas siguen en HTTP 200.
- Fallback legacy funciona con usuarios que no tengan registro activo en `tenant_memberships`.
- Usuario con múltiples memberships activas conserva navegación estable hacia el conjunto legacy cuando exista coincidencia.
