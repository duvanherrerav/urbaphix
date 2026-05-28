# FASE 3C.3 — Promoción controlada PRD para memberships y RLS base

## 1. Propósito

Este documento prepara la promoción controlada a producción de la infraestructura base creada en FASE 3C.1 para:

- `public.platform_memberships`;
- `public.tenant_memberships`;
- helpers RLS base `fn_is_platform_superadmin()`, `fn_has_platform_role(text)`, `fn_has_tenant_access(uuid)` y `fn_has_tenant_role(uuid, text)`;
- RLS únicamente sobre las dos tablas nuevas.

La promoción PRD **no se ejecuta desde este PR**. Este PR solo entrega documentación operativa y SQL manual no destructivo/segregado para revisión humana antes de tocar producción.

## 2. Alcance y límites obligatorios

### Permitido en esta fase

- Revisar la migración ya existente `supabase/migrations/20260528120000_fase_3c1_memberships_rls_base.sql`.
- Ejecutar diagnósticos manuales de solo lectura contra PRD.
- Aplicar la migración existente en PRD solo después de aprobación humana explícita.
- Ejecutar backfill manual/idempotente en PRD solo después de aprobación humana explícita y postcheck estructural exitoso.
- Validar frontend productivo sin modificarlo.

### Fuera de alcance

- No ejecutar `supabase db push` contra PRD desde Codex.
- No crear migraciones nuevas para PRD.
- No modificar migraciones existentes.
- No modificar frontend, login, rutas, `App.jsx` ni módulos funcionales.
- No alterar RLS de tablas de negocio existentes.
- No modificar destructivamente `usuarios_app`.
- No modificar helpers legacy `fn_auth_conjunto_id()`, `fn_auth_rol()` ni `fn_auth_residente_id()`.
- No hacer deletes físicos.
- No tocar variables de entorno.

## 3. Entornos y evidencia previa

| Entorno | Proyecto esperado | Ref esperado | Estado |
| --- | --- | --- | --- |
| DEV | `urbaphix-dev` | `polstaxmencetxgctvsw` | FASE 3C.1 aplicada y validada |
| QA | `urbaphix-qa` | `tjbdtorqddunpknarzfc` | FASE 3C.1 aplicada y validada |
| PRD | `urbaphix-prd` | `oamczhwtilkmtxleaakb` | Pendiente; no tocado por esta fase |

La decisión Go / No-Go para PRD parte de que DEV y QA ya fueron validados funcionalmente y por SQL. PRD requiere diagnóstico propio porque los datos productivos pueden diferir de DEV/QA.

## 4. Archivos operativos de esta fase

- Diagnóstico PRD previo, no destructivo: `supabase/validation/fase_3c3_prd_precheck_memberships.sql`.
- Backfill PRD manual, idempotente y fuera de migraciones: `supabase/validation/fase_3c3_prd_backfill_tenant_memberships.sql`.
- Validación PRD post-promoción: `supabase/validation/fase_3c3_prd_postcheck_memberships.sql`.

Todos los scripts deben ejecutarse manualmente en una sesión conectada al proyecto PRD esperado (`oamczhwtilkmtxleaakb`) y sus resultados deben adjuntarse a la aprobación operativa.

## 5. Orden operativo recomendado para PRD

1. Confirmar link CLI a PRD.
2. Ejecutar `supabase migration list`.
3. Confirmar que solo está pendiente `20260528120000_fase_3c1_memberships_rls_base.sql`.
4. Ejecutar precheck PRD (`supabase/validation/fase_3c3_prd_precheck_memberships.sql`).
5. Revisar resultados manualmente.
6. Decidir Go / No-Go con el checklist de este documento.
7. Si Go: ejecutar `supabase db push` en PRD durante ventana aprobada.
8. Ejecutar postcheck estructural (`supabase/validation/fase_3c3_prd_postcheck_memberships.sql`, secciones estructurales).
9. Ejecutar backfill PRD (`supabase/validation/fase_3c3_prd_backfill_tenant_memberships.sql`).
10. Ejecutar postcheck de datos (`supabase/validation/fase_3c3_prd_postcheck_memberships.sql`, secciones de datos).
11. Validar frontend producción.
12. Monitorear logs Supabase y aplicación.

## 6. Checklist Go / No-Go

### Go solo si todo esto es verdadero

- [ ] DEV validado con migración, RLS, helpers, backfill y perfiles admin/vigilancia sin regresión visible.
- [ ] QA validado con migración, RLS, helpers, backfill y perfiles admin/vigilancia/residente sin regresión visible.
- [ ] PRD precheck ejecutado contra `urbaphix-prd` / `oamczhwtilkmtxleaakb`.
- [ ] `supabase migration list` muestra como pendiente únicamente `20260528120000_fase_3c1_memberships_rls_base.sql` respecto al alcance esperado.
- [ ] No existen usuarios productivos críticos con `usuarios_app.conjunto_id` nulo sin plan operativo explícito.
- [ ] No existen roles no mapeables en `usuarios_app.rol_id` o cada excepción tiene decisión documentada.
- [ ] No existen residentes productivos con rol `residente` sin relación requerida en `public.residentes` o cada excepción tiene decisión documentada.
- [ ] El conteo estimado del backfill coincide con los usuarios válidos esperados.
- [ ] No hay duplicados potenciales activos por `(usuarios_app.id, usuarios_app.conjunto_id)`.
- [ ] La existencia previa de `platform_memberships` o `tenant_memberships`, si aparece en PRD, fue investigada antes de continuar.
- [ ] Hay respaldo o punto de recuperación acordado para PRD.
- [ ] Hay ventana de bajo tráfico definida.
- [ ] Hay responsable humano autorizado para ejecutar y supervisar PRD.
- [ ] No hay cambios frontend necesarios porque el frontend legacy sigue leyendo `usuarios_app`.

