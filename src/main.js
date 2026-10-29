/* JC BARBER — lógica de la página y reserva en 3 pasos (archivo único). */
import {
  fetchAvailability,
  fetchBlockedRanges,
  fetchSiteCatalog,
  isConfigured,
} from "./site-api.js";

const config = {
  whatsappDisplay: "+54 9 3329 60-6138",
  whatsappNumber: "5493329606138",
  instagramUrl: "https://www.instagram.com/jc_barberhouse/",
  tiktokUrl: "https://www.tiktok.com/@jcbarberhouse?_r=1&_t=ZS-9AfYPGAygh0",
  addressText: "AVENIDA SAN MARTIN 743",
  addressCity: "Baradero",
  timeZone: "America/Argentina/Buenos_Aires",
  locale: "es-AR",
  horizonDays: 90,
};

const SERVICES = [
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
  // Membresías: sólo domicilio, se abonan del 1 al 5 y los turnos del mes se
  // coordinan por WhatsApp (sin fecha fija en el formulario).
  {
    id: "membresia-2",
    type: "membership",
    name: "Membresía 2 cortes",
    amount: 30000,
    mode: "home",
    place: "Solo domicilio",
    details: "Al mes, se abona del 1 al 5",
  },
  {
    id: "membresia-3",
    type: "membership",
    name: "Membresía 3 cortes",
    amount: 45000,
    mode: "home",
    place: "Solo domicilio",
    details: "Al mes, se abona del 1 al 5",
  },
  {
    id: "membresia-4",
    type: "membership",
    name: "Membresía 4 cortes",
    amount: 50000,
    mode: "home",
    place: "Solo domicilio",
    details: "Al mes, se abona del 1 al 5",
  },
];

// Extras del corte general: se ofrecen como complemento, no como servicios
// independientes. Precios y duraciones según D18.
const EXTRAS = [
  { id: "barba", name: "Barba", amount: 10000, durationMin: 30 },
  {
    id: "perfilado-cejas",
    name: "Perfilado de cejas",
    amount: 8000,
    durationMin: 30,
  },
];

const CATALOG_KEY = "jcbarber.panel.catalog.v1";
const BLOCKS_KEY = "jcbarber.panel.blocks.v1";
let panelBlocks = [];

const remote = {
  configured: isConfigured,
  ready: false,
  enabled: false,
  services: new Map(),
  slots: new Map(),
  errors: new Map(),
  loading: new Set(),
  generation: 0,
};

const isValidAmount = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

// Respaldo local: sólo se usa si Supabase no está disponible. Cuando el
// catálogo remoto carga, sus precios son la única fuente de verdad.
function applyCatalogPrices() {
  if (remote.ready) return;
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return;
    const catalog = JSON.parse(raw);
    const servicesById = new Map(
      (Array.isArray(catalog.services) ? catalog.services : []).map(
        (service) => [service.id, service],
      ),
    );
    const extrasById = new Map(
      (Array.isArray(catalog.extras) ? catalog.extras : []).map((extra) => [
        extra.id,
        extra,
      ]),
    );

    SERVICES.forEach((service) => {
      const stored = servicesById.get(service.id);
      if (!stored) return;
      if (isValidAmount(stored.amount)) service.amount = stored.amount;
      if (service.sundayAmount != null && isValidAmount(stored.sundayAmount)) {
        service.sundayAmount = stored.sundayAmount;
      }
    });
    EXTRAS.forEach((extra) => {
      const stored = extrasById.get(extra.id);
      if (stored && isValidAmount(stored.amount)) extra.amount = stored.amount;
    });
  } catch {
    // localStorage bloqueado o catálogo corrupto: se usan los valores base.
  }
}

applyCatalogPrices();

// Bloqueos cargados desde el panel: el peluquero puede cerrar un día completo
// o un horario puntual. Se leen antes de dibujar calendario y horarios.
function applyPanelBlocks() {
  try {
    const raw = localStorage.getItem(BLOCKS_KEY);
    if (!raw) {
      panelBlocks = [];
      return;
    }
    const parsed = JSON.parse(raw);
    panelBlocks = (Array.isArray(parsed?.blocks) ? parsed.blocks : []).filter(
      (block) =>
        block &&
        /^\d{4}-\d{2}-\d{2}$/.test(block.date || "") &&
        ["all", "local", "home"].includes(block.mode) &&
        (block.time === "" || /^\d{2}:\d{2}$/.test(block.time || "")),
    );
  } catch {
    panelBlocks = [];
  }
}

applyPanelBlocks();

const normalizeName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es-AR");

function addDaysISO(iso, amount) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount, 12))
    .toISOString()
    .slice(0, 10);
}

function instantDate(instant) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

function instantTime(instant) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}

