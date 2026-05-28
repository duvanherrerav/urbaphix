# FASE 3C.6 — Validación controlada del membership resolver en QA

## Objetivo de la fase

Preparar la validación compartida en QA del resolver híbrido de membresías (`tenant_memberships` + fallback `usuarios_app`) mediante feature flag, sin convertirlo en dependencia obligatoria y sin afectar producción.

La validación debe demostrar que:

- con `VITE_ENABLE_MEMBERSHIP_RESOLVER=false`, el frontend mantiene el flujo legacy basado en `usuarios_app`;
- con `VITE_ENABLE_MEMBERSHIP_RESOLVER=true` únicamente en QA, el frontend intenta resolver memberships activas compatibles;
- ante ausencia de datos, incompatibilidad o error de lectura de `tenant_memberships`, el sistema conserva fallback hacia `usuarios_app`;
- la navegación sigue recibiendo roles legacy compatibles (`admin`, `vigilancia`, `residente`).

## Diferencia entre DEV/local y QA

| Aspecto | DEV/local | QA |
| --- | --- | --- |
| Propósito | Prueba individual y depuración local del resolver. | Validación compartida, controlada y previa a cualquier decisión futura sobre PRD. |
| Configuración | Archivo local `.env.development` o variables locales de Vite. | Variables del ambiente QA (por ejemplo Vercel QA/Preview o `.env.qa` local si existe fuera del repositorio). |
| Valor seguro por defecto | `VITE_ENABLE_MEMBERSHIP_RESOLVER=false`. | `VITE_ENABLE_MEMBERSHIP_RESOLVER=false`. |
| Activación permitida | Manual local, sin impacto compartido. | Manual y coordinada solo para QA, con evidencia y ventana de rollback. |
| Observabilidad | Consola DEV con eventos del resolver. | Consola QA con evento controlado `membership_resolver_enabled` / `membership_resolver_disabled` desde el bootstrap. |
| Producción | No aplica. | No debe activar ni modificar PRD. |

## Alcance permitido

- Documentar activación/desactivación del feature flag en QA.
- Confirmar que el flag esperado es `VITE_ENABLE_MEMBERSHIP_RESOLVER`.
- Mantener `VITE_ENABLE_MEMBERSHIP_RESOLVER=false` como valor por defecto documentado.
- Validar navegación QA por rol con flag apagado y encendido.
- Validar fallback hacia `usuarios_app` cuando `tenant_memberships` no resuelve una membership compatible.
- Usar logs seguros, sin secretos ni identificadores sensibles.
- Definir rollback operativo únicamente por variable de entorno.

## Fuera de alcance

- No modificar Supabase.
- No crear migraciones.
- No ejecutar SQL automático.
- No modificar políticas RLS de tablas de negocio.
- No activar el resolver en PRD.
- No modificar `.env.production` para activar el resolver.
- No eliminar `usuarios_app`.
- No eliminar fallback legacy.
- No crear panel superadmin.
- No cambiar estructura de roles.
- No cambiar navegación principal salvo corrección mínima necesaria.
- No exponer secretos, emails, tokens, user ids, membership ids ni datos personales en logs.

## Configuración del feature flag

El flag canónico es:

```env
VITE_ENABLE_MEMBERSHIP_RESOLVER=false
```

Ese valor debe permanecer como default seguro en ejemplos, documentación y QA antes/después de la ventana de prueba.

La activación controlada para QA es:

```env
VITE_ENABLE_MEMBERSHIP_RESOLVER=true
```

Valores aceptados por el frontend cuando se desea activar el resolver:

- `true`
- `1`
- `yes`
- `on`

Cualquier otro valor, ausencia de variable o cadena vacía mantiene el resolver apagado y usa flujo legacy.

### Revisión de archivos de entorno

- `.env.example` documenta `VITE_ENABLE_MEMBERSHIP_RESOLVER=false` como default seguro.
- No hay `.env.qa` versionado en el repositorio al momento de esta fase; si existe localmente o en Vercel, no debe commitearse porque puede contener secretos.
- No se debe commitear ninguna clave real de Supabase, token, service role key o variable privada.
- No se debe modificar `.env.production` para esta fase.

## Procedimiento de activación controlada en QA

1. Confirmar que el despliegue/preview apunta a la rama de este PR contra `develop`, no a `main`, `qa` ni PRD.
2. Confirmar que el ambiente usa credenciales públicas de QA (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de QA), sin exponerlas en evidencia.
3. Confirmar valor inicial seguro:

   ```env
   VITE_ENABLE_MEMBERSHIP_RESOLVER=false
   ```

4. Ejecutar smoke test con flag apagado y registrar evidencia.
5. Cambiar únicamente en QA:

   ```env
   VITE_ENABLE_MEMBERSHIP_RESOLVER=true
   ```

6. Redeploy/rebuild del ambiente QA para que Vite compile la variable.
7. Abrir consola del navegador y confirmar evento controlado con `action: "membership_resolver_enabled"` en el bootstrap.
8. Ejecutar checklist con admin, vigilancia y residente si existe usuario disponible.
9. Si aparece error bloqueante propio del resolver, aplicar rollback operativo inmediato por flag.

## Procedimiento de desactivación en QA

1. Cambiar únicamente la variable QA a:

   ```env
   VITE_ENABLE_MEMBERSHIP_RESOLVER=false
   ```

2. Redeploy/rebuild del ambiente QA.
3. Confirmar en consola evento `membership_resolver_disabled` o ausencia de lecturas del resolver.
4. Repetir smoke test legacy de login y navegación.
5. No revertir código ni tocar base de datos para el rollback operativo.

