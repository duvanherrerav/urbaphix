# FASE 3C.7 — Decisión controlada de rollout PRD del membership resolver

## 1. Decisión técnica recomendada

La recomendación técnica es hacer el rollout productivo del `membership resolver` de forma **gradual, manual, observable y reversible** mediante feature flag, sin convertirlo en dependencia obligatoria de login hasta que exista aprobación humana Go explícita.

El valor que habilita el resolver en Production es:

```env
VITE_ENABLE_MEMBERSHIP_RESOLVER=true
```

Esa activación debe hacerse únicamente después de aprobar el checklist Go de este documento. Este PR solo documenta la decisión operativa: **no activa producción, no modifica variables reales de Vercel Production y no cambia comportamiento funcional de módulos**.

La decisión conserva la arquitectura validada en fases previas:

- `tenant_memberships` se usa como fuente preferida cuando el flag está encendido y hay una membership activa compatible.
- `usuarios_app` sigue siendo fallback legacy obligatorio ante flag apagado, ausencia de membership, incompatibilidad o error controlado de lectura.
- La navegación sigue recibiendo roles legacy compatibles: `admin`, `vigilancia` y `residente`.
- No se requiere SQL para activar o revertir el frontend; el control operativo está en el flag de Vite/Vercel.

## 2. Estado actual seguro antes del rollout

El estado seguro antes de cualquier rollout PRD es mantener el resolver apagado:

```env
VITE_ENABLE_MEMBERSHIP_RESOLVER=false
```

o mantener la variable ausente.

Con ese estado, el frontend debe conservar el flujo legacy basado en `usuarios_app`. La ausencia de variable, valor vacío o cualquier valor distinto de `true`, `1`, `yes` u `on` debe tratarse como resolver apagado.

## 3. Alcance y exclusiones de esta fase

### Alcance permitido

- Definir decisión técnica para rollout PRD.
- Documentar matriz Go / No-Go.
- Documentar checklist previo a activar el flag en Vercel Production.
- Documentar checklist posterior a activar el flag.
- Documentar rollback inmediato por variable de entorno.
- Documentar monitoreo por navegador, Vercel y Supabase.
- Confirmar que `usuarios_app` permanece como fallback.
- Confirmar que no hay cambios estructurales de base de datos.

### Fuera de alcance

- No modificar Supabase.
- No crear migraciones.
- No ejecutar SQL contra PRD desde este PR.
- No cambiar políticas RLS.
- No eliminar fallback legacy.
- No activar automáticamente `VITE_ENABLE_MEMBERSHIP_RESOLVER=true` en producción.
- No modificar `.env.production` real.
- No cambiar variables reales de Vercel Production.
- No tocar dominios productivos.
- No modificar flujos funcionales de módulos.

## 4. Supuestos técnicos verificados desde el repositorio

Antes de redactar esta decisión se revisaron las fuentes internas indicadas por `AGENTS.md`:

- `docs/database-schema.md` documenta `platform_memberships` y `tenant_memberships` como tablas existentes en el modelo, con RLS y restricciones esperadas.
- `supabase/migrations/` contiene las migraciones históricas de helpers, hardening y memberships; esta fase no agrega ni modifica migraciones.
- `src/services/membershipResolver.js` define el flag canónico `VITE_ENABLE_MEMBERSHIP_RESOLVER`, el mapeo de roles de `tenant_memberships` a roles legacy y el fallback seguro.
- `src/App.jsx` decide en bootstrap si usa resolver o flujo legacy y registra eventos controlados `membership_resolver_enabled` / `membership_resolver_disabled` en entornos DEV/QA.

## 5. Matriz Go / No-Go previa a PRD

### Go solo si todo esto es verdadero

