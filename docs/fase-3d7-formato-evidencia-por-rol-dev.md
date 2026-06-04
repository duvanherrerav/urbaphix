# FASE 3D.7 - Formato de evidencia por rol DEV

Usar este formato para cada sesión de validación efectiva autenticada RLS en DEV. No pegar tokens, cookies, refresh tokens, access tokens, llaves, correos completos, documentos, teléfonos ni URLs privadas firmadas.

## 1. Metadatos de sesión

| Campo | Valor |
| --- | --- |
| Fecha de validación | `<YYYY-MM-DD>` |
| Operador humano | `<nombre o iniciales>` |
| Ambiente | `DEV` |
| Frontend DEV URL | `<url-dev-saneada>` |
| Supabase project ref DEV | `<project-ref-dev>` |
| Rol evaluado | `<admin_conjunto/vigilancia/vigilante/residente/sin_membership/membership_inactiva>` |
| Navegador o cliente API | `<browser/version o cliente>` |
| Método principal | `<Frontend DevTools Network/API con JWT real>` |
| Evidencia adjunta | `<capturas/HAR saneado/resumen>` |

## 2. Identidad autenticada saneada

| Campo | Valor |
| --- | --- |
| Auth user id | `<uuid o hash parcial permitido>` |
| Correo de prueba | `<correo enmascarado, ej. res***@dev.local>` |
| Rol esperado | `<rol>` |
| Rol observado en app | `<rol>` |
| `conjunto_id` esperado | `<uuid>` |
| `residente_id` esperado | `<uuid/no aplica>` |
| Fuente de membresía observada | `<tenant_memberships/usuarios_app fallback/híbrida/desconocida>` |
| Membership activa esperada | `<sí/no/no aplica>` |
| Observaciones de identidad | `<notas>` |

## 3. Checklist previo de seguridad

| Check | Resultado | Evidencia/nota |
| --- | --- | --- |
| Se confirmó ambiente DEV antes de iniciar | `<OK/Falla>` | `<nota>` |
| No hay pestañas o clientes apuntando a QA/PRD | `<OK/Falla>` | `<nota>` |
| DevTools Network abierto antes de navegar | `<OK/Falla/No aplica>` | `<nota>` |
| Evidencia saneada antes de compartir | `<OK/Falla>` | `<nota>` |
| No se publican tokens/cookies/llaves | `<OK/Falla>` | `<nota>` |
| SQL Editor no se usa como evidencia final | `<OK/Falla>` | `<nota>` |

## 4. Preparación de usuario residente DEV

Completar solo si el rol evaluado es `residente` o si se está cerrando la brecha de usuario residente.

| Requisito | Estado | IDs saneados / notas |
| --- | --- | --- |
| Usuario Auth DEV puede iniciar sesión | `<OK/Pendiente/No autorizado>` | `<nota>` |
| Registro `usuarios_app` coherente si aplica | `<OK/Pendiente/No aplica>` | `<id/conjunto/rol saneado>` |
| Registro `residentes` vinculado a `usuario_id` | `<OK/Pendiente/No aplica>` | `<residente_id/conjunto_id>` |
| `tenant_memberships.role_name = 'residente'` | `<OK/Pendiente/No aplica>` | `<membership_id>` |
| `tenant_memberships.status = 'active'` | `<OK/Pendiente/No aplica>` | `<nota>` |
| `tenant_memberships.conjunto_id` correcto | `<OK/Pendiente/No aplica>` | `<conjunto_id>` |
| `tenant_memberships.residente_id` poblado | `<OK/Pendiente/No aplica>` | `<residente_id>` |
| Sin membership activa incompatible | `<OK/Pendiente/No aplica>` | `<nota>` |

Si algún requisito queda pendiente por falta de autorización humana, clasificar como P2 si no bloquea otros roles o No-Go si bloquea la decisión completa de residente.

## 5. Módulos validados

### 5.1 `admin_conjunto` DEV

