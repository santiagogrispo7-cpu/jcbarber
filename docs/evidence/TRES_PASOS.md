# Reserva en tres pasos — 2026-10-22

## Entrega

- Paso 1: cuatro tarjetas visibles. Corte general $18.000, barba $10.000 y perfilado de cejas $8.000, 30 minutos en el local. Corte a domicilio $20.000, 45 minutos; incluye barba y perfilado de cejas.
- Paso 2: calendario y select nativo desplegable. Sólo intervalos completos dentro de 09:00–12:30 y 16:30–20:30. Cambiar servicio/modalidad invalida el horario anterior.
- Paso 3: nombre y apellido, teléfono, dirección sólo para domicilio, notas opcionales y WhatsApp. Se conservan los flujos offline y transaccional online.
- Paleta y tipografía conservadas. Tarjetas 4/2/1 columnas según ancho de pantalla.
- HTML corregido: fuentes WebP que apuntaban a JPEG, texto alternativo/dimensiones del hero y patrón telefónico compatible con validación HTML moderna. Anidamiento del hero corregido en la subtarea previa y preservado.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| `npm.cmd run test:unit` | 23/23 PASS |
| Build Vite offline + portable | PASS en `test-results/r11-three-final/` |
| E2E Chromium, suite completa sobre build final | 17/17 PASS, incluye axe WCAG AA, portable, teclado, recursos, responsive, WhatsApp y fechas |
| Flujo cliente Firefox | 4/4 PASS antes del ajuste de foco específico de WebKit |
| Flujo cliente WebKit y móvil, build final | 8/8 PASS |
| `npx.cmd playwright test --config=playwright.booking.config.js tests/booking/customer.spec.js` | 3/3 PASS con fixture SQL; no es certificación del Supabase remoto |
| Sintaxis JS + Prettier debug-check HTML/CSS | PASS en los archivos de implementación |

Capturas `customer-booking-{320,390,768,1024,1440}.png` en esta carpeta. Inspeccionadas visualmente 390 y 1440; todos esos anchos verificados automáticamente sin overflow.

## Fallos encontrados y resolución

- `dist-release/images`: EPERM de Windows. Se preservan permisos y se genera salida alternativa; `dist-release/` no es la entrega vigente.
- Primera suite Chromium terminó sus 17 casos con éxito, pero el proceso excedió el timeout al finalizar. La ejecución final aislada terminó normalmente: 17/17 PASS.
- WebKit: redirigir foco de `#date` a un botón al recibir `focusin` vaciaba la fecha al completarla. Se retiró esa redirección automática; el foco accesible de errores permanece explícito. Repetición completa cliente WebKit/móvil: 8/8 PASS.

## Abrir

```powershell
npm.cmd run preview -- --outDir test-results/r11-three-final
```

Visitar `http://127.0.0.1:4173/#turnos`. También funciona `test-results/r11-three-final/jc-barberhouse.html` desde disco, conservando las carpetas de recursos a su lado.

## Pendientes

Activación y publicación remota (R08) se mantienen pendientes. El build de revisión es offline; desarrollo usa la configuración local existente. La evidencia conectada usa una fixture local, sin operaciones sobre reservas del propietario.
