// Cliente mínimo de Supabase (Auth + PostgREST) para el panel y el sitio.
// Sólo se publica la clave publishable/anon; las operaciones administrativas
// se autorizan en PostgreSQL y nunca desde el navegador.
const env = import.meta.env || {};
const base = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || "";
const STORAGE_KEY = "jcbarber.admin.session.v1";

export const isConfigured = Boolean(base && key);
// Un servidor estático no transforma import.meta.env ni lee el archivo .env.
export const configurationIssue = isConfigured
  ? ""
  : !env.MODE
    ? "Abriste el código fuente sin Vite. Ejecutá npm.cmd run dev desde la carpeta del proyecto y abrí la dirección que indique. Un servidor estático no carga el archivo .env."
    : `Falta configurar ${[!base && "VITE_SUPABASE_URL", !key && "VITE_SUPABASE_ANON_KEY"].filter(Boolean).join(" y ")} en esta versión del sitio. Completá la configuración y reiniciá Vite o generá un nuevo despliegue.`;

let session = readStoredSession();
let epoch = 0;
let refreshing = null;
const listeners = new Set();

function readStoredSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token ? parsed : null;
  } catch {
    return null;
  }
}

function writeSession(next) {
  session = next;
  try {
    if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
  for (const listener of listeners) listener(session);
}

function changed() {
  for (const listener of listeners) listener(session);
}

function failure(message, code = "NETWORK", status = 0) {
  return Object.assign(new Error(message), { code, status });
}

async function request(path, body, token, method = "POST") {
  if (!isConfigured) {
    throw failure(
      "La conexión con Supabase no está configurada en este despliegue.",
      "CONFIG",
    );
  }
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: {
        apikey: key,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw failure(
      "No pudimos conectar con Supabase. Revisá tu conexión. Si el problema continúa, pedile al responsable del sitio que compruebe la URL y que el proyecto esté activo.",
    );
  }
  if (response.status === 204) return null;
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const code =
      result?.code ||
      result?.error_code ||
      (result?.message === "Invalid API key"
        ? "invalid_api_key"
        : String(response.status));
    const messages = {
      "42501": "Tu usuario no está autorizado para administrar la agenda.",
      "23P01":
        "Ese horario se superpone con una reserva o un bloqueo. Elegí otro.",
      "23505": "La operación entra en conflicto con datos existentes.",
      "40001": "La agenda está siendo actualizada. Reintentá la operación.",
      "22023": result?.message,
      "55000": result?.message,
      invalid_api_key:
        "La clave pública de Supabase no es válida. Copiá la clave publishable/anon del mismo proyecto que la URL y reconstruí el sitio.",
      PGRST202:
        "Falta aplicar una migración de Supabase o el contrato RPC no coincide.",
      invalid_credentials: "El correo o la contraseña son incorrectos.",
      invalid_grant: "El correo o la contraseña son incorrectos.",
      email_not_confirmed: "Confirmá tu correo antes de ingresar.",
      user_not_found: "El correo o la contraseña son incorrectos.",
      weak_password: "La contraseña no cumple la política de seguridad.",
      same_password: "Elegí una contraseña distinta de la anterior.",
      otp_expired: "El enlace venció o ya fue usado. Solicitá uno nuevo desde «Olvidé mi contraseña».",
      over_email_send_rate_limit: "Esperá unos minutos antes de pedir otro correo.",
    };
    let message = messages[code];
    if (response.status === 401 && !message) {
      message = "La sesión venció. Ingresá nuevamente.";
    } else if (response.status === 429) {
      message = "Hubo demasiados intentos. Esperá unos minutos.";
    }
    throw failure(
      message ||
        "No se pudo completar la operación. Revisá los datos e intentá de nuevo.",
      code,
      response.status,
    );
  }
  return result;
}

export function onAuthChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function hasSession() {
  return Boolean(session?.access_token);
}

export function currentUserEmail() {
  return session?.user?.email || "";
}

