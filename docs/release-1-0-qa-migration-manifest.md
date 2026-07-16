# RELEASE 1.0 — Manifest de migraciones Supabase QA

Este manifest prepara la revisión del lote pendiente para Supabase QA (`tjbdtorqddunpknarzfc`) después de la promoción de código a `qa`.

## Alcance y restricciones

- Línea base confirmada en QA: `20260528120000_fase_3c1_memberships_rls_base`.
- Lote pendiente: 24 migraciones versionadas en `supabase/migrations/`, desde FASE 3D.12 hasta FASE 5.4.3.
- Este documento es solo readiness/manifest: no aplica SQL, no modifica QA/PRD, no cambia RLS en vivo, datos, Edge Functions ni variables Vercel.
- No se incluyen archivos de `supabase/validation/` como migraciones.
- Todas las consultas de precheck/postcheck propuestas son de solo lectura.

## Orden cronológico exacto y lotes seguros

| # | Migración | Lote | Tipo | Idempotencia |
|---:|---|---|---|---|
| 1 | `20260614120000_fase_3d12_pagos_select_rls_residente_propios.sql` | A | DDL/RLS | Requiere aplicación única; usa `drop policy if exists` y `enable row level security` para tolerar repetición parcial, pero `create policy` no es idempotente si ya existe. |
| 2 | `20260614130000_fase_3d13_residentes_select_rls_propietario.sql` | A | DDL/RLS | Requiere aplicación única; policies recreadas tras `drop policy if exists`. |
| 3 | `20260615120000_fase_3d14_paquetes_select_rls_residente_propios.sql` | A | DDL/RLS | Requiere aplicación única; policies recreadas tras `drop policy if exists`. |
| 4 | `20260615130000_fase_3d15_reservas_zonas_select_rls_residente_propias.sql` | A | DDL/RLS + reemplazo RPC + DCL | Requiere aplicación única; RPC usa `create or replace`, policies se recrean. |
| 5 | `20260618120000_fase_3d16_visitantes_registro_visitas_select_rls.sql` | A | DDL/RLS | Requiere aplicación única; policies recreadas tras `drop policy if exists`. |
| 6 | `20260620120000_fase_3d19_tenant_memberships_select_residente_self.sql` | A | DDL/RLS | Requiere aplicación única; policy principal se recrea. |
| 7 | `20260621120000_fase_3d22_config_pagos_select_rls.sql` | A | DDL/RLS | Requiere aplicación única; policy se recrea. |
| 8 | `20260705184500_harden_rpc_anon_execute_security_definer.sql` | B | DCL | Idempotente; `revoke execute` tolera privilegios ya ausentes. |
| 9 | `20260706130000_deny_legacy_rls_no_policy_tables.sql` | B | DDL/RLS + DCL | Requiere aplicación única; policies se recrean, `revoke` idempotente. |
| 10 | `20260706143000_fase_3d29_reubicar_btree_gist_extensions.sql` | B | DDL/extensión | Idempotente por `create schema if not exists`, `create extension if not exists` y bloque condicional para mover extensión. |
| 11 | `20260707120000_fase_3d32_revoke_anon_grants_archivos_usuarios_app.sql` | B | DCL | Idempotente. |
| 12 | `20260707130000_fase_3d34_revoke_anon_grants_memberships.sql` | B | DCL | Idempotente. |
| 13 | `20260708120000_fase_3d36_revoke_anon_grants_visitas.sql` | B | DCL | Idempotente. |
| 14 | `20260708130000_fase_4_2_platform_dashboard_metrics_rpc.sql` | C | Reemplazo RPC + DCL | Requiere aplicación única controlada; RPC es `create or replace`, grants/revokes son tolerantes. |
| 15 | `20260709120000_fase_4_3_platform_tenants_summary_rpc.sql` | C | Reemplazo RPC + DCL | Requiere aplicación única controlada; RPC es `create or replace`. |
| 16 | `20260709130000_fase_4_4_platform_memberships_summary_rpc.sql` | C | Reemplazo RPC + DCL | Requiere aplicación única controlada; RPC es `create or replace`. |
| 17 | `20260709143000_fase_4_5_platform_operations_summary_rpc.sql` | C | Reemplazo RPC + DCL | Requiere aplicación única controlada; RPC es `create or replace`. |
| 18 | `20260709153000_fase_4_6_platform_audit_summary_rpc.sql` | C | Reemplazo RPC + DCL | Requiere aplicación única controlada; RPC es `create or replace`. |
| 19 | `20260709170000_fase_5_1_tenant_lifecycle.sql` | D | DDL + DCL + RLS + backfill | Parcialmente idempotente; tabla/índices usan `if not exists`, pero el backfill debe ejecutarse una sola vez por tenant. |
| 20 | `20260710120000_fase_5_2_rpc_lifecycle_tenants.sql` | D | DDL + DCL + RLS + reemplazo RPC | Parcialmente idempotente; tabla/índices con `if not exists`, policy/RPC recreadas. |
| 21 | `20260710150000_fase_5_3_platform_tenants_lifecycle_summary_rpc.sql` | D | Reemplazo RPC + DCL | Requiere aplicación única controlada; RPC es `create or replace`. |
| 22 | `20260710170000_fase_5_4_1_fn_tenant_is_operational.sql` | D | Reemplazo RPC/helper + DCL | Requiere aplicación única controlada; RPC es `create or replace`. |
| 23 | `20260714120000_fase_5_4_2a_lifecycle_visitas_ingreso_salida.sql` | E | Reemplazo RPC + DCL | Requiere aplicación única controlada; reemplaza RPC legacy de ingreso/salida. |
| 24 | `20260714130000_fase_5_4_3_lifecycle_creacion_visitas.sql` | E | Reemplazo RPC + DCL | Requiere aplicación única controlada; reemplaza RPC legacy de creación de visitas. |

