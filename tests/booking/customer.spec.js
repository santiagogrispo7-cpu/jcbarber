import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect } from "./db-fixture.js";
import { addDays, todayInArgentina } from "../../src/date-utils.js";

const test = base.extend({
  applyHomePriceMigration: [true, { option: true }],
});
const homePriceMigration = new URL("../../supabase/migrations/202610220001_home_service_price.sql", import.meta.url);

test.beforeEach(async ({ backend, applyHomePriceMigration }) => {
  await backend.db.exec(await readFile(new URL("../../supabase/migrations/202610210001_customer_services.sql", import.meta.url), "utf8"));
  if (applyHomePriceMigration) await backend.db.exec(await readFile(homePriceMigration, "utf8"));
});

test("tres pasos y cuatro tarjetas del catálogo RPC: modalidad automática y hora invalidada al cambiar", async ({ page, backend }) => {
  const catalog = await backend.call("public_catalog");
  expect(catalog.services).toHaveLength(4);
  await page.goto("/");
  await expect(page.locator(".panel-number")).toHaveText(["1", "2", "3"]);
  await expect(page.locator(".mode-button, .place-card, .time-button")).toHaveCount(0);
  await expect(page.locator("#city")).toHaveCount(0);
  await expect(page.locator("#booking-service option")).toHaveCount(5);
  await expect(page.locator("#service-cards .service-card:visible")).toHaveCount(4);
  for (const service of catalog.services) {
    const card = page.locator(`#service-cards .service-card[data-service-id="${service.id}"]`);
    await expect(card).toContainText(service.name);
    await expect(card).toContainText(Number(service.price).toLocaleString("es-AR"));
    await expect(card).toContainText(`${service.duration_minutes} min`);
  }
  await page.locator("#date").fill(backend.date);
  for (const name of ["Corte general", "Corte a domicilio", "Barba", "Perfilado de cejas"]) {
    await test.step(name, async () => {
      const service = catalog.services.find((item) => item.name === name);
      const mode = service.modes[0];
      const card = page.locator(`#service-cards .service-card[data-service-id="${service.id}"]`);
      await card.click();
      await expect(page.locator("select#booking-service")).toHaveValue(service.id);
      await expect(page.locator("select#booking-mode")).toHaveValue(mode);
      await expect(card).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('#service-cards .service-card[aria-pressed="true"]')).toHaveCount(1);
      await expect(page.locator("#service-cards .service-card")).toHaveCount(4);
      await expect(page.locator("#service-cards .service-card:visible")).toHaveCount(4);
      await expect(page.locator("#booking-service option")).toHaveCount(5);
      await expect(page.locator("select#time")).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Elegí un horario", exact: true })).toHaveAttribute("id", "time");
      await expect(page.locator("#time")).toHaveJSProperty("tabIndex", 0);
      await expect(page.locator("#time")).not.toHaveClass(/sr-only/);
      await expect(page.locator("#time")).toBeEnabled();
      // Wait for the new RPC result before checking reset: 18:00 is valid in both modes.
      const label = mode === "home" ? "18:00–18:45" : "18:00–18:30";
      await expect(page.locator("#time")).toContainText(label);
      await expect(page.locator("#time")).toHaveValue("");
      await expect(page.locator("#preview-time")).not.toContainText("18:00");
      await expect(page.locator("#booking-submit")).toBeDisabled();
      await expect(page.locator("#date")).toHaveValue(backend.date);
      await expect(page.locator("#preview-service")).toHaveText(name);
      await expect(page.locator("#preview-price")).toContainText(Number(service.price).toLocaleString("es-AR"));
      if (mode === "home") {
        await expect(page.locator("#address")).toBeVisible();
        await expect(page.locator("#address")).toHaveAttribute("required", "");
      } else {
        await expect(page.locator("#address")).toBeHidden();
        await expect(page.locator("#address")).not.toHaveAttribute("required", "");
      }
      await page.locator("#time").selectOption({ label });
      await expect(page.locator("#preview-time")).toHaveText("18:00 h");
      await expect(page.locator("#booking-submit")).toBeEnabled();
    });
  }
});

