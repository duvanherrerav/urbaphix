-- Solución definitiva para lectura de tipos_documento y panel vigilancia
-- Ejecutar en Supabase SQL Editor como role postgres.

begin;

-- 1) TIPOS_DOCUMENTO: permitir lectura a cualquier usuario autenticado
alter table public.tipos_documento enable row level security;

drop policy if exists "tipos_documento_select_authenticated" on public.tipos_documento;
create policy "tipos_documento_select_authenticated"
on public.tipos_documento
for select
to authenticated
using (true);

-- 2) RESIDENTES: lectura restringida al mismo conjunto del usuario autenticado
alter table public.residentes enable row level security;

drop policy if exists "residentes_select_same_conjunto" on public.residentes;
create policy "residentes_select_same_conjunto"
on public.residentes
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.conjunto_id = residentes.conjunto_id
  )
);

-- 3) VISITANTES: lectura por mismo conjunto (directo o vía residente)
alter table public.visitantes enable row level security;

drop policy if exists "visitantes_select_same_conjunto" on public.visitantes;
create policy "visitantes_select_same_conjunto"
on public.visitantes
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.conjunto_id = visitantes.conjunto_id
  )
  or exists (
    select 1
    from public.residentes r
    join public.usuarios_app ua on ua.id = auth.uid()
    where r.id = visitantes.residente_id
      and ua.conjunto_id = r.conjunto_id
  )
);

-- 4) REGISTRO_VISITAS: lectura por mismo conjunto del usuario
-- fallback: por vínculo visitante -> residente -> conjunto
alter table public.registro_visitas enable row level security;

drop policy if exists "registro_visitas_select_same_conjunto" on public.registro_visitas;
create policy "registro_visitas_select_same_conjunto"
on public.registro_visitas
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.conjunto_id = registro_visitas.conjunto_id
  )
  or exists (
    select 1
    from public.visitantes v
    join public.residentes r on r.id = v.residente_id
    join public.usuarios_app ua on ua.id = auth.uid()
    where v.id = registro_visitas.visitante_id
      and ua.conjunto_id = r.conjunto_id
  )
);

commit;
