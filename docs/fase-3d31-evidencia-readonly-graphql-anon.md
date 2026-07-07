# FASE 3D.31 — Evidencia read-only GraphQL exposure anon en DEV

## 1. Propósito

FASE 3D.31 registra evidencia **read-only** tomada en DEV sobre warnings de Supabase Advisor relacionados con exposición GraphQL para el rol `anon`.

El objetivo de esta fase es documentar el estado observado sin ejecutar hardening funcional. La evidencia permite separar dos riesgos distintos:

1. **Exposición de metadata/introspection**: GraphQL puede listar o introspectar tablas del esquema `public` porque existen grants heredados para `anon`.
2. **Fuga real de filas**: el rol `anon` puede leer datos concretos de una tabla.

La evidencia DEV tomada indica que no se observó fuga de filas en las consultas read-only con rol `anon`, porque todas devolvieron `0` filas visibles. Sin embargo, ese resultado no convierte automáticamente todas las tablas en metadata-only: cuando existen grants anon heredados y policies `SELECT` amplias, la superficie sigue siendo row-exposing si existen datos.

## 2. Alcance

Esta fase cubre únicamente documentación de evidencia DEV para tablas revisadas con:

- `SELECT` grant heredado para `anon`.
- RLS activo.
- Prueba read-only con rol `anon` devolviendo `0` filas visibles.
- Dictamen documental sobre riesgo GraphQL anon.

## 3. Fuera de alcance

En FASE 3D.31 explícitamente **no se ejecutan cambios funcionales**:

- No se revocan grants.
- No se modifican policies RLS.
- No se crea migración SQL.
- No se cambia frontend.
- No se ejecuta acción Vercel.
- No se altera producción desde frontend ni desde SQL.

Cualquier hardening real de grants `anon` debe hacerse en una fase posterior, con PR separado, validación por módulo y pruebas de regresión.

## 4. Fuentes y alineación

La interpretación de esta evidencia se mantiene alineada con:

- `docs/database-schema.md` como fuente de verdad funcional del esquema, RLS y relaciones.
- `docs/fase-3d30-clasificacion-graphql-exposure.md` como clasificación previa de warnings GraphQL.
- Arquitectura FASE 3A Superadmin y modelo multi tenant.
- Periodo híbrido `tenant_memberships` + `usuarios_app` legacy.

Esta fase no inventa tablas, columnas ni relaciones. Solo registra el resultado read-only informado para las tablas enumeradas.

## 5. Evidencia DEV resumida

Evidencia tomada en DEV:

1. Varias tablas conservan `SELECT` grant para `anon` por grants heredados.
2. Todas las tablas revisadas tienen RLS activo.
3. La prueba read-only con rol `anon` arrojó `0` filas visibles en todas las tablas revisadas.
4. El resultado indica que no se observó fuga de filas anon en DEV, pero no cierra el riesgo de superficie cuando existen grants heredados y policies `SELECT` amplias o `USING true`.

## 6. Matriz de evidencia read-only anon

| Tabla | anon SELECT grant | RLS activo | Filas visibles anon | Dictamen |
| --- | --- | --- | ---: | --- |
| `accesos` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `apartamentos` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `archivos` | Sí, heredado | Sí | 0 | **Row-exposing risk / P1 documental**: sin fuga de filas anon observada en DEV, pero la combinación de grant anon heredado y policy SELECT amplia mantiene riesgo real si existen datos. |
| `comunicados` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `config_pagos` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `conjuntos` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `incidentes` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `multas` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `notificaciones` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `pagos` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `pagos_eventos` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `paquetes` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `parqueaderos` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `platform_memberships` | Sí, heredado | Sí | 0 | Metadata/introspection exposure en tabla platform sensible; sin fuga de filas anon observada en DEV. |
| `pqr` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `recursos_comunes` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `registro_visitas` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `reservas` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `reservas_bloqueos` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `reservas_documentos` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `reservas_eventos` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `reservas_zonas` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `residentes` | Sí, heredado | Sí | 0 | Metadata/introspection exposure en tabla PII; sin fuga de filas anon observada en DEV. |
| `roles` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `tenant_memberships` | Sí, heredado | Sí | 0 | Metadata/introspection exposure en tabla tenant sensible; sin fuga de filas anon observada en DEV. |
| `tipos_documento` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `torres` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |
| `usuarios_app` | Sí, heredado | Sí | 0 | **Row-exposing risk / P1 documental**: sin fuga de filas anon observada en DEV, pero la combinación de grant anon heredado y policy SELECT amplia mantiene riesgo real si existen datos. |
| `visitantes` | Sí, heredado | Sí | 0 | Metadata/introspection exposure en tabla PII/visitas; sin fuga de filas anon observada en DEV. |
| `zonas_comunes` | Sí, heredado | Sí | 0 | Metadata/introspection exposure; sin fuga de filas anon observada en DEV. |

