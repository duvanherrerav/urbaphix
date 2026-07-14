-- FASE 5.4.2A - Validación DEV ingreso/salida visitas con lifecycle.
-- Ejecutar en DEV con un usuario de pruebas autenticado mediante PostgREST/RPC
-- o adaptando los SET LOCAL request.jwt.claim.sub dentro de esta transacción.
-- La transacción termina en ROLLBACK y no debe persistir datos.

begin;

-- 0) Grants esperados: anon/public sin EXECUTE; authenticated/service_role con EXECUTE.
select
  has_function_privilege('anon', 'public.fn_registrar_ingreso_visita(text,uuid)', 'execute') as anon_ingreso_execute,
  has_function_privilege('PUBLIC', 'public.fn_registrar_ingreso_visita(text,uuid)', 'execute') as public_ingreso_execute,
  has_function_privilege('authenticated', 'public.fn_registrar_ingreso_visita(text,uuid)', 'execute') as authenticated_ingreso_execute,
  has_function_privilege('anon', 'public.fn_registrar_salida_visita(uuid,uuid)', 'execute') as anon_salida_execute,
  has_function_privilege('PUBLIC', 'public.fn_registrar_salida_visita(uuid,uuid)', 'execute') as public_salida_execute,
  has_function_privilege('authenticated', 'public.fn_registrar_salida_visita(uuid,uuid)', 'execute') as authenticated_salida_execute;

-- 1) Fixture mínimo: reemplazar estos UUID por usuarios/tenants DEV reales.
-- select set_config('request.jwt.claim.sub', '<vigilancia_user_id>', true);
-- select set_config('role', 'authenticated', true);
-- Active: ingreso pendiente -> ingresado funciona.
-- select * from public.fn_registrar_ingreso_visita('<qr_pendiente_active>', '<vigilancia_user_id>'::uuid);

-- 2) Suspended: nuevo ingreso falla TENANT_OPERATIONAL_LOCKED sin cambios.
-- update public.tenant_lifecycle set lifecycle_status = 'suspended', operational_lock = false where conjunto_id = '<tenant_id>'::uuid;
-- select * from public.fn_registrar_ingreso_visita('<qr_pendiente_suspended>', '<vigilancia_user_id>'::uuid);
-- select estado, hora_ingreso from public.registro_visitas where qr_code = '<qr_pendiente_suspended>'; -- debe seguir pendiente/null

-- 3) Visita ingresada antes de suspensión: salida funciona y queda salido/hora_salida.
-- select * from public.fn_registrar_salida_visita('<registro_ingresado_suspended>'::uuid, '<vigilancia_user_id>'::uuid);

-- 4) Archived: ingreso falla y salida terminal sigue la matriz del helper y falla.
-- update public.tenant_lifecycle set lifecycle_status = 'archived', operational_lock = false where conjunto_id = '<tenant_id>'::uuid;
-- select * from public.fn_registrar_ingreso_visita('<qr_pendiente_archived>', '<vigilancia_user_id>'::uuid);
-- select * from public.fn_registrar_salida_visita('<registro_ingresado_archived>'::uuid, '<vigilancia_user_id>'::uuid);

-- 5) Cross-tenant y suplantación: ambos deben fallar FORBIDDEN.
-- select * from public.fn_registrar_ingreso_visita('<qr_otro_tenant>', '<vigilancia_user_id>'::uuid);
-- select * from public.fn_registrar_salida_visita('<registro_otro_tenant>'::uuid, '<vigilancia_user_id>'::uuid);
-- select * from public.fn_registrar_ingreso_visita('<qr_mismo_tenant>', '<otro_user_id>'::uuid);

-- 6) Estados/QR: QR inválido/usado falla; salida sobre pendiente falla; repetir salida retorna misma fila sin cambiar hora_salida.
-- select * from public.fn_registrar_ingreso_visita('<qr_invalido_o_usado>', '<vigilancia_user_id>'::uuid);
-- select * from public.fn_registrar_salida_visita('<registro_pendiente>'::uuid, '<vigilancia_user_id>'::uuid);
-- select hora_salida as before_repeat from public.registro_visitas where id = '<registro_salido>'::uuid;
-- select pg_sleep(1);
-- select * from public.fn_registrar_salida_visita('<registro_salido>'::uuid, '<vigilancia_user_id>'::uuid);
-- select hora_salida as after_repeat from public.registro_visitas where id = '<registro_salido>'::uuid;

rollback;
