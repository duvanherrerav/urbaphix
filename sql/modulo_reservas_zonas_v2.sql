-- Urbaphix | Módulo Reservas de Zonas Comunes (v2)
-- Ejecutar en Supabase SQL Editor con rol postgres.
-- Estrategia: crear esquema v2 sin romper tablas legacy (zonas_comunes/reservas/trasteos).

begin;

create extension if not exists btree_gist;

-- =========================================================
-- 1) Catálogo de recursos / zonas comunes
-- =========================================================
create table if not exists public.recursos_comunes (
  id uuid primary key default gen_random_uuid(),
  conjunto_id uuid not null references public.conjuntos(id),
  nombre text not null,
  tipo text not null, -- cancha, salon_social, bbq, gimnasio, logistica, enseres, etc.
  descripcion text null,
  activo boolean not null default true,
  capacidad integer null,
  requiere_aprobacion boolean not null default true,
  requiere_deposito boolean not null default false,
  deposito_valor numeric(12,2) null,
  tiempo_buffer_min integer not null default 0,
  reglas jsonb not null default '{}'::jsonb,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now()
);

create index if not exists idx_recursos_comunes_conjunto on public.recursos_comunes(conjunto_id);
create index if not exists idx_recursos_comunes_tipo on public.recursos_comunes(tipo);

-- =========================================================
-- 2) Reservas unificadas (recreativas + logísticas + enseres)
-- =========================================================
create table if not exists public.reservas_zonas (
  id uuid primary key default gen_random_uuid(),
  conjunto_id uuid not null references public.conjuntos(id),
  recurso_id uuid not null references public.recursos_comunes(id),
  residente_id uuid not null references public.residentes(id),
  apartamento_id uuid null references public.apartamentos(id),
  fecha_inicio timestamp without time zone not null,
  fecha_fin timestamp without time zone not null,
  tipo_reserva text not null default 'recreativa', -- recreativa | logistica | prestamo
  subtipo text null, -- trasteo_entrada, trasteo_salida, material_entrada, escombro_salida, etc.
  estado text not null default 'solicitada', -- solicitada, aprobada, rechazada, cancelada, en_curso, finalizada, no_show
  motivo text null,
  observaciones text null,
  metadata jsonb not null default '{}'::jsonb,
  aprobada_por uuid null references public.usuarios_app(id),
  rechazada_por uuid null references public.usuarios_app(id),
  checkin_por uuid null references public.usuarios_app(id),
  checkout_por uuid null references public.usuarios_app(id),
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  constraint reservas_zonas_fecha_ck check (fecha_fin > fecha_inicio),
  constraint reservas_zonas_estado_ck check (
    estado in ('solicitada','aprobada','rechazada','cancelada','en_curso','finalizada','no_show')
  ),
  constraint reservas_zonas_tipo_ck check (
    tipo_reserva in ('recreativa','logistica','prestamo')
  )
);

create index if not exists idx_reservas_zonas_conjunto on public.reservas_zonas(conjunto_id);
create index if not exists idx_reservas_zonas_recurso on public.reservas_zonas(recurso_id);
create index if not exists idx_reservas_zonas_residente on public.reservas_zonas(residente_id);
create index if not exists idx_reservas_zonas_estado on public.reservas_zonas(estado);
create index if not exists idx_reservas_zonas_rango on public.reservas_zonas(fecha_inicio, fecha_fin);

-- Evitar traslapes en reservas activas para un mismo recurso:
alter table public.reservas_zonas
  add constraint reservas_zonas_no_solape
  exclude using gist (
    recurso_id with =,
    tsrange(fecha_inicio, fecha_fin, '[)') with &&
  )
  where (estado in ('solicitada','aprobada','en_curso'));

-- =========================================================
-- 3) Bitácora / eventos de reserva
-- =========================================================
create table if not exists public.reservas_eventos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas_zonas(id) on delete cascade,
  conjunto_id uuid not null references public.conjuntos(id),
  actor_id uuid null references public.usuarios_app(id),
  accion text not null, -- crear, aprobar, rechazar, checkin, checkout, cancelar, comentario
  detalle text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp without time zone not null default now()
);

create index if not exists idx_reservas_eventos_reserva on public.reservas_eventos(reserva_id);
create index if not exists idx_reservas_eventos_conjunto on public.reservas_eventos(conjunto_id);

-- =========================================================
-- 4) Documentos soporte
-- =========================================================
create table if not exists public.reservas_documentos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas_zonas(id) on delete cascade,
  conjunto_id uuid not null references public.conjuntos(id),
  nombre_archivo text not null,
  ruta_storage text not null,
  tipo_documento text null,
  subido_por uuid null references public.usuarios_app(id),
  created_at timestamp without time zone not null default now()
);

