# Urbaphix · Plantilla QA/Evidencias (Reservas Zonas v2)

Objetivo: validar funcional, seguridad (RLS) y operación del módulo de reservas v2 antes de pasar de staging a producción.

---

## 1) Datos generales de ejecución

- **Fecha:** ________
- **Ambiente:** Staging / Producción-Piloto
- **Ejecutor técnico:** ________
- **Validador funcional:** ________
- **Versión / commit app:** ________
- **Scripts ejecutados:**
  - `sql/modulo_reservas_zonas_v2.sql`
  - `sql/validacion_reservas_zonas_v2.sql`

---

## 2) Matriz funcional (por rol)

### 2.1 Residente

- [ ] Puede crear reserva propia.
- [ ] No puede crear reserva para otro residente.
- [ ] Puede ver solo sus reservas.
- [ ] Puede cancelar en estado permitido.
- Evidencia (captura/query): ______________________

### 2.2 Vigilancia

- [ ] Puede listar reservas del conjunto.
- [ ] Puede pasar reservas a `en_curso`.
- [ ] Puede cerrar reservas a `finalizada`.
- [ ] No puede administrar catálogo de recursos.
- Evidencia (captura/query): ______________________

### 2.3 Admin

- [ ] Puede crear/editar recursos comunes.
- [ ] Puede crear bloqueos operativos.
- [ ] Puede aprobar/rechazar solicitudes.
- [ ] Visualiza todo el conjunto.
- Evidencia (captura/query): ______________________

---

## 3) Matriz de negocio (casos críticos)

- [ ] Reserva sin conflicto (debe crear).
- [ ] Reserva con conflicto de horario/recurso (debe bloquear por constraint).
- [ ] Flujo completo: `solicitada -> aprobada -> en_curso -> finalizada`.
- [ ] Flujo rechazado: `solicitada -> rechazada`.
- [ ] Flujo cancelado por residente.
- [ ] Reserva logística (subtipo trasteo/materiales/escombro).
- [ ] Carga de documento soporte.
- Evidencia (captura/query): ______________________

---

## 4) Validación de seguridad (RLS)

Ejecutar pruebas de lectura/escritura con usuarios de cada rol.

- [ ] Residente no accede a reservas ajenas.
- [ ] Vigilancia/Admin sí acceden al conjunto.
- [ ] Admin write permitido en `recursos_comunes` y `reservas_bloqueos`.
- [ ] Residente write restringido a su propio `residente_id`.
- Evidencia (captura/query): ______________________

---

## 5) Resultado script SQL de validación

Ejecutar `sql/validacion_reservas_zonas_v2.sql` y copiar resultados:

- Tablas existentes: ✅ / ❌
- Constraint anti-solape: ✅ / ❌
- Estados inválidos detectados: ________
- Rangos inválidos detectados: ________
- Traslapes detectados: ________
- Conteos de migración (`reservas` / `trasteos`): ________

---

## 6) Criterios Go / No-Go

### GO (pasar a siguiente fase)

- [ ] 0 defectos críticos.
- [ ] 0 fugas de seguridad RLS.
- [ ] Casos críticos de negocio aprobados.
- [ ] Evidencias documentadas.

### NO-GO (detener despliegue)

- [ ] Hay errores críticos de integridad.
- [ ] Hay incumplimientos de RLS por rol.
- [ ] Hay inconsistencias de estado no resueltas.

---

## 7) Si hay NO-GO: plan inmediato

- [ ] Ejecutar rollback: `sql/modulo_reservas_zonas_v2_rollback.sql`.
- [ ] Verificar restauración de operación legacy.
- [ ] Registrar incidente y causa raíz.

---

## 8) Aprobación final

- **Aprobación técnica:** __________________
- **Aprobación funcional:** ________________
- **Decisión final:** GO / NO-GO
