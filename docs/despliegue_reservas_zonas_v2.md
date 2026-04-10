# Urbaphix · Runbook de despliegue por fases (Staging → Producción)

Este documento define el checklist operativo para desplegar:

- `sql/modulo_reservas_zonas_v2.sql`
- `sql/modulo_reservas_zonas_v2_rollback.sql`

---

## 0) Pre-chequeos (obligatorio)

- [ ] Confirmar backup lógico reciente de BD (dump completo).
- [ ] Confirmar ventana de despliegue y responsables:
  - Responsable técnico
  - Responsable funcional (QA negocio)
  - Responsable de reversa (rollback owner)
- [ ] Verificar salud de tablas legacy:
  - `zonas_comunes`
  - `reservas`
  - `trasteos`
- [ ] Verificar que no existan migraciones SQL concurrentes.

---

## 1) Fase STAGING

### 1.1 Aplicación de esquema v2

- [ ] Ejecutar `sql/modulo_reservas_zonas_v2.sql` en staging con rol `postgres`.
- [ ] Confirmar creación de tablas v2:
  - `recursos_comunes`
  - `reservas_zonas`
  - `reservas_eventos`
  - `reservas_documentos`
  - `reservas_bloqueos`
- [ ] Validar existencia de constraint anti-solape `reservas_zonas_no_solape`.

### 1.2 Validación RLS

- [ ] Probar acceso con usuario `admin`:
  - crear/rechazar/aprobar reservas
  - crear bloqueos
  - administrar recursos
- [ ] Probar acceso con usuario `vigilancia`:
  - ver reservas del conjunto
  - actualizar estados operativos (check-in/check-out)
- [ ] Probar acceso con usuario `residente`:
  - crear reserva propia
  - ver solo sus reservas
  - no ver reservas de otros residentes

### 1.3 Pruebas funcionales mínimas

- [ ] Reserva recreativa sin conflicto.
- [ ] Intento de reserva en franja traslapada (debe fallar).
- [ ] Flujo completa:
  - solicitada → aprobada → en_curso → finalizada.
- [ ] Flujo logística (subtipo trasteo/materiales/escombro).
- [ ] Carga de documento soporte.

### 1.4 Gate de salida STAGING

- [ ] 0 errores críticos.
- [ ] Aprobación funcional de negocio.
- [ ] Evidencias (capturas/query logs) anexadas.

---

## 2) Fase PILOTO en PRODUCCIÓN (controlada)

### 2.1 Preparación

- [ ] Confirmar backup justo antes del despliegue.
- [ ] Confirmar canal de comunicación abierto (war-room).
- [ ] Confirmar monitoreo activo de errores.

### 2.2 Ejecución

- [ ] Ejecutar `sql/modulo_reservas_zonas_v2.sql`.
- [ ] Verificar conteos iniciales:
  - `select count(*) from public.recursos_comunes;`
  - `select count(*) from public.reservas_zonas;`
- [ ] Probar reservas con 1 conjunto piloto y 1 usuario por rol.

### 2.3 Monitoreo post-despliegue (30-60 min)

- [ ] Errores SQL/RLS.
- [ ] Latencia de consultas en reservas.
- [ ] Consistencia de estados en transiciones.

### 2.4 Gate de salida PILOTO

- [ ] Sin incidentes críticos.
- [ ] Usuarios piloto confirman operación correcta.

---

## 3) Fase PRODUCCIÓN completa

- [ ] Habilitar uso para todos los conjuntos objetivo.
- [ ] Monitoreo reforzado durante las primeras 24h.
- [ ] Registrar métricas:
  - reservas creadas
  - rechazos por traslape
  - errores por RLS

---

## 4) Plan de rollback (si falla)

### Cuándo activar rollback

- Error crítico de RLS que impide operación por rol.
- Fallos masivos de creación/actualización de reservas.
- Inconsistencia de datos en estados críticos.

### Ejecución rollback

- [ ] Ejecutar `sql/modulo_reservas_zonas_v2_rollback.sql`.
- [ ] Confirmar restauración de operación legacy:
  - `zonas_comunes`
  - `reservas`
  - `trasteos`
- [ ] Documentar incidente y causa raíz.

---

## 5) Checklist de cierre

- [ ] Documento de resultados (staging y prod).
- [ ] Incidentes y mitigaciones registradas.
- [ ] Plan de mejoras para sprint siguiente:
  - frontend del módulo reservas
  - notificaciones específicas
  - reportes/kpis de ocupación
