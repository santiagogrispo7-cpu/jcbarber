import { test, expect } from "@playwright/test";

// This suite uses the ordinary build without Supabase environment variables.
test("sin Supabase permite escribir y explica la configuración, sin simular acceso", async ({ page }) => {
  await page.goto("/admin/");
  await expect(page.locator("#admin-status")).toContainText("no está configurada");
  await page.locator("#login-email").fill("prueba@example.test");
  await page.locator("#login-password").fill("only-a-test-password");
  await page.locator("#login-form button").click();
  await expect(page.locator("#admin-error")).toContainText("Falta configurar Supabase");
  await expect(page.locator("#admin-private")).toBeHidden();
  await expect(page.locator("#login-fields")).toBeEnabled();
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});
