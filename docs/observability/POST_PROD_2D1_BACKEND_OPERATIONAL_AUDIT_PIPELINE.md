# POST-PROD 2D-1 · Pipeline backend seguro para auditoría operativa

## Resumen ejecutivo
Se implementó una primera versión mínima y gobernada del pipeline de auditoría operativa: eventos frontend sanitizados -> Edge Function `observability-ingest` -> tabla `public.operational_events` con RLS estricto y sin lectura pública.

## Arquitectura objetivo
1. Frontend normaliza/sanitiza con `src/lib/observability/logger.js`.
2. Si `VITE_OBSERVABILITY_REMOTE_ENABLED=true`, se envían únicamente `warn/error` al backend.
3. Edge Function valida/sanitiza nuevamente y restringe módulo/severidad/metadata.
4. Inserción en `operational_events` vía `service_role`.

## Alcance
- Tabla audit trail mínima.
- RLS habilitado y permisos conservadores.
- Ingesta backend con validación fuerte.
- Integración frontend opcional, no masiva, no bloqueante.

## No alcance
- Dashboard de observabilidad.
- Métricas agregadas.
- Integraciones externas (Sentry/PostHog/Datadog/LogRocket).
- Exposición de lectura directa a `anon`/`authenticated`.

## Tabla propuesta
Tabla: `public.operational_events`.

Campos principales: `id`, `created_at`, `conjunto_id`, `actor_user_id`, `actor_role`, `module`, `action`, `severity`, `event_type`, `message`, `error_type`, `error_code`, `http_status`, `metadata`, `environment`, `source`.

Checks mínimos:
- `severity in ('info','warn','error')`
- longitudes de `module`/`action`/`message`
- `source in ('frontend','edge_function')`
- `metadata` debe ser objeto json.

Índices mínimos:
- `created_at desc`
- `(conjunto_id, created_at desc)`
- `(module, action, created_at desc)`
- `(severity, created_at desc)`

## RLS y permisos
- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`.
- `REVOKE ALL` para `anon` y `authenticated`.
- Sin policies abiertas en esta fase; el flujo esperado de escritura es exclusivo por backend con `service_role`.

## Edge Function
Ruta: `supabase/functions/observability-ingest/index.ts`.

Controles:
- Método `POST` obligatorio.
- JWT requerido (configurado en `supabase/config.toml` con `verify_jwt = true`).
- Allowlist de módulos y severidades.
- Sanitización y truncamiento server-side.
- Rechazo de metadata no objeto o >4KB.
- Resolución de usuario desde JWT (`auth.getUser`).
- Inserción con `SUPABASE_SERVICE_ROLE_KEY` sin hardcodeo.

## Contrato de payload (v1)
```json
{
  "module": "pagos",
  "action": "aprobar_comprobante",
  "severity": "error",
  "message": "fallo al aprobar comprobante",
  "event_type": "PostgrestError",
  "error_type": "PostgrestError",
  "error_code": "PGRST301",
  "http_status": 400,
  "metadata": { "trace": "short-code" },
  "environment": "production",
  "conjunto_id": "uuid-opcional"
}
```

## Datos permitidos y prohibidos
Permitido: módulo, acción, severidad, códigos técnicos, estado HTTP, metadata mínima no sensible.

Prohibido: tokens/JWT, credenciales, PII, comprobantes, URLs firmadas, payloads de tablas.

## Plan QA
1. Deploy manual controlado a QA (fuera de Codex).
2. Probar `warn/error` con flag remoto deshabilitado/habilitado.
3. Verificar rechazo de `module` inválido y `metadata` sobredimensionada.
4. Verificar ausencia de lectura directa desde frontend.

## Rollback conceptual
- Revertir migración de `operational_events` en un script de rollback controlado.
- Deshabilitar flag `VITE_OBSERVABILITY_REMOTE_ENABLED`.
- Mantener logging local frontend como fallback.

## Riesgos residuales
- Posible ruido operativo si se habilita remoto sin gobernanza de volumen.
- Dependencia de token de sesión local para envío remoto desde frontend.
- Riesgo de pérdida de eventos por fallos de red (aceptable en fase mínima).

## Recomendación POST-PROD 2D-2
- Definir políticas de retención por ventana temporal.
- Agregar agregaciones por módulo/severidad fuera del flujo transaccional.
- Introducir mecanismo de correlación (request_id/trace_id) no sensible.
