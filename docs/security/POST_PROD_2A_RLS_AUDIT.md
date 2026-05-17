# POST-PROD 2A — Auditoría RLS Supabase sin cambios destructivos

## 1. Resumen ejecutivo

Esta auditoría documenta el estado inicial de seguridad Supabase/RLS para preparar POST-PROD 2 sin modificar producción ni generar cambios funcionales. El alcance de esta subfase es únicamente documental y reproducible: se revisó el inventario de tablas de `docs/database-schema.md`, las migraciones existentes y el consumo real desde frontend mediante búsquedas en `src/`.

**Resultado principal:** el frontend sí usa activamente tablas core de autenticación/perfil, visitas, pagos, reservas, paquetería, incidentes y notificaciones. También existen tablas con uso parcial, histórico o sin evidencia de uso actual desde frontend, por lo que no deben endurecerse de forma masiva sin pruebas por rol y sin validar primero los grants/policies actuales contra la base PRD.

**No se aplicaron cambios a Supabase.** Este documento no propone ejecutar cambios inmediatos sobre policies, grants, funciones o tablas. Las siguientes subfases deben usar el script `supabase/audits/rls_audit_readonly.sql` para capturar evidencia actual antes de diseñar cualquier migración futura.

## 2. Alcance y fuentes revisadas

### Fuentes de verdad del repositorio

1. `docs/database-schema.md`: inventario y descripción funcional de tablas/policies documentadas.
2. `supabase/migrations/`: historial técnico de estructura, RLS y funciones.
3. `src/services/`: inicialización Supabase y servicios compartidos.
4. `src/modules/**`: consumo real desde módulos frontend.

### Comandos locales usados para levantar evidencia

- `rg -n "\.from\(['\"]|\.rpc\(['\"]|supabase\.from|supabase\.rpc" src docs supabase --glob '!supabase/migrations/**'`
- script local de lectura sobre `src/**/*.{js,jsx,ts,tsx}` para mapear apariciones por tabla/RPC.
- `rg -n "CREATE POLICY|fn_auth_|SECURITY DEFINER|CREATE OR REPLACE FUNCTION|GRANT|<tabla>" docs/database-schema.md supabase/migrations/*.sql`

### Límites de esta auditoría

- No se conectó ni se modificó Supabase PRD.
- No se validaron conteos reales de filas, permisos efectivos ni salida del Security Advisor en tiempo real.
- La clasificación se basa en evidencia del repositorio y en los hallazgos iniciales reportados para PRD.
- Las tablas no encontradas en frontend se clasifican como “sin evidencia de uso actual” o “planeada/futura/posiblemente obsoleta”, nunca como candidatas a eliminación inmediata.

## 3. Estado actual conocido

### Confirmado por documentación/migraciones locales

- El esquema funcional está concentrado en `public`.
- `docs/database-schema.md` lista tablas core: `usuarios_app`, `residentes`, `roles`, `conjuntos`, `torres`, `apartamentos`, `visitantes`, `registro_visitas`, `pagos`, `paquetes`, `reservas`, `recursos_comunes`, `incidentes`, `notificaciones`, entre otras.
- Existen helpers de RLS documentados y/o referenciados en migraciones: `fn_auth_conjunto_id()`, `fn_auth_residente_id()` y `fn_auth_rol()`.
- El snapshot remoto histórico contiene grants amplios para `anon`, `authenticated` y `service_role`; migraciones posteriores normalizan parte de RLS, pero se debe confirmar el estado efectivo en PRD con queries de auditoría.
- El frontend usa el cliente Supabase con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; no hay service role en frontend.

### Reportado desde Security Advisor PRD y pendiente de confirmar con script

- Todas las tablas `public` visibles tienen RLS habilitado.
- `public.trasteos` y `public.vehiculos` tienen RLS habilitado pero no tienen policies.
- Muchas tablas `public` están visibles para `anon`/`authenticated` vía GraphQL/API por grants `SELECT`.
- Varias funciones `SECURITY DEFINER` son ejecutables por `anon`/`authenticated`.
- Varias funciones no tienen `search_path` fijo.
- Auth leaked password protection está deshabilitado.

