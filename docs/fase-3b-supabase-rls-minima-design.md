# FASE 3B — Diseño detallado de estructura base Supabase y RLS mínima

## 1) Resumen ejecutivo

Este documento propone el diseño técnico de FASE 3B para separar autorización de **plataforma** y autorización de **tenant**, sin aplicar cambios ejecutables todavía. El objetivo es preparar una implementación segura y sin corte para introducir:

- `platform_memberships`;
- `tenant_memberships`;
- helpers RLS mínimos canónicos;
- compatibilidad temporal con `usuarios_app`;
- plan de migración reversible;
- pruebas SQL de aislamiento multi-tenant.

**Estado de esta fase:** exclusivamente documental. No crea migraciones nuevas ni modifica RLS activa.

---

## 2) Relación con FASE 3A

FASE 3A definió el principio arquitectónico: `superadmin` es rol de plataforma, no rol interno del conjunto. FASE 3B aterriza ese principio en un diseño de datos + helpers + políticas base + plan de transición para ejecución posterior controlada en DEV/QA.

- FASE 3A: dirección estratégica.
- FASE 3B: especificación técnica de implementación futura.
- FASE 3C (futuro): ejecución controlada y validación por ambiente.

---

## 3) Inventario del modelo actual

### 3.1 Autenticación y consumo frontend

- La sesión se obtiene con `supabase.auth.getUser()` y `onAuthStateChange`; luego se carga perfil desde `usuarios_app`. 
- El frontend actual toma decisiones funcionales por `usuarioApp.rol_id` con catálogo UI `admin|vigilancia|residente`.
- Login también consulta `usuarios_app.rol_id` para UX posterior al acceso.

### 3.2 Fuente de rol/tenant actual

- La tabla `usuarios_app` es el pivote actual de autorización (rol + `conjunto_id` por usuario).
- La tabla `roles` mantiene catálogo textual y ya existe deuda histórica entre valores legacy (`administrador`, `vigilante`) y canónicos (`admin`, `vigilancia`).

### 3.3 Helpers existentes

Detectados helpers canónicos actuales:

- `fn_auth_conjunto_id()` → retorna `usuarios_app.conjunto_id` por `auth.uid()`.
- `fn_auth_rol()` → retorna `usuarios_app.rol_id` por `auth.uid()`.
- `fn_auth_residente_id()` → retorna `residentes.id` por `auth.uid()`.

Detectados helpers legacy compatibles:

- `get_user_conjunto_id()`;
- `get_user_role()`;
- `get_user_residente_id()`;
- `is_admin()/is_vigilancia()/is_residente()`.

### 3.4 RLS actual relacionada

- Existe combinación de políticas con helpers canónicos (`fn_auth_*`) y políticas antiguas que consultan `usuarios_app` inline.
- Existen tablas/segmentos históricos con lectura amplia (`USING true`) que deben endurecerse antes de ampliar alcance global.
- Se observa coexistencia de múltiples estilos de políticas (canónicas y no canónicas), aumentando riesgo de drift.

### 3.5 Dependencias críticas de frontend sobre identidad actual

- `src/App.jsx` depende de `usuarios_app` y del valor textual `rol_id` para routing lógico de módulos.
- `src/modules/auth/Login.jsx` depende de `usuarios_app.rol_id` para mensajería de acceso.
- `src/services/supabaseClient.js` no contiene lógica RBAC, solo cliente; por tanto la seguridad real depende de RLS.

---

## 4) Modelo objetivo propuesto

Separar membresías por ámbito:

1. **Plataforma (global):** `platform_memberships`
2. **Tenant (por conjunto):** `tenant_memberships`

Principios:

- Un usuario puede tener múltiples memberships de tenant (varios conjuntos).
- Un usuario puede tener cero o más memberships de plataforma.
- La autorización se evalúa por membership activa + rol canónico + alcance.
- `usuarios_app` permanece temporalmente como fuente legacy durante transición.

---

## 5) Catálogo de roles recomendado

### 5.1 Roles de plataforma

- `superadmin`
- `platform_support`
- `platform_auditor`
- `platform_ops`

### 5.2 Roles de tenant

- `admin_conjunto`
- `vigilante`
- `residente`
- `contador`
- `comite`

### 5.3 Convivencia temporal con roles legacy

Mapeo recomendado de transición:

- `admin` (legacy) → `admin_conjunto`
- `vigilancia` (legacy) → `vigilante`
- `residente` (legacy) → `residente`
- `administrador` (legacy histórico) → normalizar a `admin` antes de poblar memberships
- `vigilante` legacy ambiguo previo → normalizar a `vigilancia` (fase legacy), luego mapear a `vigilante` canónico tenant

Regla: mientras frontend siga leyendo `usuarios_app.rol_id`, se mantiene traducción bidireccional documentada (legacy ↔ canónico) en SQL de backfill y validaciones.

