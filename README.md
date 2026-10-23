# JC Barberhouse

Página de barbería en español de Argentina, construida con **HTML, CSS y
JavaScript**, fotografías reales y logo proporcionado. Incluye un sistema de
**reservas reales con Supabase** (opcional) y un **panel de administración
privado** en `/admin/`. Sin la conexión configurada, la web funciona igual
que antes, solicitando turnos por WhatsApp.

## Abrir la página ahora

**Entrega local 2026-10-22:** tres pasos: cuatro tarjetas de servicios, calendario
con lista desplegable de horarios y datos para continuar por WhatsApp. Conserva
la tipografía y los colores actuales. Verificado de 320 a 1440 px.
Windows bloquea la salida habitual `dist/` y `dist-release/`; el build actualizado
y comprobado está en **`test-results/r11-three-final/`** (modo WhatsApp, sin Supabase).
Para verlo: `npm.cmd run preview -- --outDir test-results/r11-three-final`,
luego `http://127.0.0.1:4173/`.
El portable actualizado es `test-results/r11-three-final/jc-barberhouse.html`.
Conservá toda esa carpeta para trasladarlo. Está en una ruta temporal de pruebas:
no la borres antes de copiar la entrega a su destino.
Capturas y pruebas: [docs/evidence/TRES_PASOS.md](docs/evidence/TRES_PASOS.md).
Para usar el catálogo nuevo en Supabase, aplicar la tercera migración
`supabase/migrations/202610210001_customer_services.sql` según la guía de reservas.
Los nombres `dist/` de las instrucciones siguientes corresponden al build estándar
en un entorno sin este bloqueo, incluido el despliegue previsto en Vercel.

**Para la página pública portable**, abrí `dist/jc-barberhouse.html` con doble clic. Esta versión tiene CSS y
JavaScript incluidos y funciona directamente desde disco. Conservá las carpetas
de recursos al lado del archivo; para trasladarla, copiá la carpeta `dist/`
completa a otra computadora.

**Para probar reservas y administración**, usar `npm.cmd run dev` y abrir
`http://127.0.0.1:5173/` (clientes) y `http://127.0.0.1:5173/admin/` (administrador).
No abrir el HTML de `/admin/` con doble clic: requiere módulos servidos por HTTP/HTTPS.
Configurar Supabase siguiendo **[docs/RESERVAS.md](docs/RESERVAS.md)**.

La versión para publicar es **`dist/index.html`**, con CSS y JavaScript separados
en `dist/assets/`. Debe servirse por HTTP/HTTPS.

### Desarrollo local

En PowerShell, desde `D:\jcbarber`:

```powershell
npm.cmd run dev
```

Abrí la dirección que muestra Vite (normalmente `http://127.0.0.1:5173`).
Para ver el build de producción: `npm.cmd run preview` y
`http://127.0.0.1:4173`.

## Funciones incluidas

- Diseño adaptable, navegación móvil y enlaces de anclas.
- Cinco fotografías optimizadas, galería y ampliación con cierre por Escape.
- Reserva en tres pasos: servicio, fecha/horario y datos con confirmación por WhatsApp.
- Calendario mensual grande y fecha nativa sincronizados, selección con teclado.
- Nombre y apellido; dirección con localidad en un solo campo para atención a domicilio.
- Local: corte general $18.000, barba $10.000, perfilado de cejas $8.000 (30 min).
- Corte a domicilio $20.000 (45 min), incluye barba y perfilado de cejas.
- Selector de horarios de 09:00 a 12:30 y de 16:30 a 20:30; sólo bloques completos.
- Días pasados bloqueados y mensaje “Turnos no disponibles”; el límite avanza cada día.
- Validación de fechas civiles, años bisiestos y reloj de Argentina,
  independientemente de la zona horaria del visitante.
- Solicitud por WhatsApp a **+54 9 3329 60-6138**, con mensaje preparado.
- Reservas online reales (Supabase): modalidad local/domicilio, servicios con
  precio y duración, horarios realmente disponibles, agenda única con
  traslados y descansos, comprobante y prevención de dobles reservas.
