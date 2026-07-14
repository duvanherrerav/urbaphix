# FASE 5.4.2B — Validación funcional lifecycle visitas en DEV

## Objetivo

Documentar la evidencia funcional ejecutada en DEV para confirmar que el flujo de ingreso y salida de visitas respeta el lifecycle operativo del tenant después de FASE 5.4.2A, sin introducir cambios de runtime.

## Ambiente y alcance

- **Fecha de documentación:** 2026-07-14.
- **Ambiente validado:** Supabase DEV / branch `develop`.
- **Deployment Vercel:** commit `bf5024d4531066cb36dffc99b089ae2e0cc143e7` en estado `READY`.
- **Tipo de validación:** funcional manual con contraste en Supabase DEV.
- **Alcance de este PR:** documentación de evidencia únicamente.
- **Fuera de alcance:** migraciones, SQL/RLS/RPC, frontend, configuración Vercel, paquetes u otros módulos runtime.

## Actores y datos de prueba

| Elemento | Valor documentado |
| --- | --- |
| Tenant | `Conjunto Desarrollo Urbaphix` |
| `conjunto_id` | `a80af441-80f9-4a6c-8d3b-b8408c97dbe2` |
| Usuario operativo | `dev.vigilancia@urbaphix.com` |
| Rol operativo | Vigilante activo |
| Estado inicial del tenant | `active`, `operational_lock=false` |
| Estado final del tenant | `active`, `operational_lock=false` |
| Razón de suspensión | `prueba` |
| Razón de reactivación | `Prueba` |

No se incluyen credenciales ni PII adicional. Las capturas referenciadas corresponden a la evidencia aportada en el issue/conversación de cierre de FASE 5.4.2B.

## Escenario funcional ejecutado

| # | Paso | Resultado esperado | Resultado real | Estado |
| --- | --- | --- | --- | --- |
| 1 | Confirmar tenant en estado operativo inicial. | Tenant `active` con `operational_lock=false`. | Confirmado en Supabase DEV. | PASS |
| 2 | Iniciar sesión como usuario vigilante activo. | Sesión válida para el tenant de prueba, sin exponer credenciales. | Sesión operativa con `dev.vigilancia@urbaphix.com`. | PASS |
| 3 | Registrar ingreso de visita pendiente del mismo tenant. | La visita cambia de `pendiente` a `ingresado`, con `hora_ingreso` y actor de vigilancia. | Visita `11111111-3d10-4000-8000-000000000018` ingresó correctamente con tenant activo. | PASS |
| 4 | Suspender tenant desde Superadmin. | Lifecycle cambia de `active` a `suspended` y queda auditado. | Transición auditada `active -> suspended`, actor `superadmin`, source `rpc`, razón `prueba`. | PASS |
| 5 | Intentar ingreso de otra visita pendiente durante suspensión. | El ingreso se bloquea de forma controlada y la visita no se muta. | La UI mostró `No fue posible registrar el ingreso. Intenta nuevamente.` y la visita `8dd4d489-7a35-4bfd-a632-ee99894c073b` permaneció pendiente. | PASS |
| 6 | Registrar salida de la visita ingresada antes de la suspensión. | La salida terminal se permite aun con tenant suspendido. | Visita `11111111-3d10-4000-8000-000000000018` quedó `salido`, con `hora_salida` no nula y actor `dev.vigilancia@urbaphix.com`. | PASS |
| 7 | Reactivar tenant desde Superadmin. | Lifecycle cambia de `suspended` a `active`, con `operational_lock=false`, y queda auditado. | Transición auditada `suspended -> active`, actor `superadmin`, source `rpc`, razón `Prueba`. | PASS |
| 8 | Registrar nuevo ingreso después de reactivar. | El ingreso vuelve a permitirse para una visita pendiente del tenant. | Visita `8dd4d489-7a35-4bfd-a632-ee99894c073b` quedó `ingresado`, con actor `dev.vigilancia@urbaphix.com`. | PASS |
| 9 | Confirmar integridad final del tenant. | Tenant finaliza `active`, `operational_lock=false`. | Confirmado para `a80af441-80f9-4a6c-8d3b-b8408c97dbe2`. | PASS |

## Matriz de validación documentada

| Caso | Resultado |
| --- | --- |
| `active + ingreso nuevo` | PASS |
| `suspended + ingreso nuevo` | PASS; bloqueado sin mutación parcial |
| `suspended + salida de visita previamente ingresada` | PASS |
| `suspended -> active` | PASS |
| `active + nuevo ingreso después de reactivar` | PASS |
| Auditoría lifecycle y actor de vigilancia | PASS |

## Evidencia Supabase documentada

### Visita previa ingresada antes de suspensión

- **Registro:** `11111111-3d10-4000-8000-000000000018`.
- **Flujo observado:** ingreso permitido con tenant activo; salida permitida durante suspensión.
- **Estado final:** `salido`.
- **Campos críticos:** `hora_ingreso` no nula, `hora_salida` no nula, actor `dev.vigilancia@urbaphix.com`.