## 4. Riesgos detectados

1. **Grants amplios heredados:** si un rol tiene permiso de API/GraphQL y una policy permite demasiado, se expone información multitenant.
2. **Tablas con RLS pero sin policies:** pueden romper módulos si se habilitan flujos futuros sin policy o pueden generar confusión operativa; `vehiculos` y `trasteos` requieren validación especial.
3. **Funciones `SECURITY DEFINER`:** si son ejecutables por roles públicos y no validan `auth.uid()`, rol, `conjunto_id` o `residente_id`, podrían saltarse RLS de tablas subyacentes.
4. **Funciones sin `search_path` fijo:** riesgo de resolución de objetos no deseados en funciones privilegiadas.
5. **Matriz funcional incompleta:** algunas tablas modeladas no muestran consumo frontend actual; no deben recibir cambios agresivos hasta validar ownership funcional.
6. **Reservas con doble modelo visible:** el frontend usa `recursos_comunes`, `reservas_zonas`, `reservas_bloqueos`, `reservas_eventos` y `reservas_documentos`; también aparece `reservas` a nivel UI/rutas. Hay que confirmar cuál es tabla principal vigente antes de tocar policies.
7. **Tablas “abiertas para lectura” documentadas:** `archivos` y `config_pagos` aparecen con policies de lectura muy amplias en documentación; requieren revisión por sensibilidad de datos.

## 5. Recomendación de división por subfases

### POST-PROD 2B — Captura de evidencia en PRD y QA

- Ejecutar `supabase/audits/rls_audit_readonly.sql` en PRD y QA.
- Exportar resultados con fecha, project ref y usuario ejecutor.
- Comparar policies/grants/RPC entre PRD, QA y migraciones.
- No cambiar policies todavía.

### POST-PROD 2C — Diseño de hardening no destructivo por módulo

- Priorizar tablas activas: login/perfil, visitas, pagos, reservas, paquetería, incidentes, notificaciones.
- Diseñar cambios mínimos por lote, con pruebas de regresión por rol.
- Preparar migraciones pequeñas y reversibles para grants/RPC/policies, revisadas antes de ejecutar.

### POST-PROD 2D — Aplicación controlada y validación post-cambio

- Aplicar por ventana controlada, primero QA, luego PRD.
- Validar checklist funcional completo por rol.
- Ejecutar auditoría antes/después y conservar evidencia.
- Monitorear errores de Supabase/API y rollback conceptual por lote.

## 6. Checklist mínimo antes de tocar RLS

- [ ] Exportar resultado de `supabase/audits/rls_audit_readonly.sql` desde PRD.
- [ ] Exportar resultado equivalente desde QA.
- [ ] Confirmar lista efectiva de policies por tabla.
- [ ] Confirmar grants efectivos para `anon` y `authenticated`.
- [ ] Confirmar funciones `SECURITY DEFINER`, ejecutabilidad y `search_path`.
- [ ] Confirmar módulos productivos activos con negocio: visitas, pagos, reservas, paquetería, incidentes, notificaciones.
- [ ] Tener usuarios de prueba por rol: `admin`, `residente`, `vigilancia`.
- [ ] Tener datos de prueba en al menos dos conjuntos para validar aislamiento multitenant.
- [ ] Ejecutar `docs/security/RLS_TEST_CHECKLIST.md` en QA antes de PRD.
- [ ] Definir rollback conceptual y responsable de ejecución.

## 7. Plan de rollback conceptual

> Este plan no ejecuta ni incluye SQL de rollback. Solo define el enfoque operativo para futuras subfases.

1. Aplicar cambios futuros por lotes pequeños y etiquetados por módulo.
2. Guardar snapshot previo de policies, grants y funciones con el script readonly.
3. Si una subfase rompe un flujo crítico, revertir únicamente el lote afectado con una migración revisada por humano.
4. Revalidar login, carga de perfil y dashboard inmediatamente después de cualquier reversión.
5. No mezclar cambios de RLS con cambios frontend funcionales en la misma subfase.

