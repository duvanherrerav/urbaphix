# RC-1: Checklist operativo para preparar release candidate QA hacia main

## Objetivo

Preparar y documentar la validación del release candidate de Urbaphix que eventualmente se promoverá desde `qa` hacia `main`, sin ejecutar la liberación en este ticket.

Este checklist es un control previo: confirma que `qa` contiene el candidato correcto, que los builds esperados compilan, que los módulos críticos funcionan en QA y que existe evidencia mínima antes de abrir el PR futuro `qa` → `main`.

## Alcance y restricciones

### Alcance incluido

- Validación de estado de ramas `develop` y `qa`.
- Confirmación de que `qa` contiene el candidato de release.
- Ejecución y registro de comandos locales de preparación.
- Validación funcional manual en ambiente QA.
- Definición de evidencia mínima para revisión.
- Criterios go/no-go del release candidate.
- Plantilla sugerida para el PR futuro `qa` → `main`.

### Fuera de alcance

- No tocar `main`.
- No abrir ni preparar PR hacia `main` desde esta rama de documentación.
- No ejecutar merge `qa` → `main`.
- No ejecutar deploy real.
- No modificar infraestructura, DNS, IONOS ni certificados.
- No modificar Supabase, migraciones, tablas, columnas, Edge Functions, datos ni políticas RLS.
- No agregar secretos ni documentar valores reales de keys.
- No modificar lógica funcional del aplicativo.

## Relación con documentación existente

Este checklist complementa:

- `docs/production-release-strategy.md`, que define la estrategia general de promoción y despliegue a producción.
- `docs/environments-hardening.md`, que define la separación esperada de ambientes DEV, QA y PROD.
- `package.json`, que define los scripts `build:qa` y `build:prod` usados para validar los modos Vite correspondientes.

## Precondiciones antes de iniciar RC-1

- La rama de trabajo de este ticket debe partir de `develop` y el PR de este ticket debe apuntar a `develop`.
- La promoción productiva todavía no debe ejecutarse.
- El PR productivo futuro deberá ser exclusivamente `qa` → `main`, después de cumplir este checklist.
- Las variables locales o del entorno de build deben existir para el ambiente que se vaya a compilar, sin exponer sus valores en commits, issues, logs compartidos o documentación.

## 1. Confirmar estado de ramas `develop` y `qa`

Registrar la fecha, responsable y salida relevante de los comandos. No incluir secretos ni tokens en la evidencia.

```bash
git checkout develop
git pull origin develop
git status --short --branch

git checkout qa
git pull origin qa
git status --short --branch
```

Validaciones esperadas:

- [ ] `develop` está sincronizada con `origin/develop`.
- [ ] `qa` está sincronizada con `origin/qa`.
- [ ] No hay cambios locales sin commit en `develop` ni en `qa`.
- [ ] No se usó `work` como rama base, origen ni destino de la preparación del release.
- [ ] No se tocó `main` durante esta preparación.

Si `develop` avanzó después de crear el candidato QA, decidir explícitamente si esos cambios entran al release. Si entran, promover primero esos cambios a `qa` mediante el flujo controlado del repositorio y repetir este checklist desde el inicio.

## 2. Confirmar que `qa` contiene el candidato de release

Con la rama `qa` actualizada, confirmar que representa exactamente el alcance que se quiere liberar.

Comandos sugeridos para revisión local:

```bash
git checkout qa
git pull origin qa
git status --short --branch
git log --oneline --decorate -n 20
git diff --stat origin/main...qa
```

Validaciones esperadas:

- [ ] El equipo confirma que `qa` contiene el candidato de release completo.
- [ ] El diff esperado contra `main` no incluye cambios fuera de alcance.
- [ ] No hay commits locales pendientes de subir.
- [ ] No hay cambios de Supabase no autorizados en el candidato.
- [ ] No hay archivos `.env`, `.env.*` reales ni secretos versionados.

## 3. Ejecutar y registrar comandos esperados

