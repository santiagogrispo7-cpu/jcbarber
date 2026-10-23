import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  // In Tokyo it is already Jan 1, but in Argentina it is still Dec 31.
  await page.clock.install({ time: new Date("2027-01-01T01:30:00Z") });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Confirmar turno por WhatsApp" }),
  ).toBeEnabled();
});

async function fillRequest(page, date = "2027-01-02") {
  await page.locator("#booking-mode").selectOption("home");
  await page.locator("#booking-service").selectOption("home");
  await page.getByLabel("Nombre y apellido", { exact: true }).fill("Ana & José + #2");
  await page.getByLabel("Fecha preferida", { exact: true }).fill(date);
  await page.getByLabel("Elegí un horario", { exact: true }).selectOption("18:00");
  await page
    .locator("#address")
    .fill("Calle de Prueba 123, piso +2 #B, Localidad de prueba");
}

test("contenido, cinco fotos, enlaces y recursos sin errores", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (
      response.url().startsWith("http://127.0.0.1") &&
      response.status() >= 400
    )
      errors.push(response.url());
  });
  await page.reload();
  await expect(page).toHaveTitle(/JC Barberhouse/);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("[data-phone]")).toHaveText("+54 9 3329 60-6138");
  await expect(page.locator("#ubicacion [data-address]")).toHaveText(
    "AVENIDA SAN MARTIN 743",
  );
  await expect(page.locator("#ubicacion [data-city]")).toHaveText("Baradero");
  await expect(page.locator(".gallery img")).toHaveCount(5);
  for (const img of await page.locator("img:not(#photo-full)").all()) {
    await img.evaluate((node) =>
      node.scrollIntoView({ behavior: "instant", block: "center" }),
    );
    await expect
      .poll(
        () => img.evaluate((node) => node.complete && node.naturalWidth > 0),
        {
          message: `Image should load: ${await img.getAttribute("src")}`,
        },
      )
      .toBeTruthy();
  }
  for (const link of await page.locator("[data-instagram]").all())
    await expect(link).toHaveAttribute(
      "href",
      "https://www.instagram.com/jc_barberhouse/",
    );
  await expect(page.locator("[data-maps]")).toHaveAttribute(
    "href",
    "https://www.google.com/maps/search/?api=1&query=AVENIDA%20SAN%20MARTIN%20743%2C%20Baradero",
  );
  for (const link of await page.locator('a[target="_blank"]').all())
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(errors).toEqual([]);
});

test("diseño sin overflow en 320, 390, 768, 1024 y 1440 px", async ({
  page,
}, testInfo) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBeTruthy();
    await expect(page.locator(".hero-actions .button")).toBeVisible();
    await expect(page.locator("#booking-form")).toBeVisible();
    if (testInfo.project.name === "chromium" && [390, 1440].includes(width)) {
      await page.screenshot({
        path: `docs/evidence/page-${width}.png`,
        fullPage: true,
      });
    }
  }
});