---

## 6) Diseño detallado de tablas nuevas (propuesta)

> Nota: definición en pseudocódigo SQL documental; **no aplicar aún**.

### 6.1 `platform_memberships`

```sql
create table public.platform_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_name text not null,
  status text not null default 'active',
  granted_by uuid null references auth.users(id),
  granted_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  constraint platform_memberships_role_chk
    check (role_name in ('superadmin','platform_support','platform_auditor','platform_ops')),
  constraint platform_memberships_status_chk
    check (status in ('active','suspended','revoked'))
);
```

Índices / unicidad sugerida:

```sql
create unique index ux_platform_memberships_user_role_active
  on public.platform_memberships(user_id, role_name)
  where status = 'active';

create index ix_platform_memberships_user_status
  on public.platform_memberships(user_id, status);
```

### 6.2 `tenant_memberships`

```sql
create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conjunto_id uuid not null references public.conjuntos(id) on delete cascade,
  role_name text not null,
  residente_id uuid null references public.residentes(id) on delete set null,
  status text not null default 'active',
  source_legacy text not null default 'usuarios_app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  constraint tenant_memberships_role_chk
    check (role_name in ('admin_conjunto','vigilante','residente','contador','comite')),
  constraint tenant_memberships_status_chk
    check (status in ('active','suspended','revoked'))
);
```

Índices / unicidad sugerida:

```sql
create unique index ux_tenant_memberships_user_conjunto_role_active
  on public.tenant_memberships(user_id, conjunto_id, role_name)
  where status = 'active';

create index ix_tenant_memberships_conjunto_status
  on public.tenant_memberships(conjunto_id, status);

create index ix_tenant_memberships_residente
  on public.tenant_memberships(residente_id)
  where residente_id is not null;
```

Reglas funcionales propuestas:

- `residente_id` obligatorio solo cuando `role_name='residente'` (validable con `CHECK` diferido en implementación).
- Para roles no residentes, `residente_id` debe ser `NULL`.

---

## 7) Diseño de helpers RLS mínimos

> Helpers propuestos para fase de implementación posterior. Mantener `SECURITY DEFINER` solo donde sea estrictamente necesario y con `set search_path` fijo.

### 7.1 `fn_is_platform_superadmin()`

Retorna `true` si existe membership activa con `role_name='superadmin'` para `auth.uid()`.

### 7.2 `fn_has_platform_role(role_name text)`

Retorna `true` si `auth.uid()` tiene role activo en `platform_memberships`.

### 7.3 `fn_has_tenant_access(target_conjunto_id uuid)`

Retorna `true` si `auth.uid()` tiene membership activa en ese `conjunto_id`.

### 7.4 `fn_has_tenant_role(target_conjunto_id uuid, role_name text)`

Retorna `true` si `auth.uid()` tiene role tenant activo específico en ese conjunto.

### 7.5 Compatibilidad con `fn_auth_*`

Estrategia por etapas:

1. **Etapa A:** `fn_auth_*` siguen leyendo `usuarios_app` (estado actual).
2. **Etapa B:** crear funciones `fn_auth_*_v2` que prioricen `tenant_memberships` y fallback a `usuarios_app`.
3. **Etapa C:** migrar políticas a funciones nuevas.
4. **Etapa D:** desactivar fallback legacy cuando validaciones DEV/QA den 100% de cobertura.

---

## 8) Pseudocódigo SQL de políticas base

> Pseudocódigo, no ejecutable en esta fase.

### 8.1 Políticas para `platform_memberships`

- SELECT:
  - permitido a `superadmin`, `platform_auditor`, y al propio usuario (`user_id = auth.uid()`).
- INSERT/UPDATE/DELETE:
  - solo `superadmin`.
  - operaciones destructivas con auditoría obligatoria en `operational_events`.

### 8.2 Políticas para `tenant_memberships`

- SELECT:
  - `superadmin` puede lectura global controlada.
  - usuarios tenant solo ven memberships de su(s) `conjunto_id` activo(s).
- INSERT/UPDATE:
  - `superadmin` o `platform_ops` con restricciones explícitas.
  - opcionalmente `admin_conjunto` solo para altas acotadas en su propio `conjunto_id` (si negocio lo permite).
- DELETE:
  - prohibir delete duro; usar `status='revoked'` + `revoked_at`.

### 8.3 Políticas base para tablas tenant por `conjunto_id`

Patrón mínimo:

```sql
using (
  fn_has_tenant_access(conjunto_id)
  or fn_is_platform_superadmin()
)
```

Para escrituras sensibles:

```sql
with check (
  fn_has_tenant_role(conjunto_id, 'admin_conjunto')
  or fn_has_platform_role('platform_ops')
  or fn_is_platform_superadmin()
)
```

### 8.4 Restricciones operativas para superadmin

