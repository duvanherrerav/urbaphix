# QA-3: Revisión y hardening de ambientes frontend

## Objetivo

Este documento audita la configuración de ambientes del frontend Urbaphix para evitar contaminación entre DEV, QA y PROD antes de avanzar hacia estrategia de producción, merge controlado y despliegue en IONOS.

Alcance de esta revisión:

- Variables Vite usadas por el cliente Supabase.
- Scripts `npm` que seleccionan modos Vite.
- Archivos `.env.*` versionados o ignorados por Git.
- Búsqueda de URLs o keys Supabase hardcodeadas en código fuente frontend.
- Mapa esperado de proyectos Supabase por ambiente.

No se modificó Supabase, no se crearon migraciones, no se tocaron políticas RLS, tablas ni datos.

## Mapa esperado de ambientes

| Ambiente | Modo Vite | Archivo local esperado | Proyecto Supabase esperado | Uso esperado |
| --- | --- | --- | --- | --- |
| DEV | `development` | `.env.development` | `urbaphix-dev` | Desarrollo local y pruebas técnicas no QA |
| QA | `qa` | `.env.qa` | `urbaphix-qa` | Validación funcional QA y builds de QA |
| PROD | `production` | `.env.production` | Urbaphix producción | Build y despliegue productivo |

Reglas obligatorias:

1. Cada archivo `.env.*` local debe apuntar únicamente al proyecto Supabase de su ambiente.
2. QA no debe usar URLs ni anon keys de DEV o PROD.
3. PROD no debe usar URLs ni anon keys de DEV o QA.
4. Nunca se debe usar `service_role`, claves privadas ni secretos backend en variables `VITE_*`, porque Vite las expone al bundle del navegador.
5. Los archivos `.env`, `.env.*` reales no deben versionarse. Solo `.env.example` debe permanecer en Git.

## Variables consumidas por Supabase en frontend

El cliente Supabase se inicializa desde `src/services/supabaseClient.js` con estas variables públicas de Vite:

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Sí | URL del proyecto Supabase del ambiente activo |
| `VITE_SUPABASE_ANON_KEY` | Sí | Anon public key del proyecto Supabase del ambiente activo |

Además, el módulo de Visitas usa `VITE_SUPABASE_URL` para invocar la Edge Function `functions/v1/enviar-notificacion`. Por lo tanto, esta URL también debe corresponder al proyecto Supabase correcto del ambiente activo.

## Scripts y modos Vite

`package.json` define scripts explícitos por ambiente:

| Script | Comando | Modo Vite | Archivo `.env` que Vite puede cargar |
| --- | --- | --- | --- |
| `npm run dev` | `vite --mode development` | `development` | `.env`, `.env.local`, `.env.development`, `.env.development.local` |
| `npm run dev:dev` | `vite --mode development` | `development` | `.env`, `.env.local`, `.env.development`, `.env.development.local` |
| `npm run dev:qa` | `vite --mode qa` | `qa` | `.env`, `.env.local`, `.env.qa`, `.env.qa.local` |
| `npm run build:dev` | `vite build --mode development` | `development` | `.env`, `.env.local`, `.env.development`, `.env.development.local` |
| `npm run build:qa` | `vite build --mode qa` | `qa` | `.env`, `.env.local`, `.env.qa`, `.env.qa.local` |
| `npm run build:prod` | `vite build --mode production` | `production` | `.env`, `.env.local`, `.env.production`, `.env.production.local` |

Nota de hardening: aunque Vite siempre puede cargar `.env` y `.env.local`, se recomienda no usarlos para despliegues compartidos. Para evitar contaminación entre ambientes, usar archivos específicos por modo (`.env.development`, `.env.qa`, `.env.production`) o variables inyectadas por el proveedor CI/CD para cada job.

## Estado de archivos `.env`

- `.env.example` está versionado y solo contiene nombres/formatos de variables, sin secretos reales.
- `.gitignore` ignora `.env` y `.env.*`, con excepción de `.env.example`.
- No se encontraron archivos `.env.*` reales versionados en Git.

Plantillas locales recomendadas:

```bash
# DEV local
cp .env.example .env.development

# QA local
cp .env.example .env.qa

# PROD local o entorno de build controlado
cp .env.example .env.production
```

Después de copiar, reemplazar los placeholders localmente con los valores del proyecto correspondiente. No hacer commit de esos archivos.

## Auditoría de hardcoding

Se revisaron archivos versionados buscando patrones de Supabase como:

- `supabase.co`
- `VITE_SUPABASE`
- `SUPABASE`
- `anon_key` / `anon-key`
- `service_role` / `service-role`
- JWTs con prefijo `eyJ`

Resultado para frontend:

- No se encontraron URLs Supabase hardcodeadas en código fuente frontend.
- No se encontraron anon keys Supabase hardcodeadas en código fuente frontend.
- El frontend usa `import.meta.env.VITE_SUPABASE_URL` y `import.meta.env.VITE_SUPABASE_ANON_KEY`.
- Existen referencias a `service_role` en migraciones/documentación de Supabase, pero no son variables de frontend ni fueron modificadas en esta tarea.
- Existe un ejemplo de JWT en `supabase/functions/enviar-notificacion/index.ts` como comentario de plantilla Supabase CLI; queda fuera del alcance de frontend y no se modificó porque este ticket no autoriza cambios en Supabase.

## Checklist antes de build/deploy por ambiente

Antes de ejecutar un build o deploy, confirmar:

1. `npm run build:qa` se ejecuta con variables del proyecto `urbaphix-qa`.
2. `npm run build:prod` se ejecuta con variables del proyecto Urbaphix producción.
3. El entorno de CI/CD o IONOS no reutiliza variables de QA para PROD.
4. El bundle de frontend no contiene service_role keys ni secretos privados.
5. Si se usa `.env.local`, confirmar que no sobrescribe accidentalmente las variables del modo activo.

Comandos de verificación recomendados:

```bash
npm run build:qa
npm run build:prod
git diff --check
```

## Conclusión QA-3

La separación frontend de ambientes queda basada en modos Vite y variables `VITE_SUPABASE_*` por archivo/entorno. Los scripts de `package.json` están alineados con los modos `development`, `qa` y `production`, y `.env.example` documenta las variables necesarias sin secretos reales.
