# POST-PROD 2C-2C — RPC/Functions EXECUTE Exposure Audit (Readonly)

## Resumen ejecutivo
Esta fase realiza un inventario técnico **readonly** de exposición `EXECUTE` en funciones/RPC del schema `public` para priorizar hardening posterior (POST-PROD 2C-2D) sin impacto funcional.

Confirmaciones de alcance:
- No se aplicaron cambios remotos en Supabase.
- No se crearon migraciones nuevas.
- No se modificaron grants, policies, funciones ni frontend funcional.

Hallazgo principal esperado tras 2C-2B-A:
- Helpers `fn_auth_*`, `get_user_*`, `is_*` deben quedar sin ejecución para `anon`.
- RPC productivas de visitas/vigilancia se mantienen ejecutables por `anon`, `authenticated` y `service_role` por decisión controlada vigente.

## Estado actual después de 2C-2B-A
Estado objetivo vigente reportado:
- Helpers endurecidos:
  - `fn_auth_conjunto_id()`
  - `fn_auth_residente_id()`
  - `fn_auth_rol()`
  - `get_user_conjunto_id()`
  - `get_user_residente_id()`
  - `get_user_role()`
  - `is_admin()`
  - `is_residente()`
  - `is_vigilancia()`
- Estado esperado: `anon=false`, `authenticated=true`, `service_role=true`.

RPC productivas (fuera de cambios en esta fase):
- `fn_crear_o_reutilizar_visitante_y_registro(...)`
- `fn_registrar_ingreso_visita(text, uuid)`
- `fn_registrar_salida_visita(uuid, uuid)`
- Estado esperado: `anon=true`, `authenticated=true`, `service_role=true`.

## Alcance / No alcance
### Alcance
1. Documentación técnica de auditoría.
2. Script SQL readonly en `supabase/audits/`.
3. Revisión de uso frontend de `supabase.rpc(...)`.
4. Matriz función → uso frontend → exposición por rol → riesgo → recomendación.

### No alcance
- Revocar/otorgar permisos.
- Crear migraciones de hardening.
- Alterar funciones, policies RLS o grants de tablas.
- Cambios funcionales de frontend.
- Cambios remotos en DEV/QA/PRD.

## Metodología
1. Revisión de referencias en código y documentación:
   - Búsqueda de `supabase.rpc(` y `.rpc(` en `src/`.
   - Búsqueda de funciones objetivo (`fn_*`, `get_user_*`, `is_*`).
2. Construcción de script readonly para inventario exhaustivo de funciones `public` y su exposición EXECUTE por rol.
   - `anon`, `authenticated`, `service_role` se evalúan con `has_function_privilege`.
   - `PUBLIC` se audita por ACL/default privileges (`proacl` + `aclexplode` + `acldefault`) y **no** con `has_function_privilege('public', ...)`.
3. Clasificación funcional por categorías de riesgo operativo.
4. Recomendaciones sin ejecución de cambios.

## Evidencia frontend encontrada
| Archivo | Función llamada | Módulo | Flujo aparente | Recomendación |
|---|---|---|---|---|
| `src/modules/visitas/services/visitasService.js` | `fn_crear_o_reutilizar_visitante_y_registro` | visitas | autenticado (residente/admin) | Mantener en observación; evaluar retiro de `anon` solo con pruebas E2E. |
| `src/modules/visitas/services/visitasService.js` | `fn_registrar_ingreso_visita` | visitas | portería/vigilancia | Validar si endpoint requiere exposición pública real o solo token autenticado. |
| `src/modules/visitas/services/porteriaService.js` | `fn_registrar_ingreso_visita` | portería | vigilancia/autenticado | Candidato a migración a `authenticated` en 2C-2D con pruebas de QR. |
| `src/modules/visitas/services/porteriaService.js` | `fn_registrar_salida_visita` | portería | vigilancia/autenticado | Candidato a migración a `authenticated` en 2C-2D con pruebas de salida. |

Observación: no se encontró uso frontend directo de `fn_auth_*`, `get_user_*` ni `is_*`; su uso es principalmente indirecto vía RLS/policies/documentación.

