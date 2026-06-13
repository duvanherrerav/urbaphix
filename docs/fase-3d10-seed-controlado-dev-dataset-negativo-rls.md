# FASE 3D.10A — Ajuste seed DEV para UUID reales de Auth y tipo_documento

## 1. Resumen ejecutivo

FASE 3D.10A ajusta incrementalmente FASE 3D.10 para que el seed controlado de dataset negativo RLS en **Supabase DEV** sea ejecutable con los UUID reales generados por Supabase Auth desde Dashboard. El ajuste elimina la dependencia operativa en UUIDs fijos para `auth.users`, mantiene templates DEV-only, y resuelve el prerrequisito `tipos_documento_disponibles = false` con un catálogo mínimo DEV-only reversible.

La fase no ejecuta SQL desde Codex y no modifica migraciones, RLS, helpers SQL, policies, frontend, variables de entorno, Vercel, QA ni PRD.

La entrega actualizada consiste en:

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

Después del merge de FASE 3D.10, el diagnóstico DEV también mostró que los Auth users negativos no existían con los UUID fijos del template y que `tipos_documento_disponibles = false`. Por tanto, 3D.10A convierte el flujo a UUIDs reales por email y crea/reutiliza un `tipo_documento` DEV-only mínimo.

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

Actualizar documentación y SQL templates controlados existentes en `docs/` y `supabase/validation/` para preparar datos negativos en DEV.

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
- `usuarios_app.id` referencia `auth.users.id`; por eso el template **no crea Auth users** y exige copiar los UUID reales creados manualmente en Dashboard DEV.
- `residentes.usuario_id` debe apuntar al mismo UUID real de Auth usado en `usuarios_app.id`.
- `tenant_memberships.user_id` referencia `auth.users.id` y debe usar los mismos UUID reales para las membresías negativas.
- `residentes` referencia `usuarios_app`, `conjuntos` y `apartamentos`.
- `pagos` y `paquetes` referencian `residentes`; `paquetes` también puede referenciar `apartamentos` y `usuarios_app` en `recibido_por`.
- `visitantes` referencia `residentes`, `conjuntos` y `tipos_documento`; `registro_visitas` referencia `visitantes`, `conjuntos`, `apartamentos` y opcionalmente `usuarios_app` en `validado_por`.
- `incidentes` referencia `conjuntos` y opcionalmente `usuarios_app` en `reportado_por`.
- `reservas_zonas` referencia `conjuntos`, `recursos_comunes`, `residentes`, `apartamentos` y usuarios operativos opcionales.
- `config_pagos` referencia `conjuntos`.

## 6. Dataset mínimo propuesto

Todos los datos nuevos o reutilizados deben estar identificados con prefijo `DEV-RLS-NEGATIVE`, UUID real de los usuarios negativos o UUID determinístico reservado para FASE 3D.10A.

### A. Mismo conjunto, distinto residente

- Un Auth user manual DEV con email `dev-rls-negative-same@urbaphix.com`.
- Un `usuarios_app` con `id = auth.users.id` real del Auth user same-tenant.
- Un `tenant_memberships` activo con `user_id = auth.users.id` real del Auth user same-tenant.
- Un segundo residente en el conjunto principal DEV.
- Torre/apartamento de prueba en el conjunto principal.
- Datos operativos asociados al residente ajeno:
  - Un `pagos`.
  - Un `paquetes`.
  - Un `visitantes` + un `registro_visitas` usando `DEV-RLS-NEGATIVE-DOC`.
  - Una `reservas_zonas` asociada a recurso común de prueba.

### B. Cross-tenant

- Un Auth user manual DEV con email `dev-rls-negative-cross@urbaphix.com`.
- Segundo conjunto DEV ajeno: `DEV-RLS-NEGATIVE-TENANT`.
- Torre/apartamento de prueba del segundo conjunto.
- Un `usuarios_app` con `id = auth.users.id` real del Auth user cross-tenant.
- Un `tenant_memberships` activo con `user_id = auth.users.id` real del Auth user cross-tenant.
- Usuario app/residente ajeno del segundo conjunto.
- Datos operativos del segundo conjunto:
  - Un `pagos`.
  - Un `paquetes`.
  - Un `visitantes` + un `registro_visitas` cross-tenant asociado al conjunto ajeno usando `DEV-RLS-NEGATIVE-DOC`.
  - Un `incidentes`.
  - Una `reservas_zonas`.
  - Una `config_pagos`.

## 7. Flujo real de Auth users por email + UUID real

`usuarios_app.id` y `tenant_memberships.user_id` dependen de `auth.users.id`. Supabase Dashboard DEV permite crear usuarios Auth con email/password y autoconfirmarlos, pero no se debe asumir que permite fijar manualmente el UUID. Por seguridad, Codex no crea usuarios Auth reales y no se documentan passwords.

Flujo obligatorio antes de ejecutar el seed:

1. Crear manualmente en **Supabase DEV → Authentication → Users**:
   - `dev-rls-negative-same@urbaphix.com`.
   - `dev-rls-negative-cross@urbaphix.com`.
