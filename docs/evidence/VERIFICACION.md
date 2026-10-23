# Verificación — 2026-10-18

## Resultado de esta intervención

Cambios solicitados aplicados y build actualizado en `dist/`:

- Se retiró por completo la sección azul `#experiencia`, su ancla del menú y su CSS exclusivo.
- TikTok `@jcbarberhouse` está en contacto, pie y datos estructurados, con el enlace exacto proporcionado: `https://www.tiktok.com/@jcbarberhouse?_r=1&_t=ZS-9AfYPGAygh0`.
- El símbolo compartido de WhatsApp utiliza los paths oficiales de Tabler, verificados contra `https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/outline/brand-whatsapp.svg`.
- TikTok también usa el ícono de Tabler. Licencia MIT incluida en `public/tabler-icons-LICENSE.txt` y copiada al build.
- Hero corregido a WebP responsive real con JPEG de respaldo de la misma foto `corte1`; favicon enlazado al PNG generado. Se mantienen los originales.

## Comprobaciones ejecutadas

Entorno: Windows, PowerShell, Node `v24.19.0`, Vite `8.3.4`, Playwright `1.64.1`.
Las pruebas sirven producción y utilizan datos ficticios, reloj fijo y zona
del navegador Asia/Tokyo para contrastar la fecha argentina. WhatsApp se intercepta;
no se enviaron mensajes.

| Comando / comprobación | Resultado |
| --- | --- |
| `npm.cmd run check` | 18/18 unitarias y build aprobados. Pasaron los 12 casos Chromium y los primeros 5 Firefox; el proceso completo alcanzó el timeout de herramienta de 240 s. No se registra este comando como un check completo aprobado. |
| `npm.cmd run test:e2e -- --project=firefox --project=webkit --project=mobile` | 36/36 aprobados en 2,9 min; completa los 48 casos distintos de la suite junto con Chromium de la ejecución anterior. |
| `npm.cmd run build` tras corregir hero/favicon | Primer intento: `EPERM` al recrear `dist/images`. Reintento: aprobado en 7,12 s; generó web y HTML portable. |
| `npm.cmd run test:e2e -- --grep 'contenido\|diseño\|HTML portable\|axe'` | 20/20 aprobados en 3 min sobre el build final, en Chromium, Firefox, WebKit y emulación móvil Chromium. Incluye sin JavaScript. |
| Smoke con Playwright Chromium y Vite preview, puerto 4175 | Con JavaScript activado y desactivado: exactamente dos enlaces TikTok con URL exacta, `target=_blank`, `rel=noopener noreferrer`; JSON-LD incluye TikTok; `#experiencia` ausente; cero anclas rotas; path oficial de WhatsApp; hero carga `images/corte1-960.webp`. |
| Inspección de capturas finales | `page-390.png` y `page-1440.png` examinadas: bloque solicitado ausente, TikTok visible y sin solapamientos observados. |
| `npm.cmd run audit:performance` | Bloqueado antes de medir: `ERR_MODULE_NOT_FOUND` para Lighthouse. |
| Instalación aislada Lighthouse | `npm.cmd install --prefix C:\Users\Usuario\AppData\Local\Temp\opencode\jcbarber-audit-20261018 --no-audit --no-fund --ignore-scripts lighthouse@13.5.0`: timeout de herramienta a 120 s, sin salida ni finalización satisfactoria. |

### Cobertura funcional aprobada

- Carga de fotografías/logo, enlaces y ausencia de errores de consola o recursos propios en las pruebas.
- Responsive sin overflow en 320, 390, 768 y 1440 px.
- Calendario, cruce de año, bisiesto, sincronización con campo nativo y teclado.
- Validación, conservación de datos, foco de errores y revalidación al pasar el tiempo.
- WhatsApp con número y mensaje exactos, incluidos caracteres especiales y texto similar a HTML.
- Galería/menú: cierre por Escape y retorno de foco.
- axe WCAG A/AA sin violaciones en página y formulario con errores.
- Movimiento reducido, contenido/contacto sin JavaScript y HTML portable desde disco.

### Tamaños del build final

Salida de Vite: JavaScript 15,39 kB / **5,89 kB gzip**; CSS 17,29 kB /
4,52 kB gzip; HTML 32,65 kB / 9,30 kB gzip. El JS está por debajo del
presupuesto de 80 kB gzip. Estas cifras no son una medición de Lighthouse.

## Pendientes reales

1. **P02 / V18:** instalación limpia con `npm.cmd ci` aún no certificada. Se conserva la incidencia histórica de extracción de paquetes de Windows; no se sustituyó la instalación funcional durante esta sesión.
2. **P08:** recuperar Lighthouse y ejecutar `npm.cmd run audit:performance`. Performance, SEO, Best Practices, LCP y CLS no tienen medición aprobada. No hay informe Lighthouse generado.
3. **P09:** README, evidencia y artefacto entregados; cierre integral pendiente de P02/P08.

Para retomar en un entorno de instalación funcional: `npm.cmd ci`,
`npm.cmd run images`, `npx.cmd playwright install chromium firefox webkit`,
`npm.cmd run check` con al menos 10 minutos de límite de herramienta, y
`npm.cmd run audit:performance`. Revisar resultados antes de declarar cierre total.

## Evidencia visual

- [Escritorio, 1440 px](page-1440.png)
- [Celular, 390 px](page-390.png)

El calendario de las capturas está fijado al 31/12/2026 por la prueba; la página
normal calcula el día actual en Argentina. La web no está publicada en Internet.
