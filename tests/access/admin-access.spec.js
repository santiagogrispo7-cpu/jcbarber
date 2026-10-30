import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const backend = "https://admin-access.test/**";
const sessionKey = "jcbarber.admin.session.v1";
const user = { id: "00000000-0000-4000-8000-000000000001", email: "peluquero@example.test" };

async function openLogin(page) {
  await page.goto("/panel-admin.html");
  await expect(page).toHaveURL(/\/admin\/$/);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#panel-view")).toBeHidden();
}

async function login(page) {
  await page.getByLabel("Correo electrónico", { exact: true }).fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("Una-clave-de-prueba-2026");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}

async function mockBackend(page, snapshotError) {
  await page.route(backend, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/v1/token") {
      return route.fulfill({ json: { access_token: "fake-access", refresh_token: "fake-refresh", expires_in: 3600, user } });
    }
    if (path === "/auth/v1/logout") return route.fulfill({ status: 204 });
    if (path.endsWith("/admin_snapshot")) {
      expect(route.request().headers().authorization).toBe("Bearer fake-access");
      if (snapshotError) return route.fulfill({ status: snapshotError.status, json: { code: snapshotError.code } });
      return route.fulfill({ json: { settings: {}, hours: [], blocks: [], services: [
        { id: "service-test", name: "Corte general", price: 18000, duration_minutes: 30, modes: ["local"], active: true },
      ] } });
    }
    if (path.endsWith("/public_site_catalog")) return route.fulfill({ json: { memberships: [] } });
    throw new Error(`Solicitud inesperada: ${path}`);
  });
}

test("sin variables: diagnóstico sin ayuda técnica ni falso estado de carga", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => {
    if (/\/auth\/v1|\/rest\/v1/.test(request.url())) requests.push(request.url());
  });
  await page.goto("http://127.0.0.1:4186/panel-admin.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#login-status")).toContainText("VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY");
  await expect(page.locator("#login-status")).toContainText("nuevo despliegue");
  await expect(page.locator("#admin-setup")).toHaveCount(0);
  await expect(page.getByText("Cómo habilitar al administrador", { exact: true })).toHaveCount(0);
  await expect(page.locator("#login-form")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#login-submit")).toBeDisabled();
  await expect(page.locator("#panel-view")).toBeHidden();
  expect(requests).toEqual([]);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(audit.violations).toEqual([]);
});

test("fuente sin transformar: explica que .env necesita Vite", async ({ page }) => {
  const source = await readFile(new URL("../../src/supabase.js", import.meta.url), "utf8");
  await page.route("**/src/supabase.js*", (route) => route.fulfill({ contentType: "text/javascript", body: source }));
  await openLogin(page);
  await expect(page.locator("#login-status")).toContainText("código fuente sin Vite");
  await expect(page.locator("#login-status")).toContainText("npm.cmd run dev");
  await expect(page.locator("#login-submit")).toBeDisabled();
});

test("cuenta autorizada: abre precios y horarios, recarga y cierra sesión", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockBackend(page);
  await openLogin(page);
  await expect(page.locator("#admin-setup")).toHaveCount(0);
  await login(page);
  await expect(page.locator("#panel-view")).toBeVisible();
  await expect(page.locator("#account-email")).toHaveText(user.email);
  await expect(page.locator(".admin-nav")).toContainText("Precios");
  await expect(page.locator(".admin-nav")).toContainText("Horarios");
  await page.reload();
  await expect(page.locator("#panel-view")).toBeVisible();
  await page.locator("#logout-button").click();
  await expect(page.locator("#panel-view")).toBeHidden();
  await expect(page.locator("#login-status")).toHaveText("Sesión cerrada.");
  expect(await page.evaluate((key) => sessionStorage.getItem(key), sessionKey)).toBeNull();
  expect(errors).toEqual([]);
});

test("cuenta sin autorización: indica contactar al responsable y descarta la sesión", async ({ page }) => {
  await mockBackend(page, { status: 403, code: "42501" });
  await openLogin(page);
  await login(page);
  await expect(page.locator("#login-status")).toContainText("no tiene permiso de administrador");
  await expect(page.locator("#login-status")).toContainText("Contactá al responsable");
  await expect(page.locator("#admin-setup")).toHaveCount(0);
  await expect(page.locator("#panel-view")).toBeHidden();
  await expect(page.locator("#login-submit")).toBeEnabled();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), sessionKey)).toBeNull();
});

test("base sin migraciones: informa configuración incompleta y mantiene cerrado el panel", async ({ page }) => {
  await mockBackend(page, { status: 404, code: "PGRST202" });
  await openLogin(page);
  await login(page);
  await expect(page.locator("#login-status")).toContainText("configuración del panel está incompleta");
  await expect(page.locator("#admin-setup")).toHaveCount(0);
  await expect(page.locator("#panel-view")).toBeHidden();
  await expect(page.locator("#login-submit")).toBeEnabled();
});

for (const error of [
  { name: "contraseña incorrecta", status: 400, body: { error_code: "invalid_credentials" }, message: "El correo o la contraseña son incorrectos." },
  { name: "error Auth 401 específico", status: 401, body: { error_code: "invalid_credentials" }, message: "El correo o la contraseña son incorrectos." },
  { name: "correo sin confirmar", status: 400, body: { error_code: "email_not_confirmed" }, message: "Confirmá tu correo" },
  { name: "clave de proyecto incorrecta", status: 401, body: { message: "Invalid API key" }, message: "La clave pública de Supabase no es válida." },
]) {
  test(error.name, async ({ page }) => {
    await page.route(backend, (route) => route.fulfill({ status: error.status, json: error.body }));
    await openLogin(page);
    await login(page);
    await expect(page.locator("#login-status")).toContainText(error.message);
    await expect(page.locator("#login-submit")).toBeEnabled();
    await expect(page.locator("#panel-view")).toBeHidden();
  });
}

test("proyecto inaccesible: permite reintentar y explica URL y estado", async ({ page }) => {
  await page.route(backend, (route) => route.abort("namenotresolved"));
  await openLogin(page);
  await login(page);
  await expect(page.locator("#login-status")).toContainText("que el proyecto esté activo");
  await expect(page.locator("#admin-setup")).toHaveCount(0);
  await expect(page.locator("#login-submit")).toBeEnabled();
  await expect(page.locator("#panel-view")).toBeHidden();
});