## 8. Recomendaciones explícitas de qué NO tocar todavía

- No modificar policies activas de `usuarios_app`, `residentes`, `registro_visitas`, `pagos`, `paquetes`, `reservas_zonas`, `recursos_comunes`, `incidentes` ni `notificaciones` sin ejecutar primero el checklist funcional.
- No restringir grants de `anon`/`authenticated` de forma masiva sin confirmar si PostgREST/GraphQL y Realtime dependen de ellos bajo RLS.
- No cambiar funciones de visitas (`fn_crear_o_reutilizar_visitante_y_registro`, `fn_registrar_ingreso_visita`, `fn_registrar_salida_visita`) sin pruebas de creación, QR, ingreso y salida.
- No asumir que `accesos`, `zonas_comunes` o `reservas_zonas` están obsoletas solo por nombre; documentar evidencia y validar con negocio.
- No eliminar ni renombrar tablas clasificadas como “sin evidencia de uso actual”.
- No crear migraciones reales en POST-PROD 2A.

## 9. Matriz inicial tabla → módulo → rol

| Tabla | Clasificación preliminar | Módulo(s) frontend | Rol(es) esperados | Evidencia principal | Observaciones |
|---|---|---|---|---|---|
| `usuarios_app` | Activa en uso por frontend | auth, shell App, visitas, pagos, paquetería, seguridad | admin, residente, vigilancia | `src/App.jsx`, `src/modules/auth/Login.jsx`, varios services | Tabla crítica para perfil, rol y `conjunto_id`. |
| `residentes` | Activa en uso por frontend | visitas, pagos, reservas, paquetería | admin, residente, vigilancia | `CrearVisita`, `MisPagos`, `reservasService`, `paquetesService` | Crítica para `residente_id` y relaciones con apartamento. |
| `roles` | Parcialmente implementada o catálogo/base de permisos documentado, sin evidencia de consumo frontend directo | Sin consumo frontend directo confirmado | admin, residente, vigilancia | Documentada en schema/migraciones o referenciada indirectamente por modelo de roles; no hay evidencia de queries frontend | Validar si `roles` sigue siendo catálogo activo de base de datos o si el rol operativo vive en `usuarios_app`. No diseñar permisos API para `roles` hasta confirmar necesidad real. |
| `conjuntos` | Parcialmente implementada | auth/perfil indirecto, multitenancy | admin, residente, vigilancia | Documentada como padre; referencias por `conjunto_id` | No se vio `.from('conjuntos')` en frontend; se usa por FK/filtros. |
| `torres` | Activa en uso por frontend | pagos, paquetería, dashboard, visitas/reservas por relaciones | admin, vigilancia | `CrearCobro`, `CrearPaquete`, `KPIsAdmin`, `paquetesService` | Catálogo estructural por conjunto. |
| `apartamentos` | Activa en uso por frontend | pagos, paquetería, dashboard, reservas/visitas por relaciones | admin, residente, vigilancia | `CrearCobro`, `KPIsAdmin`, `paquetesService`, selects anidados | Catálogo estructural; validar filters por conjunto. |
| `visitantes` | Activa en uso por frontend | visitas, dashboard | residente, vigilancia, admin | `CrearVisita`, `PanelVigilancia`, `EscanearQR` | También se crea/reutiliza vía RPC crítica. |
| `registro_visitas` | Activa en uso por frontend | visitas, QR, vigilancia, dashboard | residente, vigilancia, admin | `CrearVisita`, `PanelVigilancia`, `EscanearQR`, `porteriaService` | Flujo productivo crítico. |
| `accesos` | Posiblemente obsoleta | Sin evidencia frontend actual | vigilancia | Documentada en schema; no se encontró `.from('accesos')` | Validar si fue reemplazada por campos de ingreso/salida en `registro_visitas`. |
| `pagos` | Activa en uso por frontend | contabilidad, dashboard, realtime | admin, residente | `MisPagos`, `PanelPagosAdmin`, `EstadoCuenta`, `CarteraResumen` | Flujo productivo crítico. |
| `pagos_eventos` | Activa en uso por frontend | contabilidad/auditoría pagos | admin, residente | `pagosEventosService`, realtime en `MisPagos` | Audita cambios de estado; validar lectura residente/admin. |
| `config_pagos` | Activa en uso por frontend | pagos residente | residente, admin | `MisPagos` | Policy documentada como lectura amplia; revisar sensibilidad. |
| `paquetes` | Activa en uso por frontend | paquetería, vigilancia, dashboard | vigilancia, residente, admin | `paquetesService`, `MisPaquetes`, `PanelPaquetes`, `DashboardAdmin` | Productivo; usa notificaciones. |
| `reservas` | Parcialmente implementada | reservas/rutas UI y dashboard | residente, admin, vigilancia | `App.jsx`, páginas de reservas, imports/UI | Validar si es tabla activa o nombre funcional frente a `reservas_zonas`. |
| `recursos_comunes` | Activa en uso por frontend | reservas | residente, admin, vigilancia | `reservasService`, `PanelReservasAdmin`, `ReservarZona` | Parece reemplazar funcionalmente a `zonas_comunes` para recursos. |
| `reservas_bloqueos` | Activa en uso por frontend | reservas admin/disponibilidad | admin | `reservasService` | Crítica para disponibilidad; endurecer con mucho cuidado. |
| `reservas_eventos` | Activa en uso por frontend | reservas auditoría | admin, residente/vigilancia según flujo | `reservasService` | Audita transiciones de reserva. |
| `reservas_documentos` | Activa en uso por frontend | reservas documentos/soportes | admin, residente | `reservasService` | Validar storage/URLs y acceso por conjunto. |
| `incidentes` | Activa en uso por frontend | seguridad, vigilancia, dashboard | vigilancia, admin | `seguridadService`, `ListaIncidentes`, `porteriaService`, `DashboardAdmin` | Productivo para novedades. |
| `notificaciones` | Activa en uso por frontend | global, visitas, pagos, paquetes, seguridad | admin, residente, vigilancia | `NotificacionesBell`, services de módulos | Validar destinatarios y exposición cruzada. |
| `vehiculos` | Sin evidencia de uso actual | Dashboard menciona conteo/UI indirecta | por definir | `DashboardAdmin` contiene referencia textual; no se encontró `.from('vehiculos')` | Security Advisor reporta RLS sin policies; no tocar sin validar roadmap. |
| `trasteos` | Planeada para fases futuras | Sin evidencia frontend actual | por definir | No se encontró uso en `src/` | Security Advisor reporta RLS sin policies; tratar como futura/no implementada. |
| `zonas_comunes` | Posiblemente obsoleta | Sin evidencia frontend actual | admin/residente si vigente | Migración de hardening; no se encontró `.from('zonas_comunes')` | Validar si fue reemplazada por `recursos_comunes`. |
| `reservas_zonas` | Activa en uso por frontend | reservas actual/histórico y dashboard | residente, admin, vigilancia | `reservasService`, `DashboardAdmin` | Sigue en uso real; no clasificar como obsoleta todavía. |
| `archivos` | Sin evidencia de uso actual | Sin evidencia frontend actual | por definir | Documentada en schema; no se encontró uso en `src/` | Puede pertenecer a soportes futuros. |
| `multas` | Sin evidencia de uso actual | Mención UI/textual en pagos | por definir | `PagoActionPanel` menciona multas como concepto, no tabla | Validar si solo está modelada. |
| `pqr` | Sin evidencia de uso actual | Sin evidencia frontend actual | por definir | No se encontró uso en `src/` | Validar roadmap. |
| `comunicados` | Sin evidencia de uso actual | Sin evidencia frontend actual | admin/residente si vigente | Documentada en schema; no se encontró uso en `src/` | Validar si módulo de comunicaciones está pendiente. |

