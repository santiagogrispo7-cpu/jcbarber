import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./db-fixture.js";

// Auth is intercepted by db-fixture; every RPC uses the migrated SQL and RLS.
// A different device timezone deliberately exercises Buenos Aires civil dates.
test.use({
  baseURL: "http://127.0.0.1:4174",
  timezoneId: "Asia/Tokyo",
  reducedMotion: "reduce",
});

const RPC_ROOT = "https://booking.test/rest/v1/rpc/";
const CUSTOMER = "Ana Prueba";
const PHONE = "+5493329600000";
const ADDRESS = "Calle de Prueba 123, localidad de prueba";
const PASSWORD = "testing-password";
const runtimeChecks = new WeakMap();
const PRIVATE_CONTAINERS = [
  "upcoming-bookings", "calendar-days", "cancelled-bookings", "booking-detail",
  "blocks-list", "settings-fields", "services-fields", "hours-fields",
  "manual-picker", "reschedule-picker",
];

function shiftDay(date, count) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

function mondayOf(date) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftDay(date, -((weekday + 6) % 7));
}

function iso(value) {
  return new Date(value).toISOString();
}

function baTime(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function isRpc(response, name) {
  return response.url() === `${RPC_ROOT}${name}` &&
    response.request().method() === "POST";
}

async function snapshot(backend, from = backend.date, to = from) {
  return backend.call("admin_snapshot", { p_from: from, p_to: to }, "admin");
}

function configuration(data) {
  return structuredClone({
    settings: data.settings,
    services: data.services,
    hours: data.hours,
  });
}

async function slots(backend, mode = "local", date = backend.date) {
  return backend.call("available_slots", {
    p_service: backend.serviceId,
    p_mode: mode,
    p_date: date,
  }, "admin");
}

async function seedBooking(backend, { mode = "local", name = CUSTOMER } = {}) {
  const available = await slots(backend, mode);
  expect(available.length, "El fixture debe ofrecer un slot real mañana").toBeGreaterThan(0);
  const receipt = await backend.call("admin_booking", {
    p_data: {
      action: "create",
      request_id: randomUUID(),
      service_id: backend.serviceId,
      mode,
      starts_at: available[0].starts_at,
      customer_name: name,
      phone: PHONE,
      address: mode === "home" ? ADDRESS : null,
      notes: "Reserva sintética de integración",
    },
  }, "admin");
  const saved = (await snapshot(backend)).bookings.find((item) => item.id === receipt.id);
  expect(saved, "La reserva debe existir en SQL, no sólo en la respuesta HTTP").toBeTruthy();
  return saved;
}

async function visitLogin(page) {
  await page.goto("/admin/");
  await expect(page.locator("#login-fields")).toBeEnabled();
  await expect(page.locator("#admin-status")).toContainText("Ingresá");
  await expect(page.locator("#admin-private")).toBeHidden();
}

async function submitLogin(page, email = "admin@example.test", password = PASSWORD) {
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  const response = page.waitForResponse((item) =>
    item.url().includes("/auth/v1/token?grant_type=password") &&
    item.request().method() === "POST",
  );
  await page.locator("#login-form").getByRole("button", { name: "Ingresar", exact: true }).click();
  const result = await response;
  await expect(page.locator("#login-password")).toHaveValue("");
  return result;
}

async function login(page) {
  await visitLogin(page);
  expect((await submitLogin(page)).ok()).toBe(true);
  await expect(page.locator("#admin-private")).toBeVisible();
  await expect(page.locator("#admin-status")).toContainText("Agenda actualizada");
  await expect(page.locator("#admin-error")).toBeEmpty();
}

async function showDay(page, date) {
  if (await page.locator("#agenda-view").inputValue() !== "day") {
    const refreshed = page.waitForResponse((response) => isRpc(response, "admin_snapshot"));
    await page.locator("#agenda-view").selectOption("day");
    expect((await refreshed).ok()).toBe(true);
    await expect(page.locator("#admin-private")).not.toHaveAttribute("aria-busy", "true");
  }
  if (await page.locator("#agenda-date").inputValue() !== date) {
    const refreshed = page.waitForResponse((response) => isRpc(response, "admin_snapshot"));
    await page.locator("#agenda-date").fill(date);
    await page.locator("#agenda-date").press("Tab");
    expect((await refreshed).ok()).toBe(true);
  }
  await expect(page.locator("#calendar-days .admin-day")).toHaveCount(1);
  await expect(page.locator("#calendar-days .admin-day")).toHaveAttribute("data-date", date);
  await expect(page.locator("#admin-private")).not.toHaveAttribute("aria-busy", "true");
}

async function selectManualSlot(page, backend, mode = "local") {
  await page.locator("#manual-service").selectOption(backend.serviceId);
  await page.locator("#manual-mode").selectOption(mode);
  await page.locator("#manual-date").fill(backend.date);
  const lookup = page.waitForResponse((response) => isRpc(response, "available_slots"));
  await page.locator("#manual-lookup").click();
  expect((await lookup).ok()).toBe(true);
  await expect(page.locator("#manual-slot")).toBeEnabled();
  const choices = await page.locator("#manual-slot option").evaluateAll((options) =>
    options.map((item) => item.value).filter(Boolean),
  );
  expect(choices.length).toBeGreaterThan(0);
  await page.locator("#manual-slot").selectOption(choices[0]);
  return choices[0];
}

async function fillCustomer(page, mode = "local", notes = "Reserva de prueba") {
  await page.locator("#manual-name").fill(CUSTOMER);
  await page.locator("#manual-phone").fill(PHONE);
  if (mode === "home") await page.locator("#manual-address").fill(ADDRESS);
  await page.locator("#manual-notes").fill(notes);
}

async function successfulMutation(page, name, trigger, message) {
  const pending = page.waitForResponse((response) => isRpc(response, name));
  await trigger();
  const response = await pending;
  expect(response.ok(), `${name}: HTTP ${response.status()}`).toBe(true);
  await expect(page.locator("#admin-status")).toContainText(message);
  await expect(page.locator("#admin-error")).toBeEmpty();
  await expect(page.locator("#admin-private")).not.toHaveAttribute("aria-busy", "true");
  return response.request().postDataJSON();
}

async function saveConfig(page) {
  return successfulMutation(page, "admin_save_config", () =>
    page.locator("#config-form").getByRole("button", { name: "Guardar configuración completa" }).click(),
  "Configuración guardada");
}

async function expectPrivateCleared(page, name = CUSTOMER) {
  await expect(page.locator("#admin-private")).toBeHidden();
  await expect(page.locator("#login-panel")).toBeVisible();
  for (const id of PRIVATE_CONTAINERS) {
    await expect(page.locator(`#${id}`), `${id} debe borrarse, no sólo ocultarse`).toBeEmpty();
  }
  await expect(page.locator("#admin-private")).not.toContainText(name);
  await expect(page.locator("#manual-name")).toHaveValue("");
  await expect(page.locator("#manual-phone")).toHaveValue("");
  await expect(page.locator("#manual-address")).toHaveValue("");
  await expect(page.locator("#manual-notes")).toHaveValue("");
  await expect(page.locator("#login-password")).toHaveValue("");
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test.beforeEach(async ({ page, backend, browserName }) => {
  test.skip(browserName !== "chromium", "Esta asignación ejecuta sólo Chromium.");
  expect(backend.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  // Capture page exceptions, but not expected HTTP errors from invalid credentials/RLS.
  const checks = { errors: [], passwordLogged: false };
  page.on("pageerror", (error) => checks.errors.push(error.message));
  page.on("console", (message) => {
    if (message.text().includes(PASSWORD)) checks.passwordLogged = true;
  });
  runtimeChecks.set(page, checks);
});

test.afterEach(async ({ page }) => {
  const checks = runtimeChecks.get(page);
  expect(checks?.errors || [], "No debe haber excepciones de aplicación").toEqual([]);
  expect(checks?.passwordLogged || false, "La contraseña nunca debe registrarse en consola").toBe(false);
});

test("credenciales inválidas: error, contraseña vacía y ningún acceso público de alta", async ({ page, backend }) => {
  await seedBooking(backend);
  const consoleMessages = [];
  page.on("console", (message) => consoleMessages.push(message.text()));
  await visitLogin(page);
  const response = await submitLogin(page, "admin@example.test", "incorrect-password");
  expect(response.status()).toBe(400);
  await expect(page.locator("#admin-error")).not.toBeEmpty();
  await expect(page.locator("#login-fields")).toBeEnabled();
  await expectPrivateCleared(page);
  await expect(page.getByRole("link", { name: /registrar|crear cuenta/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /registrar|crear cuenta/i })).toHaveCount(0);
  expect(consoleMessages.join("\n")).not.toContain("incorrect-password");
});

test("usuario autenticado sin allowlist: SQL deniega snapshot y no expone datos privados", async ({ page, backend }) => {
  await seedBooking(backend, { name: "Cliente Confidencial" });
  await visitLogin(page);
  const denied = page.waitForResponse((response) => isRpc(response, "admin_snapshot"));
  expect((await submitLogin(page, "user@example.test")).ok()).toBe(true);
  const response = await denied;
  expect(response.ok()).toBe(false);
  const result = await response.json();
  expect(result.code).toBe("42501");
  expect(JSON.stringify(result)).not.toContain("Cliente Confidencial");
  await expect(page.locator("#admin-error")).toContainText(/autoriz|acceso/i);
  await expectPrivateCleared(page, "Cliente Confidencial");
  await expect(page.locator("#account-tools")).toBeVisible();
});

test("turno manual con reservas pausadas: resumen, agenda, contacto, reprogramación y cancelación", async ({ page, backend }) => {
  test.slow();
  await login(page);
  // Pausing public reservations must not disable the administrator's slot lookup.
  await page.locator("#settings-enabled").uncheck();
  await saveConfig(page);
  await expect(page.locator("#booking-enabled")).toHaveText("Reservas públicas pausadas");
  const start = await selectManualSlot(page, backend, "home");
  const notes = '<img src=x onerror="window.__adminInjected=true"> Texto de prueba';
  await fillCustomer(page, "home", notes);
  const sent = await successfulMutation(page, "admin_booking", () =>
    page.locator("#manual-form").getByRole("button", { name: "Crear turno confirmado" }).click(),
  "Turno creado y confirmado");
  expect(sent.p_data).toMatchObject({
    action: "create", service_id: backend.serviceId, mode: "home",
    customer_name: CUSTOMER, phone: PHONE, address: ADDRESS, notes,
  });
  expect(sent.p_data.request_id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  expect(iso(sent.p_data.starts_at)).toBe(iso(start));
  let saved = await snapshot(backend);
  expect(saved.bookings).toHaveLength(1);
  const booking = saved.bookings[0];
  expect(booking).toMatchObject({ customer_name: CUSTOMER, mode: "home", status: "confirmed", price: 10000 });
  expect(new Date(booking.ends_at) - new Date(booking.starts_at)).toBe(30 * 60000);
  expect(new Date(booking.starts_at) - new Date(booking.occupied_start)).toBe(15 * 60000);
  expect(new Date(booking.occupied_end) - new Date(booking.ends_at)).toBe(20 * 60000);
  await expect(page.locator("#today-count")).toHaveText("0");
  const today = shiftDay(backend.date, -1);
  const inCurrentWeek = mondayOf(today) === mondayOf(backend.date);
  await expect(page.locator("#week-count")).toHaveText(inCurrentWeek ? "1" : "0");
  await expect(page.locator("#week-breakdown")).toContainText(`${inCurrentWeek ? 1 : 0} a domicilio`);
  await expect(page.locator("#next-client")).toHaveText(CUSTOMER);
  await expect(page.locator("#upcoming-bookings > li")).toHaveCount(1);
  await expect(page.locator("#agenda-date")).toHaveValue(backend.date);
  const appointment = page.locator('#calendar-days .admin-event[data-kind="booking"]');
  await expect(appointment).toContainText(`${baTime(booking.starts_at)}–${baTime(booking.ends_at)}`);
  await expect(appointment).toContainText("Domicilio");
  await expect(appointment).toContainText("Ocupado:");
  await expect(appointment).toContainText("incluye descanso y traslados");

  const weekLoaded = page.waitForResponse((response) => isRpc(response, "admin_snapshot"));
  await page.locator("#agenda-view").selectOption("week");
  expect((await weekLoaded).ok()).toBe(true);
  await expect(page.locator("#calendar-days .admin-day")).toHaveCount(7);
  expect(await page.locator("#calendar-days .admin-day").evaluateAll((days) =>
    days.map((day) => day.dataset.date),
  )).toEqual(Array.from({ length: 7 }, (_, index) => shiftDay(mondayOf(backend.date), index)));
  await showDay(page, backend.date);
  await page.locator(`#calendar-days [data-booking-id="${booking.id}"]`).click();
  await expect(page.locator("#booking-editor")).toBeFocused();
  await expect(page.locator("#booking-detail")).toContainText(ADDRESS);
  await expect(page.locator("#booking-detail")).toContainText(notes);
  await expect(page.locator("#booking-detail img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__adminInjected)).toBeUndefined();
  const whatsapp = page.locator("#booking-detail").getByRole("link", { name: "Contactar por WhatsApp" });
  await expect(whatsapp).toHaveAttribute("href", "https://wa.me/5493329600000");
  await expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
  // Inspect the destination only: never contact WhatsApp from a test.

  await page.locator("#reschedule-section > summary").click();
  await expect(page.locator("#reschedule-service")).toBeDisabled();
  await expect(page.locator("#reschedule-service")).toHaveValue(backend.serviceId);
  await expect(page.locator("#reschedule-mode")).toBeDisabled();
  await expect(page.locator("#reschedule-mode")).toHaveValue("home");
  const lookup = page.waitForResponse((response) => isRpc(response, "available_slots"));
  await page.locator("#reschedule-lookup").click();
  const lookupResponse = await lookup;
  expect(lookupResponse.request().postDataJSON()).toEqual({
    p_service: backend.serviceId, p_mode: "home", p_date: backend.date,
  });
  await expect(page.locator("#reschedule-slot")).toBeEnabled();
  const next = await page.locator("#reschedule-slot option").evaluateAll((options) =>
    options.map((item) => item.value).find(Boolean),
  );
  expect(next).toBeTruthy();
  expect(iso(next)).not.toBe(iso(booking.starts_at));
  await page.locator("#reschedule-slot").selectOption(next);
  const update = await successfulMutation(page, "admin_booking", () =>
    page.locator("#reschedule-form").getByRole("button", { name: "Guardar nuevo horario" }).click(),
  "Turno reprogramado");
  expect(update.p_data).toEqual({ action: "update", id: booking.id, starts_at: next });
  saved = await snapshot(backend);
  expect(saved.bookings).toHaveLength(1);
  expect(iso(saved.bookings[0].starts_at)).toBe(iso(next));
  expect(saved.bookings[0]).toMatchObject({ id: booking.id, service_id: backend.serviceId, mode: "home", price: 10000 });

  for (const status of ["completed", "no_show", "confirmed", "cancelled"]) {
    await page.locator("#booking-status").selectOption(status);
    await successfulMutation(page, "admin_booking", () =>
      page.locator("#booking-status-form").getByRole("button", { name: "Guardar estado" }).click(),
    "Estado del turno actualizado");
    expect((await snapshot(backend)).bookings[0].status).toBe(status);
  }
  await expect(page.locator('#calendar-days .admin-event[data-kind="booking"]')).toHaveCount(0);
  await page.locator(".admin-history > summary").click();
  await expect(page.locator("#cancelled-bookings")).toContainText(CUSTOMER);
  await expect(page.locator("#cancelled-bookings")).toContainText("Cancelado");
  await expect(page.locator("#week-count")).toHaveText("0");
  expect((await slots(backend, "home")).some((slot) => iso(slot.starts_at) === iso(next))).toBe(true);
});

test("un slot ocupado después de consultarlo muestra conflicto y no duplica el turno", async ({ page, backend }) => {
  await login(page);
  const chosen = await selectManualSlot(page, backend);
  await fillCustomer(page);
  const available = await slots(backend);
  const selected = available.find((slot) => iso(slot.starts_at) === iso(chosen));
  expect(selected).toBeTruthy();
  await backend.call("admin_block", { p_data: {
    action: "create", starts_at: selected.starts_at, ends_at: selected.ends_at,
    reason: "Ocupación concurrente de prueba",
  } }, "admin");
  const rejected = page.waitForResponse((response) => isRpc(response, "admin_booking"));
  await page.locator("#manual-form").getByRole("button", { name: "Crear turno confirmado" }).click();
  const response = await rejected;
  expect(response.ok()).toBe(false);
  expect((await response.json()).code).toBe("23P01");
  await expect(page.locator("#admin-error")).toContainText(/superpone|disponible/i);
  await expect(page.locator("#manual-name")).toHaveValue(CUSTOMER);
  expect((await snapshot(backend)).bookings).toHaveLength(0);
  const replacement = await selectManualSlot(page, backend);
  expect(iso(replacement)).not.toBe(iso(chosen));
  await successfulMutation(page, "admin_booking", () =>
    page.locator("#manual-form").getByRole("button", { name: "Crear turno confirmado" }).click(),
  "Turno creado y confirmado");
  const saved = await snapshot(backend);
  expect(saved.bookings).toHaveLength(1);
  await page.locator(`#calendar-days [data-booking-id="${saved.bookings[0].id}"]`).click();
  await expect(page.locator("#booking-detail")).not.toContainText("Domicilio:");
});

test("la agenda consulta slots reales y lleva la selección al formulario manual", async ({ page, backend }) => {
  await login(page);
  await showDay(page, backend.date);
  await page.locator("#calendar-service").selectOption(backend.serviceId);
  await page.locator("#calendar-mode").selectOption("home");
  const pending = page.waitForResponse((response) => isRpc(response, "available_slots"));
  await page.locator("#calendar-filter").getByRole("button", { name: "Consultar disponibilidad" }).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  expect(response.request().postDataJSON()).toEqual({
    p_service: backend.serviceId, p_mode: "home", p_date: backend.date,
  });
  const available = await slots(backend, "home");
  expect(available.length).toBeGreaterThan(0);
  const rows = page.locator('#calendar-days .admin-event[data-kind="slot"]');
  await expect(rows).toHaveCount(available.length);
  expect(await rows.locator("h4").allTextContents()).toEqual(available.map((slot) =>
    `Disponible · ${baTime(slot.starts_at)}–${baTime(slot.ends_at)}`,
  ));
  await rows.first().getByRole("button", { name: "Usar para turno manual" }).click();
  await expect(page.locator("#manual-name")).toBeFocused();
  await expect(page.locator("#manual-service")).toHaveValue(backend.serviceId);
  await expect(page.locator("#manual-mode")).toHaveValue("home");
  await expect(page.locator("#manual-date")).toHaveValue(backend.date);
  expect(iso(await page.locator("#manual-slot").inputValue())).toBe(iso(available[0].starts_at));
  await expect(page.locator("#manual-address-field")).toBeVisible();
});

test("configuración pausada conserva null; activar incompleta falla y SQL revierte todo", async ({ page, backend }) => {
  await login(page);
  const before = await snapshot(backend);
  const index = before.services.findIndex((service) => service.id === backend.serviceId);
  expect(index).toBeGreaterThanOrEqual(0);
  await page.locator("#settings-enabled").uncheck();
  for (const name of ["break_minutes", "travel_before_minutes", "travel_after_minutes"]) {
    await page.locator(`#settings-${name}`).fill("");
  }
  await page.locator(`#service-${index}-active`).uncheck();
  await page.locator(`#service-${index}-price`).fill("");
  await page.locator(`#service-${index}-duration`).fill("");
  const sent = await saveConfig(page);
  expect(sent.p_data.settings).toMatchObject({
    enabled: false, break_minutes: null, travel_before_minutes: null, travel_after_minutes: null,
  });
  expect(sent.p_data.services.find((service) => service.id === backend.serviceId)).toMatchObject({
    active: false, price: null, duration_minutes: null,
  });
  const saved = await snapshot(backend);
  expect(saved.settings).toMatchObject(sent.p_data.settings);
  for (const name of ["break_minutes", "travel_before_minutes", "travel_after_minutes"]) {
    await expect(page.locator(`#settings-${name}`)).toHaveValue("");
  }
  await expect(page.locator(`#service-${index}-price`)).toHaveValue("");
  await expect(page.locator(`#service-${index}-duration`)).toHaveValue("");
  await page.locator("#settings-enabled").check();
  await page.locator("#config-form").getByRole("button", { name: "Guardar configuración completa" }).click();
  await expect(page.locator("#admin-error")).toContainText("Antes de habilitar reservas");
  expect(configuration(await snapshot(backend))).toEqual(configuration(saved));

  // Bypass client validation deliberately: SQL must reject and roll back settings,
  // service edits and rebuilt hours in the same transaction as activation.
  const invalid = configuration(saved);
  invalid.settings.enabled = true;
  invalid.services[index].name = "Este cambio debe revertirse";
  await expect(backend.call("admin_save_config", { p_data: invalid }, "admin"))
    .rejects.toMatchObject({ code: "22023" });
  expect(configuration(await snapshot(backend))).toEqual(configuration(saved));
});

test("un rechazo del servidor al guardar no modifica configuración ni reservas existentes", async ({ page, backend }) => {
  const booking = await seedBooking(backend, { mode: "home" });
  await login(page);
  const before = await snapshot(backend);
  // Zero is a valid number in the UI, but SQL requires positive home travel.
  await page.locator("#settings-travel_before_minutes").fill("0");
  await page.locator("#settings-break_minutes").fill("12");
  const index = before.services.findIndex((service) => service.id === backend.serviceId);
  await page.locator(`#service-${index}-price`).fill("17000");
  const failed = page.waitForResponse((response) => isRpc(response, "admin_save_config"));
  await page.locator("#config-form").getByRole("button", { name: "Guardar configuración completa" }).click();
  const response = await failed;
  expect(response.ok()).toBe(false);
  expect((await response.json()).code).toBe("22023");
  await expect(page.locator("#admin-error")).not.toBeEmpty();
  await expect(page.locator("#admin-private")).toBeVisible();
  await expect(page.locator("#settings-break_minutes")).toHaveValue("12");
  const after = await snapshot(backend);
  expect(configuration(after)).toEqual(configuration(before));
  expect(after.bookings.find((item) => item.id === booking.id)).toEqual(booking);
});

test("agrega, edita y desactiva servicios; cambia franjas/días sin reescribir reservas", async ({ page, backend }) => {
  test.slow();
  const booking = await seedBooking(backend);
  await login(page);
  const original = await snapshot(backend);
  const index = original.services.findIndex((service) => service.id === backend.serviceId);
  await page.locator(`#service-${index}-name`).fill("Corte editado");
  await page.locator(`#service-${index}-price`).fill("12500");
  await page.locator(`#service-${index}-duration`).fill("40");
  await page.locator(`#service-${index}-home`).uncheck();
  await page.locator("#settings-break_minutes").fill("10");
  await page.locator("#settings-travel_before_minutes").fill("20");
  await page.locator("#settings-travel_after_minutes").fill("25");
  const addedIndex = await page.locator(".admin-service").count();
  await page.locator("#add-service").click();
  await expect(page.locator(`#service-${addedIndex}-price`)).toHaveValue("");
  await expect(page.locator(`#service-${addedIndex}-duration`)).toHaveValue("");
  await expect(page.locator(`#service-${addedIndex}-active`)).not.toBeChecked();
  await page.locator(`#service-${addedIndex}-name`).fill("Barba prueba");
  await page.locator(`#service-${addedIndex}-price`).fill("7000");
  await page.locator(`#service-${addedIndex}-duration`).fill("20");
  await page.locator(`#service-${addedIndex}-local`).check();
  await page.locator(`#service-${addedIndex}-active`).check();

  const weekday = new Date(`${backend.date}T12:00:00Z`).getUTCDay();
  const day = page.locator(`.admin-hours-day[aria-labelledby="hours-day-${weekday}"]`);
  const morning = day.locator(".admin-hours-row").filter({
    has: page.locator('select option:checked[value="local"]'),
  }).first();
  const oldStart = await morning.locator('input[id$="-start"]').inputValue();
  const originalHour = original.hours.find((hour) =>
    hour.weekday === weekday && hour.mode === "local" && hour.start_time.slice(0, 5) === oldStart,
  );
  expect(originalHour).toBeTruthy();
  await morning.locator('input[id$="-start"]').fill("09:30");
  await morning.locator('input[id$="-end"]').fill("12:00");
  const disabledDay = (weekday + 1) % 7;
  const dayToggles = page.locator(`.admin-hours-day[aria-labelledby="hours-day-${disabledDay}"] input[type="checkbox"]`);
  await expect(dayToggles).toHaveCount(4);
  for (const toggle of await dayToggles.all()) await toggle.uncheck();
  const payload = await saveConfig(page);
  expect(payload.p_data.services[addedIndex]).toMatchObject({ id: null, name: "Barba prueba" });
  const saved = await snapshot(backend);
  expect(saved.services.find((service) => service.id === backend.serviceId)).toMatchObject({
    name: "Corte editado", price: 12500, duration_minutes: 40, modes: ["local"], active: true,
  });
  const added = saved.services.find((service) => service.name === "Barba prueba");
  expect(added).toMatchObject({ price: 7000, duration_minutes: 20, active: true, modes: ["local"] });
  expect(added.id).toBeTruthy();
  const editedHour = saved.hours.find((hour) => hour.id === originalHour.id);
  expect(editedHour.start_time.slice(0, 5)).toBe("09:30");
  expect(editedHour.end_time.slice(0, 5)).toBe("12:00");
  expect(saved.hours.filter((hour) => hour.weekday === disabledDay).every((hour) => !hour.enabled)).toBe(true);
  expect(saved.bookings.find((item) => item.id === booking.id)).toEqual(booking);
  expect(await slots(backend, "local", shiftDay(backend.date, 1))).toEqual([]);
  const newIndex = saved.services.findIndex((service) => service.id === added.id);
  await page.locator(`#service-${newIndex}-active`).uncheck();
  await saveConfig(page);
  expect((await snapshot(backend)).services.find((service) => service.id === added.id).active).toBe(false);
  const catalog = await backend.call("public_catalog");
  expect(catalog.services.some((service) => service.id === added.id)).toBe(false);
  expect((await snapshot(backend)).bookings.find((item) => item.id === booking.id)).toEqual(booking);
});

test("vacaciones inclusivas y bloqueos horarios usan Buenos Aires y liberan disponibilidad al eliminar", async ({ page, backend }) => {
  test.slow();
  await login(page);
  const last = shiftDay(backend.date, 1);
  const exclusiveEnd = shiftDay(backend.date, 2);
  await page.locator("#block-kind").selectOption("days");
  await page.locator("#block-first-day").fill(backend.date);
  await page.locator("#block-last-day").fill(last);
  await page.locator("#block-reason").fill("Vacaciones de prueba");
  await successfulMutation(page, "admin_block", () =>
    page.locator("#block-form").getByRole("button", { name: "Crear bloqueo" }).click(),
  "Bloqueo creado");
  const saved = await snapshot(backend, backend.date, exclusiveEnd);
  expect(saved.blocks).toHaveLength(1);
  const vacation = saved.blocks[0];
  expect(iso(vacation.starts_at)).toBe(`${backend.date}T03:00:00.000Z`);
  expect(iso(vacation.ends_at)).toBe(`${exclusiveEnd}T03:00:00.000Z`);
  for (const date of [backend.date, last]) {
    for (const mode of ["local", "home"]) expect(await slots(backend, mode, date)).toEqual([]);
  }
  expect((await slots(backend, "local", exclusiveEnd)).length).toBeGreaterThan(0);
  await showDay(page, last);
  await expect(page.locator('#calendar-days .admin-event[data-kind="block"]')).toContainText("Vacaciones de prueba");
  await successfulMutation(page, "admin_block", () =>
    page.locator(`#blocks-list [data-block-id="${vacation.id}"]`).click(),
  "Bloqueo eliminado");
  expect((await slots(backend)).length).toBeGreaterThan(0);

  // The days-form reset must not leave the visible hourly controls disabled.
  await expect(page.locator("#block-kind")).toHaveValue("hours");
  await expect(page.locator("#block-start")).toBeEnabled();
  await expect(page.locator("#block-end")).toBeEnabled();
  await page.locator("#block-start").fill(`${backend.date}T09:00`);
  await page.locator("#block-end").fill(`${backend.date}T10:00`);
  await page.locator("#block-reason").fill("Horario especial de prueba");
  await successfulMutation(page, "admin_block", () =>
    page.locator("#block-form").getByRole("button", { name: "Crear bloqueo" }).click(),
  "Bloqueo creado");
  const hourly = (await snapshot(backend)).blocks;
  expect(hourly).toHaveLength(1);
  expect(iso(hourly[0].starts_at)).toBe(`${backend.date}T12:00:00.000Z`);
  expect(iso(hourly[0].ends_at)).toBe(`${backend.date}T13:00:00.000Z`);
  await expect(page.locator('#calendar-days .admin-event[data-kind="block"]')).toContainText("09:00–10:00");
  expect((await slots(backend)).every((slot) => baTime(slot.starts_at) >= "10:00")).toBe(true);
  await successfulMutation(page, "admin_block", () =>
    page.locator(`#blocks-list [data-block-id="${hourly[0].id}"]`).click(),
  "Bloqueo eliminado");
  expect((await snapshot(backend, backend.date, exclusiveEnd)).blocks).toEqual([]);
  expect((await slots(backend)).some((slot) => baTime(slot.starts_at) === "09:00")).toBe(true);
});

for (const name of ["admin_snapshot", "available_slots"]) {
  test(`logout borra datos y descarta la respuesta tardía de ${name}`, async ({ page, backend }) => {
    await seedBooking(backend, { name: "Cliente Confidencial" });
    await login(page);
    await showDay(page, backend.date);
    await expect(page.locator("#next-client")).toHaveText("Cliente Confidencial");
    await page.locator("#manual-name").fill("Borrador Confidencial");
    const arrived = deferred();
    const release = deferred();
    const completed = deferred();
    // Mark early failures handled while the click/arrival assertion is pending;
    // awaiting the original promise below still propagates the actual failure.
    arrived.promise.catch(() => {});
    completed.promise.catch(() => {});
    let intercepted = false;
    const endpoint = `${RPC_ROOT}${name}`;
    const handler = async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      intercepted = true;
      try {
        // Real SQL result, delayed only after computation. route.fetch() would
        // bypass the fixture and incorrectly contact the nonexistent remote host.
        const result = await backend.call(name, route.request().postDataJSON(), "admin");
        arrived.resolve(result);
        await release.promise;
        await route.fulfill({
          status: 200,
          headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
          body: JSON.stringify(result),
        });
        completed.resolve();
      } catch (error) {
        arrived.reject(error);
        completed.reject(error);
        await route.abort();
      }
    };
    await page.route(endpoint, handler);
    try {
      if (name === "admin_snapshot") {
        await page.locator("#refresh-admin").click();
      } else {
        await page.locator("#manual-service").selectOption(backend.serviceId);
        await page.locator("#manual-mode").selectOption("local");
        await page.locator("#manual-date").fill(backend.date);
        await page.locator("#manual-lookup").click();
      }
      const result = await arrived.promise;
      if (name === "admin_snapshot") expect(JSON.stringify(result)).toContain("Cliente Confidencial");
      else expect(result.length).toBeGreaterThan(0);
      await page.locator("#signout").click();
      await expect(page.locator("#admin-status")).toContainText("Sesión cerrada");
      await expectPrivateCleared(page, "Cliente Confidencial");
      const lateResponse = page.waitForResponse((response) => isRpc(response, name));
      release.resolve();
      await completed.promise;
      await (await lateResponse).finished();
      // Flush rendering after fetch/json continuations; no arbitrary sleep.
      await page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }));
      await expectPrivateCleared(page, "Cliente Confidencial");
      await expect(page.locator("#account-tools")).toBeHidden();
      await expect(page.locator("#admin-status")).toContainText("Sesión cerrada");
    } finally {
      release.resolve();
      if (intercepted) await completed.promise.catch(() => {});
      await page.unroute(endpoint, handler);
    }
  });
}

test("recargar descarta la sesión en memoria y exige nuevo login", async ({ page, backend }) => {
  await seedBooking(backend);
  await login(page);
  await showDay(page, backend.date);
  await expect(page.locator("#next-client")).toHaveText(CUSTOMER);
  expect(await page.evaluate(() => ({
    local: Object.keys(localStorage), session: Object.keys(sessionStorage),
  }))).toEqual({ local: [], session: [] });
  const snapshots = [];
  const listener = (request) => {
    if (request.url() === `${RPC_ROOT}admin_snapshot` && request.method() === "POST") snapshots.push(request);
  };
  page.on("request", listener);
  await page.reload();
  await expect(page.locator("#login-fields")).toBeEnabled();
  await expect(page.locator("#admin-status")).toContainText("Ingresá");
  await expectPrivateCleared(page);
  expect(snapshots).toHaveLength(0);
  page.off("request", listener);
  expect((await submitLogin(page)).ok()).toBe(true);
  await expect(page.locator("#admin-private")).toBeVisible();
  await expect(page.locator("#admin-status")).toContainText("Agenda actualizada");
  await showDay(page, backend.date);
  await expect(page.locator("#next-client")).toHaveText(CUSTOMER);
});

test("axe sin violaciones en login y panel con detalle; foco de teclado recuperable", async ({ page, backend }) => {
  const booking = await seedBooking(backend, { mode: "home" });
  await visitLogin(page);
  const loginAudit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(loginAudit.violations).toEqual([]);
  await submitLogin(page);
  await expect(page.locator("#admin-status")).toContainText("Agenda actualizada");
  await showDay(page, backend.date);
  // The opener is in the calendar; a duplicate button also exists in Upcoming.
  // Closing must restore the exact origin, not the first matching booking ID.
  const trigger = page.locator(`#calendar-days [data-booking-id="${booking.id}"]`);
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#booking-editor")).toBeFocused();
  await page.locator("#reschedule-section > summary").click();
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(audit.violations).toEqual([]);
  await page.locator("#close-editor").focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused();
  await expect(page.locator("#booking-editor")).toBeHidden();
});

for (const width of [320, 390, 768, 1440]) {
  test(`panel responsive ${width}px: sin overflow, controles táctiles y recursos visibles`, async ({ page, backend }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await seedBooking(backend, { mode: "home" });
    await login(page);
    await showDay(page, backend.date);
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth,
    )).toBe(true);
    await expect(page.locator("#manual-form")).toBeVisible();
    await expect(page.locator("#config-form")).toBeVisible();
    await expect(page.locator("#signout")).toBeVisible();
    await expect.poll(() => page.locator(".brand img").evaluate((image) =>
      image.complete && image.naturalWidth > 0,
    )).toBe(true);
    const smallControls = await page.locator(
      '#admin-private button, #admin-private input:not([type="checkbox"]), ' +
      '#admin-private select, #admin-private textarea, #admin-private .admin-check, #account-tools button',
    ).evaluateAll((nodes) => nodes.flatMap((node) => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(node).visibility === "hidden") return [];
      return rect.height < 43.5 || rect.width < 43.5 ? [{
        id: node.id || node.textContent.trim(), width: rect.width, height: rect.height,
      }] : [];
    }));
    expect(smallControls, "Objetivo táctil mínimo de 44px; checkbox medido por su etiqueta").toEqual([]);
    if ([390, 1440].includes(width)) {
      const directory = new URL("../../docs/evidence/", import.meta.url);
      expect((await stat(directory)).isDirectory(), "docs/evidence debe existir antes de capturar").toBe(true);
      const path = fileURLToPath(new URL(`admin-${width}.png`, directory));
      await page.screenshot({ path, fullPage: true, animations: "disabled" });
      await testInfo.attach(`admin-${width}`, { path, contentType: "image/png" });
    }
  });
}
