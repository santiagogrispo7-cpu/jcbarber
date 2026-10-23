# Acceso, integración y transferencia — 2026-10-20

## Diagnóstico y alcance

- Página pública y panel existentes conservados; no se cambió CSS, colores,
  tipografías ni estructura de las secciones previas.
- Login bloqueado por `fieldset disabled` dependiente de variables Supabase
  ausentes. Abrir módulos Vite mediante file:// tampoco funciona. Corregido el
  bloqueo de escritura y documentado el arranque HTTP.
- Auth por contraseña y autorización SQL ya existían. Se añadieron recuperación,
  invitaciones, entrega controlada por SQL y sincronización por polling (15 s/foco).
- No se recibió ni se inventó URL/clave de un proyecto real. No se crearon cuentas
  reales ni se enviaron correos ni se publicó en Vercel.

## Comprobaciones ejecutadas

| Comando | Resultado observado |
| --- | --- |
| `node supabase/tests/run-pglite.mjs` | PASS: bootstrap, ambas migraciones, suite SQL original; PostgreSQL 18.6 / PGlite 0.5.10 |
| `npm.cmd run test:booking -- access.spec.js` | 5/5 PASS inicial; luego se amplió cancelación y confirmación vencida |
| `npm.cmd run test:booking` | **22/22 PASS**, 9,1 min, Chromium; incluye 17 regresiones existentes y 5 nuevas |
| `npm.cmd run test:unit` | **18/18 PASS** |
| `npx.cmd vite build --outDir test-results/site-build-20261020` | PASS, build sin Supabase |
| `$env:JC_TEST_BUILD_DIR='test-results/site-build-20261020'; npx.cmd playwright test site.spec.js admin-setup.spec.js --project=chromium` | **12/12 PASS**, sitio/WhatsApp, recursos, responsive, teclado, axe, sin JS y diagnóstico del login sin configuración |
| `npx.cmd vite build --outDir dist-release` | PASS, artefacto local actualizado sin Supabase real |
| `node scripts/portable.mjs dist-release` | PASS; aviso existente de deprecación de inlineDynamicImports, no impide generar |
| `$env:JC_TEST_BUILD_DIR='dist-release'; npx.cmd playwright test portable.spec.js admin-setup.spec.js --project=chromium` | **2/2 PASS**, portable file:// y login HTTP sin configuración (este último repite el smoke sobre el artefacto final) |

Capturas `admin-390.png` y `admin-1440.png` regeneradas e inspeccionadas: sin
solapamientos/overflow observados; nueva sección de entrega usa las clases actuales.
Los 22 E2E incluyen axe en login y panel. Las capturas están ignoradas por Git.

## Recorrido certificado localmente

1. Cuenta temporal autenticada, allowlist verificado por SQL.
2. Otra página pública reserva y recibe comprobante del servidor.
3. El panel incorpora la reserva sin pulsar Actualizar agenda.
4. Un bloqueo creado desde el panel retira el horario de la página pública abierta.
5. La cancelación desde el panel devuelve el horario al selector del cliente.
6. El operador SQL prepara un destinatario ya existente en el fixture Auth.
7. Finalizar sin confirmación falla; la cuenta temporal no puede confirmar por él.
8. El destinatario entra y confirma; una confirmación vencida es rechazada.
9. Tras nueva confirmación, finalizar deja exactamente un UUID autorizado.
10. El JWT anterior recibe 42501 en snapshot, reservas, bloqueos, configuración
    y confirmación. El panel anterior borra datos privados automáticamente; volver
    a entrar tampoco concede acceso. El destinatario conserva acceso.

Otros casos: recuperación por email con redirect correcto, hash inválido/vencido,
confirmación de contraseña, token_hash e invitación implícita, ausencia de tokens
en URL/storage, prohibición SQL de autoalta y finalización desde anon/authenticated.

## Límites de esta evidencia

- RPC, restricciones, GRANT y RLS se ejecutaron en PostgreSQL embebido real.
  **Auth HTTP está simulado**. No certifica credenciales/JWT reales, SMTP, correos,
  recuperación real ni creación real de usuarios mediante el dashboard.
- PGlite tiene una conexión serializada; **no prueba concurrencia nativa**. El runner
  `supabase/tests/run-concurrency.mjs` sigue disponible para dos sesiones PostgreSQL
  en base descartable; no ejecutarlo contra agenda de producción.
- No hubo proyecto Supabase remoto configurado. R02 y R08 conservan ese pendiente.
- Los cuatro navegadores fueron certificados en la entrega anterior. En esta sesión
  se verificaron los cambios y regresiones en Chromium; no atribuir nuevas corridas
  Firefox/WebKit/móvil a esta revisión.
- `npm.cmd run build` falló por **EPERM persistente en dist/images**, incluso tras
  reintentar. No se tocaron permisos. `dist/` está incompleto; usar `dist-release/`
  para esta entrega local. El build de tests de reservas ahora usa una salida única
  ignorada, evitando contaminar el artefacto publicable con variables ficticias.
- Instalación limpia npm, Lighthouse y despliegue real Vercel siguen sin certificar.

Pasos de activación y entrega: [../RESERVAS.md](../RESERVAS.md).
