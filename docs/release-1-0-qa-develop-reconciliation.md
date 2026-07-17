# RELEASE 1.0 — Reconciliación `qa + develop`

## Alcance

Este documento registra la reconciliación no destructiva solicitada para preparar la promoción controlada de `develop` hacia `qa`.

- Rama base de trabajo: `origin/qa`.
- Rama de reconciliación: `release/reconcile-qa-develop-1-0`.
- Rama incorporada: `origin/develop`.
- Estrategia: `git merge --no-ff origin/develop` desde una rama derivada de `qa`.
- Destino del PR: `qa`.

No se aplicaron migraciones en Supabase QA/PRD, no se modificaron variables de Vercel, no se copiaron datos DEV y no se hizo merge directo a `qa`, `main` ni producción.

## Auditoría previa ejecutada

Comandos obligatorios ejecutados antes de la reconciliación:

```bash
git fetch origin --prune
git log --left-right --cherry-pick --oneline origin/qa...origin/develop
git diff --stat origin/qa origin/develop
git diff --name-status origin/qa origin/develop
```

Resultado base confirmado:

- `origin/qa`: `88396cd8d4dabaff7059179e2637830cecb948de`.
- `origin/develop`: `067269d4115f96f444da398a6f18582fe72d2570`.
- Diferencia sin filtrado cherry-pick: `qa` está 33 commits adelante y `develop` 138 commits adelante.
- Diferencia con `--cherry-pick`: 28 commits exclusivos no equivalentes en `qa` y 137 commits exclusivos no equivalentes en `develop`.
- Diff de archivos entre ramas: 100 archivos, 15.478 inserciones y 48 eliminaciones.

## 1. Commits exclusivos de `qa`

Los commits exclusivos no equivalentes de `qa` son merges históricos de `develop` hacia `qa`; no contienen cambios funcionales únicos que deban descartarse. Se conservaron mediante el merge no destructivo porque la rama de trabajo parte de `origin/qa`.

```text
< 98e4643 Merge branch 'develop' into qa
< 6175796 Merge branch 'develop' into qa
< a0bee70 Merge branch 'develop' into qa
< 21df6fd Merge branch 'develop' into qa
< 5f50119 Merge branch 'develop' into qa
< 6ff2e80 Merge branch 'develop' into qa
< 5698c80 Merge branch 'develop' into qa
< f6ad8e0 Merge branch 'develop' into qa
< a2d7b58 Merge branch 'develop' into qa
< d4178e5 Merge branch 'develop' into qa
< 1ecd494 Merge branch 'develop' into qa
< abf3db5 Merge branch 'develop' into qa
< 0d621f2 Merge branch 'develop' into qa
< 8ea941d Merge branch 'develop' into qa
< 5063dd5 Merge branch 'develop' into qa
< 99c135f Merge branch 'develop' into qa
< 162e93c Merge branch 'develop' into qa
< 6aad2e9 Merge branch 'develop' into qa
< a4fbb9b Merge branch 'develop' into qa
< ed3a806 Merge pull request #125 from duvanherrerav/develop
< 27f38e1 Merge pull request #121 from duvanherrerav/develop
< 7bf3d5d Merge pull request #118 from duvanherrerav/develop
< 363a852 Merge pull request #113 from duvanherrerav/develop
< 703ba3e Merge pull request #110 from duvanherrerav/develop
< dce1b6a Merge branch 'develop' of https://github.com/duvanherrerav/urbaphix into qa
< 06a89da Merge pull request #105 from duvanherrerav/develop
< 07bc84b Merge pull request #102 from duvanherrerav/develop
< c2d0b0d Merge pull request #99 from duvanherrerav/develop
```

## 2. Commits exclusivos de `develop`

`develop` contiene la línea funcional/documental que se busca promover hacia QA: hardening RLS FASE 3D, módulos Superadmin FASE 4, lifecycle tenants FASE 5 y el runbook RELEASE 1.0.

Muestra inicial de los commits exclusivos de `develop`:

```text
> 067269d Merge pull request #284 from duvanherrerav/codex/github-mention-release-1.0-promocion-controlada-dev-qa
> b9e7445 docs: clarify bidirectional release branch audit
> 4f513fe docs: add release 1.0 controlled promotion runbook
> 7dc7c79 Merge pull request #282 from duvanherrerav/codex/github-mention-fase-5.4.3-lifecycle-operativo-en-creacion-38a24e
> 2321e95 Clean validation seed fixtures
> 036af47 Fix FASE 5.4.3 validation script
> ba1d6fc Merge pull request #281 from duvanherrerav/codex/github-mention-fase-5.4.3-lifecycle-operativo-en-creacion
> b67aefe Fix legacy fallback precedence for visit creation
> 839427a FASE 5.4.3 lifecycle creacion visitas
> 7958db9 Merge pull request #279 from duvanherrerav/codex/github-mention-fase-5.4.2b-validacion-funcional-lifecycle
```

## 3. Archivos modificados en ambos lados

La comparación `origin/qa..origin/develop` mostró cambios relevantes en:

- Documentación de esquema y auditorías RLS/lifecycle/release.
- Migraciones versionadas desde FASE 3D.12 hasta FASE 5.4.3.
- Validaciones SQL/Markdown asociadas a RLS y lifecycle.
- Superadmin shell, guard y servicios de métricas/lifecycle.
- Rutas principales y servicio de reservas.

No se detectaron conflictos de merge al incorporar `develop` en la rama derivada de `qa`.

## 4. Conflictos reales y decisiones tomadas

- Conflictos reales: ninguno.
- Decisión: aceptar el merge automático de Git y conservar completo el historial de `qa` y el contenido de `develop`.
- No se eliminó ningún cambio exclusivo de `qa`.
- No se modificaron migraciones, policies RLS ni estructura de datos durante esta reconciliación; únicamente se documentó la reconciliación.

## 5. Cambios exclusivos de `qa` conservados

Todos los commits históricos exclusivos de `qa` se conservaron porque la rama de trabajo se creó desde `origin/qa` y se incorporó `origin/develop` con merge normal, sin rebase, squash ni force push.

## Validaciones requeridas

Validaciones mínimas previstas para esta rama reconciliada:

```bash
git diff --check
npm run lint
npm run build:qa
npm run build:prod
```

Además se revisa en el resultado:

- configuración QA y PROD existente;
- rutas y guards actuales;
- integración Supabase por ambiente;
- migraciones versionadas completas hasta FASE 5.4.3;
- ausencia de secretos o archivos `.env` reales.
