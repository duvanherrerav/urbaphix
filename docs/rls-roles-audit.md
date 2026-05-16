# Auditoría RLS y estrategia de roles: dev vs qa

## Alcance y fuentes revisadas

Este documento es una propuesta técnica versionada. No ejecuta migraciones, no modifica Supabase remoto y no cambia código frontend.

Fuentes locales revisadas:

- `docs/database-schema.md`
- `supabase/migrations/20260410031821_remote_schema.sql`
- `supabase/migrations/20260509071639_hardening_reservas_multitenant.sql`
- `supabase/migrations/20260509080352_hardening_core_estructura.sql`
- `supabase/migrations/20260509064414_hardening_rls_qa.sql`
- `src/services/supabaseClient.js`

Referencia externa consultada: documentación oficial de Supabase sobre Row Level Security. Supabase recomienda usar RLS para controlar acceso por fila y políticas basadas en contexto de autenticación como `auth.uid()`.

## Resumen ejecutivo

Existe drift de autorización entre `urbaphix-dev` y `urbaphix-qa` en tablas maestras de estructura (`conjuntos`, `torres`, `apartamentos`) y en el valor textual usado para identificar administradores.

El problema central no es solo el nombre `admin` vs `administrador`; el problema arquitectónico es que las políticas dependen de strings de rol mientras los helpers retornan `usuarios_app.rol_id`. Por lo tanto, el valor oficial debe ser único, documentado y respaldado por el catálogo `public.roles`.

Recomendación principal:

1. Mantener `usuarios_app.rol_id` como texto estable y FK lógica/documentada hacia `roles.id`.
2. Estandarizar el rol administrador como `admin`, porque es el valor ya usado mayoritariamente por migraciones versionadas y por `docs/database-schema.md`.
3. Alinear `torres` y `apartamentos` para que usen helpers canónicos `fn_auth_rol()` y `fn_auth_conjunto_id()` o, si se mantiene compatibilidad temporal, que `get_user_role()` sea solo alias documentado.
4. Activar RLS en `conjuntos` solo junto con una política segura de lectura por tenant; activar RLS sin políticas puede romper el frontend porque las consultas autenticadas quedarían filtradas a cero filas.
5. No activar ni endurecer `roles` sin validar primero todos los flujos frontend que leen el catálogo de roles.

## Estado actual esperado por ambiente

| Tabla | `urbaphix-dev` | `urbaphix-qa` | Riesgo |
| --- | --- | --- | --- |
| `public.conjuntos` | RLS desactivado | RLS activado con política `conjuntos mismo tenant` | Dev permite lectura/escritura más amplia que QA si los grants lo permiten. QA puede romper pantallas si el usuario no tiene `usuarios_app.conjunto_id`. |
| `public.roles` | RLS desactivado | RLS desactivado | Catálogo visible según grants; riesgo pendiente porque roles es tabla sensible para autorización indirecta. |
| `public.torres` | RLS activo; escrituras admin comparan contra `admin` | RLS activo; escrituras admin comparan contra `administrador` | Drift funcional: el mismo usuario puede escribir en un ambiente y fallar en otro. |
| `public.apartamentos` | RLS activo; escrituras admin comparan contra `admin` | RLS activo; escrituras admin comparan contra `administrador` | Drift funcional en creación/edición de unidades. |

## Hallazgos en migraciones locales

### Helpers de autenticación

La migración base define helpers canónicos:

- `fn_auth_conjunto_id()` retorna `usuarios_app.conjunto_id` para `auth.uid()`.
- `fn_auth_rol()` retorna `usuarios_app.rol_id` para `auth.uid()`.
- `fn_auth_residente_id()` retorna `residentes.id` para `auth.uid()`.

La migración de hardening de reservas agrega helpers equivalentes:

- `get_user_conjunto_id()` retorna `usuarios_app.conjunto_id`.
- `get_user_role()` retorna `usuarios_app.rol_id`.

Esto duplica vocabulario técnico. La recomendación es usar `fn_auth_*` como API canónica en nuevas políticas y conservar `get_user_*` solo por compatibilidad hasta una refactorización posterior.

### Roles detectados

`docs/database-schema.md` lista como patrones detectados:

