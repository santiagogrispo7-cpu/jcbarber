const LEGACY_KEY = "jcbarber.panel.bookings.v1";
const CATALOG_KEY = "jcbarber.panel.catalog.v1";
const FALLBACK_KEY = "jcbarber.panel.db.v1";
const DB_NAME = "jcbarber-panel";
const DB_VERSION = 1;
const TIME_ZONE = "America/Argentina/Buenos_Aires";
const MAX_AMOUNT = 10000000;

const DEFAULT_SERVICES = [
  {
    id: "corte-general",
    name: "Corte general",
    amount: 18000,
    durationMin: 30,
    mode: "local",
    place: "En el local",
    closedNote: "Cerrado los domingos",
  },
  {
    id: "corte-domicilio",
    name: "Corte a domicilio",
    amount: 20000,
    sundayAmount: 30000,
    durationMin: 45,
    mode: "home",
    place: "A domicilio",
    details: "Incluye barba y perfilado de cejas",
  },
  {
    id: "membresia-2",
    name: "Membresía 2 cortes",
    type: "membership",
    amount: 30000,
    mode: "home",
    place: "Solo domicilio",
    details: "Se abona del 1 al 5",
  },
  {
    id: "membresia-3",
    name: "Membresía 3 cortes",
    type: "membership",
    amount: 45000,
    mode: "home",
    place: "Solo domicilio",
    details: "Se abona del 1 al 5",
  },
  {
    id: "membresia-4",
    name: "Membresía 4 cortes",
    type: "membership",
    amount: 50000,
    mode: "home",
    place: "Solo domicilio",
    details: "Se abona del 1 al 5",
  },
];

const DEFAULT_EXTRAS = [
  { id: "barba", name: "Barba", amount: 10000, durationMin: 30 },
  {
    id: "perfilado-cejas",
    name: "Perfilado de cejas",
    amount: 8000,
    durationMin: 30,
  },
];

const SCHEDULES = {
  local: {
    step: 30,
    windows: [
      ["09:00", "12:30"],
      ["16:30", "20:30"],
    ],
  },
  home: {
    step: 45,
    windows: [
      ["07:00", "08:30"],
      ["12:45", "15:45"],
    ],
  },
};

const STATUSES = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled: "Cancelado",
};

const $ = (id) => document.getElementById(id);
const list = $("booking-list");
const form = $("booking-form");
const serviceSelect = $("client-service");
const dateInput = $("client-date");
const timeSelect = $("client-time");
const addressInput = $("client-address");
const nameInput = $("client-name");
const phoneInput = $("client-phone");
const notesInput = $("client-notes");
const statusSelect = $("client-status");
const feedback = $("form-feedback");
const filters = {
  date: $("filter-date"),
  status: $("filter-status"),
  query: $("filter-query"),
};
const cancelDialog = $("cancel-dialog");
const statsPeriod = $("stats-period");

let bookings = [];
let services = [];
let extras = [];
let database = null;
let storageMode = "indexeddb";
let markReady = () => {};
const dataReady = new Promise((resolve) => {
  markReady = resolve;
});

const clone = (value) => JSON.parse(JSON.stringify(value));

function pad(value) {
  return String(value).padStart(2, "0");
}

function todayISO() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateParts(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function dateAtUTCNoon(iso) {
  const { year, month, day } = dateParts(iso);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function weekdayIndex(iso) {
  return dateAtUTCNoon(iso).getUTCDay();
}

function addDaysISO(iso, days) {
  const date = dateAtUTCNoon(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
}

function formatLongDate(iso) {
  if (!iso) return "A coordinar";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(dateAtUTCNoon(iso));
}

function formatShortDate(iso) {
  if (!iso) return "A coordinar";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
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

function formatPrice(amount) {
  return `$${amount.toLocaleString("es-AR")}`;
}

function serviceById(id) {
  return services.find((service) => service.id === id) || services[0];
}

function isMembership(service) {
  return service?.type === "membership";
}

function isSunday(iso) {
  return Boolean(iso) && weekdayIndex(iso) === 0;
}

function serviceAmount(service, iso) {
  if (!service) return 0;
  if (service.sundayAmount && isSunday(iso)) return service.sundayAmount;
  return service.amount;
}

function serviceDuration(service) {
  return service?.durationMin ? `${service.durationMin} min` : "";
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function slotsFor(service, iso) {
  if (!service || isMembership(service) || !iso) return [];
  if (service.mode === "local" && isSunday(iso)) return [];
  const schedule = SCHEDULES[service.mode] || SCHEDULES.local;
  const slots = [];
  schedule.windows.forEach(([start, end]) => {
    const first = timeToMinutes(start);
    const last = timeToMinutes(end);
    for (
      let minute = first;
      minute + schedule.step <= last;
      minute += schedule.step
    ) {
      slots.push(minutesToTime(minute));
    }
  });
  return slots;
}

function normalizePhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("54")) digits = `549${digits}`;
  return digits;
}

function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function validBooking(item) {
  return Boolean(item && item.id && item.name);
}

function openPanelDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB no disponible"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("bookings")) {
        const store = db.createObjectStore("bookings", { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains("services")) {
        db.createObjectStore("services", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("No se pudo abrir la base de datos."));
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Error de base de datos."));
  });
}

function idbComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("No se pudo guardar."));
    transaction.onabort = () =>
      reject(transaction.error || new Error("Operación cancelada."));
  });
}