## Lote A — hardening RLS SELECT por módulo

### 1. `20260614120000_fase_3d12_pagos_select_rls_residente_propios.sql`
- **Dependencias:** `pagos`, `residentes`, `tenant_memberships`, `fn_auth_rol()`, `fn_auth_conjunto_id()`, `fn_auth_residente_id()`.
- **Objetos afectados:** RLS/policies SELECT de `public.pagos`.
- **Riesgo:** medio, por endurecer visibilidad de pagos de residentes.
- **Precheck SQL:** `select tablename, rowsecurity from pg_tables where schemaname='public' and tablename='pagos'; select policyname, cmd from pg_policies where schemaname='public' and tablename='pagos' order by policyname;`
- **Postcheck SQL:** `select policyname, cmd, qual from pg_policies where schemaname='public' and tablename='pagos' order by policyname;`
- **Rollback/contingencia:** detener el lote si falla; restaurar policies previas desde backup/migración anterior solo con aprobación explícita.

### 2. `20260614130000_fase_3d13_residentes_select_rls_propietario.sql`
- **Dependencias:** `residentes`, `tenant_memberships`, helpers `fn_auth_*`.
- **Objetos afectados:** policies SELECT de `public.residentes` para admin, residente propio y vigilancia lookup.
- **Riesgo:** medio, puede afectar búsquedas operativas de portería/paquetería.
- **Precheck SQL:** `select policyname, cmd from pg_policies where schemaname='public' and tablename='residentes' order by policyname;`
- **Postcheck SQL:** `select policyname, roles, cmd, qual from pg_policies where schemaname='public' and tablename='residentes' order by policyname;`
- **Rollback/contingencia:** pausar despliegue; reponer policy legacy solo si QA smoke tests bloquean operación y existe aprobación.

### 3. `20260615120000_fase_3d14_paquetes_select_rls_residente_propios.sql`
- **Dependencias:** `paquetes`, `residentes`, `tenant_memberships`, helpers `fn_auth_*`.
- **Objetos afectados:** policies SELECT de `public.paquetes`.
- **Riesgo:** medio, afecta lectura de Mis Paquetes y operación vigilancia.
- **Precheck SQL:** `select policyname, cmd from pg_policies where schemaname='public' and tablename='paquetes' order by policyname;`
- **Postcheck SQL:** `select policyname, roles, cmd, qual from pg_policies where schemaname='public' and tablename='paquetes' order by policyname;`
- **Rollback/contingencia:** mantener QA sin promover; restaurar policy anterior documentada si se confirma regresión crítica.

