# FASE 3D.17 — Inventario RLS PRD vs Legacy/Obsoleto

## Propósito

Este inventario clasifica las tablas del esquema `public` para orientar próximas validaciones RLS sin aplicar cambios de base de datos. La fase es documental: no crea migraciones, no modifica policies, no elimina tablas y no cambia código funcional.

## Fuentes revisadas

1. `docs/database-schema.md` como diccionario funcional vigente.
2. `supabase/migrations/`, especialmente hardening RLS 3D.12–3D.16, memberships 3C.1 y `operational_events` POST-PROD 2D.1.
3. Documentación previa de auditoría/validación RLS (`docs/fase-3d*.md`, `docs/security/*`).
4. Alcance del PR FASE 3D.17 con inventario inicial DEV.

> Nota de datos: el repositorio no contiene un dump de conteos DEV por tabla. Donde el PR reporta tablas sin datos/legacy se marca `0 aprox. según inventario DEV del PR`; las demás quedan como `pendiente de conteo DEV` para no inventar cifras.

## Categorías usadas

- **PRD activo:** módulo funcional actualmente desarrollado y validado/parcialmente endurecido.
- **Soporte operativo requerido:** tabla base o soporte usada por módulos PRD o por autorización multitenant.
- **Legacy/obsoleto:** estructura histórica o sustituida que no debe endurecerse todavía sin evidencia de uso actual.
- **Futuro/no implementado:** módulo no implementado en PRD o pendiente de decisión funcional.
- **Requiere dataset negativo:** necesita evidencia REST negativa para confirmar aislamiento/ownership.
- **Requiere hardening posterior:** presenta riesgo o policy amplia, pero debe convertirse en issue/fase posterior con evidencia.

## Resumen ejecutivo

### Alcance PRD actual

- Visitas: `visitantes`, `registro_visitas`.
- Paquetes: `paquetes`.
- Incidentes: `incidentes`.
- Pagos: `pagos`, `pagos_eventos`.
- Reservas robustas: `reservas_zonas`, `recursos_comunes`, `reservas_bloqueos`, `reservas_documentos`, `reservas_eventos`.
- Base operativa/autorización: `residentes`, `apartamentos`, `torres`, `conjuntos`, `tenant_memberships`, `usuarios_app`, `roles`, `tipos_documento`.
- Plataforma/soporte: `platform_memberships` para roles plataforma; `operational_events` para auditoría backend con RLS forzado y sin permisos cliente.

### Próximas validaciones REST recomendadas

1. `usuarios_app`: comprobar que `lectura usuarios` (`SELECT true`) no expone identidad/contacto/rol de otros tenants.
2. `tenant_memberships`: validar que no permite self-escalation ni lectura de membresías ajenas fuera del conjunto o plataforma autorizada.
3. `config_pagos`: comprobar si `lectura config pagos` (`SELECT true`) expone URLs/instrucciones de otros conjuntos.
4. `apartamentos`, `torres`, `conjuntos`, `recursos_comunes`: confirmar lectura solo por `conjunto_id` autorizado.
5. `incidentes`: crear dataset negativo same-conjunto para decidir si visibilidad comunitaria por conjunto es correcta o si debe limitarse por `reportado_por`/ownership.
6. `reservas_documentos` y `archivos`: revisar exposición de rutas/URLs/documentos antes de ampliar uso en PRD.

## Inventario detallado

