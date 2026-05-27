# FASE 3A — Diseño técnico Superadmin y arquitectura multi-tenant SaaS

## 1) Resumen ejecutivo

Urbaphix ya opera como SaaS multi-conjunto en datos y RLS, pero su modelo actual de identidad/autorización está centrado en `usuarios_app` (rol + `conjunto_id` en una sola tabla) y en tres roles operativos (`admin`, `vigilancia`, `residente`). Este diseño funciona para operación de conjunto, pero no separa explícitamente los permisos de **plataforma** (Urbaphix) de los permisos de **tenant** (conjunto cliente).

Para introducir `superadmin` sin riesgo de fuga entre tenants, se recomienda evolucionar a un esquema dual de membresías:

- `platform_memberships` (quién administra la plataforma SaaS).
- `tenant_memberships` (quién opera cada conjunto, con rol por tenant).

La estrategia debe mantener compatibilidad progresiva con `usuarios_app` durante transición, endureciendo RLS mediante helpers canónicos (`fn_auth_*`) y agregando auditoría robusta para acciones administrativas de plataforma.

---

## 2) Estado actual encontrado en el código

### 2.1 Autenticación y sesión

- El frontend usa `supabase.auth.getUser()` en bootstrap y `onAuthStateChange` para ciclo de sesión.
- No existe backend intermedio para autorización; la app depende de combinación de filtros en frontend + RLS en DB.
- El login consulta `usuarios_app` para obtener `rol_id` después de autenticación.

### 2.2 Perfil y rol de usuario

- El estado principal de identidad en frontend es `usuarioApp` (fila de `usuarios_app`).
- `rol_id` habilita navegación y módulos visibles (admin/vigilancia/residente).
- No hay concepto implementado de rol de plataforma (por ejemplo `superadmin`) ni separación explícita de ámbitos.

### 2.3 Rutas/guards y control en UI

- No se observan guards de routing por framework (tipo route-level middleware); el control es condicional en `App.jsx` y componentes.
- El menú y paneles se habilitan por `usuarioApp.rol_id`.
- Hay validación de “rol no autorizado” para roles fuera de catálogo frontend, pero no flujo de plataforma separado.

### 2.4 Consumo de Supabase en módulos

- La mayoría de módulos filtran por `conjunto_id` y/o `residente_id` en consultas.
- Existen defensas en cliente (por ejemplo abortar si no hay `conjunto_id`) pero la seguridad real depende de RLS.
- Se usan canales realtime con filtros `conjunto_id=eq.<uuid>` en varios paneles.

---

## 3) Archivos revisados

### Documentación y esquema
- `docs/database-schema.md`
- `docs/rls-roles-audit.md`

### Supabase (estructura/políticas)
- `supabase/migrations/20260410031821_remote_schema.sql`

### Frontend (auth/rol/conjunto)
- `src/App.jsx`
- `src/modules/auth/Login.jsx`
- `src/services/supabaseClient.js`
- `src/hooks/useRealtimeConjuntoChannel.js`

### Módulos representativos con filtros tenant
- `src/modules/visitas/pages/PanelVigilancia.jsx`
- `src/modules/visitas/pages/EscanearQR.jsx`
- `src/modules/paqueteria/pages/PanelPaquetes.jsx`
- `src/modules/paqueteria/services/paquetesService.js`
- `src/modules/contabilidad/pages/PanelPagosAdmin.jsx`
- `src/modules/contabilidad/pages/MisPagos.jsx`
- `src/modules/seguridad/pages/ListaIncidentes.jsx`

---

## 4) Riesgos detectados para arquitectura multi-tenant

