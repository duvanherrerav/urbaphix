# Issue #307 — Normalización canónica hacia `develop`

## Alcance de este cambio

Este cambio deja versionadas en `develop` las definiciones permanentes que la auditoría de #307 confirmó como canónicas en QA/PRD. No aplica SQL a ningún proyecto Supabase, no modifica datos, secretos, variables de Vercel ni `schema_migrations`.

## Artefactos incorporados

- Se conserva sin cambios el hotfix histórico `20260715120000_hotfix_qa_fn_platform_tenants_summary_qualified_conjunto_id.sql` que ya existía en QA/PRD.
- La migración forward-only `20260722130000_canonical_qa_prd_function_rls_reconciliation.sql` reconcilia las diez funciones auditadas y las cuatro policies auditadas de `reservas_zonas` y `visitantes`.
- La migración reafirma las propiedades canónicas de seguridad: owner `postgres`, `SECURITY DEFINER` o `SECURITY INVOKER`, volatilidad, `search_path` y grants. Incluye postchecks transaccionales.

## Diferencias intencionales por ambiente

No se versionan ni se intentan igualar datos, secretos, credenciales, URLs, variables de Vercel o estados operativos propios de cada ambiente. No hay diferencias de esquema o seguridad intencionales para los objetos reconciliados.

## Promoción controlada

Aplicar primero en Supabase DEV después de aprobar este PR y ejecutar sus postchecks. Solo tras DEV PASS, promover el mismo commit por `develop → qa → main`; esta entrega no aplica la migración en QA ni PRD.


## Baseline canónico y promoción preparada

La auditoría semántica posterior a DEV fija como baseline canónico las definiciones de funciones y policies ya versionadas en `20260722130000_canonical_qa_prd_function_rls_reconciliation.sql` y aplicadas con postchecks PASS en DEV. Para los objetos auditados, este baseline corresponde a DEV/PRD: conserva el hotfix calificado de `fn_platform_tenants_summary()` y las cuatro policies scoped de `reservas_zonas` y `visitantes` que verifican `conjunto_id` y, cuando corresponde, `residente_id`.

La migración forward-only `20260723120000_promote_canonical_qa_prd_function_rls.sql` reaplica exactamente esas definiciones durante una promoción controlada a QA y posteriormente a PRD. Es idempotente para los objetos auditados (`CREATE OR REPLACE FUNCTION` y recreación explícita de las cuatro policies), no reescribe migraciones anteriores y no ejecuta ningún cambio remoto por estar versionada. Sus postchecks verifican firmas, atributos de seguridad, owners, grants y predicados canónicos normalizados de las policies; no dependen de hashes ni del formato de salida de `pg_get_functiondef`.

La migración **no debe aplicarse** en QA ni PRD hasta una revisión explícita del commit complementario. No se modifican datos, tablas, columnas, FKs, secretos ni `schema_migrations`.
