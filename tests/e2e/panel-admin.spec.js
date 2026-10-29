import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const arDate = (offset) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offset * 86400000));

test("el panel sólo edita precios y bloquea horarios que el sitio deja de ofrecer", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/panel-admin.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");

  const nav = page.locator(".admin-nav");
  await expect(nav).toContainText("Precios");
  await expect(nav).toContainText("Horarios");
  await expect(nav).not.toContainText("Agenda");
  await expect(nav).not.toContainText("Estadísticas");
  await expect(page.locator(".admin-kpi, .admin-stat")).toHaveCount(0);

  const price = page.locator('[data-price-field="service.amount"]').first();
  await price.fill("23500");
  await page.locator("#prices-form button[type=submit]").click();
  await expect(page.locator("#prices-feedback")).toContainText(
    "Precios guardados",
  );

  const tomorrow = arDate(1);
  await page.fill("#block-date", tomorrow);
  await page.selectOption("#block-scope", "all-day");
  await page.selectOption("#block-mode", "all");
  await page.fill("#block-reason", "Feriado");
  await page.locator("#block-form button[type=submit]").click();
  await expect(page.locator(".block-card")).toHaveCount(1);
  await expect(page.locator(".block-card")).toContainText("Feriado");

  const dayAfter = arDate(2);
  await page.fill("#block-date", dayAfter);
  await page.selectOption("#block-scope", "time");
  await page.selectOption("#block-mode", "local");
  await expect(page.locator("#block-time option[value='09:00']")).toHaveCount(
    1,
  );
  await page.selectOption("#block-time", "09:00");
  await page.fill("#block-reason", "No puedo cortar");
  await page.locator("#block-form button[type=submit]").click();
  await expect(page.locator(".block-card")).toHaveCount(2);

  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".block-card")).toHaveCount(2);

  await page.goto("/");
  const service = page.locator('.service-card[data-id="corte-general"]');
  await expect(service.locator(".service-card-price")).toContainText("23.500");
  await service.click();
  await page.locator("#service-continue").click();

  const setDate = async (value) => {
    await page.locator("#date-input").evaluate((input, date) => {
      input.value = date;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  };

  await setDate(tomorrow);
  await expect(page.locator(".time-slot")).toHaveCount(0);

  await setDate(dayAfter);
  await expect(page.locator(".time-slot", { hasText: "09:00" })).toHaveCount(0);
  await expect(page.locator(".time-slot", { hasText: "09:30" })).toHaveCount(1);

  expect(errors).toEqual([]);
});

test("panel sin violaciones WCAG AA con precios y bloqueos", async ({
  page,
}) => {
  await page.goto("/panel-admin.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await page.locator("#block-form button[type=submit]").click();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
