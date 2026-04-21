# Plan de sistema de diseño visual (Urbaphix)

## Objetivo
Definir una base de diseño consistente para aplicar la identidad de marca (isotipo + imagotipo) en toda la aplicación, manteniendo coherencia visual en sidebar, botones, cards, textos, estados y formularios.

## Propuesta base

### 1) Tokens de diseño
Crear tokens semánticos globales (CSS variables) para evitar estilos hardcodeados:

- `--color-primary`
- `--color-secondary`
- `--color-tertiary`
- `--color-bg`
- `--color-bg-alt`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-border`
- `--color-success`
- `--color-error`
- `--color-warning`
- `--color-info`

### 2) Distribución visual
Aplicar proporción **70/20/10**:

- 70% superficies base (fondos y contenedores)
- 20% neutros (texto secundario, bordes, elevaciones)
- 10% acentos (CTAs, focos visuales, links principales)

### 3) Integración técnica
- Declarar tokens en `src/index.css`.
- Extender `tailwind.config.js` para mapear tokens a utilidades.
- Crear clases base en `@layer components`:
  - Botones: primario/secundario/ghost/destructivo
  - Campos: input/select/textarea
  - Cards y badges de estado

## Alcance del primer corte

1. **Layout global**: fondo app, sidebar, header, contenedor principal.
2. **Primitivos**: botones, inputs, cards, badges, alertas.
3. **Módulos críticos**:
   - Reservas
   - Incidentes
   - Pagos

## Integración de marca

- **Sidebar**: imagotipo persistente.
- **Login**: imagotipo central e isotipo como apoyo.
- **Header**: isotipo compacto.
- **Estados vacíos**: isotipo de forma sutil y limitada.

## Orden de implementación recomendado

1. Infraestructura de tema (tokens + Tailwind + componentes base).
2. App shell (sidebar/header/fondos).
3. Primitivos UI reutilizables.
4. Módulos críticos (Reservas, Incidentes, Pagos).
5. Pulido visual/accesibilidad.
6. Escalado gradual al resto de módulos.

## Riesgos y mitigación

- **Riesgo:** Regresiones visuales por cambios masivos.
  - **Mitigación:** Migración incremental por fases.
- **Riesgo:** Mezcla de estilos nuevos y legacy.
  - **Mitigación:** Definir utilidades semánticas obligatorias para nuevos cambios.
- **Riesgo:** Contraste insuficiente en tema oscuro.
  - **Mitigación:** Validar contraste mínimo WCAG en componentes críticos.

## Resultado esperado

Una base visual consistente y escalable que permita aplicar branding de forma uniforme sin alterar lógica de negocio ni romper flujos funcionales.
