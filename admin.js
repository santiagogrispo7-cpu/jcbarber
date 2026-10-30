/* Panel /admin: Supabase Auth + RPC. No hay claves privadas ni datos locales. */
import {
  configurationIssue,
  currentUserEmail,
  getSession,
  hasSession,
  isConfigured,
  rpc,
  signIn,
  signOut,
} from "./src/supabase.js";

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const MAX_AMOUNT = 10000000;
const SNAPSHOT_DAYS = 365;
const PARTIAL_BLOCK_MINUTES = 45;

const SUGGESTED_SERVICE_PRICES = {
  "corte general": 18000,
  "corte a domicilio": 30000,
  barba: 10000,
  "perfilado de cejas": 8000,
};

const DEFAULT_MEMBERSHIPS = [
  { id: "membresia-2", name: "Membresía 2 cortes", amount: 30000 },
  { id: "membresia-3", name: "Membresía 3 cortes", amount: 45000 },
  { id: "membresia-4", name: "Membresía 4 cortes", amount: 50000 },
];

const SCHEDULES = {
  local: [
    ["09:00", "12:30"],
    ["16:30", "20:30"],
  ],
  home: [
    ["07:00", "08:30"],
    ["12:45", "15:45"],
  ],
};

const $ = (id) => document.getElementById(id);
const blockForm = $("block-form");
const blockDate = $("block-date");
const blockScope = $("block-scope");
const blockTime = $("block-time");
const blockReason = $("block-reason");

const state = {
  snapshot: null,
  site: null,
  services: [],
  memberships: [],
  blocks: [],
  busy: false,
  today: todayISO(),
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const normalizeName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es-AR");
const pad = (value) => String(value).padStart(2, "0");

function todayISO() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysISO(iso, amount) {
  const [year, month, day] = iso.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return value.toISOString().slice(0, 10);
}

function dateAtUTCNoon(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatLongDate(iso) {
  if (!iso) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateAtUTCNoon(iso));
}

function formatWeekday(iso) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(dateAtUTCNoon(iso))
    .replace(".", "");
}

function formatMonth(iso) {
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(dateAtUTCNoon(iso))
    .replace(".", "");
}

function argentinaDate(instant) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

function argentinaTime(instant) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}

function buenosAiresISO(date, time) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

function wholeDayRange(date) {
  return {
    startsAt: buenosAiresISO(date, "00:00"),
    endsAt: buenosAiresISO(addDaysISO(date, 1), "00:00"),
  };
}

