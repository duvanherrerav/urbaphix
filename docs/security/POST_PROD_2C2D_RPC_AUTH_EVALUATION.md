# POST-PROD 2C-2D: Evaluación controlada de RPC productivas anon → authenticated

## Resumen ejecutivo

Se evaluó el uso real de las RPC productivas de visitas/portería para determinar si su exposición actual a `anon` puede migrarse de forma segura a `authenticated` en una fase posterior (2C-2E), sin ejecutar cambios de permisos en esta fase.

Conclusión principal: **la evidencia frontend local indica que los 3 flujos productivos operan dentro de sesión autenticada** (residente para creación de visita; vigilancia para ingreso/salida), y no se encontró un caso de uso público sin login que dependa legítimamente de `anon`.

Recomendación de alto nivel para 2C-2E: plan de endurecimiento controlado con verificación E2E por rol, observabilidad de errores (`401/403/500`) y rollback inmediato por `GRANT` temporal solo si se detecta ruptura.

---

## Estado actual de las RPC en evaluación

RPC objetivo:
1. `fn_crear_o_reutilizar_visitante_y_registro(...)`
2. `fn_registrar_ingreso_visita(text, uuid)`
3. `fn_registrar_salida_visita(uuid, uuid)`

Estado base confirmado por auditorías previas de seguridad en el repositorio:
- `SECURITY DEFINER=true`
- `search_path=public, auth`
- `public_execute=true`
- `anon_execute=true`
- `authenticated_execute=true`
- `service_role_execute=true`

> Esta fase 2C-2D es **solo de evaluación**: no se realizaron `REVOKE`, `GRANT`, `ALTER FUNCTION`, cambios RLS ni migraciones.

---

## Alcance y no alcance

### Alcance
- Revisión de consumo frontend/servicios de las 3 RPC.
- Determinación de contexto de sesión de cada llamada.
- Determinación de evidencia de uso público real sin login.
- Matriz de riesgo y recomendación por RPC.
- Checklist E2E/manual para preparar 2C-2E.

### No alcance
- Cambios de grants/permisos SQL.
- Cambios de migraciones Supabase.
- Cambios funcionales de frontend.
- Ejecución remota sobre ambientes DEV/QA/PRD.

---

## Metodología

1. Revisión de fuente de verdad y auditorías previas en `docs/security/` y `docs/database-schema.md`.
2. Búsquedas mínimas exigidas en repo:
   - `supabase.rpc(`
   - `.rpc(`
   - nombres de las 3 RPC
   - `visitasService`
   - `porteriaService`
   - módulos de visitas/QR/portería
3. Inspección de código en:
   - `src/modules/visitas/services/visitasService.js`
   - `src/modules/visitas/services/porteriaService.js`
   - `src/modules/visitas/pages/CrearVisita.jsx`
   - `src/modules/visitas/pages/EscanearQR.jsx`
   - `src/modules/visitas/pages/PanelVigilancia.jsx`
4. Elaboración de matriz de flujo/auth/riesgo.
5. Propuesta de prerequisitos y plan controlado para 2C-2E.

---

## Evidencia frontend encontrada

### 1) Creación de visita (residente)
- `CrearVisita.jsx` obtiene usuario autenticado con `supabase.auth.getUser()` y resuelve `residentes` por `usuario_id` antes de crear visita.
- `visitasService.crearVisita` valida `user.id`, consulta `usuarios_app.conjunto_id` y luego llama RPC `fn_crear_o_reutilizar_visitante_y_registro`.

Interpretación: el flujo de creación depende de contexto autenticado y tenant (`conjunto_id`) previo a RPC.

### 2) Ingreso de visita (vigilancia)
- `EscanearQR.jsx` usa `usuarioApp?.conjunto_id`, consulta visita por `conjunto_id` cuando existe y registra ingreso mediante `registrarIngresoVisitaRPC`.
- `porteriaService.registrarIngresoVisitaRPC` encapsula la RPC `fn_registrar_ingreso_visita`.
- `visitasService.validarQR` (legacy) también llama `fn_registrar_ingreso_visita`.

Interpretación: el flujo operativo previsto es autenticado (portería/vigilancia). No se evidencia un flujo anónimo intencional de negocio.

### 3) Salida de visita (vigilancia)
- `PanelVigilancia.jsx` opera con `conjunto_id` resuelto del usuario actual y consume utilidades operativas de portería.
- `porteriaService.registrarSalidaVisitaRPC` encapsula la RPC `fn_registrar_salida_visita`.
- `syncOfflineQueue` en `porteriaService` reprocesa acciones pendientes con contexto de usuario (`usuarioApp` / `vigilante_id`).

Interpretación: el flujo de salida es operacional/autenticado y con contexto de operador.

---

## Matriz RPC → flujo → auth

