# POST-PROD 2E · Cierre operativo, sincronización de ambientes y readiness SaaS

## 1) Estado de auditoría (fecha del diagnóstico)
- Fecha de diagnóstico local: **2026-05-27 (UTC)**.
- Fuente utilizada: repositorio local (`develop`), referencias remotas ya presentes (`origin/qa`, `origin/main`) y documentación interna.
- Restricción detectada: no fue posible ejecutar `git fetch --all` por bloqueo de red (HTTP 403), por lo que este reporte se basa en los refs remotos disponibles en el clone local.

---

## 2) Auditoría GitHub (develop / qa / main)

### 2.1 SHAs observados
- `develop`: `ee043a5621cc7e96179a3273ffcf49a9a4c652d0`
- `origin/qa`: `21df6fdb2b0a3ad01e61f7a815e407bd966e8ac2`
- `origin/main`: `ac20f855f4c6455aaba009b0e684c9c16871cb4d`

### 2.2 Diferencias entre ramas (según refs locales)

#### develop vs qa
- `origin/qa` contiene commits extra sobre `develop`, principalmente merges `develop -> qa` y triggers de redeploy QA.
- `develop` no tiene commits por delante de `origin/qa`.
- Lectura operativa: **qa está por delante de develop por commits de integración/deploy**, no por divergencia funcional evidente.

#### qa vs main
- `origin/qa` contiene commits de POST-PROD 2D que no están en `origin/main`, incluyendo:
  - `724b3c2` (pipeline backend observabilidad)
  - `8be56fb` (fix auth session retrieval / separation)
  - `efd9127` (CORS preflight en `observability-ingest`)
  - `5240636`, `c061713`, `e5b5085`, `f986d38` (normalización de environment y reducción de ruido frontend)
  - merge PR `#155` (`ee043a5`).
- `origin/main` también presenta historial de merges de `qa` de ciclos anteriores, pero no incluye los últimos POST-PROD 2D.

#### develop vs main
- `develop` está por delante de `origin/main` con los mismos cambios recientes de POST-PROD 2D.
- `origin/main` contiene varios merges históricos `qa -> main` anteriores.

### 2.3 PRs/issues POST-PROD observables en historial local
- PR #149, #151, #153, #155 aparecen reflejados en los mensajes de merge recientes y están alineados con la cadena POST-PROD 2D.

### 2.4 Recomendación de promoción
- **No promover automáticamente a `main`** desde este diagnóstico.
- Si QA funcional/negocio está aprobado, preparar promoción controlada de `qa` hacia `main` para incorporar POST-PROD 2D completo.
- Ejecutar previamente checklist de release y validación final de variables de producción (sección Vercel).

---

## 3) Auditoría Supabase (DEV / QA / PRD) — diagnóstico sin cambios remotos

## 3.1 Migraciones locales relevantes
Se verificó la presencia local de migraciones clave:
- `20260521120000_post_prod_2c2e_revoke_public_anon_productive_rpcs.sql`
- `20260523110000_post_prod_2d1_operational_events_pipeline.sql`

También existen migraciones relacionadas con hardening previo (2C1/2C2A/2C2B).

## 3.2 Tabla `public.operational_events`
La migración `20260523110000...` define:
- creación de tabla `public.operational_events`;
- checks de severidad, longitud, source y metadata json object;
- índices operativos mínimos;
- `ENABLE RLS` + `FORCE RLS`;
- `REVOKE ALL` sobre la tabla a `anon` y `authenticated`.

### 3.3 RLS y grants críticos
- RLS forzado para `operational_events` está definido en SQL de migración.
- No se observan políticas abiertas para lectura pública en esa tabla en la migración revisada.
- El flujo esperado documentado es escritura backend (`service_role`) vía Edge Function.

### 3.4 Edge Functions en repositorio
- `supabase/functions/observability-ingest`
- `supabase/functions/enviar-notificacion`

### 3.5 Estado DEV / QA / PRD (limitación)
Este repositorio **no contiene evidencia runtime directa** para afirmar estado real de migraciones y functions desplegadas por ambiente (DEV/QA/PRD) sin acceso a cada proyecto Supabase remoto.

Para cerrar esta brecha se debe ejecutar, fuera de este entorno bloqueado de red:
1. `supabase link --project-ref <DEV_REF>` + `supabase migration list --linked` + `supabase functions list --project-ref <DEV_REF>`
2. repetir en QA
3. repetir en PRD
4. comparar drift explícito entre ambientes

---

## 4) Auditoría Vercel (Preview/QA y Production)

## 4.1 Estado verificable en código
Se confirma documentación funcional para observabilidad y environment en frontend:
- uso esperado de `VITE_OBSERVABILITY_REMOTE_ENABLED`
- normalización de `environment=qa` en la fase POST-PROD 2D-1B/2D-2.

