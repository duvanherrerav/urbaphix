# Auditoría frontend de fechas y horas en zona horaria Bogotá

Fecha de auditoría: 2026-05-15  
Rama base solicitada: `develop`  
Alcance: frontend (`src/modules/**`, `src/components/**`, `src/utils/**`).

## Resumen ejecutivo

Se realizó una búsqueda global de usos de `Date`, `Intl.DateTimeFormat`, `toLocale*`, `Date.now()` y `toISOString()` en el frontend para identificar puntos que puedan depender de la zona horaria del navegador o interpretar timestamps de Supabase sin offset.

- No se modificó Supabase.
- No se crearon migraciones.
- No se tocaron RLS, tablas, datos, estados, realtime ni lógica financiera/de reservas/de incidentes.
- Se aplicaron únicamente correcciones pequeñas de presentación visible donde existía formateo local del navegador.
- Los hallazgos de mayor alcance quedan documentados como tickets recomendados.

## Estándar esperado

Para timestamps que vienen de Supabase o que se muestran al usuario, el estándar frontend debe ser explícito en `America/Bogota`:

- Preferir `src/utils/dateFormatters.js` para formatos globales:
  - `parseUtcTimestampToDate(value)`
  - `formatFechaBogota(value)`
  - `formatFechaHoraBogota(value, fallback)`
  - `toBogotaTimestampWithOffset(date)`
- En Reservas ya existe un helper especializado:
  - `src/modules/reservas/utils/dateTimeBogota.js`
  - `formatDateTimeBogota(value)`
  - `formatDateRangeBogota(inicio, fin)`
  - `getTodayBogotaDate()`
  - `getNowBogotaTimeHHMM()`

## Archivos revisados con usos relevantes de fecha/hora

Búsqueda ejecutada sobre `src/modules`, `src/components` y `src/utils` con patrones:

```bash
rg -n "new Date\(|toLocaleString\(|toLocaleDateString\(|toLocaleTimeString\(|Intl\.DateTimeFormat\(|Date\.now\(|toISOString\(" src/modules src/components src/utils
```

Archivos con coincidencias:

- `src/components/NotificacionesBell.jsx`
- `src/components/ui/AppDatePicker.jsx`
- `src/modules/admin/components/GraficaVisitas.jsx`
- `src/modules/admin/pages/DashboardAdmin.jsx`
- `src/modules/contabilidad/components/AnaliticaFinancieraAvanzada.jsx`
- `src/modules/contabilidad/components/CarteraResumen.jsx`
- `src/modules/contabilidad/components/EstadoCuenta.jsx`
- `src/modules/contabilidad/components/GraficaCartera.jsx`
- `src/modules/contabilidad/components/GraficaFinanciera.jsx`
- `src/modules/contabilidad/components/residente/PagoCard.jsx`
- `src/modules/contabilidad/components/residente/PagosResumenCards.jsx`
- `src/modules/contabilidad/pages/CrearCobro.jsx`
- `src/modules/contabilidad/pages/MisPagos.jsx`
- `src/modules/contabilidad/pages/PanelPagosAdmin.jsx`
- `src/modules/contabilidad/services/contabilidadService.js`
- `src/modules/contabilidad/utils/pagosEstados.js`
- `src/modules/paqueteria/services/paquetesService.js`
- `src/modules/reservas/components/residente/ReservaCreateCard.jsx`
- `src/modules/reservas/pages/PanelReservasAdmin.jsx`
- `src/modules/reservas/pages/ReservarZona.jsx`
- `src/modules/reservas/services/reservasService.js`
- `src/modules/reservas/utils/colombiaHolidays.js`
- `src/modules/reservas/utils/dateTimeBogota.js`
- `src/modules/reservas/utils/reservaFormatters.js`
- `src/modules/seguridad/pages/ListaIncidentes.jsx`
- `src/modules/seguridad/services/seguridadService.js`
- `src/modules/visitas/pages/CrearVisita.jsx`
- `src/modules/visitas/pages/EscanearQR.jsx`
- `src/modules/visitas/pages/PanelVigilancia.jsx`
- `src/modules/visitas/services/porteriaService.js`
- `src/utils/dateFormatters.js`