function partialRange(date, time) {
  const startsAt = buenosAiresISO(date, time);
  return {
    startsAt,
    endsAt: new Date(
      new Date(startsAt).getTime() + PARTIAL_BLOCK_MINUTES * 60000,
    ).toISOString(),
  };
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function blockTimeOptions(date) {
  if (!date) return [];
  const values = new Set();
  Object.values(SCHEDULES).forEach((windows) => {
    windows.forEach(([start, end]) => {
      for (
        let minute = timeToMinutes(start);
        minute + 30 <= timeToMinutes(end);
        minute += 30
      ) {
        values.add(minutesToTime(minute));
      }
    });
  });
  return [...values].sort();
}

function modesLabel(modes) {
  const values = Array.isArray(modes) ? modes : [];
  if (values.includes("local") && values.includes("home")) {
    return "Local y domicilio";
  }
  if (values.includes("home")) return "A domicilio";
  return "En el local";
}

function durationLabel(minutes) {
  return minutes ? `${minutes} min` : "";
}

function setInlineFeedback(target, message = "", type = "ok") {
  target.textContent = message;
  target.classList.toggle("is-error", type === "error");
  target.classList.toggle("is-ok", type === "ok" && Boolean(message));
}

function panelFeedback(message = "", type = "ok") {
  setInlineFeedback($("panel-status"), message, type);
}

function loginFeedback(message = "", type = "ok") {
  setInlineFeedback($("login-status"), message, type);
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "admin-icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${name}`);
  svg.append(use);
  return svg;
}

function setLoginBusy(busy) {
  state.busy = busy;
  $("login-form").setAttribute("aria-busy", String(busy));
  for (const node of $("login-form").elements) {
    node.disabled = busy || !isConfigured;
  }
}

function showAccessHelp(error) {
  if (["CONFIG", "NETWORK", "MIGRATION", "42501", "invalid_api_key"].includes(error?.code)) {
    $("admin-setup").open = true;
  }
}

function showLogin(message = "", type = "ok") {
  $("panel-view").hidden = true;
  $("login-view").hidden = false;
  document.body.dataset.auth = "signed-out";
  loginFeedback(message, type);
  if (message) {
    requestAnimationFrame(() => $("login-status").scrollIntoView({ block: "nearest" }));
  }
}

function clearPanel() {
  state.snapshot = null;
  state.site = null;
  state.services = [];
  state.memberships = [];
  state.blocks = [];
  $("service-cards").replaceChildren();
  $("blocks-list").replaceChildren();
  $("blocks-summary").textContent = "";
  $("account-email").textContent = "";
  panelFeedback();
  setInlineFeedback($("prices-feedback"));
  setInlineFeedback($("block-feedback"));
}

function showPanel() {
  $("login-view").hidden = true;
  $("panel-view").hidden = false;
  document.body.dataset.auth = "signed-in";
  $("account-email").textContent = currentUserEmail();
  loginFeedback();
  setLoginBusy(false);
}

function authFailure(error) {
  return (
    error?.status === 401 ||
    error?.code === "invalid_token" ||
    error?.code === "42501"
  );
}

async function leaveToLogin(message, type = "error") {
  await signOut();
  clearPanel();
  showLogin(message, type);
  setLoginBusy(false);
}

function normalizeBlock(block) {
  const date = argentinaDate(block.starts_at);
  const startTime = argentinaTime(block.starts_at);
  const endTime = argentinaTime(block.ends_at);
  const endDate = argentinaDate(block.ends_at);
  const fullDay =
    startTime === "00:00" && endTime === "00:00" && endDate > date;
  return {
    id: block.id,
    date,
    time: fullDay ? "" : startTime,
    endTime: fullDay ? "" : endTime,
    fullDay,
    reason: String(block.reason || "Sin motivo").slice(0, 250),
    startsAt: block.starts_at,
    endsAt: block.ends_at,
  };
}

function sortBlocks() {
  state.blocks.sort(
    (a, b) =>
      `${a.date} ${a.time || "00:00"}`.localeCompare(
        `${b.date} ${b.time || "00:00"}`,
      ) || a.id.localeCompare(b.id),
  );
}

function priceField(label, owner, id, value, ownerName) {
  const wrapper = document.createElement("label");
  wrapper.className = "admin-price-field";
  const text = document.createElement("span");
  text.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = String(MAX_AMOUNT);
  input.step = "100";
  input.inputMode = "numeric";
  input.value = String(Math.round(Number(value) || 0));
  input.dataset.priceOwner = owner;
  input.dataset.priceId = id;
  input.setAttribute("aria-label", `${label} de ${ownerName || id}`);
  wrapper.append(text, input);
  return wrapper;
}

function serviceCard(service) {
  const card = document.createElement("article");
  card.className = "admin-service-card admin-price-card";
  const head = document.createElement("div");
  head.className = "admin-service-card-head";
  head.append(el("h3", service.name));
  const tag = el("span", null, "admin-price-tag");
  tag.append(icon("a-edit"), document.createTextNode("Editable"));
  head.append(tag);
  card.append(head);

  const fields = document.createElement("div");
  fields.className = "admin-price-fields";
  fields.append(
    priceField(
      "Precio (ARS)",
      "service",
      service.id,
      service.price,
      service.name,
    ),
  );
  card.append(fields);

  const meta = el(
    "p",
    [durationLabel(service.duration_minutes), modesLabel(service.modes)]
      .filter(Boolean)
      .join(" · "),
    "admin-service-meta",
  );
  card.append(meta);
  return card;
}

function membershipCard(membership) {
  const card = document.createElement("article");
  card.className = "admin-service-card admin-price-card is-membership";
  const head = document.createElement("div");
  head.className = "admin-service-card-head";
  head.append(el("h3", membership.name));
  const tag = el("span", null, "admin-price-tag");
  tag.append(icon("a-edit"), document.createTextNode("Editable"));
  head.append(tag);
  card.append(head);

  const fields = document.createElement("div");
  fields.className = "admin-price-fields";
  fields.append(
    priceField(
      "Precio (ARS)",
      "membership",
      membership.id,
      membership.amount,
      membership.name,
    ),
  );
  card.append(fields);
  card.append(
    el(
      "p",
      "Solo domicilio · Al mes, se abona del 1 al 5",
      "admin-service-meta",
    ),
  );
  return card;
}

function renderServiceCards() {
  const container = $("service-cards");
  const services = state.services.filter((service) => service.active);
  const extras = services.filter((service) =>
    ["barba", "perfilado de cejas"].includes(normalizeName(service.name)),
  );
  const bookable = services.filter(
    (service) =>
      !["barba", "perfilado de cejas"].includes(normalizeName(service.name)),
  );
  const cards = bookable.map(serviceCard);

  if (extras.length) {
    const extraCard = document.createElement("article");
    extraCard.className = "admin-service-card is-extra admin-price-card";
    extraCard.append(el("h3", "Extras del corte general"));
    const extraFields = document.createElement("div");
    extraFields.className = "admin-price-fields";
    extras.forEach((extra) => {
      extraFields.append(
        priceField(
          `${extra.name} (ARS)`,
          "service",
          extra.id,
          extra.price,
          extra.name,
        ),
      );
    });
    extraCard.append(extraFields);
    extraCard.append(
      el(
        "p",
        "Se suman al corte general y a su duración.",
        "admin-service-detail",
      ),
    );
    cards.push(extraCard);
  }

  state.memberships.forEach((membership) =>
    cards.push(membershipCard(membership)),
  );

  if (!cards.length) {
    cards.push(
      el(
        "p",
        "No hay servicios activos. Revisá la configuración en Supabase.",
        "admin-empty",
      ),
    );
  }
  container.replaceChildren(...cards);
}

function renderBlocks() {
  const list = $("blocks-list");
  const today = todayISO();
  const upcoming = state.blocks.filter((block) => block.date >= today);
  const cards = upcoming.map((block) => {
    const card = document.createElement("article");
    card.className = "block-card";
    card.dataset.id = block.id;

    const date = document.createElement("div");
    date.className = "block-date";
    date.setAttribute("aria-label", formatLongDate(block.date));
    date.append(
      el("span", formatWeekday(block.date), "block-weekday"),
      el("strong", String(Number(block.date.slice(-2))), "block-day"),
      el("span", formatMonth(block.date), "block-month"),
    );

    const body = document.createElement("div");
    body.className = "block-body";
    const top = document.createElement("div");
    top.className = "block-top";
    top.append(
      el("h4", formatLongDate(block.date), "block-title"),
      el(
        "span",
        block.fullDay ? "Todo el día" : "Horario puntual",
        "block-badge",
      ),
    );

    const when = block.fullDay
      ? "Todo el día · Local y domicilio"
      : `${block.time} a ${block.endTime} · Local y domicilio`;
    const release = document.createElement("button");
    release.type = "button";
    release.className =
      "admin-button admin-button-small admin-button-danger";
    release.dataset.action = "release";
    release.dataset.id = block.id;
    release.setAttribute(
      "aria-label",
      `Liberar el bloqueo del ${formatLongDate(block.date)} ${
        block.fullDay ? "todo el día" : `de ${block.time} a ${block.endTime}`
      }`,
    );
    release.append(icon("a-x"), document.createTextNode("Liberar horario"));

    body.append(
      top,
      el("p", when, "block-when"),
      el("p", `Motivo: ${block.reason}`, "block-reason"),
      release,
    );
    card.append(date, body);
    return card;
  });

  list.replaceChildren(...cards);
  $("blocks-empty").hidden = upcoming.length > 0;
  $("blocks-summary").textContent = upcoming.length
    ? `${upcoming.length} ${
        upcoming.length === 1 ? "bloqueo vigente" : "bloqueos vigentes"
      }.`
    : "";
}

function readPrice(input) {
  if (input.value.trim() === "") return null;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) return null;
  return Math.round(value);
}

