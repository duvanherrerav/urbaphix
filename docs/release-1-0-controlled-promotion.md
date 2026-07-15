# RELEASE 1.0 — Promoción controlada DEV → QA → PRD

## Objetivo

Definir el procedimiento operativo para promover de forma controlada el estado estable de `develop` hacia `qa` y posteriormente de `qa` hacia `main`, incluyendo código, Vercel y migraciones Supabase aprobadas antes de iniciar `RC 1.0 — Auditoría integral para Google Play`.

Este documento no ejecuta la promoción. Solo fija la secuencia, restricciones, validaciones y evidencia mínima para que el release sea trazable y reversible.

## Alcance estricto

Incluido:

- Auditoría de diferencias entre `develop`, `qa` y `main`.
- Reconciliación de ramas sin reescribir historia.
- PR controlado `develop` → `qa`.
- Aplicación ordenada en Supabase QA de migraciones faltantes hasta el candidato aprobado.
- Validación QA de build, variables, roles, RLS, grants, lifecycle y smoke tests.
- PR controlado `qa` → `main` solo después de QA PASS.
- Aplicación ordenada en Supabase PRD de migraciones aprobadas.
- Validación post-deploy y plan de rollback.

Fuera de alcance:

- No desplegar QA y PRD al mismo tiempo.
- No hacer merge directo `develop` → `main`.
- No aplicar migraciones a PRD antes de QA PASS.
- No promover seeds, fixtures ni scripts de validación DEV.
- No copiar datos DEV a QA o PRD.
- No cambiar variables de entorno sin inventario previo.
- No ejecutar SQL destructivo sin validación explícita y plan aprobado.

## Fuentes de verdad antes de operar

Antes de preparar o revisar cualquier paso de base de datos, validar en este orden:

1. `docs/database-schema.md` para confirmar tablas, columnas, FKs, RLS, helpers y notas de fase.
2. `supabase/migrations/` para confirmar el orden real de migraciones versionadas.
3. `src/services/` para confirmar consumo frontend de Supabase y variables públicas.
4. Módulos del proyecto que consumen Supabase para validar impacto funcional.

Si se detecta drift entre documentación, migraciones y consumo de la app, detener la promoción y abrir un ajuste separado antes de continuar.

## Secuencia obligatoria

### 1. Auditoría de ramas

Ejecutar desde un clon limpio o con árbol de trabajo limpio:

```bash
git fetch origin --prune
git status --short --branch
git log --oneline --decorate -n 20 origin/develop
git log --oneline --decorate -n 20 origin/qa
git log --oneline --decorate -n 20 origin/main

# Auditoría bidireccional de commits exclusivos antes de reconciliar.
git log --left-right --cherry-pick --oneline origin/qa...origin/develop
git log --left-right --cherry-pick --oneline origin/main...origin/qa

# Diff tip-to-tip para ver diferencias acumuladas entre puntas reales.
git diff --stat origin/qa origin/develop
git diff --stat origin/main origin/qa

# Diff contra merge-base opcional para revisar el candidato del lado derecho.
git diff --stat origin/qa...origin/develop
git diff --stat origin/main...origin/qa
```

Criterios:

- `develop` contiene el candidato estable hasta FASE 5.4.3.
- `qa` y `main` pueden estar divergidos, pero no deben reconciliarse reescribiendo historia.
- Los commits exclusivos de ambos lados (`<` y `>`) deben revisarse explícitamente antes de reconciliar y promover.
- El diff tip-to-tip debe revisarse junto con el diff opcional contra merge-base; usar solo `A...B` puede ocultar cambios exclusivos del destino.
- El diff debe excluir secretos, archivos `.env` reales, seeds, fixtures y scripts DEV no autorizados.

### 2. Reconciliación sin reescritura de historia

Usar PRs o merges controlados. No usar `push --force`, rebase publicado ni commits directos sobre `qa` o `main`.

Si aparecen conflictos:

- Resolverlos en una rama de trabajo derivada del destino correspondiente.
- Mantener el alcance del release; no introducir refactors oportunistas.
- Repetir `git diff --check` y builds después de resolver.

### 3. PR `develop` → `qa`

Abrir un PR pequeño y trazable desde `develop` hacia `qa` con:

- Resumen de commits incluidos.
- Lista de migraciones Supabase pendientes para QA, en orden cronológico.
- Confirmación de que no incluye seeds, fixtures ni scripts DEV no autorizados.
- Plan de validación QA.
- Responsable de aplicar migraciones QA y responsable de rollback.

