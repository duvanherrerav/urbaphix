# FASE 5.4 — Readiness bloqueo operativo por lifecycle tenant

## Objetivo

Definir, sin ejecutar bloqueos todavía, cómo `tenant_lifecycle.lifecycle_status` y `tenant_lifecycle.operational_lock` deben limitar operaciones tenant para que la suspensión/archivo no sea solo visual, preservando lecturas históricas necesarias y acceso autorizado de plataforma.

Esta fase es **solo documentación y análisis de impacto**. No crea migraciones, no modifica RLS, no cambia frontend y no bloquea operaciones reales.

## Contexto validado

Fuente revisada antes de proponer el diseño:

1. `docs/database-schema.md` como inventario funcional de tablas, columnas, relaciones y RLS.
2. Migraciones lifecycle:
   - `20260709170000_fase_5_1_tenant_lifecycle.sql`.
   - `20260710120000_fase_5_2_rpc_lifecycle_tenants.sql`.
   - `20260710150000_fase_5_3_platform_tenants_lifecycle_summary_rpc.sql`.
3. Servicios frontend existentes bajo `src/services/`.
4. Documentación FASE 5.1, 5.2 y 5.3.

Estado DEV reportado por el issue:

- 2 tenants existen en `public.tenant_lifecycle`.
- Ambos quedaron nuevamente en `lifecycle_status = 'active'` y `operational_lock = false`.
- La prueba funcional generó eventos auditados en `tenant_lifecycle_events` para `active -> suspended` y `suspended -> active` vía RPC con actor `superadmin`.
- La UI FASE 5.3 quedó validada extremo a extremo.

## Principios de seguridad

- El backend/RPC debe ser la autoridad. El frontend puede ocultar acciones, pero no puede ser el único control.
- No usar `service_role` desde frontend.
- No bloquear lecturas históricas necesarias para residentes, administradores, vigilancia ni plataforma.
- No modificar RLS masivamente en una sola PR.
- No dispersar condiciones `lifecycle_status != 'suspended'` en cada módulo sin helper central.
- No inventar tablas, columnas ni relaciones.
- Mantener filtros por `conjunto_id`, `residente_id` y `auth.uid()`.
- Superadmin debe conservar visibilidad y capacidad de gestión autorizada.
- `archived` debe tratarse como estado terminal operativo, salvo capacidades plataforma explícitas de consulta y gestión lifecycle.

## Definición funcional por estado

| Estado | Operación tenant | Lectura histórica | Acceso plataforma | Mutaciones lifecycle |
| --- | --- | --- | --- | --- |
| `onboarding` | Limitada a configuración inicial autorizada; sin operación tenant completa. | Lectura mínima necesaria para configurar y validar. | Permitido para `superadmin` y `platform_ops`. | Permitidas según matriz FASE 5.2. |
| `active` | Operación normal según RLS, roles y permisos existentes. | Permitida según RLS vigente. | Permitido. | Permitidas según matriz FASE 5.2. |
| `suspended` | Bloquear nuevas mutaciones sensibles del tenant. | Conservar histórico y consultas necesarias. | Permitido para gestión, soporte y auditoría. | Reactivar permitido a `superadmin`/`platform_ops`; archivar solo `superadmin`. |
| `archived` | Bloquear nuevas mutaciones y acceso tenant operativo. | Conservar histórico autorizado; preferir vistas/RPC read-only plataforma. | Permitido para plataforma autorizada. | Terminal: no permitir transiciones salientes según FASE 5.2. |

## Separación lectura histórica vs mutación nueva

### Lecturas que no deben bloquearse por lifecycle

- Consulta de historial propio o del conjunto ya autorizado por RLS.
- Auditoría y evidencia operacional.
- Listados read-only necesarios para soporte, conciliación o cierre.
- Métricas plataforma read-only ya protegidas por roles plataforma.
- Consulta de documentos/soportes existentes cuando el usuario ya tenía derecho de lectura.

### Mutaciones nuevas que sí deben evaluarse contra lifecycle

- Crear visitas, registrar accesos nuevos o actualizar salidas/entradas operativas.
- Registrar, cambiar estado o entregar paquetes.
- Crear pagos, modificar estados de pago, registrar eventos financieros o cambiar configuración de pagos.
- Crear reservas, bloqueos, documentos o eventos de reserva.
- Crear incidentes, PQR, multas, comunicados o notificaciones operativas.
- Crear o modificar trasteos.
- Crear o modificar vehículos, parqueaderos, apartamentos, torres, zonas, recursos comunes o residentes, salvo configuración permitida de onboarding.
- Cualquier RPC de mutación tenant que opere por `conjunto_id`.

