# POST-PROD 2C-2A — Auditoría y reducción quirúrgica de EXECUTE

## Resumen ejecutivo
En esta fase se aplica un recorte mínimo y controlado de privilegios `EXECUTE` únicamente sobre funciones internas/trigger-only confirmadas sin consumo frontend directo: `rls_auto_enable()`, `set_updated_at()` y `handle_new_user()`.  
No se tocan RPC productivas de visitas, helpers canónicos `fn_auth_*`, policies RLS, grants de tablas ni lógica funcional de frontend.

## Evidencia base
- Esquema remoto versionado (`20260410031821_remote_schema.sql`) muestra `GRANT ALL` a `anon` y `authenticated` sobre funciones internas como `rls_auto_enable()`, `set_updated_at()` y `handle_new_user()`.
- Auditorías previas de seguridad (`POST_PROD_2A`, `POST_PROD_2C-1`) ya clasifican estas funciones como candidatas de endurecimiento de ejecutabilidad externa.
- Búsqueda de uso en frontend no muestra invocaciones RPC directas a estas tres funciones.

## Qué cambia en 2C-2A
- Nueva migración:
  - `supabase/migrations/20260520110000_post_prod_2c2a_revoke_internal_function_execute.sql`
- Revokes explícitos y no masivos:
  - `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;`
  - `REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;`
  - `REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;`
- Nuevo script readonly de verificación:
  - `supabase/audits/post_prod_2c2a_verify_execute_grants.sql`

## Qué NO cambia en 2C-2A
- No se aplican cambios remotos a Supabase desde este PR.
- No se modifica PRD directamente.
- No se hacen revokes masivos (`ON ALL FUNCTIONS` / `REVOKE SELECT`).
- No se cambian policies RLS.
- No se cambian grants sobre tablas.
- No se cambian cuerpos de funciones, ownership, ni `SECURITY DEFINER/INVOKER`.
- No se modifica frontend funcional.

## Matriz función → tipo → uso frontend → riesgo → acción 2C-2A → pendiente

| Función | Tipo | Uso frontend | Riesgo | Acción 2C-2A | Pendiente |
|---|---|---|---|---|---|
| `rls_auto_enable` | event trigger / internal | No | Alta exposición innecesaria | Revocar `anon`/`authenticated` | Revalidar necesidad de exposición futura |
| `set_updated_at` | trigger helper | No | Exposición innecesaria | Revocar `anon`/`authenticated` | Validar flujos UPDATE con triggers |
| `handle_new_user` | auth trigger | No | Exposición innecesaria | Revocar `anon`/`authenticated` | Validar alta/auth de usuario |
| `fn_crear_o_reutilizar_visitante_y_registro` | RPC productiva visitas | Sí | Alta, pero funcional | No tocar ahora | Fase futura con pruebas E2E |
| `fn_registrar_ingreso_visita` | RPC productiva vigilancia | Sí | Alta, pero funcional | No tocar ahora | Fase futura con pruebas E2E |
| `fn_registrar_salida_visita` | RPC productiva vigilancia | Sí | Alta, pero funcional | No tocar ahora | Fase futura con pruebas E2E |
| `fn_auth_*` | Helper RLS | Indirecto | Media | No tocar ahora | Revisar después con matriz de policies |
| `get_user_*` / `is_*` | Helper legacy | No directo | Media | Documentar, no tocar aún | Evaluar reemplazo/deprecación |

## Plan de validación QA
1. Aplicar migración en `urbaphix-qa` (no en PRD).
2. Ejecutar script readonly `post_prod_2c2a_verify_execute_grants.sql` y guardar evidencia.
3. Probar smoke funcional:
   - registro/login de usuario nuevo (flujo `handle_new_user` vía trigger);
   - operaciones con UPDATE que disparan `set_updated_at`;
   - rutas de visitas y portería que usan RPC productivas (sin cambios en grants).
4. Confirmar que `anon` y `authenticated` ya no ejecutan las 3 funciones internas.
5. Validar que `service_role`/internos conservan operación esperada.

## Plan de rollback conceptual
Si aparece regresión en QA:
1. Crear migración compensatoria con `GRANT EXECUTE` puntual solo para funciones afectadas.
2. Re-ejecutar script readonly de verificación.
3. Documentar incidente y ajustar clasificación (interna vs productiva/indirecta) antes de nuevo intento.

## Riesgos pendientes
- Dependencias indirectas no explícitas en tooling externo podrían requerir `EXECUTE` sobre funciones internas.
- Helpers legacy `get_user_*` / `is_*` siguen expuestos y requieren fase futura de racionalización.
- RPC productivas de visitas continúan con grants amplios por decisión de no ruptura en esta fase.

## Recomendación para 2C-2B
- Ejecutar reducción adicional por lotes pequeños, empezando por helpers legacy de bajo uso comprobado.
- Preparar pruebas E2E de visitas/portería antes de tocar grants de RPC productivas.
- Evaluar matriz de consumo real (`frontend`, jobs, edge functions) para justificar cada `EXECUTE` en `authenticated`.
