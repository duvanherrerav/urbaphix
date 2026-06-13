# FASE 3D.10 — Seed controlado DEV para dataset negativo RLS

## 1. Resumen ejecutivo

FASE 3D.10 prepara un seed controlado, auditable y reversible para crear datos mínimos de prueba en **Supabase DEV** que permitan ejecutar posteriormente validaciones negativas/cross-tenant de RLS. La fase no ejecuta SQL desde Codex y no modifica migraciones, RLS, helpers SQL, policies, frontend, variables de entorno, Vercel, QA ni PRD.

La entrega consiste en:

- Diagnóstico pre-seed read-only: `supabase/validation/fase_3d10_diagnostico_pre_seed_negativo_dev.sql`.
- Template DML DEV-only para seed: `supabase/validation/fase_3d10_seed_negativo_dev_template.sql`.
- Post-check read-only: `supabase/validation/fase_3d10_postcheck_seed_negativo_dev.sql`.
- Template DML DEV-only para rollback seguro: `supabase/validation/fase_3d10_rollback_seed_negativo_dev_template.sql`.

## 2. Contexto de NO-GO por falta de dataset DEV

FASE 3D.9 identificó que `urbaphix-dev` no tiene datos suficientes para probar aislamiento negativo real:

- Solo existe un conjunto DEV principal.
- Solo existe un residente DEV principal.
- Solo existen usuarios app del mismo conjunto.
- Las tablas operativas requeridas para pruebas negativas/cross-tenant no tienen registros suficientes: `pagos`, `paquetes`, `registro_visitas`, `incidentes`, `reservas_zonas` y `config_pagos`.

Por tanto, la ejecución de pruebas negativas RLS permanece en **NO-GO** hasta preparar un dataset DEV controlado y reversible.

## 3. Ambiente autorizado

Único ambiente autorizado:

- Supabase DEV.
- Project ref DEV conocido: `polstaxmencetxgctvsw`.
- Conjunto DEV principal: `a80af441-80f9-4a6c-8d3b-b8408c97dbe2`.
- Residente DEV principal: `546c423c-1fa0-4750-b01c-0c24ad89b801`.
- Usuario residente DEV principal: `b46ab33c-9237-4f43-a010-ff95ca1263a6`.

No se autoriza ejecución en QA ni PRD.

## 4. Alcance y restricciones

### Alcance

Crear documentación y SQL templates controlados en `docs/` y `supabase/validation/` para preparar datos negativos en DEV.

### Restricciones obligatorias

- No tocar QA.
- No tocar PRD.
- No ejecutar SQL contra QA ni PRD.
- No ejecutar SQL desde Codex.
- No crear migraciones.
- No modificar `supabase/migrations/`.
- No modificar RLS, helpers SQL ni policies.
- No modificar frontend funcional ni `src/`.
- No modificar `.env`, `.env.*` ni variables de entorno.
- No tocar Vercel.
- No crear usuarios Auth reales desde Codex.
- No usar datos reales de residentes.
- No exponer passwords, JWT, access tokens, refresh tokens, cookies ni llaves.

## 5. Modelo de datos requerido para pruebas negativas

El modelo vigente requiere respetar las relaciones documentadas y observadas en migraciones:

- `conjuntos` es el tenant principal.
- `torres` y `apartamentos` pertenecen a un `conjunto_id`.
- `usuarios_app.id` referencia `auth.users.id`; por eso el template **no crea Auth users** y exige que los UUID de prueba existan previamente si se van a usar `usuarios_app` adicionales.
- `residentes` referencia `usuarios_app`, `conjuntos` y `apartamentos`.
- `pagos` y `paquetes` referencian `residentes`; `paquetes` también puede referenciar `apartamentos` y `usuarios_app` en `recibido_por`.
- `visitantes` referencia `residentes`, `conjuntos` y `tipos_documento`; `registro_visitas` referencia `visitantes`, `conjuntos`, `apartamentos` y opcionalmente `usuarios_app` en `validado_por`.
- `incidentes` referencia `conjuntos` y opcionalmente `usuarios_app` en `reportado_por`.
- `reservas_zonas` referencia `conjuntos`, `recursos_comunes`, `residentes`, `apartamentos` y usuarios operativos opcionales.
- `config_pagos` referencia `conjuntos`.

## 6. Dataset mínimo propuesto

Todos los datos nuevos o reutilizados deben estar identificados con prefijo `DEV-RLS-NEGATIVE` o UUID reservado.

### A. Mismo conjunto, distinto residente

- Un usuario app de prueba para residente ajeno del mismo conjunto.
- Un segundo residente en el conjunto principal DEV.
- Torre/apartamento de prueba en el conjunto principal.
- Datos operativos asociados al residente ajeno:
  - Un `pagos`.
  - Un `paquetes`.
  - Un `visitantes` + un `registro_visitas` si existe un `tipos_documento` disponible.
  - Una `reservas_zonas` asociada a recurso común de prueba.

### B. Cross-tenant

- Segundo conjunto DEV ajeno: `DEV-RLS-NEGATIVE-TENANT`.
- Torre/apartamento de prueba del segundo conjunto.
- Usuario app/residente ajeno del segundo conjunto.
- Datos operativos del segundo conjunto:
  - Un `pagos`.
  - Un `paquetes`.
  - Un `incidentes`.
  - Una `reservas_zonas`.
  - Una `config_pagos`.

## 7. Consideración sobre Auth users