### 4. `20260615130000_fase_3d15_reservas_zonas_select_rls_residente_propias.sql`
- **Dependencias:** `reservas_zonas`, `residentes`, `tenant_memberships`, `fn_auth_*` y función `fn_reservas_zonas_ocupacion_disponibilidad`.
- **Objetos afectados:** función de ocupación/disponibilidad, grants de esa función y policies SELECT de `public.reservas_zonas`.
- **Riesgo:** medio, combina RPC read-only con RLS de reservas.
- **Precheck SQL:** `select routine_name from information_schema.routines where routine_schema='public' and routine_name='fn_reservas_zonas_ocupacion_disponibilidad'; select policyname from pg_policies where schemaname='public' and tablename='reservas_zonas' order by policyname;`
- **Postcheck SQL:** `select p.proname, pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='fn_reservas_zonas_ocupacion_disponibilidad'; select policyname, qual from pg_policies where schemaname='public' and tablename='reservas_zonas' order by policyname;`
- **Rollback/contingencia:** revertir función/policies a versión previa si falla agenda/check-in en QA.

### 5. `20260618120000_fase_3d16_visitantes_registro_visitas_select_rls.sql`
- **Dependencias:** `visitantes`, `registro_visitas`, `residentes`, `tenant_memberships`, helpers `fn_auth_*`.
- **Objetos afectados:** policies SELECT de `public.visitantes` y `public.registro_visitas`.
- **Riesgo:** alto, módulo visitas es operativo y sensible a aislamiento por residente/conjunto.
- **Precheck SQL:** `select tablename, policyname, cmd from pg_policies where schemaname='public' and tablename in ('visitantes','registro_visitas') order by tablename, policyname;`
- **Postcheck SQL:** `select tablename, policyname, roles, cmd, qual from pg_policies where schemaname='public' and tablename in ('visitantes','registro_visitas') order by tablename, policyname;`
- **Rollback/contingencia:** detener antes de lotes posteriores de visitas; restaurar policies previas si smoke tests de residente/vigilancia fallan.

### 6. `20260620120000_fase_3d19_tenant_memberships_select_residente_self.sql`
- **Dependencias:** `tenant_memberships`, roles de tenant, helpers `fn_auth_*`.
- **Objetos afectados:** policy SELECT principal de `public.tenant_memberships`.
- **Riesgo:** alto, afecta resolución de membresía y bootstrap autenticado.
- **Precheck SQL:** `select policyname, cmd, qual from pg_policies where schemaname='public' and tablename='tenant_memberships' order by policyname;`
- **Postcheck SQL:** `select policyname, roles, cmd, qual from pg_policies where schemaname='public' and tablename='tenant_memberships' order by policyname;`
- **Rollback/contingencia:** no continuar si falla login/bootstrap; reponer policy anterior bajo aprobación.

### 7. `20260621120000_fase_3d22_config_pagos_select_rls.sql`
- **Dependencias:** `config_pagos`, `tenant_memberships`, `fn_has_platform_role`, `fn_auth_conjunto_id()`.
- **Objetos afectados:** policy SELECT de `public.config_pagos`.
- **Riesgo:** medio, corrige exposición anónima de configuración de pagos.
- **Precheck SQL:** `select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='config_pagos' order by grantee, privilege_type; select policyname, qual from pg_policies where schemaname='public' and tablename='config_pagos';`
- **Postcheck SQL:** `select policyname, roles, cmd, qual from pg_policies where schemaname='public' and tablename='config_pagos' order by policyname;`
- **Rollback/contingencia:** pausar promoción si admins/contadores no leen configuración; evitar restaurar acceso anon salvo autorización explícita.

## Lote B — hardening grants/legacy/extension

### 8. `20260705184500_harden_rpc_anon_execute_security_definer.sql`
- **Dependencias:** funciones `fn_is_platform_superadmin`, `fn_has_platform_role`, `fn_has_tenant_access`, `fn_has_tenant_role`, `fn_reservas_zonas_ocupacion_disponibilidad`.
- **Objetos afectados:** privilegio EXECUTE de `anon` en RPC SECURITY DEFINER.
- **Riesgo:** medio.
- **Precheck SQL:** `select routine_name, grantee, privilege_type from information_schema.routine_privileges where specific_schema='public' and grantee='anon' order by routine_name;`
- **Postcheck SQL:** misma consulta, verificando ausencia de EXECUTE anon para las funciones objetivo.
- **Rollback/contingencia:** reotorgar EXECUTE a `anon` solo si se identifica dependencia pública legítima y se aprueba por seguridad.

