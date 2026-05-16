alter policy "update comprobante pagos"
on public.pagos
to authenticated
using (
  exists (
    select 1
    from public.residentes r
    where r.id = pagos.residente_id
      and r.usuario_id = auth.uid()
      and r.conjunto_id = pagos.conjunto_id
  )
)
with check (
  exists (
    select 1
    from public.residentes r
    where r.id = pagos.residente_id
      and r.usuario_id = auth.uid()
      and r.conjunto_id = pagos.conjunto_id
  )
);

alter policy "update pagos admin"
on public.pagos
to public
using (
  exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = 'admin'
      and ua.conjunto_id = pagos.conjunto_id
  )
)
with check (
  exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = 'admin'
      and ua.conjunto_id = pagos.conjunto_id
  )
);

alter policy "insert paquetes vigilancia"
on public.paquetes
to public
with check (
  exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = 'vigilancia'
      and ua.conjunto_id = paquetes.conjunto_id
  )
);

alter policy "update paquetes vigilancia"
on public.paquetes
to public
using (
  exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = 'vigilancia'
      and ua.conjunto_id = paquetes.conjunto_id
  )
)
with check (
  exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = 'vigilancia'
      and ua.conjunto_id = paquetes.conjunto_id
  )
);

alter policy "crear incidentes vigilancia"
on public.incidentes
to public
with check (
  exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = 'vigilancia'
      and ua.conjunto_id = incidentes.conjunto_id
  )
);

alter policy "update incidentes admin conjunto"
on public.incidentes
to public
using (
  exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = 'admin'
      and ua.conjunto_id = incidentes.conjunto_id
  )
)
with check (
  exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = 'admin'
      and ua.conjunto_id = incidentes.conjunto_id
  )
);

alter policy "registro_visitas_update_vigilancia_admin"
on public.registro_visitas
to public
using (
  exists (
    select 1
    from public.usuarios_app ua
    where ua.id = auth.uid()
      and ua.rol_id = any(array['vigilancia','admin'])
      and ua.conjunto_id = registro_visitas.conjunto_id
  )
);

alter policy "reservas por conjunto"
on public.reservas
to public
using (
  exists (
    select 1
    from public.zonas_comunes z
    join public.usuarios_app ua
      on ua.conjunto_id = z.conjunto_id
    where ua.id = auth.uid()
      and z.id = reservas.zona_id
  )
);