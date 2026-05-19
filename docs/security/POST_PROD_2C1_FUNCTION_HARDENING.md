# POST-PROD 2C-1 — Hardening pasivo seguro de funciones Supabase

## Resumen ejecutivo
En esta subfase se implementa hardening pasivo sobre funciones del schema `public` mediante `ALTER FUNCTION ... SET search_path = public, auth` con guardas defensivas por existencia. **Excepción explícita:** `rls_auto_enable()` se preserva como función especial asociada a event trigger/DDL con hardening existente `search_path = pg_catalog` (no se amplía a `public, auth`). No se cambian policies RLS, grants de tablas, ni lógica funcional de RPC. El objetivo es reducir riesgo de hijacking por `search_path` implícito y preparar la fase POST-PROD 2C-2 (ajustes de permisos/ejecutabilidad con validación funcional controlada).

## Alcance
- Migración versionada de hardening pasivo en `supabase/migrations/`.
- Script readonly de verificación post-migración en `supabase/audits/`.
- Documentación técnica de funciones críticas, exposición y pendientes.

## Qué cambia la migración
- Fija `search_path = public, auth` (si la función existe) para funciones críticas de visitas/auth/helpers/trigger, **excepto `rls_auto_enable()`**:
  - `fn_crear_o_reutilizar_visitante_y_registro(uuid,uuid,uuid,text,text,text,text,text,date)`
  - `fn_registrar_ingreso_visita(text,uuid)`
  - `fn_registrar_salida_visita(uuid,uuid)`
  - `fn_auth_residente_id()`
  - `fn_auth_conjunto_id()`
  - `fn_auth_rol()`
  - `set_updated_at()`
  - `handle_new_user()`
  - `get_user_conjunto_id()`
  - `get_user_residente_id()`
  - `get_user_role()`
  - `is_admin()`
  - `is_residente()`
  - `is_vigilancia()`
- Preserva `rls_auto_enable()` como caso especial de event trigger con `search_path = pg_catalog` (sin cambios en 2C-1).

## Qué NO cambia la migración
- No hay `REVOKE` masivos ni `REVOKE SELECT ON ALL TABLES`.
- No hay cambios de policies RLS.
- No hay `DROP POLICY`, `DROP FUNCTION`, `DROP TABLE`.
- No hay cambios de estructura (tablas/columnas/FKs).
- No hay cambios de datos.
- No hay cambios de frontend.
- No cambia `SECURITY DEFINER/INVOKER` en esta subfase.

## Funciones tocadas (2C-1)
Ver sección “Qué cambia la migración” (15 funciones con `search_path` explícito).

## Funciones pendientes (2C-2)
Pendientes de revisión/control por criticidad (sin ejecutar en 2C-1):
- Revisión de `EXECUTE` por rol (`anon`/`authenticated`) función por función.
- Evaluación de endurecimiento selectivo de funciones internas (`handle_new_user`, `set_updated_at`, `rls_auto_enable`) para evitar exposición innecesaria.
- Confirmación de necesidad de helpers legacy (`get_user_*`, `is_*`) vs helpers canónicos `fn_auth_*`.
- Revisión de `SECURITY DEFINER` (si aplica) con auditoría de ownership, grants y dependencia funcional.