1. **Ambigüedad de ámbito de rol**: `rol_id` actual mezcla semántica de operación tenant con potencial operación global; no distingue plataforma vs conjunto.
2. **Dependencia en filtros frontend**: aunque RLS existe, múltiples queries agregan filtros en cliente; cualquier endpoint futuro sin RLS robusta puede abrir cruce de datos.
3. **Políticas con heterogeneidad histórica**: hay antecedentes de drift de nombres de rol (`admin/administrador`, `vigilancia/vigilante`) documentados en auditorías previas.
4. **Tablas con SELECT amplio**: en documentación actual algunas políticas aparecen como `true` o `authenticated` amplio (p.ej., casos como `usuarios_app`, `roles`, `config_pagos`, `archivos`), lo cual exige revisión antes de exponer capacidades de superadmin.
5. **Sin frontera de plataforma**: no existe namespace funcional claro para operaciones “SaaS owner” (alta/baja conjunto, soporte global, feature flags globales, etc.).
6. **Auditoría parcial**: existe `operational_events`, pero falta definir un modelo obligatorio para acciones críticas de plataforma y administración delegada.
7. **Riesgo de escalamiento horizontal**: si `superadmin` se modela como rol dentro de `usuarios_app.rol_id` sin capa de ámbito, se puede romper aislamiento por `conjunto_id`.

---

## 5) Modelo de roles recomendado

## 5.1 Principio
Separar roles por **dominio de autoridad**:

- **Plataforma (global SaaS)**: alcance transversal a tenants.
- **Tenant (conjunto)**: alcance restringido por `conjunto_id`.

## 5.2 Propuesta de tablas objetivo

### `platform_memberships`
Campos mínimos sugeridos:
- `id` (uuid)
- `user_id` (uuid -> `auth.users.id`)
- `platform_role` (text: `superadmin`, `platform_operator`, `support_readonly`)
- `status` (active/suspended)
- `created_at`, `updated_at`

### `tenant_memberships`
Campos mínimos sugeridos:
- `id` (uuid)
- `user_id` (uuid -> `auth.users.id`)
- `conjunto_id` (uuid -> `conjuntos.id`)
- `tenant_role` (text: `admin`, `vigilancia`, `residente`)
- `residente_id` (nullable -> `residentes.id` cuando aplique)
- `status` (active/inactive)
- `created_at`, `updated_at`

## 5.3 Compatibilidad con estado actual

- Mantener `usuarios_app` como capa legacy temporal.
- Migrar lectura de autorización a helpers nuevos, preservando comportamiento vigente mientras se cambia frontend por fases.
- No habilitar `superadmin` en `usuarios_app.rol_id` como solución final.

---

## 6) Separación plataforma vs conjunto

## 6.1 Plataforma Urbaphix
Responsabilidades:
- gestión de tenants (`conjuntos`), catálogos globales, soporte operativo, auditoría global, toggles de módulos.

Acceso:
- solo via `platform_memberships` + RLS específica de plataforma.

## 6.2 Conjuntos clientes
Responsabilidades:
- operación diaria (visitas, pagos, reservas, paquetería, incidentes).

Acceso:
- `tenant_memberships` + `conjunto_id` + (cuando aplique) `residente_id`.

## 6.3 Regla de oro
Ninguna consulta de módulo tenant debe depender de rol global para saltar aislamiento por `conjunto_id`, salvo mediante funciones administrativas explícitas, auditadas y de menor privilegio.

---

## 7) Entidades afectadas

## 7.1 Identidad/autorización
- `usuarios_app` (legacy transicional)
- `roles` (catálogo actual)
- Nuevas: `platform_memberships`, `tenant_memberships`

## 7.2 Entidades tenant-dependientes (alto impacto)
Con base en documentación vigente, dependen de `conjunto_id` y/o relaciones de residente/usuario:
- `apartamentos`, `torres`, `residentes`
- `registro_visitas`, `visitantes`, `accesos`
- `paquetes`
- `pagos`, `pagos_eventos`, `config_pagos`
- `reservas`, `reservas_zonas`, `reservas_eventos`, `reservas_bloqueos`, `reservas_documentos`
- `incidentes`, `multas`, `comunicados`, `pqr`
- `recursos_comunes`, `zonas_comunes`, `parqueaderos`, `trasteos`

## 7.3 Auditoría/observabilidad
- `operational_events` como base para trazabilidad de plataforma + tenant.

---

## 8) Propuesta de arquitectura multi-tenant

1. **Capa de identidad**: `auth.users` como fuente de autenticación.
2. **Capa de autorización**:
   - Global: `platform_memberships`.
   - Tenant: `tenant_memberships`.
3. **Capa de datos tenant**:
   - Mantener `conjunto_id` en tablas operativas.
   - Aplicar RLS con helpers canónicos.
