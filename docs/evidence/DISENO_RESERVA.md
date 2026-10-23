# Revisión visual de la reserva — R10, 21/10/2026

## Resultado

La primera presentación de los nuevos servicios no satisfizo al usuario. Se rehízo
la composición conservando Arial/Helvetica, tinta, azul profundo, fondos claros,
íconos y estilo de botones del resto de la página.

- Catálogo agrupado para local y domicilio, precios alineados y duración visible.
- Encabezados numerados con jerarquía y ayuda breve.
- Calendario amplio y enmarcado; selección azul, días pasados diferenciados y
  leyenda comprensible. Rangos e información secundaria después de los días.
- Fecha/horario y datos del cliente agrupados en la columna derecha en escritorio;
  en móvil y tablet se apilan antes de quedar demasiado estrechos.
- Resumen visible antes de confirmar: servicio, precio, fecha y hora.
- Botón y explicación WhatsApp alineados; mismo estilo en modo conectado.
- Selector muestra el nombre del servicio sin repetir el precio y cortarlo en
  pantallas pequeñas. El precio permanece visible en catálogo y resumen.

## Pruebas ejecutadas

| Verificación | Resultado |
| --- | --- |
| Build aislado `test-results/booking-design/` + portable | PASS |
| `JC_TEST_BUILD_DIR=test-results/booking-design` + `npx.cmd playwright test customer-booking.spec.js site.spec.js --project=chromium` | 14/14 PASS: contenido, recursos, teclado, fechas, WhatsApp, responsive, axe y nuevo resumen |
| Build final sin backend en `dist-release/` + portable | PASS |
| `npm.cmd run test:booking -- customer.spec.js` | 2/2 PASS: SQL real, reservas local/domicilio, resumen, WhatsApp y axe |
| `JC_TEST_BUILD_DIR=dist-release` + `npx.cmd playwright test customer-booking.spec.js --project=chromium --project=firefox --project=webkit --project=mobile` | 12/12 PASS |
| `JC_TEST_BUILD_DIR=dist-release` + `npx.cmd playwright test portable.spec.js site.spec.js --project=chromium --project=mobile --grep "HTML portable\|axe WCAG"` | 4/4 PASS |

En PowerShell, establecer la variable con `$env:JC_TEST_BUILD_DIR='…'`.
Las pruebas de presentación comprueban que body, títulos, select, input y días
del calendario usan la misma familia tipográfica calculada.

Las pruebas unitarias/SQL de R09 siguen vigentes para las reglas sin cambios;
esta revisión modifica presentación e integración del resumen.

## Inspección visual

Capturas del formulario con datos sintéticos y servicio a domicilio seleccionado:

- [320 px](customer-booking-320.png)
- [390 px](customer-booking-390.png)
- [768 px](customer-booking-768.png)
- [1024 px](customer-booking-1024.png)
- [1440 px](customer-booking-1440.png)

También se revisó [la página completa](page-1440.png) para comprobar continuidad
con hero, galería, contacto y pie. No se detectó overflow horizontal. En 320 px
el mes/año y el texto del botón usan dos líneas sin solaparse. El nombre del servicio
se ve completo tras quitar el precio duplicado de la opción. La evidencia de formulario
oculta el header fijo sólo durante la captura del elemento; la página real lo conserva.

## Artefacto y continuidad

Abrir `dist-release/jc-barberhouse.html` o ejecutar:

```powershell
npm.cmd run preview -- --outDir dist-release
```

La generación aislada sin Supabase usa variables vacías **dentro de Node**, según
[RESERVA_CLIENTE.md](RESERVA_CLIENTE.md), para evitar leer accidentalmente `.env`.
El archivo `.env` no fue modificado.

Esta revisión no publica el sitio. La actualización de la agenda remota y el
despliegue permanecen en R08: aplicar migración comercial pendiente y seguir
[la guía de reservas](../RESERVAS.md).
