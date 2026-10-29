// Supabase's public HTTP APIs. Only the publishable/anon key belongs in this build.
// Administrator tokens live in memory: closing/reloading the page requires login.
const env = import.meta.env || {};
const base = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_ANON_KEY || "";
export const isConfigured = Boolean(base && key);
let session = null;
let epoch = 0;
let refreshing = null;
const listeners = new Set();

function changed() {
  for (const listener of listeners) listener(session);
}
function failure(message, code = "NETWORK", status = 0) {
  return Object.assign(new Error(message), { code, status });
}
async function request(path, body, token, method = "POST") {
  if (!isConfigured) throw failure("La conexión de reservas todavía no está configurada.", "CONFIG");
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
    throw failure("No pudimos comprobar la respuesta del servidor. Revisá la conexión y reintentá con los mismos datos.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const code = result?.code || result?.error_code || String(response.status);
    const messages = {
      "42501": "Tu usuario no está autorizado para administrar la agenda.",
      "23P01": "Ese horario se superpone con una reserva o un bloqueo. Elegí otro horario.",
      "23505": "La solicitud ya fue utilizada con otros datos. Actualizá la disponibilidad.",
      "40001": "La agenda está siendo actualizada. Reintentá la operación.",
      invalid_credentials: "El correo o la contraseña son incorrectos.",
      invalid_grant: "El correo o la contraseña son incorrectos.",
      email_not_confirmed: "Confirmá tu correo antes de ingresar.",
      otp_expired: "El enlace venció o ya fue utilizado. Solicitá uno nuevo.",
      weak_password: "La contraseña no cumple la política de seguridad configurada.",
      same_password: "Elegí una contraseña diferente de la anterior.",
    };
    let message = messages[code];
    if (["22023", "55000"].includes(code)) message = result.message;
    if (response.status === 401) message = "La sesión venció o los datos de acceso son incorrectos. Ingresá nuevamente.";
    if (response.status === 429) message = "Hubo demasiados intentos. Esperá unos minutos y volvé a intentar.";
    throw failure(message || "No se pudo completar la operación. Revisá los datos y la configuración de Supabase.", code, response.status);
  }
  return result;
}

export async function getSession() {
  if (!session || session.expires_at > Date.now() / 1000 + 60) return session;
  if (!refreshing) {
    const generation = epoch;
    const refreshToken = session.refresh_token;
    refreshing = (async () => {
      try {
        const next = await request("/auth/v1/token?grant_type=refresh_token", { refresh_token: refreshToken });
        if (generation === epoch) session = { ...next, expires_at: Date.now() / 1000 + next.expires_in };
      } catch (error) {
        if (generation === epoch) { session = null; epoch += 1; changed(); }
        throw error;
      } finally { refreshing = null; }
      return session;
    })();
  }
  return refreshing;
}

export async function signIn(email, password) {
  const generation = ++epoch;
  session = null;
  const result = await request("/auth/v1/token?grant_type=password", { email, password });
  if (generation !== epoch) return null;
  session = { ...result, expires_at: Date.now() / 1000 + result.expires_in };
  changed();
  return session;
}

export async function signOut() {
  const token = session?.access_token;
  epoch += 1;
  session = null;
  changed();
  if (token) await request("/auth/v1/logout", undefined, token);
}

export function onAuthChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export async function requestPasswordReset(email) {
  const redirect = new URL("/admin/", window.location.origin).href;
  await request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`, { email });
}

// Read once, remove secrets from history immediately; never persist email tokens.
// Supports Supabase's default implicit links and token_hash email templates.
export function takeEmailLink() {
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const type = url.searchParams.get("type") || fragment.get("type");
  const tokenHash = url.searchParams.get("token_hash");
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  const error = fragment.get("error") || url.searchParams.get("error");
  if (!tokenHash && !accessToken && !error) return null;
  window.history.replaceState(null, "", url.pathname);
  if (error || !["recovery", "invite"].includes(type) || (!tokenHash && (!accessToken || !refreshToken))) {
    return { error: "El enlace no es válido o venció. Solicitá uno nuevo." };
  }
  return { type, tokenHash, accessToken, refreshToken };
}

export async function acceptEmailLink(link) {
  const generation = ++epoch;
  session = null;
  let result;
  if (link.tokenHash) {
    result = await request("/auth/v1/verify", { token_hash: link.tokenHash, type: link.type });
  } else {
    // Auth validates the token; URL contents alone never authorize a user.
    const user = await request("/auth/v1/user", undefined, link.accessToken, "GET");
    result = { access_token: link.accessToken, refresh_token: link.refreshToken, expires_in: 0, user };
  }
  if (generation !== epoch) throw failure("El acceso cambió. Abrí un enlace nuevo.");
  session = { ...result, expires_at: Date.now() / 1000 + result.expires_in };
  // Do not expose the administrative panel before the password is set.
  return session;
}

export async function updatePassword(password) {
  const current = await getSession();
  if (!current) throw failure("Solicitá un enlace nuevo para establecer tu contraseña.");
  await request("/auth/v1/user", { password }, current.access_token, "PUT");
}

export async function rpc(name, args = {}) {
  if (!/^[a-z_]+$/.test(name)) throw failure("Operación inválida.", "CONFIG");
  const current = await getSession();
  const generation = epoch;
  try {
    return await request(`/rest/v1/rpc/${name}`, args, current?.access_token);
  } catch (error) {
    if (error.status === 401 && current && generation === epoch) {
      epoch += 1;
      session = null;
      changed();
    }
    throw error;
  }
}
