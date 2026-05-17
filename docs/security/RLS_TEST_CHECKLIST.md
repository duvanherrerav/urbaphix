# Checklist de pruebas RLS — Urbaphix

Este checklist debe ejecutarse antes y después de cualquier subfase que modifique policies, grants o funciones Supabase. Usar al menos dos conjuntos de prueba para validar aislamiento multitenant.

## 1. Preparación

- [ ] Confirmar ambiente objetivo: QA o PRD.
- [ ] Confirmar project ref y URL Supabase antes de iniciar.
- [ ] Tener usuario `admin` del conjunto A.
- [ ] Tener usuario `residente` del conjunto A.
- [ ] Tener usuario `vigilancia` del conjunto A.
- [ ] Tener usuario equivalente o datos semilla del conjunto B para pruebas negativas.
- [ ] Exportar auditoría readonly antes de cambios.
- [ ] Registrar hora de inicio, commit frontend desplegado y migración backend candidata si aplica.

## 2. Pruebas por rol

### Admin

- [ ] Login exitoso.
- [ ] Perfil carga con rol `admin` y `conjunto_id` correcto.
- [ ] Dashboard admin carga KPIs sin errores.
- [ ] Puede ver pagos del conjunto propio.
- [ ] Puede crear cobro para residentes del conjunto propio.
- [ ] Puede revisar reservas del conjunto propio.
- [ ] Puede revisar incidentes del conjunto propio.
- [ ] No ve datos de otro conjunto.
- [ ] Cerrar sesión limpia el estado local.

### Residente

- [ ] Login exitoso.
- [ ] Perfil carga con rol `residente`, `residente_id` y `conjunto_id` correctos.
- [ ] Puede ver sus pagos propios.
- [ ] Puede subir comprobante si el flujo está habilitado.
- [ ] Puede crear una visita.
- [ ] Puede ver notificaciones propias.
- [ ] Puede crear o consultar reservas permitidas.
- [ ] Puede ver paquetes propios.
- [ ] No ve pagos, visitas, paquetes ni reservas de otro residente.
- [ ] No ve datos de otro conjunto.
- [ ] No accede a paneles administrativos o de vigilancia.
- [ ] Cerrar sesión limpia el estado local.

### Vigilancia

- [ ] Login exitoso.
- [ ] Perfil carga con rol `vigilancia` y `conjunto_id` correcto.
- [ ] Panel de vigilancia carga visitas del día del conjunto propio.
- [ ] Escaneo QR consulta la visita esperada.
- [ ] Puede registrar ingreso de visita permitida.
- [ ] Puede registrar salida de visita permitida.
- [ ] Puede registrar paquetes si el flujo está activo para vigilancia.
- [ ] Puede registrar incidentes/novedades si el flujo está activo.
- [ ] No ve módulos administrativos de pagos o configuración.
- [ ] No ve datos de otro conjunto.
- [ ] Cerrar sesión limpia el estado local.

## 3. Pruebas por módulo

### Login

- [ ] Usuario válido inicia sesión.
- [ ] Usuario inválido recibe error controlado.
- [ ] Usuario autenticado sin fila válida en `usuarios_app` no accede a datos internos.
- [ ] Recarga del navegador mantiene sesión y perfil correcto.

### Dashboard

- [ ] Dashboard admin carga métricas de visitas, pagos, reservas, paquetes e incidentes.
- [ ] Métricas respetan `conjunto_id`.
- [ ] Errores RLS se muestran como falla controlada, no pantalla en blanco.

### Visitas

- [ ] Residente crea visita con visitante nuevo.
- [ ] Residente crea visita con visitante existente si aplica.
- [ ] `registro_visitas` queda asociado a `conjunto_id`, `residente_id` y apartamento correctos.
- [ ] Vigilancia visualiza visita del conjunto propio.
- [ ] Notificación de visita se crea para destinatarios esperados.

### Escaneo QR