- Panel privado `/admin/`: resumen del día y semana, agenda diaria/semanal,
  turnos manuales, estados, reprogramación, contacto por WhatsApp, bloqueos y
   configuración completa de horarios y servicios.
- Acceso por correo/contraseña con Supabase Auth, recuperación e invitaciones;
  entrega al peluquero con confirmación de acceso y revocación SQL del temporal.
- Actualización automática del panel y disponibilidad cada 15 segundos con pestaña
  visible y al volver al foco. El servidor valida inmediatamente cada reserva.
- Ubicación de referencia **AVENIDA SAN MARTIN 743** y búsqueda en Maps.
- Instagram: **https://www.instagram.com/jc_barberhouse/**.
- TikTok: **[@jcbarberhouse](https://www.tiktok.com/@jcbarberhouse?_r=1&_t=ZS-9AfYPGAygh0)**, en contacto y pie de página.
- Contacto directo y contenido comercial disponibles sin JavaScript.

La sección azul “Renová tu look. Quedate cómodo.” fue retirada por pedido del
usuario. El formulario conserva las instrucciones para solicitar el turno.
Los íconos de WhatsApp y TikTok son de [Tabler Icons](https://tabler.io/icons);
su licencia MIT se distribuye en `public/tabler-icons-LICENSE.txt` y en `dist/`.

**En modo WhatsApp sin Supabase**, el turno se solicita, no se confirma automáticamente. El visitante debe
enviar el mensaje dentro de WhatsApp; el negocio confirma disponibilidad,
cobertura y detalles. No hay agenda de cupos, base de datos ni almacenamiento
de domicilios en el navegador.

**Reservas reales (opcional).** Con Supabase configurado, el mismo formulario
pasa a mostrar servicios, precios y horarios disponibles de una agenda real,
  y la reserva se confirma en el acto con comprobante y enlace para continuar por WhatsApp. La actividad se administra
en `/admin/`. Guía completa de configuración, primer administrador y activación:
**[docs/RESERVAS.md](docs/RESERVAS.md)**; detalle del backend SQL:
[`supabase/README.md`](supabase/README.md).

## Instalación y comandos

Requisitos: Node.js **22.19 o superior**, npm y acceso a Internet para instalar
herramientas. En Windows usar `npm.cmd`/`npx.cmd`.

```powershell
npm.cmd ci
npm.cmd run images
npx.cmd playwright install chromium firefox webkit
npm.cmd run check
```

| Comando | Resultado |
| --- | --- |
| `npm.cmd run dev` | Servidor de desarrollo |
| `npm.cmd run images` | Genera WebP/JPEG y logo/favicon en `public/images/` |
| `npm.cmd run build` | Genera `dist/`, incluida la versión para doble clic |
| `npm.cmd run preview` | Sirve el build en el puerto 4173 |
| `npm.cmd run test:unit` | Pruebas de fechas, validación y mensaje |
| `npm.cmd run test:e2e` | Pruebas de producción en tres motores y emulación móvil |
| `npm.cmd run test:booking` | Reservas y panel contra SQL real (PGlite) interceptado |
| `npm.cmd run check` | Unitarias → build → E2E, deteniéndose ante fallos |
| `npm.cmd run audit:performance` | Lighthouse móvil, informes y presupuestos medidos |

`test:e2e` necesita un build previo. Playwright inicia y cierra su propio servidor.
Las pruebas interceptan WhatsApp: **no envían mensajes reales**. Datos de prueba
ficticios; no introducir información de clientes en los tests.

`test:booking` genera un build aislado en `test-results/booking-build-…/` apuntando a un host de pruebas interceptado
(`https://booking.test`) y responde cada RPC con la migración PostgreSQL real
vía PGlite: valida permisos, RLS, solapamientos e idempotencia sin tocar ningún
proyecto Supabase ni instalar nada fuera de `supabase/.tools/`. Sólo usa
Chromium y necesita el build de esa suite (puerto 4174).
No sobrescribe `dist/` con credenciales ficticias. Auth es simulado; las RPC,
permisos y RLS se ejecutan sobre PostgreSQL embebido real.

### Incidencia del entorno de entrega

La instalación convencional `npm ci` se bloqueó extrayendo paquetes en este
Windows, incluso con otras versiones de Node/npm y caché local. Se recuperaron
las herramientas de compilación y pruebas verificando los paquetes contra el
lockfile. **El build y la página portable están generados en `dist-release/`** y no necesitan
reinstalar nada para abrirse.

La auditoría Lighthouse y la instalación desde cero siguen pendientes de una
ejecución satisfactoria; consultar `docs/evidence/VERIFICACION.md`. No se atribuyen
puntuaciones de rendimiento a pruebas que no se pudieron ejecutar.

Verificación del sitio (2026-10-18): 18 unitarias y los 48 casos E2E aprobados en
dos ejecuciones; tras corregir hero/favicon, 20 comprobaciones focalizadas
aprobadas en los cuatro proyectos. TikTok, anclas y SVG se comprobaron con y
sin JavaScript. La auditoría no inició por falta del paquete Lighthouse; el
intento aislado de instalarlo alcanzó el límite de 120 segundos sin completarse.
Un error transitorio `EPERM` al recrear `dist/images` se resolvió reintentando
el build, sin cambiar permisos.

Verificación de acceso y reservas (2026-10-20): **22/22 E2E** aprobados, incluidas
recuperación/invitación, reserva pública, bloqueo/cancelación con actualización
automática, transferencia y revocación usando la sesión anterior. Ambas migraciones
y suite SQL original aprobadas. Evidencia: [docs/evidence/ACCESO.md](docs/evidence/ACCESO.md).

Si Windows mantiene bloqueado `dist/images`, generar la misma aplicación en la
carpeta alternativa (no cambiar permisos ni publicar la carpeta incompleta):

```powershell
npx.cmd vite build --outDir dist-release
node scripts/portable.mjs dist-release
npm.cmd run preview -- --outDir dist-release
```

Para comprobar otro build en este entorno, `JC_TEST_BUILD_DIR=dist-release` o
`test-results/NOMBRE` hace que Playwright sirva esa salida; por defecto sigue usando
`dist/`. En Vercel conservar `dist` y el comando estándar; no se ha certificado aún
la instalación limpia remota. Las variables reales deben estar definidas antes del build.

Las pruebas usan un solo worker. La grabación de trazas y el reporte HTML
presentaron bloqueos al cerrar archivos en este entorno; quedan desactivados
por defecto. En otro equipo se pueden solicitar con
`npm.cmd run test:e2e -- --trace=on --reporter=html`. Se mantienen los mismos
asserts, screenshots de fallos y errores descriptivos.

## Cambiar datos y fotografías

### Datos comerciales

Editar **`src/config.js`**: nombre, WhatsApp (sólo dígitos con código de país),
teléfono visible, Instagram, TikTok, dirección y servicio. El plugin
`scripts/content-plugin.mjs` lleva esos datos al HTML de desarrollo/producción,
incluidos metadatos y datos estructurados; el JavaScript usa el mismo contrato.

El HTML fuente conserva un contenido inicial legible. Para actualizar su texto
editorial, editar **`index.html`**; los datos comerciales del build tienen como
fuente de verdad la configuración. Volver a ejecutar `npm.cmd run build`.

`bookingHorizonDays: 90` es el rango técnico de solicitud, no un horario comercial.
La zona `America/Argentina/Buenos_Aires` se usa para validar fecha y hora al enviar.

### Galería

1. Conservar los originales en la raíz. El logo actual es `logo.jpg`.
2. Para agregar una foto, copiar un JPEG vertical 3:4 como `corte6.jpeg`.
3. Añadir una entrada a **`src/gallery.js`** con `stem: 'corte6'`, título,
   subtítulo, descripción de ampliación y texto alternativo fiel a la imagen.
4. Ejecutar `npm.cmd run images` y `npm.cmd run build`.

El mismo manifiesto genera los derivados y las tarjetas HTML. No hace falta
duplicar manualmente estructuras. Los cinco originales se preservaron intactos.
El hero usa `corte1`; para cambiarlo, modificar su `<picture>` en `index.html`.
Para imágenes de otra proporción, ajustar las dimensiones declaradas en el
plugin. El logo es pequeño: reemplazarlo por un original de mayor resolución
cuando esté disponible, manteniendo su identidad.

## Publicación

Subir **todo el contenido de `dist/`** a un hosting estático con HTTPS, con
`index.html` como documento inicial. Puede publicarse en una carpeta del sitio
para este despliegue en la raíz del dominio (`/` y `/admin/`).

Para publicar **con reservas reales**, definir en el hosting las variables
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (sólo la clave pública) antes
de compilar, aplicar las tres migraciones de Supabase en orden y seguir
[docs/RESERVAS.md](docs/RESERVAS.md). Sin esas variables el sitio se publica
igual, con el flujo de WhatsApp. La carpeta `/admin/` se publica dentro de
`dist/`. El HTML del login es público; sus datos y operaciones privadas quedan
protegidos por Auth y autorización SQL en cada solicitud.

**Vercel:** `vercel.json` configura Vite, `npm run build`, salida `dist` y cabeceras
del panel. Pasos exactos de variables, Auth/SMTP, publicación y transferencia:
[docs/RESERVAS.md §§8–10](docs/RESERVAS.md#10-publicar-en-vercel).

Si el hosting compila desde Git: instalar con `npm ci`, ejecutar
`npm run images && npm run build` y elegir `dist` como directorio de publicación.
Las fotos originales y `public/images` deben estar disponibles durante el build.

Tras tener un dominio real, añadir canonical, sitemap y URLs absolutas de la
imagen social. No se incluyeron URLs inventadas. El archivo portable lleva
`noindex` para evitar duplicar el documento principal en buscadores.

**La web no está publicada en Internet por esta entrega.**

## Archivos principales

```text
index.html                     Contenido y estructura
admin/index.html               Panel privado (requiere Supabase Auth)
src/styles.css                 Estilos y responsive
src/main.js                    Menú, galería e integración
src/config.js                  Datos del negocio
src/gallery.js                 Manifiesto de fotos
src/calendar.js                Calendario accesible
src/booking.js                 Formulario y navegación a WhatsApp
src/services.js                Catálogo público y bloques de 30/45 minutos
src/date-utils.js               Fechas y validación
src/whatsapp.js                 Mensaje y URL
src/booking-api.js              Cliente HTTP/Auth de Supabase (clave pública)
src/online-booking.js           Reserva real integrada en el formulario
src/admin.js y src/admin.css    Lógica y estilo del panel /admin/
supabase/migrations/           Backend SQL: tablas, RLS y RPC de agenda
supabase/README.md             Contrato del backend y pruebas SQL
tests/booking/                 E2E de reservas y panel sobre SQL real
scripts/                       Generación de assets, contenido y auditoría
tests/unit/ y tests/e2e/        Comprobaciones reproducibles
docs/RESERVAS.md               Guía de activación de reservas
docs/evidence/VERIFICACION.md   Resultados y limitaciones reales
PLAN_IMPLEMENTACION.md         Estado operativo y continuidad
```

### Datos pendientes del negocio

Ciudad exacta, zona de cobertura, días de atención, descansos y traslados.
Precios, duraciones y franjas ya confirmados el 21/10/2026. La tercera migración
los carga sin activar días desconocidos: los días reales, descansos y traslados
se configuran desde el panel antes de activar reservas
([docs/RESERVAS.md](docs/RESERVAS.md)). Los recordatorios automáticos quedan
como mejora futura.