4. **Capa de backend seguro (recomendada para acciones críticas)**:
   - Edge functions/backend con service role + controles explícitos + auditoría.
5. **Capa frontend**:
   - Panel tenant (actual) separado de panel plataforma (`/platform/*`).

---

## 9) Estrategia RLS propuesta

## 9.1 Helpers objetivo

- `fn_is_platform_member()`
- `fn_platform_role()`
- `fn_tenant_role(conjunto uuid)`
- `fn_has_tenant_access(conjunto uuid)`
- mantener `fn_auth_conjunto_id()`, `fn_auth_rol()`, `fn_auth_residente_id()` durante transición

## 9.2 Principios de políticas

- **Default deny** en toda tabla nueva.
- Tablas plataforma: acceso exclusivo a roles de plataforma.
- Tablas tenant: acceso por coincidencia de `conjunto_id` + rol tenant.
- Acciones cross-tenant solo por RPC/funciones explícitas con auditoría obligatoria.

## 9.3 Endurecimiento progresivo

- Revisar tablas con `SELECT true`/permisos amplios y converger a políticas de mínimo privilegio.
- Estandarizar completamente nombres de roles canónicos.
- Evitar lógica duplicada de autorización entre frontend y SQL.

---

## 10) Roadmap técnico por fases

## Fase 3B — Estructura base Supabase y RLS mínima
- Crear `platform_memberships` y `tenant_memberships`.
- Definir helpers RLS nuevos.
- Introducir políticas base para tablas nuevas.
- Mantener backward compatibility con `usuarios_app`.
- Validar aislamiento básico con tests SQL multi-usuario.

## Fase 3C — Panel superadmin MVP
- Crear rutas `/platform/*` aisladas del panel tenant.
- Listado de conjuntos y estado operativo mínimo.
- Gestión básica de membresías de plataforma/tenant (lectura + alta controlada).
- Sin acciones destructivas.

## Fase 3D — Acciones administrativas controladas
- Operaciones sensibles vía backend seguro (no directas desde frontend).
- Flujos de soporte con alcance temporal y auditado.
- Doble validación para acciones de alto impacto.

## Fase 3E — Auditoría, hardening y pruebas de aislamiento
- Cobertura de auditoría 100% en acciones de plataforma.
- Test suite de aislamiento cross-tenant (incluye realtime y storage).
- Pentest interno focalizado en escalamiento de privilegios.
- Cierre de deudas legacy de `usuarios_app`.

---

## 11) Recomendaciones de seguridad

1. **No mapear superadmin como admin de conjunto**: evitar bypass accidental de límites tenant.
2. **Backend obligatorio para acciones críticas**: crear tenants, cambios masivos, impersonación soporte.
3. **Least privilege estricto**: roles de plataforma segmentados (no todo para superadmin).
4. **Auditoría inmutable**: registrar actor, acción, target, diff lógico y motivo.
5. **Session hardening**: verificaciones activas de membresía vigente antes de operaciones críticas.
6. **Pruebas negativas obligatorias**: asegurar que usuario A no ve datos de conjunto B bajo ningún canal (SQL, realtime, storage).
7. **Feature flags por entorno**: habilitar capacidades de plataforma de manera gradual en DEV/QA antes de PRD.

---

## 12) Checklist previo a implementación

- [ ] Inventario final de políticas RLS por tabla con clasificación (tenant/global/pública controlada).
- [ ] Diseño validado de `platform_memberships` y `tenant_memberships` con constraints e índices.
- [ ] Definición oficial de catálogo de roles de plataforma y tenant.
- [ ] Matriz de permisos por módulo (acción × rol × ámbito).
- [ ] Especificación de auditoría obligatoria para acciones críticas.
- [ ] Plan de migración desde `usuarios_app` (sin corte, con rollback).
- [ ] Pruebas de aislamiento multi-tenant automatizadas definidas.
- [ ] Aprobación de seguridad para habilitar panel superadmin en QA.

---

## Nota de implementación

Este entregable corresponde únicamente a diseño técnico (sin cambios funcionales, sin migraciones, sin cambios productivos). Las decisiones propuestas deben ejecutarse en fases posteriores con validación de seguridad y consistencia entre migraciones y documentación de esquema.