No fusionar este PR si no existe plan claro para migraciones QA y validación posterior.

### 4. Migraciones Supabase en QA

Aplicar en QA únicamente las migraciones faltantes aprobadas y en el orden de `supabase/migrations/`.

Antes de aplicar:

- Confirmar proyecto Supabase QA por URL/identificador no sensible.
- Confirmar que no se está conectado a PRD.
- Confirmar inventario de migraciones ya aplicadas en QA.
- Confirmar que no se aplicarán seeds, fixtures ni scripts de validación DEV.
- Confirmar que cualquier migración con impacto operativo tiene rollback o plan de mitigación documentado.

Después de aplicar:

- Registrar migraciones aplicadas y timestamp.
- Validar que no hay drift requerido para el release.
- Validar RLS, grants y helpers relevantes para el alcance.

### 5. Validación QA obligatoria

QA se considera PASS solo si todas las validaciones aplicables tienen evidencia no sensible:

| Dimensión | Validación mínima |
| --- | --- |
| Build QA | `npm run build:qa` pasa con variables QA. |
| Variables | Vercel QA usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de QA; no usa PROD ni DEV. |
| Roles | Login/logout y navegación por roles principales. |
| RLS | Acceso same-tenant, filtros por `conjunto_id`, `residente_id` y `auth.uid()` respetados. |
| Grants | Sin exposición inesperada para `anon`; permisos `authenticated` alineados con módulos activos. |
| Lifecycle | Funciones y bloqueos lifecycle operan según fases 5.x aplicadas. |
| Smoke tests | Visitas/Portería, Paquetería, rutas protegidas, consola y Network sin errores críticos. |
| Vercel QA | Deployment QA en estado READY y apuntando al ambiente correcto. |

Si una validación falla, declarar QA NO-GO, no abrir PR `qa` → `main` y corregir mediante PR separado hacia `develop` o mediante la ruta de reconciliación aprobada.

### 6. PR `qa` → `main`

Solo con QA PASS, abrir PR desde `qa` hacia `main`.

El PR debe incluir:

- Evidencia resumida de QA PASS.
- Commit o rango de commits incluidos.
- Migraciones aprobadas que se aplicarán en PRD.
- Confirmación de que no se hizo merge directo `develop` → `main`.
- Plan de deploy Vercel PRD.
- Plan de rollback frontend y base de datos si aplica.

### 7. Migraciones Supabase en PRD

Aplicar en PRD únicamente las migraciones ya aprobadas y validadas en QA, en el mismo orden.

Controles obligatorios:

- Confirmar proyecto Supabase PRD antes de ejecutar cualquier comando.
- No aplicar migraciones adicionales no validadas en QA.
- No copiar datos desde DEV ni QA.
- No ejecutar SQL destructivo sin aprobación explícita.
- Registrar evidencia no sensible de migraciones aplicadas y validaciones posteriores.

### 8. Deploy y validación post-deploy PRD

Después del merge `qa` → `main` y deploy productivo:

- Confirmar Vercel PRD en READY.
- Confirmar dominio productivo y fallback SPA.
- Confirmar que Network llama a Supabase PRD.
- Ejecutar smoke test de login/logout, rutas protegidas, Visitas/Portería y Paquetería.
- Verificar consola sin errores críticos.
- Confirmar que no hay drift de esquema requerido para el release.

## Rollback

### Frontend

Opciones permitidas:

1. Revertir el PR de release en `main` y redeployar.
2. Redeployar el último deployment productivo estable desde Vercel si está disponible.

### Base de datos

- No improvisar rollback destructivo durante incidente.
- Usar únicamente rollback documentado por migración o mitigación aprobada.
- Si el problema no requiere revertir esquema, preferir rollback frontend o bloqueo operativo controlado.
- Registrar causa, decisión, responsable, hora y validaciones posteriores.

## Criterio de aceptación

El release queda listo para iniciar `RC 1.0 — Auditoría integral para Google Play` cuando:

- Las ramas están reconciliadas y la promoción es trazable.
- QA tiene evidencia PASS.
- PRD queda alineado en código y esquema aprobado.
- Vercel QA y PRD están en READY.
- Supabase QA y PRD no tienen drift requerido para el release.
- El plan de rollback está documentado y tiene responsable.