Los siguientes comandos forman la evidencia mínima técnica de RC-1. Deben ejecutarse desde un entorno local/controlado con las variables correctas para cada modo Vite.

```bash
git checkout qa
git pull origin qa
git status --short --branch
npm run build:qa
npm run build:prod
```

Resultado esperado:

- [ ] `git checkout qa` cambia a la rama `qa` sin conflictos.
- [ ] `git pull origin qa` deja la rama actualizada.
- [ ] `git status --short --branch` muestra `qa` limpia y alineada con `origin/qa`.
- [ ] `npm run build:qa` compila correctamente con variables QA.
- [ ] `npm run build:prod` compila correctamente con variables PROD.
- [ ] Ningún build imprime valores reales de keys, tokens o secretos en logs compartidos.

Notas:

- Si `npm run build:prod` no puede ejecutarse por falta de variables locales, registrar el bloqueo como advertencia de ambiente, no como aprobación del RC.
- Antes de promover a producción, el build productivo debe ejecutarse exitosamente en un entorno que tenga variables PROD correctas.
- El build QA debe verificar que QA no use endpoints de DEV ni PROD.

## 4. Validación funcional crítica en QA

Realizar la validación manual en el ambiente QA ya publicado o en el entorno QA controlado por el equipo. La evidencia debe indicar navegador, usuario/rol de prueba, fecha y resultado.

### Login/logout por rol

- [ ] Login exitoso con rol administrador o rol equivalente definido para gestión.
- [ ] Login exitoso con rol vigilancia/portería.
- [ ] Login exitoso con rol residente cuando aplique al alcance del release.
- [ ] Logout invalida la sesión visible del usuario.
- [ ] Al cerrar sesión, las rutas protegidas dejan de ser accesibles.

### Visitas/Portería

- [ ] Crear o consultar visitas según los permisos del rol probado.
- [ ] Verificar que Portería visualiza la información necesaria para operar el ingreso.
- [ ] Confirmar que la ubicación torre/apartamento se muestra correctamente donde aplique.
- [ ] Confirmar que no aparecen datos de conjuntos o residentes ajenos al contexto del usuario probado.

### Paquetería

- [ ] Crear, consultar o gestionar paquetes según el flujo autorizado para el rol probado.
- [ ] Confirmar que el estado del paquete se refleja correctamente en la interfaz.
- [ ] Confirmar que no aparecen paquetes de conjuntos o residentes ajenos al contexto del usuario probado.

### Rutas protegidas

- [ ] Un usuario sin sesión no puede acceder a rutas privadas.
- [ ] Un usuario autenticado no puede acceder a rutas fuera de su rol.
- [ ] Las redirecciones por sesión/rol funcionan sin loops ni pantallas en blanco.

### Consola del navegador

- [ ] No hay errores críticos de JavaScript durante login, navegación principal, Visitas/Portería y Paquetería.
- [ ] No hay errores críticos de carga de assets.
- [ ] Las advertencias no bloqueantes quedan registradas con severidad y justificación si se decide aceptar el RC.

### Network y separación de ambientes

- [ ] Desde QA no hay llamadas a endpoints DEV.
- [ ] Desde QA no hay llamadas a endpoints PROD.
- [ ] Las llamadas Supabase observadas corresponden al proyecto QA esperado.
- [ ] No se exponen service role keys, secretos backend ni valores privados en requests del navegador.

## 5. Evidencia mínima antes del PR futuro `qa` → `main`

Antes de abrir el PR productivo, adjuntar o enlazar evidencia no sensible con:

- [ ] Salida de `git status --short --branch` en `qa` actualizada.
- [ ] Resultado de `npm run build:qa`.
- [ ] Resultado de `npm run build:prod`.
- [ ] Capturas o registro de validación de login/logout por rol.
- [ ] Capturas o registro de validación de Visitas/Portería.
- [ ] Capturas o registro de validación de Paquetería.
- [ ] Captura o registro de rutas protegidas.
- [ ] Captura o registro de consola sin errores críticos.
- [ ] Captura o registro de Network confirmando que QA no llama a DEV ni PROD.
- [ ] Confirmación explícita de que no se adjuntan secretos, keys reales, tokens ni valores de `.env`.
- [ ] Confirmación explícita de que no hubo deploy real durante esta preparación.