### Segunda visita pendiente durante suspensión

- **Registro:** `8dd4d489-7a35-4bfd-a632-ee99894c073b`.
- **Flujo observado:** ingreso bloqueado durante suspensión y sin mutación parcial; ingreso permitido después de reactivar.
- **Estado final:** `ingresado`.
- **Campos críticos:** actor `dev.vigilancia@urbaphix.com` después de la reactivación.

### Lifecycle del tenant

- **Tenant:** `a80af441-80f9-4a6c-8d3b-b8408c97dbe2`.
- **Estado inicial:** `active`, `operational_lock=false`.
- **Suspensión auditada:** `active -> suspended`, actor `superadmin`, source `rpc`, razón `prueba`.
- **Reactivación auditada:** `suspended -> active`, actor `superadmin`, source `rpc`, razón `Prueba`.
- **Estado final:** `active`, `operational_lock=false`.

## Queries de verificación usadas

Las siguientes consultas representan las verificaciones ejecutadas/contrastadas en Supabase DEV. Se documentan sin credenciales y sin datos sensibles adicionales.

```sql
-- Estado lifecycle inicial/final del tenant de prueba
select id, nombre, lifecycle_status, operational_lock
from public.conjuntos
where id = 'a80af441-80f9-4a6c-8d3b-b8408c97dbe2';
```

```sql
-- Integridad de las visitas usadas en el escenario funcional
select id, conjunto_id, estado, hora_ingreso, hora_salida, validado_por
from public.registro_visitas
where id in (
  '11111111-3d10-4000-8000-000000000018',
  '8dd4d489-7a35-4bfd-a632-ee99894c073b'
)
order by id;
```

```sql
-- Auditoría lifecycle del tenant de prueba
select conjunto_id, previous_status, new_status, actor_role, source, reason, created_at
from public.tenant_lifecycle_events
where conjunto_id = 'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'
  and previous_status in ('active', 'suspended')
  and new_status in ('suspended', 'active')
order by created_at desc;
```

```sql
-- Contraste del actor operativo registrado en las visitas
select rv.id, rv.estado, rv.validado_por, ua.email
from public.registro_visitas rv
left join public.usuarios_app ua on ua.id = rv.validado_por
where rv.id in (
  '11111111-3d10-4000-8000-000000000018',
  '8dd4d489-7a35-4bfd-a632-ee99894c073b'
)
order by rv.id;
```

## Capturas referenciadas

Las capturas aportadas en el issue/conversación evidencian:

1. Tenant operativo antes de la prueba.
2. Ingreso permitido con tenant `active`.
3. Suspensión desde Superadmin.
4. Error controlado de UI durante suspensión: `No fue posible registrar el ingreso. Intenta nuevamente.`
5. Salida permitida para visita previamente ingresada.
6. Reactivación desde Superadmin.
7. Nuevo ingreso permitido después de reactivar.
8. Confirmación en Supabase DEV del estado final de visitas y lifecycle del tenant.

No se incorporan imágenes al repositorio en este PR documental.

## Aclaraciones obligatorias

- No se afirma prueba visual de usuario cross-tenant en esta sesión.
- No se afirma prueba visual de suplantación mediante `p_vigilante_id` distinto de `auth.uid()` en esta sesión.
- No se afirma prueba visual del retry idempotente de salida en esta sesión.
- Las protecciones anteriores fueron verificadas técnicamente en FASE 5.4.2A a nivel SQL/RPC y quedan fuera de la evidencia visual principal de FASE 5.4.2B.
- No se detectó un defecto de runtime que requiera cambios de código.
- El mensaje de error observado no expuso PII ni estado lifecycle interno.

## Integridad final de datos

- El tenant `Conjunto Desarrollo Urbaphix` finalizó `active` y `operational_lock=false`.
- La visita `11111111-3d10-4000-8000-000000000018` finalizó `salido`, con `hora_ingreso` y `hora_salida` no nulas.
- La visita `8dd4d489-7a35-4bfd-a632-ee99894c073b` permaneció sin mutación parcial durante suspensión y luego finalizó `ingresado` después de reactivar.
- Las transiciones lifecycle relevantes quedaron auditadas con actor `superadmin` y source `rpc`.
- Las mutaciones operativas de visitas quedaron asociadas al usuario vigilante `dev.vigilancia@urbaphix.com`.

## Dictamen

**PASS** para el escenario funcional principal de FASE 5.4.2B.

La evidencia confirma que el lifecycle operativo del tenant bloquea nuevos ingresos durante suspensión, permite cerrar salidas terminales de visitas previamente ingresadas y restablece el ingreso después de reactivar, sin cambios de runtime y sin hallazgos que requieran issue derivado.

## Issues derivados

No se abren issues derivados a partir de esta validación documental. Si se exige evidencia visual completa para cross-tenant, suplantación o retry idempotente de salida, deberá planificarse una sesión manual adicional sin modificar runtime.
