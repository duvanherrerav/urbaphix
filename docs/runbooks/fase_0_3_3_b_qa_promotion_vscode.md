# Fase 0.3.3-B — Promoción controlada a QA desde Visual Studio Code

## Alcance

Este procedimiento prepara y ejecuta la promoción de la Fase 0.3.3-B desde `develop` hacia `qa` exclusivamente desde Visual Studio Code.

No incluye promoción hacia `main` ni Supabase PRD.

## Regla operativa

- Los merges, pushes y despliegues de las ramas `qa` y `main` se realizan únicamente desde Visual Studio Code.
- No usar conectores, GitHub UI ni Vercel para efectuar la promoción.
- No aplicar fixtures de validación en QA.
- Los archivos bajo `supabase/validation/` son DEV-only y no deben ejecutarse como migraciones.

## Estado requerido antes de promover

- PR #311 abierto y mergeable.
- `npm run build:dev` aprobado.
- `npm run lint` con 0 errores; se aceptan las 4 advertencias preexistentes documentadas.
- Preview Vercel del head del PR en `READY`.
- `fn_session_bootstrap(uuid)` validada en DEV.
- `anon` sin permiso de ejecución.
- `authenticated` y `service_role` con permiso de ejecución.
- Pruebas E2E DEV aprobadas para admin, vigilancia, residente, multitenant, persistencia, tenant manipulado y bloqueo operativo.
- Fixtures multitenant y operational lock retirados de DEV.

## Parte A — Cierre del PR hacia develop

Ejecutar desde la raíz del repositorio:

```powershell
git checkout chore/fase-0-3-1-identity-legacy-cleanup
git pull origin chore/fase-0-3-1-identity-legacy-cleanup
git status
npm install
npm run build:dev
npm run lint
git diff --check
```

Confirmar que `git status` no tenga cambios no versionados.

Después, marcar el PR #311 como listo para revisión y fusionarlo hacia `develop` mediante el flujo aprobado del equipo. Si la política exige hacerlo localmente, usar:

```powershell
git checkout develop
git pull origin develop
git merge --no-ff chore/fase-0-3-1-identity-legacy-cleanup
git push origin develop
```

No continuar si existen conflictos o si el head cambió después de las validaciones.

## Parte B — Preparar rama QA desde Visual Studio Code

```powershell
git fetch origin
git checkout qa
git pull origin qa
git merge --no-ff origin/develop
```

Resolver conflictos únicamente si son comprendidos y revisados. Luego ejecutar:

```powershell
npm install
npm run build:qa
npm run lint
git diff --check
```

Si todo queda aprobado:

```powershell
git push origin qa
```

El push de `qa` debe provocar el Preview/Deployment QA configurado en Vercel. No hacer promoción manual a Production.

## Parte C — Aplicar migración bootstrap en Supabase QA

Proyecto QA:

```text
tjbdtorqddunpknarzfc
```

Aplicar únicamente la migración versionada:

```text
supabase/migrations/20260723203000_fase_0_3_2_session_bootstrap.sql
```

No ejecutar en QA:

```text
supabase/validation/fase_0_3_3_b_multitenant_fixture_dev.sql
supabase/validation/fase_0_3_3_b_multitenant_fixture_rollback_dev.sql
supabase/validation/fase_0_3_3_b_operational_lock_fixture_dev.sql
```

Usar el flujo CLI ya vinculado al proyecto QA. Antes de aplicar, confirmar el proyecto enlazado:

```powershell
supabase status
supabase migration list
```

Aplicar las migraciones pendientes mediante el procedimiento habitual del repositorio, por ejemplo:

```powershell
supabase link --project-ref tjbdtorqddunpknarzfc
supabase db push
```

No usar `--include-all` ni opciones destructivas sin revisar previamente la lista de migraciones pendientes.

## Parte D — Postchecks SQL en QA

Ejecutar en QA:

```sql
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'fn_session_bootstrap';
```

Resultado esperado:

```text
security_definer       = true
anon_execute           = false
authenticated_execute  = true
service_execute        = true
```

Ejecutar también:

```sql
select count(*) as dev_fixture_rows
from public.tenant_memberships
where source_legacy = 'fase_0_3_3_b_fixture';
```

Resultado esperado en QA:

```text
dev_fixture_rows = 0
```

## Parte E — Configuración QA y pruebas Web

Mantener el bootstrap controlado por:

```text
VITE_ENABLE_SESSION_BOOTSTRAP
```

Habilitarlo únicamente en el entorno QA cuando la RPC ya exista y los postchecks estén aprobados.

Validar en la aplicación QA:

- login administrador;
- login vigilancia;
- login residente;
- carga de navegación por rol;
- cierre de sesión;
- recarga de página;
- ausencia de errores de perfil;
- fallback deshabilitando temporalmente el flag, si el procedimiento de configuración lo permite.

No crear fixtures multitenant en QA durante esta promoción inicial.

## Parte F — Criterios de aprobación QA

La promoción queda aprobada cuando:

- rama `qa` contiene el commit promovido desde `develop`;
- `npm run build:qa` termina correctamente;
- ESLint tiene 0 errores;
- deployment Vercel de `qa` está `READY`;
- la RPC existe en Supabase QA con grants correctos;
- no existen fixtures DEV en QA;
- los tres roles pueden iniciar sesión;
- no se detectan regresiones críticas.

## Rollback

### Web

Si QA presenta una regresión, deshabilitar en QA:

```text
VITE_ENABLE_SESSION_BOOTSTRAP=false
```

Esto restaura el flujo legacy/membership resolver sin revertir inmediatamente el esquema.

### Rama QA

Desde Visual Studio Code, revertir el merge de promoción con un commit de revert; no reescribir historia compartida:

```powershell
git checkout qa
git pull origin qa
git revert -m 1 <SHA_DEL_MERGE_A_QA>
git push origin qa
```

### Base de datos

La migración es forward-only. No eliminar `fn_session_bootstrap` durante un rollback operativo ordinario; basta con mantener el feature flag deshabilitado. Cualquier retiro de la función requiere una migración nueva, revisión de seguridad y aprobación separada.

## Fuera de alcance

- promoción a `main`;
- aplicación en Supabase PRD;
- activación en Production;
- resolución de las vulnerabilidades de `npm audit`;
- corrección de las 4 advertencias React Hooks preexistentes.