async function readStore(name) {
  const transaction = database.transaction(name, "readonly");
  const result = await idbRequest(transaction.objectStore(name).getAll());
  await idbComplete(transaction);
  return result;
}

async function readSetting(key) {
  const transaction = database.transaction("settings", "readonly");
  const result = await idbRequest(transaction.objectStore("settings").get(key));
  await idbComplete(transaction);
  return result;
}

async function writeSetting(key, value) {
  const transaction = database.transaction("settings", "readwrite");
  transaction.objectStore("settings").put({ key, value });
  await idbComplete(transaction);
}

async function replaceStore(name, values) {
  const transaction = database.transaction(name, "readwrite");
  const store = transaction.objectStore(name);
  store.clear();
  values.forEach((value) => store.put(value));
  await idbComplete(transaction);
}

function readFallback() {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readLegacyBookings() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(validBooking) : [];
  } catch {
    return [];
  }
}

function mirrorLegacy() {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(bookings));
  } catch {}
}

function mirrorCatalog() {
  try {
    localStorage.setItem(
      CATALOG_KEY,
      JSON.stringify({
        services,
        extras,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {}
}

function writeFallback() {
  try {
    localStorage.setItem(
      FALLBACK_KEY,
      JSON.stringify({ services, extras, bookings }),
    );
    storageMode = "local";
  } catch {
    storageMode = "memory";
  }
}

function normalizeService(service) {
  const fallback = DEFAULT_SERVICES.find((item) => item.id === service?.id);
  const merged = { ...clone(fallback || {}), ...service };
  merged.amount = Number(merged.amount ?? 0);
  if (merged.sundayAmount != null) {
    merged.sundayAmount = Number(merged.sundayAmount);
  }
  return merged;
}

function normalizeExtra(extra) {
  const fallback = DEFAULT_EXTRAS.find((item) => item.id === extra?.id);
  const merged = { ...clone(fallback || {}), ...extra };
  merged.amount = Number(merged.amount ?? 0);
  return merged;
}

function sortCatalog() {
  const order = new Map(
    DEFAULT_SERVICES.map((service, index) => [service.id, index]),
  );
  services.sort(
    (a, b) =>
      (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999) ||
      a.name.localeCompare(b.name),
  );
}

async function initDatabase() {
  const fallback = readFallback();
  try {
    database = await openPanelDatabase();
    let storedServices = await readStore("services");
    if (!storedServices.length) {
      storedServices = clone(DEFAULT_SERVICES);
      await replaceStore("services", storedServices);
    }
    services = storedServices.map(normalizeService);
    const missing = DEFAULT_SERVICES.filter(
      (item) => !services.some((service) => service.id === item.id),
    );
    if (missing.length) {
      services.push(...clone(missing));
      await replaceStore("services", services);
    }
    sortCatalog();

    const extrasRecord = await readSetting("extras");
    if (Array.isArray(extrasRecord?.value)) {
      extras = extrasRecord.value.map(normalizeExtra);
    } else {
      extras = clone(DEFAULT_EXTRAS);
      await writeSetting("extras", extras);
    }

    let storedBookings = await readStore("bookings");
    if (!storedBookings.length) {
      const source = readLegacyBookings();
      const imported = source.length
        ? source
        : Array.isArray(fallback?.bookings)
          ? fallback.bookings
          : [];
      if (imported.length) {
        await replaceStore("bookings", imported);
        storedBookings = imported;
      }
    }
    bookings = storedBookings.filter(validBooking);
    storageMode = "indexeddb";
  } catch {
    database = null;
    services = (
      Array.isArray(fallback?.services) && fallback.services.length
        ? fallback.services
        : clone(DEFAULT_SERVICES)
    ).map(normalizeService);
    extras = (
      Array.isArray(fallback?.extras) && fallback.extras.length
        ? fallback.extras
        : clone(DEFAULT_EXTRAS)
    ).map(normalizeExtra);
    sortCatalog();
    bookings = (
      Array.isArray(fallback?.bookings)
        ? fallback.bookings
        : readLegacyBookings()
    ).filter(validBooking);
    storageMode = "local";
    try {
      localStorage.setItem(
        FALLBACK_KEY,
        JSON.stringify({ services, extras, bookings }),
      );
    } catch {
      storageMode = "memory";
    }
  }
}

async function persistBookings() {
  mirrorLegacy();
  if (database) {
    try {
      await replaceStore("bookings", bookings);
      return;
    } catch {
      database = null;
      storageMode = "local";
    }
  }
  writeFallback();
}

async function persistCatalog() {
  mirrorCatalog();
  if (database) {
    try {
      await replaceStore("services", services);
      await writeSetting("extras", extras);
      return;
    } catch {
      database = null;
      storageMode = "local";
    }
  }
  writeFallback();
}

function storageLabel() {
  if (storageMode === "indexeddb") return "IndexedDB";
  if (storageMode === "local") return "Respaldo local";
  return "Sólo memoria";
}

function updateStorageNote() {
  const note = $("storage-note");
  const text = note.querySelector("span");
  note.classList.toggle("is-warning", storageMode !== "indexeddb");
  if (storageMode === "indexeddb") {
    text.textContent =
      "Base de datos local (IndexedDB) activa: turnos, precios y estadísticas se guardan en este navegador.";
  } else if (storageMode === "local") {
    text.textContent =
      "IndexedDB no está disponible. Se usa el respaldo del navegador: los datos siguen guardados, con menos capacidad.";
  } else {
    text.textContent =
      "Este navegador no permite guardar datos. La agenda y los precios quedan sólo en memoria hasta cerrar la página.";
  }
}

function activeBooking(booking) {
  return booking.status === "pending" || booking.status === "confirmed";
}

function sortBookings(items) {
  return [...items].sort((a, b) => {
    if (!a.date && !b.date) return a.createdAt.localeCompare(b.createdAt);
    if (!a.date) return 1;
    if (!b.date) return -1;
    return `${a.date} ${a.time || ""}`.localeCompare(
      `${b.date} ${b.time || ""}`,
    );
  });
}

function filteredBookings() {
  const query = filters.query.value.trim().toLowerCase();
  return sortBookings(
    bookings.filter((booking) => {
      if (filters.date.value && booking.date !== filters.date.value)
        return false;
      if (
        filters.status.value !== "all" &&
        booking.status !== filters.status.value
      ) {
        return false;
      }
      if (!query) return true;
      return [booking.name, booking.address, booking.phone, booking.serviceName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    }),
  );
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

function metaRow(label, value, href) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  term.textContent = label;
  const detail = document.createElement("dd");
  if (href) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = value;
    detail.append(link);
  } else {
    detail.textContent = value;
  }
  row.append(term, detail);
  return row;
}

function actionButton(label, action, iconName, variant = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `admin-button admin-button-small${
    variant ? ` ${variant}` : ""
  }`;
  button.dataset.action = action;
  button.append(icon(iconName), document.createTextNode(label));
  return button;
}

function renderBooking(booking) {
  const template = $("booking-template");
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.id = booking.id;
  node.classList.add(`is-${booking.status}`);

  if (booking.date) {
    node.querySelector(".booking-weekday").textContent = formatWeekday(
      booking.date,
    );
    node.querySelector(".booking-day").textContent = dateParts(
      booking.date,
    ).day;
    node.querySelector(".booking-month").textContent = formatMonth(
      booking.date,
    );
    node
      .querySelector(".booking-date")
      .setAttribute("aria-label", formatLongDate(booking.date));
  } else {
    node.querySelector(".booking-weekday").textContent = "A";
    node.querySelector(".booking-day").textContent = "•";
    node.querySelector(".booking-month").textContent = "coordinar";
    node
      .querySelector(".booking-date")
      .setAttribute("aria-label", "Fecha a coordinar por WhatsApp");
  }

  const status = node.querySelector(".booking-status");
  status.textContent = STATUSES[booking.status] || STATUSES.pending;
  status.classList.add(`status-${booking.status}`);

  node.querySelector(".booking-name").textContent = booking.name;
  node.querySelector(".booking-service").textContent =
    `${booking.serviceName} · ${booking.place}`;

  const meta = node.querySelector(".booking-meta");
  meta.append(
    metaRow("Horario", booking.time || "A coordinar"),
    metaRow("Precio", formatPrice(booking.amount)),
  );
  if (booking.phone) {
    const wa = normalizePhone(booking.phone);
    meta.append(
      metaRow(
        "WhatsApp",
        booking.phone,
        wa
          ? `https://wa.me/${wa}?text=${encodeURIComponent(
              `Hola ${booking.name}, te escribo de JC Barberhouse por tu turno.`,
            )}`
          : "",
      ),
    );
  }
  if (booking.address) meta.append(metaRow("Dirección", booking.address));
  if (booking.status === "cancelled" && booking.cancellationReason) {
    meta.append(metaRow("Motivo de cancelación", booking.cancellationReason));
  }

  if (booking.notes) {
    const notes = node.querySelector(".booking-notes");
    notes.hidden = false;
    notes.textContent = booking.notes;
  }

  const actions = node.querySelector(".booking-actions");
  if (booking.status === "pending") {
    actions.append(
      actionButton("Confirmar", "confirm", "a-check", "admin-button-primary"),
      actionButton("Cancelar", "cancel", "a-x"),
    );
  } else if (booking.status === "confirmed") {
    actions.append(
      actionButton("Completar", "complete", "a-check", "admin-button-primary"),
      actionButton("Cancelar", "cancel", "a-x"),
    );
  } else {
    actions.append(actionButton("Reabrir", "reopen", "a-arrow"));
  }
  if (booking.phone) {
    actions.append(
      actionButton(
        "WhatsApp",
        "whatsapp",
        "a-whatsapp",
        "admin-button-whatsapp",
      ),
    );
  }
  actions.append(
    actionButton("Eliminar", "delete", "a-trash", "admin-button-danger"),
  );

  return node;
}

function renderSummary(count) {
  const parts = [`${count} ${count === 1 ? "reserva" : "reservas"}`];
  if (filters.date.value) parts.push(formatLongDate(filters.date.value));
  if (filters.status.value !== "all") {
    parts.push(STATUSES[filters.status.value]);
  }
  const query = filters.query.value.trim();
  if (query) parts.push(`búsqueda: “${query}”`);
  $("agenda-summary").textContent = parts.join(" · ");
}

function renderAgenda() {
  const items = filteredBookings();
  list.replaceChildren(...items.map(renderBooking));
  renderSummary(items.length);

  const empty = $("agenda-empty");
  const hasFilters = Boolean(
    filters.date.value ||
      filters.query.value.trim() ||
      filters.status.value !== "all",
  );
  empty.hidden = items.length > 0;
  $("agenda-empty-text").textContent = hasFilters
    ? "Probá con otra fecha, otro estado o limpiá los filtros."
    : "Cuando cargues un turno va a aparecer acá, ordenado por fecha y horario.";
}

function renderKpis() {
  const today = todayISO();
  const weekEnd = addDaysISO(today, 6);
  const active = bookings.filter(activeBooking);
  const todayCount = active.filter((booking) => booking.date === today).length;
  const weekCount = active.filter(
    (booking) =>
      booking.date && booking.date >= today && booking.date <= weekEnd,
  ).length;
  const pendingCount = bookings.filter(
    (booking) => booking.status === "pending",
  ).length;
  const monthStats = computeStats("month");

  $("kpi-today").textContent = todayCount;
  $("kpi-week").textContent = weekCount;
  $("kpi-pending").textContent = pendingCount;
  $("kpi-revenue").textContent = formatPrice(monthStats.collected);
  $("kpi-completed").textContent = bookings.filter(
    (booking) => booking.status === "completed",
  ).length;

  const next = sortBookings(
    active.filter((booking) => booking.date && booking.date >= today),
  )[0];
  if (next) {
    $("kpi-next").textContent = next.name;
    $("kpi-next-detail").textContent = `${formatLongDate(next.date)}${
      next.time ? ` · ${next.time}` : ""
    } · ${next.serviceName}`;
  } else {
    $("kpi-next").textContent = "Sin turnos";
    $("kpi-next-detail").textContent = "Cargá una reserva para empezar.";
  }
}

function bookingCivilDate(booking) {
  if (booking.date) return booking.date;
  const created = new Date(booking.createdAt || "");
  if (Number.isNaN(created.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(created);
}

function monthEnd(iso) {
  const date = dateAtUTCNoon(iso);
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  );
  return `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(
    end.getUTCDate(),
  )}`;
}

function statsBounds(period) {
  const today = todayISO();
  if (period === "month") {
    return { from: `${today.slice(0, 7)}-01`, to: monthEnd(today) };
  }
  if (period === "30d") {
    return { from: addDaysISO(today, -29), to: today };
  }
  if (period === "year") {
    return {
      from: `${today.slice(0, 4)}-01-01`,
      to: `${today.slice(0, 4)}-12-31`,
    };
  }
  return { from: "", to: "" };
}

function sumAmounts(items) {
  return items.reduce(
    (total, booking) => total + Number(booking.amount || 0),
    0,
  );
}

function computeStats(period) {
  const bounds = statsBounds(period);
  const items = bookings.filter((booking) => {
    const date = bookingCivilDate(booking);
    if (!date) return !bounds.from && !bounds.to;
    return (
      (!bounds.from || date >= bounds.from) && (!bounds.to || date <= bounds.to)
    );
  });
  const active = items.filter(activeBooking);
  const completed = items.filter((booking) => booking.status === "completed");
  const cancelled = items.filter((booking) => booking.status === "cancelled");
  const collected = sumAmounts(completed);
  const projected = sumAmounts(active);
  const lost = sumAmounts(cancelled);

  const byService = new Map();
  items.forEach((booking) => {
    const label = booking.serviceName || "Sin servicio";
    if (!byService.has(label)) {
      byService.set(label, { label, count: 0, collected: 0, projected: 0 });
    }
    const entry = byService.get(label);
    entry.count += 1;
    if (booking.status === "completed")
      entry.collected += Number(booking.amount || 0);
    if (activeBooking(booking)) entry.projected += Number(booking.amount || 0);
  });

  const byMode = new Map();
  items.forEach((booking) => {
    const label = booking.mode === "home" ? "Domicilio" : "Local";
    if (!byMode.has(label)) {
      byMode.set(label, { label, count: 0, collected: 0, projected: 0 });
    }
    const entry = byMode.get(label);
    entry.count += 1;
    if (booking.status === "completed")
      entry.collected += Number(booking.amount || 0);
    if (activeBooking(booking)) entry.projected += Number(booking.amount || 0);
  });

  const now = dateAtUTCNoon(todayISO());
  const months = [];
  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1),
    );
    const key = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
    const label = new Intl.DateTimeFormat("es-AR", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
      .format(date)
      .replace(".", "");
    const collectedMonth = completed
      .filter((booking) => bookingCivilDate(booking).slice(0, 7) === key)
      .reduce((total, booking) => total + Number(booking.amount || 0), 0);
    months.push({ key, label, collected: collectedMonth });
  }

  return {
    items,
    total: items.length,
    active: active.length,
    completed: completed.length,
    cancelled: cancelled.length,
    collected,
    projected,
    lost,
    average: completed.length ? Math.round(collected / completed.length) : 0,
    byService: [...byService.values()].sort(
      (a, b) => b.count - a.count || b.collected - a.collected,
    ),
    byMode: [...byMode.values()].sort(
      (a, b) => b.count - a.count || b.collected - a.collected,
    ),
    months,
  };
}

function renderBreakdown(container, entries) {
  if (!entries.length) {
    container.replaceChildren(
      el("p", "Sin turnos en el período.", "admin-breakdown-empty"),
    );
    return;
  }
  const max = Math.max(...entries.map((entry) => entry.count), 1);
  container.replaceChildren(
    ...entries.map((entry) => {
      const row = el("div", null, "admin-breakdown-row");
      const head = el("div", null, "admin-breakdown-head");
      head.append(
        el("span", entry.label, "admin-breakdown-label"),
        el("span", formatPrice(entry.collected), "admin-breakdown-value"),
      );
      const track = el("div", null, "admin-breakdown-track");
      const bar = el("span");
      bar.style.width = `${Math.max(6, (entry.count / max) * 100)}%`;
      track.append(bar);
      const hint = el(
        "p",
        `${entry.count} ${entry.count === 1 ? "turno" : "turnos"}${
          entry.projected ? ` · ${formatPrice(entry.projected)} por cobrar` : ""
        }`,
        "admin-breakdown-hint",
      );
      row.append(head, track, hint);
      return row;
    }),
  );
}

function renderMonths(months) {
  const container = $("stats-months");
  const max = Math.max(...months.map((month) => month.collected), 1);
  container.replaceChildren(
    ...months.map((month) => {
      const row = el("div", null, "admin-month-row");
      const track = el("div", null, "admin-month-track");
      track.setAttribute("role", "img");
      track.setAttribute(
        "aria-label",
        `${month.label}: ${formatPrice(month.collected)} cobrados`,
      );
      const bar = el("span");
      bar.style.width = `${
        month.collected ? Math.max(4, (month.collected / max) * 100) : 0
      }%`;
      track.append(bar);
      row.append(
        el("span", month.label, "admin-month-label"),
        track,
        el("span", formatPrice(month.collected), "admin-month-value"),
      );
      return row;
    }),
  );
}

function renderStats() {
  const stats = computeStats(statsPeriod.value);
  $("stats-total").textContent = stats.total;
  $("stats-total-hint").textContent = "turnos en el período";
  $("stats-collected").textContent = formatPrice(stats.collected);
  $("stats-completed").textContent = `${stats.completed} completados`;
  $("stats-projected").textContent = formatPrice(stats.projected);
  $("stats-active").textContent = `${stats.active} activos`;
  $("stats-lost").textContent = formatPrice(stats.lost);
  $("stats-cancelled").textContent = `${stats.cancelled} cancelados`;
  $("stats-average").textContent = formatPrice(stats.average);
  $("stats-storage").textContent = storageLabel();
  const stamps = [
    ...bookings.map((booking) => booking.createdAt),
    ...services.map((service) => service.updatedAt),
  ].filter(Boolean);
  $("stats-updated").textContent = stamps.length
    ? `Último cambio: ${new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: TIME_ZONE,
      }).format(
        new Date(Math.max(...stamps.map((stamp) => Date.parse(stamp)))),
      )}`
    : "Sin cambios";

  renderBreakdown($("stats-services"), stats.byService);
  renderBreakdown($("stats-modes"), stats.byMode);
  renderMonths(stats.months);
}

function renderAll() {
  renderAgenda();
  renderKpis();
  renderStats();
}

function populateServices() {
  const previous = serviceSelect.value;
  const regular = document.createElement("optgroup");
  regular.label = "Servicios";
  const memberships = document.createElement("optgroup");
  memberships.label = "Membresías";

  services.forEach((service) => {
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = `${service.name} · ${formatPrice(service.amount)}`;
    (isMembership(service) ? memberships : regular).append(option);
  });

  serviceSelect.replaceChildren(regular, memberships);
  if (services.some((service) => service.id === previous)) {
    serviceSelect.value = previous;
  }
}

function priceField(label, owner, field, value, ownerName) {
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
  input.dataset.priceField = field;
  input.setAttribute("aria-label", `${label} de ${ownerName || owner}`);
  wrapper.append(text, input);
  return wrapper;
}

function renderServiceCards() {
  const container = $("service-cards");
  const cards = services.map((service) => {
    const card = document.createElement("article");
    card.className = `admin-service-card admin-price-card${
      isMembership(service) ? " is-membership" : ""
    }`;

    const head = document.createElement("div");
    head.className = "admin-service-card-head";
    const title = document.createElement("h3");
    title.textContent = service.name;
    const tag = document.createElement("span");
    tag.className = "admin-price-tag";
    tag.append(icon("a-edit"), document.createTextNode("Editable"));
    head.append(title, tag);
    card.append(head);

    const fields = document.createElement("div");
    fields.className = "admin-price-fields";
    fields.append(
      priceField(
        "Precio (ARS)",
        service.id,
        "service.amount",
        service.amount,
        service.name,
      ),
    );
    if (service.sundayAmount != null) {
      fields.append(
        priceField(
          "Domingo (ARS)",
          service.id,
          "service.sundayAmount",
          service.sundayAmount,
          service.name,
        ),
      );
    }
    card.append(fields);

    const meta = document.createElement("p");
    meta.className = "admin-service-meta";
    meta.textContent = [serviceDuration(service), service.place]
      .filter(Boolean)
      .join(" · ");
    card.append(meta);

    if (service.details) {
      const detail = document.createElement("p");
      detail.className = "admin-service-detail";
      detail.textContent = service.details;
      card.append(detail);
    }
    if (service.closedNote) {
      const note = document.createElement("p");
      note.className = "admin-service-detail";
      note.textContent = service.closedNote;
      card.append(note);
    }
    return card;
  });

  const extraCard = document.createElement("article");
  extraCard.className = "admin-service-card is-extra admin-price-card";
  const extraTitle = document.createElement("h3");
  extraTitle.textContent = "Extras del corte general";
  const extraFields = document.createElement("div");
  extraFields.className = "admin-price-fields";
  extras.forEach((extra) => {
    extraFields.append(
      priceField(
        `${extra.name} (ARS)`,
        extra.id,
        "extra.amount",
        extra.amount,
        extra.name,
      ),
    );
  });
  const extraDetail = document.createElement("p");
  extraDetail.className = "admin-service-detail";
  extraDetail.textContent = "Se suman al corte general y a su duración.";
  extraCard.append(extraTitle, extraFields, extraDetail);
  cards.push(extraCard);

  container.replaceChildren(...cards);
}

function priceFeedback(message, type = "ok") {
  const target = $("prices-feedback");
  target.textContent = message;
  target.classList.toggle("is-error", type === "error");
  target.classList.toggle("is-ok", type === "ok");
}

function readPrice(input) {
  if (input.value.trim() === "") return null;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) return null;
  return Math.round(value);
}

async function savePrices(event) {
  event.preventDefault();
  await dataReady;
  priceFeedback("");
  const inputs = [...$("service-cards").querySelectorAll("[data-price-field]")];
  const invalid = inputs.find((input) => readPrice(input) === null);
  if (invalid) {
    invalid.setAttribute("aria-invalid", "true");
    priceFeedback(
      "Revisá los importes: deben ser números entre 0 y 10.000.000.",
      "error",
    );
    invalid.focus();
    return;
  }

  const now = new Date().toISOString();
  inputs.forEach((input) => {
    const value = readPrice(input);
    const [kind, field] = input.dataset.priceField.split(".");
    const owner = input.dataset.priceOwner;
    const collection = kind === "extra" ? extras : services;
    const item = collection.find((entry) => entry.id === owner);
    if (item) {
      item[field] = value;
      item.updatedAt = now;
    }
  });

  await persistCatalog();
  renderServiceCards();
  populateServices();
  renderAll();
  syncServiceFields();
  updateStorageNote();
  priceFeedback(
    "Precios guardados. El sitio público de este navegador ya muestra estos importes.",
  );
}

async function resetPrices() {
  await dataReady;
  const confirmed = window.confirm(
    "¿Restaurar los precios sugeridos? Las reservas ya cargadas conservan su importe.",
  );
  if (!confirmed) return;
  services = clone(DEFAULT_SERVICES);
  extras = clone(DEFAULT_EXTRAS);
  await persistCatalog();
  renderServiceCards();
  populateServices();
  renderAll();
  syncServiceFields();
  priceFeedback("Precios restaurados a los valores sugeridos.");
}

function selectedService() {
  return serviceById(serviceSelect.value);
}

function populateTimes(preserve = true) {
  const service = selectedService();
  const previous = preserve ? timeSelect.value : "";
  const slots = slotsFor(service, dateInput.value);
  timeSelect.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = slots.length
    ? "Elegí un horario"
    : isMembership(service)
      ? "Se coordina por WhatsApp"
      : "Sin horarios para ese día";
  timeSelect.append(placeholder);

  slots.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot;
    option.textContent = slot;
    timeSelect.append(option);
  });

  if (slots.includes(previous)) timeSelect.value = previous;

  const hint = $("time-hint");
  if (isMembership(service)) {
    hint.textContent =
      "La membresía se agenda por WhatsApp: no lleva fecha ni horario.";
  } else if (service.mode === "local" && isSunday(dateInput.value)) {
    hint.textContent = "Los domingos el local está cerrado.";
  } else {
    hint.textContent = `Turnos de ${service.durationMin} minutos.`;
  }
}

