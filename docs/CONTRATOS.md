# Contratos de implementación

Coordinador único: agente principal OpenCode. `index.html`, CSS, `src/main.js`, configuración y lockfiles son de su propiedad.

## Módulos de reservas (P05/P06)

- `src/config.js` exporta `config` (sólo lectura).
- `src/date-utils.js`: exportar `todayInArgentina(now)`, `addDays(isoDate, amount)`, `isValidDate(isoDate)` y `validateBooking(data, now)`. `now` opcional, por defecto `new Date()`. La validación devuelve un objeto de errores por nombre de campo; sin errores `{}`. Se pueden exportar utilidades adicionales.
- Datos normalizados: `name`, `date`, `time`, `address`, `comments`. El formulario usa `#notes` para comentarios; `phone` y `service` se agregan al mensaje. La localidad se incluye en `address`, sin campo `city` separado.
- `src/whatsapp.js`: `buildWhatsAppUrl(data)`, función pura, sin efectos de navegación.
- `src/calendar.js`: `initCalendar({ input, root, onSelect })`; raíz `#calendar`, input `#date`. Renderizar navegación y calendario dentro de esa raíz. Clases CSS pactadas: `.calendar-header`, `.calendar-title`, `.calendar-nav`, `.calendar-weekdays`, `.calendar-days`, `.calendar-day`, `.is-selected`, `.is-today`, `.calendar-empty`. Botones accesibles, sin `style` inline. Devolver función u objeto de refresco si lo necesita booking.
- `src/booking.js`: `initBooking()` conectará `#booking-form`, campos anteriores por ID y name, `#error-{field}`, `#form-status` (aria-live), `#booking-summary` (aria-live), botón submit `#booking-submit`. Activar el botón que comienza deshabilitado. Usar `window.location.assign(url)` al enviar para navegación síncrona comprobable. Sin persistencia de datos.
- `src/main.js` importa `initBooking` y lo llama. El coordinador realiza esa integración.
- HTML inicial mantiene contacto comercial sin JS. El formulario está dentro de `.booking-panel`; todos los errores tienen clase `.field-error` y `hidden` hasta que existan.

No editar archivos de otro propietario. El subagente entrega tests unitarios en `tests/unit/`, resultados y handoff en `docs/handoffs/booking.md`. El coordinador implementa tests E2E.

## Flujo público vigente — 2026-10-22

1. Cuatro tarjetas de servicios; la selección determina modalidad local/domicilio automáticamente. `#booking-mode` y `#booking-service` conservan el estado interno. El catálogo no se filtra por modalidad.
2. `#calendar` sincronizado con `#date`; `#time` es un select nativo visible. Local: intervalos completos de 30 minutos; domicilio: 45 minutos. Franjas 09:00–12:30 y 16:30–20:30.
3. Nombre/apellido, teléfono (obligatorio sólo online), dirección visible/requerida sólo para domicilio, notas y resumen antes de WhatsApp. Offline abre mensaje; online registra primero y ofrece comprobante con enlace.

`focusBookingField` sólo redirige foco de errores a controles visibles; no intercepta el foco normal del input de fecha (evita vaciado de fecha nativa en WebKit).