async function loadData() {
  let snapshot;
  let site;
  try {
    [snapshot, site] = await Promise.all([
      rpc("admin_snapshot", {
        p_from: state.today,
        p_to: addDaysISO(state.today, SNAPSHOT_DAYS),
      }),
      rpc("public_site_catalog"),
    ]);
  } catch (error) {
    if (error?.code === "PGRST202") {
      throw Object.assign(
        new Error(
          "Faltan funciones del panel en Supabase. Aplicá las migraciones pendientes en orden, incluida 202610290001_panel_integration.sql (paso 2 de la ayuda).",
        ),
        { code: "MIGRATION" },
      );
    }
    throw error;
  }
  if (!snapshot || !Array.isArray(snapshot.services)) {
    throw new Error("Supabase devolvió una agenda incompleta.");
  }
  state.snapshot = snapshot;
  state.site = site;
  state.services = snapshot.services;
  state.memberships =
    Array.isArray(site?.memberships) && site.memberships.length
      ? site.memberships
      : clone(DEFAULT_MEMBERSHIPS);
  state.blocks = (Array.isArray(snapshot.blocks) ? snapshot.blocks : [])
    .map(normalizeBlock)
    .filter((block) => block.id && block.date);
  sortBlocks();
  state.today = todayISO();
  blockDate.min = state.today;
  if (!blockDate.value || blockDate.value < state.today) {
    blockDate.value = state.today;
  }
  renderServiceCards();
  syncBlockFields();
  renderBlocks();
}