function syncServiceFields() {
  const service = selectedService();
  const membership = isMembership(service);
  const home = service.mode === "home";

  $("date-field").hidden = membership;
  $("time-field").hidden = membership;
  dateInput.disabled = membership;
  timeSelect.disabled = membership;
  $("address-field").hidden = !home;
  addressInput.required = home;
  if (!home) addressInput.value = "";

  if (membership) {
    dateInput.value = "";
    timeSelect.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Se coordina por WhatsApp";
    timeSelect.append(placeholder);
  } else if (!dateInput.value) {
    dateInput.value = todayISO();
  }

  populateTimes(false);
}

function clearInvalid() {
  [nameInput, addressInput, dateInput, timeSelect].forEach((field) => {
    field.removeAttribute("aria-invalid");
  });
}

function showFeedback(message, type = "ok") {
  feedback.textContent = message;
  feedback.classList.toggle("is-error", type === "error");
  feedback.classList.toggle("is-ok", type === "ok");
}

function invalidate(field, message) {
  field.setAttribute("aria-invalid", "true");
  showFeedback(message, "error");
  field.focus();
}

async function addBooking(event) {
  event.preventDefault();
  await dataReady;
  clearInvalid();
  showFeedback("");

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const notes = notesInput.value.trim();
  const service = selectedService();
  const membership = isMembership(service);
  const home = service.mode === "home";
  const date = membership ? "" : dateInput.value;
  const time = membership ? "" : timeSelect.value;
  const address = home ? addressInput.value.trim() : "";

  if (name.length < 2 || name.length > 80) {
    invalidate(
      nameInput,
      "Escribí el nombre y apellido (mínimo 2 caracteres).",
    );
    return;
  }
  if (phone && phone.replace(/\D/g, "").length < 6) {
    invalidate(phoneInput, "Revisá el número de WhatsApp o dejalo vacío.");
    return;
  }
  if (home && (address.length < 5 || address.length > 180)) {
    invalidate(
      addressInput,
      "Escribí la dirección del domicilio (mínimo 5 caracteres).",
    );
    return;
  }
  if (!membership) {
    if (!date) {
      invalidate(dateInput, "Elegí la fecha del turno.");
      return;
    }
    if (service.mode === "local" && isSunday(date)) {
      invalidate(
        dateInput,
        "Los domingos el local está cerrado. Elegí otro día.",
      );
      return;
    }
    if (!time || !slotsFor(service, date).includes(time)) {
      invalidate(timeSelect, "Elegí uno de los horarios disponibles.");
      return;
    }
    if (isOccupied(date, time)) {
      invalidate(timeSelect, "Ya hay una reserva en ese día y horario.");
      return;
    }
  }

  bookings.push({
    id: uid(),
    createdAt: new Date().toISOString(),
    name,
    phone,
    address,
    notes,
    serviceId: service.id,
    serviceName: service.name,
    place: service.place,
    mode: service.mode,
    date,
    time,
    amount: serviceAmount(service, date),
    status: statusSelect.value === "confirmed" ? "confirmed" : "pending",
  });

  await persistBookings();
  renderAll();
  updateStorageNote();
  form.reset();
  dateInput.value = todayISO();
  serviceSelect.value = "corte-general";
  syncServiceFields();
  showFeedback(
    `${name} quedó ${membership ? "registrado" : "agendado"}${
      date
        ? ` para el ${formatShortDate(date)}${time ? ` a las ${time}` : ""}`
        : ""
    }.`,
  );
  $("agenda").scrollIntoView({ behavior: "smooth", block: "start" });
}