export async function getSession() {
  if (!session) return null;
  if (session.expires_at > Date.now() / 1000 + 60) return session;
  if (refreshing) return refreshing;
  const generation = epoch;
  const refreshToken = session.refresh_token;
  if (!refreshToken) {
    writeSession(null);
    return null;
  }
  refreshing = (async () => {
    try {
      const next = await request("/auth/v1/token?grant_type=refresh_token", {
        refresh_token: refreshToken,
      });
      if (generation !== epoch) return session;
      const stored = {
        ...next,
        password_setup: session?.password_setup,
        expires_at: Date.now() / 1000 + next.expires_in,
      };
      writeSession(stored);
      return stored;
    } catch (error) {
      if (generation === epoch) writeSession(null);
      throw error;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function signIn(email, password) {
  const generation = ++epoch;
  const result = await request("/auth/v1/token?grant_type=password", {
    email,
    password,
  });
  if (generation !== epoch) return null;
  writeSession({
    ...result,
    expires_at: Date.now() / 1000 + result.expires_in,
  });
  return session;
}

export async function signOut() {
  const token = session?.access_token;
  epoch += 1;
  writeSession(null);
  if (token) {
    try {
      await request("/auth/v1/logout", undefined, token);
    } catch {
      // La sesión local ya quedó cerrada; un fallo de red no debe retenerla.
    }
  }
}

export function needsPasswordSetup() {
  return Boolean(session?.password_setup);
}

// Los enlaces estándar de Supabase vuelven con tokens en el fragmento.
// Se limpian antes de hacer red; /user valida el token con Auth, no con un JWT local.
export async function acceptAccountLink() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const authKeys = ["access_token", "refresh_token", "expires_in", "expires_at", "token_type", "type", "token_hash", "code", "error", "error_code", "error_description"];
  if (!authKeys.some((name) => hash.has(name) || url.searchParams.has(name))) return false;
  const params = hash.has("access_token") || hash.has("error") ? hash : url.searchParams;
  const values = new URLSearchParams(params);
  for (const name of authKeys) {
    url.searchParams.delete(name);
    hash.delete(name);
  }
  url.hash = hash.toString();
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  const generation = ++epoch;
  writeSession(null);
  const type = values.get("type");
  const invalid = () => failure("El enlace venció, ya fue usado o no es válido. Solicitá uno nuevo desde «Olvidé mi contraseña».", "ACCOUNT_LINK");
  if (values.has("error") || !["invite", "recovery"].includes(type)) throw invalid();
  let next;
  if (values.get("token_hash")) {
    next = await request("/auth/v1/verify", { token_hash: values.get("token_hash"), type });
  } else {
    next = {
      access_token: values.get("access_token"),
      refresh_token: values.get("refresh_token"),
      expires_in: Number(values.get("expires_in")),
    };
  }
  if (!next?.access_token || !next.refresh_token) throw invalid();
  let user;
  try {
    user = await request("/auth/v1/user", undefined, next.access_token, "GET");
  } catch (error) {
    if (error.status === 401 || error.status === 403) throw invalid();
    throw error;
  }
  if (!user?.id || !user.email) throw invalid();
  if (generation !== epoch) return false;
  const ttl = Number(next.expires_in);
  writeSession({
    ...next,
    user,
    password_setup: type,
    expires_at: Date.now() / 1000 + (Number.isFinite(ttl) && ttl > 0 ? ttl : 0),
  });
  return true;
}

export async function requestPasswordReset(email) {
  const redirect = new URL(window.location.href);
  redirect.search = "";
  redirect.hash = "";
  return request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect.href)}`, { email });
}

export async function setAccountPassword(password) {
  const current = await getSession();
  if (!current?.password_setup) {
    throw failure("Abrí el enlace de tu correo para elegir una contraseña.", "ACCOUNT_LINK");
  }
  await request("/auth/v1/user", { password }, current.access_token, "PUT");
  // Pedir login con la nueva clave: la autorización del panel sigue en PostgreSQL.
  await signOut();
}

export async function rpc(name, args = {}) {
  if (!/^[a-z_]+$/.test(name)) throw failure("Operación inválida.", "CONFIG");
  const current = await getSession();
  if (current?.password_setup) {
    throw failure("Primero guardá tu contraseña para entrar al panel.", "ACCOUNT_LINK");
  }
  const generation = epoch;
  try {
    return await request(
      `/rest/v1/rpc/${name}`,
      args,
      current?.access_token,
    );
  } catch (error) {
    if (error.status === 401 && current && generation === epoch) {
      epoch += 1;
      writeSession(null);
      changed();
    }
    throw error;
  }
}
