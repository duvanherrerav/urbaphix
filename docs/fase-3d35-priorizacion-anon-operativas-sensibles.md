# FASE 3D.35 — Priorización anon operativas sensibles

## Alcance

Esta fase es **solo documental**. No crea migraciones SQL, no ejecuta `REVOKE`, no modifica RLS/policies, no cambia frontend y no actualiza `docs/database-schema.md` porque no hay cambio técnico de estructura, grants ni policies.

El objetivo es priorizar el siguiente hardening de grants `anon` para tablas operativas sensibles que, según el precheck DEV informado, aún conservan `anon SELECT` y `authenticated SELECT`:

- `residentes`
- `visitantes`
- `registro_visitas`
- `pagos`
- `paquetes`
- `notificaciones`

## Contexto cerrado y restricciones

- FASE 3D.32 ya retiró `anon` de `archivos` y `usuarios_app`; no se reabren en esta fase.
- FASE 3D.34 ya retiró `anon` de `tenant_memberships` y `platform_memberships`; no se reabren en esta fase.
- La priorización debe conservar login, bootstrap, `membershipResolver`, residentes, vigilancia, `admin_conjunto`, contador y futuro superadmin.
- La ruta sigue enfocada en Superadmin y arquitectura multi tenant sin reprocesos ni regresiones.
- No se revoca en lote y no se mezclan demasiados módulos en una sola fase posterior.

## Fuentes revisadas

Se revisó la fuente de verdad en el orden requerido por el repositorio:

1. `docs/database-schema.md` para estructura, FKs, RLS documentado y notas de fases previas sobre `residentes`, `visitantes`, `registro_visitas`, `pagos`, `paquetes` y `notificaciones`.
2. `supabase/migrations/`, especialmente las migraciones de hardening por módulo: pagos FASE 3D.12, residentes FASE 3D.13, paquetes FASE 3D.14, visitantes/registro_visitas FASE 3D.16, archivos/usuarios_app FASE 3D.32 y memberships FASE 3D.34.
3. `src/services/`, incluyendo `membershipResolver`, servicios de contabilidad, paquetería, visitas/portería y productores de notificaciones.
4. Módulos frontend/API que consumen Supabase directamente: residentes, vigilancia/visitas, contabilidad, paquetería, dashboard admin y campana de notificaciones.

## Criterios de clasificación

| Riesgo | Significado | Implicación para FASE 3D.36 |
| --- | --- | --- |
| Alto | PII, información financiera, trazabilidad física, vínculo `residente_id`/`usuario_id` o datos operativos con impacto directo. | Candidata a hardening, pero solo con lote pequeño y smoke tests por rol. |
| Medio | Datos operativos sensibles pero con dependencia acotable por `conjunto_id`, `residente_id` o `usuario_id`. | Candidata si comparte módulo y validaciones con otra tabla del lote. |
| Transversal | Tabla usada por varios módulos o como canal común. | Evitar mezclar con módulos funcionales hasta revisar productores/consumidores. |

Criterios técnicos usados para evitar regresiones:

- El acceso cliente debe seguir autenticado y filtrado por `conjunto_id`, `residente_id` y/o `auth.uid()` según corresponda.
- Las policies existentes deben seguir siendo la frontera real después de retirar `anon` en una fase futura.
- La revocación futura de `anon SELECT` no debe cambiar `authenticated SELECT` ni reemplazar RLS por filtros frontend.
- Cualquier fase futura con SQL deberá incluir migración y actualización de `docs/database-schema.md` si cambia grants/policies documentadas.

## Revisión de consumo por módulo

### 1. Residentes — identidad / PII

**Tablas involucradas:** `residentes`.

**Consumo observado:**

- Visitas/portería resuelve residentes para panel de vigilancia, escaneo QR y validaciones de visitante.
- Paquetería usa residentes para resolver destinatarios, apartamento y consultas de paquetes propios.
- Contabilidad usa residentes para crear cobros, listar cartera y resolver pagos propios.
- Reservas consulta residentes para ownership operativo.

**Riesgo:** alto por PII, vínculo con `usuario_id`, `residente_id`, apartamentos y `conjunto_id`.

**Dependencia de roles:** residente propio, vigilancia/portería, `admin_conjunto`, contador en flujos financieros, y futuro superadmin por lectura cross-tenant controlada.