> Nota: varias coincidencias son formateo monetario con `toLocaleString('es-CO')` y no representan riesgo horario.

## Archivos que ya usan helpers centralizados o zona Bogotá explícita

### Helper global `src/utils/dateFormatters.js`

- `src/components/NotificacionesBell.jsx` — corregido en esta auditoría para usar `formatFechaHoraBogota`.
- `src/modules/admin/pages/DashboardAdmin.jsx` — corregido en esta auditoría para mostrar la próxima reserva con `formatFechaHoraBogota`.
- `src/modules/contabilidad/pages/PanelPagosAdmin.jsx` — usa `formatFechaBogota` para creación, fecha de pago, vencimiento y eventos.
- `src/modules/contabilidad/components/residente/PagoCard.jsx` — usa `formatFechaBogota` para fechas visibles.
- `src/modules/contabilidad/components/EstadoCuenta.jsx` — usa `formatFechaBogota` en listados/tablas; mantiene un punto pendiente en la marca de generación del PDF.
- `src/modules/paqueteria/pages/PanelPaquetes.jsx` — usa `formatFechaHoraBogota`.
- `src/modules/paqueteria/components/PaqueteCard.jsx` — usa `formatFechaHoraBogota`.
- `src/modules/visitas/pages/PanelVigilancia.jsx` — usa `formatFechaHoraBogota`, `parseUtcTimestampToDate` y `toBogotaTimestampWithOffset`.

### Helper especializado de Reservas `src/modules/reservas/utils/dateTimeBogota.js`

- `src/modules/reservas/pages/PanelReservasAdmin.jsx` — usa `formatDateTimeBogota`/`formatDateRangeBogota` en la mayoría de fechas visibles y configura calendario con `America/Bogota`.
- `src/modules/reservas/pages/PanelReservasVigilancia.jsx` — usa `formatDateRangeBogota`.
- `src/modules/reservas/pages/ReservarZona.jsx` — usa `formatDateRangeBogota` y `getTodayBogotaDate`.
- `src/modules/reservas/components/residente/ReservaCard.jsx` — usa `formatDateRangeBogota` y `formatDateTimeBogota`.
- `src/modules/reservas/services/reservasService.js` — usa `timezone: 'America/Bogota'` en reglas/configuración y `Intl.DateTimeFormat` con `timeZone: 'America/Bogota'` para fecha actual.

### Zona Bogotá explícita sin helper global

- `src/modules/seguridad/pages/ListaIncidentes.jsx` — formatea fechas visibles con `timeZone: 'America/Bogota'`.
- `src/modules/visitas/pages/CrearVisita.jsx` — obtiene día actual Bogotá para fecha mínima; conserva un formateo de fecha local para labels de fecha-only.
- `src/modules/visitas/pages/EscanearQR.jsx` — genera hora de ingreso con `timeZone: 'America/Bogota'`.
- `src/modules/visitas/services/porteriaService.js` — varias validaciones operativas usan `timeZone: 'America/Bogota'`.

## Hallazgos por riesgo

### Crítico para release

No se encontró un hallazgo crítico nuevo que obligue a cambiar Supabase o reglas de negocio antes del merge controlado a `main`.

La razón principal es que los módulos con mayor sensibilidad ya tienen mitigaciones parciales o explícitas:

- Visitas/Portería usa `America/Bogota` en validaciones y presentación clave.
- Paquetería usa helpers globales para presentación.
- Reservas tiene helper propio para Bogotá en gran parte de la UI.
- Incidentes ya formatea fechas visibles en Bogotá.

### Riesgo medio

1. `src/modules/contabilidad/utils/pagosEstados.js`
   - Usa `new Date(fecha_vencimiento)`, `new Date()` y `toISOString().split('T')[0]` para mora, vencimiento y filtros de rango.
   - Riesgo: una fecha sin offset o fecha-only puede interpretarse según UTC/navegador, afectando límites diarios de pagos vencidos o métricas por rango.
   - No se corrigió porque impacta lógica financiera. Requiere ticket específico con pruebas de borde en medianoche Bogotá.