- `admin`
- `vigilancia`
- `residente`
- `authenticated`
- `public`

No hay una definición versionada local que establezca `administrador` como rol oficial. El uso de `administrador` observado en QA debe tratarse como drift a corregir, no como nuevo estándar.

El rol operativo de vigilancia sí debe quedar estandarizado como `vigilancia`. El valor `vigilante` fue detectado como drift histórico/legacy en seeds/ambientes y no debe aceptarse como rol válido para RBAC/RLS.

### Estructura de `roles`

La tabla `public.roles` tiene:

- `id text not null`
- `nombre text not null`

La relación documentada es `usuarios_app.rol_id` → `roles.id`. Por lo tanto, usar UUID para roles requeriría migración de datos y modificación de referencias, con mayor riesgo que estandarizar los IDs textuales actuales.

## Diagnóstico de drift

El drift se origina por tres inconsistencias:

1. **RLS de `conjuntos` no alineado:** dev no tiene RLS activo y QA sí. Esto significa que el frontend puede depender involuntariamente de lecturas amplias en dev que fallan en QA.
2. **Rol administrador no unificado:** dev usa `admin`; QA usa `administrador` en políticas de `torres` y `apartamentos`. Como los helpers retornan `usuarios_app.rol_id`, cualquier usuario con `rol_id = 'admin'` fallará contra políticas que esperan `'administrador'`.
3. **Rol vigilancia no unificado en seeds:** el frontend/RBAC y las políticas usan `vigilancia`, pero el seed local creaba `vigilante`. Ese valor legacy provoca que usuarios de portería no pasen las validaciones basadas en `fn_auth_rol() = 'vigilancia'`.
4. **Helpers duplicados:** `fn_auth_*` y `get_user_*` retornan la misma información, pero mezclar ambos aumenta la probabilidad de políticas divergentes.

## Modelo oficial recomendado para roles

### Decisión recomendada

Usar `rol_id` textual estable, no UUID, para esta fase.

Razones:

- La tabla `roles` ya usa `id text`.
- `usuarios_app.rol_id` ya es el valor retornado por `fn_auth_rol()` y `get_user_role()`.
- Las migraciones y documentación locales ya usan `admin`, `vigilancia` y `residente`.
- Migrar a UUID requeriría cambiar datos existentes, FKs, seeds, formularios, validaciones y políticas. Ese cambio debe ser un proyecto separado.

### Valores oficiales propuestos

| `roles.id` oficial | Uso |
| --- | --- |
| `admin` | Administración del conjunto; escritura de tablas maestras del tenant. |
| `residente` | Usuario residente; lectura/acciones acotadas a su `residente_id` y/o `conjunto_id`. |
| `vigilancia` | Operación de accesos, paquetes, visitas e incidentes según políticas existentes. |

`administrador` debe quedar como alias histórico no recomendado. Si existen filas con `usuarios_app.rol_id = 'administrador'`, deben normalizarse a `admin` mediante script validado y con respaldo antes de endurecer políticas.

`vigilante` debe quedar como valor legacy/incorrecto, no como alias funcional. Si existen filas con `usuarios_app.rol_id = 'vigilante'` o un registro `roles.id = 'vigilante'`, deben normalizarse a `vigilancia`; el catálogo legacy puede eliminarse solo cuando no esté referenciado.

## Políticas RLS recomendadas

> Nota: las políticas siguientes son propuesta documentada. No deben ejecutarse automáticamente sin validación en dev y QA.

### `public.conjuntos`

Objetivo: cada usuario autenticado solo puede leer su conjunto. Las escrituras de conjuntos no deben hacerse desde el frontend normal.

Política recomendada:

- `SELECT`: `id = fn_auth_conjunto_id()`.
- `INSERT/UPDATE/DELETE`: no exponer a roles frontend; usar `service_role` o proceso administrativo backend controlado.

### `public.roles`

Objetivo: catálogo legible por usuarios autenticados si el frontend lo necesita, sin escrituras desde cliente.

Política recomendada si se activa RLS:

- `SELECT TO authenticated`: `true`.
- Sin políticas de `INSERT/UPDATE/DELETE` para `anon`/`authenticated`.
- Mantener administración de catálogo mediante migraciones o consola protegida.