| Tabla | Estado funcional | Filas aprox. | RLS activo | Policies actuales por comando | Ownership / columnas sensibles | Riesgo preliminar | Acción recomendada |
|---|---|---:|---|---|---|---|---|
| `accesos` | Legacy/obsoleto o soporte portería no PRD actual | 0 aprox. según inventario DEV del PR | Sí, según policy visible | INSERT: `insert accesos vigilancia`. SELECT/UPDATE/DELETE: no visibles | `visita_id`, `vigilante_id` | Medio si se reactiva; bajo temporalmente por no PRD | No endurecer ahora. Confirmar uso real antes de crear issue; si se reactiva, exigir lectura por conjunto derivada de visita/vigilante. |
| `apartamentos` | Soporte operativo requerido | Pendiente de conteo DEV | Sí | SELECT: `apartamentos_select_conjunto`. INSERT/UPDATE/DELETE: admin mismo conjunto | `conjunto_id`, `torre_id` | Medio | Validación REST same/cross tenant. Mantener como datos compartidos del conjunto; no exponer fuera de tenant. |
| `archivos` | Futuro/no implementado / soporte genérico legacy | 0 aprox. según inventario DEV del PR | Sí, policy amplia visible | SELECT: `archivos por conjunto` con condición `true`. INSERT/UPDATE/DELETE: no visibles | `referencia_id`, `url`, `modulo` | Alto si contiene URLs/documentos; no aplicable temporalmente si está vacío | No corregir sin evidencia de uso. Crear issue posterior si aparece dato real o consumo frontend/backend. |
| `comunicados` | Futuro/no implementado | 0 aprox. según inventario DEV del PR | Sí | SELECT: `comunicados por conjunto`. INSERT: `crear comunicados admin`. UPDATE/DELETE: no visibles | `conjunto_id`, contenido | Medio | No tocar. Revalidar cuando módulo de comunicados entre a PRD. |
| `config_pagos` | Soporte operativo requerido | Pendiente de conteo DEV | Sí | SELECT: `lectura config pagos` con condición `true`. INSERT/UPDATE/DELETE: no visibles | `conjunto_id`, `url_pago`, `instrucciones` | Medio/alto por posible exposición cross-tenant de configuración de pago | Prioridad alta posterior: validación REST y issue de hardening si hay exposición. |
| `conjuntos` | Soporte operativo requerido | Pendiente de conteo DEV | Sí | SELECT: `conjuntos_select_conjunto`. Escritura cliente: sin policies documentadas | `id`, `nombre`, `direccion`, `ciudad` | Medio | Validar lectura solo conjunto propio; escrituras solo backend/service role aprobadas. |
| `incidentes` | PRD activo | Pendiente de conteo DEV | Sí | SELECT: `incidentes por conjunto`. INSERT: `crear incidentes vigilancia`. UPDATE: `update incidentes admin conjunto`. DELETE: no visible | `conjunto_id`, `reportado_por`, `descripcion`, `evidencia_url`, `resolucion`, `impacto_economico` | Alto | Cross-tenant ya validado con `HTTP 200 []` para dataset negativo. Requiere dataset negativo same-conjunto para decidir si debe ser comunitario o propietario/reportante. |
| `multas` | Futuro/no implementado | 0 aprox. según inventario DEV del PR | Sí | SELECT: `multas por conjunto`. INSERT: `crear multas admin`. UPDATE/DELETE: no visibles | `conjunto_id`, `residente_id`, `motivo`, `valor`, `estado` | Alto si se implementa; no aplicable temporalmente | No endurecer ahora. Diseñar módulo y ownership antes de uso PRD. |
| `notificaciones` | Futuro/no implementado / soporte parcial | 0 aprox. según inventario DEV del PR | Sí | SELECT: `notificaciones usuario`, `ver mis notificaciones`. INSERT: `insert notificaciones permitido`. UPDATE/DELETE: no visibles | `usuario_id`, `titulo`, `mensaje`, `tipo`, `leido` | Alto si contiene mensajes privados | No tocar salvo evidencia de uso. Si se usa, validar que `usuario_id = auth.uid()` corresponde a `usuarios_app.id`/Auth real y que INSERT no permite spam/suplantación. |
| `operational_events` | Soporte operativo backend / auditoría | 0 aprox. según inventario DEV del PR | Sí, forzado | Sin policies cliente; tabla revocada para `anon`/`authenticated`. Ingesta esperada por backend/service_role | `conjunto_id`, `actor_user_id`, `metadata`, `environment`, `error_code` | Medio/alto por auditoría, mitigado por RLS forzado y revokes | Mantener sin acceso cliente. Issue futuro solo para dashboard interno con policies explícitas. |
| `pagos` | PRD activo | Pendiente de conteo DEV | Sí | SELECT: `pagos_select_admin_conjunto`, `pagos_select_residente_propios`. INSERT: `crear pagos admin`, `crear pagos admin conjunto`. UPDATE: `update comprobante pagos`, `update pagos admin`. DELETE: no visible | `conjunto_id`, `residente_id`, `valor`, `estado`, `comprobante_url`, `motivo_rechazo`, `rechazado_por` | Alto | Mantener en alcance PRD endurecido. Revisar en fase posterior si UPDATE `true` debe acotarse por ownership/columnas permitidas. |
| `pagos_eventos` | PRD activo / soporte auditoría pagos | Pendiente de conteo DEV | Sí | SELECT: admin conjunto y residente propio. INSERT: `pagos_eventos_insert_flujos_pagos`. UPDATE/DELETE: no visibles | `pago_id`, `conjunto_id`, `residente_id`, `usuario_id`, `metadata` | Alto | Validar REST residente/admin para trazabilidad propia y cross-tenant. Mantener como soporte PRD. |
| `paquetes` | PRD activo | Pendiente de conteo DEV | Sí | SELECT: admin conjunto, residente propio, vigilancia conjunto. INSERT: `insert paquetes vigilancia`. UPDATE: `update paquetes vigilancia`. DELETE: no visible | `conjunto_id`, `apartamento_id`, `residente_id`, `recibido_por`, `descripcion` | Alto | Mantener fase 3D.14. Completar evidencia same-conjunto/cross-tenant si no está adjunta al ambiente objetivo. |
| `parqueaderos` | Futuro/no implementado | 0 aprox. según inventario DEV del PR | No visible en documentación | No visibles | `conjunto_id`, `numero`, `tipo`, `ocupado` | Medio si se implementa | No tocar. Requiere diseño RLS antes de módulo PRD. |
| `platform_memberships` | Soporte operativo requerido plataforma | Pendiente de conteo DEV | Sí | SELECT: self o superadmin. INSERT/UPDATE: superadmin. DELETE: denegado | `user_id`, `role_name`, `status`, `granted_by`, `granted_reason` | Alto | Mantener protegido. Validar que roles plataforma no conceden acceso tenant funcional salvo policies explícitas. |
| `pqr` | Futuro/no implementado | 0 aprox. según inventario DEV del PR | Sí | SELECT: `pqr por residente`. INSERT: `crear pqr residente`. UPDATE/DELETE: no visibles | `residente_id`, `asunto`, `descripcion`, `respuesta` | Alto si se implementa | No tocar. Si entra a PRD, validar ownership residente y acceso admin por conjunto. |
| `recursos_comunes` | PRD activo / soporte reservas | Pendiente de conteo DEV | Sí | SELECT: `recursos_select_conjunto`. ALL/admin write: `recursos_admin_write` | `conjunto_id`, `deposito_valor`, `reglas` | Medio | Validar cross-tenant. Documentar como catálogo compartido de conjunto; revisar sensibilidad de reglas/deposito. |
| `registro_visitas` | PRD activo | Pendiente de conteo DEV | Sí | SELECT: admin conjunto, residente propio, vigilancia conjunto. INSERT: `registro_visitas_insert_propios`. UPDATE: `registro_visitas_update_vigilancia_admin`. DELETE: no visible | `visitante_id`, `conjunto_id`, `apartamento_id`, `validado_por`, `qr_code`, `notas` | Alto | Mantener fase 3D.16. Revalidar QR y ownership residente con dataset negativo. |
| `reservas` | Legacy/obsoleto | 0 aprox. según inventario DEV del PR | Sí | SELECT: `reservas por conjunto`. INSERT: `crear reservas residente`. UPDATE/DELETE: no visibles | `zona_id`, `residente_id` | Alto si tiene datos; no aplicable temporalmente | No endurecer; mantener reemplazada por `reservas_zonas` hasta decisión de deprecación/migración. |
| `reservas_bloqueos` | PRD activo / soporte reservas | Pendiente de conteo DEV | Sí | SELECT: `bloqueos_select_conjunto`. ALL/admin write: `bloqueos_admin_write` | `conjunto_id`, `recurso_id`, `creado_por`, `motivo` | Medio | Validar lectura por conjunto y escritura admin. |
| `reservas_documentos` | PRD activo / soporte reservas | Pendiente de conteo DEV | Sí | SELECT: `docs_select_conjunto`. INSERT: `docs_insert_conjunto`. UPDATE/DELETE: no visibles | `reserva_id`, `conjunto_id`, `subido_por`, `ruta_storage`, `tipo_documento` | Alto por documentos/rutas storage | Requiere validación REST y revisión de storage/policies si contiene documentos reales. Considerar issue posterior de ownership adicional por reserva. |
| `reservas_eventos` | PRD activo / soporte auditoría reservas | Pendiente de conteo DEV | Sí | SELECT: `eventos_select_conjunto`. INSERT: `eventos_insert_conjunto`. UPDATE/DELETE: no visibles | `reserva_id`, `conjunto_id`, `actor_id`, `metadata` | Medio/alto | Validar same/cross tenant; revisar si eventos revelan datos privados de otros residentes. |
| `reservas_zonas` | PRD activo | Pendiente de conteo DEV | Sí | SELECT: admin conjunto, residente propio, vigilancia conjunto. INSERT: `reservas_insert_residente_admin`. UPDATE/DELETE: no visibles en diccionario | `conjunto_id`, `recurso_id`, `residente_id`, `apartamento_id`, aprobadores/checkin/checkout, `motivo`, `observaciones` | Alto | Mantener fase 3D.15. Completar dataset same-conjunto para residentes ajenos y validar RPC privacy-safe. |
| `residentes` | PRD activo / base operativa | Pendiente de conteo DEV | Sí | SELECT: admin conjunto, residente propio, vigilancia lookup paquetes. INSERT: `residentes crear admin`. UPDATE/DELETE: no visibles | `usuario_id`, `conjunto_id`, `apartamento_id` | Alto | Mantener fase 3D.13. Validar lookup de vigilancia acotado y consistencia con `tenant_memberships.residente_id`. |
| `roles` | Soporte operativo requerido / catálogo | Pendiente de conteo DEV | Sí | SELECT: `roles_select_authenticated`. Escritura cliente: sin policies | `id`, `nombre` | Bajo | Mantener catálogo autenticado. No usar `vigilante` como rol válido legacy; normalizar datos si aparece con migración revisable. |
| `tenant_memberships` | Soporte operativo requerido / autorización multitenant | Pendiente de conteo DEV | Sí | SELECT: superadmin o acceso al tenant. INSERT/UPDATE: superadmin o `platform_ops`. DELETE: denegado | `user_id`, `conjunto_id`, `role_name`, `residente_id`, `status`, `source_legacy` | Alto | Prioridad alta posterior: validación REST estricta, self-escalation, duplicados activos y coherencia con `usuarios_app`/`residentes`. |
| `tipos_documento` | Soporte operativo requerido / catálogo | Pendiente de conteo DEV | Sí | SELECT: `tipos_documento_select_authenticated`. Escritura cliente: sin policies | `codigo`, `nombre`, `activo` | Bajo | Mantener como catálogo autenticado. |
| `torres` | Soporte operativo requerido | Pendiente de conteo DEV | Sí | SELECT: `torres_select_conjunto`. INSERT/UPDATE/DELETE: admin mismo conjunto | `conjunto_id`, `nombre`, `pisos` | Medio | Validar REST cross-tenant y escritura admin. |
| `trasteos` | Futuro/no implementado | 0 aprox. según inventario DEV del PR | No visible en documentación | No visibles | `residente_id`, `conjunto_id`, `fecha`, `estado` | Alto si se implementa | No tocar. Diseñar RLS antes de uso PRD. |
| `usuarios_app` | Soporte operativo requerido / identidad legacy | Pendiente de conteo DEV | Sí | SELECT: `lectura usuarios` (`true`), `usuario puede verse`. UPDATE: `usuarios actualizar su info`. INSERT/DELETE: no visibles | `id`, `nombre`, `email`, `telefono`, `rol_id`, `conjunto_id` | Alto | Prioridad máxima posterior: validar exposición por policy amplia y abrir hardening si hay lectura cross-tenant de identidad/contacto/roles. |
| `vehiculos` | Futuro/no implementado | 0 aprox. según inventario DEV del PR | No visible en documentación | No visibles | `residente_id` | Alto si se implementa | No tocar. Completar diccionario de columnas desde Supabase antes de cualquier cambio. |
| `visitantes` | PRD activo | Pendiente de conteo DEV | Sí | SELECT: admin conjunto, residente propio, vigilancia conjunto. INSERT: `visitantes_insert_propios`. UPDATE: `visitantes_update_propios`. DELETE: no visible | `residente_id`, `conjunto_id`, `tipo_documento` y datos personales no detallados en extractos | Alto | Mantener fase 3D.16. Validar datos personales y same/cross tenant. |
| `zonas_comunes` | Legacy/obsoleto | 0 aprox. según inventario DEV del PR | No visible en documentación | No visibles | `conjunto_id` | Medio; no aplicable temporalmente | No endurecer; reemplazada funcionalmente por `recursos_comunes`/`reservas_zonas` salvo evidencia contraria. |

## Issues futuros sugeridos

1. **FASE posterior — `usuarios_app` RLS hardening:** reemplazar o acotar `lectura usuarios` si evidencia REST confirma exposición cross-tenant de identidad/rol/contacto.
2. **FASE posterior — `tenant_memberships` validación estricta:** pruebas REST de lectura por tenant, superadmin/platform ops, self-escalation y coherencia con `usuarios_app`/`residentes`.
3. **FASE posterior — `config_pagos` RLS hardening:** validar si `SELECT true` expone configuración de otros conjuntos y acotar por `conjunto_id` si aplica.
4. **FASE posterior — documentos y archivos:** revisar `reservas_documentos` y `archivos` junto con storage policies antes de adjuntar evidencias reales.
5. **FASE posterior — incidentes same-conjunto:** crear dataset negativo para residente/reportante ajeno dentro del mismo conjunto y decidir visibilidad comunitaria vs ownership.

## Decisiones explícitas de esta fase

- No se crean migraciones.
- No se modifican policies.
- No se eliminan tablas legacy.
- No se endurecen tablas vacías/no implementadas solo por existir en Supabase.
- Cualquier hardening posterior debe partir de evidencia REST o de una decisión funcional documentada.
