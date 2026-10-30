import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const user = { id: "00000000-0000-4000-8000-000000000002", email: "peluquero@example.test" };
const sessionKey = "jcbarber.admin.session.v1";
const password = "Clave-propia-del-peluquero-2026";
const link = (type = "invite") => `/panel-admin.html#access_token=invite-access&refresh_token=invite-refresh&expires_in=3600&token_type=bearer&type=${type}`;

async function backend(page, { forbidden = false, invalidLink = false, failPassword = false } = {}) {
  const calls = [];
  await page.route("https://admin-access.test/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    calls.push({ path, method, data: request.postDataJSON(), authorization: request.headers().authorization });
    if (path === "/auth/v1/user" && method === "GET") {
      expect(request.headers().authorization).toBe("Bearer invite-access");
      return route.fulfill(invalidLink ? { status: 401, json: { code: "bad_jwt" } } : { json: user });
    }
    if (path === "/auth/v1/user" && method === "PUT") {
      expect(request.headers().authorization).toBe("Bearer invite-access");
      expect(request.postDataJSON()).toEqual({ password });
      if (failPassword) {
        failPassword = false;
        return route.fulfill({ status: 422, json: { code: "weak_password" } });
      }
      return route.fulfill({ json: user });
    }
    if (path === "/auth/v1/token") {
      expect(request.postDataJSON()).toEqual({ email: user.email, password });
      return route.fulfill({ json: { access_token: "login-access", refresh_token: "login-refresh", expires_in: 3600, user } });
    }
    if (path === "/auth/v1/verify") {
      expect(request.postDataJSON()).toEqual({ token_hash: "one-use-hash", type: "invite" });
      return route.fulfill({ json: { access_token: "invite-access", refresh_token: "invite-refresh", expires_in: 3600, user } });
    }
    if (path === "/auth/v1/recover") {
      expect(new URL(request.url()).searchParams.get("redirect_to")).toBe("http://127.0.0.1:4185/admin/");
      expect(request.postDataJSON()).toEqual({ email: user.email });
      return route.fulfill({ json: {} });
    }
    if (path === "/auth/v1/logout") return route.fulfill({ status: 204 });
    if (path.endsWith("/admin_snapshot")) {
      expect(request.headers().authorization).toBe("Bearer login-access");
      return route.fulfill(forbidden ? { status: 403, json: { code: "42501" } } : { json: {
        settings: {}, hours: [], blocks: [], services: [
          { id: "service-test", name: "Corte general", price: 18000, duration_minutes: 30, modes: ["local"], active: true },
        ],
      } });
    }
    if (path.endsWith("/public_site_catalog")) return route.fulfill({ json: { memberships: [] } });
    throw new Error(`Solicitud inesperada: ${method} ${path}`);
  });
  return calls;
}

async function ready(page, url) {
  await page.goto(url);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
}

async function savePassword(page) {
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repetí la contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Guardar contraseña", exact: true }).click();
}

async function login(page) {
  await page.getByLabel("Correo electrónico", { exact: true }).fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}

test("invitación: el peluquero elige su clave, recarga y entra sin compartirla", async ({ page }) => {
  const calls = await backend(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page, link());
  await expect(page).toHaveURL("http://127.0.0.1:4185/admin/");
  await expect(page.getByRole("heading", { name: "Elegí tu contraseña" })).toBeVisible();
  await expect(page.locator("#password-account")).toHaveText(`Cuenta: ${user.email}`);
  await expect(page.locator("#panel-view")).toBeHidden();
  await page.reload();
  await expect(page.locator("#password-form")).toBeVisible();
  expect(calls.filter((call) => call.path.includes("/rest/"))).toEqual([]);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repetí la contraseña", { exact: true }).fill("Otra-clave-distinta");
  await page.getByRole("button", { name: "Guardar contraseña", exact: true }).click();
  await expect(page.locator("#login-status")).toContainText("no coinciden");
  expect(calls.filter((call) => call.method === "PUT")).toEqual([]);
  await savePassword(page);
  await expect(page.locator("#login-status")).toContainText("Contraseña guardada");
  expect(await page.evaluate((key) => sessionStorage.getItem(key), sessionKey)).toBeNull();
  await expect(page.locator("#login-email")).toHaveValue(user.email);
  await expect(page.locator("#login-password")).toBeFocused();
  await expect(page.locator("#new-password")).toHaveValue("");
  await expect(page.locator("#panel-view")).toBeHidden();
  await login(page);
  await expect(page.locator("#panel-view")).toBeVisible();
  expect(errors).toEqual([]);
});

test("recuperación: pide correo y permite elegir una nueva contraseña", async ({ page }) => {
  await backend(page);
  await ready(page, "/admin/");
  await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
  await page.getByLabel("Correo de tu cuenta").fill(user.email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.locator("#login-status")).toContainText("Si existe una cuenta");
  await ready(page, link("recovery"));
  await savePassword(page);
  await expect(page.locator("#login-status")).toContainText("Contraseña guardada");
});

