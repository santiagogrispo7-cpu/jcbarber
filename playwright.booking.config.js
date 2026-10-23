import { defineConfig, devices } from "@playwright/test";

// The suite intercepts https://booking.test and answers with real SQL through
// tests/booking/db-fixture.js. The production build must inline these values,
// so the web server rebuilds before serving; never point this at real Supabase.
const buildEnv = {
  VITE_SUPABASE_URL: "https://booking.test",
  VITE_SUPABASE_ANON_KEY: "test-public-key",
};
Object.assign(process.env, buildEnv);

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
// Isolate test credentials and Windows directory locks from the deployable dist/.
const runId = Date.now();
const buildDir = `test-results/booking-build-${runId}`;

export default defineConfig({
  testDir: "./tests/booking",
  // Keep each run separate: this host can hold deleted directories briefly.
  outputDir: `./test-results/booking-${runId}`,
  fullyParallel: true,
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    locale: "es-AR",
    // Opt in with --trace=on for diagnosis.
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `${npm} run build:booking -- --outDir ${buildDir} && ${npm} run preview:booking -- --outDir ${buildDir}`,
    url: "http://127.0.0.1:4174",
    env: buildEnv,
    reuseExistingServer: false,
    timeout: 180000,
  },
});
