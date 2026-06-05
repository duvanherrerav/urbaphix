-- NO EJECUTAR SIN AUTORIZACION HUMANA
-- DEV ONLY
-- TEMPLATE CONTROLADO
--
-- FASE 3D.7A - Preparación controlada residente DEV
-- Este template contiene escritura controlada para datos de prueba DEV.
-- No usar en QA ni PRD.
-- No pegar evidencia con password, JWT, access token, refresh token, cookies ni llaves.
--
-- Placeholders requeridos:
-- :auth_user_id
-- :resident_email
-- :resident_name
-- :conjunto_id
-- :torre_nombre
-- :apartamento_numero
--
-- Instrucciones:
-- 1. Crear primero el usuario Auth desde Supabase Dashboard DEV.
-- 2. Copiar auth.users.id.
-- 3. Reemplazar todos los valores __...__ de params.
-- 4. Confirmar que conjunto_id sea a80af441-80f9-4a6c-8d3b-b8408c97dbe2.
-- 5. Ejecutar solo con autorización humana explícita.
--
-- Comportamiento esperado:
-- - Reutiliza torre por conjunto_id + nombre si ya existe.
-- - Reutiliza apartamento por conjunto_id + torre + numero si ya existe.
-- - Reutiliza usuarios_app por id = auth_user_id si ya existe.
-- - Reutiliza residentes por usuario_id + conjunto_id si ya existe.
-- - Reutiliza tenant_memberships activa por user_id + conjunto_id si ya existe.
-- - Si existe una membership activa de otro rol para el mismo usuario/conjunto, detener y revisar manualmente
--   porque el índice único activo por usuario/conjunto puede impedir otra membership activa.

begin;

do $$
declare
  v_auth_user_id uuid := '__AUTH_USER_ID__'::uuid;
  v_conjunto_id uuid := '__CONJUNTO_ID__'::uuid;
begin
  if v_conjunto_id <> 'a80af441-80f9-4a6c-8d3b-b8408c97dbe2'::uuid then
    raise exception 'conjunto_id no corresponde al DEV esperado para esta fase.';
  end if;

  if not exists (select 1 from auth.users u where u.id = v_auth_user_id) then
    raise exception 'Auth user DEV no existe. Crear usuario Auth primero desde Dashboard DEV.';
  end if;

  if not exists (select 1 from public.conjuntos c where c.id = v_conjunto_id) then
    raise exception 'conjunto_id DEV no existe. Detener preparación.';
  end if;

  if exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = v_auth_user_id
      and tm.conjunto_id = v_conjunto_id
      and tm.status = 'active'
      and tm.role_name <> 'residente'
  ) then
    raise exception 'Existe membership activa no residente para este usuario/conjunto. Revisar manualmente antes de continuar.';
  end if;

  if exists (
    select 1
    from public.usuarios_app ua
    where ua.id = v_auth_user_id
      and (ua.conjunto_id is distinct from v_conjunto_id or ua.rol_id is distinct from 'residente')
  ) then
    raise exception 'usuarios_app existente no coincide con conjunto DEV y rol residente. Revisar manualmente antes de continuar.';
  end if;
end $$;