- `superadmin` puede leer globalmente datos permitidos.
- `superadmin` **no** debe tener delete/update masivo por defecto en tablas críticas.
- Toda acción excepcional de alto impacto debe canalizarse por función/RPC auditada.

---

## 9) Estrategia de migración sin corte

1. **Preparación en DEV**
   - Crear tablas nuevas + helpers + políticas de las tablas nuevas únicamente.
   - No tocar políticas existentes de negocio en el mismo cambio.

2. **Backfill inicial (idempotente)**
   - Poblar `tenant_memberships` desde `usuarios_app`.
   - Resolver mapping de roles legacy a canónicos.
   - No eliminar ni modificar inmediatamente `usuarios_app`.

3. **Validación de consistencia**
   - Conteos por rol y conjunto: antes/después.
   - Validar nulos críticos (`conjunto_id`, `residente_id` cuando aplica).
   - Validar no duplicados activos.

4. **Fase de sombra (shadow reads)**
   - Ejecutar pruebas SQL con helpers nuevos sin cambiar frontend.
   - Comparar resultados de acceso legacy vs nuevo.

5. **Adopción progresiva**
   - Migrar políticas tabla por tabla hacia helpers nuevos.
   - Mantener fallback controlado.

6. **Rollback**
   - Si falla validación: deshabilitar uso de helpers nuevos en políticas y continuar con modelo legacy.
   - No borrar datos legacy hasta cierre formal de transición.

7. **Promoción por ambientes**
   - DEV → QA (con pruebas repetidas) → PRD.
   - Prohibido aplicar directo en PRD.

---

## 10) Plan de pruebas SQL de aislamiento (obligatorias)

Casos mínimos:

1. `admin_conjunto` de conjunto A no ve filas de conjunto B.
2. `residente` de conjunto A no ve datos de otro residente ni de otro conjunto.
3. `vigilante` solo ve/edita datos operativos permitidos por política.
4. `superadmin` ve listados globales permitidos.
5. `superadmin` no puede ejecutar acciones destructivas no autorizadas.
6. Usuario autenticado sin membership activa no accede a datos tenant.

Estructura sugerida por caso:

- preparar contexto (usuario/token/claims);
- ejecutar `SELECT/INSERT/UPDATE/DELETE` de prueba;
- verificar resultado esperado (`0 rows`, `permission denied`, o acceso permitido);
- registrar evidencia en bitácora SQL de QA.

---

## 11) Riesgos y mitigaciones

1. **Riesgo de login roto** por desacople entre `usuarios_app` y memberships.
   - Mitigación: no cambiar frontend en FASE 3B; mantener `usuarios_app` como fuente activa durante transición.

2. **Mismatch de roles legacy/canónicos** (`admin|administrador`, `vigilancia|vigilante`).
   - Mitigación: scripts de normalización previos + validaciones de conteo por rol.

3. **RLS recursiva** al consultar tablas protegidas desde helpers.
   - Mitigación: diseño de helpers con consultas directas y políticas no recursivas; probar con usuarios reales en DEV/QA.

4. **`SECURITY DEFINER` mal configurada** (search_path mutable o grants excesivos).
   - Mitigación: `set search_path` fijo, revisión de `GRANT EXECUTE`, auditoría de funciones antes de promoción.

5. **Datos huérfanos sin `conjunto_id`/`residente_id`**.
   - Mitigación: reporte previo de calidad de datos + bloqueo de migración si supera umbral acordado.

6. **Migración en ambiente incorrecto**.
   - Mitigación: checklist de ambiente, verificación explícita de proyecto Supabase y pipeline de promoción controlada.

---

## 12) Checklist previo a implementación real

- [ ] Validar y congelar catálogo canónico de roles legacy + nuevos.
- [ ] Confirmar estrategia formal de mapping legacy→canónico.
- [ ] Diseñar migraciones SQL (aún no en esta fase) con orden y rollback.
- [ ] Definir batería de pruebas SQL automatizables para DEV/QA.
- [ ] Definir plan de observabilidad (errores RLS, acceso denegado, eventos administrativos).
- [ ] Revisar funciones `SECURITY DEFINER` y privilegios `EXECUTE`.
- [ ] Acordar ventanas de despliegue y criterios de “go/no-go”.
- [ ] Confirmar que no hay cambios frontend hasta finalizar validación de datos + RLS.

---

## 13) Recomendación final

**Sí implementar FASE 3B en el siguiente PR, pero únicamente como implementación técnica controlada en DEV/QA y por etapas.**

Condiciones para avanzar:

1. migraciones y helpers con rollback explícito;
2. normalización de roles legacy validada;
3. pruebas de aislamiento SQL aprobadas en DEV y QA;
4. cero cambios de frontend hasta cerrar validación de seguridad.

Si alguna condición falla, la recomendación es **no promover** a PRD y mantener operación sobre el modelo legacy hasta corregir desvíos.
