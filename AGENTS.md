# AGENTS.md

## Proyecto
Urbaphix es una plataforma SaaS para propiedad horizontal basada en React + Supabase.

## Fuente de verdad de base de datos
Antes de proponer cambios de backend, revisa:
1. `docs/database-schema.md`
2. `supabase/migrations/`
3. `src/services/supabaseClient.js`
4. servicios y módulos que consumen tablas reales

## Reglas para cambios
- No inventar tablas ni columnas.
- No asumir nombres de foreign keys.
- No proponer cambios destructivos sin justificación explícita.
- Antes de escribir código que consulte Supabase, validar nombres reales de tabla y campos.
- Si falta contexto del modelo, actualizar primero `docs/database-schema.md`.

## Seguridad
- Considerar RLS y políticas antes de modificar consultas.
- No proponer saltarse RLS en frontend.
- Mantener separación entre lógica de UI y acceso a datos.