# FASE 4.3 — Gestión de conjuntos / tenants read-only

## Alcance implementado

- Agrega la pestaña **Tenants** dentro del shell `/superadmin`, manteniendo el cambio reversible hacia **Resumen plataforma** sin alterar el layout base de FASE 4.2.
- Muestra un listado read-only de conjuntos con campos seguros: nombre, ciudad, dirección si existe y fecha de creación.
- Muestra métricas agregadas por tenant: usuarios, residentes, visitas 30d, paquetes pendientes y pagos pendientes.
- Consume una RPC `SECURITY DEFINER` read-only (`fn_platform_tenants_summary()`) autorizada solo para `superadmin` de plataforma o `platform_ops` activo.
- No agrega CRUD, no modifica RLS policies, no usa `service_role` en frontend y no expone PII detallada, documentos, placas, comprobantes ni teléfonos.

## Precheck DEV de referencia

- conjuntos total: 2
- conjuntos con nombre: 2
- conjuntos con ciudad: 2

## Checklist manual esperado

- [ ] Superadmin ve la pestaña **Tenants** en `/superadmin`.
- [ ] El listado muestra 2 conjuntos en DEV.
- [ ] El cambio entre **Resumen plataforma** y **Tenants** funciona sin romper el layout.
- [ ] Usuario sin `platform_membership` activa sigue sin entrar a `/superadmin`.
- [ ] No se muestran documentos, placas, comprobantes, teléfonos ni datos personales detallados.
- [ ] `npm run lint` pasa.
- [ ] `npm run build:dev` pasa.
