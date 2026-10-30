# Reservas reales y panel de administración — guía de activación

> **Acceso al panel actual (2026-10-29):** seguir [ADMIN_ACCESO.md](ADMIN_ACCESO.md).
> `/admin/` ahora sólo edita precios y bloqueos. Las secciones de agenda,
> invitaciones, recuperación y entrega de esta guía describen el panel anterior;
> sus controles no están en la interfaz actual. Crear la cuenta con contraseña
> desde Auth y autorizar su UUID según la guía vigente.

Sistema de turnos integrado en la página de JC Barberhouse, con backend
Supabase (PostgreSQL + Auth), validación atómica en el servidor y panel
privado responsive en `/admin/`. La página pública conserva su diseño,
recursos y flujo por WhatsApp como alternativa mientras las reservas están
pausadas.

Contenido:

- [1. Cómo funciona](#1-cómo-funciona)
- [2. Configurar Supabase](#2-configurar-supabase)
- [3. Primer usuario administrador](#3-primer-usuario-administrador)
- [4. Activar las reservas](#4-activar-las-reservas)
- [5. Panel de administración](#5-panel-de-administración)
- [6. Probar una reserva](#6-probar-una-reserva)
- [7. Qué falta para producción](#7-qué-falta-para-producción)
- [8. Recuperación de contraseña e invitaciones](#8-recuperación-de-contraseña-e-invitaciones)
- [9. Transferir la administración al peluquero](#9-transferir-la-administración-al-peluquero)
- [10. Publicar en Vercel](#10-publicar-en-vercel)

## Antes de empezar: cómo abrir el panel

Desde la raíz ejecutar `npm.cmd run dev` y abrir
**http://127.0.0.1:5173/admin/** (o el puerto informado por Vite).
La página pública está en **http://127.0.0.1:5173/**.
No abrir `admin/index.html` con doble clic: usa módulos que necesitan HTTP/HTTPS
y variables inyectadas por Vite. El HTML portable es sólo una vista del sitio público.

El bloqueo original de los campos era el `fieldset disabled` que sólo se habilitaba
con Supabase configurado. Ahora se permite escribir y se explica la configuración
faltante al enviar; esto no habilita un acceso ficticio. Con conexión real se valida
correo/contraseña en Supabase Auth y el UUID autorizado en PostgreSQL.

## 1. Cómo funciona

- El cliente elige modalidad (local/domicilio), servicio, día y horario
  realmente disponible, ingresa nombre, WhatsApp y — si es a domicilio —
   dirección, y confirma. El turno se guarda en Supabase y la
   página muestra un comprobante con número, servicio, horario y precio, más
   el botón **Confirmar por WhatsApp** con el mensaje preparado.
- **Agenda única:** un solo profesional; toda reserva ocupa su intervalo de
  servicio más el traslado (antes y/o después, según configuración) y el
  descanso. Local y domicilio se superponen: nunca hay dos clientes a la vez.
- El servidor (`supabase/migrations/202610190001_booking_backend.sql`) es la
  única autoridad: todas las RPC revalidan disponibilidad bajo un advisory
  lock y una restricción GiST impide solapamientos, incluso ante peticiones
  simultáneas. Un `request_id` UUID hace idempotente el reintento: la misma
  intención devuelve el mismo comprobante y nunca duplica turnos.
- La disponibilidad pública sólo expone horarios libres: sin nombres,
  teléfonos ni direcciones de otros clientes. Row Level Security está activa
  en todas las tablas (`jc_private`); el frontend sólo usa la clave pública
  publishable/anon. Las RPC administrativas exigen sesión Auth **y** estar en
  la lista privada de administradores.
- Sin variables Supabase, la página ofrece el mismo flujo de tres pasos por WhatsApp,
  con los servicios/precios confirmados y listas de horarios preferidos (sin verificar ocupación).
  Con Supabase configurado pero pausado o inaccesible se informa el estado y se
  mantiene el contacto directo por WhatsApp, sin confirmar reservas ficticias.
- Panel y disponibilidad pública se consultan automáticamente **cada 15 segundos**
  mientras la pestaña está visible y al recuperar el foco. Es actualización por
  polling, no WebSocket instantáneo. Cada escritura se valida inmediatamente en
  el servidor, aunque otra pestaña todavía muestre un horario anterior.

## 2. Configurar Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com) (plan gratuito
   suficiente). Elegir la región más cercana.
2. En **SQL Editor**, ejecutar como `postgres` el contenido completo de estos archivos,
   **una sola vez cada uno y en este orden**:
   - `supabase/migrations/202610190001_booking_backend.sql`
   - `supabase/migrations/202610200001_admin_handover.sql`
    - `supabase/migrations/202610210001_customer_services.sql`
    - `supabase/migrations/202610220001_home_service_price.sql`
    - `supabase/migrations/202610290001_panel_integration.sql`
   Ejecutar sólo las migraciones pendientes. La tercera actualiza los servicios,
   precios y franjas pedidos el 21/10/2026; conserva las reservas anteriores y
   los días habilitados por modalidad. No activa automáticamente la agenda.
   Detalle: [`supabase/README.md`](../supabase/README.md).
3. En **Project Settings → API**, copiar:
   - `Project URL` (pública);
   - `anon`/`publishable` key (pública). **Nunca** la `service_role`: el build
     la rechaza explícitamente (`vite.config.js`).
4. En el hosting/despliegue (y en `.env` local, copiado de `.env.example`):

   ```text
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU-CLAVE-PUBLICA
   ```

5. En **Authentication → Providers / Sign In & Providers → Email**, habilitar
   correo/contraseña. Desactivar **Allow new users to sign up** en la configuración
   de Auth: las cuentas se crean o invitan desde el dashboard. No hay registro público
   en la web. Configurar URLs y correo como indica la sección 8.
6. Reiniciar `npm.cmd run dev`, o reconstruir con `npm.cmd run build`. Sin ambas variables, el sitio sigue
   funcionando con el flujo de WhatsApp y el panel muestra que la conexión no
   está configurada.

La clave pública no da acceso a los datos: RLS y los privilegios revocados
del backend protegen las tablas; sólo existen las RPC documentadas en
`supabase/README.md`.

## 3. Primer usuario administrador

### Catálogo público actualizado (21/10/2026)

- Local: corte general **$18.000**, barba **$10.000**, perfilado de cejas **$8.000**; bloques de **30 minutos**.
- Domicilio: corte **$20.000**, incluye barba y perfilado de cejas; bloques de **45 minutos**.
- Ambas modalidades: **09:00–12:30 y 16:30–20:30**. Los turnos deben terminar dentro
  de la franja; los cierres no son horas de inicio. Últimos inicios teóricos:
  local 12:00/20:00; domicilio 11:15/19:30.
- En Supabase, ocupación, traslados, descansos y días habilitados pueden reducir
  esta lista. El cliente sólo ofrece bloques de la modalidad que también devuelve el servidor.
- Fechas anteriores a hoy (Argentina): bloqueadas y mensaje **“Turnos no disponibles”**.
- Los cambios futuros de precios deben coordinar catálogo SQL y contenido público
  (`src/services.js` e `index.html`) para evitar diferencias entre modos.

### Alta del administrador

1. Para tus pruebas, usar **tu correo**, no uno inventado. En Supabase →
   **Authentication → Users → Add user → Invite user**, invitarlo después de
   configurar la sección 8. Abrir el correo y establecer tu propia contraseña.
   Alternativamente, crear el usuario desde ese dashboard con contraseña fuerte
   y correo confirmado; no copiar la contraseña a archivos del proyecto.
2. Copiar el UUID del usuario creado.
3. En SQL Editor, como `postgres`:

   ```sql
   insert into jc_private.authorized_admins(user_id)
   values ('UUID-DEL-USUARIO'::uuid)
   on conflict (user_id) do nothing;
   ```

4. Abrir `/admin/` por HTTP/HTTPS y entrar con ese correo y contraseña.
5. Guardar el UUID como identificador del administrador temporal para la sección 9.

La autorización se compara contra esa lista privada en cada operación
administrativa; tener sesión no alcanza. Para revocar el acceso: `delete
from jc_private.authorized_admins where user_id = '…'::uuid;`.

## 4. Activar las reservas

Una instalación nueva deja la agenda **pausada** y 28 franjas deshabilitadas:
09:00–12:30 y 16:30–20:30 en ambas modalidades, **para todos los días de la
semana**, sin asumir qué días trabaja. Al actualizar una agenda existente,
la tercera migración conserva el estado habilitado por día/modalidad.

Desde el panel (**Configuración**):

1. **Servicios:** revisar los cuatro servicios de la tercera migración, con
   precios confirmados y duración de 30 min en local / 45 min a domicilio.
   El index público usa estos bloques; coordinar futuros cambios con `src/services.js`.
2. **Horarios:** habilitar sólo los días que trabaja y sus franjas; editar o
   revisar las franjas por modalidad. Sin franjas habilitadas un día = día libre.
3. **Descanso entre turnos, traslado antes y traslado después** (minutos):
   valores conservadores recomendados para domicilio (p. ej. 15–30 según la
   zona). Sin ellos no se pueden publicar reservas: el servidor exige
   definirlos antes de activar.
4. Días libres, vacaciones y bloqueos puntuales: sección
   **Bloqueos** (por horas con inicio/fin o por días, fin exclusivo). Los
   bloqueos afectan ambas modalidades.
5. Marcar **«Habilitar reservas públicas»** y guardar. Si falta algún dato,
   el panel avisa y la agenda sigue pausada; nada se inventa.

La grilla interna de 15 min permite ambos bloques públicos (30/45 min).
El panel permite editar la configuración SQL; el index además limita las
opciones a las franjas y bloques comerciales confirmados.

## 5. Panel de administración

Ruta: **`/admin/`** (misma identidad visual que el sitio; funciona bien en
celular). Requiere JavaScript y cuenta autorizada; `index.html` del panel
está marcado `noindex`.

- **Resumen:** turnos de hoy, próximo cliente, total de la semana con
  desglose local/domicilio y próximos turnos ordenados.
- **Agenda:** vista diaria y semanal con distintos indicadores visuales para
  turnos de local, domicilio, ocupados, bloqueados y disponibles; cada turno
  abre el detalle con teléfono, dirección y enlace «Contactar por WhatsApp».
- **Turno manual:** crear turnos telefónicos con la misma validación del
  servidor (reprogramar y cambiar estado: confirmado, completado, cancelado,
  ausente). Sólo cancelar libera el horario.
- **Bloqueos:** vacaciones, días libres y bloques por horas.
- **Configuración:** servicios, precios, duraciones, horarios por día,
  descansos, traslados, grilla y horizonte.

La sesión vive **en memoria**: recargar o cerrar la página exige volver a
ingresar. No se guardan datos de clientes en el navegador.

## 6. Probar una reserva

1. Activar reservas (paso 4) con al menos un servicio activo y una franja
   habilitada.
2. En una pestaña de incógnito, abrir el sitio → «Solicitar turno» → elegir
   modalidad, servicio, día y un horario → completar datos → «Reservar y continuar
   por WhatsApp». Debe aparecer el comprobante con el número de reserva y el enlace
   «Confirmar por WhatsApp» con los datos del turno.
3. En el panel: el turno aparece en Resumen y Agenda, y el horario deja de
   estar disponible para nuevos clientes (comprobar pidiendo otro turno en
   otra pestaña).
4. Prueba de doble reserva: abrir dos pestañas, elegir el mismo horario en
   ambas y confirmar en ambas: la segunda debe recibir «Ese horario se
   superpone…» sin crear un turno duplicado.
5. Cancelar desde el panel debe liberar el horario para reservar de nuevo.

Con datos de prueba use nombres ficticios; no se cargan datos reales de
clientes en las pruebas.

## 7. Qué falta para producción

Checklist antes de abrir reservas al público:

- [ ] Proyecto Supabase creado y ambas migraciones aplicadas sin errores.
- [ ] Primer administrador creado y añadido a `authorized_admins`.
- [ ] Servicios, precios, duraciones, días reales, horarios, descansos y
      traslados cargados desde el panel; agenda **habilitada**.
- [ ] Variables `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` en el
      despliegue y `npm.cmd run build` regenerado.
- [ ] `/admin/` accesible por HTTPS en el mismo dominio que el sitio.
- [ ] Reserva de prueba real hecha y verificada desde el panel.
- [ ] Recuperación e invitación probadas con correo real y SMTP configurado.
- [ ] Transferencia completada; sólo el UUID del peluquero queda autorizado.
- [ ] Sesión antigua del administrador temporal rechazada por las RPC.
- [ ] Recordar al peluquero: la agenda pública se actualiza sola, pero las
      cancelaciones y cambios desde WhatsApp deben hacerse en el panel.

Mejoras posteriores (no incluidas): recordatorios por WhatsApp/correo,
notificaciones push/WebSocket, informes y estadísticas, y dominio/ciudad
exactos para SEO local. La verificación de concurrencia nativa entre dos
conexiones reales y el flujo PostgREST/JWT contra un proyecto Supabase real
quedan pendientes en este entorno (se verificó con PostgreSQL embebido;
ver `supabase/README.md` → «Pruebas y evidencia»).

## 8. Recuperación de contraseña e invitaciones

1. En **Authentication → URL Configuration**, establecer **Site URL** en
   `https://TU-DOMINIO/admin/`. Es el destino de Auth, no cambia la página pública.
   Durante una prueba sólo local puede usarse `http://127.0.0.1:5173/admin/`.
2. En **Redirect URLs**, agregar exactamente las URLs que se usarán:
   - `http://127.0.0.1:5173/admin/` para desarrollo;
   - `http://127.0.0.1:4173/admin/` si se prueba `npm.cmd run preview`;
   - `https://TU-DOMINIO/admin/` con el dominio real de Vercel o propio.
   Agregar cada preview explícitamente si se utiliza; evitar comodines generales.
3. En **Authentication → Email / SMTP Settings**, configurar un proveedor SMTP
   con remitente verificado, host, puerto, usuario y contraseña **del proveedor**.
   Estas credenciales van sólo en Supabase. El envío por defecto de Supabase tiene
   restricciones de destinatarios/cuotas; no asumir que permite enviar al peluquero.
4. En **Email Templates**, conservar los enlaces predeterminados
   `{{ .ConfirmationURL }}` para **Reset Password** e **Invite user**.
   La página acepta el fragmento `#access_token=…&refresh_token=…&type=recovery`
   o `type=invite`, valida la sesión contra Auth y retira el fragmento de la URL.
   Configurar una contraseña mínima de 12 caracteres en Auth para igualar el formulario.
5. Desde el login, abrir **Olvidé mi contraseña**, escribir el correo y solicitar
   el enlace. La respuesta no revela si una cuenta existe. Abrirlo, repetir la
   contraseña nueva, guardar y volver a iniciar sesión.
6. Si venció o fue utilizado, solicitar otro. No reenviar enlaces a terceros.
   Recargar antes de guardar descarta el token en memoria; abrir el enlace original
   otra vez si sigue válido o solicitar uno nuevo.

También se admiten plantillas `token_hash` (sin sesión persistida/PKCE). Si se elige
este formato, el enlace debe apuntar a la misma ruta `/admin/`:

```html
<!-- Reset Password; RedirectTo procede de la URL de recuperación permitida -->
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Cambiar contraseña</a>
<!-- Invite user; SiteURL debe terminar en /admin/ -->
<a href="{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=invite">Aceptar invitación</a>
```

La verificación del hash sólo se realiza al guardar la contraseña, no por abrir
el enlace. Tokens y contraseñas no se guardan en localStorage/sessionStorage.
Recuperar una contraseña **no concede permisos**: sigue siendo necesario el allowlist SQL.

## 9. Transferir la administración al peluquero

La entrega se realiza desde una conexión confiable (**SQL Editor como postgres**),
no editando JavaScript ni enviando claves privadas al navegador. Los marcadores de
UUID siguientes se reemplazan por los UUID reales de **Authentication → Users**.

### A. Crear y habilitar al destinatario

1. Invitar el correo del peluquero desde Auth como en la sección 3. Él abre su correo
   y elige su contraseña; no necesita compartirla con vos.
2. Copiar su UUID y preparar la transferencia:

```sql
select jc_private.prepare_handover(
  'UUID-DEL-ADMIN-TEMPORAL'::uuid,
  'UUID-DEL-PELUQUERO'::uuid
);
```

Se valida que el temporal esté autorizado y que el destinatario exista en Auth;
se habilita al peluquero sin quitar todavía tu acceso. Sólo admite una transferencia
pendiente a la vez. Las funciones privadas no se pueden ejecutar con un JWT del panel.

### B. Comprobar su cuenta

3. El peluquero entra desde otro navegador o una ventana privada, consulta reservas,
   crea un turno de prueba, lo reprograma/cancela y comprueba bloqueos/configuración.
4. Desde su propia cuenta pulsa **Confirmar mi acceso para la entrega** al final
   del panel. SQL comprueba que `auth.uid()` sea el destinatario preparado y registra
   la confirmación. La cuenta temporal no puede confirmarla en su lugar.
5. En SQL Editor consultar:

```sql
select source_id, target_id, prepared_at, confirmed_at, completed_at
from jc_private.admin_handover;
```

### C. Finalizar y revocar

6. Después de las comprobaciones, finalizar:

```sql
select jc_private.complete_handover('UUID-DEL-PELUQUERO'::uuid);
select user_id from jc_private.authorized_admins;
```

La primera sentencia exige confirmación del destinatario en las últimas 24 horas.
En una única transacción elimina **todos los otros administradores** y deja solamente
al peluquero. Comparte el lock de las operaciones de agenda; una escritura antigua
no puede pasar el control de permisos después de confirmarse la revocación.
La segunda consulta debe mostrar una sola fila: el UUID del peluquero.

7. En tu pestaña antigua, intentar actualizar, crear, bloquear o guardar: se deniega.
   El panel borra los datos privados al detectar la revocación (siguiente consulta,
   como máximo el intervalo de polling mientras esté visible). Aunque el JWT de Auth
   no haya vencido, ya no permite operaciones administrativas. Volver a iniciar sesión
   con tu contraseña tampoco recupera el rol. La revocación no puede borrar información
   que ya hubiera sido vista o copiada antes de la entrega.
8. Si la cuenta temporal no tendrá otro uso, eliminarla desde Auth después de
   conservar la evidencia de entrega. La tabla de entrega referencia esos usuarios:
   para borrar la cuenta Auth, primero archivar la evidencia y borrar **sólo el registro
   de entrega ya completado** desde SQL Editor; nunca borrar reservas del cliente.
   Esto es opcional: quitar el allowlist ya revoca por completo sus privilegios de agenda.
9. Entregar también el control de la infraestructura: agregar al peluquero como
   propietario en **Supabase Organization → Team/Members**, comprobar que accede al
   proyecto y quitar tu membresía cuando la organización lo permita. Hacer lo mismo
   con el proyecto/equipo de Vercel y el repositorio. Mantener control de SQL Editor,
   claves de servicio o del despliegue permitiría volver a conceder permisos; la
   revocación del panel no sustituye la transferencia de esas cuentas.

Si el destinatario no logra entrar, no finalizar; corregir Auth/SMTP y volver a probar.
Para una invitación enviada al UUID equivocado, el operador puede cancelar la preparación
con una transacción SQL que retire ese destinatario del allowlist y elimine la fila
pendiente de `admin_handover`; verificar ambos UUID antes. No hay botón público de autoalta.

## 10. Publicar en Vercel

1. Subir el proyecto al repositorio elegido, incluidos `public/`, `admin/`,
   `package.json`, `package-lock.json` y `vercel.json`. Mantener `.env` fuera de Git.
2. En Vercel, **Add New → Project**, importar ese repositorio, raíz del proyecto `.`.
3. Elegir **Vite**, Node.js **24.x**, instalación `npm ci`, build `npm run build`,
   salida `dist`. `vercel.json` ya declara framework/build/salida y cabeceras del panel.
4. En **Settings → Environment Variables**, agregar para Production las dos
   variables de la sección 2. Para Preview usar preferentemente otro proyecto Supabase
   de prueba. Ninguna clave `service_role`, `sb_secret_…` ni contraseña va en Vercel
   con prefijo `VITE_`; el build rechaza las claves privadas conocidas.
5. Crear el deployment. Al cambiar variables hace falta **Redeploy**: Vite las inyecta
   durante el build, no al abrir la página.
6. Copiar la URL real a Site URL/Redirect URLs de Auth según la sección 8. Si cambia
   el dominio, actualizar ambas configuraciones y volver a probar los correos.
7. Verificar `/` sin login y `/admin/` con login; realizar el recorrido de las secciones
   6 y 9 en el proyecto de prueba antes de habilitar clientes reales.

El HTML/CSS/JS del panel es un recurso estático público (sin datos ni secretos).
La agenda y todas las operaciones privadas están protegidas en Supabase; una regla
de rutas de Vercel por sí sola no concede ni verifica el rol administrativo.
No hace falta un rewrite SPA: son dos entradas HTML reales. No publicar el build de
pruebas de `test-results/`: usa un host ficticio. El artefacto publicable es `dist/`
reconstruido con las variables reales.