## Decisión de arquitectura propuesta

### Helper/RPC central reutilizable

Crear en una fase posterior un helper SQL central, sin implementarlo en esta PR:

```sql
public.fn_tenant_is_operational(
  p_conjunto_id uuid,
  p_operation text default 'tenant_mutation'
) returns boolean
```

Responsabilidad propuesta:

- Validar que `p_conjunto_id` no sea nulo.
- Leer `public.tenant_lifecycle` por `conjunto_id`.
- Retornar `true` solo cuando el estado permita la operación solicitada.
- Permitir excepciones explícitas para configuración de `onboarding` si se modelan como operaciones separadas.
- Tratar ausencia de fila lifecycle como no operativa para mutaciones nuevas, con rollout cuidadoso para no romper tenants no backfilled.

Reglas base propuestas:

| Operación | `onboarding` | `active` | `suspended` | `archived` |
| --- | --- | --- | --- | --- |
| `tenant_read` | Sí, según RLS | Sí, según RLS | Sí, según RLS | Solo histórico/autorizado |
| `tenant_mutation` | No, salvo allowlist onboarding | Sí | No | No |
| `tenant_onboarding_config` | Sí, para roles autorizados | No aplica o limitado | No | No |
| `platform_read` | Sí | Sí | Sí | Sí |
| `platform_lifecycle_transition` | Según RPC FASE 5.2 | Según RPC FASE 5.2 | Según RPC FASE 5.2 | No saliente |

### Forma de uso recomendada

Para siguientes fases, usar el helper en puntos de autoridad backend, no solo en UI:

1. RPCs de mutación nuevas o existentes: validar al inicio y lanzar error controlado si el tenant no está operativo.
2. Policies `WITH CHECK` o funciones usadas por RLS: aplicar por lotes pequeños solo donde el riesgo esté validado.
3. Frontend: deshabilitar/ocultar acciones como UX complementaria, mostrando razón de bloqueo sin asumir autoridad.

### Error estándar sugerido

Usar un mensaje uniforme para UX y soporte:

- Código lógico: `TENANT_OPERATIONAL_LOCKED`.
- Mensaje usuario: `El conjunto no permite nuevas operaciones en este momento.`
- Metadata interna: `conjunto_id`, `lifecycle_status`, `operational_lock`, `operation`, `source`.

No exponer detalles sensibles de auditoría ni `actor_user_id` en errores frontend.

## Inventario de flujos sensibles por módulo

| Módulo / tabla | Lectura histórica permitida | Mutaciones sensibles a bloquear en `suspended`/`archived` | Notas de rollout |
| --- | --- | --- | --- |
| Visitas — `registro_visitas`, `visitantes`, `accesos` | Historial de visitas/accesos autorizado por RLS. | Crear visitas, registrar ingresos/salidas nuevas, editar estados operativos. | Primer lote recomendado por impacto operativo claro y relación directa con vigilancia. |
| Paquetes — `paquetes` | Consulta de paquetes históricos/pendientes ya autorizados. | Registrar paquetes, cambiar estado, marcar entrega o actualizar receptor. | Primer lote recomendado junto con visitas por operación diaria sensible. |
| Pagos — `pagos`, `pagos_eventos`, `config_pagos` | Historial financiero, evidencias y conciliación. | Crear pagos/eventos, aprobar/rechazar pagos, cambiar vencimientos/mora, modificar configuración. | Requiere cuidado adicional por conciliación contable y estados en curso. |
| Reservas — `reservas`, `reservas_zonas`, `reservas_bloqueos`, `reservas_documentos`, `reservas_eventos` | Historial de reservas y soportes. | Crear reservas, bloquear zonas, adjuntar documentos operativos, cambiar estados. | Segundo lote; revisar constraint de solape y cancelaciones administrativas. |
| Incidentes — `incidentes` | Historial de incidentes y seguimiento autorizado. | Crear nuevos incidentes o cambiar estados si implica gestión operativa nueva. | Separar cierres de casos abiertos vs creación nueva. |
| Comunicados — `comunicados`, `notificaciones` | Comunicados publicados e historial de notificaciones. | Publicar comunicados nuevos o enviar notificaciones masivas tenant. | Puede requerir excepción plataforma para avisos de suspensión. |
| Trasteos — `trasteos` | Historial de trasteos. | Crear, aprobar, reprogramar o cerrar trasteos operativos nuevos. | Bloquear nuevas solicitudes; definir si cancelar/cerrar histórico sigue permitido. |
| Vehículos/parqueaderos — `vehiculos`, `parqueaderos` | Consulta de asignaciones y vehículos existentes. | Crear/editar vehículos, asignar/desasignar parqueaderos, cambios operativos. | Requiere validar roles actuales y flujos admin/residente. |
| Residentes/usuarios tenant — `residentes`, `usuarios_app`, `tenant_memberships` | Consulta autorizada del padrón existente. | Alta/baja/edición tenant operativa, invitaciones o membresías tenant no plataforma. | En `onboarding` puede requerir allowlist controlada de configuración inicial. |
| Estructura del conjunto — `apartamentos`, `torres`, `zonas_comunes`, `recursos_comunes` | Consulta de estructura existente. | Crear/editar/eliminar estructura operativa. | Tratar como configuración; permitir solo en onboarding si existe proceso aprobado. |
| PQR/multas — `pqr`, `multas` | Historial autorizado. | Crear PQR/multas nuevas o mutar estados sancionatorios. | Revisar obligaciones legales antes de bloquear cierre/consulta. |
| Archivos — `archivos`, `reservas_documentos` | Descargar/ver soportes existentes según autorización. | Subir nuevos soportes asociados a operaciones bloqueadas. | No bloquear soportes de auditoría plataforma si se implementan por RPC autorizada. |
| Auditoría plataforma — `tenant_lifecycle_events`, `operational_events` | Lectura plataforma autorizada. | No aplica para tenant; auditoría debe seguir registrando intentos/transiciones. | No bloquear auditoría por lifecycle. |

