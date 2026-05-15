# Estrategia de release y despliegue a producción

## Objetivo y alcance

Este documento define la estrategia formal para promover Urbaphix desde `qa` hacia `main` y preparar el despliegue frontend de producción sin ejecutar cambios de infraestructura en este ticket.

Alcance incluido:

- Flujo de ramas para `develop`, `qa` y `main`.
- Checklist previo a promoción `qa` → `main`.
- Checklist de variables de producción.
- Estrategia de build y despliegue frontend Vite.
- Validaciones post-deploy.
- Estrategia de rollback.
- Guía general para configurar `urbaphix.com` en IONOS después del deploy.
- Riesgos conocidos y controles mínimos.

Fuera de alcance para este ticket:

- No ejecutar deploy real.
- No modificar IONOS, DNS, SSL ni proveedor de hosting.
- No tocar `main` directamente.
- No crear PR hacia `main` desde una rama distinta de `qa`.
- No modificar Supabase, migraciones, RLS, tablas, datos ni Edge Functions.
- No agregar secretos ni documentar valores reales de keys.
- No cambiar lógica funcional del aplicativo.

## Estado actual revisado

La estrategia se basa en la configuración versionada actual:

- `package.json` expone scripts explícitos para `development`, `qa` y `production`.
- `npm run build:prod` ejecuta `vite build --mode production`.
- `npm run build:qa` ejecuta `vite build --mode qa`.
- El frontend Supabase consume únicamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` desde `import.meta.env`.
- `.env.example` documenta solo los nombres de variables requeridas, sin valores reales.
- `.gitignore` excluye `.env` y `.env.*`, permitiendo versionar únicamente `.env.example`.
- `vite.config.js` usa la salida estándar de Vite para build (`dist/`) porque no define `build.outDir` personalizado.
- `docs/environments-hardening.md` define la separación esperada de ambientes DEV, QA y PROD.

## Flujo de ramas

### Roles de ramas

| Rama | Propósito | Reglas |
| --- | --- | --- |
| `develop` | Desarrollo integrado. | Recibe PRs de features/fixes aprobados para integración. Puede contener cambios aún no validados funcionalmente en QA. |
| `qa` | Validación funcional / preproducción. | Recibe promociones controladas desde `develop`. Debe representar el candidato que se valida antes de producción. |
| `main` | Producción. | Solo recibe cambios mediante PR controlado desde `qa` después de aprobación QA. No recibe cambios directos desde `develop`, `work` ni ramas feature. |

### Regla de promoción

1. **Integración:** los cambios se integran primero en `develop`.
2. **Validación:** cuando un conjunto de cambios está listo para QA, se promueve `develop` hacia `qa` mediante PR o merge controlado según el flujo del repositorio.
3. **Aprobación:** QA valida funcionalmente la versión candidata en ambiente/preproducción.
4. **Producción:** `qa` se promueve a `main` únicamente cuando QA esté aprobado.
5. **Control:** `main` solo debe recibir cambios mediante PR desde `qa`.

Reglas explícitas:

- No usar `work` como rama base del PR de producción.
- No promover `develop` directamente a `main`.
- No apuntar PRs de release productivo a `qa` ni a ramas temporales: el PR final de release debe ser `qa` → `main`.
- No hacer commits directos en `main`.
- Si `develop` avanzó después de crear el candidato QA, decidir explícitamente si esos cambios entran al release. Si entran, primero sincronizar `qa` con `develop` y repetir validaciones.

## Criterios para poder abrir PR `qa` → `main`

Se puede abrir el PR de producción solo cuando todos los puntos siguientes estén cerrados:

1. `qa` contiene exactamente el candidato que se quiere liberar.
2. Los cambios de `develop` requeridos para el release ya fueron promovidos a `qa`.
3. QA funcional aprobó los módulos críticos del alcance del release.
4. Los builds `qa` y `production` compilan correctamente con variables del ambiente correspondiente.
5. Las variables PROD fueron revisadas sin exponer valores reales en GitHub, issues, logs o documentación.
6. No existen cambios Supabase pendientes de aplicar o, si existen, tienen un plan separado aprobado y validado.
7. Se definió la ventana de despliegue y el responsable de rollback.
8. El PR apunta a `main` y su rama origen es `qa`.

## Checklist previo a promoción `qa` → `main`

### Estado de Git y ramas

- [ ] Confirmar que la rama candidata es `qa`.
- [ ] Confirmar que `qa` está sincronizada con `develop` cuando el release requiere todos los cambios actuales de desarrollo.
- [ ] Confirmar que no se usará `work` como base ni como origen del PR productivo.
- [ ] Confirmar que no hay commits locales sin subir en la rama de release.
- [ ] Revisar el diff del PR `qa` → `main` y validar que no incluye cambios fuera de alcance.

### Builds y checks locales/CI

- [ ] Ejecutar `git diff --check` para detectar whitespace o conflictos de patch.
- [ ] Ejecutar `npm run build:qa` con variables QA.
- [ ] Ejecutar `npm run build:prod` con variables PROD.
- [ ] Confirmar que el build productivo no contiene variables QA/DEV.
- [ ] Confirmar que no se agregaron archivos `.env`, `.env.*` reales ni secretos al repositorio.

### Validación funcional crítica en QA

- [ ] Login/logout por rol esperado.
- [ ] Rutas protegidas redirigen o bloquean acceso sin sesión.
- [ ] Rutas protegidas respetan rol y contexto de usuario.
- [ ] Flujos críticos de Visitas/Portería validados.
- [ ] Flujos críticos de Paquetería validados.
- [ ] Panel de Vigilancia muestra ubicación torre/apartamento correctamente.
- [ ] Fechas/horas críticas se muestran con timezone Bogotá según lo validado en QA-1.
- [ ] No hay errores críticos en consola del navegador durante navegación principal.
- [ ] No hay llamadas a ambientes incorrectos desde QA.
- [ ] Assets, logo, textos principales y branding se ven correctamente.

### Validación Supabase PROD antes de deploy

Esta validación debe ser planificada antes del deploy real y debe ser read-only salvo autorización explícita:

- [ ] Confirmar URL del proyecto Supabase de producción.
- [ ] Confirmar que la anon/publishable key corresponde a producción.
- [ ] Confirmar que no se usará `service_role` en frontend.
- [ ] Confirmar que las políticas RLS necesarias existen en producción para los módulos críticos del release.
- [ ] Confirmar que existen datos mínimos operativos requeridos para iniciar sesión y navegar en producción.
- [ ] Confirmar que Edge Functions requeridas por frontend, si aplican al release, existen y apuntan a servicios correctos de producción.
- [ ] Confirmar que cualquier cambio de base de datos pendiente tiene ticket, migración, aprobación y plan de rollback separado.

## Checklist de variables producción

Las variables de producción deben inyectarse desde el proveedor de hosting/CI o desde un archivo local no versionado usado solo para build controlado.

| Variable | Requisito PROD | Prohibiciones |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Debe apuntar al proyecto Supabase de producción. | No usar URL de DEV o QA. No documentar valor real en Git. |
| `VITE_SUPABASE_ANON_KEY` | Debe ser la anon/publishable key pública del proyecto Supabase de producción. | No usar keys de DEV/QA. No usar `service_role`. No documentar valor real en Git. |

Controles obligatorios:

- [ ] No hay `service_role` ni secretos privados en ninguna variable `VITE_*`.
- [ ] No hay variables QA/DEV en el entorno usado por `npm run build:prod`.
- [ ] No se reutiliza `.env.qa`, `.env.development`, `.env.local` o variables heredadas de otro job para build PROD.
- [ ] Si el hosting permite múltiples ambientes, PROD tiene su propio set de variables separado de QA.
- [ ] Los logs del build no imprimen valores completos de keys.
- [ ] `.env.production` o equivalentes locales no se versionan.

## Estrategia de build y deploy frontend

### Build esperado

Comando productivo esperado:

```bash
npm run build:prod
```

Este script ejecuta:

```bash
vite build --mode production
```

Carpeta de salida esperada:

```text
dist/
```

La carpeta `dist/` es el artefacto estático que debe publicarse en el proveedor de hosting final.

### Consideraciones SPA

Urbaphix es una aplicación React/Vite de frontend. El hosting productivo debe soportar fallback de SPA:

- Toda ruta de aplicación que no corresponda a un archivo estático real debe responder con `index.html`.
- Ejemplos de rutas que no deben devolver 404 del servidor si existen en el router frontend:
  - `/login`
  - rutas protegidas de administración/residente/vigilancia
  - rutas profundas compartidas o accedidas por refresh del navegador
- Los assets reales en `dist/assets/*` sí deben servirse como archivos estáticos con caché apropiado.

Si el proveedor no configura fallback SPA, las rutas pueden funcionar desde navegación interna pero fallar al refrescar o abrir una URL directa.

### Validaciones post-deploy

Después de un deploy real, validar como mínimo:

- [ ] `https://urbaphix.com` responde con HTTPS válido.
- [ ] `https://www.urbaphix.com`, si se habilita, redirige o sirve la misma aplicación según decisión de dominio canónico.
- [ ] Certificado SSL válido, emitido para el dominio correcto y sin warnings del navegador.
- [ ] Primera carga sin errores críticos en consola.
- [ ] Refresh en rutas internas no devuelve 404 del servidor.
- [ ] Login funciona contra Supabase PROD.
- [ ] Rutas protegidas bloquean usuarios no autenticados.
- [ ] Roles principales acceden solo a sus pantallas autorizadas.
- [ ] Flujos críticos definidos para el release funcionan con datos PROD mínimos.
- [ ] Assets y branding cargan correctamente.
- [ ] Network tab no muestra llamadas a Supabase DEV/QA.
- [ ] No se observan errores críticos por caché/CDN después de hard refresh o ventana incógnito.

## Estrategia de rollback

Rollback permitido para frontend:

1. **Revert PR en `main`:** crear un revert del PR de release y desplegar nuevamente `main`.
2. **Redeploy de versión anterior:** si el proveedor mantiene historial de artefactos, redeplegar el último build productivo estable.

Validaciones mínimas después del rollback:

- [ ] Dominio productivo responde con la versión esperada.
- [ ] Login y rutas protegidas funcionan.
- [ ] Flujos críticos usados por usuarios reales vuelven a estado estable.
- [ ] Consola del navegador y logs del hosting no muestran errores críticos persistentes.
- [ ] Network tab confirma que se sigue usando Supabase PROD.

Reglas de rollback:

- No tocar base de datos durante rollback frontend salvo que exista un plan específico, aprobado y probado.
- No ejecutar SQL destructivo como respuesta rápida a fallos de frontend.
- Si el release incluyó cambios de DB en otro ticket, el rollback debe seguir el plan de base de datos de ese ticket, no improvisarse durante incidente.
- Documentar causa, acción tomada, hora de rollback y validaciones ejecutadas.

## Configuración de dominio IONOS posterior al deploy

Estos pasos son guía general para un ticket posterior. No deben ejecutarse como parte de este documento.

1. Elegir y confirmar el proveedor de hosting final del frontend.
2. Obtener del proveedor los registros DNS requeridos:
   - `CNAME` si el proveedor entrega un host canónico.
   - `A`/`AAAA` si el proveedor entrega IPs fijas.
   - Registros adicionales de verificación de dominio si el proveedor los requiere.
3. En IONOS, preparar cambios DNS para `urbaphix.com` y, si aplica, `www.urbaphix.com`.
4. Definir dominio canónico:
   - Opción A: `urbaphix.com` canónico y `www` redirige.
   - Opción B: `www.urbaphix.com` canónico y apex redirige.
5. Configurar SSL/TLS en el proveedor de hosting para el dominio elegido.
6. Esperar propagación DNS y validar resolución.
7. Validar en navegador:
   - HTTPS sin warning.
   - Redirección canónica correcta.
   - Carga de aplicación.
   - Fallback SPA.
   - Conexión a Supabase PROD.

Restricciones:

- No modificar DNS antes de tener un artefacto productivo aprobado.
- No apuntar `urbaphix.com` a QA.
- No publicar variables o tokens en capturas, tickets o documentación.
- No hacer cambios IONOS sin ventana y plan de reversa.

## Riesgos conocidos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Contaminación de ambientes | PROD podría llamar a Supabase QA/DEV o viceversa. | Separar variables por modo, revisar `npm run build:prod`, validar Network tab post-deploy. |
| Build PROD con variables QA | Usuarios reales operarían sobre datos de QA. | Checklist de variables, job PROD aislado, revisión manual antes de deploy. |
| Uso de `service_role` en frontend | Exposición crítica de privilegios. | Prohibir cualquier secreto privado en `VITE_*`; revisar variables del proveedor. |
| Rutas SPA con 404 | Refresh o acceso directo a rutas internas falla. | Configurar fallback a `index.html` en hosting. |
| Caché de navegador/CDN | Usuarios ven versión antigua o assets mezclados. | Invalidar caché/CDN si aplica y validar en incógnito/hard refresh. |
| Supabase PROD sin datos mínimos | Login o navegación inicial falla. | Validación read-only de datos mínimos antes del deploy. |
| Supabase PROD sin políticas correctas | Errores `permission denied` o datos vacíos inesperados. | Validar RLS/policies antes de promoción y no cambiar DB sin plan. |
| PR equivocado hacia `main` | Se libera una rama no validada. | PR productivo únicamente `qa` → `main`, con revisión explícita de ramas. |
| DNS apuntando al destino incorrecto | Dominio productivo cae o sirve QA. | Cambios IONOS solo en ticket posterior con registros confirmados y plan de reversa. |

## Decisión de go/no-go para producción

### Go

Se puede ejecutar la promoción `qa` → `main` y planear deploy real cuando:

- QA funcional está aprobado.
- `npm run build:qa` y `npm run build:prod` pasan con variables correctas.
- Variables PROD fueron revisadas sin exposición de secretos.
- Supabase PROD fue validado read-only para datos mínimos, RLS y endpoints requeridos.
- El proveedor de hosting está listo para servir `dist/` con fallback SPA.
- Existe plan de rollback y responsable asignado.
- El PR productivo es desde `qa` hacia `main`.

### No-go

No se debe promover ni desplegar si ocurre cualquiera de estas condiciones:

- `qa` no representa el candidato validado.
- El PR productivo no es `qa` → `main`.
- `npm run build:prod` falla.
- Hay dudas sobre si PROD está usando variables QA/DEV.
- Falta validar Supabase PROD para el alcance crítico.
- No existe fallback SPA configurado o validado en hosting.
- Se detectan errores críticos en consola durante flujos principales.
- Hay cambios de DB pendientes sin migración, aprobación o plan específico.

## Evidencia recomendada para el PR de release

El PR `qa` → `main` debe incluir en su descripción:

- Resumen del release.
- Commit o rango de commits incluidos.
- Resultado de `npm run build:qa`.
- Resultado de `npm run build:prod`.
- Evidencia de validación funcional crítica.
- Confirmación de variables PROD revisadas sin publicar valores.
- Confirmación de no cambios Supabase no autorizados.
- Plan de rollback elegido.
- Responsable y ventana propuesta para deploy.
