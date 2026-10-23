import { defineConfig, loadEnv } from "vite";
import { contentPlugin } from "./scripts/content-plugin.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_SUPABASE_");
  const key = env.VITE_SUPABASE_ANON_KEY || "";
  let role;
  try { role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role; } catch { /* publishable keys are not JWTs */ }
  if (key.startsWith("sb_secret_") || role === "service_role") throw new Error("Usá sólo la clave pública publishable/anon de Supabase, nunca service_role.");
  if (Boolean(env.VITE_SUPABASE_URL) !== Boolean(key)) throw new Error("Configurá juntas VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
  if (env.VITE_SUPABASE_URL && !/^https:\/\/[^/]+$/.test(env.VITE_SUPABASE_URL)) throw new Error("VITE_SUPABASE_URL debe ser una URL HTTPS sin ruta ni barra final.");
  return {
  plugins: [contentPlugin()],
  base: "./",
  build: { rolldownOptions: { input: { main: "index.html", admin: "admin/index.html" } } },
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  };
});
