# FASE 5.4.3 — Lifecycle operativo en creación de visitas

## Objetivo
Endurecer la RPC `public.fn_crear_o_reutilizar_visitante_y_registro(uuid, uuid, uuid, text, text, text, text, text, date)` para que la creación/reutilización de visitantes y registros de visita respete identidad autenticada, ownership de residente/apartamento y lifecycle operativo del tenant antes de mutar datos.

## Cambios implementados
- Se conserva la firma y el retorno `RETURNS TABLE(visitante_id uuid, registro_id uuid, qr_code text)`.
- La función sigue siendo `SECURITY DEFINER` para mantener la operación atómica, pero ahora usa `SET search_path = public, pg_temp` y referencias schema-qualified.
- Se exige sesión autenticada con `auth.uid()`; si no existe sesión falla con `AUTH_REQUIRED`.
- Se resuelve el residente real desde `public.residentes` y se valida que:
  - `p_residente_id` corresponde al usuario autenticado por membresía activa `tenant_memberships.role_name = 'residente'` o por vínculo legacy `residentes.usuario_id`.
  - `p_conjunto_id` coincide con el `conjunto_id` real del residente.
- Si `p_apartamento_id` viene informado, se valida que coincide con el apartamento asociado al residente y que el apartamento pertenece al mismo tenant.
- Antes de cualquier `INSERT` o `UPDATE`, se invoca `public.fn_tenant_is_operational(v_conjunto_id, 'tenant_mutation')`.
- Si el tenant no permite mutación se aborta con `TENANT_OPERATIONAL_LOCKED`, sin exponer estado lifecycle, lock operativo ni datos personales.
- La reutilización de visitante queda acotada a `conjunto_id + residente_id + tipo_documento + documento` validados.
- Se revoca `EXECUTE` para `public`/`anon` y se mantiene solo para `authenticated` y `service_role`.

## Atomicidad
La validación de identidad, tenant, apartamento y lifecycle ocurre antes de cualquier escritura. La creación/actualización de `visitantes` y la creación de `registro_visitas` ocurren en la misma ejecución transaccional de la RPC; ante cualquier excepción, PostgreSQL revierte la sentencia completa.

## Validación DEV
Usar `supabase/validation/fase_5_4_3_lifecycle_creacion_visitas_validation.sql` en DEV. El script está envuelto en transacción con `ROLLBACK` y cubre sesión ausente, ownership, cross-tenant, apartamento ajeno, lifecycle bloqueado, grants y shape de retorno.
