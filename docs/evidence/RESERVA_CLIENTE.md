# Reserva del cliente — 21/10/2026

Evidencia funcional de R09. La presentación fue revisada posteriormente por pedido
del usuario; capturas actuales y comprobaciones de R10 en [DISENO_RESERVA.md](DISENO_RESERVA.md).

## Entrega

- Tres pasos: servicio, turno/datos y WhatsApp. Calendario grande, teclado y campo
  nativo sincronizados. Nombre y apellido; dirección/localidad sólo a domicilio.
- Comentarios opcionales retirados. Catálogo: corte general $18.000, barba $10.000,
  cejas $8.000, corte a domicilio $20.000 con barba y perfilado de cejas incluidos.
- Listas de 30 min (local) y 45 min (domicilio), dentro de 09:00–12:30 y
  16:30–20:30. Sólo turnos completos, sin horas pasadas de hoy.
- Días anteriores bloqueados; ingreso manual muestra “Turnos no disponibles”.
  Límites basados en Argentina, actualizados al pasar el día y al volver a la pestaña.
- En modo conectado se preservan las reservas transaccionales y el comprobante;
  se agrega WhatsApp con los datos reales del turno. La tercera migración incorpora
  servicios/franjas sin alterar reservas previas ni activar días desconocidos.

## Evidencia ejecutada

| Comando / alcance | Resultado |
| --- | --- |
| `npm.cmd run test:unit` | 22/22 PASS |
| `JC_TEST_BUILD_DIR=test-results/customer-offline` + `npx.cmd playwright test --project=chromium` | 16/16 PASS, sitio completo, responsive, axe y portable |
| `JC_TEST_BUILD_DIR=test-results/customer-final` + `npx.cmd playwright test customer-booking.spec.js --project=chromium --project=firefox --project=webkit --project=mobile` | 12/12 PASS |
| `npm.cmd run test:booking -- customer.spec.js access.spec.js` | Cinco casos de acceso/recorrido PASS; primera prueba nueva falla por esperar un campo no expuesto en admin_snapshot. La corrida alcanza timeout antes del cierre |
| `npm.cmd run test:booking -- customer.spec.js` | 2/2 PASS tras comprobar duración mediante ends_at − starts_at; SQL real, disponibilidad, reserva local/domicilio, WhatsApp y axe |
| `node supabase/tests/run-pglite.mjs` | Tres migraciones y dos suites SQL PASS, PostgreSQL 18.6/PGlite 0.5.10 |
| Build de producción y portable en `dist-release/` | PASS, flujo WhatsApp sin conexión remota |
| `JC_TEST_BUILD_DIR=dist-release` + `npx.cmd playwright test portable.spec.js site.spec.js --project=chromium --grep "HTML portable\|diseño sin overflow\|axe WCAG"` | 3/3 PASS sobre artefacto final, 320/390/768/1440 px |
| `git diff --check` | PASS; el proyecto sigue sin seguimiento, no certifica por sí solo todos los archivos nuevos |

En PowerShell, asignar el directorio de pruebas como `$env:JC_TEST_BUILD_DIR='…'`.

Capturas revisadas: `customer-booking-390.png` y `customer-booking-1440.png`.
El selector ocupa ancho completo en móvil, el calendario domina el paso 2 y no
se observaron recortes ni superposiciones. El header fijo se oculta **sólo durante
la captura del elemento** para no contaminar la evidencia al desplazar la página.

## Reproducción del build sin backend local

Existe `.env`; no se modificó. En PowerShell, asignar una variable vacía la elimina
y Vite vuelve a leer el archivo. Para probar el modo WhatsApp de forma aislada:

```powershell
node --input-type=module -e "process.env.VITE_SUPABASE_URL=''; process.env.VITE_SUPABASE_ANON_KEY=''; const {build}=await import('vite'); await build({build:{outDir:'dist-release'}});"
node scripts/portable.mjs dist-release
```

Primer build interrumpido por timeout; posteriores exitosos. El primer intento E2E
sin aislamiento leyó `.env` y falló; corregido con variables vacías dentro de Node.
Las pruebas de reserva usan host interceptado `booking.test` y clientes sintéticos.
No se enviaron mensajes WhatsApp ni se publicaron cambios.

## Pendientes externos

Aplicar `202610210001_customer_services.sql` en Supabase del propietario y publicar
el frontend actualizado. Activación/días/traslados reales, PostgREST/JWT, concurrencia
nativa y SMTP siguen en R08; Lighthouse e instalación limpia conservan su pendiente
histórico. La evidencia local no certifica la configuración remota.
