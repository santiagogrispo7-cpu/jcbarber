import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-21T12:15:00Z") });
  await page.goto("/");
  await expect(page.locator("#booking-submit")).toBeEnabled();
});

test("tres pasos, cuatro servicios y límites completos de horarios de 30 y 45 minutos", async ({ page }, info) => {
  await expect(page.locator(".panel-number")).toHaveText(["1", "2", "3"]);
  await expect(page.locator("#comments")).toHaveCount(0);
  await expect(page.locator("#city")).toHaveCount(0);
  await expect(page.locator(".mode-button, .place-card, .time-button")).toHaveCount(0);
  await expect(page.locator("#service-cards .service-card:visible")).toHaveCount(4);
  for (const price of ["18.000", "10.000", "8.000", "30.000"]) await expect(page.locator("#service-cards")).toContainText(price);
  await expect(page.locator("#booking-service option")).toHaveCount(5);
  await page.locator('#service-cards .service-card[data-service-id="general"]').click();
  await page.locator('[data-date="2026-10-22"]').click();
  await expect(page.locator("#times-date")).not.toHaveText("");
  await expect(page.locator("select#time")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Elegí un horario", exact: true })).toHaveAttribute("id", "time");
  await expect(page.locator("#time")).toHaveJSProperty("tabIndex", 0);
  await expect(page.locator("#time")).not.toHaveClass(/sr-only/);
  await expect(page.locator(".step-card").nth(1).locator("#calendar")).toBeVisible();
  await expect(page.locator(".step-card").nth(1).locator("#time")).toBeVisible();
  await expect(page.locator('#time option:not([value=""])')).toHaveText([
    "09:00–09:30", "09:30–10:00", "10:00–10:30", "10:30–11:00",
    "11:00–11:30", "11:30–12:00", "12:00–12:30",
    "16:30–17:00", "17:00–17:30", "17:30–18:00", "18:00–18:30",
    "18:30–19:00", "19:00–19:30", "19:30–20:00", "20:00–20:30",
  ]);
  await expect(page.locator('#time option[value="12:30"], #time option[value="20:30"]')).toHaveCount(0);
  await page.locator("#time").selectOption("12:00");
  await expect(page.locator("#time")).toHaveValue("12:00");
  await expect(page.locator("#preview-time")).toHaveText("12:00 h");
  await expect(page.locator("#address")).toBeHidden();
  await expect(page.locator("#address")).not.toHaveAttribute("required", "");
  await page.locator('#service-cards .service-card[data-service-id="home"]').click();
  await expect(page.locator("#time")).toHaveValue("");
  await expect(page.locator('#time option:not([value=""])')).toHaveText([
    "09:00–09:45", "09:45–10:30", "10:30–11:15", "11:15–12:00",
    "16:30–17:15", "17:15–18:00", "18:00–18:45", "18:45–19:30", "19:30–20:15",
  ]);
  await expect(page.locator('#time option[value="12:00"], #time option[value="12:30"], #time option[value="20:15"], #time option[value="20:30"]')).toHaveCount(0);
  await page.locator("#time").selectOption("19:30");
  await expect(page.locator("#preview-time")).toHaveText("19:30 h");
  await expect(page.locator("#address")).toBeVisible();
  await expect(page.locator("#address")).toHaveAttribute("required", "");
  await expect(page.locator("#service-detail")).toContainText("Incluye barba y perfilado de cejas");
  await expect(page.locator("#phone")).not.toHaveAttribute("required", "");
  await page.locator("#time").selectOption("09:45");
  await page.locator("#name").fill("Juan Prueba");
  await page.locator("#address").fill("Calle de Prueba 123, Localidad de prueba");
  await expect(page.locator("#preview-service")).toHaveText("Corte a domicilio");
  await expect(page.locator("#preview-price")).toContainText("30.000");
  await expect(page.locator("#preview-date")).toHaveText("22/10/2026");
  await expect(page.locator("#preview-time")).toHaveText("09:45 h");
  const families = await page.evaluate(() => [document.body, document.querySelector("#booking-title"), document.querySelector("#booking-mode"), document.querySelector("#name"), document.querySelector(".calendar-day")].map((element) => getComputedStyle(element).fontFamily));
  expect(new Set(families).size).toBe(1);
  if (info.project.name === "chromium") {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator("#booking-form").screenshot({ path: `docs/evidence/customer-booking-${width}.png`, style: ".site-header { visibility: hidden !important; }" });
    }
  }
});