test("catálogo nuevo, bloques locales, comprobante y mensaje WhatsApp", async ({ page, backend }) => {
  const catalog = await backend.call("public_catalog");
  expect(catalog.services).toHaveLength(4);
  const selected = catalog.services.find((service) => service.name === "Corte general");
  expect(selected).toMatchObject({ price: 18000, duration_minutes: 30, modes: ["local"] });
  await page.goto("/");
  await page.locator("#booking-mode").selectOption("local");
  await page.locator("#booking-service").selectOption(selected.id);
  await expect(page.locator("#booking-service option")).toHaveCount(5);
  await page.locator("#date").fill(backend.date);
  await expect(page.locator("select#time")).toBeVisible();
  await expect(page.locator("#time")).toBeEnabled();
  // The fixture's five-minute break excludes services ending exactly at closing.
  await expect(page.locator('#time option:not([value=""])')).toHaveText([
    "09:00–09:30", "09:30–10:00", "10:00–10:30", "10:30–11:00", "11:00–11:30", "11:30–12:00",
    "16:30–17:00", "17:00–17:30", "17:30–18:00", "18:00–18:30", "18:30–19:00", "19:00–19:30", "19:30–20:00",
  ]);
  await page.locator("#time").selectOption({ index: 1 });
  await expect(page.locator("#preview-service")).toHaveText("Corte general");
  await expect(page.locator("#preview-price")).toContainText("18.000");
  await expect(page.locator("#preview-time")).toHaveText("09:00 h");
  await page.locator("#name").fill("Cliente");
  await page.locator("#phone").fill("+5493329600000");
  await page.locator("#booking-submit").click();
  await expect(page.locator("#name")).toBeFocused();
  expect(await page.locator("#name").evaluate((input) => input.validity.valid)).toBe(false);
  await page.locator("#name").fill("Cliente Prueba");
  await expect(page.locator("#phone")).toHaveAttribute("required", "");
  await page.locator("#phone").fill("");
  await page.locator("#booking-submit").click();
  await expect(page.locator("#phone")).toBeFocused();
  await page.locator("#phone").fill("+5493329600000");
  await page.locator("#notes").fill("Avisar al llegar, timbre A.");
  await expect(page.locator("#address")).toBeHidden();
  await expect(page.locator("#address")).not.toHaveAttribute("required", "");
  await expect(page.locator("#city")).toHaveCount(0);
  await expect(page.locator("#comments")).toHaveCount(0);
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(audit.violations).toEqual([]);
  await page.locator("#booking-submit").click();
  await expect(page.locator("#booking-receipt")).toContainText("Tu reserva está confirmada");
  const url = new URL(await page.getByRole("link", { name: "Confirmar por WhatsApp", exact: true }).getAttribute("href"));
  expect(url.hostname).toBe("wa.me");
  expect(url.pathname).toBe("/5493329606138");
  for (const text of ["Cliente Prueba", "Corte general", "18.000", "Comprobante:", "09:00"]) expect(url.searchParams.get("text")).toContain(text);
  const snapshot = await backend.call("admin_snapshot", { p_from: backend.date, p_to: backend.date }, "admin");
  expect(snapshot.bookings).toHaveLength(1);
  expect(snapshot.bookings[0]).toMatchObject({ price: 18000, customer_name: "Cliente Prueba", notes: "Avisar al llegar, timbre A." });
  expect(new Date(snapshot.bookings[0].ends_at) - new Date(snapshot.bookings[0].starts_at)).toBe(30 * 60000);
});

