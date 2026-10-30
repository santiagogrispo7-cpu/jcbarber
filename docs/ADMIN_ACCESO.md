# Habilitar al administrador de JC Barberhouse

Guía vigente del panel de precios y bloqueos (2026-10-29).
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

## 3. Crear la cuenta y darle permiso

1. En **Authentication → Sign In / Providers → Email**, comprobá que el acceso
   por correo y contraseña esté habilitado. Las cuentas se crean desde el dashboard;
   este panel no tiene registro público.
2. En **Authentication → Users → Add user → Create new user**, ingresá el correo
   real del peluquero y una contraseña que cumpla la política configurada.
   Marcá **Auto Confirm User** para esa cuenta creada por el propietario.
   Si la cuenta ya existe, usá esa misma cuenta.
3. Copiá su **User UID** (UUID). En **SQL Editor**, ejecutá:

   ```sql
   insert into jc_private.authorized_admins (user_id)
   values ('UUID-DEL-USUARIO'::uuid)
   on conflict (user_id) do nothing;
   ```

   Reemplazá `UUID-DEL-USUARIO` por el UID real; **no por el correo**.
4. Comprobá la autorización:

   ```sql
   select u.id, u.email
   from auth.users u
   join jc_private.authorized_admins a on a.user_id = u.id;
   ```

   Debe aparecer la cuenta que acabás de habilitar.
5. Abrí **`/admin/`**, ingresá su correo y contraseña y comprobá que se muestren
   **Precios** y **Horarios**. El formulario sólo abre el panel después de que
   el backend autorice la consulta administrativa.

Para este panel usá **Create new user con contraseña**, no **Invite user**:
la interfaz actual no implementa el formulario para establecer una contraseña
desde enlaces de invitación/recuperación. Las instrucciones históricas de
`docs/RESERVAS.md` sobre esos formularios pertenecen al panel anterior.

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
npm.cmd run build:booking -- --outDir test-results/admin-access-release
node scripts/portable.mjs test-results/admin-access-release
```

Ese artefacto todavía contiene la configuración pública local cuyo proyecto no
resuelve. Primero corregí el proyecto y las variables, y después recompilá.
