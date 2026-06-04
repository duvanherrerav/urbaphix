# FASE 3D.7 - Validación efectiva autenticada RLS DEV por rol

## 1. Resumen ejecutivo

FASE 3D.7 prepara y estandariza la validación efectiva de Row Level Security (RLS) en Supabase DEV con usuarios autenticados reales por rol. Esta validación complementa la evidencia estructural de fases previas: no basta con confirmar que tablas, policies, helpers y trazabilidad existen; se debe observar qué datos devuelve la app o la API cuando el usuario real navega con su JWT de sesión.

El objetivo operativo es decidir Go/No-Go hacia una fase posterior de hardening RLS controlado. La decisión debe basarse en evidencia autenticada, saneada y comparable por rol, sin publicar tokens, cookies, llaves ni datos sensibles.

Estado actual relevante: antes de ejecutar los checks efectivos, DEV debe contar con usuarios de prueba completos para `admin_conjunto`, `vigilancia`/`vigilante` y `residente`. Si no existe un usuario residente DEV suficiente, esta fase documenta una ruta segura para prepararlo, pero Codex no debe crear usuarios, memberships ni datos.

## 2. Alcance

### Incluido

- Ambiente DEV únicamente.
- Usuarios autenticados reales de prueba.
- Validación desde frontend DEV con DevTools Network como método recomendado.
- Validación alternativa por API con JWT real del usuario de prueba, siempre sin exponer el token.
- Revisión de datos visibles por `conjunto_id`, `residente_id` y rol efectivo.
- Registro de evidencia por rol usando el formato de FASE 3D.7.
- Clasificación de hallazgos P0/P1/P2/P3.
- Uso de SQL read-only solo como apoyo para identificar usuarios o como referencia técnica, no como evidencia final de `auth.uid()` si se ejecuta desde SQL Editor.

### Fuera de alcance

- PRD y QA.
- Cambios funcionales de frontend.
- Migraciones.
- Cambios RLS, helpers SQL, grants o policies.
- Cambios de variables `.env`, Vercel o configuración de despliegue.
- Ejecución de SQL desde Codex contra cualquier ambiente.
- Creación automática de usuarios o datos de prueba desde Codex.

## 3. Prohibición explícita de PRD/QA

FASE 3D.7 es una validación DEV autenticada únicamente. Está prohibido usar PRD o QA para preparar usuarios, capturar evidencia, ejecutar scripts, probar endpoints o verificar RLS durante esta fase.

Antes de cualquier sesión manual, el operador humano debe confirmar:

- URL del frontend DEV.
- Project ref o URL Supabase DEV.
- Usuario autenticado DEV.
- Ausencia de pestañas, shells o clientes apuntando a QA/PRD.

Si se detecta una conexión accidental a QA o PRD, la ejecución debe detenerse y clasificarse como No-Go operativo hasta revisar el incidente.

## 4. Evidencia estructural vs evidencia efectiva autenticada

| Tipo de evidencia | Qué demuestra | Qué no demuestra | Uso en FASE 3D.7 |
| --- | --- | --- | --- |
| Estructural | Existencia de tablas, columnas, RLS habilitado, policies, helpers, grants y consistencia básica de datos. | Qué filas ve un usuario real con sesión autenticada. | Contexto y punto de partida. |
| Efectiva autenticada | Requests reales desde frontend o API con JWT de un usuario de prueba y respuestas observadas bajo RLS. | Diseño completo de hardening futuro. | Evidencia principal para Go/No-Go. |
| SQL Editor | Resultado de consultas administrativas o manuales. | `auth.uid()` real del usuario final si no se ejecuta en una sesión equivalente. | Referencia técnica, nunca evidencia final por sí sola. |

La evidencia efectiva debe confirmar que Supabase evalúa la sesión del usuario autenticado real. En Supabase, RLS se aplica con el contexto de autenticación de la request; si no hay token válido, `auth.uid()` no representa al usuario esperado.

## 5. Estado pendiente: usuario residente DEV

La brecha conocida al iniciar esta fase es que DEV puede no tener un usuario residente suficientemente completo para validar módulos de residente. La validación no debe forzarse con datos incompletos ni con SQL Editor como sustituto de sesión autenticada.

