# FASE 4.5 — Operación Superadmin read-only

## Objetivo

Agregar al módulo Superadmin una vista read-only de operación con señales agregadas cross-tenant de visitas, paquetes, pagos e incidentes.

## Alcance implementado

- Nueva sección **Operación** en la navegación de `/superadmin`.
- Vista read-only con KPIs agregados por dominio operativo:
  - visitas.
  - paquetes.
  - pagos.
  - incidentes.
- Resumen por `estado` para cada dominio, sin listar filas operativas ni datos sensibles.
- Fuente RLS-safe mediante RPC `fn_platform_operations_summary()` `SECURITY DEFINER`.
- Autorización limitada a sesión autenticada con rol plataforma activo:
  - `fn_is_platform_superadmin()`.
  - `fn_has_platform_role('platform_ops')`.

## Datos expuestos

La vista solo muestra agregados:

- total histórico por dominio.
- total creado en los últimos 30 días por dominio.
- total abierto/pendiente por dominio.
- conteos agrupados por estado.

No se muestran personas, documentos, placas, teléfonos, comprobantes, descripciones, notas, direcciones residenciales ni URLs de evidencia.

## Fuera de alcance

- CRUD operativo.
- Acciones sobre visitas, paquetes, pagos o incidentes.
- Modificar policies RLS.
- Usar `service_role` en frontend.
- Listar registros individuales o PII detallada.
- Soporte o auditoría de plataforma.

## Validación esperada DEV

Precheck informado para DEV:

- `registro_visitas_total`: 2.
- `registro_visitas_30d`: 2.
- `paquetes_total`: 2.
- `paquetes_pendientes`: 2.
- `pagos_total`: 2.
- `pagos_pendientes`: 2.
- `incidentes_total`: 1.
- `incidentes_abiertos`: 1.
- Estados actuales:
  - `registro_visitas`: `pendiente=2`.
  - `paquetes`: `pendiente=2`.
  - `pagos`: `pendiente=2`.
  - `incidentes`: `nuevo=1`.

Checklist manual:

- [ ] Superadmin ve la sección **Operación** en `/superadmin`.
- [ ] Puede navegar entre **Resumen plataforma**, **Tenants**, **Usuarios/Memberships** y **Operación**.
- [ ] KPIs de DEV muestran los valores esperados del precheck.
- [ ] El resumen por estado se renderiza sin PII.
- [ ] Usuario sin `platform_membership` activa sigue sin entrar a `/superadmin`.

Checklist técnico:

- [ ] `npm run lint` pasa.
- [ ] `npm run build:dev` pasa.