function minutesOf(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function applyRemoteCatalog(catalog) {
  if (!catalog || typeof catalog !== "object") return;
  remote.ready = true;
  remote.enabled = Boolean(catalog.enabled);
  const horizon = Number(catalog.horizon_days);
  if (Number.isFinite(horizon) && horizon > 0) config.horizonDays = horizon;

  const services = Array.isArray(catalog.services)
    ? catalog.services
    : [];
  const byName = new Map(
    services.map((service) => [normalizeName(service.name), service]),
  );
  remote.services.clear();

  SERVICES.forEach((service) => {
    const stored = byName.get(normalizeName(service.name));
    if (!stored) return;
    remote.services.set(service.id, stored.id);
    if (isValidAmount(Number(stored.price))) {
      service.amount = Number(stored.price);
    }
    if (stored.duration_minutes) {
      service.durationMin = Number(stored.duration_minutes);
    }
  });
  EXTRAS.forEach((extra) => {
    const stored = byName.get(normalizeName(extra.name));
    if (!stored) return;
    remote.services.set(extra.id, stored.id);
    if (isValidAmount(Number(stored.price))) {
      extra.amount = Number(stored.price);
    }
    if (stored.duration_minutes) {
      extra.durationMin = Number(stored.duration_minutes);
    }
  });

  const memberships = Array.isArray(catalog.memberships)
    ? catalog.memberships
    : [];
  const membershipById = new Map(
    memberships.map((membership) => [membership.id, membership]),
  );
  SERVICES.filter((service) => service.type === "membership").forEach(
    (service) => {
      const stored = membershipById.get(service.id);
      if (!stored) return;
      if (isValidAmount(Number(stored.amount))) {
        service.amount = Number(stored.amount);
      }
      if (stored.name) service.name = String(stored.name);
    },
  );

  remote.slots.clear();
  remote.errors.clear();
  remote.loading.clear();
  refreshCatalogUI();
}

function applyRemoteBlocks(ranges) {
  if (!Array.isArray(ranges)) return;
  const entries = [];
  ranges.forEach((range) => {
    if (!range?.starts_at || !range?.ends_at) return;
    const startDate = instantDate(range.starts_at);
    const endDate = instantDate(range.ends_at);
    const startTime = instantTime(range.starts_at);
    const endTime = instantTime(range.ends_at);
    const fullDay =
      startTime === "00:00" && endTime === "00:00" && endDate > startDate;
    if (fullDay) {
      for (let date = startDate; date < endDate; date = addDaysISO(date, 1)) {
        entries.push({
          date,
          time: "",
          mode: "all",
          fullDay: true,
          startMin: 0,
          endMin: 24 * 60,
          startsAt: range.starts_at,
          endsAt: range.ends_at,
        });
      }
      return;
    }
    entries.push({
      date: startDate,
      time: startTime,
      mode: "all",
      fullDay: false,
      startMin: minutesOf(startTime),
      endMin:
        endDate > startDate ? 24 * 60 : Math.max(minutesOf(endTime), 1),
      startsAt: range.starts_at,
      endsAt: range.ends_at,
    });
  });
  panelBlocks = entries;
}

function availabilityKey(date) {
  if (!state.service) return "";
  return `${state.service.id}|${state.service.mode}|${formatISO(date)}`;
}

async function loadRemoteAvailability(date) {
  if (
    !remote.configured ||
    !remote.enabled ||
    !state.service ||
    isMembership()
  ) {
    return;
  }
  const serviceId = remote.services.get(state.service.id);
  if (!serviceId) return;
  const iso = formatISO(date);
  const key = availabilityKey(date);
  const generation = remote.generation;
  remote.loading.add(key);
  remote.errors.delete(key);
  if (state.date && formatISO(state.date) === iso) {
    renderTimeSlots();
  }
  try {
    const slots = await fetchAvailability(serviceId, state.service.mode, iso);
    if (generation !== remote.generation) return;
    remote.slots.set(
      key,
      (Array.isArray(slots) ? slots : [])
        .filter((slot) => slot?.starts_at)
        .map((slot) => ({
          time: instantTime(slot.starts_at),
          startsAt: slot.starts_at,
          endsAt: slot.ends_at,
          price: slot.price,
        })),
    );
  } catch {
    if (generation !== remote.generation) return;
    remote.slots.delete(key);
    remote.errors.set(
      key,
      "No pudimos actualizar la disponibilidad. Probá de nuevo o confirmá por WhatsApp.",
    );
  } finally {
    if (generation !== remote.generation) return;
    remote.loading.delete(key);
    if (state.date && formatISO(state.date) === iso) {
      if (state.time && !slotsForDate(state.date).includes(state.time)) {
        state.time = null;
        if (state.step === 3) setStep(2);
      }
      renderCalendar();
      renderTimeSlots();
      updatePreview();
    }
  }
}

async function refreshRemoteData() {
  if (!remote.configured) return;
  const generation = ++remote.generation;
  const today = formatISO(argentinaToday());
  const results = await Promise.allSettled([
    fetchSiteCatalog(),
    fetchBlockedRanges(today, addDaysISO(today, 365)),
  ]);
  if (generation !== remote.generation) return;
  if (results[0].status === "fulfilled") {
    applyRemoteCatalog(results[0].value);
  }
  if (results[1].status === "fulfilled") {
    applyRemoteBlocks(results[1].value);
  }
  renderCalendar();
  renderTimeSlots();
  updatePreview();
  if (state.date && !isMembership()) {
    await loadRemoteAvailability(state.date);
  }
}

const formatPrice = (amount) => `$${amount.toLocaleString("es-AR")}`;

/* ---------------------------------------------------------------- enlaces */

document.querySelectorAll("[data-whatsapp]").forEach((link) => {
  link.href = `https://wa.me/${config.whatsappNumber}`;
});
document.querySelectorAll("[data-instagram]").forEach((link) => {
  link.href = config.instagramUrl;
});
document.querySelectorAll("[data-tiktok]").forEach((link) => {
  link.href = config.tiktokUrl;
});
document.querySelectorAll("[data-phone]").forEach((node) => {
  node.textContent = config.whatsappDisplay;
});
document.querySelectorAll("[data-address]").forEach((node) => {
  node.textContent = config.addressText;
});
document.querySelectorAll("[data-city]").forEach((node) => {
  node.textContent = config.addressCity;
});
document.querySelectorAll("[data-maps]").forEach((link) => {
  link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${config.addressText}, ${config.addressCity}`,
  )}`;
});
document.getElementById("year").textContent = new Intl.DateTimeFormat("en", {
  year: "numeric",
  timeZone: config.timeZone,
}).format(new Date());

/* ------------------------------------------------------------------ menú */

const menuButton = document.querySelector(".menu-toggle");
const nav = document.getElementById("main-nav");
menuButton.hidden = false;
nav.classList.add("is-enhanced");
function closeMenu(returnFocus = false) {
  menuButton.setAttribute("aria-expanded", "false");
  nav.classList.remove("is-open");
  if (returnFocus) menuButton.focus();
}
menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  nav.classList.toggle("is-open", open);
});
nav.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && nav.classList.contains("is-open"))
    closeMenu(true);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-header")) closeMenu();
});
matchMedia("(min-width: 761px)").addEventListener("change", () => closeMenu());

