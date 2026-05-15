# RC QA final validation - 2026-05-15

## Objetivo

Validar la rama `qa` como release candidate técnico previo al futuro PR controlado `qa` -> `main`, sin modificar código funcional, Supabase, datos, infraestructura, DNS, IONOS ni ejecutar deploy real.

## Alcance ejecutado

- Rama base validada: `qa`.
- No se trabajó desde `develop` para la validación.
- No se creó rama nueva de feature.
- No se tocó `main`.
- No se modificó código de aplicación.
- No se modificó Supabase, migraciones, RLS, datos, DNS ni IONOS.
- No se ejecutó deploy real.

## Evidencia técnica

| Validación | Comando / evidencia | Resultado |
| --- | --- | --- |
| Cambio a rama `qa` | `git checkout qa` | Pasa. Se cambió desde `develop` a `qa` local. |
| Pull de `origin/qa` | `git pull origin qa` | Advertencia de entorno. Falló por bloqueo de red del contenedor: `CONNECT tunnel failed, response 403`. |
| Estado de rama | `git status --short --branch` | Pasa. Resultado final: `## qa...origin/qa`, sin cambios locales. |
| Divergencia local vs tracking ref | `git rev-list --left-right --count qa...origin/qa` | Pasa contra la referencia remota local disponible: `0 0`. |
| Commit validado | `git rev-parse qa` y `git rev-parse origin/qa` | Pasa contra referencias locales: ambos apuntan a `363a852cc4e5cde3b119dde43c3d8c0d8da7f16c`. |
| Build QA | `npm run build:qa` | Pasa. Vite compiló correctamente en modo `qa`. |
| Build PROD | `npm run build:prod` | Pasa. Vite compiló correctamente en modo `production`. |
| Revisión de diff metadata | `git diff --check` | Pasa. Sin errores de whitespace en el árbol de trabajo. |
| Revisión estática de bundle QA generado | `rg -n "supabase\\.co\|urbaphix-dev\|urbaphix-qa\|service_role\|service-role\|eyJ" dist` | Pasa para el bundle generado sin variables reales locales: no se encontraron coincidencias en `dist`. |

## Validación funcional crítica

La validación funcional manual completa no pudo aprobarse desde este contenedor porque no hay variables `.env.qa` reales, credenciales de usuarios por rol ni URL publicada de QA disponibles en el entorno. Para evitar exponer secretos o modificar datos, no se creó ningún archivo `.env.*`, no se usaron credenciales reales y no se ejecutaron flujos que escriban en Supabase.

| Flujo requerido | Resultado | Observación |
| --- | --- | --- |
| Login/logout por rol disponible | Pendiente | Requiere usuarios/credenciales QA por rol o URL QA publicada con cuentas de prueba. |
| Rol vigilancia/portería | Pendiente | Requiere sesión QA con rol `vigilancia`. |
| Rol residente | Pendiente | Requiere sesión QA con rol `residente`. |
| Visitas/Portería: visita visible, torre/apto visible, ingreso/salida sin errores | Pendiente | Requiere datos QA y autorización explícita para operar flujo funcional. |
| Paquetería: consulta/historial o flujo básico sin errores | Pendiente | Requiere datos QA y sesión por rol correspondiente. |
| Rutas protegidas no accesibles sin sesión | Pendiente | Requiere validación en navegador con configuración QA real. |
| Consola navegador sin errores críticos | Pendiente | Requiere navegador contra QA real o modo local con `.env.qa` real. |
| Network sin llamadas a Supabase DEV ni PROD desde QA | Pendiente funcional | La revisión estática del bundle generado en este contenedor no encontró URLs Supabase hardcodeadas, pero la confirmación final requiere capturar Network con variables QA reales. |

## Revisión de ambientes y Network

- El frontend consume Supabase mediante variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; los scripts por ambiente están definidos como `build:qa` -> `vite build --mode qa` y `build:prod` -> `vite build --mode production`.
- En este contenedor no existen archivos `.env.qa` ni `.env.production` reales; por seguridad no se crearon ni se publicaron valores reales.
- La búsqueda estática sobre `dist` después del build QA no encontró URLs Supabase ni indicadores de keys/JWT hardcodeados.
- La comprobación definitiva de Network queda pendiente en un navegador con configuración QA real, verificando que todas las solicitudes Supabase apunten exclusivamente al proyecto `urbaphix-qa` esperado y no a DEV ni PROD.

## Confirmación de no deploy real

No se ejecutó ningún comando de deploy, publicación, DNS, IONOS, Supabase CLI remoto ni modificación de infraestructura. Los comandos ejecutados se limitaron a Git local/remoto, builds Vite, revisión estática y documentación de evidencia.

## Go / No-Go

**No-Go operativo para abrir todavía el PR `qa` -> `main`.**

Motivos:

1. `git pull origin qa` no pudo confirmar el estado remoto actual por bloqueo de red del contenedor, aunque la referencia local `origin/qa` coincide con `qa` en `363a852cc4e5cde3b119dde43c3d8c0d8da7f16c`.
2. Los builds `npm run build:qa` y `npm run build:prod` pasan.
3. La validación funcional manual crítica y la revisión Network real siguen pendientes por falta de `.env.qa`, URL QA publicada o credenciales de prueba por rol en este entorno.

## Evidencia sugerida para futuro PR `qa` -> `main`

Antes de abrir el PR productivo controlado, adjuntar o registrar:

- Salida reciente de `git checkout qa`, `git pull origin qa` y `git status --short --branch` desde una red con acceso a GitHub.
- Salida completa de `npm run build:qa` con variables QA reales del entorno controlado.
- Salida completa de `npm run build:prod` con variables PROD reales del entorno controlado.
- Capturas o checklist firmado de login/logout por rol, vigilancia/portería, residente, visitas, paquetería y rutas protegidas.
- Captura de consola sin errores críticos.
- Captura Network filtrada por Supabase confirmando que QA llama únicamente al proyecto QA esperado, sin publicar secrets ni valores completos de keys.
- Confirmación explícita de que no se ejecutó deploy real antes del PR `qa` -> `main`.
