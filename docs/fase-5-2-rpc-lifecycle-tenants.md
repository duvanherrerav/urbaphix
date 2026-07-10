# FASE 5.2 — RPC lifecycle tenants controlada

## Objetivo

Implementar una capa segura de mutación para `public.tenant_lifecycle` mediante una RPC `SECURITY DEFINER`, sin crear UI y sin abrir `INSERT`, `UPDATE` ni `DELETE` directos para `authenticated` sobre la tabla lifecycle.

## Decisión de auditoría

Se crea `public.tenant_lifecycle_events` como bitácora append-only dedicada.

Motivos:

- `public.operational_events.source` solo permite `frontend` o `edge_function`.
- Usar `source = 'rpc'` en `operational_events` requeriría una migración explícita del constraint existente.
- Las transiciones lifecycle son auditoría SaaS crítica y quedan mejor aisladas de la telemetría operacional frontend/backend ya existente.
- La nueva tabla evita PII y almacena solo actor, rol plataforma efectivo, tenant, estado anterior, estado nuevo, razón acotada, timestamp, source fijo `rpc` y metadata técnica mínima.

## RPC

Función: `public.fn_platform_transition_tenant_lifecycle(p_conjunto_id uuid, p_target_status text, p_reason text)`.

Propiedades:

- `LANGUAGE plpgsql`.
- `SECURITY DEFINER`.
- `SET search_path = public, pg_temp`.
- Requiere `auth.uid()` no nulo.
- Autoriza únicamente `fn_is_platform_superadmin()` o `fn_has_platform_role('platform_ops')`.
- Revoca ejecución a `public` y `anon`.
- Concede ejecución a `authenticated` y `service_role`.
- Retorna solo: `conjunto_id`, `previous_status`, `lifecycle_status`, `operational_lock`, `updated_at`.

## Matriz de transiciones

| Desde | Hacia | Autorización | Razón |
| --- | --- | --- | --- |
| `onboarding` | `active` | `superadmin` o `platform_ops` | Opcional |
| `onboarding` | `archived` | `superadmin` o `platform_ops` | Obligatoria |
| `active` | `suspended` | `superadmin` o `platform_ops` | Obligatoria |
| `suspended` | `active` | `superadmin` o `platform_ops` | Obligatoria |
| `suspended` | `archived` | `superadmin` o `platform_ops` | Obligatoria |
| `active` | `archived` | Solo `superadmin` | Obligatoria |
| `archived` | Cualquiera | No permitido | N/A |

También se bloquean:

- estados destino fuera de `onboarding`, `active`, `suspended`, `archived`;
- transición al mismo estado;
- tenants inexistentes;
- tenants sin fila en `tenant_lifecycle`;
- razones vacías cuando son obligatorias;
- razones mayores a 280 caracteres.

## Actualización de `tenant_lifecycle`

La RPC actualiza de forma coherente:

- `lifecycle_status`;
- `operational_lock` (`true` para `suspended` o `archived`, `false` para `active`/`onboarding`);
- `lock_reason` (`reason` para `suspended`/`archived`, `null` al reactivar/activar);
- `status_reason`;
- `activated_at`, `suspended_at` o `archived_at` según transición destino;
- `updated_at = now()`;
- `updated_by = auth.uid()`.

## Auditoría transaccional

La RPC inserta en `tenant_lifecycle_events` en la misma transacción que el update de lifecycle. Si la inserción de auditoría falla, toda la transición falla y no queda mutación parcial.

## Validación

SQL documentado: `supabase/validation/fase_5_2_rpc_lifecycle_tenants_validation.sql`.

Checklist cubierto:

- RPC existe y es `SECURITY DEFINER`.
- `search_path` seguro.
- `anon`/`public` sin `EXECUTE`.
- `authenticated` con `EXECUTE`.
- `authenticated` no tiene `INSERT`/`UPDATE`/`DELETE` directo sobre `tenant_lifecycle`.
- Usuario tenant normal sin rol plataforma recibe error.
- Transición válida funciona.
- Transición inválida falla sin mutar.
- Razón obligatoria se valida.
- Auditoría queda registrada en la misma transacción.
- `archived` permanece terminal.
