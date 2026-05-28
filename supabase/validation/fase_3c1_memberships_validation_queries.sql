-- FASE 3C.1 - Consultas de validación DEV/QA (ejecución manual)

-- 1) platform_memberships respeta RLS
select * from public.platform_memberships;

-- 2) tenant_memberships respeta RLS
select * from public.tenant_memberships;

-- 3) Usuario sin membership activa no accede tenant
select public.fn_has_tenant_access('00000000-0000-0000-0000-000000000000'::uuid) as has_tenant_access;

-- 4) Usuario conjunto A no accede conjunto B (validar con sesión de prueba)
select count(*)
from public.tenant_memberships
where conjunto_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

-- 5) superadmin consulta global
select public.fn_is_platform_superadmin() as is_superadmin;

-- 6) No delete duro
-- Prueba documental no ejecutable automáticamente:
-- Intentar DELETE manual en una sesión de prueba con un UUID existente
-- y confirmar denegación por RLS.
-- delete from public.platform_memberships where id = '<uuid_existente>'::uuid;
-- delete from public.tenant_memberships where id = '<uuid_existente>'::uuid;

-- 7) No duplicados activos
select user_id, conjunto_id, count(*)
from public.tenant_memberships
where status = 'active'
group by 1,2
having count(*) > 1;

-- 8) Conteo usuarios_app vs tenant_memberships backfill
select
  (select count(*) from public.usuarios_app where id is not null and conjunto_id is not null) as usuarios_app_count,
  (select count(*) from public.tenant_memberships where source_legacy = 'usuarios_app') as tenant_memberships_from_legacy;

-- 9) Helpers nuevos
select public.fn_has_platform_role('platform_ops') as has_platform_ops;
select public.fn_has_tenant_role('00000000-0000-0000-0000-000000000000'::uuid, 'admin_conjunto') as has_admin_conjunto_role;

-- 10) Compatibilidad login actual
-- Esta validación es documental: login sigue atado a usuarios_app porque no se tocó frontend.