Un usuario residente DEV se considera suficiente cuando existe coherencia mínima entre:

- Supabase Auth DEV: usuario real que puede iniciar sesión.
- `usuarios_app`: registro legacy si el flujo actual lo requiere, con rol legacy compatible con residente y `conjunto_id` esperado.
- `residentes`: registro vinculado por `usuario_id` y `conjunto_id` esperado.
- `tenant_memberships`: membership activa con `role_name = 'residente'`, `status = 'active'`, `conjunto_id` correcto y `residente_id` poblado.

## 6. Requisitos previos de usuarios de prueba

La matriz mínima de usuarios DEV debe prepararse y documentarse antes de cerrar la fase:

| Usuario de prueba | Obligatorio | Requisitos mínimos | Propósito |
| --- | --- | --- | --- |
| `admin_conjunto` DEV | Sí | Auth DEV, `usuarios_app` compatible si aplica, membership activa del conjunto esperado. | Validar administración tenant. |
| `vigilancia`/`vigilante` DEV | Sí | Auth DEV, rol operativo de vigilancia/vigilante coherente, membership activa del conjunto esperado. | Validar portería/seguridad. |
| `residente` DEV | Sí | Auth DEV, `usuarios_app` legacy si aplica, `residentes.usuario_id`, `tenant_memberships.residente_id`. | Validar ownership por residente. |
| Usuario sin membership activa | Opcional recomendado | Auth DEV sin membership activa. | Confirmar denegación de datos protegidos. |
| Usuario con membership inactiva | Opcional recomendado | Auth DEV con membership `suspended` o `revoked`. | Confirmar que estado inactivo no concede acceso. |

## 7. Preparación controlada del usuario residente DEV

> Codex no debe ejecutar esta preparación. Debe realizarla un operador humano autorizado en DEV.

Ruta segura recomendada:

1. Confirmar que el entorno es DEV y registrar identificadores saneados: `conjunto_id`, correo de prueba enmascarado y responsable de la operación.
2. Dar de alta o seleccionar un usuario en Supabase Auth DEV, o usar el flujo controlado de la app si existe.
3. Verificar que el usuario puede iniciar sesión en el frontend DEV.
4. Crear o vincular el perfil legacy en `usuarios_app` solo si el flujo actual lo requiere:
   - `id` alineado con el usuario Auth cuando aplique.
   - rol legacy `residente` si el flujo actual lo requiere.
   - `conjunto_id` igual al conjunto esperado.
5. Crear o vincular el registro en `residentes`:
   - `usuario_id` coherente con el usuario Auth/perfil legacy.
   - `conjunto_id` igual al conjunto esperado.
   - apartamento/torre/datos funcionales mínimos si los módulos los requieren.
6. Crear o vincular `tenant_memberships`:
   - `user_id` del usuario Auth.
   - `role_name = 'residente'`.
   - `status = 'active'`.
   - `conjunto_id` correcto.
   - `residente_id` poblado y coherente.
   - `source_legacy` informado si aplica.
7. Verificar que no exista otra membership activa incompatible para el mismo usuario y conjunto.
8. Registrar IDs usados en el formato de evidencia sin publicar documentos, teléfonos, correos completos, JWT, cookies ni llaves.

Si el operador no autoriza esta preparación, la fase queda en No-Go para validación completa de residente y debe documentarse la brecha.

## 8. Método recomendado: frontend DEV + DevTools Network

1. Abrir una ventana limpia o perfil separado del navegador.
2. Ingresar al frontend DEV.
3. Iniciar sesión con un usuario de prueba del rol objetivo.
4. Abrir DevTools Network antes de navegar módulos.
5. Activar preservación de logs si el navegador lo permite.
6. Navegar cada módulo definido para el rol.
7. Capturar por request:
   - módulo/pantalla;
   - endpoint o tabla Supabase observada;
   - método HTTP;
   - status code;
   - filtros query relevantes (`conjunto_id`, `residente_id`, `user_id`, rangos);
   - conteo o resumen saneado de filas;
   - veredicto tenant/residente;
   - captura o HAR saneado sin tokens.
8. Confirmar visualmente que los datos pertenecen al `conjunto_id` y/o `residente_id` esperados.
9. Repetir la sesión para `admin_conjunto`, `vigilancia`/`vigilante` y `residente`.
10. Registrar hallazgos P0/P1/P2/P3 inmediatamente.