- [ ] QA fue validado con `VITE_ENABLE_MEMBERSHIP_RESOLVER=false`.
- [ ] QA fue validado con `VITE_ENABLE_MEMBERSHIP_RESOLVER=true`.
- [ ] En QA se confirmó evento `membership_resolver_disabled` con flag apagado.
- [ ] En QA se confirmó evento `membership_resolution` con flag encendido.
- [ ] En QA se confirmó `active_memberships_count: 1` para los perfiles probados.
- [ ] En QA se confirmó `compatible_memberships_count: 1` para los perfiles probados.
- [ ] En QA se confirmó `matched_legacy_conjunto: true` para los perfiles probados.
- [ ] Roles Admin, Vigilancia y Residente funcionan en QA, si existen usuarios disponibles para cada rol.
- [ ] Producción actual funciona con flag apagado o ausente.
- [ ] `tenant_memberships` existe en PRD con la estructura esperada.
- [ ] `platform_memberships` existe en PRD con la estructura esperada.
- [ ] RLS está habilitado en `tenant_memberships`.
- [ ] RLS está habilitado en `platform_memberships`.
- [ ] Helpers requeridos existen y ejecutan sin error donde aplique: `fn_auth_conjunto_id()`, `fn_auth_rol()`, `fn_auth_residente_id()` y helpers de memberships/plataforma aplicables.
- [ ] Backfill PRD desde `usuarios_app` hacia `tenant_memberships` fue completado y validado.
- [ ] Conteo de usuarios legacy válidos coincide con memberships activas esperadas o toda diferencia tiene explicación documentada.
- [ ] No hay duplicados activos por `(user_id, conjunto_id)` en `tenant_memberships`.
- [ ] No hay residentes activos con `residente_id` nulo cuando el rol/membership requiere residente.
- [ ] Se cuenta con usuario Admin PRD validable.
- [ ] Se cuenta con usuario Vigilancia PRD validable, si existe en producción.
- [ ] Se cuenta con usuario Residente PRD validable, si existe en producción.
- [ ] Hay responsable humano asignado para activar, validar y revertir si hace falta.
- [ ] Hay ventana de bajo tráfico o ventana operativa aceptada.
- [ ] Hay canal de comunicación abierto para reportar hallazgos de usuarios finales durante la ventana.

### No-Go inmediato si ocurre cualquiera de estos casos

- [ ] Existen diferencias entre `usuarios_app` y `tenant_memberships` que no tienen explicación documentada.
- [ ] Existen múltiples memberships activas incompatibles para usuarios reales.
- [ ] Hay errores recurrentes de `membership_resolution` en QA o en prevalidación productiva.
- [ ] Login se bloquea o entra en estado inconsistente.
- [ ] Menú o navegación se asigna incorrectamente por rol.
- [ ] Módulos críticos devuelven consultas vacías inesperadas para perfiles que deberían tener datos.
- [ ] Hay evidencia de impacto en PRD antes de activar el flag.
- [ ] No se puede validar al menos un usuario Admin PRD.
- [ ] `tenant_memberships` o `platform_memberships` faltan en PRD.
- [ ] RLS no está habilitado o las policies no corresponden al diseño aprobado.
- [ ] Faltan helpers requeridos o fallan al ejecutarse.
- [ ] No hay responsable humano para rollback.
- [ ] No hay aprobación humana Go explícita.

## 6. Checklist previo a activar Vercel Production

Ejecutar manualmente antes de tocar variables reales de Production:

1. Confirmar que el PR de esta fase ya fue revisado y mergeado hacia `develop` según flujo acordado.
2. Confirmar que no hay cambios pendientes en `supabase/` asociados a esta fase.
3. Confirmar que producción está operativa con `VITE_ENABLE_MEMBERSHIP_RESOLVER=false` o variable ausente.
4. Confirmar que el dashboard de Vercel corresponde al proyecto productivo correcto.
5. Confirmar que solo se editará el scope **Production** de la variable.
6. Confirmar que no se editarán variables de Supabase URL, anon key, service role ni secretos no relacionados.
7. Confirmar usuario Admin PRD, y si aplica usuarios Vigilancia y Residente PRD, con datos de prueba permitidos.
8. Confirmar que se tiene acceso para redeploy controlado de Production.
9. Confirmar que se tiene acceso a consola del navegador y a logs necesarios.
10. Confirmar que el rollback por variable fue entendido por el responsable humano.
11. Registrar hora de inicio, responsable y criterio de éxito esperado.

## 7. Procedimiento de activación PRD

La activación real debe hacerse manualmente en Vercel Production, no desde este repositorio ni desde este PR.

1. En Vercel, abrir el proyecto productivo de Urbaphix.
2. Ir a Environment Variables.
3. En scope **Production**, crear o actualizar:

   ```env
   VITE_ENABLE_MEMBERSHIP_RESOLVER=true
   ```

4. Guardar el cambio.
5. Ejecutar redeploy controlado de Production para que Vite compile el nuevo valor.
6. No modificar `.env.production` versionado ni archivos locales con secretos.
7. No ejecutar SQL como parte de la activación del flag.
8. Registrar deployment ID, hora de activación y responsable.

Esta documentación **no ejecuta el cambio** y no activa producción por sí misma.

