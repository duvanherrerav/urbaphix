-- =====================================================
-- NORMALIZAR ROL OFICIAL DE VIGILANCIA
--
-- Contexto:
--   - El rol canónico para el panel operativo es public.roles.id = 'vigilancia'.
--   - 'vigilante' fue un valor legacy/incorrecto observado como drift de seed/ambiente.
--
-- Seguridad operativa:
--   - Migración revisable: no debe aplicarse a Supabase remoto sin validación previa.
--   - No modifica políticas RLS ni permisos.
--   - No elimina el rol legacy mientras exista alguna referencia en usuarios_app.
-- =====================================================

begin;

-- Consulta preventiva recomendada antes de aplicar en cada ambiente:
-- select id, nombre from public.roles where id in ('vigilancia', 'vigilante') order by id;
-- select id, email, rol_id from public.usuarios_app where rol_id in ('vigilancia', 'vigilante') order by created_at, id;

-- Asegura que el rol canónico exista con el nombre operativo esperado.
insert into public.roles (id, nombre)
values ('vigilancia', 'Vigilancia')
on conflict (id) do update
set nombre = excluded.nombre;

-- Migra usuarios que todavía tengan el valor legacy/incorrecto.
update public.usuarios_app
set rol_id = 'vigilancia'
where rol_id = 'vigilante';

-- Elimina el catálogo legacy solo si quedó sin referencias.
delete from public.roles
where id = 'vigilante'
  and not exists (
    select 1
    from public.usuarios_app
    where rol_id = 'vigilante'
  );

commit;
