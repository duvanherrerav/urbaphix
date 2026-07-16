# RELEASE 1.0 — Manifest operativo de migraciones Supabase PRD

Este manifest es la fuente operativa para la promoción controlada de Supabase PRD dentro del issue #290, después del merge QA → main y únicamente cuando el deployment productivo esté READY.

## Alcance y restricciones

- Línea base real esperada en Supabase PRD: proyecto `urbaphix-prd` / ref `oamczhwtilkmtxleaakb`, con `schema_migrations.version = 20260528120000` (`20260528120000_fase_3c1_memberships_rls_base`) ya aplicado.
- Lote pendiente: 25 migraciones versionadas en `supabase/migrations/`, desde FASE 3D.12 hasta el hotfix QA `20260715120000_hotfix_qa_fn_platform_tenants_summary_qualified_conjunto_id.sql`.
- Este documento no ejecuta SQL por sí mismo; cualquier ejecución PRD queda bloqueada hasta confirmar deployment `main` READY, inventario de variables productivas y aprobación operativa explícita.
- No se incluyen archivos de `supabase/validation/` como migraciones.
- Las consultas de precheck/postcheck propuestas son de solo lectura, excepto las 25 migraciones aprobadas cuando se ejecuten manualmente en PRD durante la ventana autorizada.

## Gates obligatorios antes de tocar PRD