## 8. Validación inmediata post-activación

Ejecutar inmediatamente después del redeploy Production con `VITE_ENABLE_MEMBERSHIP_RESOLVER=true`:

1. Abrir `https://www.urbaphix.com`.
2. Validar que la app carga sin pantalla en blanco.
3. Hacer login con usuario Admin PRD.
4. Confirmar que no hay loop de sesión.
5. Confirmar que no hay logout inesperado.
6. Revisar Dashboard Admin.
7. Confirmar menú esperado para rol Admin.
8. Revisar consola del navegador y eventos disponibles.
9. Confirmar consultas esperadas a `tenant_memberships`.
10. Confirmar que `usuarios_app` sigue disponible como fallback legacy.
11. Validar usuario Vigilancia PRD, si existe:
    - login exitoso;
    - menú esperado;
    - módulos de vigilancia sin consultas vacías inesperadas.
12. Validar usuario Residente PRD, si existe:
    - login exitoso;
    - menú esperado;
    - módulos de residente sin consultas vacías inesperadas.
13. Revisar Vercel deployment status.
14. Revisar Supabase API/Auth logs si aplica.
15. Registrar resultado Go post-activación o ejecutar rollback si aparece criterio No-Go.

## 9. Rollback inmediato

El rollback operativo no requiere SQL ni rollback estructural de base de datos.

Si aparece un criterio No-Go, revertir manualmente en Vercel Production a:

```env
VITE_ENABLE_MEMBERSHIP_RESOLVER=false
```

o eliminar la variable en Production.

Luego:

1. Guardar el cambio en Vercel Production.
2. Ejecutar redeploy controlado de Production.
3. Abrir `https://www.urbaphix.com`.
4. Validar login Admin PRD con flujo legacy.
5. Validar que no hay loop de sesión ni logout inesperado.
6. Confirmar que la app vuelve a depender de `usuarios_app` para perfil/rol.
7. Registrar hora de rollback, deployment ID y síntoma que motivó la reversión.
8. No ejecutar `drop table`, `delete`, `truncate`, rollback de migraciones ni cambios RLS como parte del rollback del flag.

## 10. Monitoreo recomendado

Durante la ventana y al menos durante el periodo definido por el responsable operativo, monitorear:

- Consola del navegador:
  - errores JavaScript;
  - mensajes controlados del resolver si aparecen;
  - loops de sesión;
  - errores de red a Supabase.
- Vercel:
  - estado del deployment Production;
  - errores de build/deploy;
  - métricas o logs disponibles para la app.
- Supabase API logs, si aplica:
  - respuestas 4xx/5xx en consultas a `tenant_memberships`;
  - respuestas 4xx/5xx en consultas a `usuarios_app`;
  - latencia anormal o errores recurrentes.
- Supabase Auth logs, si aplica:
  - errores de login;
  - refresh token failures;
  - cierres inesperados de sesión.
- Reporte funcional de usuario final:
  - acceso al dashboard;
  - menú correcto por rol;
  - datos esperados en módulos críticos;
  - ausencia de regresiones percibidas.

## 11. Evidencia mínima recomendada

Registrar evidencia sin exponer secretos, tokens, emails completos, user IDs ni datos personales innecesarios:

- Valor esperado del flag en Production antes y después, sin capturar otras variables sensibles.
- Deployment ID de activación o rollback.
- Hora exacta de activación y responsable.
- Resultado de login Admin PRD.
- Resultado de login Vigilancia PRD, si aplica.
- Resultado de login Residente PRD, si aplica.
- Capturas o notas de consola sin PII ni secretos.
- Resultado de revisión de logs Vercel/Supabase si aplica.
- Decisión final: mantener activado, rollback ejecutado o monitoreo extendido.

## 12. Confirmación de seguridad de esta fase

Esta fase cumple el alcance seguro porque:

- Solo agrega documentación operativa.
- No modifica `supabase/migrations/`.
- No modifica `docs/database-schema.md` porque no cambia tablas, columnas, FKs ni RLS.
- No ejecuta SQL contra PRD.
- No modifica `.env.production` real ni variables reales de Vercel.
- No cambia código frontend.
- No elimina fallback legacy.
- No altera producción automáticamente.

## 13. Criterio de cierre

FASE 3C.7 se puede cerrar cuando exista este documento claro de rollout PRD, reversible, con Go / No-Go explícito, checklist de activación y rollback por variable, sin activar producción y sin cambios en Supabase.