async function enterPanel() {
  setLoginBusy(true);
  loginFeedback("Comprobando sesión…");
  try {
    const session = await getSession();
    if (!session) {
      showLogin("Ingresá con tu cuenta autorizada.", "error");
      setLoginBusy(false);
      return;
    }
    await loadData();
    showPanel();
  } catch (error) {
    showAccessHelp(error);
    if (authFailure(error)) {
      await leaveToLogin(
        error?.code === "42501"
          ? "Tu cuenta existe, pero no tiene permiso de administrador. Agregá su UUID a jc_private.authorized_admins desde SQL Editor (paso 3 de la ayuda)."
          : "La sesión venció. Ingresá nuevamente.",
      );
      return;
    }
    showLogin(error.message || "No pudimos cargar el panel.", "error");
    setLoginBusy(false);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  if (state.busy) return;
  if (!isConfigured) {
    showLogin(configurationIssue, "error");
    $("admin-setup").open = true;
    return;
  }
  loginFeedback();
  const email = $("login-email").value.trim();
  const password = $("login-password").value;
  if (!email || !password) {
    loginFeedback("Ingresá tu correo y contraseña.", "error");
    (!email ? $("login-email") : $("login-password")).focus();
    return;
  }
  setLoginBusy(true);
  loginFeedback("Ingresando…");
  try {
    const session = await signIn(email, password);
    $("login-password").value = "";
    if (!session) {
      showLogin("El acceso cambió. Volvé a intentar.", "error");
      setLoginBusy(false);
      return;
    }
    await enterPanel();
  } catch (error) {
    showAccessHelp(error);
    showLogin(error.message || "No pudimos iniciar sesión.", "error");
    setLoginBusy(false);
  }
}

async function handleLogout() {
  $("logout-button").disabled = true;
  await signOut();
  clearPanel();
  showLogin("Sesión cerrada.", "ok");
  setLoginBusy(false);
  $("logout-button").disabled = false;
  $("login-email").focus();
}

async function refreshPanel() {
  if (state.busy || $("panel-view").hidden) return;
  state.busy = true;
  $("refresh-panel").disabled = true;
  panelFeedback("Actualizando…");
  try {
    await loadData();
    panelFeedback("Datos actualizados desde Supabase.");
  } catch (error) {
    if (authFailure(error)) {
      await leaveToLogin("La sesión venció. Ingresá nuevamente.");
      return;
    }
    panelFeedback(
      error.message || "No pudimos actualizar los datos.",
      "error",
    );
  } finally {
    state.busy = false;
    $("refresh-panel").disabled = false;
  }
}

function setFormBusy(form, busy) {
  form.setAttribute("aria-busy", String(busy));
  form.querySelectorAll("button, input, select").forEach((node) => {
    if (node.id === "block-mode") return;
    node.disabled = busy;
  });
}

async function persistPrices(services, memberships) {
  await rpc("admin_save_config", {
    p_data: {
      settings: state.snapshot.settings,
      services,
      hours: state.snapshot.hours,
    },
  });
  await rpc("admin_save_site_catalog", {
    p_data: { memberships },
  });
}

async function savePrices(event) {
  event.preventDefault();
  if (state.busy || !state.snapshot) return;
  setInlineFeedback($("prices-feedback"));
  const inputs = [...$("service-cards").querySelectorAll("[data-price-id]")];
  inputs.forEach((input) => input.removeAttribute("aria-invalid"));
  const invalid = inputs.find((input) => readPrice(input) === null);
  if (invalid) {
    invalid.setAttribute("aria-invalid", "true");
    setInlineFeedback(
      $("prices-feedback"),
      "Revisá los importes: deben ser números entre 0 y 10.000.000.",
      "error",
    );
    invalid.focus();
    return;
  }

  const servicePrices = new Map();
  const membershipPrices = new Map();
  inputs.forEach((input) => {
    const value = readPrice(input);
    if (input.dataset.priceOwner === "membership") {
      membershipPrices.set(input.dataset.priceId, value);
    } else {
      servicePrices.set(input.dataset.priceId, value);
    }
  });

  const services = state.snapshot.services.map((service) =>
    servicePrices.has(service.id)
      ? { ...service, price: servicePrices.get(service.id) }
      : service,
  );
  const memberships = state.memberships.map((membership) =>
    membershipPrices.has(membership.id)
      ? { ...membership, amount: membershipPrices.get(membership.id) }
      : membership,
  );

  setFormBusy($("prices-form"), true);
  try {
    await persistPrices(services, memberships);
    await loadData();
    setInlineFeedback(
      $("prices-feedback"),
      "Precios guardados. El sitio público ya los muestra desde Supabase.",
    );
    panelFeedback("");
  } catch (error) {
    if (authFailure(error)) {
      await leaveToLogin("La sesión venció. Ingresá nuevamente.");
      return;
    }
    setInlineFeedback(
      $("prices-feedback"),
      error.message || "No pudimos guardar los precios.",
      "error",
    );
  } finally {
    setFormBusy($("prices-form"), false);
  }
}

async function resetPrices() {
  if (state.busy || !state.snapshot) return;
  const confirmed = window.confirm(
    "¿Restaurar los precios sugeridos? También se actualiza el sitio público.",
  );
  if (!confirmed) return;
  const services = state.snapshot.services.map((service) => {
    const suggested = SUGGESTED_SERVICE_PRICES[normalizeName(service.name)];
    return suggested == null ? service : { ...service, price: suggested };
  });
  const memberships = state.memberships.map((membership) => {
    const suggested = DEFAULT_MEMBERSHIPS.find(
      (item) => item.id === membership.id,
    );
    return suggested ? { ...membership, amount: suggested.amount } : membership;
  });
  setFormBusy($("prices-form"), true);
  try {
    await persistPrices(services, memberships);
    await loadData();
    setInlineFeedback(
      $("prices-feedback"),
      "Precios restaurados y guardados en Supabase.",
    );
  } catch (error) {
    if (authFailure(error)) {
      await leaveToLogin("La sesión venció. Ingresá nuevamente.");
      return;
    }
    setInlineFeedback(
      $("prices-feedback"),
      error.message || "No pudimos restaurar los precios.",
      "error",
    );
  } finally {
    setFormBusy($("prices-form"), false);
  }
}

function populateBlockTimes() {
  const previous = blockTime.value;
  const slots =
    blockScope.value === "time" ? blockTimeOptions(blockDate.value) : [];
  blockTime.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = slots.length
    ? "Elegí un horario"
    : "Sin horarios para esa fecha";
  blockTime.append(placeholder);
  slots.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot;
    option.textContent = slot;
    blockTime.append(option);
  });
  if (slots.includes(previous)) blockTime.value = previous;
  const hint = $("block-time-hint");
  if (!blockDate.value) hint.textContent = "Elegí primero la fecha.";
  else if (!slots.length) hint.textContent = "No hay franjas para esa fecha.";
  else
    hint.textContent = `El bloqueo cubre ${PARTIAL_BLOCK_MINUTES} minutos desde el inicio elegido.`;
}

