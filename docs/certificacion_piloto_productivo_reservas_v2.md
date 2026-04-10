# Urbaphix · Certificación final para piloto productivo (Reservas Zonas v2)

Este documento define la ejecución final de certificación antes de abrir el piloto a producción.

---

## 1) Objetivo

Determinar **GO / NO-GO** del piloto con evidencia técnica y funcional.

Script principal:

- `sql/certificacion_piloto_productivo_reservas_v2.sql`

---

## 2) Secuencia de ejecución (15-30 min)

1. Ejecutar bloque **A** (salud estructural).
2. Ejecutar bloque **B** (integridad funcional).
3. Ejecutar bloque **C** (evidencia de operación).
4. Ejecutar bloque **D** (semáforo final).

---

## 3) Criterios de aceptación GO

- `rangos_invalidos = 0`
- `estados_invalidos = 0`
- `vinculos_nulos = 0`
- `traslapes_activos = 0`
- `decision_final = GO`

Si alguno falla → **NO_GO**.

---

## 4) Evidencia mínima a anexar

- Resultado completo de bloques A/B/C/D.
- Captura de `decision_final`.
- Conteo por estado (7 días).
- Top recursos usados (7 días).
- Tasa de aprobación y no-show.

---

## 5) Acciones según resultado

### Si resultado = GO

- Aprobar piloto productivo controlado.
- Activar monitoreo reforzado 24h.
- Registrar hora de inicio de piloto y responsables.

### Si resultado = NO_GO

- No abrir piloto.
- Registrar hallazgos y RCA preliminar.
- Corregir y repetir certificación.
- Si ya hubo impacto operativo, ejecutar:
  - `sql/modulo_reservas_zonas_v2_rollback.sql`

---

## 6) Formato de acta rápida

- Fecha/hora: ________
- Ambiente: Producción (piloto)
- Responsable técnico: ________
- Responsable funcional: ________
- Resultado semáforo: GO / NO_GO
- Observaciones: ______________________
- Próxima acción: _____________________
