import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

test("HTML portable funciona abierto directamente desde disco", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(resolve(process.env.JC_TEST_BUILD_DIR || "dist", "jc-barberhouse.html")).href);
  await expect(
    page.getByRole("button", { name: "Confirmar turno por WhatsApp" }),
  ).toBeEnabled();
  await expect(page.getByRole("grid")).toBeVisible();
  expect(
    await page
      .locator(".hero-photo")
      .evaluate((image) => image.complete && image.naturalWidth > 0),
  ).toBe(true);
  await page
    .getByRole("link", {
      name: "Ampliar foto: degradado con terminación prolija",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("#photo-full")
        .evaluate((image) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});