### 9. `20260706130000_deny_legacy_rls_no_policy_tables.sql`
- **Dependencias:** tablas legacy `operational_events`, `trasteos`, `vehiculos`.
- **Objetos afectados:** RLS forzado, revokes y policies deny-client.
- **Riesgo:** bajo, tablas fuera de flujos activos según migración.
- **Precheck SQL:** `select c.relname as tablename, c.relrowsecurity as rowsecurity, c.relforcerowsecurity as forcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and c.relname in ('operational_events','trasteos','vehiculos') order by c.relname;`
- **Postcheck SQL:** `select tablename, policyname, qual from pg_policies where schemaname='public' and tablename in ('operational_events','trasteos','vehiculos') order by tablename;`
- **Rollback/contingencia:** quitar force RLS o restaurar grants solo si QA confirma flujo activo no documentado.

### 10. `20260706143000_fase_3d29_reubicar_btree_gist_extensions.sql`
- **Dependencias:** extensión `btree_gist`, schema `extensions`, constraint `reservas_zonas_no_solape`.
- **Objetos afectados:** schema de extensión; no tablas/RLS.
- **Riesgo:** bajo-medio, toca dependencia de constraint de reservas.
- **Precheck SQL:** `select extname, n.nspname as schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where extname='btree_gist';`
- **Postcheck SQL:** misma consulta, esperando schema `extensions`.
- **Rollback/contingencia:** `ALTER EXTENSION btree_gist SET SCHEMA public;` No usar `DROP EXTENSION`.

### 11. `20260707120000_fase_3d32_revoke_anon_grants_archivos_usuarios_app.sql`
- **Dependencias:** tablas `archivos`, `usuarios_app`.
- **Objetos afectados:** grants anon.
- **Riesgo:** bajo.
- **Precheck SQL:** `select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('archivos','usuarios_app') and grantee='anon' order by table_name, privilege_type;`
- **Postcheck SQL:** misma consulta, esperando cero filas para `anon`.
- **Rollback/contingencia:** reotorgar privilegios puntuales solo si aparece flujo anon documentado.

### 12. `20260707130000_fase_3d34_revoke_anon_grants_memberships.sql`
- **Dependencias:** `tenant_memberships`, `platform_memberships`.
- **Objetos afectados:** grants anon.
- **Riesgo:** bajo.
- **Precheck SQL:** `select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('tenant_memberships','platform_memberships') and grantee='anon' order by table_name, privilege_type;`
- **Postcheck SQL:** misma consulta, esperando cero filas para `anon`.
- **Rollback/contingencia:** no restaurar anon salvo autorización explícita de seguridad.

### 13. `20260708120000_fase_3d36_revoke_anon_grants_visitas.sql`
- **Dependencias:** `visitantes`, `registro_visitas`.
- **Objetos afectados:** grants anon.
- **Riesgo:** bajo-medio por módulo operativo.
- **Precheck SQL:** `select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('visitantes','registro_visitas') and grantee='anon' order by table_name, privilege_type;`
- **Postcheck SQL:** misma consulta, esperando cero filas para `anon`.
- **Rollback/contingencia:** restaurar grants anon solo si existe dependencia pública validada; preferir corregir frontend autenticado.

## Lote C — RPCs Superadmin

### 14. `20260708130000_fase_4_2_platform_dashboard_metrics_rpc.sql`
- **Dependencias:** `fn_has_platform_role(text)` y tablas agregadas operativas.
- **Objetos afectados:** `fn_platform_dashboard_metrics()` y grants.
- **Riesgo:** bajo, solo agregados read-only.
- **Precheck SQL:** `select routine_name from information_schema.routines where routine_schema='public' and routine_name='fn_platform_dashboard_metrics';`
- **Postcheck SQL:** `select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and routine_name='fn_platform_dashboard_metrics' order by grantee;`
- **Rollback/contingencia:** reemplazar función por versión previa o revocar EXECUTE authenticated si devuelve datos inesperados.

### 15. `20260709120000_fase_4_3_platform_tenants_summary_rpc.sql`
- **Dependencias:** `conjuntos`, `tenant_memberships`, `fn_has_platform_role(text)`.
- **Objetos afectados:** `fn_platform_tenants_summary()` y grants.
- **Riesgo:** bajo-medio, expone resumen de tenants sin PII sensible.
- **Precheck SQL:** `select count(*) from public.conjuntos; select routine_name from information_schema.routines where routine_schema='public' and routine_name='fn_platform_tenants_summary';`
- **Postcheck SQL:** `select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and routine_name='fn_platform_tenants_summary' order by grantee;`
- **Rollback/contingencia:** revocar EXECUTE o reemplazar por versión previa si el resumen no respeta alcance plataforma.

