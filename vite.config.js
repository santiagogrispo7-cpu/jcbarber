import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_SUPABASE_");
  const clean = (value) =>
    String(value ?? "")
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2")
      .trim();
  const url = clean(env.VITE_SUPABASE_URL);
  const key = clean(env.VITE_SUPABASE_ANON_KEY);
  let role;
  try {
    role = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString(),
    ).role;
  } catch {
    /* publishable keys are not JWTs */
  }
  if (key.startsWith("sb_secret_") || role === "service_role")
    throw new Error(
      "Usá sólo la clave pública publishable/anon de Supabase, nunca service_role.",
    );
  if (Boolean(url) !== Boolean(key))
    throw new Error(
      "Configurá juntas VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.",
    );
  if (url && !/^https:\/\/[^/]+$/.test(url))
    throw new Error(
      "VITE_SUPABASE_URL debe ser una URL HTTPS sin ruta ni barra final.",
    );
  return {
    base: "./",
    build: {
      rolldownOptions: {
        input: {
          main: "index.html",
          admin: "admin/index.html",
          panel: "panel-admin.html",
        },
      },
    },
    server: { host: "127.0.0.1" },
    preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  };
});