## 10. RPC/funciones críticas

| Función/RPC | Evidencia frontend/migraciones | Riesgo principal | Recomendación para siguiente fase |
|---|---|---|---|
| `fn_crear_o_reutilizar_visitante_y_registro` | Usada por `src/modules/visitas/services/visitasService.js` | Crea visitante/registro; si es privilegiada debe validar usuario, rol y conjunto | Auditar definición, `SECURITY DEFINER`, `search_path`, grants y validaciones internas. |
| `fn_registrar_ingreso_visita` | Usada por `visitasService` y `porteriaService` | Ingreso por QR; posible ejecución indebida si no valida vigilancia/conjunto | Probar con vigilancia válido, residente y anon. |
| `fn_registrar_salida_visita` | Usada por `porteriaService` | Salida de visita; riesgo similar al ingreso | Validar rol vigilancia y pertenencia a conjunto. |
| `get_user_conjunto_id` | No se encontró uso frontend directo; aparece en scope de auditoría | Helper sensible si existe en DB | Confirmar definición y migración vigente. |
| `get_user_residente_id` | No se encontró uso frontend directo; aparece en scope de auditoría | Helper sensible si existe en DB | Confirmar definición y si fue reemplazado por `fn_auth_residente_id`. |
| `get_user_role` | No se encontró uso frontend directo; aparece en scope de auditoría | Helper sensible si existe en DB | Confirmar definición y si fue reemplazado por `fn_auth_rol`. |
| `handle_new_user` | No se encontró uso frontend directo; probable trigger auth | Perfil inicial | Confirmar trigger, privileges y `search_path`. |
| `is_admin` / `is_residente` / `is_vigilancia` | No se encontró uso frontend directo | Helpers de policies legacy | Confirmar si siguen activos o reemplazados por `fn_auth_rol`. |
| `rls_auto_enable` | No se encontró uso frontend directo | Automatización RLS | Confirmar necesidad y ejecutabilidad pública. |
| `fn_auth_residente_id` | Referenciada por documentación/migraciones | Helper canónico RLS | Validar estable, search_path y que no exponga datos a anon. |
| `fn_auth_conjunto_id` | Referenciada por documentación/migraciones | Helper canónico multitenant | Validar uso consistente en policies. |
| `fn_auth_rol` | Referenciada por documentación/migraciones | Helper canónico de rol | Validar normalización de rol `vigilancia`. |
| `set_updated_at` | No se encontró uso frontend directo; probable trigger | Baja sensibilidad pero revisar search_path | Confirmar funciones trigger sin grants innecesarios. |