/* ------------------------------------------------ carrusel del hero */

const slideshow = document.querySelector("[data-slideshow]");
if (slideshow) {
  const slides = Array.from(slideshow.querySelectorAll(".hero-slide"));
  const dots = Array.from(document.querySelectorAll(".slideshow-dot"));
  const toggle = document.querySelector(".slideshow-toggle");
  const controls = document.querySelector(".slideshow-controls");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const INTERVAL_MS = 4500;
  let current = 0;
  let timer = null;
  let paused = reducedMotion.matches;

  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const on = i === current;
      slide.classList.toggle("is-active", on);
      if (on) slide.removeAttribute("aria-hidden");
      else slide.setAttribute("aria-hidden", "true");
    });
    dots.forEach((dot, i) => {
      const on = i === current;
      dot.classList.toggle("is-active", on);
      if (on) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function start() {
    stop();
    if (paused || document.hidden || slides.length < 2) return;
    timer = setInterval(() => show(current + 1), INTERVAL_MS);
  }

  function syncToggle() {
    const label = paused
      ? "Reanudar el carrusel de fotos"
      : "Pausar el carrusel de fotos";
    toggle.setAttribute("aria-label", label);
    toggle
      .querySelector("use")
      .setAttribute("href", paused ? "#icon-play" : "#icon-pause");
  }

  function setPaused(value) {
    paused = value;
    if (paused) stop();
    else start();
    syncToggle();
  }

  controls.hidden = false;
  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      show(i);
      start();
    });
  });
  toggle.addEventListener("click", () => setPaused(!paused));

  // Sólo avanza mientras el hero está a la vista y la pestaña activa.
  new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) start();
        else stop();
      }
    },
    { threshold: 0.25 },
  ).observe(slideshow);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  reducedMotion.addEventListener("change", (event) => setPaused(event.matches));

  show(0);
  syncToggle();
  start();
}

/* -------------------------------------------------- fechas (hora Argentina */

const pad = (n) => String(n).padStart(2, "0");

function argentinaNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: config.timeZone }),
  );
}
function argentinaToday() {
  const d = argentinaNow();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addMonths(d, n) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function formatISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  )
    return null;
  return d;
}
function formatLong(d) {
  return d.toLocaleDateString(config.locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function formatShort(d) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function isDateAllowed(d) {
  const today = argentinaToday();
  const max = addDays(today, config.horizonDays);
  return d >= today && d <= max;
}

/* ------------------------------------------- horarios por modalidad (D27) */

// Cada franja ofrece turnos completos dentro de su horario: el local con
// cortes de 30 min y el domicilio con cortes de 45 min.
const SCHEDULES = {
  local: {
    label: "Horarios en el local",
    stepMin: 30,
    windows: [
      { start: "09:00", end: "12:30" },
      { start: "16:30", end: "20:30" },
    ],
  },
  home: {
    label: "Horarios a domicilio",
    stepMin: 45,
    windows: [
      { start: "07:00", end: "08:30" },
      { start: "12:45", end: "15:45" },
    ],
  },
};

// Antes de elegir un servicio se muestra la franja del local.
function modeSchedule() {
  return SCHEDULES[state.service?.mode] || SCHEDULES.local;
}

function generateSlots(win, stepMin) {
  const [sh, sm] = win.start.split(":").map(Number);
  const [eh, em] = win.end.split(":").map(Number);
  const out = [];
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur + stepMin <= endMin) {
    out.push(`${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`);
    cur += stepMin;
  }
  return out;
}

function blockMatchesMode(block) {
  const mode = state.service?.mode || "local";
  return block.mode === "all" || block.mode === mode;
}

function dayBlocked(iso) {
  return panelBlocks.some(
    (block) =>
      block.date === iso && block.time === "" && blockMatchesMode(block),
  );
}

function slotBlocked(iso, slot) {
  const minutes = minutesOf(slot);
  return panelBlocks.some(
    (block) =>
      block.date === iso &&
      blockMatchesMode(block) &&
      (block.time === "" ||
        block.time === slot ||
        (block.startMin != null &&
          minutes >= block.startMin &&
          minutes < block.endMin)),
  );
}

function slotsForDate(date) {
  const key = availabilityKey(date);
  if (
    remote.configured &&
    remote.enabled &&
    remote.ready &&
    remote.slots.has(key)
  ) {
    return remote.slots.get(key).map((slot) => slot.time);
  }
  if (remote.configured && remote.enabled && remote.errors.has(key)) {
    return [];
  }
  const today = argentinaToday();
  const now = argentinaNow();
  const isToday = sameDay(date, today);
  const iso = formatISO(date);
  const { stepMin, windows } = modeSchedule();
  const all = windows.flatMap((w) => generateSlots(w, stepMin));
  return all.filter((slot) => {
    if (dayBlocked(iso) || slotBlocked(iso, slot)) return false;
    if (!isToday) return true;
    const [h, m] = slot.split(":").map(Number);
    const when = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      h,
      m,
    );
    return when > now;
  });
}

/* ----------------------------------------------------------- reserva 3 pasos */

const state = {
  service: null,
  extras: [],
  date: null,
  time: null,
  step: 1,
};

const $ = (id) => document.getElementById(id);

/* Servicio elegido = tarjeta base + extras tildados (sólo corte general). */

function isMembership() {
  return state.service?.type === "membership";
}

function isSunday(date) {
  return !!date && date.getDay() === 0;
}

// La peluquería abre de lunes a sábado: con el corte general no se pueden
// pedir turnos domingo; el corte a domicilio sí se puede ese día.
function localClosedOnSundays() {
  return state.service?.mode === "local";
}

function clearDate() {
  state.date = null;
  state.time = null;
  $("date-input").value = "";
  hideError("date");
  hideError("time");
}

function syncSundayNote() {
  $("sunday-note").hidden = !localClosedOnSundays();
}

function activeExtras() {
  if (state.service?.id !== "corte-general") return [];
  return EXTRAS.filter((extra) => state.extras.includes(extra.id));
}

function serviceName() {
  return [state.service?.name, ...activeExtras().map((extra) => extra.name)]
    .filter(Boolean)
    .join(" + ");
}

// Domicilio: $20.000 de lunes a sábado y $30.000 los domingos (según la fecha
// elegida); las membresías tienen precio fijo.
function serviceAmount() {
  if (!state.service) return 0;
  if (state.service.sundayAmount && isSunday(state.date)) {
    return state.service.sundayAmount;
  }
  return activeExtras().reduce(
    (sum, extra) => sum + extra.amount,
    state.service.amount,
  );
}

function serviceDuration() {
  if (state.service?.durationMin == null) return "";
  const minutes = activeExtras().reduce(
    (sum, extra) => sum + extra.durationMin,
    state.service.durationMin,
  );
  return `${minutes} min`;
}