## Matriz de actores

| Actor | `onboarding` | `active` | `suspended` | `archived` |
| --- | --- | --- | --- | --- |
| `superadmin` | Ve y gestiona lifecycle; puede ejecutar configuración plataforma autorizada. | Visibilidad plataforma y transiciones permitidas. | Mantiene visibilidad, puede reactivar o archivar según RPC. | Mantiene visibilidad histórica; no transición saliente. |
| `platform_ops` | Ve y opera transiciones permitidas excepto archivar. | Soporte y operación plataforma autorizada. | Puede reactivar según RPC; no archivar. | Visibilidad histórica/autorizada; sin salida de archived. |
| `admin_conjunto` | Acceso limitado a configuración permitida si se define allowlist. | Operación normal según RLS. | Lectura histórica; mutaciones sensibles bloqueadas. | Sin acceso tenant operativo; lectura histórica solo si se autoriza explícitamente. |
| `vigilante` | Sin operación completa salvo flujo de activación aprobado. | Operación de vigilancia normal según RLS. | Lectura histórica/consulta necesaria; nuevos accesos/visitas bloqueados. | Sin operación tenant. |
| `residente` | Acceso limitado si existe proceso de alta/onboarding. | Operación normal según RLS. | Lectura de histórico propio; nuevas solicitudes sensibles bloqueadas. | Sin operación tenant; histórico propio solo si se decide conservar. |
| `anon` | Sin acceso operativo. | Sin acceso operativo salvo endpoints públicos ya existentes y validados. | Sin acceso operativo. | Sin acceso operativo. |

## Estrategia DEV-first y rollout incremental

1. **FASE 5.4.1 — Helper central en DEV**
   - Crear helper/RPC de validación operativa.
   - Validar grants, `search_path`, ausencia de acceso `anon` si corresponde y comportamiento con tenants activos/suspendidos/archivados.
   - No conectar aún todos los módulos.
2. **FASE 5.4.2 — Primer lote de mutaciones de bajo acoplamiento**
   - Aplicar helper a visitas/accesos y paquetes.
   - Agregar pruebas negativas para `suspended` y `archived`.
   - Mantener lecturas históricas.
3. **FASE 5.4.3 — Reservas y trasteos**
   - Bloquear nuevas reservas/trasteos y cambios operativos.
   - Definir excepción para cancelaciones/cierres administrativos si aplica.
4. **FASE 5.4.4 — Pagos y configuración financiera**
   - Diseñar con mayor control por implicaciones contables.
   - Probar escenarios de conciliación, aprobación/rechazo y eventos.
5. **FASE 5.4.5 — Comunicados, incidentes, PQR, multas y estructura**
   - Aplicar por sublotes pequeños.
   - Documentar excepciones legales/operativas antes de bloquear.