## 11. Evidencia por módulo frontend

### Auth y shell global

- `src/services/supabaseClient.js` crea el cliente con URL y anon key públicas; no usa service role.
- `src/App.jsx` carga `usuarios_app` por `auth.uid()` de Supabase para obtener perfil, rol y conjunto.
- `src/modules/auth/Login.jsx` consulta `usuarios_app` después de autenticación.

### Dashboard admin

- `src/modules/admin/pages/DashboardAdmin.jsx` consulta `registro_visitas`, `pagos`, `incidentes` y `reservas_zonas` para KPIs/resúmenes.
- Componentes admin consultan `paquetes`, `apartamentos` y `torres`.
- Hay menciones de `vehiculos`, pero no evidencia de `.from('vehiculos')`.

### Visitas y vigilancia

- `src/modules/visitas/services/visitasService.js` usa `usuarios_app`, RPC `fn_crear_o_reutilizar_visitante_y_registro`, `registro_visitas`, RPC `fn_registrar_ingreso_visita` y `notificaciones`.
- `src/modules/visitas/services/porteriaService.js` usa RPC `fn_registrar_ingreso_visita`, RPC `fn_registrar_salida_visita`, `bitacora_porteria`, `usuarios_app`, `notificaciones`, `registro_visitas`, `incidentes` y `paquetes`.
- Páginas de visitas consultan `tipos_documento`, `residentes`, `visitantes`, `registro_visitas`, `usuarios_app` y `notificaciones`.

### Contabilidad/pagos