function setStep(n, { focus = true } = {}) {
  state.step = n;
  for (let i = 1; i <= 3; i += 1) {
    $(`step-${i}`).hidden = i > n;
    const tab = $(`step-tab-${i}`);
    tab.classList.toggle("is-active", i === n);
    tab.classList.toggle("is-done", i < n);
    // Cada tab es un botón para volver a un paso ya completado. La membresía
    // no usa calendario: el paso 2 queda inaccesible.
    const canGo =
      i < n ||
      (i === 2 && !!state.service && !isMembership()) ||
      (i === 3 &&
        !!state.service &&
        (isMembership() || !!(state.date && state.time)));
    tab.disabled = !canGo;
    tab.setAttribute("aria-current", i === n ? "step" : "false");
  }
  if (focus) {
    const panel = $(`step-${n}`);
    // El scroll suave (CSS) lleva el paso recién abierto a la vista: sin él
    // el cambio ocurre debajo de la pantalla y parece que no pasó nada.
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({ block: "start" });
  }
}

// Volver a un paso desde la barra de progreso.
for (let i = 1; i <= 3; i += 1) {
  $(`step-tab-${i}`).addEventListener("click", () => {
    if ($(`step-tab-${i}`).disabled) return;
    setStep(i);
  });
}

/* Paso 1 — servicios */

// Crea un ícono Tabler desde el sprite del documento.
function iconEl(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#icon-${name}`);
  svg.append(use);
  return svg;
}

function serviceCard(service) {
  const card = document.createElement("label");
  card.className = "service-card";
  card.dataset.id = service.id;

  const input = document.createElement("input");
  input.type = "radio";
  input.name = "service";
  input.value = service.id;
  input.className = "sr-only";
  input.checked = state.service?.id === service.id;
  card.classList.toggle("is-selected", input.checked);

  const check = document.createElement("span");
  check.className = "service-card-check";
  check.setAttribute("aria-hidden", "true");
  check.textContent = "✓";

  const name = document.createElement("span");
  name.className = "service-card-name";
  name.textContent = service.name;

  const price = document.createElement("span");
  price.className = "service-card-price";
  price.textContent = formatPrice(service.amount);

  const meta = document.createElement("span");
  meta.className = "service-card-meta";

  if (service.durationMin != null) {
    const durationRow = document.createElement("span");
    durationRow.className = "service-card-meta-row";
    durationRow.append(
      iconEl("clock"),
      document.createTextNode(`${service.durationMin} min`),
    );
    meta.append(durationRow);
  }

  const placeRow = document.createElement("span");
  placeRow.className = "service-card-meta-row";
  if (service.mode === "home") {
    placeRow.append(iconEl("home"), document.createTextNode(service.place));
  } else {
    placeRow.textContent = service.place;
  }
  meta.append(placeRow);

  if (service.details) {
    const details = document.createElement("span");
    details.className = "service-card-details";
    details.textContent = service.details;
    meta.append(details);
  }

  if (service.closedNote) {
    const note = document.createElement("span");
    note.className = "service-card-note is-muted";
    note.textContent = service.closedNote;
    meta.append(note);
  }

  if (service.sundayAmount) {
    const note = document.createElement("span");
    note.className = "service-card-note";
    note.textContent = `Domingos ${formatPrice(service.sundayAmount)}`;
    meta.append(note);
  }

  card.append(input, check, name, price, meta);
  input.addEventListener("change", () => selectService(service));
  return card;
}

// Dos grillas en el paso 1: servicios sueltos y membresías (sólo domicilio).
function renderServices() {
  const grid = $("service-cards");
  const memberships = $("membership-cards");
  grid.innerHTML = "";
  memberships.innerHTML = "";
  SERVICES.forEach((service) => {
    const target = service.type === "membership" ? memberships : grid;
    target.append(serviceCard(service));
  });
}

function renderExtras() {
  const wrap = $("extra-chips");
  wrap.innerHTML = "";
  EXTRAS.forEach((extra) => {
    const chip = document.createElement("label");
    chip.className = "extra-chip";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "extras";
    input.value = extra.id;
    input.className = "sr-only";
    input.checked = state.extras.includes(extra.id);

    const name = document.createElement("span");
    name.className = "extra-chip-name";
    name.textContent = extra.name;

    const price = document.createElement("span");
    price.className = "extra-chip-price";
    price.textContent = `+${formatPrice(extra.amount)}`;

    chip.append(input, name, price);
    input.addEventListener("change", syncExtras);
    wrap.append(chip);
  });
}

// Tildes de extras → total, resumen y vista previa; el paso no cambia hasta
// que la persona pulse "Continuar".
function syncExtras() {
  state.extras = Array.from(
    $("extra-chips").querySelectorAll("input:checked"),
  ).map((input) => input.value);
  syncExtrasPanel();
  updateChosenService();
  updatePreview();
}

function syncExtrasPanel() {
  const isCut = state.service?.id === "corte-general";
  const membership = isMembership();
  $("service-extras").hidden = !isCut;
  $("membership-conditions").hidden = !membership;
  $("membership-total").hidden = !membership;
  $("membership-continue").hidden = !membership;
  // "Continuar" acompaña a los dos cortes; la membresía usa el suyo propio.
  $("service-continue").hidden = !state.service || membership;
  $("extra-chips")
    .querySelectorAll("input")
    .forEach((input) => {
      input.checked = state.extras.includes(input.value);
    });
  $("extra-total").textContent = `Total del servicio: ${formatPrice(
    serviceAmount(),
  )}`;
  if (membership) {
    $("membership-total").textContent = `Total de la membresía: ${formatPrice(
      serviceAmount(),
    )}`;
  }
}