## Checklist QA con flag apagado

Configurar:

```env
VITE_ENABLE_MEMBERSHIP_RESOLVER=false
```

Validaciones esperadas:

- [ ] Login admin QA funciona.
- [ ] Navegación admin carga módulos principales existentes.
- [ ] Login vigilancia QA funciona.
- [ ] Navegación vigilancia carga módulos principales existentes.
- [ ] Login residente QA funciona si hay usuario disponible.
- [ ] Navegación residente carga módulos principales existentes si aplica.
- [ ] No hay errores bloqueantes propios del resolver.
- [ ] El bootstrap usa flujo legacy directo contra `usuarios_app`.
- [ ] No existe dependencia obligatoria de `tenant_memberships`.
- [ ] No se modifica ni consulta PRD.

## Checklist QA con flag encendido

Configurar únicamente en QA:

```env
VITE_ENABLE_MEMBERSHIP_RESOLVER=true
```

Validaciones esperadas:

- [ ] El resolver se activa solo en QA; PRD conserva el flag apagado o ausente.
- [ ] La consola muestra evento controlado `membership_resolver_enabled` sin datos sensibles.
- [ ] Usuario con membership activa compatible resuelve desde `tenant_memberships` cuando exista dato válido.
- [ ] Usuario sin membership activa compatible cae a fallback `usuarios_app`.
- [ ] Error controlado de lectura de `tenant_memberships` no bloquea login si existe perfil legacy.
- [ ] Navegación admin se mantiene compatible con `usuarioApp.rol_id = "admin"`.
- [ ] Navegación vigilancia se mantiene compatible con `usuarioApp.rol_id = "vigilancia"`.
- [ ] Navegación residente se mantiene compatible con `usuarioApp.rol_id = "residente"` si hay usuario disponible.
- [ ] No se rompe bootstrap ni queda pantalla bloqueada por el resolver.
- [ ] No se registran emails, tokens, user ids, membership ids ni secretos en logs.

## Matriz de roles compatible en QA

Mientras no se migren por completo helpers, RLS y módulos a roles canónicos, la UI debe seguir usando roles legacy compatibles:

| `tenant_memberships.role_name` | Rol legacy entregado a la UI (`usuarioApp.rol_id`) | Navegación esperada |
| --- | --- | --- |
| `admin_conjunto` | `admin` | Dashboard y módulos administrativos. |
| `vigilante` | `vigilancia` | Portería, visitas, paquetería, incidentes y reservas de vigilancia. |
| `residente` | `residente` | Visitas, paquetes, pagos y reservas de residente. |

Roles canónicos aún no soportados por la navegación actual, como `contador` o `comite`, deben descartarse para fallback legacy durante esta fase.

## Criterios de rollback operativo

Aplicar rollback inmediato si ocurre cualquiera de estos casos en QA con flag encendido:

- Login admin o vigilancia queda bloqueado por comportamiento propio del resolver.
- Bootstrap queda en error persistente aunque exista perfil legacy en `usuarios_app`.
- Navegación por rol entrega módulos incompatibles.
- Se detectan logs con datos sensibles.
- El despliegue apunta por error a entorno o variables de producción.
- Hay dudas sobre consistencia de datos QA para `tenant_memberships` y la prueba no puede aislarse.

Rollback:

```env
VITE_ENABLE_MEMBERSHIP_RESOLVER=false
```

El rollback es exclusivamente operativo por variable de entorno, con rebuild/redeploy QA. No requiere revertir código, borrar datos, modificar Supabase ni ejecutar SQL.

## Evidencia esperada

Registrar evidencia sin secretos ni datos personales:

- Fecha/hora de la ventana QA.
- URL o identificador no sensible del deployment QA/preview.
- Captura o transcripción parcial del evento `membership_resolver_enabled` / `membership_resolver_disabled` sin tokens ni identificadores.
- Resultado de login admin con flag apagado y encendido.
- Resultado de login vigilancia con flag apagado y encendido.
- Resultado de login residente si existe usuario disponible.
- Resultado de fallback para usuario sin membership compatible o con membership inválida controlada.
- Confirmación de rollback a `VITE_ENABLE_MEMBERSHIP_RESOLVER=false`.

## Riesgos conocidos

- QA puede tener datos incompletos en `tenant_memberships`; esto debe activar fallback legacy, no bloquear el sistema.
- Algunos roles canónicos (`contador`, `comite`) existen en la tabla pero no están soportados por la navegación actual.
- Si QA no recompila después de cambiar variables Vite, el frontend puede seguir usando el valor anterior.
- RLS de `tenant_memberships` puede impedir lecturas en escenarios donde el usuario aún no tiene acceso activo; el resolver debe tratarlo como fallo controlado y usar legacy si existe.
- La evidencia manual puede contener datos sensibles si no se recorta; toda captura debe sanitizarse antes de compartirla.

## Checklist explícito de no impacto PRD

- [ ] El PR apunta a `develop`.
- [ ] No hay cambios en `supabase/migrations`.
- [ ] No hay migraciones nuevas.
- [ ] No se modifica RLS.
- [ ] No se modifica `.env.production` para activar el resolver.
- [ ] No se toca Vercel production.
- [ ] No se ejecutan cambios en PRD.
- [ ] `usuarios_app` sigue siendo compatibilidad obligatoria.
- [ ] Fallback legacy sigue activo.
- [ ] PRD continúa con flujo legacy hasta aprobación explícita de una fase posterior.