Regla de saneamiento: antes de adjuntar evidencia, eliminar `Authorization`, `apikey`, cookies, refresh tokens, access tokens, correos completos, teléfonos, documentos, URLs privadas firmadas y datos personales no necesarios.

## 9. Método alternativo: API/JWT real del usuario de prueba

El método alternativo se permite cuando la evidencia Network no sea suficiente o se requiera repetir checks equivalentes. Reglas:

- Usar JWT real del usuario de prueba solo en la máquina del operador autorizado.
- No pegar ni publicar tokens en issues, PRs, capturas, logs compartidos o documentos.
- Registrar únicamente endpoint, status code, filtros y respuesta sanitizada.
- Usar la anon key pública del proyecto DEV solo si corresponde al flujo normal del cliente.
- No usar service role para simular un usuario final.
- No usar SQL Editor como sustituto de request autenticada.

La respuesta registrada debe permitir responder: “¿qué ve este usuario real bajo RLS?” sin revelar secretos.

## 10. Uso de `supabase/validation/fase_3d3_rls_effective_access_checks.sql`

El archivo `supabase/validation/fase_3d3_rls_effective_access_checks.sql` puede usarse como referencia técnica para diseñar validaciones equivalentes por Network o API/JWT.

Uso permitido:

- Identificar tablas y módulos sensibles.
- Convertir checks conceptuales a requests reales desde frontend DEV.
- Comparar resultados esperados por `conjunto_id` y `residente_id`.
- Preparar preguntas de investigación para el operador humano.

Uso no aceptado como evidencia final:

- Ejecutarlo solo desde SQL Editor y afirmar que representa el `auth.uid()` del usuario final.
- Ejecutarlo con credenciales administrativas o service role y tratarlo como evidencia RLS de cliente.
- Publicar resultados con datos personales o secretos.

## 11. Módulos a validar por rol

### 11.1 `admin_conjunto` DEV

Validar:

- Dashboard Admin.
- Pagos / Crear cobro.
- Incidentes.
- Reservas Admin.
- Paquetería admin si aplica.
- Usuarios/residentes visibles del conjunto.
- Config pagos.
- Que no vea datos de otro conjunto.

Evidencia esperada:

- Requests de lectura agrupadas por módulo.
- Al menos una acción de navegación o carga que demuestre filtros por conjunto.
- Respuestas sin filas de otros conjuntos.
- Cualquier endpoint con policy amplia (`config_pagos`) clasificado según resultado efectivo.

### 11.2 `vigilancia`/`vigilante` DEV

Validar:

- Control de visitas.
- Registro visitas.
- Paquetes.
- Incidentes.
- Que no vea datos de otro conjunto.
- Que no acceda a módulos administrativos no autorizados.

Evidencia esperada:

- Requests de portería/seguridad con status y filas saneadas.
- Intentos de navegación a módulos admin no autorizados, registrando bloqueo UI o rechazo API.
- Confirmación de ausencia de datos cross-tenant.

### 11.3 `residente` DEV

Validar:

- Mis pagos.
- Mis paquetes.
- Solicitar visita.
- Reservas residente.
- Notificaciones propias.
- Que solo vea su residente/conjunto esperado.
- Que no vea pagos, paquetes ni reservas de otros residentes.

Evidencia esperada:

- Requests con filtros por `residente_id`, `usuario_id` o relaciones equivalentes.
- Conteo saneado de filas propias.
- Confirmación negativa de datos de otros residentes.
- Notificaciones propias o brecha P2 si no hay datos suficientes.

## 12. Evidencia mínima por rol

Para cada rol obligatorio, el formato de evidencia debe incluir:

- Identificador saneado del usuario Auth DEV.
- Rol esperado y rol observado por la app.
- `conjunto_id` esperado.
- `residente_id` esperado cuando aplique.
- Fuente de resolución de membresía: `tenant_memberships`, `usuarios_app` fallback o híbrida.
- Lista de módulos navegados.
- Tabla de requests/responses saneadas.
- Resultado tenant: OK, sospechoso o fuga confirmada.
- Resultado residente: OK, no aplica, sospechoso o fuga confirmada.
- Hallazgos P0/P1/P2/P3.
- Decisión por rol: Go parcial, Go condicionado o No-Go.

