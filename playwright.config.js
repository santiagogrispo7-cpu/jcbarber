import { defineConfig, devices } from "@playwright/test";

// Optional isolated production build when Windows holds a lock on dist/.
const buildDir = process.env.JC_TEST_BUILD_DIR;
if (buildDir && buildDir !== "dist-release" && !/^test-results\/[a-zA-Z0-9_-]+$/.test(buildDir)) {
  throw new Error("JC_TEST_BUILD_DIR debe ser dist-release o una carpeta directa de test-results/.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  // Keep each run separate: this host can hold deleted directories briefly.
  outputDir: `./test-results/run-${Date.now()}`,
  fullyParallel: true,
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    // Opt in with --trace=on for diagnosis. Concurrent trace-file teardown
    // hangs on this Windows host; screenshots/errors remain enabled.
    trace: "off",
    screenshot: "only-on-failure",
    timezoneId: "Asia/Tokyo",
    locale: "es-AR",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview${buildDir ? ` --outDir ${buildDir}` : ""}`,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
