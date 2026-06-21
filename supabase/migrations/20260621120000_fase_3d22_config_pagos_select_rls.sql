-- FASE 3D.22: endurece RLS SELECT de config_pagos.
-- Hallazgo P1: la policy legacy "lectura config pagos" exponía configuración
-- operativa de pagos con rol public y USING true, permitiendo lectura anónima.
-- La lectura queda restringida a usuarios autenticados con rol de plataforma,
-- membresía activa del mismo conjunto o fallback legacy same-tenant vía
-- fn_auth_conjunto_id() para usuarios_app no completamente backfilled.

alter table public.config_pagos enable row level security;

drop policy if exists "lectura config pagos" on public.config_pagos;
drop policy if exists "config_pagos_select_conjunto" on public.config_pagos;

create policy "config_pagos_select_conjunto"
on public.config_pagos
for select
to authenticated
using (
  public.fn_is_platform_superadmin()
  or public.fn_has_platform_role('platform_ops')
  or public.fn_has_tenant_role(conjunto_id, 'admin_conjunto')
  or public.fn_has_tenant_role(conjunto_id, 'contador')
  or public.fn_has_tenant_role(conjunto_id, 'residente')
  or conjunto_id = public.fn_auth_conjunto_id()
);
