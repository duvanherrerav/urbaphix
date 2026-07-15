# FASE 5.4.2A — Bloqueo lifecycle en ingreso/salida de visitas

## Alcance implementado

Esta fase conecta el helper central `public.fn_tenant_is_operational(uuid, text)` únicamente con el flujo backend de ingreso y salida de visitas:

- `public.fn_registrar_ingreso_visita(p_qr_code text, p_vigilante_id uuid)`
- `public.fn_registrar_salida_visita(p_registro_id uuid, p_vigilante_id uuid)`

No incluye cambios frontend, creación de visitas, paquetes, RLS de tablas existentes ni contratos consumidos por `src/modules/visitas/services/porteriaService.js`.

## Decisiones técnicas

- Las firmas y el shape de retorno de ambas RPC se conservan.
- Ambas RPC siguen como `SECURITY DEFINER` porque deben ejecutar el helper central sin `EXECUTE` directo para `authenticated` y mutar el registro operativo bajo controles explícitos.
- `search_path` queda fijado en `public, pg_temp`.
- La identidad efectiva siempre es `auth.uid()`; `p_vigilante_id` debe coincidir con `auth.uid()` y no se acepta como prueba de identidad.
- La autorización de actor exige pertenencia al mismo `conjunto_id` del registro objetivo por `tenant_memberships` activa (`admin_conjunto`, `vigilancia`, `vigilante`) o fallback legacy `usuarios_app` (`admin`, `vigilancia`, `vigilante`).
- `conjunto_id` se resuelve desde `registro_visitas` antes de ejecutar cualquier mutación.
- Los errores de lifecycle usan el código lógico `TENANT_OPERATIONAL_LOCKED` y no exponen estado interno de `tenant_lifecycle`.

## Matriz aplicada

| Operación | Helper | Tenant `active` | Tenant `suspended` | Tenant `archived` |
| --- | --- | --- | --- | --- |
| Ingreso de visita pendiente | `tenant_mutation` | Permitido si no hay `operational_lock` | Bloqueado | Bloqueado |
| Salida de visita ya ingresada | `tenant_terminal_close` | Permitido | Permitido | Bloqueado |
| Reintento de salida ya cerrada | No ejecuta helper; no muta | Permitido | Permitido | Permitido |

La salida terminal en `archived` falla porque la matriz vigente del helper no permite `tenant_terminal_close` para tenants archivados cuando el registro aún está `ingresado`. Los reintentos sobre registros ya `salido` se resuelven después de validar identidad/autorización same-tenant y antes de consultar lifecycle, porque no realizan mutación ni exponen lifecycle. Cualquier excepción futura para nuevos cierres en `archived` requiere un diseño explícito y una nueva fase.

## Comportamientos preservados/endurecidos

- QR inválido o ya usado sigue fallando.
- Ingreso evita doble ingreso porque solo muta registros `pendiente`.
- Salida sobre `pendiente` falla: no se convierte una visita no iniciada en cierre terminal.
- Repetir salida sobre un registro `salido` es idempotente incluso si el tenant está `archived`: después de validar actor/same-tenant retorna la fila existente y no consulta lifecycle ni actualiza `hora_salida`.
- Usuarios cross-tenant no pueden ingresar ni cerrar visitas ajenas.
- `p_vigilante_id` distinto de `auth.uid()` falla con `FORBIDDEN` y evita suplantación.
- `public`/`anon` no tienen `EXECUTE`; `authenticated` y `service_role` conservan ejecución.

## Validación DEV

Script ejecutable con rollback:

- `supabase/validation/fase_5_4_2a_lifecycle_visitas_ingreso_salida_validation.sql`

Casos cubiertos por el script:

1. Tenant `active`: ingreso `pendiente` → `ingresado` funciona.
2. Tenant `suspended`: nuevo ingreso falla con `TENANT_OPERATIONAL_LOCKED` y no cambia datos.
3. Visita ingresada antes de suspensión: salida funciona y queda `salido` con `hora_salida`.
4. Tenant `archived`: ingreso falla.
5. Tenant `archived`: salida terminal de visita aún `ingresado` falla según matriz actual del helper.
6. Tenant `archived`: retry de visita ya `salido` retorna estado/hora_salida existentes sin mutación.
7. Usuario cross-tenant no puede ingresar ni cerrar visita ajena.
8. `p_vigilante_id` distinto de la identidad autenticada no permite suplantación.
9. QR inválido/usado sigue fallando.
10. Salida sobre `pendiente` falla.
11. Repetir salida no genera efectos adicionales.
12. `anon`/`public` sin `EXECUTE`.
