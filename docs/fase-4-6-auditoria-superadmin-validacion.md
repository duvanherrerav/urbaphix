# FASE 4.6 — Auditoría Superadmin read-only

## Alcance validado

- La sección **Auditoría** queda habilitada dentro del shell Superadmin existente.
- La vista es read-only y navega junto a Resumen, Tenants, Usuarios/Memberships y Operación.
- La fuente de datos es la RPC `fn_platform_audit_summary()`, autorizada únicamente para sesiones autenticadas con rol plataforma `superadmin` o `platform_ops`.
- La RPC devuelve solo agregados por fuente/dimensión/valor y contadores `total`/`total_30d`.
- No se retornan eventos individuales, `metadata`, mensajes, errores, títulos, detalles, usuarios, documentos, placas, teléfonos, comprobantes ni URLs.

## Fuentes agregadas

- `operational_events`: severidad, fuente y tipo.
- `pagos_eventos`: evento y estado nuevo.
- `reservas_eventos`: acción.
- `notificaciones`: tipo y estado de lectura.
- `incidentes`: estado, tipo y nivel.

## Validaciones esperadas en DEV

- `operational_events` con 0 registros no rompe la vista.
- `pagos_eventos` con 0 registros no rompe la vista.
- `reservas_eventos` con 0 registros no rompe la vista.
- `notificaciones` con 0 registros no rompe la vista.
- `incidentes` con 1 registro en los últimos 30 días aparece como señal agregada, sin descripción ni datos sensibles.
- Un usuario sin `platform_membership` activa sigue bloqueado por `SuperadminGuard` y por la autorización de la RPC.
- `npm run lint` pasa.
- `npm run build:dev` pasa.