with params as (
  select
    '__AUTH_USER_ID__'::uuid as auth_user_id,
    lower('__RESIDENT_EMAIL__')::text as resident_email,
    '__RESIDENT_NAME__'::text as resident_name,
    '__CONJUNTO_ID__'::uuid as conjunto_id,
    '__TORRE_NOMBRE__'::text as torre_nombre,
    '__APARTAMENTO_NUMERO__'::text as apartamento_numero,
    1::integer as torre_pisos,
    1::integer as apartamento_piso,
    'mediano'::text as tipo_apartamento,
    false::boolean as es_propietario
), torre_upsert as (
  insert into public.torres (conjunto_id, nombre, pisos, created_at)
  select conjunto_id, torre_nombre, torre_pisos, now()
  from params
  where not exists (
    select 1
    from public.torres t
    where t.conjunto_id = params.conjunto_id
      and lower(t.nombre) = lower(params.torre_nombre)
  )
  returning id, conjunto_id, nombre
), torre_target as (
  select id, conjunto_id, nombre from torre_upsert
  union all
  select t.id, t.conjunto_id, t.nombre
  from public.torres t
  join params v on v.conjunto_id = t.conjunto_id
  where lower(t.nombre) = lower(v.torre_nombre)
  limit 1
), apartamento_upsert as (
  insert into public.apartamentos (torre_id, conjunto_id, numero, piso, created_at, tipo_apartamento)
  select tt.id, v.conjunto_id, v.apartamento_numero, v.apartamento_piso, now(), v.tipo_apartamento
  from params v
  join torre_target tt on tt.conjunto_id = v.conjunto_id
  where not exists (
    select 1
    from public.apartamentos a
    where a.conjunto_id = v.conjunto_id
      and a.torre_id = tt.id
      and a.numero = v.apartamento_numero
  )
  returning id, conjunto_id, torre_id, numero
), apartamento_target as (
  select id, conjunto_id, torre_id, numero from apartamento_upsert
  union all
  select a.id, a.conjunto_id, a.torre_id, a.numero
  from public.apartamentos a
  join params v on v.conjunto_id = a.conjunto_id
  join torre_target tt on tt.id = a.torre_id
  where a.numero = v.apartamento_numero
  limit 1
), usuario_app_upsert as (
  insert into public.usuarios_app (id, conjunto_id, rol_id, nombre, email, activo, created_at)
  select auth_user_id, conjunto_id, 'residente', resident_name, resident_email, true, now()
  from params
  on conflict (id) do update
    set conjunto_id = excluded.conjunto_id,
        rol_id = 'residente',
        nombre = coalesce(public.usuarios_app.nombre, excluded.nombre),
        email = coalesce(public.usuarios_app.email, excluded.email),
        activo = true
  returning id, conjunto_id, rol_id, nombre, email, activo
), residente_upsert as (
  insert into public.residentes (usuario_id, conjunto_id, apartamento_id, es_propietario, created_at)
  select v.auth_user_id, v.conjunto_id, at.id, v.es_propietario, now()
  from params v
  join apartamento_target at on at.conjunto_id = v.conjunto_id
  where not exists (
    select 1
    from public.residentes r
    where r.usuario_id = v.auth_user_id
      and r.conjunto_id = v.conjunto_id
  )
  returning id, usuario_id, conjunto_id, apartamento_id, es_propietario
), residente_target as (
  select id, usuario_id, conjunto_id, apartamento_id, es_propietario from residente_upsert
  union all
  select r.id, r.usuario_id, r.conjunto_id, r.apartamento_id, r.es_propietario
  from public.residentes r
  join params v on v.auth_user_id = r.usuario_id and v.conjunto_id = r.conjunto_id
  limit 1
), membership_upsert as (
  insert into public.tenant_memberships (user_id, conjunto_id, role_name, residente_id, status, source_legacy, created_at, updated_at)
  select v.auth_user_id, v.conjunto_id, 'residente', rt.id, 'active', 'usuarios_app', now(), now()
  from params v
  join residente_target rt on rt.usuario_id = v.auth_user_id and rt.conjunto_id = v.conjunto_id
  where not exists (
    select 1
    from public.tenant_memberships tm
    where tm.user_id = v.auth_user_id
      and tm.conjunto_id = v.conjunto_id
      and tm.role_name = 'residente'
      and tm.status = 'active'
  )
  returning id, user_id, conjunto_id, role_name, residente_id, status, source_legacy
), membership_target as (
  select id, user_id, conjunto_id, role_name, residente_id, status, source_legacy from membership_upsert
  union all
  select tm.id, tm.user_id, tm.conjunto_id, tm.role_name, tm.residente_id, tm.status, tm.source_legacy
  from public.tenant_memberships tm
  join params v on v.auth_user_id = tm.user_id and v.conjunto_id = tm.conjunto_id
  where tm.role_name = 'residente'
    and tm.status = 'active'
  limit 1
)
select
  'fase_3d7a_preparacion_residente_dev' as operation,
  ua.id as usuarios_app_id,
  ua.rol_id,
  rt.id as residente_id,
  mt.id as membership_id,
  mt.role_name,
  mt.status,
  mt.residente_id as membership_residente_id,
  at.id as apartamento_id,
  at.numero as apartamento_numero,
  tt.id as torre_id,
  tt.nombre as torre_nombre
from usuario_app_upsert ua
join residente_target rt on rt.usuario_id = ua.id
join membership_target mt on mt.user_id = ua.id and mt.residente_id = rt.id
join apartamento_target at on at.id = rt.apartamento_id
join torre_target tt on tt.id = at.torre_id;

commit;