### No-Go inmediato si ocurre cualquiera de estos casos

- [ ] El proyecto conectado no es `oamczhwtilkmtxleaakb`.
- [ ] Hay más migraciones pendientes que la esperada y no han sido revisadas.
- [ ] El precheck encuentra roles no mapeables sin decisión.
- [ ] El precheck encuentra residentes sin `residente_id` requerido sin decisión.
- [ ] El precheck encuentra datos que provocarían duplicados activos.
- [ ] Las tablas de memberships ya existen con estructura distinta a la migración esperada.
- [ ] No hay ventana, respaldo o responsable humano definido.

## 7. Criterios de revisión de resultados PRD

### Precheck

El precheck debe confirmar:

- conexión al proyecto esperado;
- conteo total de `usuarios_app`;
- distribución por `rol_id`;
- usuarios con `conjunto_id` nulo;
- roles no mapeables;
- residentes sin registro en `residentes`;
- relación `usuarios_app` ↔ `residentes`;
- duplicados potenciales por `(id, conjunto_id)`;
- existencia o ausencia previa de tablas de memberships;
- estado de aplicación de la migración `20260528120000`.

### Backfill

El backfill debe:

- permanecer fuera de `supabase/migrations`;
- usar `usuarios_app.id` como `tenant_memberships.user_id`;
- mapear `admin`/`administrador` a `admin_conjunto`;
- mapear `vigilancia`/`vigilante` a `vigilante`;
- mapear `residente` a `residente`;
- excluir residentes sin `residente_id`;
- no borrar ni modificar `usuarios_app`;
- no hacer deletes físicos;
- ser idempotente mediante `not exists` contra membresía activa por `(user_id, conjunto_id)`;
- mostrar conteos antes y después.

### Postcheck

El postcheck debe confirmar:

- tablas creadas;
- funciones creadas;
- RLS habilitada;
- 8 policies creadas con nombres esperados;
- conteo de `usuarios_app` válidos vs `tenant_memberships` legacy;
- roles creados en `tenant_memberships`;
- ausencia de duplicados activos;
- residentes con `residente_id` poblado;
- helpers ejecutan sin error;
- frontend legacy continúa usando `usuarios_app`.

## 8. Rollback PRD

### Principio recomendado

El rollback recomendado para esta fase en PRD es **lógico y controlado**, no destructivo. Como el frontend actual continúa usando `usuarios_app`, un fallo del backfill o de uso operativo de memberships puede aislarse revocando memberships sin eliminar tablas ni tocar datos legacy.

### Rollback lógico del backfill

Si se requiere revertir el backfill manual, preferir marcar las filas creadas desde legacy como revocadas:

```sql
update public.tenant_memberships
set
  status = 'revoked',
  revoked_at = coalesce(revoked_at, now()),
  updated_at = now()
where source_legacy = 'usuarios_app'
  and status = 'active';
```

Luego validar:

```sql
select status, count(*)
from public.tenant_memberships
where source_legacy = 'usuarios_app'
group by status
order by status;
```

Este rollback lógico no modifica `usuarios_app`, no elimina registros y conserva trazabilidad.

### Sobre rollback estructural

No hacer `drop table`, `drop function` ni `cascade` en PRD sin decisión humana explícita y plan de ventana. Aunque la migración 3C.1 crea tablas nuevas, un `drop table` en PRD puede destruir evidencia operacional o afectar procesos futuros si ya se activaron dependencias.

Si se llegara a requerir rollback estructural, debe abrirse un plan separado con:

- inventario de dependencias;
- respaldo verificado;
- aprobación explícita;
- SQL revisado por pares;
- ventana operativa;
- validación posterior.

## 9. Verificación de compatibilidad frontend legacy

Antes y después de PRD, validar que el frontend productivo sigue consultando `usuarios_app` para identidad/rol y que no depende de `tenant_memberships` para login. La evidencia mínima recomendada es:

- login exitoso de perfiles productivos representativos;
- consultas Supabase 200 OK a `usuarios_app`;
- navegación sin regresión para admin, vigilancia y residente;
- ausencia de cambios en frontend en el PR de promoción.

## 10. Confirmación final de seguridad

Esta fase no toca PRD por sí misma. PRD solo debe modificarse después de aprobación humana explícita del checklist Go / No-Go, con sesión conectada al proyecto `urbaphix-prd` / `oamczhwtilkmtxleaakb`, respaldo acordado y ventana de bajo tráfico.
