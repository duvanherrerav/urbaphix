# FASE 5.4.1 — Helper central validación operativa tenant

## Objetivo

Implementar en DEV un helper SQL central y reusable que determine si una operación tenant está permitida según `public.tenant_lifecycle`, sin conectarlo todavía de forma masiva a visitas, accesos, paquetes ni otros módulos operativos.

## Alcance implementado

- Nueva función `public.fn_tenant_is_operational(p_conjunto_id uuid, p_operation text default 'tenant_mutation') returns boolean`.
- Nueva validación SQL DEV/QA con matriz completa de estados y operaciones.
- Documentación del helper en `docs/database-schema.md`.
- Sin cambios frontend, sin cambios de RLS de tablas existentes y sin cambios de configuración Vercel.
- Sin auditoría en esta fase, porque el helper solo evalúa estado y no cambia datos.

## Contrato funcional

Operaciones reconocidas:

- `tenant_read`
- `tenant_mutation`
- `tenant_terminal_close`
- `tenant_onboarding_config`
- `platform_read`

Entradas inválidas:

- `p_conjunto_id is null` falla con excepción controlada.
- `p_operation` nula, vacía o no reconocida falla con excepción controlada.

Ausencia de fila lifecycle:

- Retorna `false` para operaciones tenant.
- Retorna `true` para `platform_read`.
- No asume `active`.

## Matriz de decisión

| Estado / operación | tenant_read | tenant_mutation | tenant_terminal_close | tenant_onboarding_config | platform_read |
| --- | --- | --- | --- | --- | --- |
| `active`, `operational_lock=false` | true | true | true | false | true |
| `active`, `operational_lock=true` | true | false | true | false | true |
| `onboarding`, `operational_lock=false` | true | false | false | true | true |
| `onboarding`, `operational_lock=true` | true | false | false | false | true |
| `suspended` | true | false | true | false | true |
| `archived` | false | false | false | false | true |
| sin fila `tenant_lifecycle` | false | false | false | false | true |

Notas conservadoras:

- `tenant_terminal_close` en `onboarding` queda en `false` en el helper base porque no existe en esta fase una operación de cierre explícitamente autorizada para ese estado.
- `tenant_terminal_close` en `archived` queda en `false`; cualquier excepción heredada debe diseñarse en una RPC específica y autorizada.
- `tenant_read` en `archived` queda en `false` como lectura tenant genérica; lecturas históricas específicas deben permanecer en RLS/RPC dedicadas.

## Diseño técnico

La función se implementa como `plpgsql STABLE SECURITY INVOKER` con `search_path = public, pg_temp`.

Se usa `SECURITY INVOKER` para no elevar privilegios ni permitir que un cliente autenticado salte la policy `SELECT` de `public.tenant_lifecycle` mediante inferencia de booleanos. En FASE 5.4.1 el helper no queda expuesto directamente a `authenticated`; queda disponible para owners, `service_role` y futuras RPCs `SECURITY DEFINER` autorizadas que lo invoquen internamente.

Mitigaciones aplicadas:

- La función no retorna columnas ni filas de `tenant_lifecycle`; retorna únicamente booleano.
- No valida ni suplanta identidad/rol del actor.
- No escribe datos.
- No registra auditoría.
- No concede privilegios directos nuevos sobre `tenant_lifecycle`.
- `anon`, `public` y `authenticated` quedan sin `EXECUTE` directo.
- `service_role` recibe `EXECUTE`; futuras RPCs autorizadas podrán invocarlo internamente sin exponerlo como API directa.

## Grants

- `revoke all on function public.fn_tenant_is_operational(uuid, text) from public`.
- `revoke execute on function public.fn_tenant_is_operational(uuid, text) from anon`.
- `revoke execute on function public.fn_tenant_is_operational(uuid, text) from authenticated`.
- `grant execute on function public.fn_tenant_is_operational(uuid, text) to service_role`.

La decisión evita exponer capacidades a `anon` o `authenticated` en esta fase y mantiene el helper reusable para backend controlado. La autorización de negocio sigue siendo responsabilidad de la RLS o RPC que invoque el helper.

## Validación DEV/QA

Script incluido:

```text
supabase/validation/fase_5_4_1_fn_tenant_is_operational_validation.sql
```

El script valida:

1. Existencia, volatilidad `STABLE`, `SECURITY INVOKER` (`prosecdef = false`) y `search_path` seguro.
2. Grants de función: `anon`/`public`/`authenticated` sin execute directo y `service_role` con execute.
3. Validación negativa documentada: un rol/JWT `authenticated` normal no puede invocar directamente el helper.
4. Ausencia de nuevas capacidades directas sobre `public.tenant_lifecycle` para `anon` y escrituras `authenticated`.
5. Matriz completa de estados/operaciones.
6. Tenant sin fila lifecycle usando UUID generado sin fila asociada.
7. `operational_lock=true` incoherente en `active` y `onboarding` dentro de transacción con `rollback`.
8. Casos comentados de errores controlados para parámetros inválidos.

Las validaciones de matriz actualizan temporalmente una fila lifecycle existente dentro de una transacción y ejecutan `rollback`, por lo que no dejan cambios persistentes.

## No incluido en esta fase

- No se conecta el helper a visitas, accesos, paquetes, pagos, reservas ni otros módulos.
- No se modifican policies RLS existentes.
- No se cambia frontend.
- No se crean bloqueos reales de negocio todavía.
- No se modifica lifecycle existente de forma persistente.