La evidencia debe ocultar datos personales, tokens, cookies, anon keys reales y cualquier identificador sensible que no sea necesario para aprobar el RC.

## 6. Criterios go/no-go del release candidate

### Go

El release candidate puede avanzar a preparación de PR `qa` → `main` solo si:

- [ ] `qa` está sincronizada y contiene exactamente el candidato aprobado.
- [ ] El diff `qa` → `main` fue revisado y no contiene cambios fuera de alcance.
- [ ] `npm run build:qa` pasa con variables QA.
- [ ] `npm run build:prod` pasa con variables PROD.
- [ ] Login/logout por rol pasa en QA.
- [ ] Visitas/Portería pasa en QA.
- [ ] Paquetería pasa en QA.
- [ ] Rutas protegidas pasan en QA.
- [ ] Consola no presenta errores críticos.
- [ ] Network confirma que QA no llama a DEV ni PROD.
- [ ] No se detectaron secretos versionados o expuestos en evidencia.
- [ ] No hay cambios Supabase no autorizados pendientes para este release.

### No-go

El release candidate debe bloquearse si ocurre cualquiera de estos casos:

- [ ] `qa` no está alineada con el candidato esperado.
- [ ] El diff incluye cambios no revisados o fuera de alcance.
- [ ] Falla `npm run build:qa` o `npm run build:prod` en un entorno correctamente configurado.
- [ ] QA llama a endpoints DEV o PROD.
- [ ] Hay errores críticos en consola que afecten flujos principales.
- [ ] Fallan login/logout, rutas protegidas, Visitas/Portería o Paquetería.
- [ ] Se detectan secretos, keys reales o archivos `.env` reales en Git o evidencia.
- [ ] Se identifica un cambio Supabase requerido pero no autorizado/validado.
- [ ] No existe responsable de rollback o ventana de liberación para el paso productivo posterior.

## 7. Plantilla sugerida para el PR futuro `qa` → `main`

> Esta plantilla aplica únicamente al PR futuro de producción. No debe usarse para abrir un PR desde `work`, `develop` o una rama documental hacia `main`.

```markdown
# Release: QA → Main - <fecha o versión>

## Resumen

- Promueve a producción el release candidate validado en QA.
- Rama origen: `qa`.
- Rama destino: `main`.
- No incluye cambios directos desde `develop`, `work` ni ramas feature.

## Evidencia RC-1

- [ ] `git status --short --branch` en `qa` limpia y actualizada.
- [ ] `npm run build:qa` aprobado.
- [ ] `npm run build:prod` aprobado.
- [ ] Login/logout por rol aprobado.
- [ ] Visitas/Portería aprobado.
- [ ] Paquetería aprobado.
- [ ] Rutas protegidas aprobadas.
- [ ] Consola sin errores críticos.
- [ ] Network sin llamadas DEV/PROD desde QA.
- [ ] Evidencia adjunta sin secretos ni datos sensibles.

## Control de alcance

- [ ] No modifica Supabase.
- [ ] No incluye migraciones nuevas.
- [ ] No modifica RLS.
- [ ] No agrega secretos ni archivos `.env` reales.
- [ ] No modifica DNS, IONOS ni infraestructura.

## Plan de despliegue posterior al merge

- Responsable de deploy:
- Ventana de despliegue:
- Entorno de build/deploy:
- Checklist post-deploy:
- Responsable de rollback:

## Rollback

- Estrategia de rollback acordada:
- Condiciones para ejecutar rollback:
- Responsable de decisión:
```

## 8. Regla de apertura del PR `qa` → `main`

El PR `qa` → `main` debe abrirse solamente después de cumplir este checklist RC-1 y adjuntar la evidencia mínima requerida.

Este ticket solo prepara la liberación. No realiza la liberación, no toca `main`, no ejecuta deploy real y no modifica infraestructura ni Supabase.