function isOccupied(date, time) {
  return bookings.some(
    (booking) =>
      booking.date === date &&
      booking.time === time &&
      booking.status !== "cancelled",
  );
}

function cancelSummary(booking) {
  const when = booking.date
    ? `${formatLongDate(booking.date)}${booking.time ? ` · ${booking.time}` : ""}`
    : "A coordinar";
  return `${booking.name} · ${booking.serviceName} · ${when}`;
}

async function applyCancel(id, reason) {
  const booking = bookings.find((item) => item.id === id);
  if (!booking) return;
  booking.status = "cancelled";
  booking.cancelledAt = new Date().toISOString();
  booking.cancellationReason = String(reason || "")
    .trim()
    .slice(0, 200);
  renderAll();
  showFeedback(
    `Turno de ${booking.name} cancelado. El horario volvió a quedar libre.`,
  );
  await persistBookings();
  updateStorageNote();
}

function requestCancel(booking) {
  if (typeof cancelDialog.showModal !== "function") {
    const reason = window.prompt(
      `¿Cancelar el turno de ${booking.name}? Podés escribir un motivo (opcional).`,
      "",
    );
    if (reason !== null) applyCancel(booking.id, reason);
    return;
  }
  cancelDialog.dataset.id = booking.id;
  $("cancel-summary").textContent = cancelSummary(booking);
  $("cancel-reason").value = "";
  cancelDialog.showModal();
  $("cancel-reason").focus();
}

