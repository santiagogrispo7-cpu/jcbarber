import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const widths = [320, 360, 390, 480, 600, 768, 1024, 1440, 1920];
const user = { id: "00000000-0000-4000-8000-000000000003", email: "peluquero.jcbarberhouse@example.test" };

async function mockSite(page) {
  const day = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await page.route("https://admin-access.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/v1/token") return route.fulfill({ json: { access_token: "responsive-access", refresh_token: "responsive-refresh", expires_in: 3600, user } });
    if (path.endsWith("/public_site_catalog")) return route.fulfill({ json: { settings: { booking_enabled: false }, services: [], memberships: [] } });
    if (path.endsWith("/public_blocked_ranges")) return route.fulfill({ json: [] });
    if (path.endsWith("/admin_snapshot")) return route.fulfill({ json: {
      settings: {}, hours: [],
      services: [
        { id: "general", name: "Corte general", price: 18000, duration_minutes: 30, modes: ["local"], active: true },
        { id: "domicilio", name: "Corte a domicilio", price: 20000, duration_minutes: 45, modes: ["home"], active: true },
        { id: "barba", name: "Barba", price: 10000, duration_minutes: 30, modes: ["local"], active: true },
        { id: "cejas", name: "Perfilado de cejas", price: 8000, duration_minutes: 30, modes: ["local"], active: true },
      ],
      blocks: [{ id: "block-test", starts_at: `${day}T12:00:00Z`, ends_at: `${day}T12:45:00Z`, reason: "Capacitación del peluquero y tareas de mantenimiento en la barbería." }],
    } });
    throw new Error(`Solicitud inesperada: ${path}`);
  });
}

async function fits(page, label) {
  const layout = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const overflow = [...document.querySelectorAll("body *")].filter((node) => {
      if (node.closest("svg, .sr-only, .skip-link, .admin-skip")) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && (rect.left < -1 || rect.right > width + 1);
    }).map((node) => `${node.tagName.toLowerCase()}#${node.id}.${String(node.className)}`);
    return { width, scroll: document.documentElement.scrollWidth, overflow };
  });
  expect.soft(layout.scroll, `${label}: ancho total`).toBeLessThanOrEqual(layout.width + 1);
  expect.soft(layout.overflow, `${label}: elementos fuera de pantalla`).toEqual([]);
}

test("responsive público: menú y los tres pasos, extras y membresías", async ({ page, browserName }, info) => {
  test.setTimeout(240000);
  await mockSite(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("#service-cards .service-card")).toHaveCount(2);
    await fits(page, `Inicio ${width}`);
    if (width <= 760) {
      await page.locator(".menu-toggle").click();
      await expect(page.locator(".main-nav")).toBeVisible();
      await fits(page, `Menú ${width}`);
      await page.locator('.main-nav a[href="#turnos"]').click();
      await expect(page.locator(".menu-toggle")).toHaveAttribute("aria-expanded", "false");
    }
    await page.locator("#service-cards .service-card").first().click();
    await page.locator("#extra-chips .extra-chip").last().click();
    await fits(page, `Extras ${width}`);
    await page.locator("#service-continue").click();
    await page.locator("#calendar-next").click();
    await page.locator(".calendar-day:not(:disabled)").first().click();
    await fits(page, `Calendario ${width}`);
    const previous = await page.locator("#calendar-prev").boundingBox();
    const title = await page.locator("#calendar-title").boundingBox();
    const next = await page.locator("#calendar-next").boundingBox();
    expect(previous.x + previous.width).toBeLessThanOrEqual(title.x);
    expect(title.x + title.width).toBeLessThanOrEqual(next.x);
    expect(previous.height).toBeGreaterThanOrEqual(44);
    if ([320, 390, 768, 1440].includes(width)) {
      await page.locator("#step-2").screenshot({ path: info.outputPath(`calendar-${width}.png`) });
    }
    await page.locator(".time-slot").first().click();
    await page.locator("#name").fill("Juan Pérez");
    expect(await page.locator("#name").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    await fits(page, `Datos ${width}`);
    await page.locator("#step-tab-1").click();
    await page.locator("#membership-cards .service-card").last().click();
    await fits(page, `Membresía ${width}`);
    await page.locator("#membership-continue").click();
    await page.locator("#address").fill("Rivadavia 123, Baradero");
    await fits(page, `Domicilio ${width}`);
    if (width === 390) {
      await page.locator("#step-tab-1").click();
      await page.locator("#service-cards .service-card").last().click();
      await page.locator("#service-continue").click();
      await page.locator(".calendar-day:not(:disabled)").first().click();
      await page.locator(".time-slot").first().click();
      await expect(page.locator("#address-field")).toBeVisible();
      await fits(page, "Corte a domicilio 390");
    }
  }
  if (browserName === "chromium") {
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(audit.violations).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test("responsive panel: ingreso, precios, bloqueos y controles accesibles", async ({ page, browserName }, info) => {
  test.setTimeout(180000);
  await mockSite(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/panel-admin.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#admin-setup")).toHaveCount(0);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await fits(page, `Login ${width}`);
    expect(await page.locator("#login-email").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    if (width === 390) await page.screenshot({ path: info.outputPath("login-390.png"), fullPage: true });
  }
  await page.getByLabel("Correo electrónico", { exact: true }).fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("Clave-responsive-2026");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.locator("#panel-view")).toBeVisible();
  await page.locator("#block-scope").selectOption("time");
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await fits(page, `Panel ${width}`);
    await expect(page.locator("#logout-button")).toBeVisible();
    expect((await page.locator(".admin-brand img").boundingBox()).width).toBeGreaterThanOrEqual(60);
    expect((await page.locator("#logout-button").boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await page.locator(".admin-price-field input").first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    if ([320, 390, 768, 1440].includes(width)) {
      await page.screenshot({ path: info.outputPath(`panel-${width}.png`), fullPage: true });
    }
  }
  if (browserName === "chromium") {
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(audit.violations).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test("responsive apaisado: menú y recuperación siguen utilizables", async ({ page }) => {
  await mockSite(page);
  await page.setViewportSize({ width: 667, height: 320 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".menu-toggle").click();
  const menu = await page.locator(".main-nav").boundingBox();
  expect(menu.y + menu.height).toBeLessThanOrEqual(320);
  await page.locator('.main-nav a[href="#turnos"]').click();
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
  await page.getByLabel("Correo de tu cuenta").fill(user.email);
  const send = page.getByRole("button", { name: "Enviar enlace" });
  await send.scrollIntoViewIfNeeded();
  await expect(send).toBeInViewport();
  await fits(page, "Recuperación apaisada");
});