create index if not exists idx_reservas_documentos_reserva on public.reservas_documentos(reserva_id);

-- =========================================================
-- 5) Bloqueos operativos (mantenimiento/eventos internos)
-- =========================================================
create table if not exists public.reservas_bloqueos (
  id uuid primary key default gen_random_uuid(),
  conjunto_id uuid not null references public.conjuntos(id),
  recurso_id uuid not null references public.recursos_comunes(id),
  fecha_inicio timestamp without time zone not null,
  fecha_fin timestamp without time zone not null,
  motivo text not null,
  creado_por uuid null references public.usuarios_app(id),
  created_at timestamp without time zone not null default now(),
  constraint reservas_bloqueos_fecha_ck check (fecha_fin > fecha_inicio)
);

create index if not exists idx_reservas_bloqueos_recurso on public.reservas_bloqueos(recurso_id);

-- =========================================================
-- 6) Trigger updated_at
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_recursos_comunes_updated_at on public.recursos_comunes;
create trigger trg_recursos_comunes_updated_at
before update on public.recursos_comunes
for each row execute function public.set_updated_at();

drop trigger if exists trg_reservas_zonas_updated_at on public.reservas_zonas;
create trigger trg_reservas_zonas_updated_at
before update on public.reservas_zonas
for each row execute function public.set_updated_at();

-- =========================================================
-- 7) Funciones helper de seguridad
-- =========================================================
create or replace function public.fn_auth_conjunto_id()
returns uuid
language sql
stable
as $$
  select ua.conjunto_id
  from public.usuarios_app ua
  where ua.id = auth.uid()
  limit 1
$$;

create or replace function public.fn_auth_rol()
returns text
language sql
stable
as $$
  select ua.rol_id
  from public.usuarios_app ua
  where ua.id = auth.uid()
  limit 1
$$;

create or replace function public.fn_auth_residente_id()
returns uuid
language sql
stable
as $$
  select r.id
  from public.residentes r
  where r.usuario_id = auth.uid()
  limit 1
$$;

-- =========================================================
-- 8) RLS
-- =========================================================
alter table public.recursos_comunes enable row level security;
alter table public.reservas_zonas enable row level security;
alter table public.reservas_eventos enable row level security;
alter table public.reservas_documentos enable row level security;
alter table public.reservas_bloqueos enable row level security;

-- Recursos comunes
drop policy if exists "recursos_select_conjunto" on public.recursos_comunes;
create policy "recursos_select_conjunto"
on public.recursos_comunes
for select
to authenticated
using (conjunto_id = public.fn_auth_conjunto_id());

drop policy if exists "recursos_admin_write" on public.recursos_comunes;
create policy "recursos_admin_write"
on public.recursos_comunes
for all
to authenticated
using (
  conjunto_id = public.fn_auth_conjunto_id()
  and public.fn_auth_rol() = 'admin'
)
with check (
  conjunto_id = public.fn_auth_conjunto_id()
  and public.fn_auth_rol() = 'admin'
);

-- Reservas
drop policy if exists "reservas_select_admin_vigilancia_residente" on public.reservas_zonas;
create policy "reservas_select_admin_vigilancia_residente"
on public.reservas_zonas
for select
to authenticated
using (
  conjunto_id = public.fn_auth_conjunto_id()
  and (
    public.fn_auth_rol() in ('admin','vigilancia')
    or residente_id = public.fn_auth_residente_id()
  )
);

drop policy if exists "reservas_insert_residente_admin" on public.reservas_zonas;
create policy "reservas_insert_residente_admin"
on public.reservas_zonas
for insert
to authenticated
with check (
  conjunto_id = public.fn_auth_conjunto_id()
  and (
    public.fn_auth_rol() = 'admin'
    or (public.fn_auth_rol() = 'residente' and residente_id = public.fn_auth_residente_id())
  )
);

drop policy if exists "reservas_update_admin_vigilancia_residente" on public.reservas_zonas;
create policy "reservas_update_admin_vigilancia_residente"
on public.reservas_zonas
for update
to authenticated
using (
  conjunto_id = public.fn_auth_conjunto_id()
  and (
    public.fn_auth_rol() in ('admin','vigilancia')
    or (public.fn_auth_rol() = 'residente' and residente_id = public.fn_auth_residente_id())
  )
)
with check (
  conjunto_id = public.fn_auth_conjunto_id()
  and (
    public.fn_auth_rol() in ('admin','vigilancia')
    or (public.fn_auth_rol() = 'residente' and residente_id = public.fn_auth_residente_id())
  )
);