async function updateStatus(id, action) {
  await dataReady;
  const booking = bookings.find((item) => item.id === id);
  if (!booking) return;

  if (action === "delete") {
    const confirmed = window.confirm(
      `¿Eliminar la reserva de ${booking.name}? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;
    bookings = bookings.filter((item) => item.id !== id);
    renderAll();
    showFeedback("Reserva eliminada.");
    await persistBookings();
    updateStorageNote();
    return;
  }

  if (action === "cancel") {
    requestCancel(booking);
    return;
  }

  if (action === "confirm") booking.status = "confirmed";
  if (action === "complete") {
    booking.status = "completed";
    booking.completedAt = new Date().toISOString();
  }
  if (action === "reopen") {
    booking.status = "pending";
    delete booking.cancelledAt;
    delete booking.cancellationReason;
    delete booking.completedAt;
  }

  renderAll();
  await persistBookings();
  updateStorageNote();
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv() {
  const items = filteredBookings();
  if (!items.length) {
    showFeedback(
      "No hay reservas para exportar con los filtros actuales.",
      "error",
    );
    return;
  }
  const rows = [
    [
      "Fecha",
      "Hora",
      "Cliente",
      "WhatsApp",
      "Servicio",
      "Modalidad",
      "Dirección",
      "Precio",
      "Estado",
      "Motivo de cancelación",
      "Notas",
    ],
    ...items.map((booking) => [
      booking.date ? formatShortDate(booking.date) : "A coordinar",
      booking.time || "",
      booking.name,
      booking.phone,
      booking.serviceName,
      booking.place,
      booking.address,
      booking.amount,
      STATUSES[booking.status],
      booking.cancellationReason || "",
      booking.notes,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `agenda-jc-barber-${todayISO()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showFeedback(`Se exportaron ${items.length} reservas.`);
}

function clearFilters() {
  filters.date.value = "";
  filters.status.value = "all";
  filters.query.value = "";
  renderAgenda();
}

function handleListClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const card = button.closest("[data-id]");
  if (!card) return;

  if (button.dataset.action === "whatsapp") {
    const booking = bookings.find((item) => item.id === card.dataset.id);
    const phone = normalizePhone(booking?.phone);
    if (phone) {
      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(
          `Hola ${booking.name}, te escribo de JC Barberhouse por tu turno.`,
        )}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
    return;
  }

  updateStatus(card.dataset.id, button.dataset.action);
}

function handleReset() {
  window.setTimeout(() => {
    dateInput.value = todayISO();
    serviceSelect.value = "corte-general";
    syncServiceFields();
    clearInvalid();
    showFeedback("");
    nameInput.focus({ preventScroll: true });
  }, 0);
}

function bindEvents() {
  serviceSelect.addEventListener("change", syncServiceFields);
  dateInput.addEventListener("change", () => {
    populateTimes(false);
    clearInvalid();
  });
  [nameInput, phoneInput, addressInput, notesInput, dateInput].forEach(
    (field) => {
      field.addEventListener("input", () =>
        field.removeAttribute("aria-invalid"),
      );
    },
  );
  timeSelect.addEventListener("change", () =>
    timeSelect.removeAttribute("aria-invalid"),
  );
  form.addEventListener("submit", addBooking);
  form.addEventListener("reset", handleReset);
  list.addEventListener("click", handleListClick);
  [filters.date, filters.status].forEach((field) => {
    field.addEventListener("change", renderAgenda);
  });
  filters.query.addEventListener("input", renderAgenda);
  $("clear-filters").addEventListener("click", clearFilters);
  $("export-csv").addEventListener("click", exportCsv);
  $("prices-form").addEventListener("submit", savePrices);
  $("reset-prices").addEventListener("click", resetPrices);
  $("service-cards").addEventListener("input", (event) => {
    event.target.removeAttribute?.("aria-invalid");
  });
  statsPeriod.addEventListener("change", renderStats);

  cancelDialog.addEventListener("close", () => {
    if (cancelDialog.returnValue !== "confirm") return;
    applyCancel(cancelDialog.dataset.id, $("cancel-reason").value);
  });
}

async function init() {
  bindEvents();
  await initDatabase();
  mirrorCatalog();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  updateStorageNote();

  populateServices();
  renderServiceCards();
  serviceSelect.value = services[0]?.id || "corte-general";
  dateInput.value = todayISO();
  syncServiceFields();
  renderAll();
  document.body.dataset.ready = "true";
  markReady();
}

init().catch(() => {
  updateStorageNote();
  showFeedback(
    "No se pudo iniciar la base de datos local. Recargá la página.",
    "error",
  );
  markReady();
});
