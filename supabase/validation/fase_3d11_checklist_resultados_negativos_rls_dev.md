# FASE 3D.11 — Checklist de resultados negativos RLS DEV

## Pre-ejecución

- [ ] Confirmar que el ambiente es DEV.
- [ ] Confirmar que no se usará QA.
- [ ] Confirmar que no se usará PRD.
- [ ] Confirmar que no se usará service role.
- [ ] Confirmar que los tokens reales no quedarán en archivos, capturas ni logs compartidos.
- [ ] Confirmar que el dataset FASE 3D.10 / 3D.10A sigue disponible.
- [ ] Confirmar que el operador conoce que `401` autenticado es `SETUP_FAIL`.

## Sesiones reales

- [ ] Residente principal DEV autenticado como `b46ab33c-9237-4f43-a010-ff95ca1263a6`.
- [ ] Vigilancia DEV autenticado como `02f64392-d964-4bce-a4e9-a25e56621ef6`.
- [ ] Admin conjunto DEV autenticado como `565e209b-d7c2-4959-93c1-e2662c925180`.

## Casos residente

- [ ] R-01 residentes por id ajeno mismo conjunto: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] R-02 residentes por id cross-tenant: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] R-03 pagos por residente ajeno mismo conjunto: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] R-04 pagos por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] R-05 paquetes por residente ajeno mismo conjunto: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] R-06 registro_visitas por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] R-07 reservas_zonas por residente ajeno mismo conjunto: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] R-08 reservas_zonas por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.

## Casos vigilancia

- [ ] V-01 registro_visitas por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] V-02 paquetes por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] V-03 incidentes por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] V-04 reservas_zonas por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] V-05 usuarios_app por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.

## Casos admin conjunto

- [ ] A-01 usuarios_app por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] A-02 residentes por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] A-03 pagos por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] A-04 paquetes por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] A-05 registro_visitas por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] A-06 incidentes por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] A-07 reservas_zonas por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.
- [ ] A-08 config_pagos por conjunto ajeno: `PASS` / `FAIL P0` / `SETUP_FAIL` / `P2`.

## Cierre

- [ ] Todas las respuestas fueron saneadas.
- [ ] Ninguna evidencia contiene JWT, cookies, anon key, service role key o contraseñas.
- [ ] Ninguna prueba autenticada con `401` fue marcada como `PASS`.
- [ ] Cualquier exposición de datos ajenos fue marcada como `FAIL P0`.
- [ ] Se completó `docs/fase-3d11-evidencia-pruebas-negativas-rls-dev.md`.
- [ ] Se confirmó que no se tocó QA, PRD, Vercel, RLS, policies, helpers, migraciones, frontend funcional, `src/`, `.env` ni `.env.*`.