- [ ] QR válido permite consultar visita.
- [ ] QR vencido o inválido no permite ingreso.
- [ ] Vigilancia registra ingreso con RPC autorizada.
- [ ] Vigilancia registra salida con RPC autorizada.
- [ ] Residente o usuario no autenticado no ejecuta RPC de vigilancia.

### Pagos

- [ ] Residente ve solo pagos propios.
- [ ] Admin ve pagos del conjunto propio.
- [ ] Admin crea cobro asociado a residente/apartamento del conjunto propio.
- [ ] Cambio de estado genera evento en `pagos_eventos`.
- [ ] Realtime de pagos no filtra eventos de otro residente/conjunto.
- [ ] Storage de comprobantes no expone comprobantes de otro residente.

### Reservas

- [ ] Residente ve recursos comunes activos del conjunto propio.
- [ ] Residente crea solicitud o reserva permitida.
- [ ] Admin aprueba/rechaza reserva del conjunto propio.
- [ ] Bloqueos afectan disponibilidad esperada.
- [ ] Vigilancia ve reservas relevantes si el módulo lo requiere.
- [ ] Eventos y documentos de reserva respetan conjunto/residente.

### Paquetería

- [ ] Vigilancia/admin registra paquete para apartamento válido.
- [ ] Residente ve solo paquetes propios.
- [ ] Admin/vigilancia ve paquetes del conjunto propio.
- [ ] Notificaciones de paquete llegan al residente correcto.
- [ ] No se pueden consultar paquetes de otro conjunto.

### Incidentes

- [ ] Vigilancia registra incidente del conjunto propio.
- [ ] Admin lista incidentes del conjunto propio.
- [ ] Cambio de estado queda visible para roles autorizados.
- [ ] No se listan incidentes de otro conjunto.

### Notificaciones

- [ ] Campana de notificaciones carga solo destinatario/conjunto permitido.
- [ ] Marcar como leída no afecta notificaciones de otros usuarios.
- [ ] Inserciones automáticas por visitas, pagos, paquetes e incidentes apuntan al destinatario correcto.

### Cerrar sesión

- [ ] Cerrar sesión invalida navegación privada.
- [ ] Botón atrás no muestra datos internos después del logout.
- [ ] Nueva sesión con otro rol no conserva caché del rol anterior.

## 4. Pruebas negativas obligatorias

- [ ] Usuario no autenticado no debe consultar datos internos por API.
- [ ] Usuario no autenticado no debe ejecutar RPC de visitas.
- [ ] Residente no debe ver datos de otro residente.
- [ ] Residente no debe ver datos de otro conjunto.
- [ ] Vigilancia no debe ver módulos administrativos.
- [ ] Vigilancia no debe editar pagos ni configuración.
- [ ] Admin solo debe ver datos del conjunto correspondiente.
- [ ] RPC de visitas no debe poder ejecutarse sin sesión si no corresponde.
- [ ] Tablas futuras/obsoletas no deben quedar expuestas innecesariamente.
- [ ] Tablas sin evidencia de uso actual no deben recibir permisos amplios por accidente.

## 5. Evidencia a guardar

- [ ] Resultado de auditoría readonly antes del cambio.
- [ ] Resultado de auditoría readonly después del cambio.
- [ ] Capturas de cada rol en módulos críticos si hay cambio visible.
- [ ] Logs de errores Supabase/PostgREST si aparecen.
- [ ] Commit exacto del frontend usado en pruebas.
- [ ] Migración exacta aplicada si corresponde a una subfase posterior.

## 6. Criterio de aprobación

Una subfase RLS solo debe aprobarse si:

- [ ] Login funciona para `admin`, `residente` y `vigilancia`.
- [ ] No hay exposición cruzada entre conjuntos.
- [ ] Los módulos productivos críticos funcionan sin errores RLS inesperados.
- [ ] Las RPC críticas rechazan usuarios no autorizados.
- [ ] La auditoría después del cambio coincide con el diseño esperado.
- [ ] Existe plan de reversión revisado por humano.
