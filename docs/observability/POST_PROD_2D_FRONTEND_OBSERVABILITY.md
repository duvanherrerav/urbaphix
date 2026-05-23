# POST-PROD 2D · Observabilidad frontend transversal

## Resumen ejecutivo
Se implementó una primera capa de observabilidad frontend liviana y segura para Urbaphix, sin persistencia remota y sin cambios en Supabase. La solución normaliza errores, sanea contexto y define un formato uniforme de evento para trazabilidad operativa en módulos críticos.

## Estado actual
- Existía uso distribuido de `logger` en frontend, con buena cobertura inicial en errores de red/Supabase.
- Faltaba un contrato transversal explícito para severidad, normalización de error, ambiente y sanitización de contexto.
- Se detectaban mensajes de consola heterogéneos en flujos de QR, auth/sesión y operaciones administrativas.

## Hallazgos de errores actuales (observados y/o reportados)
- Compartir QR puede lanzar `AbortError` / `Share failed` (cancelación o fallo de Web Share API).
- Descarga/compartición de imagen QR puede fallar por capacidades del navegador o restricciones del entorno.
- Errores no bloqueantes de verificación de sesión y 404 en recursos auxiliares.
- Fallos recuperables en flujos operativos (visitas, paquetería, pagos, reservas, incidentes) ya manejados con `catch`.

## Módulos críticos cubiertos
Esta fase cubre observabilidad transversal para:
- Autenticación y sesión.
- Dashboard/admin y servicios compartidos.
- Visitas/portería/QR/ingreso/salida.
- Pagos/cobros/comprobantes/aprobación/rechazo.
- Reservas/recursos/bloqueos/eventos.
- Incidentes/seguimiento.
- Paquetería/notificaciones.

> Nota: la integración se hizo de forma no invasiva sobre el `logger` compartido para no alterar lógica funcional crítica.

## Estrategia de logging frontend transversal
Se centralizó el contrato de observabilidad en `src/lib/observability/logger.js` con:
- `logInfo(message, context)`
- `logWarn(message, context, error?)`
- `logError(message, error, context)`
- `normalizeError(error)`
- `sanitizeContext(context)`

Principios:
1. **No persistencia remota** en esta fase.
2. **Sin servicios externos** (Sentry/PostHog/Datadog/etc.).
3. **Datos mínimos y seguros** por evento.
4. **Normalización estructural** de errores para facilitar correlación futura.
5. **Compatibilidad** con el `logger` actual (`src/utils/logger.js`) para evitar refactors riesgosos.

## Estructura de evento sugerida
```json
{
  "module": "visitas",
  "action": "share_qr",
  "severity": "error|warn|info",
  "timestamp": "2026-05-21T00:00:00.000Z",
  "environment": "development|qa|production",
  "message": "human-readable summary",
  "error": {
    "type": "AbortError",
    "message": "Share failed",
    "code": null,
    "status": null
  },
  "context": {
    "featureFlag": true,
    "httpStatus": 400,
    "supabaseCode": "PGRST..."
  }
}
```


## Ejemplos de uso compatibles
```js
logger.warn('mensaje', error);
logger.warn('mensaje', { module: 'visitas', action: 'share_qr' }, error);
logger.error('mensaje', supabaseError, { module: 'pagos', action: 'aprobar_comprobante' });
```

Notas:
- Si el segundo argumento es `Error` o error-like (ej. Supabase con `message/code/status`), se normaliza en `event.error`.
- Si el segundo argumento es contexto, se sanitiza en `event.context`.
- Si existe tercer argumento, se resuelve como `context` o `error` según su forma.

## Datos permitidos y prohibidos
### Permitido
- módulo, acción, severidad, timestamp, ambiente;
- tipo/mensaje/código/estado del error normalizado;
- códigos HTTP/Supabase;
- banderas booleanas y conteos no sensibles;
- identificadores truncados/anonimizados si son estrictamente necesarios.

### Prohibido
- tokens/JWT/refresh/access;
- passwords/secretos/cookies;
- documentos, placas completas, nombres completos, teléfonos, emails;
- comprobantes, URLs firmadas, payloads completos de tablas.

## Riesgos de privacidad y mitigación
- **Riesgo:** filtración accidental por metadata libre en `catch`.
  - **Mitigación:** `sanitizeContext` redacciona claves sensibles y reduce objetos/arrays.
- **Riesgo:** mensajes extensos con contenido sensible.
  - **Mitigación:** truncamiento de strings y normalización de error.
- **Riesgo:** logging excesivo en producción.
  - **Mitigación:** `info` solo en DEV; `warn/error` controlados para diagnóstico operativo.

## Lineamientos de uso por módulo
- **Auth/sesión:** reportar solo causa técnica y estado; nunca datos de credenciales.
- **Visitas/QR/portería:** registrar acción (share/download/ingreso/salida) y resultado; no incluir QR completo ni datos personales.
- **Pagos:** registrar tipo de operación y estado (aprobado/rechazado/en revisión) sin comprobantes ni PII.
- **Reservas:** registrar transición de estado y tipo de recurso, sin datos personales.
- **Incidentes:** registrar cambios de estado/nivel de riesgo sin narrativas sensibles completas.
- **Paquetería:** registrar creación/entrega/notificación sin nombres ni contactos.

## Plan futuro para auditoría operativa en Supabase (sin implementar en esta fase)
1. Definir tabla de auditoría operacional con columnas mínimas y partición por fecha.
2. Insertar eventos vía Edge Function/backend (no desde frontend directo).
3. Aplicar RLS por `conjunto_id`, rol y alcance de soporte.
4. Enmascarado adicional server-side y políticas de retención.
5. Correlación con trazas de backend/RPC para incident response.

## Recomendación para POST-PROD 2D-1
Implementar **pipeline de auditoría operacional server-side** (Edge Function) que reciba solo eventos normalizados/sanitizados del frontend y persista con RLS, retención y controles de acceso por rol. Incluir métricas base: tasa de error por módulo/acción, top códigos de error y latencia por flujo crítico.
