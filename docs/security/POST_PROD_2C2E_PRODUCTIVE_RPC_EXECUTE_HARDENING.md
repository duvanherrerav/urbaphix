# POST-PROD 2C2E: Hardening controlado de RPC productivas (PUBLIC/anon → authenticated)

## Resumen ejecutivo

En esta fase se implementa un hardening quirúrgico de privilegios `EXECUTE` para 3 RPC productivas de `public`, retirando ejecución desde `PUBLIC` y `anon`, y preservando explícitamente ejecución para `authenticated` y `service_role`.

La implementación se entrega mediante migración SQL idempotente y drift-safe (por firma con `to_regprocedure(...)`), auditoría readonly y plan de validación QA/E2E obligatorio previo a promoción.

## Evidencia base (POST-PROD 2C2D)

La evaluación técnica 2C2D documentó que:

- Las 3 RPC objetivo estaban expuestas a `PUBLIC` y `anon`.
- Sus flujos funcionales reales corresponden a usuarios autenticados (residente/vigilancia).
- No se identificó un caso legítimo de ejecución anónima sin login.

## Alcance

1. Crear migración para 3 RPC objetivo que:
   - preserve/reafirme `EXECUTE` para `authenticated` y `service_role`;
   - revoque `EXECUTE` de `PUBLIC`;
   - revoque `EXECUTE` de `anon`.
2. Crear auditoría readonly post-migración.
3. Documentar plan de validación QA y checklist E2E/manual.

## No alcance

- No se modifican cuerpos SQL de funciones.
- No se modifican policies RLS.
- No se modifican grants de tablas.
- No se modifica frontend funcional.
- No se aplican cambios remotos desde Codex (`supabase db push` prohibido).
- No se toca `qa`, `main` ni PRD.

## RPC afectadas (firmas exactas)

1. `public.fn_crear_o_reutilizar_visitante_y_registro(uuid, uuid, uuid, text, text, text, text, text, date)`
2. `public.fn_registrar_ingreso_visita(text, uuid)`
3. `public.fn_registrar_salida_visita(uuid, uuid)`

## Estado esperado antes/después

### Antes (esperado según 2C2D)

- `public_execute = true`
- `anon_execute = true`
- `authenticated_execute = true`
- `service_role_execute = true`
- `SECURITY DEFINER = true`
- `search_path = public, auth`

### Después (objetivo 2C2E)

- `public_execute = false`
- `anon_execute = false`
- `authenticated_execute = true`
- `service_role_execute = true`
- `SECURITY DEFINER` sin cambios
- `search_path` sin cambios

## Qué cambia y qué no cambia

### Cambia

- Solo los grants `EXECUTE` de las 3 RPC objetivo para retirar `PUBLIC`/`anon`.

### No cambia

- Lógica de negocio de funciones.
- RLS, tablas, índices, constraints o políticas.
- Permisos de tablas o vistas.
- Flujos funcionales del frontend (más allá de endurecer acceso no autenticado).

## Matriz de hardening por RPC

Para cada una de las 3 funciones:

1. `GRANT EXECUTE ... TO authenticated, service_role`
2. `REVOKE EXECUTE ... FROM PUBLIC`
3. `REVOKE EXECUTE ... FROM anon`
4. `GRANT EXECUTE ... TO authenticated, service_role` (idempotente final)

## Plan de validación QA (pipeline controlado)

1. Aplicar migración primero en Supabase QA por pipeline manual controlado.
2. Ejecutar auditoría readonly:
   - `supabase/audits/post_prod_2c2e_verify_productive_rpc_execute_grants.sql`
3. Confirmar resultados esperados:
   - `public_execute=false`
   - `anon_execute=false`
   - `authenticated_execute=true`
   - `service_role_execute=true`
   - `security_definer=true`
   - `search_path` esperado para cada función
4. Ejecutar checklist E2E/manual completo.
5. Solo promover a PRD tras evidencia QA satisfactoria y sin regresiones.

## Checklist E2E/manual obligatorio (QA)

1. Login residente.
2. Residente crea visita con visitante nuevo.
3. Residente crea visita con visitante existente.
4. QR se genera correctamente.
5. Login vigilancia.
6. Vigilancia registra ingreso desde Escanear QR.
7. Vigilancia registra ingreso desde ruta legacy si existe.
8. Vigilancia registra salida desde panel.
9. Dashboard/indicadores reflejan estados.
10. Notificaciones/alertas relacionadas siguen funcionando.
11. Cola offline de portería no queda rota si aplica.
12. Network sin errores Supabase inesperados `401`, `403`, `500`.
13. Consola sin errores propios críticos.
14. Usuario no autenticado no puede ejecutar las RPC.

## Rollback conceptual

Si QA detecta regresión:

1. Detener promoción a PRD.
2. Crear migración correctiva explícita (sin alterar funciones no objetivo) que restaure temporalmente permisos según necesidad validada.
3. Repetir auditoría readonly y checklist E2E en QA.
4. Documentar causa raíz antes de nueva promoción.

> Nota: el rollback debe ser también quirúrgico, auditable e idempotente.

## Riesgos residuales

- Dependencias no documentadas que invoquen estas RPC sin sesión autenticada podrían fallar con `permission denied`.
- Integraciones legacy fuera del frontend principal podrían requerir ajuste operativo.
- Si alguna firma difiere entre ambientes, la migración omitirá esa función (drift-safe), exigiendo reconciliación previa a promoción.

## Criterio de aceptación

- PR apuntando a `develop`.
- Migración quirúrgica solo para las 3 RPC objetivo.
- `authenticated` y `service_role` preservados.
- `PUBLIC` y `anon` revocados.
- Sin cambios de frontend funcional.
- Sin cambios de RLS ni grants de tablas.
- Sin ejecución remota desde Codex.
- Auditoría readonly incluida.
- Plan QA + checklist E2E incluidos.

## Recomendación de promoción a PRD

Proceder a promoción únicamente después de:

1. evidencia de auditoría QA en estado esperado;
2. checklist E2E completo sin regresiones críticas;
3. validación explícita de que no existen consumidores anónimos legítimos de estas RPC.