2. `src/modules/contabilidad/components/EstadoCuenta.jsx`
   - Inicializa filtros con `new Date()`/`toISOString().split('T')[0]` y genera PDF con `new Date().toLocaleString('es-CO')` sin `timeZone` explícito.
   - Riesgo: rango por defecto y marca de generación del PDF pueden variar si el navegador no está en Colombia.
   - No se corrigió la lógica de filtros por ser contabilidad; la marca del PDF sí es segura, pero se dejó como ticket para consolidar junto con filtros.

3. `src/modules/contabilidad/services/contabilidadService.js` y `src/modules/contabilidad/pages/PanelPagosAdmin.jsx`
   - Persisten `fecha_pago`, `fecha_rechazo` y `fecha_vencimiento` con `new Date().toISOString()`.
   - Riesgo: si las columnas son `timestamp without time zone`, Supabase/Postgres puede almacenar una hora UTC sin offset semántico. Cambiar esto puede impactar datos y reportes.
   - No se corrigió por restricción de no cambiar lógica financiera ni estructura de datos.

4. `src/modules/reservas/services/reservasService.js`
   - Contiene cálculos con `new Date(fecha_inicio)`, `new Date(fecha_fin)`, `toISOString().slice(0, 10)` y construcción de día con `new Date(`${fecha}T00:00:00`)`.
   - Riesgo: si llegan timestamps sin offset, los solapes, slots o claves de día pueden depender del navegador/UTC.
   - No se corrigió porque afecta validación de negocio de reservas; requiere pruebas dedicadas.

5. `src/modules/reservas/pages/PanelReservasAdmin.jsx`
   - Aunque las fechas visibles usan helper Bogotá, algunos filtros/ordenamientos usan `new Date(...) >= now` y orden por `new Date(fecha_inicio)`.
   - Riesgo: clasificación de “próxima” o vigencia puede variar para timestamps sin offset.
   - No se corrigió por posible impacto en lógica de panel.

6. `src/modules/admin/pages/DashboardAdmin.jsx`
   - Mantiene cálculos internos con `Date.now()`, `new Date().toISOString()`, `new Date(fecha_inicio)` y parser manual de visitas.
   - Riesgo: dashboard agregado puede filtrar visitas/reservas según UTC/local si el dato no trae offset.
   - Corrección aplicada solo a presentación visible de próxima reserva; el resto queda para ticket porque cambia consultas/agregaciones.

7. `src/modules/admin/components/GraficaVisitas.jsx` y `src/modules/contabilidad/components/GraficaFinanciera.jsx`
   - Agrupan/etiquetan fechas con `new Date(...)` y `toLocaleDateString('es-CO')` sin `timeZone` explícito.
   - Riesgo: buckets diarios y etiquetas pueden moverse un día cerca de medianoche para usuarios fuera de Colombia.
   - No se corrigió para evitar alterar métricas en gráficas sin pruebas.

### Riesgo bajo / documental

1. `src/components/NotificacionesBell.jsx`
   - Antes mostraba `new Date(n.created_at).toLocaleString()` sin locale ni zona explícita.
   - Corrección aplicada: `formatFechaHoraBogota(n.created_at)`.

2. `src/components/ui/AppDatePicker.jsx`
   - Usa `new Date(year, month, day)` y `toLocaleDateString('es-CO')` para un calendario date-only local.
   - Riesgo bajo si se usa solo como selector de fecha civil; documentar si se reutiliza para timestamps con hora.

3. `src/modules/visitas/pages/CrearVisita.jsx`
   - `formatFechaCorta` construye `new Date(`${fecha}T00:00:00`)` para etiqueta de fecha-only.
   - Riesgo bajo en Colombia; si el navegador está fuera de Colombia podría variar el weekday. Recomendado migrar a helper si se estandariza UI date-only.

4. `src/modules/visitas/services/porteriaService.js`
   - Persistencias/cola usan `new Date().toISOString()` para `created_at`/`queued_at`; en general es aceptable para timestamps técnicos UTC.
   - Punto a revisar: `new Date().toISOString().slice(0, 10)` en filtros diarios debe migrar a Bogotá si se confirma uso operativo.

