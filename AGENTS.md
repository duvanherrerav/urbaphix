# AGENTS.md - Urbaphix

## Contexto
Urbaphix es una plataforma SaaS para gestión de propiedad horizontal usando React + Supabase.

## Fuente de verdad
Antes de escribir código, revisar en este orden:
1. `docs/database-schema.md`
2. `supabase/migrations/`
3. `src/services/`
4. módulos del proyecto que ya consumen Supabase

## Reglas obligatorias
- No inventar tablas.
- No inventar columnas.
- No asumir relaciones.
- No ignorar RLS.
- No proponer SQL destructivo sin validación explícita.
- No alterar producción desde frontend.
- Si falta contexto de DB, actualizar documentación antes de implementar.

## Reglas de acceso
- Respetar filtros por `conjunto_id`
- Respetar filtros por `residente_id`
- Respetar `auth.uid()`
- Considerar funciones auxiliares:
  - `fn_auth_conjunto_id()`
  - `fn_auth_rol()`
  - `fn_auth_residente_id()`

## Cambios estructurales
Cuando se agregue una tabla, columna o policy:
1. crear migración SQL
2. actualizar `docs/database-schema.md`
3. subir ambos cambios a GitHub

## Objetivo
Mantener coherencia entre:
- código
- base de datos
- documentación
- contexto de Codex