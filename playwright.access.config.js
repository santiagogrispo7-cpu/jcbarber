import { defineConfig, devices } from "@playwright/test";

// Servidores aislados: nunca se usan las credenciales ni el backend de .env.
export default defineConfig({
  testDir: "./tests/access",
  outputDir: `./test-results/access-${Date.now()}`,
  workers: 1,
  timeout: 30000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4185",
    locale: "es-AR",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: [
    {
      command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4185 --strictPort",
      url: "http://127.0.0.1:4185/admin/",
      env: {
        VITE_SUPABASE_URL: "https://admin-access.test",
        VITE_SUPABASE_ANON_KEY: "test-public-key",
      },
      reuseExistingServer: false,
    },
    {
      command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4186 --strictPort",
      url: "http://127.0.0.1:4186/admin/",
      env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
      reuseExistingServer: false,
    },
  ],
});