## 4.2 Estado de variables por ambiente (esperado)

### Preview / QA (objetivo esperado)
- `VITE_SUPABASE_URL` -> proyecto QA
- `VITE_SUPABASE_ANON_KEY` -> proyecto QA
- `VITE_OBSERVABILITY_REMOTE_ENABLED=true` (o valor validado por operación)
- `VITE_APP_ENV=qa`

### Production (objetivo esperado)
- `VITE_SUPABASE_URL` -> proyecto PRD
- `VITE_SUPABASE_ANON_KEY` -> proyecto PRD
- `VITE_APP_ENV=production` (o fallback seguro equivalente)
- `VITE_OBSERVABILITY_REMOTE_ENABLED=false` salvo autorización explícita

## 4.3 Limitación actual
No hay acceso en este diagnóstico a Vercel dashboard/API para validar valores efectivos actuales de Preview/Production.

---

## 5) Readiness técnico para futuro rol `superadmin` (sin implementación)

## 5.1 Entidades/tablas impactadas (alto nivel)
- Identidad y rol: `usuarios_app`, `roles`, `residentes`.
- Estructura organizativa: `conjuntos`, `torres`, `apartamentos`.
- Dominios funcionales que hoy dependen de filtros por conjunto/residente:
  - `pagos`, `pagos_eventos`
  - `reservas`, `reservas_eventos`, `reservas_bloqueos`, `reservas_zonas`, `reservas_documentos`
  - `incidentes`, `multas`, `comunicados`, `paquetes`, `notificaciones`
  - `registro_visitas`, `accesos`, `visitantes`

## 5.2 Riesgos RLS para rol global
1. **Bypass accidental de aislamiento por `conjunto_id`** si se mezcla lógica de admin local con superadmin global.
2. **Escalamiento de privilegios** si `auth.uid()` no se cruza con claims/tabla de roles de forma estricta.
3. **Filtración lateral** entre conjuntos por policies demasiado amplias (`OR true`, policies genéricas por rol).
4. **Dificultad de auditoría** si no se registra claramente cuándo actuó `superadmin` y sobre qué tenant.

## 5.3 Estrategia recomendada de separación de roles
- `superadmin` (plataforma Urbaphix): alcance global solo por backend y operaciones auditadas, no por cliente directo.
- `admin` de conjunto: alcance exclusivamente a su `conjunto_id`.
- `residente`: alcance a su propio contexto (`residente_id` + conjunto).
- `vigilancia`: permisos operativos restringidos por conjunto y flujo específico.

## 5.4 Propuesta por fases (futura)
1. **Fase 3A (diseño):** matriz de permisos por actor x módulo x acción, inventario de policies actuales y detección de colisiones.
2. **Fase 3B (hardening):** funciones helper de autorización centralizadas y policies explícitas por rol/tenant, con tests SQL.
3. **Fase 3C (backend controlado):** operaciones globales de superadmin solo vía Edge/Backend con trazabilidad obligatoria.
4. **Fase 3D (UI/UX):** interfaz segregada para superadmin, sin mezclar sesiones operativas de admins de conjunto.

---

## 6) Hallazgos principales
1. El código/migraciones de POST-PROD 2D sí está en `develop` y `qa` (refs locales), y **no aparece totalmente promovido a `main`**.
2. Existen señales de sincronización activa `develop -> qa` (merges frecuentes + redeploy triggers).
3. `operational_events` quedó modelada con RLS forzado y revocación a roles públicos en migración local.
4. Persisten brechas de verificación runtime por ambiente (Supabase/Vercel) debido a falta de acceso remoto en este entorno.

## 7) Riesgos y pendientes

### Riesgos
- Drift no detectado entre migraciones aplicadas en QA/PRD vs repo local.
- Drift de variables Vercel entre Preview y Production.
- Promoción prematura a `main` sin validación final de entorno productivo.

### Pendientes mínimos para cerrar POST-PROD 2E
1. Confirmar `migration list --linked` en DEV/QA/PRD y documentar resultado.
2. Confirmar `functions list` en DEV/QA/PRD y estado de `observability-ingest`.
3. Verificar variables Vercel efectivas en Preview y Production.
4. Ejecutar recomendación de promoción (o retención) a `main` con evidencia de QA.

---

## 8) Recomendación final de cierre POST-PROD
- **POST-PROD 2E puede cerrarse condicionalmente** cuando se adjunte evidencia remota (Supabase + Vercel) que confirme alineación QA/PRD con lo auditado en repo.
- Hasta entonces, este reporte debe tratarse como **diagnóstico técnico documental parcial (local-first)**.
- Siguiente fase recomendada: **FASE 3A de diseño controlado de `superadmin`**, iniciando por matriz de permisos y estrategia RLS multitenant verificable.