test("domicilio de 45 minutos, dirección requerida, fecha pasada sin horarios", async ({ page, backend }) => {
  const catalog = await backend.call("public_catalog");
  const selected = catalog.services.find((service) => service.name === "Corte a domicilio");
  expect(selected).toMatchObject({ price: 30000, duration_minutes: 45, modes: ["home"] });
  await page.goto("/");
  await page.locator(`#service-cards .service-card[data-service-id="${selected.id}"]`).click();
  await expect(page.locator("#booking-mode")).toHaveValue("home");
  await expect(page.locator("#booking-service")).toHaveValue(selected.id);
  await page.locator("#date").fill(backend.date);
  await expect(page.locator("select#time")).toBeVisible();
  await expect(page.locator("#time")).toBeEnabled();
  // Real SQL also reserves 15 minutes of travel on each side and a five-minute break.
  await expect(page.locator('#time option:not([value=""])')).toHaveText([
    "09:45–10:30", "10:30–11:15", "11:15–12:00",
    "17:15–18:00", "18:00–18:45", "18:45–19:30",
  ]);
  await expect(page.locator("#address")).toBeVisible();
  await expect(page.locator("#address")).toHaveAttribute("required", "");
  await page.locator("#time").selectOption({ index: 1 });
  await page.locator("#date").fill(addDays(todayInArgentina(), -1));
  await expect(page.locator("#availability-status")).toContainText("Turnos no disponibles");
  await expect(page.locator("#time")).toBeDisabled();
  await expect(page.locator("#time")).toHaveValue("");
  await expect(page.locator("#booking-submit")).toBeDisabled();
  await page.locator("#date").fill(backend.date);
  await expect(page.locator("#time")).toBeEnabled();
  await page.locator("#time").selectOption({ index: 1 });
  await page.locator("#name").fill("Cliente Domicilio");
  await page.locator("#phone").fill("+5493329600000");
  await page.locator("#booking-submit").click();
  await expect(page.locator("#address")).toBeFocused();
  await page.locator("#address").fill("Calle de Prueba 123, localidad de prueba");
  await page.locator("#booking-submit").click();
  await expect(page.locator("#booking-receipt")).toBeVisible();
  const url = new URL(await page.getByRole("link", { name: "Confirmar por WhatsApp", exact: true }).getAttribute("href"));
  const message = url.searchParams.get("text");
  expect(message).toContain("30.000");
  expect(message).toContain("Incluye barba y perfilado de cejas");
  expect(message).toContain("Calle de Prueba 123");
  const snapshot = await backend.call("admin_snapshot", { p_from: backend.date, p_to: backend.date }, "admin");
  expect(snapshot.bookings).toHaveLength(1);
  expect(snapshot.bookings[0]).toMatchObject({ mode: "home", customer_name: "Cliente Domicilio", price: 30000 });
  expect(new Date(snapshot.bookings[0].ends_at) - new Date(snapshot.bookings[0].starts_at)).toBe(45 * 60000);
});

test.describe("actualización de precio con reservas existentes", () => {
  test.use({ applyHomePriceMigration: false });

  test("cuarta migración conserva el snapshot a $20.000 y cobra $30.000 en nuevas reservas", async ({ backend }) => {
    const catalogBefore = await backend.call("public_catalog");
    const selected = catalogBefore.services.find((service) => service.name === "Corte a domicilio");
    expect(selected).toMatchObject({ price: 20000, duration_minutes: 45, modes: ["home"] });
    const slotArgs = { p_service: selected.id, p_mode: "home", p_date: backend.date };
    const slotsBefore = await backend.call("available_slots", slotArgs);
    expect(slotsBefore.length).toBeGreaterThan(0);
    const originalRequest = {
      request_id: randomUUID(),
      service_id: selected.id,
      mode: "home",
      starts_at: slotsBefore[0].starts_at,
      customer_name: "Cliente Histórico",
      phone: "+5493329600000",
      address: "Calle de Prueba 123, localidad de prueba",
    };
    const originalReceipt = await backend.call("create_booking", { p_data: originalRequest });
    expect(originalReceipt.price).toBe(20000);
    const snapshotArgs = { p_from: backend.date, p_to: backend.date };
    const before = await backend.call("admin_snapshot", snapshotArgs, "admin");
    expect(before.bookings).toHaveLength(1);
    expect(before.bookings[0]).toMatchObject({ id: originalReceipt.id, price: 20000 });

    await backend.db.exec(await readFile(homePriceMigration, "utf8"));

    const catalogAfter = await backend.call("public_catalog");
    expect(catalogAfter).toEqual({
      ...catalogBefore,
      services: catalogBefore.services.map((service) => service.id === selected.id ? { ...service, price: 30000 } : service),
    });
    const after = await backend.call("admin_snapshot", snapshotArgs, "admin");
    expect(after).toEqual({
      ...before,
      services: before.services.map((service) => service.id === selected.id ? { ...service, price: 30000 } : service),
    });
    // An identical retry must still return the original receipt and price.
    expect(await backend.call("create_booking", { p_data: originalRequest })).toEqual(originalReceipt);

    const slotsAfter = await backend.call("available_slots", slotArgs);
    expect(slotsAfter.length).toBeGreaterThan(0);
    expect(slotsAfter[0].price).toBe(30000);
    const newReceipt = await backend.call("create_booking", {
      p_data: { ...originalRequest, request_id: randomUUID(), starts_at: slotsAfter[0].starts_at, customer_name: "Cliente Nuevo" },
    });
    expect(newReceipt).toMatchObject({ price: 30000, service_name: selected.name, mode: "home" });
    const final = await backend.call("admin_snapshot", snapshotArgs, "admin");
    expect(final.bookings).toHaveLength(2);
    expect(final.bookings.find((booking) => booking.id === originalReceipt.id)).toEqual(before.bookings[0]);
    expect(final.bookings.find((booking) => booking.id === newReceipt.id)).toMatchObject({ price: 30000, mode: "home", service_id: selected.id });
  });
});