**Lectura de priorización:** aunque `residentes` es una tabla central y no debería necesitar `anon`, tocarla primero puede generar regresiones percibidas en varios módulos porque actúa como lookup transversal. Conviene no mezclarla con pagos, paquetes o visitas en la misma fase SQL inicial de 3D.36.

### 2. Visitantes y registro_visitas — visitas / portería

**Tablas involucradas:** `visitantes`, `registro_visitas`.

**Consumo observado:**

- Residentes crean y consultan visitas propias.
- Vigilancia/portería consulta visitantes y registros por `conjunto_id`, valida QR y actualiza estados de ingreso/salida.
- Dashboard admin consume registros recientes y métricas de visitas.
- Realtime escucha cambios de `registro_visitas` para paneles operativos.

**Riesgo:** alto por PII de visitantes, documentos, placas, relación con residentes y trazabilidad de accesos físicos.

**Dependencia de roles:** residente propio, vigilancia/portería same-tenant, `admin_conjunto` y futuro superadmin. El flujo debe conservar lectura operativa por `conjunto_id` y ownership por `residente_id`.

**Lectura de priorización:** estas dos tablas forman un módulo coherente. Si se endurecen grants `anon`, deben tratarse juntas para evitar un estado intermedio donde visitantes quede cerrado pero registros aún referencien datos visibles o viceversa.

### 3. Pagos — pagos / contabilidad

**Tablas involucradas:** `pagos`.

**Consumo observado:**

- Residentes consultan sus pagos y suben/reemplazan comprobantes.
- Admin/contador crean cobros, revisan cartera, aprueban/rechazan pagos y consultan dashboards financieros.
- Componentes financieros calculan cartera, estado de cuenta, vencimientos y KPIs.
- Realtime escucha cambios de `pagos` para vistas de residente y admin.

**Riesgo:** alto por información financiera, comprobantes, estados de cartera, valores, fechas de vencimiento y vínculo con residentes.

**Dependencia de roles:** residente propio, `admin_conjunto`, contador y futuro superadmin. Debe mantenerse la separación por `conjunto_id` y el ownership por `residente_id`.

**Lectura de priorización:** `pagos` merece lote propio o posterior porque tiene criticidad funcional y contable. No conviene mezclarlo con visitas/portería en 3D.36 si el objetivo es un lote pequeño y reversible.

### 4. Paquetes — paquetes / portería

**Tablas involucradas:** `paquetes`.

**Consumo observado:**

- Paquetería registra recepción, lista paquetes por conjunto y permite consultar paquetes propios.
- Vigilancia/portería calcula resumen operativo junto con visitas e incidentes.
- Dashboard admin y KPIs consultan paquetes pendientes.
- Realtime escucha cambios de `paquetes` por `conjunto_id` y por `residente_id`.

**Riesgo:** medio/alto por destinatario, apartamento, trazabilidad de recepción/entrega y operación física de portería.

**Dependencia de roles:** residente propio, vigilancia/portería same-tenant, `admin_conjunto` y futuro superadmin.

**Lectura de priorización:** aunque sensible, `paquetes` tiene menor exposición de PII que visitas y menor criticidad contable que pagos. Puede ser candidato después de validar visitas/portería o en un lote operativo independiente con smoke tests de realtime.

### 5. Notificaciones — canal transversal

**Tablas involucradas:** `notificaciones`.

**Consumo observado:**

- Campana global lee y marca notificaciones por usuario.
- Visitas, portería, paquetería, pagos y seguridad insertan notificaciones de eventos.
- Componentes especializados escuchan realtime o filtran mensajes por tipo/contexto.

**Riesgo:** alto/transversal por mensajes personalizados, `usuario_id`, eventos de seguridad/visitas/pagos/paquetes y posible enumeración de actividad si se expone fuera del propietario.

**Dependencia de roles:** usuarios autenticados consumidores, módulos productores y futuro superadmin para auditoría/soporte si se formaliza.

**Lectura de priorización:** no debe incluirse en el primer lote operativo porque cruza demasiados módulos y combina lectura, update e inserts desde varios contextos. Requiere revisión separada de producers/consumers y quizá una decisión futura sobre RPC/backend para escritura controlada.

