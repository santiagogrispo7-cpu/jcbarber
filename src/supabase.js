// Cliente mínimo de Supabase (Auth + PostgREST) para el panel y el sitio.
// Sólo se publica la clave publishable/anon; las operaciones administrativas
// se autorizan en PostgreSQL y nunca desde el navegador.
const env = import.meta.env || {};
const base = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || "";
const STORAGE_KEY = "jcbarber.admin.session.v1";

export const isConfigured = Boolean(base && key);

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
      "No pudimos conectar con Supabase. Revisá la conexión y reintentá.",
    );
  }
  if (response.status === 204) return null;
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const code = result?.code || result?.error_code || String(response.status);
    const messages = {
      "42501": "Tu usuario no está autorizado para administrar la agenda.",
      "23P01":
        "Ese horario se superpone con una reserva o un bloqueo. Elegí otro.",
      "23505": "La operación entra en conflicto con datos existentes.",
      "40001": "La agenda está siendo actualizada. Reintentá la operación.",
      "22023": result?.message,
      "55000": result?.message,
      PGRST202:
        "Falta aplicar una migración de Supabase o el contrato RPC no coincide.",
      invalid_credentials: "El correo o la contraseña son incorrectos.",
      invalid_grant: "El correo o la contraseña son incorrectos.",
      email_not_confirmed: "Confirmá tu correo antes de ingresar.",
      user_not_found: "El correo o la contraseña son incorrectos.",
      weak_password: "La contraseña no cumple la política de seguridad.",
    };
    let message = messages[code];
    if (response.status === 401) {
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

export async function rpc(name, args = {}) {
  if (!/^[a-z_]+$/.test(name)) throw failure("Operación inválida.", "CONFIG");
  const current = await getSession();
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
