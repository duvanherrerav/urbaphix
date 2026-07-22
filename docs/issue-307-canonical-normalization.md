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
