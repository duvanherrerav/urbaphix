# FASE 4.2 — Dashboard plataforma MVP read-only

## Alcance implementado

- Reemplaza placeholders principales de `/superadmin` por un dashboard MVP read-only para operación plataforma.
- Consume métricas globales agregadas mediante `fn_platform_dashboard_metrics()` con sesión autenticada Supabase desde frontend, sin `service_role`.
- No agrega CRUD, tablas, columnas, FKs ni políticas RLS; la única migración incorpora una RPC `SECURITY DEFINER` read-only para métricas globales autorizadas.
- Evita PII detallada: solo muestra contadores agregados y metadatos de sesión/membership ya visibles para el usuario plataforma autenticado.

## KPIs iniciales

El dashboard muestra tarjetas globales SaaS para roles plataforma autorizados (`superadmin` o `platform_ops`):

1. conjuntos
2. usuarios app
3. memberships tenant activos
4. memberships plataforma activos
5. residentes
6. visitas últimos 30 días
7. paquetes pendientes
8. pagos pendientes
9. incidentes abiertos (`nuevo`, `en_gestion`)

## Validación esperada DEV

Precheck de referencia reportado para DEV:

- conjuntos: 2
- usuarios_app: 5
- tenant_memberships_active: 5
- platform_memberships_active: 1
- residentes: 3
- visitas_30d: 2
- paquetes_pendientes: 2
- pagos_pendientes: 2
- incidentes_abiertos: 0

## Checklist manual

- [ ] Superadmin ingresa a `/superadmin` y ve las 9 tarjetas KPI.
- [ ] `platform_ops` ve el dashboard si `SuperadminGuard` permite su membership activa.
- [ ] Usuario tenant sin `platform_membership` activa no entra a `/superadmin`.
- [ ] Estados de carga, error y sin datos se renderizan sin exponer documentos, placas, comprobantes ni PII detallada.
- [ ] Las métricas globales provienen de `fn_platform_dashboard_metrics()` y no de consultas tenant directas desde frontend.
- [ ] `npm run build:dev` pasa como check de build válido del repo.
- [ ] `npm run lint` pasa si el proyecto mantiene script de lint disponible.