function updateChosenService() {
  if (!state.service) {
    $("chosen-service").textContent = "";
    return;
  }
  const price = formatPrice(serviceAmount());
  const base = `Servicio elegido: ${serviceName()} · ${price}`;
  if (isMembership()) {
    $("chosen-service").textContent = `${base} · A coordinar por WhatsApp`;
    return;
  }
  $("chosen-service").textContent = `${base} · ${serviceDuration()}`;
}

function selectService(service) {
  state.service = service;
  const isCut = service.id === "corte-general";
  const membership = service.type === "membership";
  if (!isCut) state.extras = [];
  if (membership) {
    // La membresía no usa calendario: se limpia cualquier fecha elegida.
    clearDate();
  } else if (service.mode === "local" && isSunday(state.date)) {
    // Los domingos la peluquería está cerrada: ese día sólo hay domicilio.
    clearDate();
  }

  document.querySelectorAll(".service-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.id === service.id);
  });

  syncExtrasPanel();
  syncSundayNote();
  updateChosenService();

  const addressField = $("address-field");
  addressField.hidden = service.mode !== "home";
  $("address").required = service.mode === "home";

  // Conservar fecha y horario si siguen válidos; si no, limpiar horario.
  if (state.date) {
    const slots = slotsForDate(state.date);
    if (!slots.includes(state.time)) state.time = null;
  }
  renderCalendar();
  renderTimeSlots();
  updatePreview();
  if (state.date && !membership) loadRemoteAvailability(state.date);

  // Elegir un servicio nunca salta de paso solo: el cliente avanza con su
  // botón "Continuar" (al paso 3 si ya quedaron fecha y horario).
  setStep(1, { focus: false });
}

/* Paso 2 — calendario */

const calendarState = { view: argentinaToday() };
calendarState.view.setDate(1);

function renderCalendar() {
  const { view } = calendarState;
  const year = view.getFullYear();
  const month = view.getMonth();
  const today = argentinaToday();
  const max = addDays(today, config.horizonDays);

  $("calendar-title").textContent = view
    .toLocaleDateString(config.locale, { month: "long", year: "numeric" })
    .replace(/^(\w)/, (c) => c.toUpperCase());

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const grid = $("calendar-days");
  grid.innerHTML = "";
  const closedSunday = localClosedOnSundays();

  for (let i = 0; i < offset; i += 1) {
    const padCell = document.createElement("span");
    padCell.className = "calendar-blank";
    padCell.setAttribute("aria-hidden", "true");
    grid.append(padCell);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month, day);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "calendar-day";
    btn.textContent = String(day);
    const inRange = isDateAllowed(d);
    const sundayClosed = closedSunday && d.getDay() === 0;
    const blocked = dayBlocked(formatISO(d));
    const allowed = inRange && !sundayClosed && !blocked;
    btn.disabled = !allowed;
    if (sundayClosed) btn.classList.add("is-closed-sunday");
    if (blocked) btn.classList.add("is-blocked");
    if (sameDay(d, today)) {
      btn.classList.add("is-today");
      btn.setAttribute("aria-current", "date");
    }
    if (state.date && sameDay(d, state.date)) {
      btn.classList.add("is-selected");
      btn.setAttribute("aria-pressed", "true");
    } else {
      btn.setAttribute("aria-pressed", "false");
    }
    const suffix = !inRange
      ? " (no disponible)"
      : blocked
        ? " (bloqueado por la barbería)"
        : sundayClosed
          ? " (la peluquería está cerrada los domingos)"
          : "";
    btn.setAttribute("aria-label", `${formatLong(d)}${suffix}`);
    if (allowed) {
      btn.addEventListener("click", () => selectDate(d));
    }
    grid.append(btn);
  }

  const prevMonth = new Date(year, month, 1);
  $("calendar-prev").disabled =
    prevMonth <= new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(year, month + 1, 1);
  $("calendar-next").disabled =
    nextMonth > new Date(max.getFullYear(), max.getMonth(), 1);
}

function selectDate(date) {
  state.date = date;
  state.time = null;
  $("date-input").value = formatISO(date);
  hideError("date");
  renderCalendar();
  renderTimeSlots();
  // El corte a domicilio cambia de precio si la fecha es domingo.
  updateChosenService();
  syncExtrasPanel();
  updatePreview();
  if (!isMembership()) loadRemoteAvailability(date);
  // Al cambiar la fecha se pierde el horario: volver al paso 2.
  if (state.step === 3) setStep(2);
}