| Módulo | Navegado | Resultado | Notas |
| --- | --- | --- | --- |
| Dashboard Admin | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Pagos / Crear cobro | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Incidentes | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Reservas Admin | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Paquetería admin | `<sí/no/no aplica>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Usuarios/residentes del conjunto | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Config pagos | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Datos de otro conjunto ausentes | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |

### 5.2 `vigilancia`/`vigilante` DEV

| Módulo | Navegado | Resultado | Notas |
| --- | --- | --- | --- |
| Control de visitas | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Registro visitas | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Paquetes | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Incidentes | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Datos de otro conjunto ausentes | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Módulos admin no autorizados bloqueados | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |

### 5.3 `residente` DEV

| Módulo | Navegado | Resultado | Notas |
| --- | --- | --- | --- |
| Mis pagos | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Mis paquetes | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Solicitar visita | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Reservas residente | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Notificaciones propias | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Solo ve su `conjunto_id` esperado | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| Solo ve su `residente_id` esperado | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |
| No ve pagos/paquetes/reservas de otros residentes | `<sí/no>` | `<OK/P0/P1/P2/P3>` | `<nota>` |

## 6. Requests/responses saneadas

| # | Rol | Módulo | Método | Endpoint/tabla | Filtros visibles | Status | Filas/resumen saneado | Tenant OK | Residente OK | Hallazgo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `<rol>` | `<módulo>` | `<GET/POST/PATCH/etc.>` | `<endpoint>` | `<conjunto_id/residente_id/user_id/rango>` | `<status>` | `<conteo/resumen sin PII>` | `<OK/Sospechoso/Fuga>` | `<OK/No aplica/Sospechoso/Fuga>` | `<OK/P0/P1/P2/P3>` |
| 2 | `<rol>` | `<módulo>` | `<GET/POST/PATCH/etc.>` | `<endpoint>` | `<filtros>` | `<status>` | `<resumen>` | `<resultado>` | `<resultado>` | `<resultado>` |

Notas de saneamiento:

- Remover encabezados `Authorization`, `Cookie` y `apikey` antes de adjuntar evidencia.
- Remover access tokens, refresh tokens, JWT, session storage y local storage.
- Enmascarar correos, teléfonos, documentos y nombres reales.
- No adjuntar URLs firmadas privadas ni comprobantes reales.

## 7. Validaciones negativas

| Caso | Resultado esperado | Resultado observado | Severidad |
| --- | --- | --- | --- |
| Usuario no ve datos de otro conjunto | 0 filas cross-tenant | `<observado>` | `<OK/P0/P1/P2/P3>` |
| Residente no ve datos de otro residente | 0 filas de terceros | `<observado>` | `<OK/P0/P1/P2/P3>` |
| Usuario sin membership activa no accede a datos protegidos | Denegado o 0 filas | `<observado>` | `<OK/P0/P1/P2/P3/no ejecutado>` |
| Membership inactiva no concede acceso | Denegado o 0 filas | `<observado>` | `<OK/P0/P1/P2/P3/no ejecutado>` |
| Vigilancia no accede a admin sensible | Bloqueado | `<observado>` | `<OK/P0/P1/P2/P3>` |
| Residente no accede a admin/vigilancia sensible | Bloqueado | `<observado>` | `<OK/P0/P1/P2/P3>` |

## 8. Hallazgos

| ID | Severidad | Rol | Módulo | Descripción | Evidencia saneada | Responsable | Plan/acción | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F3D7-001 | `<P0/P1/P2/P3>` | `<rol>` | `<módulo>` | `<descripción>` | `<referencia>` | `<responsable>` | `<plan>` | `<abierto/cerrado>` |

Guía de clasificación:

- P0: fuga cross-tenant, fuga entre residentes, usuario sin membership activa con acceso, rol no autorizado con funciones sensibles o respuesta API cross-tenant.
- P1: policy amplia con exposición mayor a la esperada sin fuga confirmada, dependencia crítica de fallback legacy, helper legacy condicionando módulo crítico o campos sensibles innecesarios.
- P2: falta de datos de prueba, endpoint con 0 filas no concluyente, evidencia incompleta o diferencia documental.
- P3: captura pendiente, nombres poco claros o mejora menor del checklist.

## 9. Decisión por rol

| Rol | Decisión | Justificación | P0 abiertos | P1 con plan | P2/P3 pendientes |
| --- | --- | --- | --- | --- | --- |
| `admin_conjunto` | `<Go/Go condicionado/No-Go>` | `<resumen>` | `<n>` | `<n/lista>` | `<lista>` |
| `vigilancia`/`vigilante` | `<Go/Go condicionado/No-Go>` | `<resumen>` | `<n>` | `<n/lista>` | `<lista>` |
| `residente` | `<Go/Go condicionado/No-Go>` | `<resumen>` | `<n>` | `<n/lista>` | `<lista>` |

## 10. Decisión global FASE 3D.7

| Criterio | Resultado | Nota |
| --- | --- | --- |
| Usuarios de prueba suficientes o brecha documentada | `<OK/Falla>` | `<nota>` |
| Admin validado en DEV | `<OK/Falla>` | `<nota>` |
| Vigilancia validado en DEV | `<OK/Falla>` | `<nota>` |
| Residente validado en DEV o brecha autorizada | `<OK/Falla>` | `<nota>` |
| Sin P0 abierto | `<OK/Falla>` | `<nota>` |
| P1 con plan documentado | `<OK/Falla/no aplica>` | `<nota>` |
| No se expusieron tokens/cookies/llaves | `<OK/Falla>` | `<nota>` |
| SQL Editor no fue evidencia final de `auth.uid()` | `<OK/Falla>` | `<nota>` |
| QA/PRD no fueron tocados | `<OK/Falla>` | `<nota>` |
| Sin cambios de migraciones/RLS/frontend/.env/Vercel | `<OK/Falla>` | `<nota>` |

Decisión global: `<Go/Go condicionado/No-Go>`

Siguiente paso recomendado: `<hardening RLS controlado / preparar usuario residente / completar evidencia / atender P0>`