-- Eventos
drop policy if exists "eventos_select_conjunto" on public.reservas_eventos;
create policy "eventos_select_conjunto"
on public.reservas_eventos
for select
to authenticated
using (conjunto_id = public.fn_auth_conjunto_id());

drop policy if exists "eventos_insert_conjunto" on public.reservas_eventos;
create policy "eventos_insert_conjunto"
on public.reservas_eventos
for insert
to authenticated
with check (conjunto_id = public.fn_auth_conjunto_id());

-- Documentos
drop policy if exists "docs_select_conjunto" on public.reservas_documentos;
create policy "docs_select_conjunto"
on public.reservas_documentos
for select
to authenticated
using (conjunto_id = public.fn_auth_conjunto_id());

drop policy if exists "docs_insert_conjunto" on public.reservas_documentos;
create policy "docs_insert_conjunto"
on public.reservas_documentos
for insert
to authenticated
with check (conjunto_id = public.fn_auth_conjunto_id());

-- Bloqueos (solo admin)
drop policy if exists "bloqueos_select_conjunto" on public.reservas_bloqueos;
create policy "bloqueos_select_conjunto"
on public.reservas_bloqueos
for select
to authenticated
using (conjunto_id = public.fn_auth_conjunto_id());

drop policy if exists "bloqueos_admin_write" on public.reservas_bloqueos;
create policy "bloqueos_admin_write"
on public.reservas_bloqueos
for all
to authenticated
using (
  conjunto_id = public.fn_auth_conjunto_id()
  and public.fn_auth_rol() = 'admin'
)
with check (
  conjunto_id = public.fn_auth_conjunto_id()
  and public.fn_auth_rol() = 'admin'
);

-- =========================================================
-- 9) Migración básica desde tablas existentes (si existen)
-- =========================================================
insert into public.recursos_comunes (conjunto_id, nombre, tipo, activo)
select z.conjunto_id, z.nombre, 'generica', true
from public.zonas_comunes z
where not exists (
  select 1
  from public.recursos_comunes r
  where r.conjunto_id = z.conjunto_id
    and lower(r.nombre) = lower(z.nombre)
);

insert into public.reservas_zonas (
  conjunto_id, recurso_id, residente_id, apartamento_id,
  fecha_inicio, fecha_fin, tipo_reserva, subtipo, estado, motivo, observaciones
)
select
  z.conjunto_id,
  r.id as recurso_id,
  rv.residente_id,
  re.apartamento_id,
  (rv.fecha::timestamp + coalesce(rv.hora_inicio, '08:00'::time)) as fecha_inicio,
  (rv.fecha::timestamp + coalesce(rv.hora_fin, '09:00'::time)) as fecha_fin,
  'recreativa' as tipo_reserva,
  null as subtipo,
  coalesce(rv.estado, 'solicitada') as estado,
  null as motivo,
  'Migrado desde public.reservas' as observaciones
from public.reservas rv
join public.zonas_comunes z on z.id = rv.zona_id
join public.recursos_comunes r
  on r.conjunto_id = z.conjunto_id
 and lower(r.nombre) = lower(z.nombre)
left join public.residentes re on re.id = rv.residente_id
where rv.fecha is not null
  and not exists (
    select 1
    from public.reservas_zonas rz
    where rz.residente_id = rv.residente_id
      and rz.fecha_inicio = (rv.fecha::timestamp + coalesce(rv.hora_inicio, '08:00'::time))
      and rz.recurso_id = r.id
  );

insert into public.reservas_zonas (
  conjunto_id, recurso_id, residente_id, apartamento_id,
  fecha_inicio, fecha_fin, tipo_reserva, subtipo, estado, motivo, observaciones
)
select
  t.conjunto_id,
  r.id as recurso_id,
  t.residente_id,
  re.apartamento_id,
  (t.fecha::timestamp + '08:00'::time) as fecha_inicio,
  (t.fecha::timestamp + '12:00'::time) as fecha_fin,
  'logistica' as tipo_reserva,
  'trasteo' as subtipo,
  coalesce(t.estado, 'solicitada') as estado,
  'Migrado desde public.trasteos' as motivo,
  'Migrado desde public.trasteos' as observaciones
from public.trasteos t
join public.recursos_comunes r
  on r.conjunto_id = t.conjunto_id
 and r.tipo = 'logistica'
left join public.residentes re on re.id = t.residente_id
where t.fecha is not null
  and not exists (
    select 1
    from public.reservas_zonas rz
    where rz.residente_id = t.residente_id
      and rz.fecha_inicio = (t.fecha::timestamp + '08:00'::time)
      and rz.subtipo = 'trasteo'
  );

commit;