1. Confirmar que el PR QA → `main` fue mergeado con revisión aprobada y sin merge directo `develop` → `main`.
2. Confirmar deployment productivo Vercel en estado READY y sirviendo el commit de `main` esperado.
3. Inventariar variables productivas antes de cualquier ejecución: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` deben apuntar a Supabase PRD, no QA/DEV; no registrar secretos en Git.
4. Confirmar proyecto Supabase PRD `urbaphix-prd` / `oamczhwtilkmtxleaakb` antes de ejecutar SQL.
5. Confirmar línea base PRD con `select version from supabase_migrations.schema_migrations where version = '20260528120000';` y confirmar ausencia de las 25 versiones de este manifest antes de iniciar, salvo drift documentado y aprobado.
6. Detener ante cualquier diferencia de ambiente, variable, migración previa inesperada, error de RLS/RPC/grants o smoke productivo fallido.

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
| 25 | `20260715120000_hotfix_qa_fn_platform_tenants_summary_qualified_conjunto_id.sql` | F | Hotfix RPC read-only + DCL | Requiere aplicación única controlada; usa `create or replace function` y revokes/grants tolerantes. |

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
- **Rollback/contingencia:** pausar despliegue; reponer policy legacy solo si smoke productivo bloquea operación y existe aprobación.

### 3. `20260615120000_fase_3d14_paquetes_select_rls_residente_propios.sql`
- **Dependencias:** `paquetes`, `residentes`, `tenant_memberships`, helpers `fn_auth_*`.
- **Objetos afectados:** policies SELECT de `public.paquetes`.
- **Riesgo:** medio, afecta lectura de Mis Paquetes y operación vigilancia.
- **Precheck SQL:** `select policyname, cmd from pg_policies where schemaname='public' and tablename='paquetes' order by policyname;`
- **Postcheck SQL:** `select policyname, roles, cmd, qual from pg_policies where schemaname='public' and tablename='paquetes' order by policyname;`
- **Rollback/contingencia:** mantener PRD detenido sin continuar lotes posteriores; restaurar policy anterior documentada si se confirma regresión crítica.

### 4. `20260615130000_fase_3d15_reservas_zonas_select_rls_residente_propias.sql`
- **Dependencias:** `reservas_zonas`, `residentes`, `tenant_memberships`, `fn_auth_*` y función `fn_reservas_zonas_ocupacion_disponibilidad`.
- **Objetos afectados:** función de ocupación/disponibilidad, grants de esa función y policies SELECT de `public.reservas_zonas`.
- **Riesgo:** medio, combina RPC read-only con RLS de reservas.
- **Precheck SQL:** `select routine_name from information_schema.routines where routine_schema='public' and routine_name='fn_reservas_zonas_ocupacion_disponibilidad'; select policyname from pg_policies where schemaname='public' and tablename='reservas_zonas' order by policyname;`
- **Postcheck SQL:** `select p.proname, pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='fn_reservas_zonas_ocupacion_disponibilidad'; select policyname, qual from pg_policies where schemaname='public' and tablename='reservas_zonas' order by policyname;`
- **Rollback/contingencia:** revertir función/policies a versión previa si falla agenda/check-in productivo.

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
- **Rollback/contingencia:** quitar force RLS o restaurar grants solo si PRD confirma flujo activo no documentado y hay aprobación explícita.

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

## Lote F — hotfix Superadmin validado en QA

### 25. `20260715120000_hotfix_qa_fn_platform_tenants_summary_qualified_conjunto_id.sql`
- **Dependencias:** `conjuntos`, `usuarios_app`, `residentes`, `registro_visitas`, `paquetes`, `pagos`, `fn_is_platform_superadmin()` y `fn_has_platform_role(text)`.
- **Objetos afectados:** reemplazo de `public.fn_platform_tenants_summary()` manteniendo firma, `SECURITY DEFINER`, `search_path`, grants y comportamiento read-only; no toca tablas, RLS ni datos.
- **Riesgo:** bajo-medio, corrige ambigüedad de `conjunto_id` en agregados Superadmin antes de cerrar la alineación PRD del candidato validado en QA.
- **Precheck SQL:** `select routine_name from information_schema.routines where routine_schema='public' and routine_name='fn_platform_tenants_summary'; select has_function_privilege('anon', 'public.fn_platform_tenants_summary()', 'EXECUTE') as anon_execute, has_function_privilege('authenticated', 'public.fn_platform_tenants_summary()', 'EXECUTE') as authenticated_execute;`
- **Postcheck SQL:** ejecutar el bloque DO incluido en la migración y confirmar además que `anon_execute=false`, `authenticated_execute=true`, `service_role_execute=true` para `public.fn_platform_tenants_summary()`.
- **Rollback/contingencia:** reemplazar la RPC por la versión validada inmediatamente anterior si el dashboard Superadmin falla; conservar revokes/grants restrictivos salvo aprobación explícita de seguridad.

## Controles globales antes de autorizar ejecución PRD

1. Confirmar que PRD sigue en la línea base esperada `20260528120000_fase_3c1_memberships_rls_base` antes de iniciar y registrar evidencia no sensible.
2. Aplicar en PRD solo después de deployment `main` READY e inventario de variables productivas validado contra Supabase PRD.
3. Aplicar las 25 migraciones en orden cronológico exacto, incluyendo como último paso el hotfix `20260715120000_hotfix_qa_fn_platform_tenants_summary_qualified_conjunto_id.sql`.
4. Ejecutar precheck del lote antes de cada lote y postcheck después de cada lote; si falla un check, detener y no continuar con el siguiente lote.
5. Ejecutar smoke productivo mínimo por roles autorizados: residente, vigilancia/vigilante, administración/contador y superadmin.
6. Detener el proceso ante el primer fallo de migración, RLS, RPC, grants, login o smoke test, documentar evidencia no sensible y activar contingencia/rollback aprobado.
7. No ejecutar seeds, fixtures ni scripts DEV; los archivos de `supabase/validation/` solo pueden usarse si son explícitamente PRD-safe/read-only y con aprobación operativa.
8. No copiar datos desde QA/DEV, no modificar variables Vercel durante la ventana de SQL y no ejecutar SQL destructivo sin validación explícita.

## Contingencia y rollback PRD

- Prioridad 1: detener la ejecución en el primer error y conservar el estado para diagnóstico; no intentar avanzar parcialmente.
- Prioridad 2: si el error ocurre antes de cambios funcionales visibles, evaluar rollback por migración aprobada o reemplazo de RPC/policy puntual según el apartado de cada migración.
- Prioridad 3: si el frontend productivo falla después del merge pero antes/durante migraciones, preferir rollback frontend o redeploy del último deployment estable antes de tocar datos.
- No borrar datos productivos ni revertir backfills sin aprobación explícita y plan validado.
- Registrar responsable, hora UTC, migración detenida, error, decisión de rollback y postcheck posterior.