5. `src/modules/paqueteria/services/paquetesService.js`
   - Usa `fecha_entrega: new Date().toISOString()`.
   - Riesgo bajo/medio según tipo real de columna. La UI ya formatea en Bogotá; no se cambia persistencia sin validación de DB.

6. `src/modules/seguridad/services/seguridadService.js`
   - Usa `Date.now()` para timestamps locales de control UI y `new Date().toISOString()` para `updated_at`.
   - Riesgo bajo si es auditoría técnica; revisar si se muestra como hora operativa.

7. `src/modules/reservas/utils/colombiaHolidays.js`
   - Usa fechas date-only para calcular festivos en Colombia.
   - Riesgo bajo si las entradas son fechas civiles y no timestamps de Supabase.

8. Usos de `toLocaleString('es-CO')` sobre números/moneda
   - No son hallazgos horarios.

## Correcciones aplicadas en esta rama

1. `src/components/NotificacionesBell.jsx`
   - Se reemplazó el formateo local del navegador por `formatFechaHoraBogota`.
   - Se eliminó una referencia a `n.created_at` dentro del estado vacío de notificaciones, porque no existe `n` cuando no hay elementos.

2. `src/modules/admin/pages/DashboardAdmin.jsx`
   - Se reemplazó el formateo local de la próxima reserva por `formatFechaHoraBogota`.

Estas correcciones son de presentación visible, no cambian consultas, estados, realtime ni datos persistidos.

## Tickets recomendados

### TZ-01 — Contabilidad: normalizar cortes diarios y mora en Bogotá

- Archivos: `src/modules/contabilidad/utils/pagosEstados.js`, `src/modules/contabilidad/components/EstadoCuenta.jsx`, `src/modules/contabilidad/services/contabilidadService.js`, `src/modules/contabilidad/pages/PanelPagosAdmin.jsx`.
- Objetivo: definir si `fecha_vencimiento`, `fecha_pago`, `fecha_rechazo` y filtros por rango deben ser fecha civil Bogotá o timestamp UTC.
- Criterios mínimos: pruebas para usuarios con navegador en UTC, Colombia y zona positiva; casos cerca de `00:00` Bogotá.

### TZ-02 — Reservas: unificar parsing de timestamps sin offset

- Archivos: `src/modules/reservas/services/reservasService.js`, `src/modules/reservas/pages/PanelReservasAdmin.jsx`, `src/modules/reservas/pages/ReservarZona.jsx`.
- Objetivo: reutilizar `dateTimeBogota.js` también para ordenamientos, solapes, slots y claves de día.
- Riesgo: alto de negocio; requiere pruebas de solape y validaciones de disponibilidad.

### TZ-03 — Admin dashboards/gráficas: buckets diarios en Bogotá

- Archivos: `src/modules/admin/pages/DashboardAdmin.jsx`, `src/modules/admin/components/GraficaVisitas.jsx`, `src/modules/contabilidad/components/GraficaFinanciera.jsx`.
- Objetivo: que filtros “últimas 72 horas”, “próxima reserva” y agrupaciones por día usen reglas explícitas de Bogotá.

### TZ-04 — Visitas/Portería: eliminar remanentes UTC en filtros de día

- Archivo: `src/modules/visitas/services/porteriaService.js`.
- Objetivo: reemplazar usos de `toISOString().slice(0, 10)` para día operativo por fecha Bogotá, conservando timestamps técnicos UTC donde aplique.

### TZ-05 — Consolidar helpers

- Objetivo: evaluar si `src/modules/reservas/utils/dateTimeBogota.js` debe delegar en `src/utils/dateFormatters.js` o si ambos deben coexistir con contratos documentados.
- Beneficio: menor dispersión y menos riesgo de que nuevos módulos vuelvan a usar zona del navegador.

## Conclusión

La auditoría no detecta un bloqueador crítico nuevo para release, pero sí confirma riesgo medio en contabilidad, reservas y dashboards por cálculos de día/orden/filtros que siguen usando `Date` nativo o `toISOString()` sin contrato explícito de Bogotá. Para evitar regresiones de negocio, esos cambios deben abordarse en tickets dedicados con pruebas de borde. Las correcciones implementadas en esta rama son acotadas a presentación visible y reutilizan helpers existentes.