6. **FASE 5.4.6 — UX complementaria**
   - Deshabilitar acciones visibles en frontend solo después de que backend sea autoridad.
   - Mostrar mensajes consistentes basados en el error estándar.

## Pruebas negativas requeridas por lote

Para cada módulo conectado al helper:

- Tenant `active`: mutación válida sigue funcionando con actor autorizado.
- Tenant `suspended`: mutación nueva falla sin insertar/actualizar datos.
- Tenant `archived`: mutación nueva falla sin insertar/actualizar datos.
- Lectura histórica del mismo actor sigue funcionando cuando RLS lo permitía.
- Cross-tenant sigue denegado por RLS/filtros existentes.
- `anon` no obtiene nuevas capacidades.
- Usuario sin rol requerido no puede usar la mutación aunque el tenant esté `active`.
- Superadmin/platform_ops mantienen lectura plataforma autorizada.
- Intento bloqueado no deja efectos parciales ni eventos de negocio falsos.
- Si se auditan intentos bloqueados en una fase futura, la auditoría no debe contener PII innecesaria.

## Criterios no-go

No avanzar de DEV a QA/producción si ocurre cualquiera de estos casos:

- El helper permite mutaciones en `suspended` o `archived` para operaciones tenant no exceptuadas.
- Se rompe una lectura histórica requerida por RLS existente.
- Se abre acceso `anon` o cross-tenant accidental.
- Se requiere `service_role` en frontend.
- Una policy/RPC omite `conjunto_id`, `residente_id` o `auth.uid()` donde corresponde.
- Una migración mezcla muchos módulos sin rollback claro.
- La ausencia de fila en `tenant_lifecycle` no está resuelta con backfill o criterio explícito.
- El frontend queda como único enforcement.

## Rollback por lote

- Mantener cada lote en una migración pequeña y reversible.
- Preferir `CREATE OR REPLACE FUNCTION` para ajustar helper sin tocar datos.
- Para policies nuevas, documentar `DROP POLICY`/restauración explícita antes de ejecutar.
- Verificar antes/después con conteos de filas afectadas y pruebas negativas.
- Si se detecta bloqueo indebido de lecturas, revertir el lote que conectó el módulo, no el modelo lifecycle completo.

## Primer lote recomendado

Implementar primero **visitas/accesos y paquetes** porque:

- Son flujos operativos diarios con riesgo claro si un tenant suspendido sigue generando actividad.
- Tienen separación relativamente clara entre lectura histórica y creación/cambio de estado.
- Permiten validar el patrón helper sin tocar pagos ni configuración financiera.
- Son buenos candidatos para pruebas negativas manuales y SQL en DEV.

Alcance sugerido del primer lote:

- Validar `registro_visitas`, `visitantes` y `accesos` para creación/actualización operativa.
- Validar `paquetes` para creación y cambios de estado/entrega.
- No tocar pagos, reservas, comunicados ni estructura en el mismo PR.
- No modificar UI hasta confirmar enforcement backend.

## Roadmap implementable FASE 5.4.1+

| Fase | Entregable | Cambios permitidos | Validación mínima |
| --- | --- | --- | --- |
| 5.4.1 | Helper/RPC central de estado operativo | Migración SQL + docs schema | SQL de grants, estados y errores controlados |
| 5.4.2 | Bloqueo backend visitas/paquetes | Migración/policies/RPCs acotadas + docs | Pruebas negativas `active/suspended/archived` |
| 5.4.3 | Bloqueo backend reservas/trasteos | Migraciones pequeñas por módulo | Pruebas de creación, cancelación y lectura histórica |
| 5.4.4 | Bloqueo pagos/configuración financiera | Diseño específico + migraciones acotadas | Conciliación, auditoría y rollback |
| 5.4.5 | Resto de flujos tenant | Sublotes independientes | No regresión cross-tenant/anon |
| 5.4.6 | UX complementaria | Frontend solo como reflejo de backend | Build/lint + pruebas manuales por rol |

## Validaciones indicadas para esta fase documental

- Confirmar que el documento no crea ni cambia migraciones.
- Confirmar que no modifica RLS ni frontend.
- Confirmar que el inventario se basa en tablas y módulos existentes en `docs/database-schema.md` y migraciones lifecycle.
- Ejecutar validaciones estáticas disponibles del repositorio cuando sean razonables para una PR documental.