## Matriz de priorización

| Módulo | Tablas | Riesgo | Dependencia operativa | Riesgo de regresión si se retira `anon` | Recomendación |
| --- | --- | --- | --- | --- | --- |
| Identidad / PII | `residentes` | Alto | Transversal: visitas, paquetes, pagos, reservas, admin. | Medio/alto por lookup común, aunque no debe depender de `anon`. | No primer lote; preparar fase propia con smoke tests de lookups por rol. |
| Visitas / portería | `visitantes`, `registro_visitas` | Alto | Coherente dentro de módulo visitas, QR, panel vigilancia, dashboard admin. | Medio si se validan roles y realtime; alto si se mezcla con otros módulos. | **Mejor candidato para FASE 3D.36** como lote pequeño de dos tablas. |
| Pagos / contabilidad | `pagos` | Alto | Residente, admin, contador, dashboards financieros, comprobantes. | Alto por criticidad contable y UX de pagos. | Fase posterior específica financiera. |
| Paquetes / portería | `paquetes` | Medio/alto | Paquetería, vigilancia, admin KPIs, residente propio. | Medio por realtime y recepción/entrega. | Fase posterior operativa o después de visitas. |
| Notificaciones | `notificaciones` | Alto/transversal | Campana global y productores desde varios módulos. | Alto por cruce de lectura/update/insert. | Separar; no mezclar con 3D.36. |

## Lote pequeño propuesto para futura FASE 3D.36

Propuesta conservadora:

1. `visitantes`
2. `registro_visitas`

Justificación:

- Es un lote pequeño de dos tablas del mismo módulo funcional.
- Reduce superficie `anon` sobre PII de visitantes y trazabilidad física de accesos.
- Evita mezclar pagos/contabilidad, paquetes y notificaciones en una misma migración.
- Conserva el foco multi tenant porque ambos accesos ya deben depender de `conjunto_id`, `residente_id`, memberships y roles autenticados.
- Permite validar un conjunto acotado de flujos: residente crea/consulta visita propia, vigilancia opera panel/QR same-tenant, admin consulta dashboard, y ausencia de lectura cross-tenant.

## Prechecks recomendados antes de ejecutar FASE 3D.36

Antes de crear migración SQL en una fase posterior:

1. Confirmar en DEV/QA que `visitantes` y `registro_visitas` aún tienen `anon SELECT` y `authenticated SELECT`.
2. Confirmar que no hay uso frontend/API sin sesión para visitas, QR o portería.
3. Validar que usuarios autenticados siguen leyendo por RLS:
   - residente: visitantes/registros propios;
   - vigilancia: visitantes/registros del mismo `conjunto_id`;
   - `admin_conjunto`: registros del mismo `conjunto_id`;
   - contador: sin acceso ampliado no requerido para visitas;
   - futuro superadmin: solo vía diseño explícito de plataforma, no por `anon`.
4. Probar realtime de `registro_visitas` después de revocar `anon` en DEV/QA.
5. Capturar evidencia negativa cross-tenant por `conjunto_id` y `residente_id`.

## Backlog posterior sugerido

1. **FASE 3D.37 — Residentes / identidad PII:** retirar `anon` de `residentes` con pruebas de lookup para visitas, pagos, paquetes, reservas y bootstrap autenticado.
2. **FASE 3D.38 — Pagos / contabilidad:** retirar `anon` de `pagos` con validación de residente, admin, contador, comprobantes, cartera y dashboard financiero.
3. **FASE 3D.39 — Paquetes / portería:** retirar `anon` de `paquetes` con validación de recepción, entrega, residente propio, vigilancia y KPIs admin.
4. **FASE 3D.40 — Notificaciones transversales:** revisar `notificaciones` por separado, incluyendo productores, consumidores, `usuario_id`, realtime, update de leído y posible estrategia RPC/backend.

## No acciones en esta fase

- No se crea migración SQL.
- No se ejecuta SQL.
- No se modifican grants, RLS ni policies.
- No se modifica frontend.
- No se actualiza `docs/database-schema.md`.
- No se reabren `archivos`, `usuarios_app`, `tenant_memberships` ni `platform_memberships` salvo evidencia nueva en otra fase.