Advertencia: activar RLS en `roles` sin `SELECT` explícito puede romper pantallas de administración/registro que carguen el catálogo.

### `public.torres`

Objetivo: lectura por tenant; escritura solo por admin del mismo tenant.

Políticas recomendadas:

- `SELECT TO authenticated`: `conjunto_id = fn_auth_conjunto_id()`.
- `INSERT/UPDATE/DELETE TO authenticated`: `fn_auth_rol() = 'admin' and conjunto_id = fn_auth_conjunto_id()` con `WITH CHECK` equivalente para escrituras.

### `public.apartamentos`

Objetivo: lectura por tenant; escritura solo por admin del mismo tenant.

Políticas recomendadas:

- `SELECT TO authenticated`: `conjunto_id = fn_auth_conjunto_id()`.
- `INSERT/UPDATE/DELETE TO authenticated`: `fn_auth_rol() = 'admin' and conjunto_id = fn_auth_conjunto_id()` con `WITH CHECK` equivalente para escrituras.

## Migración SQL propuesta, no ejecutable automáticamente

La siguiente migración debe aplicarse primero en dev, después en QA, y solo después de validar datos y frontend. Se documenta aquí para revisión; no se agrega como archivo en `supabase/migrations/` en este PR.

```sql
-- PROPUESTA DOCUMENTADA: NO EJECUTAR SIN VALIDACIÓN PREVIA
-- Objetivo: alinear RLS y roles entre urbaphix-dev y urbaphix-qa.

begin;

-- 1) Validación preventiva: debe devolver cero filas antes de endurecer.
-- Si devuelve filas, normalizar datos o ajustar plan antes de continuar.
select id, rol_id
from public.usuarios_app
where rol_id = 'administrador';

-- 2) Helpers canónicos: conservar fn_auth_* como fuente de verdad.
-- No se eliminan get_user_* para evitar romper políticas existentes.

-- 3) Conjuntos: activar RLS solo con política de lectura por tenant.
alter table public.conjuntos enable row level security;

drop policy if exists "conjuntos mismo tenant" on public.conjuntos;
create policy "conjuntos mismo tenant"
on public.conjuntos
for select
to authenticated
using (
  id = public.fn_auth_conjunto_id()
);

-- 4) Roles: si se decide activar RLS, permitir lectura autenticada del catálogo.
-- Evaluar dependencias frontend antes de activar.
alter table public.roles enable row level security;

drop policy if exists "roles_select_authenticated" on public.roles;
create policy "roles_select_authenticated"
on public.roles
for select
to authenticated
using (true);

-- 5) Torres: lectura por tenant, escritura solo admin del mismo tenant.
alter table public.torres enable row level security;

drop policy if exists "torres_select_conjunto" on public.torres;
create policy "torres_select_conjunto"
on public.torres
for select
to authenticated
using (
  conjunto_id = public.fn_auth_conjunto_id()
);

drop policy if exists "torres_admin_write" on public.torres;
create policy "torres_admin_write"
on public.torres
for all
to authenticated
using (
  public.fn_auth_rol() = 'admin'
  and conjunto_id = public.fn_auth_conjunto_id()
)
with check (
  public.fn_auth_rol() = 'admin'
  and conjunto_id = public.fn_auth_conjunto_id()
);

-- 6) Apartamentos: lectura por tenant, escritura solo admin del mismo tenant.
alter table public.apartamentos enable row level security;

drop policy if exists "apartamentos_select_conjunto" on public.apartamentos;
create policy "apartamentos_select_conjunto"
on public.apartamentos
for select
to authenticated
using (
  conjunto_id = public.fn_auth_conjunto_id()
);

drop policy if exists "apartamentos_admin_write" on public.apartamentos;
create policy "apartamentos_admin_write"
on public.apartamentos
for all
to authenticated
using (
  public.fn_auth_rol() = 'admin'
  and conjunto_id = public.fn_auth_conjunto_id()
)
with check (
  public.fn_auth_rol() = 'admin'
  and conjunto_id = public.fn_auth_conjunto_id()
);

commit;
```

## Migración versionada propuesta