test("ayer bloqueado, mensaje al ingresarlo y límites que avanzan cada día", async ({ page }) => {
  await expect(page.locator('[data-date="2026-10-20"]')).toBeDisabled();
  await page.locator("#booking-mode").selectOption("local");
  await page.locator("#booking-service").selectOption("brows");
  await page.locator("#date").fill("2026-10-21");
  await expect(page.locator('#time option[value="09:00"]')).toHaveCount(0);
  await page.locator("#time").selectOption("09:30");
  await page.locator("#date").fill("2026-10-20");
  await expect(page.locator("#availability-status")).toContainText("Turnos no disponibles");
  await expect(page.locator("#time")).toBeDisabled();
  await expect(page.locator("#time")).toHaveValue("");
  await page.locator("#date").fill("2026-10-21");
  await page.clock.setSystemTime(new Date("2026-10-22T03:01:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("#date")).toHaveAttribute("min", "2026-10-22");
  await expect(page.locator("#availability-status")).toContainText("Turnos no disponibles");
  await page.locator("#date").fill("2026-10-22");
  await expect(page.locator("#time")).toBeEnabled();
});

test("local requiere nombre y apellido y prepara WhatsApp sin pedir domicilio", async ({ page }) => {
  await page.locator("#booking-mode").selectOption("local");
  await page.locator("#booking-service").selectOption("beard");
  await page.locator("#date").fill("2026-10-22");
  await page.locator("#time").selectOption("16:30");
  await page.locator("#name").fill("Ana");
  await page.locator("#booking-submit").click();
  await expect(page.locator("#error-name")).toContainText("nombre y apellido");
  await expect(page.locator("#name")).toBeFocused();
  await page.locator("#name").fill("Ana Prueba");
  await page.locator("#phone").fill("+54 9 3329 60-6138");
  await page.locator("#notes").fill("Timbre A, aviso 10 minutos antes.");
  let target;
  await page.route("https://wa.me/**", async (route) => {
    target = new URL(route.request().url());
    await route.fulfill({ body: "WhatsApp interceptado" });
  });
  await page.locator("#booking-submit").click();
  await expect.poll(() => target?.hostname).toBe("wa.me");
  const message = target.searchParams.get("text");
  expect(message).toContain("Servicio: Barba");
  expect(message).toContain("10.000");
  expect(message).toContain("16:30");
  expect(message).toContain("Teléfono: +54 9 3329 60-6138");
  expect(message).toContain("Comentarios: Timbre A, aviso 10 minutos antes.");
  expect(message).toContain("Local: AVENIDA SAN MARTIN 743, Baradero");
  expect(message).not.toContain("Domicilio:");
  expect(message).not.toContain("Localidad:");
});

test("cada tarjeta selecciona servicio y modalidad sin filtrar el catálogo; cambiar local/domicilio invalida la hora", async ({ page }) => {
  const cards = page.locator("#service-cards .service-card");
  await expect(cards).toHaveCount(4);
  await page.locator('[data-date="2026-10-22"]').click();
  for (const [id, mode, name, price] of [
    ["general", "local", "Corte general", "18.000"],
    ["home", "home", "Corte a domicilio", "30.000"],
    ["beard", "local", "Barba", "10.000"],
    ["brows", "local", "Perfilado de cejas", "8.000"],
  ]) {
    await test.step(name, async () => {
      const card = page.locator(`#service-cards .service-card[data-service-id="${id}"]`);
      await card.click();
      await expect(page.locator("select#booking-mode")).toHaveValue(mode);
      await expect(page.locator("select#booking-service")).toHaveValue(id);
      await expect(card).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('#service-cards .service-card[aria-pressed="true"]')).toHaveCount(1);
      await expect(cards).toHaveCount(4);
      await expect(page.locator("#service-cards .service-card:visible")).toHaveCount(4);
      await expect(page.locator("#booking-service option")).toHaveCount(5);
      await expect(page.locator("#preview-service")).toHaveText(name);
      await expect(page.locator("#preview-price")).toContainText(price);
      // 09:00 exists in both modes: it must still be cleared after changing service.
      await expect(page.locator("#time")).toHaveValue("");
      await expect(page.locator("#preview-time")).not.toContainText("09:00");
      await expect(page.locator("#date")).toHaveValue("2026-10-22");
      if (mode === "home") {
        await expect(page.locator("#address")).toBeVisible();
        await expect(page.locator("#address")).toHaveAttribute("required", "");
      } else {
        await expect(page.locator("#address")).toBeHidden();
        await expect(page.locator("#address")).not.toHaveAttribute("required", "");
      }
      await expect(page.locator("select#time")).toBeVisible();
      await page.locator("#time").selectOption("09:00");
      await expect(page.locator("#preview-time")).toHaveText("09:00 h");
    });
  }
});

test("tarjetas: hover sin seleccionar, check por teclado y movimiento reducido", async ({ page }, info) => {
  if (info.project.name === "chromium") await page.setViewportSize({ width: 1440, height: 1000 });
  const card = page.locator('.service-card[data-service-id="general"]');
  const step = page.locator('.step-card').first();
  await expect(page.locator('.service-card[data-mode="local"] .service-card-place')).toHaveText([
    "En la barbería", "En la barbería", "En la barbería",
  ]);
  await expect(page.locator('.service-card[data-mode="home"] .service-card-place')).toHaveText("A domicilio");
  await expect(card.locator('.choice-dot')).toHaveCSS("opacity", "0");
  await expect(card.locator('button, a')).toHaveCount(0);
  const screenshot = async (name) => {
    if (info.project.name === "chromium") await step.screenshot({
      path: `docs/evidence/services-${name}.png`,
      style: ".site-header { visibility: hidden !important; }",
    });
  };
  await screenshot("idle-1440");
  if (await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)) {
    await card.hover();
    await expect.poll(() => card.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42)).toBe(-5);
    await expect(card).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('#booking-service')).toHaveValue("");
    await screenshot("hover-1440");
  }
  await card.focus();
  await page.keyboard.press("Space");
  await expect(card).toBeFocused();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await expect(card.locator('.choice-dot')).toHaveCSS("opacity", "1");
  await expect(card.locator('.service-card-action')).toHaveText("Seleccionado");
  await screenshot("selected-1440");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(card).toHaveCSS("transform", "none");
  await expect(card).toHaveCSS("transition-duration", "0s");
  if (info.project.name === "chromium") {
    await page.setViewportSize({ width: 390, height: 900 });
    await screenshot("selected-390");
  }
});
