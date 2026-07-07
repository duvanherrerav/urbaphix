# FASE 3D.33 — Priorización siguiente lote anon GraphQL

## Alcance

Esta fase es **solo documental**. No ejecuta SQL, no crea migraciones, no cambia RLS/policies y no modifica frontend. Su objetivo es priorizar el siguiente lote pequeño de revocación de grants `anon` heredados sobre tablas sensibles expuestas por GraphQL/PostgREST para una futura FASE 3D.34.

## Contexto validado

- FASE 3D.31 confirmó que varias tablas `public` conservan `SELECT` heredado para `anon`, son visibles por GraphQL y devolvieron `anon_visible_rows = 0` en DEV. La ausencia de filas visibles no cierra el riesgo de metadata/introspection ni el riesgo futuro si cambian datos o policies.
- FASE 3D.32 ya revocó grants `anon` únicamente en `public.archivos` y `public.usuarios_app`.
- La revisión de esta fase se limita a tablas candidatas sensibles: `residentes`, `visitantes`, `pagos`, `registro_visitas`, `tenant_memberships`, `platform_memberships`, `accesos`, `paquetes`, `pqr`, `notificaciones` y `multas`.
- La fuente de verdad revisada fue: `docs/database-schema.md`, migraciones existentes en `supabase/migrations/`, `src/services/` y consumos frontend/API directos con Supabase.

## Criterios de clasificación

| Prioridad | Significado | Acción esperada |
| --- | --- | --- |
| P0 | Tabla sensible sin dependencia `anon`, con rol claro en login/bootstrap o multi-tenant, y cuyo cierre reduce superficie crítica de identidad/tenancy. | Candidata fuerte para lote 3D.34 si prechecks confirman grants actuales. |
| P1 | Tabla sensible y usada por módulos autenticados; cierre deseable, pero requiere validar flujos operativos para evitar regresiones percibidas. | Candidata posterior o dentro de 3D.34 solo si el lote se mantiene pequeño. |
| P2 | Tabla modelada/futura, sin consumo frontend directo o con menor urgencia relativa; conviene no mezclarla con el primer lote sensible. | Backlog, no primer lote salvo evidencia nueva. |

Dependencias evaluadas:

- **Frontend/API:** uso directo de `.from('<tabla>')` o RPCs/módulos que dependen de la tabla.
- **Login/bootstrap:** impacto en resolución inicial de sesión, perfil, membership o superadmin.
- **Módulo:** dependencia funcional autenticada por módulo; no implica necesidad de `anon`.
- **Multi-tenant/Superadmin:** si la tabla participa en separación por `conjunto_id`, `residente_id`, membresías o plataforma.

## Matriz de priorización