`usuarios_app.id` tiene FK hacia `auth.users.id`. Por seguridad, Codex no crea usuarios Auth reales. Antes de ejecutar el seed, una persona autorizada debe crear manualmente en **Supabase Dashboard DEV** los Auth users de prueba si no existen, sin compartir credenciales ni secretos:

- Same-tenant negative user: `11111111-3d10-4000-8000-000000000001`, email sugerido `dev-rls-negative-same-tenant@example.invalid`.
- Cross-tenant negative user: `11111111-3d10-4000-8000-000000000002`, email sugerido `dev-rls-negative-cross-tenant@example.invalid`.

Si Supabase Dashboard no permite fijar esos UUID manualmente, la persona autorizada debe reemplazar en el template los UUID reservados por los UUID reales creados en DEV antes de ejecutar el seed. No se deben compartir passwords, tokens ni sesiones.

## 8. Procedimiento operativo

1. **Diagnóstico pre-seed**
   - Ejecutar en Supabase SQL Editor del proyecto DEV `polstaxmencetxgctvsw`:
     - `supabase/validation/fase_3d10_diagnostico_pre_seed_negativo_dev.sql`.
   - Confirmar que existe el conjunto principal DEV y que no existen duplicados conflictivos con prefijo `DEV-RLS-NEGATIVE`.

2. **Revisión humana**
   - Verificar que el editor conectado es DEV, no QA ni PRD.
   - Confirmar que los Auth users de prueba existen en DEV o ajustar UUIDs reservados del template.
   - Revisar que todos los INSERT/UPDATE/DELETE del seed están marcados como DEV-only.

3. **Ejecución del seed DEV**
   - Ejecutar manualmente `supabase/validation/fase_3d10_seed_negativo_dev_template.sql` solo en DEV.
   - No ejecutar desde Codex.

4. **Post-check**
   - Ejecutar `supabase/validation/fase_3d10_postcheck_seed_negativo_dev.sql`.
   - Guardar resultados como evidencia.

5. **Reejecución de FASE 3D.9**
   - Ejecutar nuevamente `supabase/validation/fase_3d9_identificar_datos_negativos_dev.sql`.
   - Verificar que cambia a disponibilidad positiva para residentes múltiples, residentes ajenos, pagos ajenos, paquetes ajenos, incidentes/cross-tenant y segundo conjunto.

6. **Decisión GO/NO-GO para pruebas negativas**
   - Avanzar a FASE 3D.11 solo si los criterios GO se cumplen.

## 9. Rollback seguro

El rollback está en `supabase/validation/fase_3d10_rollback_seed_negativo_dev_template.sql` y debe ejecutarse manualmente solo en DEV. El rollback:

- Borra únicamente datos con UUIDs reservados o prefijo `DEV-RLS-NEGATIVE`.
- Respeta orden de FK.
- No borra el conjunto principal DEV.
- No borra el residente principal 3D.7A.
- No borra admin/vigilancia/residente principal.
- No borra Auth users; si se crearon usuarios Auth manuales, su eliminación queda como tarea manual en Supabase Dashboard DEV.
- No borra datos reales ni datos sin prefijo.

## 10. Evidencia requerida

Guardar como evidencia:

- Resultado del diagnóstico pre-seed.
- Confirmación humana del proyecto DEV `polstaxmencetxgctvsw` antes de ejecutar DML.
- Resultado completo del seed, incluyendo IDs creados/reutilizados.
- Resultado del post-check.
- Resultado reejecutado de `fase_3d9_identificar_datos_negativos_dev.sql`.
- Si se hace rollback, resultado del rollback y post-check posterior.

## 11. Riesgos

- Ejecutar en QA/PRD por error: mitigado con advertencias DEV-only y validación por conjunto principal DEV esperado.
- FK de `usuarios_app` hacia `auth.users`: mitigado exigiendo Auth users manuales de prueba en DEV antes del seed.
- Datos sin prefijo: mitigado por constantes reservadas y post-check de identificación.
- Duplicados: mitigado por UUIDs determinísticos y reutilización mediante `ON CONFLICT (id)`.
- Drift de schema: si una columna/FK cambia, detener ejecución y actualizar documentación antes de modificar templates.

## 12. Criterios GO/NO-GO

### GO

Se considera GO si:

- El seed crea o reutiliza dataset negativo suficiente.
- FASE 3D.9 cambia a disponibilidad positiva para al menos:
  - residentes múltiples;
  - residentes ajenos;
  - pagos ajenos;
  - paquetes ajenos;
  - incidentes ajenos o cross-tenant;
  - segundo conjunto para cross-tenant.
- Todo queda en DEV.
- Todo queda marcado con `DEV-RLS-NEGATIVE` o UUID reservado.
- No se toca QA ni PRD.
- No se modifican migraciones, RLS, helpers, policies, frontend, `.env` ni Vercel.

### NO-GO

No avanzar si:

- No se puede crear dataset sin tocar QA/PRD.
- Se requieren datos reales.
- Se requieren cambios RLS/policies/helpers.
- Se detectan FK no cubiertas que impiden crear dataset mínimo.
- El rollback no puede garantizar limpieza segura.
- Se crean datos sin prefijo o con riesgo de confundirse con datos reales.

## 13. Recomendación para FASE 3D.11

FASE 3D.11 debe ejecutar pruebas negativas/cross-tenant reales usando usuarios autenticados del conjunto principal DEV y verificando que consultas a registros ajenos del mismo conjunto o de otro conjunto retornan `200 OK` con array vacío o `403`, según la policy aplicable. La fase debe usar como prerequisito obligatorio evidencia GO de FASE 3D.10 y la reejecución positiva de FASE 3D.9.