- `src/modules/contabilidad/pages/MisPagos.jsx` usa `config_pagos`, `residentes`, `pagos`, storage `comprobantes` y realtime de `pagos`/`pagos_eventos`.
- `src/modules/contabilidad/pages/PanelPagosAdmin.jsx` y servicios usan `pagos`, `residentes`, `usuarios_app`, `pagos_eventos` y `notificaciones`.
- `src/modules/contabilidad/pages/CrearCobro.jsx` usa `torres`, `apartamentos`, `residentes` y crea cobros en `pagos`.

### Reservas

- `src/modules/reservas/services/reservasService.js` usa `recursos_comunes`, `reservas_zonas`, `reservas_bloqueos`, `reservas_eventos`, `reservas_documentos`, `residentes`, `usuarios_app`, `apartamentos` y `torres` mediante selects directos/anidados.
- Las páginas `ReservarZona`, `PanelReservasAdmin` y `PanelReservasVigilancia` consumen el servicio y UI de reservas.
- Debe confirmarse si `reservas` es tabla productiva o nombre de dominio/ruta, porque la implementación observable se concentra en `reservas_zonas` y `recursos_comunes`.

### Paquetería

- `src/modules/paqueteria/services/paquetesService.js` usa `apartamentos`, `torres`, `notificaciones`, `residentes`, `usuarios_app` y `paquetes`.
- Páginas `CrearPaquete`, `MisPaquetes` y `PanelPaquetes` dependen de este servicio.

### Seguridad/incidentes

- `src/modules/seguridad/services/seguridadService.js` usa `usuarios_app`, `incidentes` y `notificaciones`.
- `src/modules/seguridad/pages/ListaIncidentes.jsx` consulta `incidentes` filtrando por `conjunto_id` del usuario.

### Hooks y utils

- `src/hooks/useRealtimeConjuntoChannel.js` debe revisarse junto a cada módulo que lo use para asegurar filtros por `conjunto_id`.
- `src/utils/firebasePush.js` y `src/utils/push.js` están relacionados con notificaciones/push; validar que los tokens o payloads no expongan datos de otros conjuntos.

## 12. Hallazgos confirmados vs pendientes

### Confirmados en repo

- El frontend consulta directamente `usuarios_app` para bootstrap de sesión.
- `roles` tiene evidencia de repositorio/documentación/migraciones como catálogo o base de permisos, pero no evidencia de consumo frontend directo confirmado.
- Visitas depende de RPC críticas y de `registro_visitas`.
- Pagos depende de `pagos`, `pagos_eventos`, `config_pagos` y storage `comprobantes`.
- Reservas depende de `recursos_comunes`, `reservas_zonas`, `reservas_bloqueos`, `reservas_eventos` y `reservas_documentos`.
- Paquetería depende de `paquetes`, `residentes`, `apartamentos`, `torres`, `usuarios_app` y `notificaciones`.
- Incidentes depende de `incidentes`, `usuarios_app` y `notificaciones`.
- No se encontró consumo frontend directo de `roles`, `accesos`, `trasteos`, `zonas_comunes`, `archivos`, `pqr` o `comunicados`.

### Pendientes por confirmar en PRD/QA

- Policies efectivas actuales por tabla.
- Grants efectivos actuales por rol `anon`/`authenticated`.
- Si `vehiculos` y `trasteos` no tienen policies en PRD.
- Si `roles` sigue siendo catálogo activo de base de datos o si el rol operativo vigente vive únicamente en `usuarios_app`.
- Funciones `SECURITY DEFINER` ejecutables por roles públicos.
- Funciones sin `search_path` fijo.
- Si `reservas` y `reservas_zonas` coexisten con datos productivos o si una es legado.
- Si `accesos` conserva datos productivos históricos aunque no haya consumo frontend.
- Estado real de Auth leaked password protection en Supabase dashboard.

## 13. Siguiente acción recomendada

La siguiente subfase segura es **POST-PROD 2B: captura de evidencia readonly en PRD/QA**. Ejecutar el script de auditoría, adjuntar salidas a un issue/PR de análisis y recién después diseñar cambios mínimos por módulo. No ejecutar cambios de hardening hasta tener evidencia exportada y validada con el checklist funcional por rol.
