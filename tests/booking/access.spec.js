import { test, expect } from "./db-fixture.js";

async function login(page, email = "admin@example.test") {
  await page.goto("/admin/");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill("testing-password");
  await page.locator("#login-form button").click();
  await expect(page.locator("#admin-private")).toBeVisible();
}

test("recuperación: correo, enlace, validación, cambio de contraseña y secreto fuera de URL/storage", async ({ page }) => {
  await page.goto("/admin/");
  await page.getByText("Olvidé mi contraseña", { exact: true }).click();
  await page.locator("#recovery-email").fill("admin@example.test");
  const recovery = page.waitForRequest((r) => r.url().includes("/auth/v1/recover") && r.method() === "POST");
  await page.locator("#recovery-submit").click();
  expect(new URL((await recovery).url()).searchParams.get("redirect_to")).toBe("http://127.0.0.1:4174/admin/");
  await expect(page.locator("#admin-status")).toContainText("Si el correo tiene una cuenta");
  await page.goto("/admin/?token_hash=valid-recovery&type=recovery");
  await expect(page.locator("#password-panel")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.locator("#new-password").fill("new-testing-password");
  await page.locator("#confirm-password").fill("different-password");
  await page.locator("#password-submit").click();
  expect(await page.locator("#confirm-password").evaluate((el) => el.validationMessage)).toContain("no coinciden");
  await page.locator("#confirm-password").fill("new-testing-password");
  const update = page.waitForRequest((r) => r.url().endsWith("/auth/v1/user") && r.method() === "PUT");
  await page.locator("#password-submit").click();
  expect((await update).postDataJSON()).toEqual({ password: "new-testing-password" });
  await expect(page.locator("#admin-status")).toContainText("Contraseña guardada");
  await expect(page.locator("#admin-private")).toBeHidden();
  await expect(page.locator("#new-password")).toHaveValue("");
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test("enlace vencido no permite cambiar contraseña ni entrar al panel", async ({ page }) => {
  await page.goto("/admin/?token_hash=expired&type=recovery");
  await page.locator("#new-password").fill("new-testing-password");
  await page.locator("#confirm-password").fill("new-testing-password");
  await page.locator("#password-submit").click();
  await expect(page.locator("#admin-error")).toContainText("venció");
  await expect(page.locator("#admin-private")).toBeHidden();
});

test("invitación implícita valida tokens con Auth antes de establecer contraseña", async ({ page }) => {
  await page.goto("/admin/#access_token=test-admin&refresh_token=test-refresh&type=invite");
  await expect(page.locator("#password-panel")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.locator("#new-password").fill("new-testing-password");
  await page.locator("#confirm-password").fill("new-testing-password");
  await page.locator("#password-submit").click();
  await expect(page.locator("#admin-status")).toContainText("Contraseña guardada");
});

test("recorrido completo: reserva pública, actualización automática, bloqueo y transferencia con revocación", async ({ page, context, backend }) => {
  test.slow();
  await login(page);
  await page.locator("#agenda-date").fill(backend.date);
  await page.locator("#agenda-date").press("Tab");
  const customer = await context.newPage();
  await customer.goto("/");
  await customer.locator("#booking-mode").selectOption("local");
  await customer.locator("#booking-service").selectOption(backend.serviceId);
  await customer.locator("#date").fill(backend.date);
  await customer.locator("#booking-lookup").click();
  await expect(customer.locator("#time")).toBeEnabled();
  const slots = await backend.call("available_slots", { p_service: backend.serviceId, p_mode: "local", p_date: backend.date });
  await customer.locator("#time").selectOption(slots[0].starts_at);
  await customer.locator("#name").fill("Cliente Prueba");
  await customer.locator("#phone").fill("+5493329600000");
  await customer.locator("#booking-submit").click();
  await expect(customer.locator("#booking-receipt")).toContainText("Tu reserva está confirmada");
  await page.bringToFront();
  // No click on Actualizar agenda: background polling must discover the reservation.
  await expect(page.locator("#upcoming-bookings")).toContainText("Cliente Prueba", { timeout: 35000 });
  await customer.locator("#booking-receipt button").click();
  await customer.locator("#booking-mode").selectOption("local");
  await customer.locator("#booking-service").selectOption(backend.serviceId);
  await customer.locator("#date").fill(backend.date);
  await customer.locator("#booking-lookup").click();
  const remaining = await backend.call("available_slots", { p_service: backend.serviceId, p_mode: "local", p_date: backend.date });
  const visibleStart = await customer.locator("#time option").nth(1).getAttribute("value");
  const chosen = remaining.find((slot) => slot.starts_at === visibleStart);
  expect(chosen).toBeTruthy();
  await customer.locator("#time").selectOption(chosen.starts_at);
  const wallTime = (instant) => new Date(new Date(instant).getTime() - 3 * 3600000).toISOString().slice(0, 16);
  await page.locator("#block-start").fill(wallTime(chosen.starts_at));
  await page.locator("#block-end").fill(wallTime(chosen.ends_at));
  await page.locator("#block-reason").fill("Bloqueo de prueba");
  await page.locator("#block-form button").click();
  await expect(page.locator("#admin-status")).toContainText("Bloqueo creado");
  await customer.bringToFront();
  await expect.poll(() => customer.locator("#time option").evaluateAll((options) => options.map((o) => o.value)), { timeout: 35000 }).not.toContain(chosen.starts_at);
  await expect(customer.locator("#time")).toHaveValue("");

  await page.locator("#upcoming-bookings button").first().click();
  await page.locator("#booking-status").selectOption("cancelled");
  await page.locator("#booking-status-form button").click();
  await expect(page.locator("#admin-status")).toContainText("Estado del turno actualizado");
  await customer.bringToFront();
  await expect.poll(() => customer.locator("#time option").evaluateAll((options) => options.map((o) => o.value)), { timeout: 35000 }).toContain(slots[0].starts_at);

  // The trusted SQL operator provisions the existing Auth recipient; browsers cannot.
  await backend.db.query("select jc_private.prepare_handover($1::uuid,$2::uuid)", [backend.adminId, backend.userId]);
  await expect(backend.db.query("select jc_private.complete_handover($1::uuid)", [backend.userId])).rejects.toMatchObject({ code: "55000" });
  await expect(backend.call("admin_confirm_handover", { p_data: {} }, "admin")).rejects.toMatchObject({ code: "42501" });
  const barber = await context.newPage();
  await login(barber, "user@example.test");
  await barber.locator("#confirm-handover").click();
  await expect(barber.locator("#admin-status")).toContainText("Acceso del destinatario comprobado");
  await backend.db.exec("update jc_private.admin_handover set confirmed_at = clock_timestamp() - interval '25 hours'");
  await expect(backend.db.query("select jc_private.complete_handover($1::uuid)", [backend.userId])).rejects.toMatchObject({ code: "55000" });
  await barber.locator("#confirm-handover").click();
  await expect.poll(async () => (await backend.db.query("select confirmed_at > clock_timestamp() - interval '1 minute' as recent from jc_private.admin_handover")).rows[0].recent).toBe(true);
  await backend.db.query("select jc_private.complete_handover($1::uuid)", [backend.userId]);
  const admins = await backend.db.query("select user_id from jc_private.authorized_admins");
  expect(admins.rows).toEqual([{ user_id: backend.userId }]);
  // Same old JWT, no logout: the server must deny ALL privileged entry points.
  for (const [rpc, args] of [
    ["admin_snapshot", { p_from: backend.date, p_to: backend.date }],
    ["admin_booking", { p_data: { action: "create" } }],
    ["admin_block", { p_data: { action: "create" } }],
    ["admin_save_config", { p_data: {} }],
    ["admin_confirm_handover", { p_data: {} }],
  ]) await expect(backend.call(rpc, args, "admin")).rejects.toMatchObject({ code: "42501" });
  await page.bringToFront();
  await expect(page.locator("#admin-private")).toBeHidden({ timeout: 35000 });
  await expect(page.locator("#upcoming-bookings")).toBeEmpty();
  await page.reload();
  await page.locator("#login-email").fill("admin@example.test");
  await page.locator("#login-password").fill("testing-password");
  await page.locator("#login-form button").click();
  await expect(page.locator("#admin-error")).toContainText("autoriz");
  await expect(page.locator("#admin-private")).toBeHidden();
  await barber.locator("#refresh-admin").click();
  await expect(barber.locator("#admin-private")).toBeVisible();
});

test("transferencia: permisos SQL no permiten autoalta ni finalización desde JWT", async ({ backend }) => {
  for (const role of ["anon", "authenticated"]) {
    for (const sql of [
      `select jc_private.prepare_handover('${backend.adminId}', '${backend.userId}')`,
      `select jc_private.complete_handover('${backend.userId}')`,
      `insert into jc_private.authorized_admins(user_id) values ('${backend.userId}')`,
    ]) {
      await expect(backend.db.transaction(async (tx) => {
        await tx.exec(`set local role ${role}`);
        await tx.exec(sql);
      })).rejects.toMatchObject({ code: "42501" });
    }
  }
  await expect(backend.call("admin_confirm_handover", { p_data: {} })).rejects.toMatchObject({ code: "42501" });
});
