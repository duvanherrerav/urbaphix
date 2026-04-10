# Esquema de base de datos - Urbaphix

## Fuente de verdad
Este documento resume la estructura actual de la base de datos de Supabase usada por Urbaphix.
Las tablas reales están en el esquema `public`.

## Convenciones generales
- Base de datos: Supabase Postgres
- Esquema principal: `public`
- Las relaciones se manejan con llaves foráneas
- Algunas tablas usan RLS
- No asumir nombres de columnas: revisar este documento antes de proponer cambios

---

## Tabla: conjuntos
**Descripción:** almacena la información principal de cada conjunto residencial.

### Campos
- `id` (uuid, PK)
- `nombre` (...)
- `...`

### Relaciones
- relacionada con `apartamentos`
- relacionada con `visitantes`
- relacionada con `reservas`

### Políticas/RLS
- indicar si tiene RLS
- resumir quién puede leer/escribir

---

## Tabla: apartamentos
**Descripción:** ...

### Campos
- `id` (uuid, PK)
- `conjunto_id` (uuid, FK -> conjuntos.id)
- `...`

### Relaciones
- pertenece a `conjuntos`

### Políticas/RLS
- ...

---

## Tabla: visitantes
...