# Habilitar al administrador de JC Barberhouse

Guía vigente del panel de precios y bloqueos (2026-10-30).
`panel-admin.html` redirige a `/admin/`; la pantalla está en
`admin/index.html` y usa `admin.css`, `admin.js` y `src/supabase.js`.

## Qué significa el aviso de la captura

«Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY» significa que
**esa versión de la página no recibió la configuración del backend**. No es
un error de contraseña ni se soluciona creando una cuenta en el HTML.

- **En desarrollo:** Vite lee `.env`; Live Server, `python -m http.server`
  sobre las fuentes y abrir el archivo con doble clic no lo hacen.
- **En producción:** las variables se incorporan al compilar. Modificar `.env`
  o las variables de Vercel sin generar un nuevo build no cambia el sitio publicado.
- **En esta revisión:** `.env` ya contiene ambas variables públicas, pero el dominio
  configurado devolvió `DNS_ERROR_RCODE_NAME_ERROR` el 29/10/2026. Verificá el
  estado del proyecto y volvé a copiar su URL desde Supabase. No se puede deducir
  desde ese error si el proyecto fue eliminado, pausado o si la URL es incorrecta.

## 1. Conectar el proyecto correcto

1. Entrá en [Supabase Dashboard](https://supabase.com/dashboard) y abrí tu proyecto.
   Si está pausado, restauralo. Si ya no existe, necesitás uno nuevo.
2. En **Connect** o **Project Settings → API / API Keys**, copiá la **Project URL**
   y la clave **publishable** (`sb_publishable_…`) o la antigua **anon** del mismo proyecto.
3. Guardá en `.env`, junto a `package.json`:

   ```dotenv
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU-CLAVE-PUBLICA
   ```

   Reemplazá ambos marcadores por los valores reales. URL sin ruta ni barra final.
   No uses `service_role`, `sb_secret_…`, contraseñas ni tokens de sesión.
4. Detené el servidor anterior y ejecutá desde `D:\jcbarber`:

   ```powershell
   npm.cmd run dev
   ```

   Abrí la dirección informada por Vite seguida de `/admin/`, normalmente
   **http://127.0.0.1:5173/admin/**.

### Si la página está en Vercel

En el proyecto de Vercel → **Settings → Environment Variables**, agregá las
dos variables al entorno de la URL que estás usando (**Production** o **Preview**).
Después hacé **Deployments → Redeploy** y abrí el despliegue nuevo.

En otro hosting, ejecutá `npm.cmd run build` con las variables reales y publicá
la carpeta `dist/` completa. Un servidor estático sí puede servir ese build;
lo que no puede hacer es inyectar `.env` en las fuentes originales.

## 2. Preparar la base de datos

En **Supabase → SQL Editor**, ejecutá el contenido completo de las migraciones
pendientes, como propietario del proyecto. Para un proyecto nuevo son estas cinco,
en este orden:

1. `supabase/migrations/202610190001_booking_backend.sql`
2. `supabase/migrations/202610200001_admin_handover.sql`
3. `supabase/migrations/202610210001_customer_services.sql`
4. `supabase/migrations/202610220001_home_service_price.sql`
5. `supabase/migrations/202610290001_panel_integration.sql`

En una base existente, revisá cuáles ya se aplicaron y ejecutá sólo las pendientes.
No borres tablas ni repitas las migraciones para solucionar un error de acceso.
La última agrega las funciones del catálogo del panel y los bloqueos públicos.

## 3. Invitar al peluquero: él elige su contraseña

El peluquero recibe una invitación, abre el enlace, elige su contraseña y entra
con su correo. Después puede recuperarla por sí mismo desde **Olvidé mi contraseña**.
Vos sólo invitás su correo y autorizás esa cuenta una vez; no elegís ni conocés
su contraseña. Tu cuenta creada ayer puede seguir existiendo por separado.

### Preparación única del sitio y los correos

1. Publicá el build en una URL HTTPS estable, con las variables del paso 1.
   El enlace para el peluquero será `https://TU-DOMINIO/admin/`.
   `localhost` y `127.0.0.1` apuntan al dispositivo de quien abre el enlace:
   no sirven para entregarle acceso remoto a tu computadora.
2. En **Authentication → URL Configuration**, configurá:
   - **Site URL:** `https://TU-DOMINIO/admin/` (incluida la barra final).
   - **Redirect URLs:** esa misma URL exacta.
   - Sólo para pruebas locales, agregá también `http://127.0.0.1:5173/admin/`.
     No envíes una invitación al peluquero con localhost como destino.
3. En **Authentication → Email / SMTP Settings**, configurá un proveedor SMTP
   propio y un remitente verificado. El correo predeterminado de Supabase está
   restringido a direcciones del equipo del proyecto y tiene límites bajos;
   no alcanza para entregar correos a cualquier peluquero externo.
4. En **Email Templates**, conservá `{{ .ConfirmationURL }}` como enlace de
   **Invite user** y **Reset password**. Este panel procesa los callbacks
   estándar `type=invite` y `type=recovery`. También admite `token_hash` y `type`
   en `/admin/` si se usan plantillas personalizadas. No utiliza callbacks PKCE
   (`?code=…`). El proveedor de correo no debe reescribir los enlaces con tracking.
5. En **Sign In / Providers → Email**, habilitá correo/contraseña. El panel no
   necesita registro público: se puede mantener deshabilitado **Allow new users
   to sign up** y usar las invitaciones administrativas.

### Invitar y autorizar (propietario del proyecto)

1. En **Authentication → Users → Add user → Invite user**, escribí **sólo el
   correo del peluquero** y enviá la invitación. No uses tu propia cuenta para él.
   Si el diálogo permite indicar el destino, usá la URL pública `/admin/`.
2. Copiá el **User UID** de la cuenta invitada. En **SQL Editor**, ejecutá:

   ```sql
   insert into jc_private.authorized_admins (user_id)
   values ('UUID-DEL-USUARIO'::uuid)
   on conflict (user_id) do nothing;
   ```

   Reemplazá `UUID-DEL-USUARIO` por el UID real; **no por el correo**.
3. Comprobá la autorización:

   ```sql
   select u.id, u.email
   from auth.users u
   join jc_private.authorized_admins a on a.user_id = u.id;
   ```

   Debe aparecer la cuenta que acabás de habilitar.
4. El peluquero abre el enlace del correo: verá **Elegí tu contraseña** y su
   dirección de correo. Escribe dos veces una contraseña de al menos 8 caracteres
   (Supabase puede exigir una política más estricta) y pulsa **Guardar contraseña**.
5. La página vuelve al ingreso con su correo precargado. Él ingresa con la nueva
   contraseña y debe ver **Precios** y **Horarios**. La autorización sigue siendo
   comprobada en PostgreSQL; una invitación por sí sola no concede acceso al panel.

### Si la cuenta ya existe o el enlace venció

No dupliques ni borres la cuenta. Autorizá su UID si falta y pedile al peluquero
que abra la URL pública, pulse **Olvidé mi contraseña** y escriba su correo.
Recibirá un enlace para elegir una nueva clave. La respuesta del formulario no
revela si un correo está registrado. Los errores de envío y límites se muestran
sin afirmar que un correo fue entregado.

Al abrir el enlace se valida la sesión contra Supabase Auth y se quitan los
tokens de la dirección. Si recarga esa pestaña antes de guardar, continúa en el
formulario de contraseña. **Cancelar y volver** descarta la sesión del enlace.
Una vez guardada, se cierra esa sesión y se pide ingresar con la nueva clave.

### Entrega al peluquero

Compartí la URL pública `/admin/` y pedile que la guarde en favoritos. Él no
necesita Supabase, VS Code, Vite ni una terminal. El servidor local es sólo para
desarrollo. Comprobá con él una entrada real y una modificación de precio/bloqueo
antes de considerar terminada la entrega; no compartan contraseñas.

## 4. Diagnóstico rápido

| Mensaje | Qué revisar |
| --- | --- |
| Código fuente sin Vite | Iniciar `npm.cmd run dev` y abrir su dirección; no Live Server ni doble clic. |
| Faltan variables | `.env` local o variables del entorno de despliegue; reiniciar Vite / Redeploy. |
| No pudimos conectar | Internet, URL correcta y proyecto Supabase activo; no cambiar la contraseña para resolver DNS. |
| Clave pública inválida | URL y clave pública del mismo proyecto; reconstruir después de corregir. |
| Correo o contraseña incorrectos | Datos de la cuenta creada en **Authentication → Users** de ese proyecto. |
| Confirmá tu correo | Confirmación de la cuenta desde Auth o su correo de confirmación. |
| Cuenta sin permiso de administrador | Ejecutar el alta SQL con el UUID correcto; tener cuenta Auth no concede el rol. |
| Faltan funciones del panel | Aplicar las migraciones pendientes del paso 2. |
| Enlace vencido o no válido | Pedir otro desde Olvidé mi contraseña; revisar que los enlaces de correo apunten al panel publicado. |
| No llega la invitación/recuperación | Revisar spam, SMTP, remitente, límites y Auth Logs en Supabase. |

La sesión actual se conserva en `sessionStorage` de la pestaña para permitir
recargar; **Cerrar sesión** la elimina. Cada operación privada se autoriza en
PostgreSQL; la ayuda pública no concede permisos.

## Verificación de esta entrega

Pruebas aisladas de interfaz con respuestas Auth/RPC simuladas:

```powershell
npx.cmd playwright test --config=playwright.access.config.js
npm.cmd run build
```

Estas pruebas no crean cuentas ni certifican el proyecto remoto. El alta real
requiere al propietario conectado al dashboard de Supabase.

En esta computadora el build estándar encontró un bloqueo de permisos en
`dist/images`. La compilación y la comprobación de navegador se completaron en
una carpeta alternativa, sin cambiar permisos:

```powershell
npm.cmd run build:booking -- --outDir test-results/admin-invitation-final
node scripts/portable.mjs test-results/admin-invitation-final
```

El artefacto actual está en `test-results/admin-invitation-final/`. Si Windows
bloquea esa carpeta al recompilar, usá otra carpeta nueva como salida. Las pruebas
de invitación/recuperación cubren 24 casos en escritorio y móvil, además de las
20 regresiones de acceso. La apertura del enlace también se comprobó sobre el build.

El fallo DNS citado fue observado el 29/10, no es una comprobación actual de
tu cuenta. El 30/10 se verificó que Vite sí carga las variables; el usuario informa
que pudo ingresar con su cuenta. Confirmá proyecto y variables antes de publicar.
