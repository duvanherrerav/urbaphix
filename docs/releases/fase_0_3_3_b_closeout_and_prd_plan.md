# Fase 0.3.3-B — Cierre QA y plan controlado de promoción a PRD

## Estado

**QA aprobada. PRD no promovida.**

Este documento consolida la evidencia de cierre de la Fase 0.3.3-B y define el procedimiento previo a cualquier promoción hacia `main`, Supabase PRD y Vercel Production.

## Alcance cerrado

La fase implementó y validó:

- contrato canónico de identidad, membresías y tenant activo;
- RPC `public.fn_session_bootstrap(uuid)`;
- selección multitenant validada por servidor;
- persistencia segura del tenant preferido;
- mensajes explícitos para estados de usuario, lifecycle, licencia y bloqueo operativo;
- integración Web gradual detrás de `VITE_ENABLE_SESSION_BOOTSTRAP`;
- compatibilidad temporal con el flujo legacy;
- promoción controlada de código y base de datos hacia QA.

## Evidencia DEV

- build DEV aprobado;
- lint con 0 errores y 4 advertencias preexistentes;
- admin, vigilancia y residente aprobados;
- selector multitenant aprobado;
- preferencia de tenant aprobada;
- tenant manipulado rechazado;
- bloqueo operativo aprobado con mensaje específico;
- fixtures multitenant y operational lock retirados;
- usuario residente DEV restaurado a una membresía activa.

## Evidencia QA

### GitHub

- PR #311 fusionado en `develop`;
- merge de `develop` hacia `qa` ejecutado desde Visual Studio Code;
- SHA de promoción QA: `436991622b923391356dc7564e7e87ed76a1d562`;
- commit de redespliegue con feature flag: `fd1c06b844c71b95001ab7409eb859ed6ddfcf3d`.

### Build

- `npm run build:qa`: aprobado;
- 359 módulos transformados;
- ESLint: 0 errores y 4 advertencias preexistentes;
- `git diff --check`: sin observaciones;
- working tree limpio.

### Supabase QA

Proyecto: `tjbdtorqddunpknarzfc`.

La migración aplicada fue únicamente:

```text
supabase/migrations/20260723203000_fase_0_3_2_session_bootstrap.sql
```

Postchecks aprobados:

```text
fn_session_bootstrap(p_preferred_conjunto_id uuid)
security_definer       = true
anon_execute           = false
authenticated_execute  = true
service_execute        = true
dev_fixture_rows       = 0
```

No se ejecutaron archivos bajo `supabase/validation/` en QA.

### Vercel QA

- entorno: Preview;
- rama: `qa`;
- deployment: `dpl_CFv37qdLBhZT7nS9c75KFRiNwTzs`;
- commit: `fd1c06b844c71b95001ab7409eb859ed6ddfcf3d`;
- estado: `READY`;
- feature flag: `VITE_ENABLE_SESSION_BOOTSTRAP=true` en Preview QA.

### Smoke tests

Aprobados:

- administrador QA;
- vigilancia QA;
- residente QA;
- recarga de página;
- cierre y nuevo inicio de sesión;
- navegación por rol;
- persistencia de `urbaphix.preferredTenantId`;
- RPC `fn_session_bootstrap` con respuestas HTTP 200.

El mensaje cliente de observabilidad `module=app`, `action=unknown`, `severity=error` no tuvo correlación con fallos HTTP, errores de Supabase ni errores de runtime de Vercel. Se clasifica como no bloqueante y debe revisarse en una tarea separada si reaparece fuera de Preview.

## Restricciones vigentes

No se ha realizado ninguna acción sobre:

- rama `main`;
- Supabase PRD `oamczhwtilkmtxleaakb`;
- Vercel Production;
- variables de entorno de Production.

Los merges, pushes y promociones a `main` deben realizarse exclusivamente desde Visual Studio Code.

## Precondiciones para promover a PRD

Antes de iniciar una promoción a PRD deben cumplirse todas:

1. QA debe permanecer estable con bootstrap habilitado durante la ventana de observación acordada.
2. No deben existir regresiones críticas abiertas.
3. Debe confirmarse que la variable `VITE_ENABLE_SESSION_BOOTSTRAP` está limitada a Preview/`qa` y no a Production.
4. Debe verificarse el estado actual de `main` frente a `qa`.
5. Debe ejecutarse build de producción y lint desde Visual Studio Code.
6. Debe revisarse el historial de migraciones de Supabase PRD antes de aplicar SQL.
7. No debe usarse `supabase db push` si el historial local y remoto está divergido.
8. La migración bootstrap debe aplicarse de forma individual y controlada en PRD.
9. El feature flag de Production solo puede activarse después de los postchecks de la RPC.
10. Debe existir un rollback operativo documentado y probado.

## Procedimiento propuesto para PRD

### A. Preparación de ramas desde Visual Studio Code

```powershell
git fetch origin

git checkout qa
git pull origin qa

git checkout main
git pull origin main

git status
git merge --no-ff origin/qa
```

No hacer push si existen conflictos o cambios inesperados.

### B. Validación local de producción

```powershell
npm install
npm run build:prod
npm run lint
git diff --check
git status
```

Resultado requerido:

- build aprobado;
- ESLint con 0 errores;
- solo advertencias preexistentes aceptadas;
- working tree limpio.

### C. Publicación de `main`

Solo después de aprobación explícita:

```powershell
git push origin main
```

No usar force push ni reescribir historia.

### D. Validación Vercel previa a base de datos

- confirmar deployment de `main`;
- verificar que no haya promoción manual inesperada;
- mantener `VITE_ENABLE_SESSION_BOOTSTRAP` deshabilitado en Production hasta aprobar Supabase PRD;
- comprobar build logs y estado `READY`.

### E. Supabase PRD

Proyecto: `oamczhwtilkmtxleaakb`.

Aplicar exclusivamente:

```text
supabase/migrations/20260723203000_fase_0_3_2_session_bootstrap.sql
```

No ejecutar:

```text
supabase/validation/fase_0_3_3_b_multitenant_fixture_dev.sql
supabase/validation/fase_0_3_3_b_multitenant_fixture_rollback_dev.sql
supabase/validation/fase_0_3_3_b_operational_lock_fixture_dev.sql
```

Postcheck obligatorio:

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

Resultado requerido:

```text
security_definer       = true
anon_execute           = false
authenticated_execute  = true
service_execute        = true
```

### F. Activación gradual en Production

Después de aprobar los postchecks:

```text
VITE_ENABLE_SESSION_BOOTSTRAP=true
```

Aplicar únicamente a Production y generar un deployment controlado desde el flujo autorizado.

### G. Smoke tests PRD

Validar con cuentas operativas aprobadas:

- administrador;
- vigilancia;
- residente;
- recarga;
- cierre y nuevo login;
- navegación por rol;
- ausencia de selector para una sola membresía;
- ausencia de errores de bootstrap;
- respuestas HTTP 200 de la RPC.

## Rollback operativo PRD

### Feature flag

Ante una regresión:

```text
VITE_ENABLE_SESSION_BOOTSTRAP=false
```

Esto restaura el flujo fallback sin eliminar inmediatamente la RPC.

### Rama

Revertir el merge mediante commit, nunca reescribiendo historia:

```powershell
git checkout main
git pull origin main
git revert -m 1 <SHA_MERGE_QA_A_MAIN>
git push origin main
```

### Base de datos

La migración es forward-only. No eliminar la función durante un rollback operativo ordinario. Cualquier retiro requiere una nueva migración, revisión de seguridad y aprobación independiente.

## Decisión de cierre

La Fase 0.3.3-B queda cerrada con QA aprobada. La promoción a PRD constituye una acción posterior independiente y requiere autorización explícita antes de modificar `main`, Supabase PRD o Vercel Production.