### 16. `20260709130000_fase_4_4_platform_memberships_summary_rpc.sql`
- **Dependencias:** `platform_memberships`, `tenant_memberships`, `usuarios_app`, `conjuntos`, `fn_has_platform_role(text)`.
- **Objetos afectados:** `fn_platform_memberships_summary()` y grants.
- **Riesgo:** medio por datos de membresías.
- **Precheck SQL:** `select count(*) from public.tenant_memberships; select count(*) from public.platform_memberships;`
- **Postcheck SQL:** `select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and routine_name='fn_platform_memberships_summary' order by grantee;`
- **Rollback/contingencia:** revocar EXECUTE authenticated y revisar minimización de campos.

### 17. `20260709143000_fase_4_5_platform_operations_summary_rpc.sql`
- **Dependencias:** tablas operativas de pagos, paquetes, reservas, visitas e incidentes si existen según schema.
- **Objetos afectados:** `fn_platform_operations_summary()` y grants.
- **Riesgo:** bajo-medio por agregados cross-tenant.
- **Precheck SQL:** `select routine_name from information_schema.routines where routine_schema='public' and routine_name='fn_platform_operations_summary';`
- **Postcheck SQL:** `select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and routine_name='fn_platform_operations_summary' order by grantee;`
- **Rollback/contingencia:** revocar EXECUTE authenticated si métricas exponen detalle no agregado.

### 18. `20260709153000_fase_4_6_platform_audit_summary_rpc.sql`
- **Dependencias:** tablas/eventos de auditoría y `fn_has_platform_role(text)`.
- **Objetos afectados:** `fn_platform_audit_summary()` y grants.
- **Riesgo:** medio por trazabilidad cross-tenant, aunque bucketizada.
- **Precheck SQL:** `select routine_name from information_schema.routines where routine_schema='public' and routine_name='fn_platform_audit_summary';`
- **Postcheck SQL:** `select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and routine_name='fn_platform_audit_summary' order by grantee;`
- **Rollback/contingencia:** revocar EXECUTE authenticated ante exposición de labels libres o metadata inesperada.

## Lote D — lifecycle tenant

### 19. `20260709170000_fase_5_1_tenant_lifecycle.sql`
- **Dependencias:** `conjuntos`.
- **Objetos afectados:** tabla `tenant_lifecycle`, índices, comments, RLS, grants, policy platform y backfill inicial desde `conjuntos`.
- **Riesgo:** alto, introduce estructura base de lifecycle y backfill.
- **Precheck SQL:** `select count(*) as conjuntos from public.conjuntos; select to_regclass('public.tenant_lifecycle') as tenant_lifecycle;`
- **Postcheck SQL:** `select count(*) as lifecycle_rows from public.tenant_lifecycle; select c.relname as tablename, c.relrowsecurity as rowsecurity, c.relforcerowsecurity as forcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and c.relname = 'tenant_lifecycle';`
- **Rollback/contingencia:** si falla antes de uso funcional, retirar tabla/índices con migración de rollback aprobada; no borrar datos sin validación explícita.

### 20. `20260710120000_fase_5_2_rpc_lifecycle_tenants.sql`
- **Dependencias:** `tenant_lifecycle`, `conjuntos`, `fn_has_platform_role(text)`.
- **Objetos afectados:** tabla `tenant_lifecycle_events`, índices, RLS/grants/policy y RPC `fn_platform_transition_tenant_lifecycle(uuid,text,text)`.
- **Riesgo:** alto, habilita transición controlada de estado por RPC.
- **Precheck SQL:** `select to_regclass('public.tenant_lifecycle') as tenant_lifecycle, to_regclass('public.tenant_lifecycle_events') as events;`
- **Postcheck SQL:** `select c.relname as tablename, c.relrowsecurity as rowsecurity, c.relforcerowsecurity as forcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and c.relname in ('tenant_lifecycle','tenant_lifecycle_events') order by c.relname; select routine_name from information_schema.routines where routine_schema='public' and routine_name='fn_platform_transition_tenant_lifecycle';`
- **Rollback/contingencia:** revocar EXECUTE de la RPC si las transiciones fallan; conservar eventos para auditoría salvo aprobación destructiva.