| Tabla | Prioridad | Riesgo principal | Dependencia frontend/API | Dependencia login/bootstrap | Dependencia módulo | Lectura multi-tenant / superadmin | Recomendación |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tenant_memberships` | P0 | Identidad tenant, rol, `conjunto_id`, `residente_id`; metadata sensible para autorización. | Sí, `src/services/membershipResolver.js` consulta memberships autenticadas para resolver sesión. | **Alta autenticada**; no debe depender de `anon`. | Transversal a todos los módulos tenant-aware. | Crítica; base de roles `admin_conjunto`, `contador`, `residente`, `vigilancia`. | Incluir en lote 3D.34 con revocación `anon`; validar login autenticado y fallback legacy. |
| `platform_memberships` | P0 | Membresías de plataforma/superadmin; superficie sensible aunque no haya consumo frontend directo encontrado. | No se encontró `.from('platform_memberships')` directo en `src/`. | Potencial para superadmin, pero no debe ser `anon`. | Plataforma/operación interna. | Crítica para separación platform vs tenant. | Incluir en lote 3D.34 si precheck confirma grant `anon`; validar que superadmin usa sesión authenticated/RLS o RPC segura. |
| `residentes` | P1 | PII y ownership por `residente_id`; lookup operativo de residentes. | Sí; visitas, paquetería, contabilidad y reservas consultan `residentes`. | Media autenticada: flujos de residente y módulos usan perfil/ownership, pero no `anon`. | Visitas, paquetes, pagos, reservas. | Alta; policies distinguen admin/vigilancia/residente propio por `conjunto_id` y membership. | No mezclar en primer lote si se busca mínimo riesgo; candidata inmediata posterior tras validar portería/paquetería/contabilidad. |
| `pagos` | P1 | Datos financieros y comprobantes/estado de cartera. | Sí; dashboard admin, contabilidad admin y mis pagos. | Baja para login; alta para módulo contable autenticado. | Contabilidad/cartera. | Alta; admin por conjunto y residente propio. | Mantener fuera del lote mínimo inicial; preparar lote financiero específico junto con `pagos_eventos`/`config_pagos` si aplica. |
| `visitantes` | P1 | PII de visitantes y relaciones con residentes. | Sí; componentes de visitas y vigilancia. | Baja para login; alta para módulo visitas. | Visitas/portería. | Alta; admin/vigilancia por conjunto y residente propio. | Candidata posterior con `registro_visitas`; no separar si se endurece flujo de visitas. |
| `registro_visitas` | P1 | Historial operativo de ingresos/salidas, QR y trazabilidad de seguridad. | Sí; dashboard admin, portería, visitas y panel vigilancia. | Baja para login; alta para módulo visitas. | Visitas/portería/seguridad. | Alta; conjunto, visitante, residente y validador. | Candidata posterior junto con `visitantes`; requiere smoke test de QR/panel vigilancia. |
| `notificaciones` | P1 | Mensajes por usuario y vector de escritura/lectura sensible por contexto. | Sí; campana global, seguridad, visitas, pagos y paquetería insertan/leen. | Baja para login; puede afectar UX post-login. | Transversal. | Media/alta; lectura por `usuario_id`, inserts por módulos. | No incluir en 3D.34 mínimo; requiere diseño separado de inserts por contexto/RPC antes de tocar más que grants. |
| `paquetes` | P1 | Datos operativos de entregas y destinatario residente. | Sí; KPIs admin, portería, paquetería y mis paquetes. | Baja para login; alta para módulo paquetería. | Paquetería/portería. | Alta; residente propio y vigilancia/admin por conjunto. | Posterior; validar realtime/notificaciones y flujos vigilancia antes de revocar en lote operativo. |
| `accesos` | P2 | Registros/solicitudes de acceso; sensible por seguridad física. | No se encontró consumo directo `.from('accesos')` en `src/`. | Sin dependencia login encontrada. | Seguridad/accesos modelado. | Debe respetar `conjunto_id`/actor cuando se active. | Backlog; buena candidata de bajo uso, pero no primero por menor evidencia de módulo activo. |
| `pqr` | P2 | Solicitudes residentes con contenido potencialmente sensible. | No se encontró consumo directo `.from('pqr')` en `src/`. | Sin dependencia login encontrada. | Futuro/no implementado según auditorías previas. | Residente propio y administración por conjunto cuando exista módulo. | Backlog; revocar en lote de tablas modeladas no activas tras confirmar roadmap. |
| `multas` | P2 | Información financiera/disciplinaria. | No hay consumo directo de tabla; solo mención textual en UI de pagos. | Sin dependencia login encontrada. | Futuro/modelado financiero. | Admin por conjunto/residente asociado. | Backlog; no mezclar con lote inicial hasta definir módulo/ownership completo. |

## Lote pequeño propuesto para FASE 3D.34

Propuesta conservadora:

1. `tenant_memberships`
2. `platform_memberships`

Justificación:

- Son tablas de autorización/identidad con sensibilidad alta y sin necesidad válida de acceso `anon`.
- `tenant_memberships` sí participa en bootstrap, pero el consumo actual ocurre después de tener `auth.uid()` y debe operar como `authenticated`, igual que `usuarios_app` tras FASE 3D.32.
- `platform_memberships` protege separación Superadmin/plataforma; no se detectó consumo frontend directo que justifique `anon`.
- El lote es pequeño y evita mezclar módulos funcionales con alto uso operativo como pagos, visitas, paquetería o notificaciones.

## Prechecks obligatorios antes de ejecutar 3D.34

Antes de crear la migración de 3D.34, confirmar en DEV/QA:

1. Grants actuales de `anon` sobre `tenant_memberships` y `platform_memberships`.
2. Que `authenticated` conserva los permisos necesarios y que RLS sigue resolviendo membership/superadmin.
3. Login de usuario residente, admin de conjunto, vigilancia y superadmin sin loops ni fallback inesperado.
4. `membershipResolver` resuelve `tenant_memberships` con sesión autenticada.
5. No existe dependencia pública/anon documentada para resolver tenants, roles o plataforma.

## No acciones en esta fase

- No se crea migración SQL.
- No se ejecutan `REVOKE`.
- No se modifican policies RLS.
- No se cambia frontend.
- No se actualiza `docs/database-schema.md` porque no cambia estructura, grants ni policies; este documento es la priorización solicitada.