// Franjas y duración del turno, visibles junto a los horarios.
function syncTimesSchedule() {
  const schedule = modeSchedule();
  $("times-duration").textContent = `Turnos de ${schedule.stepMin} minutos.`;
  const node = $("times-schedule");
  if (!state.service || isMembership()) {
    node.hidden = true;
    node.textContent = "";
    return;
  }
  const ranges = schedule.windows
    .map((w) => `de ${w.start} a ${w.end}`)
    .join(" y ");
  node.textContent = `${schedule.label}: ${ranges}.`;
  node.hidden = false;
}

const TIMES_EMPTY_COPY =
  "No hay turnos disponibles para este día. Probá con otra fecha.";

function renderTimeSlots() {
  const wrap = $("time-slots");
  const empty = $("times-empty");
  const heading = $("times-heading");
  wrap.innerHTML = "";
  syncTimesSchedule();

  if (!state.date) {
    heading.textContent = "Elegí un día para ver los horarios.";
    empty.hidden = true;
    return;
  }

  heading.textContent = `Horarios disponibles el ${formatLong(state.date)}`;
  const key = availabilityKey(state.date);
  if (
    remote.configured &&
    remote.enabled &&
    remote.ready &&
    remote.loading.has(key) &&
    !remote.slots.has(key)
  ) {
    empty.textContent = "Cargando horarios disponibles…";
    empty.hidden = false;
    return;
  }
  if (remote.configured && remote.enabled && remote.errors.has(key)) {
    empty.textContent = remote.errors.get(key);
    empty.hidden = false;
    return;
  }

  empty.textContent = TIMES_EMPTY_COPY;
  const slots = slotsForDate(state.date);

  if (slots.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  slots.forEach((slot) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "time-slot";
    btn.textContent = slot;
    btn.setAttribute("aria-pressed", state.time === slot ? "true" : "false");
    if (state.time === slot) btn.classList.add("is-selected");
    btn.addEventListener("click", () => selectTime(slot, btn));
    wrap.append(btn);
  });
}