### 21. `20260710150000_fase_5_3_platform_tenants_lifecycle_summary_rpc.sql`
- **Dependencias:** `tenant_lifecycle`, `conjuntos`, `fn_has_platform_role(text)`.
- **Objetos afectados:** `fn_platform_tenants_lifecycle_summary()` y grants.
- **Riesgo:** medio.
- **Precheck SQL:** `select to_regclass('public.tenant_lifecycle') as tenant_lifecycle; select routine_name from information_schema.routines where routine_schema='public' and routine_name='fn_platform_tenants_lifecycle_summary';`
- **Postcheck SQL:** `select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and routine_name='fn_platform_tenants_lifecycle_summary' order by grantee;`
- **Rollback/contingencia:** revocar EXECUTE o reemplazar función si el backoffice muestra estados erróneos.

### 22. `20260710170000_fase_5_4_1_fn_tenant_is_operational.sql`
- **Dependencias:** `tenant_lifecycle`.
- **Objetos afectados:** helper `fn_tenant_is_operational(uuid,text)` y grants restringidos a `service_role`.
- **Riesgo:** alto, será dependencia de bloqueos operativos posteriores.
- **Precheck SQL:** `select to_regclass('public.tenant_lifecycle') as tenant_lifecycle; select routine_name from information_schema.routines where routine_schema='public' and routine_name='fn_tenant_is_operational';`
- **Postcheck SQL:** `select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and routine_name='fn_tenant_is_operational' order by grantee;`
- **Rollback/contingencia:** reemplazar helper por versión previa o revocar si bloquea tenants activos incorrectamente.

## Lote E — lifecycle visitas

### 23. `20260714120000_fase_5_4_2a_lifecycle_visitas_ingreso_salida.sql`
- **Dependencias:** helper `fn_tenant_is_operational`, `registro_visitas`, `visitantes`, RPC legacy `fn_registrar_ingreso_visita(text,uuid)` y `fn_registrar_salida_visita(uuid,uuid)`.
- **Objetos afectados:** reemplazo de RPCs de ingreso/salida de visitas y grants.
- **Riesgo:** alto, afecta operación de portería.
- **Precheck SQL:** `select routine_name from information_schema.routines where routine_schema='public' and routine_name in ('fn_tenant_is_operational','fn_registrar_ingreso_visita','fn_registrar_salida_visita') order by routine_name;`
- **Postcheck SQL:** `select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and routine_name in ('fn_registrar_ingreso_visita','fn_registrar_salida_visita') order by routine_name, grantee;`
- **Rollback/contingencia:** reemplazar RPCs por versiones previas si portería no puede registrar ingreso/salida en tenants operacionales.

### 24. `20260714130000_fase_5_4_3_lifecycle_creacion_visitas.sql`
- **Dependencias:** helper `fn_tenant_is_operational`, `visitantes`, `registro_visitas`, `residentes`, RPC legacy `fn_crear_o_reutilizar_visitante_y_registro`.
- **Objetos afectados:** reemplazo de RPC de creación/reutilización de visitante y registro, grants.
- **Riesgo:** alto, afecta Solicitar Visita y creación operativa.
- **Precheck SQL:** `select routine_name from information_schema.routines where routine_schema='public' and routine_name in ('fn_tenant_is_operational','fn_crear_o_reutilizar_visitante_y_registro') order by routine_name;`
- **Postcheck SQL:** `select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and routine_name='fn_crear_o_reutilizar_visitante_y_registro' order by grantee;`
- **Rollback/contingencia:** reemplazar RPC por versión previa si creación de visitas falla para residentes válidos en tenants operacionales.

## Controles globales antes de autorizar ejecución

1. Confirmar que QA sigue en `20260528120000_fase_3c1_memberships_rls_base` antes de iniciar.
2. Aplicar solo a QA, en orden cronológico, sin PRD.
3. Ejecutar precheck del lote antes de cada lote y postcheck después de cada lote.
4. Ejecutar smoke tests por rol: residente, vigilancia/vigilante, administración/contador y superadmin.
5. Detener el proceso ante el primer fallo de RLS/RPC y documentar evidencia antes de continuar.
6. No ejecutar seeds, fixtures ni scripts de `supabase/validation/` en QA como parte del lote.