## Matriz de funciones (base para 2C-2)
| Función | Tipo | Usada por frontend | Rol esperado | Acción 2C-1 | Pendiente futuro |
|---|---|---|---|---|---|
| fn_crear_o_reutilizar_visitante_y_registro | RPC visitas | Sí (visitasService) | authenticated (residente/admin según flujo) | Fijar search_path | Revisar EXECUTE por rol y validaciones internas |
| fn_registrar_ingreso_visita | RPC visitas/portería | Sí (visitasService/porteriaService) | authenticated (vigilancia) | Fijar search_path | Verificar restricciones de rol/tenant y grants |
| fn_registrar_salida_visita | RPC visitas/portería | Sí (porteriaService) | authenticated (vigilancia) | Fijar search_path | Verificar restricciones de rol/tenant y grants |
| fn_auth_residente_id | Helper RLS | Indirecto | authenticated/service_role | Fijar search_path | Revisar exposición a anon |
| fn_auth_conjunto_id | Helper RLS | Indirecto | authenticated/service_role | Fijar search_path | Revisar exposición a anon |
| fn_auth_rol | Helper RLS | Indirecto | authenticated/service_role | Fijar search_path | Revisar exposición a anon |
| set_updated_at | Trigger helper | No directo | interno DB | Fijar search_path | Evaluar recorte de EXECUTE externo |
| handle_new_user | Trigger auth | No directo | interno DB | Fijar search_path | Evaluar recorte de EXECUTE externo |
| get_user_conjunto_id | Helper legacy | No directo | authenticated/service_role | Fijar search_path | Definir continuidad vs fn_auth_conjunto_id |
| get_user_residente_id | Helper legacy | No directo | authenticated/service_role | Fijar search_path | Definir continuidad vs fn_auth_residente_id |
| get_user_role | Helper legacy | No directo | authenticated/service_role | Fijar search_path | Definir continuidad vs fn_auth_rol |
| is_admin | Helper legacy | No directo | authenticated/service_role | Fijar search_path | Definir continuidad y grants |
| is_residente | Helper legacy | No directo | authenticated/service_role | Fijar search_path | Definir continuidad y grants |
| is_vigilancia | Helper legacy | No directo | authenticated/service_role | Fijar search_path | Definir continuidad y grants |
| rls_auto_enable | Event trigger helper (SECURITY DEFINER) | No directo | interno DB | **No tocar; preservar `search_path = pg_catalog`** | Revisar necesidad real y ejecutabilidad pública sin ampliar `search_path` |

## Riesgos mitigados
- Reduce riesgo por resolución de objetos en `search_path` implícito.
- Estandariza base técnica para auditoría de funciones sensibles.
- Disminuye variabilidad entre entornos ante shadowing accidental de objetos.

## Riesgos no mitigados todavía
- Exposición amplia de `EXECUTE` a `anon`/`authenticated` en funciones potencialmente internas.
- Exposición amplia de `SELECT` sobre tablas `public` (fuera del alcance de 2C-1).
- Falta de ajuste fino de policies/grants por módulo (queda para fases posteriores).

## Plan de validación en QA
1. Ejecutar migración **solo en QA** por pipeline controlado (no desde frontend).
2. Ejecutar `supabase/audits/post_prod_2c1_verify_function_hardening.sql` y guardar evidencia.
3. Confirmar:
   - 0 funciones objetivo sin `search_path` explícito.
   - inventario de `SECURITY DEFINER` sin cambios inesperados.
   - inventario de `EXECUTE` para `anon`/`authenticated` documentado.
4. Smoke test funcional:
   - flujo de creación de visita (QR), ingreso y salida.
   - consultas de módulos contabilidad/reservas/paquetería/seguridad sin regresiones.

## Plan de rollback conceptual
- Si aparece regresión, crear migración de rollback que restituya `search_path` previo por función impactada.
- Rollback solo vía migración versionada y revisada (sin cambios manuales en PRD).

## Recomendación para POST-PROD 2C-2
- Usar evidencia de `EXECUTE` + uso real frontend para recortar privilegios de funciones internas.
- Priorizar funciones no consumidas por frontend (`handle_new_user`, `set_updated_at`, `rls_auto_enable`, helpers legacy) antes de RPC críticas de visitas.
- Definir matriz final de permisos por función/rol con pruebas positivas/negativas en QA antes de PRD.

## Decisiones explícitas mantenidas
Sin cambios en esta subfase para:
- `vehiculos` (futura)
- `trasteos` (futura)
- `accesos` (posible obsoleta)
- `reservas_zonas` (activa/histórica)
- `zonas_comunes` (posible reemplazo por `recursos_comunes`)