function selectTime(slot, btn) {
  state.time = slot;
  $("time-slots")
    .querySelectorAll(".time-slot")
    .forEach((b) => {
      const on = b === btn;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  hideError("time");
  updatePreview();
  setStep(3);
}

/* Paso 3 — datos y WhatsApp */

function updatePreview() {
  $("preview-service").textContent = state.service ? serviceName() : "—";
  $("preview-price").textContent = state.service
    ? formatPrice(serviceAmount())
    : "—";
  if (isMembership()) {
    $("preview-date").textContent = "A coordinar por WhatsApp";
    $("preview-time").textContent = "A coordinar por WhatsApp";
    return;
  }
  $("preview-date").textContent = state.date ? formatLong(state.date) : "—";
  $("preview-time").textContent = state.time
    ? `${state.time} (hora de Argentina)`
    : "—";
}

function fieldTarget(field) {
  if (field === "time") return $("time-slots");
  if (field === "date") return $("date-input");
  return $(field);
}

function showError(field, message) {
  const error = $(`error-${field}`);
  error.textContent = message;
  error.hidden = false;
  fieldTarget(field)?.setAttribute("aria-invalid", "true");
}

function hideError(field) {
  const error = $(`error-${field}`);
  if (!error) return;
  error.hidden = true;
  error.textContent = "";
  fieldTarget(field)?.removeAttribute("aria-invalid");
}

function validateDetails() {
  let ok = true;
  const name = $("name").value.trim();
  hideError("name");
  hideError("address");
  $("form-status").textContent = "";

  if (name.length < 2 || name.length > 80) {
    showError("name", "Escribí tu nombre y apellido (mínimo 2 caracteres).");
    ok = false;
  }
  if (state.service?.mode === "home") {
    const address = $("address").value.trim();
    if (address.length < 5 || address.length > 180) {
      showError(
        "address",
        "Escribí la dirección del domicilio (mínimo 5 caracteres).",
      );
      ok = false;
    }
  }
  const missing = "Faltan datos del turno. Volvé a los pasos anteriores.";
  if (!state.service) {
    $("form-status").textContent = missing;
    ok = false;
  } else if (isMembership()) {
    // La membresía no tiene fecha fija: se coordina por WhatsApp.
  } else if (!state.date || !state.time) {
    $("form-status").textContent = missing;
    ok = false;
  } else if (!isDateAllowed(state.date)) {
    $("form-status").textContent =
      "La fecha elegida ya no está disponible. Elegí otra.";
    ok = false;
  } else if (localClosedOnSundays() && isSunday(state.date)) {
    $("form-status").textContent =
      "Los domingos la peluquería está cerrada. Elegí otro día o el corte a domicilio.";
    ok = false;
  } else {
    const slots = slotsForDate(state.date);
    if (!slots.includes(state.time)) {
      $("form-status").textContent =
        "Ese horario ya no está disponible. Elegí otro.";
      ok = false;
    }
  }

  if (!ok) {
    const firstError = document.querySelector(".field-error:not([hidden])");
    firstError?.scrollIntoView({ block: "center", behavior: "auto" });
  }
  return ok;
}

function buildMessage() {
  const lines = [
    `Hola JC BARBER, quiero solicitar un turno.`,
    `Servicio: ${serviceName()} (${state.service.place}).`,
  ];
  if (isMembership()) {
    lines.push(`Fecha y hora: a coordinar por WhatsApp`);
  } else {
    lines.push(`Fecha preferida: ${formatShort(state.date)}`);
    lines.push(`Hora preferida: ${state.time}`);
  }
  lines.push(`Nombre: ${$("name").value.trim()}`);
  if (state.service.mode === "home") {
    lines.push(`Domicilio: ${$("address").value.trim()}`);
  }
  lines.push("Quedo a la espera de confirmar disponibilidad. ¡Gracias!");
  return lines.join("\n");
}

function openWhatsApp() {
  const text = encodeURIComponent(buildMessage());
  window.open(
    `https://wa.me/${config.whatsappNumber}?text=${text}`,
    "_blank",
    "noopener,noreferrer",
  );
}

$("booking-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateDetails()) return;
  openWhatsApp();
});

/* init */

renderServices();
renderExtras();
renderCalendar();
renderTimeSlots();
syncSundayNote();
syncExtrasPanel();
updatePreview();
setStep(1, { focus: false });

if (remote.configured) {
  refreshRemoteData();
  window.setInterval(() => {
    if (!document.hidden) refreshRemoteData();
  }, 30000);
}

// Si el panel abierto en otra pestaña modifica precios, esta página se
// actualiza sin recargar y conserva el servicio/fecha ya elegidos.
function refreshCatalogUI() {
  applyCatalogPrices();
  renderServices();
  renderExtras();
  syncExtrasPanel();
  updateChosenService();
  updatePreview();
}

function catalogRaw() {
  try {
    return localStorage.getItem(CATALOG_KEY) ?? "";
  } catch {
    return "";
  }
}

let lastCatalogRaw = catalogRaw();
function refreshCatalogFromStorage() {
  if (remote.ready) return;
  const raw = catalogRaw();
  if (raw === lastCatalogRaw) return;
  lastCatalogRaw = raw;
  refreshCatalogUI();
}

function blocksRaw() {
  try {
    return localStorage.getItem(BLOCKS_KEY) ?? "";
  } catch {
    return "";
  }
}

let lastBlocksRaw = blocksRaw();
function refreshBlocksFromStorage() {
  if (remote.ready) return;
  const raw = blocksRaw();
  if (raw === lastBlocksRaw) return;
  lastBlocksRaw = raw;
  applyPanelBlocks();
  if (state.date) {
    const slots = slotsForDate(state.date);
    if (!slots.includes(state.time)) state.time = null;
  }
  renderCalendar();
  renderTimeSlots();
  updatePreview();
  if (!state.time && state.step === 3) setStep(2);
}

window.addEventListener("storage", (event) => {
  if (event.key === CATALOG_KEY) refreshCatalogFromStorage();
  if (event.key === BLOCKS_KEY) refreshBlocksFromStorage();
});
window.addEventListener("focus", () => {
  refreshCatalogFromStorage();
  refreshBlocksFromStorage();
  refreshRemoteData();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  refreshCatalogFromStorage();
  refreshBlocksFromStorage();
  refreshRemoteData();
});

// El corte general espera en el paso 1 a que se elijan (o no) los extras.
$("service-continue").addEventListener("click", () => {
  if (state.date && state.time) setStep(3);
  else setStep(2);
});

// La membresía omite el calendario y va directo al paso 3.
$("membership-continue").addEventListener("click", () => setStep(3));

$("calendar-prev").addEventListener("click", () => {
  calendarState.view = addMonths(calendarState.view, -1);
  renderCalendar();
});
$("calendar-next").addEventListener("click", () => {
  calendarState.view = addMonths(calendarState.view, 1);
  renderCalendar();
});
$("date-input").addEventListener("change", () => {
  const d = parseISO($("date-input").value);
  if (!d) {
    if ($("date-input").value === "") return;
    showError("date", "Fecha inválida.");
    return;
  }
  if (!isDateAllowed(d)) {
    showError(
      "date",
      `Elegí una fecha entre hoy y ${formatLong(addDays(argentinaToday(), config.horizonDays))}.`,
    );
    return;
  }
  if (localClosedOnSundays() && isSunday(d)) {
    showError(
      "date",
      "Los domingos la peluquería está cerrada. Elegí otro día o, para el domingo, el corte a domicilio.",
    );
    return;
  }
  hideError("date");
  calendarState.view = new Date(d.getFullYear(), d.getMonth(), 1);
  selectDate(d);
});