test("calendario argentino, cruce de año, sincronización y teclado", async ({
  page,
}) => {
  const input = page.getByLabel("Fecha preferida", { exact: true });
  await expect(input).toHaveAttribute("min", "2026-12-31");
  await expect(input).toHaveAttribute("max", "2027-03-31");
  await expect(input).toHaveValue("");
  await expect(page.locator("#calendar-title")).toHaveText("diciembre de 2026");
  await expect(
    page.getByRole("button", { name: "Mes anterior" }),
  ).toBeDisabled();
  const today = page.locator('[data-date="2026-12-31"]');
  await today.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-date="2027-01-01"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("2027-01-01");
  await page.keyboard.press("End");
  await expect(page.locator('[data-date="2027-01-03"]')).toBeFocused();
  await page.keyboard.press("Home");
  await expect(today).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect(page.locator('[data-date="2027-01-31"]')).toBeFocused();
  await page.keyboard.press("PageUp");
  await expect(today).toBeFocused();
  await input.fill("2027-03-31");
  await expect(page.locator('[data-date="2027-03-31"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Mes siguiente" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Mes anterior" }).click();
  await expect(page.locator("#calendar-title")).toHaveText("febrero de 2027");
});

test("año bisiesto seleccionable", async ({ page }) => {
  await page.clock.setSystemTime(new Date("2028-02-01T15:00:00Z"));
  await page.reload();
  await page.getByRole("button", { name: /29 de febrero de 2028/ }).click();
  await expect(page.getByLabel("Fecha preferida", { exact: true })).toHaveValue(
    "2028-02-29",
  );
});

test("errores accesibles conservan datos y no navegan", async ({ page }) => {
  await page.getByRole("button", { name: "Confirmar turno por WhatsApp" }).click();
  await expect(page.locator("#service-cards .service-card").first()).toBeFocused();
  await expect(page.locator("#error-name")).toBeVisible();
  await expect(page.locator("#date")).toHaveAttribute("aria-invalid", "true");
  await fillRequest(page);
  await page.locator("#date").fill("2026-12-30");
  await page.getByRole("button", { name: "Confirmar turno por WhatsApp" }).click();
  await expect(page.locator('#calendar button[tabindex="0"]:not(:disabled)')).toBeFocused();
  await expect(page.locator("#error-date")).toContainText("Turnos no disponibles");
  await expect(page.locator("#name")).toHaveValue("Ana & José + #2");
  await page.locator("#date").fill("2027-04-01");
  await page.getByRole("button", { name: "Confirmar turno por WhatsApp" }).click();
  await expect(page.locator("#error-date")).toBeVisible();
  expect(new URL(page.url()).hostname).toBe("127.0.0.1");
});

test("revalida hora y fecha cuando pasa el tiempo", async ({ page }) => {
  await page.clock.setSystemTime(new Date("2026-12-31T20:59:00Z"));
  await page.reload();
  await fillRequest(page, "2026-12-31");
  await page.clock.setSystemTime(new Date("2026-12-31T21:01:00Z"));
  await page.getByRole("button", { name: "Confirmar turno por WhatsApp" }).click();
  await expect(page.locator("select#time")).toBeVisible();
  await expect(page.locator("#time")).toBeFocused();
  await expect(page.locator("#error-time")).toBeVisible();
  await page.clock.setSystemTime(new Date("2027-01-01T03:01:00Z"));
  await page.getByRole("button", { name: "Confirmar turno por WhatsApp" }).click();
  await expect(page.locator("#date")).toHaveAttribute("min", "2027-01-01");
  await expect(page.locator("#error-date")).toBeVisible();
});

test("WhatsApp exacto y texto especial tratado como texto", async ({
  page,
}) => {
  await fillRequest(page);
  await expect(page.locator("#phone")).not.toHaveAttribute("required", "");
  await expect(page.locator("#phone")).toHaveValue("");
  const address = "<img src=x onerror=alert(1)> Timbre A&B + #2";
  await page.locator("#address").fill(address);
  await page.getByText("Ver resumen de mi solicitud", { exact: true }).click();
  await expect(page.locator("#booking-summary")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator("#booking-summary img")).toHaveCount(0);
  let target;
  await page.route("https://wa.me/**", async (route) => {
    target = new URL(route.request().url());
    await route.fulfill({
      contentType: "text/html",
      body: "<p>WhatsApp interceptado para la prueba.</p>",
    });
  });
  await page.getByRole("button", { name: "Confirmar turno por WhatsApp" }).click();
  await expect.poll(() => target?.hostname).toBe("wa.me");
  expect(target.pathname).toBe("/5493329606138");
  expect(target.searchParams.size).toBe(1);
  const text = target.searchParams.get("text");
  for (const value of [
    "Hola JC Barberhouse",
    "Ana & José + #2",
    "02/01/2027",
    "18:00 (hora de Argentina)",
    "Corte a domicilio",
    "30.000",
    "Incluye barba y perfilado de cejas.",
    "Domicilio:",
    address,
    "confirmar disponibilidad",
  ])
    expect(text).toContain(value);
  expect(text).not.toContain("Localidad:");
});

test("galería y menú: Escape y retorno de foco", async ({ page }) => {
  const opener = page.getByRole("link", {
    name: "Ampliar foto: degradado con terminación prolija",
    exact: true,
  });
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#photo-full")).toHaveAttribute(
    "src",
    /corte2-960.jpg$/,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(opener).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menú", exact: true }).click();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Ubicación" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Menú", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Menú", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("axe WCAG AA en página y formulario con errores", async ({ page }) => {
  await page.locator("#turnos").scrollIntoViewIfNeeded();
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("button", { name: "Confirmar turno por WhatsApp" }).click();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("movimiento reducido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
  expect(
    await page
      .locator(".button")
      .first()
      .evaluate((node) => getComputedStyle(node).transitionDuration),
  ).toBe("0s");
});

test("sin JavaScript se puede contactar y ver contenido", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173");
  await expect(
    page.getByRole("link", {
      name: "solicitar tu turno directamente por WhatsApp",
    }),
  ).toHaveAttribute("href", "https://wa.me/5493329606138");
  await expect(page.locator("#ubicacion [data-address]")).toBeVisible();
  await expect(page.locator(".gallery img")).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
