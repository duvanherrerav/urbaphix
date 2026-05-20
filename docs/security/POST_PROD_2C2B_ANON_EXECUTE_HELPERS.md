# POST-PROD 2C-2B-A — Revocación de EXECUTE a `PUBLIC` + `anon` en helpers RLS/auth y legacy

## Resumen ejecutivo
Esta subfase reduce superficie pública en Supabase revocando `EXECUTE` al rol `anon` **y también a `PUBLIC`** sobre helpers de autorización/RLS modernos y legacy. Esto evita acceso anónimo heredado por membresía implícita en `PUBLIC`.

Al revocar `PUBLIC`, la migración otorga explícitamente `EXECUTE` a `authenticated` y `service_role` para preservar tráfico autenticado, políticas RLS y uso interno. La migración también es tolerante a diferencias entre DEV/QA/PRD mediante `to_regprocedure(...)`, por lo que no falla si una función no existe en algún entorno.

No se modifican las RPC productivas de visitas/vigilancia.

## Evidencia base
- Tras 2C-2A, `anon`, `authenticated` y `service_role` conservaban `EXECUTE` en helpers RLS/auth modernos y helpers legacy.
- En PostgreSQL, `PUBLIC` aplica a todos los roles; revocar solo `anon` puede no ser suficiente si `PUBLIC` conserva `EXECUTE`.
- En QA se detectó drift frente a PRD: `public.get_user_residente_id()` no existe en QA, aunque fue detectada en evidencia de PRD.
- Las RPC productivas de visitas/vigilancia (`fn_crear_o_reutilizar_visitante_y_registro`, `fn_registrar_ingreso_visita`, `fn_registrar_salida_visita`) se mantienen fuera de alcance para evitar impacto funcional.

## Qué cambia
- Nueva migración versionada drift-safe por cada helper objetivo.
- Cada función usa bloque `DO $$ ... END $$;` con `to_regprocedure(...)`.
- Orden por función para preservar permisos explícitos de tráfico autenticado:
  1. `GRANT EXECUTE ... TO authenticated, service_role;`
  2. `REVOKE EXECUTE ... FROM PUBLIC;`
  3. `REVOKE EXECUTE ... FROM anon;`
  4. `GRANT EXECUTE ... TO authenticated, service_role;` como estado final idempotente.

Funciones objetivo:
- `fn_auth_conjunto_id()`
- `fn_auth_residente_id()`
- `fn_auth_rol()`
- `get_user_conjunto_id()`
- `get_user_residente_id()`
- `get_user_role()`
- `is_admin()`
- `is_residente()`
- `is_vigilancia()`

## Qué NO cambia
- No se revoca `authenticated`.
- No se revoca `service_role`.
- No se tocan grants de RPC productivas de visitas/vigilancia.
- No se cambian tablas, columnas, FKs, políticas RLS, cuerpos de funciones ni atributos `SECURITY DEFINER/INVOKER`.
- No se aplican cambios remotos desde Codex.

## Matriz función → tipo → uso esperado → acción 2C-2B-A → pendiente futuro
| Función | Tipo | Uso esperado | Acción 2C-2B-A | Pendiente |
|---|---|---|---|---|
| `fn_auth_conjunto_id` | Helper RLS/auth moderno | `authenticated`/`service_role` | Revocar `PUBLIC` + `anon`; preservar `authenticated`/`service_role` | Validar políticas RLS |
| `fn_auth_residente_id` | Helper RLS/auth moderno | `authenticated`/`service_role` | Revocar `PUBLIC` + `anon`; preservar `authenticated`/`service_role` | Validar políticas RLS |
| `fn_auth_rol` | Helper RLS/auth moderno | `authenticated`/`service_role` | Revocar `PUBLIC` + `anon`; preservar `authenticated`/`service_role` | Validar políticas RLS |
| `get_user_conjunto_id` | Helper legacy | `authenticated`/`service_role` | Revocar `PUBLIC` + `anon` si existe; preservar `authenticated`/`service_role` | Evaluar reemplazo futuro |
| `get_user_residente_id` | Helper legacy | `authenticated`/`service_role` | Revocar `PUBLIC` + `anon` si existe; preservar `authenticated`/`service_role` | Evaluar reemplazo futuro |
| `get_user_role` | Helper legacy | `authenticated`/`service_role` | Revocar `PUBLIC` + `anon` si existe; preservar `authenticated`/`service_role` | Evaluar reemplazo futuro |
| `is_admin` | Helper legacy | `authenticated`/`service_role` | Revocar `PUBLIC` + `anon` si existe; preservar `authenticated`/`service_role` | Evaluar reemplazo futuro |
| `is_residente` | Helper legacy | `authenticated`/`service_role` | Revocar `PUBLIC` + `anon` si existe; preservar `authenticated`/`service_role` | Evaluar reemplazo futuro |
| `is_vigilancia` | Helper legacy | `authenticated`/`service_role` | Revocar `PUBLIC` + `anon` si existe; preservar `authenticated`/`service_role` | Evaluar reemplazo futuro |
| `fn_crear_o_reutilizar_visitante_y_registro` | RPC productiva visitas | frontend productivo | No tocar | Evaluar `anon` en fase futura con E2E |
| `fn_registrar_ingreso_visita` | RPC productiva vigilancia | frontend productivo | No tocar | Evaluar `anon` en fase futura con E2E |
| `fn_registrar_salida_visita` | RPC productiva vigilancia | frontend productivo | No tocar | Evaluar `anon` en fase futura con E2E |

## Plan de validación QA
1. Aplicar migración en QA por pipeline controlado.
2. Ejecutar `supabase/audits/post_prod_2c2b_verify_anon_execute_helpers.sql` y guardar evidencia.
3. Confirmar en helpers objetivo: `public_execute = false`, `anon_execute = false`, `authenticated_execute = true`, `service_role_execute = true`.
4. Confirmar en RPC productivas de visitas/vigilancia: sin cambios respecto a baseline.
5. Ejecutar smoke funcional autenticado de visitas/vigilancia.

## Plan de rollback conceptual
Si se detecta regresión, crear nueva migración de rollback explícito restaurando `GRANT EXECUTE` de forma selectiva y mínima en funciones específicas necesarias.

## Riesgos pendientes
- Posible dependencia no documentada de clientes anónimos sobre algún helper legacy.
- Deuda técnica por coexistencia de helpers modernos y legacy.
- RPC productivas de visitas/vigilancia aún con exposición `anon` pendiente de evaluación dedicada.

## Recomendación para POST-PROD 2C-2B-B / 2C-3
- Ejecutar inventario de consumidores reales por rol mediante logs/auditoría para confirmar ausencia de invocación anónima en helpers.
- Diseñar fase dedicada para revisar grants `anon` de RPC productivas de visitas/vigilancia con pruebas E2E completas.