function syncBlockFields() {
  const timeScope = blockScope.value === "time";
  $("block-time-field").hidden = !timeScope;
  blockTime.disabled = !timeScope;
  blockTime.required = timeScope;
  if (timeScope) populateBlockTimes();
  else blockTime.value = "";
}

async function reloadBlocks() {
  const snapshot = await rpc("admin_snapshot", {
    p_from: state.today,
    p_to: addDaysISO(state.today, SNAPSHOT_DAYS),
  });
  state.snapshot = snapshot;
  state.blocks = (Array.isArray(snapshot.blocks) ? snapshot.blocks : [])
    .map(normalizeBlock)
    .filter((block) => block.id && block.date);
  sortBlocks();
  renderBlocks();
}

async function addBlock(event) {
  event.preventDefault();
  if (state.busy || !state.snapshot) return;
  setInlineFeedback($("block-feedback"));
  [blockDate, blockTime, blockReason].forEach((field) =>
    field.removeAttribute("aria-invalid"),
  );

  const date = blockDate.value;
  const scope = blockScope.value;
  const time = scope === "time" ? blockTime.value : "";
  const reason = blockReason.value.trim();

  if (!date) {
    blockDate.setAttribute("aria-invalid", "true");
    setInlineFeedback(
      $("block-feedback"),
      "Elegí la fecha que querés bloquear.",
      "error",
    );
    blockDate.focus();
    return;
  }
  if (date < todayISO()) {
    blockDate.setAttribute("aria-invalid", "true");
    setInlineFeedback(
      $("block-feedback"),
      "La fecha ya pasó. Elegí hoy o un día futuro.",
      "error",
    );
    blockDate.focus();
    return;
  }
  if (scope === "time" && !time) {
    blockTime.setAttribute("aria-invalid", "true");
    setInlineFeedback(
      $("block-feedback"),
      "Elegí el horario que no vas a poder atender.",
      "error",
    );
    blockTime.focus();
    return;
  }
  if (reason.length < 3) {
    blockReason.setAttribute("aria-invalid", "true");
    setInlineFeedback(
      $("block-feedback"),
      "Escribí el motivo del bloqueo (mínimo 3 caracteres).",
      "error",
    );
    blockReason.focus();
    return;
  }

  const range = time ? partialRange(date, time) : wholeDayRange(date);
  const duplicated = state.blocks.some(
    (block) => block.startsAt === range.startsAt,
  );
  if (duplicated) {
    setInlineFeedback(
      $("block-feedback"),
      "Ese horario ya está bloqueado. Revisá la lista o elegí otro.",
      "error",
    );
    return;
  }

  setFormBusy(blockForm, true);
  try {
    await rpc("admin_block", {
      p_data: {
        action: "create",
        starts_at: range.startsAt,
        ends_at: range.endsAt,
        reason,
      },
    });
    await reloadBlocks();
    blockReason.value = "";
    blockReason.focus();
    setInlineFeedback(
      $("block-feedback"),
      `Bloqueado: ${formatLongDate(date)}${
        time ? ` de ${time} a ${timePlus(time)}` : " · todo el día"
      }.`,
    );
    panelFeedback("");
  } catch (error) {
    if (authFailure(error)) {
      await leaveToLogin("La sesión venció. Ingresá nuevamente.");
      return;
    }
    setInlineFeedback(
      $("block-feedback"),
      error.message || "No pudimos crear el bloqueo.",
      "error",
    );
  } finally {
    setFormBusy(blockForm, false);
    syncBlockFields();
  }
}