2. Auto-confirmar ambos usuarios.
3. Consultar sus UUID reales con SQL read-only:

   ```sql
   select id, email, email_confirmed_at
   from auth.users
   where email in (
     'dev-rls-negative-same@urbaphix.com',
     'dev-rls-negative-cross@urbaphix.com'
   )
   order by email;
   ```

4. Copiar esos UUID reales en los placeholders editables de texto del template seed antes de ejecutarlo; el template los valida y luego los castea a `uuid`:

   ```sql
   v_usuario_same_tenant_id_text text := '<UUID_REAL_AUTH_SAME_TENANT>';
   v_usuario_cross_tenant_id_text text := '<UUID_REAL_AUTH_CROSS_TENANT>';
   ```

5. Copiar los mismos UUID reales en el rollback si se necesita limpiar el dataset.
6. No asumir UUIDs fijos para usuarios Auth creados desde Dashboard.
7. No compartir passwords, tokens, sesiones, JWT, cookies ni llaves.

El diagnóstico pre-seed actualizado reporta por cada email: `email`, `auth_user_id_real`, `email_confirmed_at`, `email_confirmado` y `estado_prerequisito`.

## 8. Resolución de `tipos_documento_disponibles = false`

FASE 3D.10A usa la opción DEV-only controlada. El template seed crea o reutiliza el tipo de documento mínimo:

- `codigo`: `DEV-RLS-NEGATIVE-DOC`.
- `nombre`: `DEV-RLS-NEGATIVE-DOC`.
- `activo`: `true`.

Esto evita que la creación de `visitantes` y `registro_visitas` quede ambigua cuando no exista catálogo activo. El post-check valida que `DEV-RLS-NEGATIVE-DOC` exista y esté activo. El rollback intenta borrar ese catálogo solo si:

- `codigo = 'DEV-RLS-NEGATIVE-DOC'`;
- `nombre = 'DEV-RLS-NEGATIVE-DOC'`;
- ya no existen `visitantes` referenciándolo.

No se agrega DDL ni migración para este catálogo DEV-only.

## 9. Procedimiento operativo

1. **Crear Auth users DEV manuales**
   - Crear y autoconfirmar `dev-rls-negative-same@urbaphix.com` y `dev-rls-negative-cross@urbaphix.com` en Supabase Dashboard DEV.
   - No compartir passwords ni secretos.

2. **Diagnóstico pre-seed**
   - Ejecutar en Supabase SQL Editor del proyecto DEV `polstaxmencetxgctvsw`:
     - `supabase/validation/fase_3d10_diagnostico_pre_seed_negativo_dev.sql`.
   - Confirmar que los dos Auth users aparecen con `estado_prerequisito = 'GO_COPIAR_UUID_REAL_EN_TEMPLATE_SEED_Y_ROLLBACK'`.
   - Confirmar que existe el conjunto principal DEV y que no existen duplicados conflictivos con prefijo `DEV-RLS-NEGATIVE`.
   - Si no existe tipo documento activo, confirmar que el diagnóstico muestra el GO condicionado al seed DEV-only `DEV-RLS-NEGATIVE-DOC`.

3. **Revisión humana**
   - Verificar que el editor conectado es DEV, no QA ni PRD.
   - Copiar los UUID reales en `v_usuario_same_tenant_id` y `v_usuario_cross_tenant_id` del seed.
   - Revisar que todos los INSERT/UPDATE/DELETE del seed están marcados como DEV-only.

4. **Ejecución del seed DEV**
   - Ejecutar manualmente `supabase/validation/fase_3d10_seed_negativo_dev_template.sql` solo en DEV.
   - No ejecutar desde Codex.
   - El template aborta con `RAISE EXCEPTION` antes de insertar datos si algún UUID real no existe, no corresponde al email esperado o no está confirmado.

5. **Post-check**
   - Ejecutar `supabase/validation/fase_3d10_postcheck_seed_negativo_dev.sql`.
   - Guardar resultados como evidencia.
   - Verificar coherencia Auth → `usuarios_app` → `residentes` → `tenant_memberships`.

6. **Reejecución de FASE 3D.9**
   - Ejecutar nuevamente `supabase/validation/fase_3d9_identificar_datos_negativos_dev.sql`.
   - Verificar que cambia a disponibilidad positiva para residentes múltiples, residentes ajenos, pagos ajenos, paquetes ajenos, visitas ajenas/cross-tenant, incidentes/cross-tenant y segundo conjunto.

7. **Decisión GO/NO-GO para pruebas negativas**
   - Avanzar a FASE 3D.11 solo si los criterios GO se cumplen.

## 10. Rollback seguro

El rollback está en `supabase/validation/fase_3d10_rollback_seed_negativo_dev_template.sql` y debe ejecutarse manualmente solo en DEV. Antes de ejecutarlo, copiar los mismos UUID reales usados en el seed en los placeholders de texto:

```sql
v_usuario_same_tenant_id_text text := '<UUID_REAL_AUTH_SAME_TENANT>';
v_usuario_cross_tenant_id_text text := '<UUID_REAL_AUTH_CROSS_TENANT>';
```

El rollback:

- Borra únicamente datos controlados por UUIDs reales de los usuarios negativos, UUIDs determinísticos de FASE 3D.10A o prefijo `DEV-RLS-NEGATIVE`.
- Respeta orden de FK.
- Borra las `tenant_memberships` negativas con `source_legacy = 'fase_3d10_negative_rls'`.
- Borra `DEV-RLS-NEGATIVE-DOC` solo si ya no está referenciado por visitantes.
- No borra el conjunto principal DEV.
- No borra el residente principal 3D.7A.
- No borra admin/vigilancia/residente principal.
- No borra registros de `auth.users`; si se crearon usuarios Auth manuales, su eliminación queda como tarea manual en Supabase Dashboard DEV.
- No borra datos reales ni datos sin prefijo.

## 11. Evidencia requerida

Guardar como evidencia:

- Resultado del diagnóstico pre-seed con UUIDs reales de Auth por email.
- Confirmación humana del proyecto DEV `polstaxmencetxgctvsw` antes de ejecutar DML.
- Confirmación de que los placeholders fueron reemplazados con UUIDs reales generados por Supabase Auth DEV.
- Resultado completo del seed, incluyendo IDs creados/reutilizados.
- Resultado del post-check, incluyendo coherencia Auth → `usuarios_app` → `residentes` → `tenant_memberships` y evidencia de `registro_visitas` tanto del residente ajeno del mismo conjunto como del conjunto ajeno cross-tenant.
- Resultado reejecutado de `fase_3d9_identificar_datos_negativos_dev.sql`.
- Si se hace rollback, resultado del rollback y post-check posterior.

## 12. Riesgos

- Ejecutar en QA/PRD por error: mitigado con advertencias DEV-only y validación por conjunto principal DEV esperado.
- Copiar UUID Auth incorrecto: mitigado validando email esperado y confirmación antes de cualquier inserción.
- FK de `usuarios_app` hacia `auth.users`: mitigado exigiendo Auth users manuales de prueba en DEV antes del seed.
- `tipos_documento_disponibles = false`: mitigado con catálogo DEV-only `DEV-RLS-NEGATIVE-DOC` y rollback seguro.
- Datos sin prefijo: mitigado por constantes reservadas, prefijo `DEV-RLS-NEGATIVE` y post-check de identificación.
- Duplicados: mitigado por UUIDs determinísticos, UUIDs reales Auth por email y reutilización mediante `ON CONFLICT`.
- Drift de schema: si una columna/FK cambia, detener ejecución y actualizar documentación antes de modificar templates.

## 13. Criterios GO/NO-GO

### GO

Se considera GO si:

- El diagnóstico valida Auth users por email y reporta UUIDs reales.
- El seed usa placeholders editables con UUIDs reales, no UUIDs fijos imposibles de asignar desde Dashboard.
- El seed valida email y confirmación antes de cualquier inserción.
- El post-check valida coherencia Auth → `usuarios_app` → `residentes` → `tenant_memberships`.
- El rollback usa los mismos UUIDs reales y no borra `auth.users`.
- El prerrequisito `tipos_documento_disponibles` queda resuelto con `DEV-RLS-NEGATIVE-DOC` DEV-only.
- FASE 3D.9 cambia a disponibilidad positiva para al menos:
  - residentes múltiples;
  - residentes ajenos;
  - pagos ajenos;
  - paquetes ajenos;
  - visitas ajenas/cross-tenant;
  - incidentes ajenos o cross-tenant;
  - segundo conjunto para cross-tenant.
- Todo queda en DEV.
- Todo queda marcado con `DEV-RLS-NEGATIVE`, UUID real de usuarios negativos o UUID determinístico reservado.
- No se toca QA ni PRD.
- No se modifican migraciones, RLS, helpers, policies, frontend, `.env` ni Vercel.

### NO-GO

No avanzar si:

- El seed depende de UUIDs fijos para Auth users.
- No se puede validar email esperado contra `auth.users`.
- Algún Auth user no está confirmado.
- Se puede insertar datos con UUIDs incorrectos.
- El rollback podría borrar datos reales o datos de otras fases.
- `tipos_documento_disponibles = false` queda sin solución ni bloqueo explícito.
- Se requieren datos reales.
- Se requieren cambios RLS/policies/helpers.
- Se detectan FK no cubiertas que impiden crear dataset mínimo.
- Se crean datos sin prefijo o con riesgo de confundirse con datos reales.

## 14. Recomendación para FASE 3D.11

FASE 3D.11 debe ejecutar pruebas negativas/cross-tenant reales usando usuarios autenticados del conjunto principal DEV y verificando que consultas a registros ajenos del mismo conjunto o de otro conjunto retornan `200 OK` con array vacío o `403`, según la policy aplicable. La fase debe usar como prerequisito obligatorio evidencia GO de FASE 3D.10A y la reejecución positiva de FASE 3D.9.