test("invitación sin permiso SQL: cambiar la clave no concede acceso administrativo", async ({ page }) => {
  await backend(page, { forbidden: true });
  await ready(page, link());
  await savePassword(page);
  await expect(page.locator("#login-form")).toBeVisible();
  await login(page);
  await expect(page.locator("#login-status")).toContainText("no tiene permiso de administrador");
  await expect(page.locator("#panel-view")).toBeHidden();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), sessionKey)).toBeNull();
});

test("enlace con token inválido: Auth lo rechaza y no se guarda sesión", async ({ page }) => {
  const calls = await backend(page, { invalidLink: true });
  await ready(page, link());
  await expect(page).toHaveURL("http://127.0.0.1:4185/admin/");
  await expect(page.locator("#login-status")).toContainText("El enlace venció");
  await expect(page.locator("#password-form")).toBeHidden();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), sessionKey)).toBeNull();
  expect(calls.filter((call) => call.path.includes("/rest/"))).toEqual([]);
});

test("sesión de invitación vencida: renueva sin perder el paso de contraseña", async ({ page }) => {
  await backend(page);
  await page.route("https://admin-access.test/auth/v1/token?grant_type=refresh_token", (route) => {
    expect(route.request().postDataJSON()).toEqual({ refresh_token: "invite-refresh" });
    return route.fulfill({ json: { access_token: "invite-access", refresh_token: "renewed-refresh", expires_in: 3600, user } });
  });
  await ready(page, link().replace("expires_in=3600", "expires_in=1"));
  await savePassword(page);
  await expect(page.locator("#login-status")).toContainText("Contraseña guardada");
});

test("sesión de invitación revocada: permite pedir otro enlace", async ({ page }) => {
  await backend(page);
  await page.route("https://admin-access.test/auth/v1/token?grant_type=refresh_token", (route) =>
    route.fulfill({ status: 400, json: { code: "refresh_token_not_found" } }),
  );
  await ready(page, link().replace("expires_in=3600", "expires_in=1"));
  await savePassword(page);
  await expect(page.locator("#login-status")).toContainText("El enlace venció");
  await expect(page.getByRole("button", { name: "Olvidé mi contraseña" })).toBeEnabled();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), sessionKey)).toBeNull();
});

test("enlace vencido de Supabase: limpia el error y ofrece recuperación", async ({ page }) => {
  const calls = await backend(page);
  await ready(page, "/admin/#error=access_denied&error_code=otp_expired&error_description=Expired");
  await expect(page).toHaveURL("http://127.0.0.1:4185/admin/");
  await expect(page.locator("#login-status")).toContainText("Olvidé mi contraseña");
  await expect(page.getByRole("button", { name: "Olvidé mi contraseña" })).toBeEnabled();
  expect(calls).toEqual([]);
});

test("plantilla con token_hash: verifica el enlace y conserva el destino del alias", async ({ page }) => {
  await backend(page);
  await ready(page, "/panel-admin.html?token_hash=one-use-hash&type=invite");
  await expect(page).toHaveURL("http://127.0.0.1:4185/admin/");
  await expect(page.locator("#password-form")).toBeVisible();
});

test("cancelar invitación descarta la sesión y no entra al panel al recargar", async ({ page }) => {
  await backend(page);
  await ready(page, link());
  await page.getByRole("button", { name: "Cancelar y volver" }).click();
  await expect(page.locator("#login-form")).toBeVisible();
  await page.reload();
  await expect(page.locator("#login-form")).toBeVisible();
  await expect(page.locator("#panel-view")).toBeHidden();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), sessionKey)).toBeNull();
});

test("política de contraseña: muestra rechazo de Auth y permite reintentar", async ({ page }) => {
  await backend(page, { failPassword: true });
  await ready(page, link());
  await savePassword(page);
  await expect(page.locator("#login-status")).toContainText("política de seguridad");
  await expect(page.locator("#password-form")).toBeVisible();
  await savePassword(page);
  await expect(page.locator("#login-status")).toContainText("Contraseña guardada");
});

test("error de envío: no afirma que se envió y permite volver al login", async ({ page }) => {
  await page.route("https://admin-access.test/**", (route) => route.fulfill({ status: 429, json: {} }));
  await ready(page, "/admin/");
  await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
  await page.getByLabel("Correo de tu cuenta").fill(user.email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.locator("#login-status")).toContainText("Esperá unos minutos");
  await expect(page.getByRole("button", { name: "Enviar enlace" })).toBeEnabled();
  await page.getByRole("button", { name: "Volver al ingreso" }).click();
  await expect(page.locator("#login-form")).toBeVisible();
});

test("formularios de alta y recuperación accesibles y sin desborde", async ({ page }) => {
  await backend(page);
  await ready(page, link());
  for (const mode of ["password", "recovery"]) {
    if (mode === "recovery") {
      await page.getByRole("button", { name: "Cancelar y volver" }).click();
      await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
    }
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(audit.violations).toEqual([]);
  }
});