function timePlus(time) {
  return minutesToTime(timeToMinutes(time) + PARTIAL_BLOCK_MINUTES);
}

async function releaseBlock(id) {
  const block = state.blocks.find((item) => item.id === id);
  if (!block || state.busy) return;
  const confirmed = window.confirm(
    `¿Liberar el horario del ${formatLongDate(block.date)}${
      block.fullDay
        ? " (todo el día)"
        : ` de ${block.time} a ${block.endTime}`
    }? Va a volver a estar disponible en el sitio público.`,
  );
  if (!confirmed) return;
  setFormBusy(blockForm, true);
  try {
    await rpc("admin_block", {
      p_data: { action: "delete", id },
    });
    await reloadBlocks();
    setInlineFeedback(
      $("block-feedback"),
      "Horario liberado. Volvió a estar disponible.",
    );
  } catch (error) {
    if (authFailure(error)) {
      await leaveToLogin("La sesión venció. Ingresá nuevamente.");
      return;
    }
    setInlineFeedback(
      $("block-feedback"),
      error.message || "No pudimos liberar el bloqueo.",
      "error",
    );
  } finally {
    setFormBusy(blockForm, false);
    syncBlockFields();
  }
}

function handleBlocksClick(event) {
  const button = event.target.closest("[data-action='release']");
  if (!button) return;
  releaseBlock(button.dataset.id);
}