## 7. Separación de riesgos

### 7.1 Riesgo de metadata/introspection

El riesgo confirmado por la evidencia es que el rol `anon` conserva superficie GraphQL sobre tablas del esquema `public` debido a grants heredados. Aunque RLS impida devolver filas en una prueba puntual, GraphQL/Supabase Advisor puede seguir reportando exposición porque la tabla es visible a nivel de permisos.

Este riesgo importa porque puede revelar nombres de tablas, estructura consultable o superficie API que no debería presentarse a clientes anónimos, especialmente en tablas sensibles como `residentes`, `visitantes`, `tenant_memberships`, `platform_memberships`, pagos y visitas.

### 7.2 Riesgo row-exposing por grants + policies amplias

`anon_visible_rows = 0` **no equivale a cierre de riesgo** cuando una tabla conserva grant `SELECT` para `anon` y además tiene una policy amplia, por ejemplo `SELECT` permisivo o `USING true`. En ese escenario, la prueba DEV puede devolver cero filas por ausencia de datos visibles en ese momento, por dataset incompleto o por condiciones operativas temporales, pero la superficie sigue siendo row-exposing si posteriormente existen datos que satisfacen la policy.

Por este motivo, `archivos` y `usuarios_app` se clasifican como **row-exposing risk / P1 documental** aunque `anon_visible_rows = 0` en DEV. La evidencia observada sigue siendo cero filas, pero el riesgo de superficie es real mientras permanezcan grants anon heredados y policies SELECT amplias.

### 7.3 Riesgo de fuga real de filas

La evidencia DEV revisada no mostró fuga real de filas para `anon` en las tablas de la matriz. En todos los casos se observó `anon_visible_rows = 0` con RLS activo.

Ese resultado debe interpretarse estrictamente como evidencia observada en DEV, no como garantía de que todas las superficies sean metadata-only. Para tablas con grants anon heredados y policies SELECT amplias, especialmente `archivos` y `usuarios_app`, el riesgo de exposición de filas sigue abierto si existen datos.

Por tanto, FASE 3D.31 no ejecuta cambios urgentes de policies ni revocaciones masivas en este PR. El hallazgo debe tratarse como deuda de hardening de superficie API y row-exposing risk para tablas con policies amplias, no como incidente confirmado de exposición de datos anon en DEV.

## 8. Consideraciones multi tenant y Superadmin

Cualquier fase posterior debe conservar las garantías del modelo multi tenant:

- Respetar `conjunto_id` en tablas tenant scoped.
- Respetar `residente_id` en datos propios de residentes.
- Respetar `auth.uid()` en identidad y ownership.
- Considerar `fn_auth_conjunto_id()`, `fn_auth_rol()` y `fn_auth_residente_id()` como funciones auxiliares de evaluación RLS.
- No romper el periodo híbrido `tenant_memberships` + `usuarios_app`.
- No exponer ni degradar acceso de `platform_memberships`, ya que soporta capacidades platform/Superadmin.

## 9. Siguiente fase propuesta

Abrir una fase posterior separada, por ejemplo **FASE 3D.32 — Hardening anon por grants GraphQL**, con PR independiente y alcance controlado:

1. Confirmar consumo frontend/API por tabla antes de tocar grants.
2. Priorizar tablas sensibles sin consumo público explícito.
3. Evaluar `REVOKE SELECT FROM anon` tabla por tabla, no por lote.
4. Mantener RLS como frontera principal y usar grants para reducir superficie anónima.
5. Ejecutar pruebas de regresión por roles: anon, residente, vigilancia, admin_conjunto, contador y Superadmin/platform.
6. Documentar cada cambio en `docs/database-schema.md` si se modifican grants, policies, tablas o estructura.
7. Crear migración SQL únicamente en esa fase posterior, no en FASE 3D.31.

## 10. Dictamen de cierre FASE 3D.31

FASE 3D.31 queda como evidencia read-only documental:

- Hay grants `SELECT` heredados para `anon` en las tablas revisadas.
- RLS está activo en todas las tablas revisadas.
- `anon_visible_rows = 0` en todas las tablas revisadas.
- No se observó fuga de filas anon en DEV para la matriz documentada.
- Sí permanece deuda de hardening por metadata/introspection GraphQL anon.
- `archivos` y `usuarios_app` permanecen como row-exposing risk / P1 documental por grants anon heredados y policies SELECT amplias, aunque DEV haya devuelto cero filas.
- No se realizan cambios SQL, RLS, frontend ni Vercel en esta fase.