Se agregó la migración revisable `supabase/migrations/20260511120000_normalizar_rls_roles_core.sql` para convertir la propuesta documentada en SQL versionado. Debe revisarse y validarse manualmente antes de aplicarla en cualquier ambiente remoto.

También se agregó `supabase/migrations/20260512120000_normalizar_rol_vigilancia.sql` para asegurar `roles.id = 'vigilancia'`, migrar usuarios con `rol_id = 'vigilante'` y eliminar el rol legacy solo si queda sin referencias.

## Riesgos de aplicar la migración

1. **Ruptura por RLS sin políticas suficientes:** si se activa RLS en `conjuntos` o `roles` sin políticas compatibles con el frontend, las consultas pueden dejar de devolver filas.
2. **Usuarios con rol histórico:** si existen usuarios con `rol_id = 'administrador'`, al estandarizar políticas en `admin` perderán permisos hasta normalizar datos. Si existen usuarios con `rol_id = 'vigilante'`, no tendrán acceso operativo hasta migrarlos a `vigilancia`.
3. **Dependencias frontend no inventariadas:** formularios o pantallas que lean `roles` o `conjuntos` antes de que exista `usuarios_app` pueden fallar.
4. **Policies `FOR ALL`:** aunque simplifican, combinan `SELECT/INSERT/UPDATE/DELETE`. Para producción conviene separar por operación si se requiere auditoría fina.
5. **Grants amplios existentes:** la migración base concede `ALL` sobre tablas a `anon`/`authenticated` en varios casos. RLS mitiga acceso por fila, pero no sustituye una revisión de grants.
6. **Ambientes con datos divergentes:** QA y dev pueden tener catálogos `roles` distintos; validar `select * from roles order by id` antes de aplicar.

## Plan de implementación seguro por fases

### Fase 0: prevalidación sin cambios

Ejecutar consultas read-only en cada ambiente:

```sql
select id, nombre from public.roles order by id;
select rol_id, count(*) from public.usuarios_app group by rol_id order by rol_id;
select id, email, rol_id from public.usuarios_app where rol_id in ('administrador', 'vigilante') order by created_at, id;
select count(*) as usuarios_sin_conjunto from public.usuarios_app where conjunto_id is null;
select count(*) as torres_sin_conjunto from public.torres where conjunto_id is null;
select count(*) as apartamentos_sin_conjunto from public.apartamentos where conjunto_id is null;
```

Criterio para avanzar: no debe haber roles inesperados ni filas críticas sin `conjunto_id`.

### Fase 1: dev

1. Confirmar que `admin`, `residente` y `vigilancia` existen en `public.roles`.
2. Normalizar datos de prueba si aparece `administrador` o `vigilante`.
3. Aplicar la migración propuesta en dev.
4. Validar pantallas de estructura: carga de conjunto, torres y apartamentos; creación/edición por admin; lectura por residente/vigilancia si aplica.
5. Validar que usuarios de un conjunto no vean datos de otro conjunto.

### Fase 2: qa

1. Repetir prevalidación read-only.
2. Aplicar la misma migración ya validada en dev.
3. Verificar específicamente que políticas de `torres` y `apartamentos` ya no usen `administrador`.
4. Ejecutar smoke test del flujo de administración.
5. Comparar resultados con dev.

### Fase 3: main / producción

1. Abrir ventana de cambio y respaldo.
2. Ejecutar prevalidación read-only y comparar con dev/QA.
3. Aplicar migración aprobada.
4. Monitorear errores `permission denied`, respuestas vacías inesperadas y violaciones RLS.
5. Documentar estado final en `docs/database-schema.md` si la migración se convierte en cambio ejecutable.

## Criterios de cierre de arquitectura

- `admin` queda como único identificador oficial para administración.
- `administrador` queda eliminado de políticas y datos activos, o documentado temporalmente como deuda con fecha de remoción.
- `fn_auth_rol()` y `fn_auth_conjunto_id()` quedan como helpers canónicos en nuevas políticas.
- `conjuntos`, `torres` y `apartamentos` quedan alineadas entre dev y QA.
- `roles` tiene decisión explícita: RLS apagado temporalmente con riesgo aceptado, o RLS activo con `SELECT` autenticado y sin escrituras desde frontend.