function bindEvents() {
  $("login-form").addEventListener("submit", handleLogin);
  $("logout-button").addEventListener("click", handleLogout);
  $("refresh-panel").addEventListener("click", refreshPanel);
  $("prices-form").addEventListener("submit", savePrices);
  $("reset-prices").addEventListener("click", resetPrices);
  $("service-cards").addEventListener("input", (event) => {
    event.target.removeAttribute?.("aria-invalid");
  });
  blockScope.addEventListener("change", syncBlockFields);
  blockDate.addEventListener("change", () => {
    blockDate.removeAttribute("aria-invalid");
    populateBlockTimes();
  });
  blockTime.addEventListener("change", () => {
    blockTime.removeAttribute("aria-invalid");
  });
  blockReason.addEventListener("input", () => {
    blockReason.removeAttribute("aria-invalid");
  });
  blockForm.addEventListener("submit", addBlock);
  $("blocks-list").addEventListener("click", handleBlocksClick);
}

async function boot() {
  bindEvents();
  blockDate.min = todayISO();
  blockDate.value = todayISO();
  syncBlockFields();

  if (!isConfigured) {
    showLogin(configurationIssue, "error");
    $("admin-setup").open = true;
    setLoginBusy(false);
  } else if (!hasSession()) {
    showLogin("Ingresá con la cuenta autorizada del peluquero.");
  } else {
    await enterPanel();
  }
  document.body.dataset.ready = "true";
}

boot().catch((error) => {
  showLogin(
    error?.message || "No pudimos iniciar el panel. Recargá la página.",
    "error",
  );
  setLoginBusy(false);
  document.body.dataset.ready = "true";
});
