# AGENTS.md - Urbaphix

## Contexto
Urbaphix es una plataforma SaaS para propiedad horizontal construida con React + Supabase.

## Fuente de verdad de datos
Antes de proponer cambios, revisar en este orden:
1. `docs/database-schema.md`
2. `supabase/migrations/`
3. `src/services/`
4. módulos que consumen Supabase

## Reglas obligatorias
- No inventar tablas.
- No inventar columnas.
- No asumir relaciones.
- No ignorar RLS.
- No proponer SQL destructivo sin justificación explícita.
- No modificar el esquema desde código frontend.

## Al trabajar con Supabase
- Validar nombres reales de tabla y columna antes de escribir consultas.
- Revisar primero `database-schema.md`.
- Si falta contexto, actualizar documentación antes de implementar.

## Cambios estructurales
Cuando se agregue una tabla, columna o policy nueva:
1. crear migración SQL
2. actualizar `docs/database-schema.md`
3. subir ambos cambios a GitHub

## Seguridad
- Respetar `auth.uid()`
- Respetar filtros por `conjunto_id`
- Respetar filtros por `residente_id`
- Respetar funciones auxiliares como `fn_auth_conjunto_id()`, `fn_auth_rol()` y `fn_auth_residente_id()`

## Objetivo
Mantener coherencia entre:
- código
- base de datos
- documentación
- contexto consumido por Codex