## 13. Matriz de severidad P0/P1/P2/P3

| Severidad | Definición | Ejemplos |
| --- | --- | --- |
| P0 - Bloqueante | Fuga o acceso no autorizado confirmado en evidencia autenticada. | Usuario autenticado ve datos de otro conjunto; residente ve datos de otro residente; usuario sin membership activa accede a datos protegidos; vigilancia accede a funciones admin sensibles; residente accede a funciones admin/vigilancia sensibles; API devuelve datos cross-tenant. |
| P1 - Alto | Riesgo alto o dependencia insegura sin fuga confirmada. | Policies amplias exponen más datos de lo esperado; módulo funciona por fallback legacy; dependencia crítica de `usuarios_app`; helper legacy condiciona módulo crítico; respuesta API incluye campos sensibles innecesarios. |
| P2 - Medio | Evidencia incompleta o limitación de dataset. | Falta dato de prueba; endpoint devuelve 0 filas aunque módulo carga; evidencia Network incompleta; diferencia documental entre app y SQL. |
| P3 - Bajo | Mejora menor o pendiente no bloqueante. | Captura pendiente; nombre de endpoint poco claro; mejora menor de checklist. |

## 14. Criterios Go

Se puede avanzar hacia hardening RLS controlado posterior si:

- Existen usuarios de prueba suficientes o la brecha queda documentada con responsable y siguiente paso.
- Se valida `admin_conjunto`, `vigilancia`/`vigilante` y `residente` en DEV, o se documenta explícitamente por qué residente queda pendiente.
- No hay P0 abierto.
- Todo P1 tiene plan documentado.
- No se expusieron tokens, cookies ni llaves en evidencia.
- SQL Editor no se usó como evidencia final de `auth.uid()` real.
- QA y PRD no fueron tocados.
- No se modificaron migraciones, RLS, helpers, frontend funcional, `.env` ni Vercel.

## 15. Criterios No-Go

No se debe avanzar si:

- No existe usuario residente DEV y no se autoriza prepararlo.
- Se evidencia acceso cross-tenant.
- Se evidencia acceso de residente a datos de otro residente.
- Se expone JWT, token, cookie o llave en evidencia compartida.
- Se usa SQL Editor como evidencia final autenticada.
- Se toca QA o PRD por error.
- Se requiere modificar RLS para que el flujo funcione durante esta fase.
- Hay P0 sin plan inmediato y responsable.

## 16. Comentario sugerido de cierre

```markdown
FASE 3D.7 cerrada en DEV con evidencia efectiva autenticada por rol.

Resumen:
- admin_conjunto DEV: <Go/Go condicionado/No-Go>.
- vigilancia/vigilante DEV: <Go/Go condicionado/No-Go>.
- residente DEV: <Go/Go condicionado/No-Go>.
- Usuario residente DEV: <existente/preparado por operador/autorización pendiente>.
- P0 abiertos: <0/lista>.
- P1 abiertos con plan: <lista>.
- Tokens/cookies/llaves expuestos: No.
- SQL Editor usado como evidencia final de auth.uid(): No.
- QA/PRD tocados: No.

Decisión: <Go/No-Go> hacia hardening RLS controlado posterior.
Siguiente fase recomendada: priorizar hardening controlado de policies amplias y helpers legacy según hallazgos efectivos.
```

## 17. Recomendación para la siguiente fase

Si FASE 3D.7 termina en Go o Go condicionado sin P0, la siguiente fase debe enfocarse en hardening RLS controlado, priorizando:

1. Policies `USING true` en `archivos` y `config_pagos`, según exposición efectiva observada.
2. Dependencias sensibles de helpers legacy `fn_auth_*`.
3. Grants de helpers tenant-aware a roles no necesarios.
4. Policies de escritura clasificadas como `sin_filtro_tenant_visible`.
5. Tablas con trazabilidad indirecta o pendiente: `archivos`, `notificaciones`, `reservas`, `pagos_eventos`.

Cualquier cambio estructural futuro debe incluir migración SQL, actualización de `docs/database-schema.md` y validación de consistencia con `supabase/migrations/`.