| RPC | Archivo frontend/servicio | Módulo | Flujo funcional | Usuario esperado | ¿Requiere auth? | Exposición actual | Riesgo | Recomendación |
|---|---|---|---|---|---|---|---|---|
| `fn_crear_o_reutilizar_visitante_y_registro` | `src/modules/visitas/services/visitasService.js` (invocada desde `CrearVisita.jsx`) | Visitas | Residente crea visita + QR | `residente` (o admin según caso) | Sí | `public` + `anon` + `authenticated` + `service_role` | Alto por superficie innecesaria si `anon` no es requerido | Preparar cambio a `authenticated` en 2C-2E con smoke E2E de creación/historial QR |
| `fn_registrar_ingreso_visita` | `src/modules/visitas/services/porteriaService.js`, `src/modules/visitas/services/visitasService.js` (legacy), `EscanearQR.jsx` | Visitas/Portería | Vigilancia valida QR y registra ingreso | `vigilancia` | Sí | `public` + `anon` + `authenticated` + `service_role` | Alto: operación crítica de acceso físico | Migrar a `authenticated` en 2C-2E y validar flujo normal + offline queue + notificaciones |
| `fn_registrar_salida_visita` | `src/modules/visitas/services/porteriaService.js` (consumida por panel) | Visitas/Portería | Vigilancia registra salida | `vigilancia` | Sí | `public` + `anon` + `authenticated` + `service_role` | Alto: cierra ciclo de acceso | Migrar a `authenticated` en 2C-2E con pruebas de salida y trazabilidad de bitácora |

---

## Riesgos por RPC

### `fn_crear_o_reutilizar_visitante_y_registro`
- Riesgo de abuso externo si `anon`/`public` permanece abierto pese a ser flujo de residente autenticado.
- Riesgo medio de ruptura si existen automatismos externos no inventariados (mitigar con observabilidad previa).

### `fn_registrar_ingreso_visita`
- Riesgo alto de seguridad física: cualquier exposición innecesaria a `anon` amplía superficie de ejecución de ingreso.
- Riesgo de impacto operativo si se corta `anon` sin validar rutas legacy (ej. `validarQR` legado).

### `fn_registrar_salida_visita`
- Riesgo alto de integridad operativa del ciclo de visita si hay clientes sin sesión (no evidenciados en frontend actual).
- Riesgo de acumulación de estado inconsistente si falla transición y cola offline no sincroniza correctamente.

---

## Checklist E2E/manual previo a 2C-2E

1. Residente autenticado crea visita con visitante nuevo.
2. Residente autenticado crea visita con visitante existente.
3. QR se genera y se visualiza/compartible sin errores de consola.
4. Vigilancia autenticada registra ingreso desde Escanear QR (flujo principal).
5. Vigilancia autenticada registra ingreso desde rutas auxiliares/legacy (si siguen expuestas).
6. Vigilancia autenticada registra salida desde panel.
7. Dashboard/indicadores posteriores reflejan estado de visitas (pendiente/ingresado/salido).
8. Notificaciones relacionadas se crean para destinatarios esperados.
9. Consola del navegador sin errores propios del flujo.
10. Network sin errores Supabase inesperados `401`, `403`, `500` en creación/ingreso/salida.
11. Prueba de contingencia: evento offline en portería + sincronización posterior exitosa.
12. Validación cruzada por rol: residente no puede ejecutar acciones de vigilancia.

---

## Prerrequisitos antes de revocar `anon`

1. Inventario final de todos los consumidores (incluyendo código legacy no usado en UI principal).
2. Ventana controlada para pruebas en QA con usuarios reales de `residente` y `vigilancia`.
3. Telemetría de errores por RPC (al menos logs de cliente y revisión de errores Supabase).
4. Confirmación de que no existe actor externo (app de terceros, kiosk público) consumiendo estas RPC vía `anon`.
5. Plan de rollback explícito (re-aplicar `GRANT` temporal en caso de ruptura crítica).
6. Aprobación de negocio/operaciones para ventana de endurecimiento.

---

## Propuesta para POST-PROD 2C-2E (fase de posible REVOKE controlado)

1. **Preparación QA:** ejecutar checklist E2E completo con baseline actual.
2. **Cambio controlado (QA):** retirar `anon/public` solo para las 3 RPC productivas en QA.
3. **Validación intensiva QA:** rerun del checklist + monitoreo de errores `401/403/500`.
4. **Correcciones si aplica:** resolver cualquier consumidor oculto o ruta legacy.
5. **Go/No-Go documentado:** aprobar solo si no hay regresiones funcionales críticas.
6. **Ejecución en PRD con ventana controlada:** aplicar mismo patrón por etapas y monitoreo.
7. **Rollback inmediato si falla:** restaurar grants previos y documentar incidente.

---

## Criterio de aceptación propuesto para cerrar 2C-2D

- Matriz completa RPC→flujo→auth generada y revisada.
- Evidencia clara de que el flujo esperado es autenticado para las 3 RPC.
- Checklist E2E/manual definido para 2C-2E.
- Prerrequisitos y plan controlado de endurecimiento definidos.
- Sin cambios de permisos, sin migraciones nuevas, sin cambios funcionales frontend.

---

## Nota de cumplimiento de restricciones de esta fase

- No se crearon migraciones en `supabase/migrations/`.
- No se ejecutaron cambios remotos en Supabase.
- No se modificaron grants/permisos SQL.
- No se cambió comportamiento funcional del frontend.
- No se tocaron ramas `qa` ni `main`.