## Matriz de funciones/RPC
| Función/RPC | Grupo | Evidencia frontend | Exposición objetivo actual | Riesgo | Recomendación |
|---|---|---|---|---|---|
| `fn_crear_o_reutilizar_visitante_y_registro` | RPC productiva activa | Sí | anon/authenticated/service_role | Alto (si anon no es estrictamente necesario) | Mantener en 2C-2C; evaluar restricción en 2C-2D con E2E. |
| `fn_registrar_ingreso_visita` | RPC productiva activa | Sí | anon/authenticated/service_role | Alto | Idem: validar necesidad de anon por flujo real QR. |
| `fn_registrar_salida_visita` | RPC productiva activa | Sí | anon/authenticated/service_role | Alto | Idem: validar y planificar transición controlada. |
| `fn_auth_conjunto_id` | Helper RLS/auth | No directo | anon=false, authenticated/service_role=true | Medio | Mantener estado endurecido; monitorear drift entre entornos. |
| `fn_auth_residente_id` | Helper RLS/auth | No directo | anon=false, authenticated/service_role=true | Medio | Igual que anterior. |
| `fn_auth_rol` | Helper RLS/auth | No directo | anon=false, authenticated/service_role=true | Medio | Igual que anterior. |
| `get_user_conjunto_id` | Helper legacy | No directo | anon=false, authenticated/service_role=true | Medio | Evaluar deprecación tras inventario de dependencias SQL. |
| `get_user_residente_id` | Helper legacy | No directo | anon=false, authenticated/service_role=true | Medio | Evaluar deprecación; confirmar existencia por ambiente. |
| `get_user_role` | Helper legacy | No directo | anon=false, authenticated/service_role=true | Medio | Evaluar reemplazo por `fn_auth_rol`. |
| `is_admin` / `is_residente` / `is_vigilancia` | Helper legacy | No directo | anon=false, authenticated/service_role=true | Medio | Inventariar dependencia en policies legacy y retirar progresivamente. |

## Clasificación de riesgo
- **Alto**: RPC productivas con `anon=true` y efecto de negocio directo (visitas/portería).
- **Medio**: helpers de autorización (canónicos o legacy) aunque ya endurecidos para `anon`; riesgo de drift o grants heredados en entornos.
- **Bajo**: funciones internas trigger/event_trigger sin invocación RPC directa (verificar en script).

## Recomendaciones por función
1. Mantener sin cambios las 3 RPC productivas durante 2C-2C.
2. Ejecutar el script readonly en DEV/QA/PRD y comparar resultados para detectar drift por ambiente.
3. Preparar en 2C-2D una propuesta de reducción de `anon` para RPC productivas con criterio de pruebas:
   - smoke visitas;
   - creación QR;
   - ingreso/salida por vigilancia;
   - regresión de notificaciones.
4. Definir plan de deprecación de `get_user_*`/`is_*` posterior a confirmación de no dependencia activa.

## Plan sugerido POST-PROD 2C-2D
1. Ejecutar auditoría comparativa por entorno (DEV/QA/PRD).
2. Marcar RPC candidatas a mover de `anon` → `authenticated`.
3. Diseñar pruebas E2E mínimas obligatorias por flujo.
4. Implementar hardening en migración separada y reversible (fuera de esta fase).
5. Monitoreo posterior y rollback plan documentado.

## Riesgos pendientes
- Dependencias externas o clientes legacy que aún utilicen anon en RPC productivas.
- Drift de permisos entre ambientes.
- Helpers legacy aún presentes en SQL histórico/policies antiguas.

## Criterio de aceptación
- PR a `develop`.
- Solo documentación y script readonly.
- Sin migraciones nuevas.
- Sin cambios funcionales frontend.
- Sin cambios remotos en Supabase.
- Sin cambios de permisos.
- Matriz clara de exposición por función/rol.


## Nota técnica sobre PUBLIC
En PostgreSQL, `PUBLIC` es un pseudo-rol. Para esta auditoría se evita tratarlo como usuario real.
Por eso, la señal `public_execute`/`public_grant_detected` se calcula revisando ACL efectiva de función:
- `aclexplode(coalesce(proacl, acldefault('f', proowner)))`
- `grantee = 0`
- `privilege_type = 'EXECUTE'`

Esto también cubre funciones con `proacl IS NULL`, interpretando privileges por defecto del objeto para el owner/tipo de objeto dentro de la auditoría readonly.
