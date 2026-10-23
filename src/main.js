/* JC BARBER — lógica de la página y reserva en 3 pasos (archivo único). */

const config = {
  whatsappDisplay: "+54 9 3329 60-6138",
  whatsappNumber: "5493329606138",
  instagramUrl: "https://www.instagram.com/jc_barberhouse/",
  tiktokUrl:
    "https://www.tiktok.com/@jcbarberhouse?_r=1&_t=ZS-9AfYPGAygh0",
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
    price: "$18.000",
    duration: "30 min",
    mode: "local",
    place: "En el local",
  },
  {
    id: "barba",
    name: "Barba",
    price: "$10.000",
    duration: "30 min",
    mode: "local",
    place: "En el local",
  },
  {
    id: "perfilado-cejas",
    name: "Perfilado de cejas",
    price: "$8.000",
    duration: "30 min",
    mode: "local",
    place: "En el local",
  },
  {
    id: "corte-domicilio",
    name: "Corte a domicilio",
    price: "$30.000",
    duration: "45 min",
    mode: "home",
    place: "A domicilio",
    details: "Incluye barba y perfilado de cejas",
  },
];

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

/* --------------------------------------------------------------- galería */

const dialog = document.getElementById("photo-dialog");
const fullPhoto = document.getElementById("photo-full");
let photoOpener;
document.querySelectorAll(".gallery-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      typeof dialog.showModal !== "function"
    )
      return;
    event.preventDefault();
    photoOpener = link;
    fullPhoto.src = link.href;
    fullPhoto.alt = link.querySelector("img").alt;
    document.getElementById("photo-caption").textContent = link.dataset.caption;
    dialog.showModal();
    document.body.classList.add("dialog-open");
  });
});
dialog
  .querySelector(".dialog-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  const box = dialog.getBoundingClientRect();
  if (
    event.target === dialog &&
    (event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom)
  )
    dialog.close();
});
dialog.addEventListener("close", () => {
  document.body.classList.remove("dialog-open");
  photoOpener?.focus();
});

/* -------------------------------------------------- fechas (hora Argentina */

const pad = (n) => String(n).padStart(2, "0");

function argentinaNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: config.timeZone }));
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

/* ------------------------------------------------------- slots de 30 min */

const SLOT_MINUTES = 30;
const WINDOWS = [
  { start: "09:00", end: "12:30" },
  { start: "16:30", end: "20:30" },
];

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

function slotsForDate(date) {
  const today = argentinaToday();
  const now = argentinaNow();
  const isToday = sameDay(date, today);
  const all = WINDOWS.flatMap((w) => generateSlots(w, SLOT_MINUTES));
  return all.filter((slot) => {
    if (!isToday) return true;
    const [h, m] = slot.split(":").map(Number);
    const when = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
    return when > now;
  });
}

/* ----------------------------------------------------------- reserva 3 pasos */

const state = {
  service: null,
  date: null,
  time: null,
  step: 1,
};

const $ = (id) => document.getElementById(id);

function setStep(n, { focus = true } = {}) {
  state.step = n;
  for (let i = 1; i <= 3; i += 1) {
    $(`step-${i}`).hidden = i > n;
    const tab = $(`step-tab-${i}`);
    tab.classList.toggle("is-active", i === n);
    tab.classList.toggle("is-done", i < n);
    // Cada tab es un botón para volver a un paso ya completado.
    const canGo =
      i < n ||
      (i === 2 && !!state.service) ||
      (i === 3 && !!(state.service && state.date && state.time));
    tab.disabled = !canGo;
    tab.setAttribute("aria-current", i === n ? "step" : "false");
  }
  if (focus) $(`step-${n}`).focus({ preventScroll: true });
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

function renderServices() {
  const grid = $("service-cards");
  grid.innerHTML = "";
  SERVICES.forEach((service) => {
    const card = document.createElement("label");
    card.className = "service-card";
    card.dataset.id = service.id;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "service";
    input.value = service.id;
    input.className = "sr-only";

    const check = document.createElement("span");
    check.className = "service-card-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";

    const name = document.createElement("span");
    name.className = "service-card-name";
    name.textContent = service.name;

    const price = document.createElement("span");
    price.className = "service-card-price";
    price.textContent = service.price;

    const meta = document.createElement("span");
    meta.className = "service-card-meta";

    const durationRow = document.createElement("span");
    durationRow.className = "service-card-meta-row";
    durationRow.append(iconEl("clock"), document.createTextNode(service.duration));
    meta.append(durationRow);

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

    card.append(input, check, name, price, meta);
    input.addEventListener("change", () => selectService(service));
    grid.append(card);
  });
}

function selectService(service) {
  state.service = service;
  document.querySelectorAll(".service-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.id === service.id);
  });
  $("chosen-service").textContent = `Servicio elegido: ${service.name} · ${service.price} · ${service.duration}`;

  const addressField = $("address-field");
  addressField.hidden = service.mode !== "home";
  $("address").required = service.mode === "home";

  // Conservar fecha y horario si siguen válidos; si no, limpiar horario.
  if (state.date) {
    const slots = slotsForDate(state.date);
    if (!slots.includes(state.time)) state.time = null;
  }
  renderTimeSlots();
  updatePreview();

  if (state.date && state.time) setStep(3);
  else setStep(2);
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
    const allowed = isDateAllowed(d);
    btn.disabled = !allowed;
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
    btn.setAttribute(
      "aria-label",
      `${formatLong(d)}${allowed ? "" : " (no disponible)"}`,
    );
    if (allowed) {
      btn.addEventListener("click", () => selectDate(d));
    }
    grid.append(btn);
  }

  const prevMonth = new Date(year, month, 1);
  $("calendar-prev").disabled = prevMonth <= new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(year, month + 1, 1);
  $("calendar-next").disabled = nextMonth > new Date(max.getFullYear(), max.getMonth(), 1);
}

function selectDate(date) {
  state.date = date;
  state.time = null;
  $("date-input").value = formatISO(date);
  hideError("date");
  renderCalendar();
  renderTimeSlots();
  updatePreview();
  // Al cambiar la fecha se pierde el horario: volver al paso 2.
  if (state.step === 3) setStep(2);
}

function renderTimeSlots() {
  const wrap = $("time-slots");
  const empty = $("times-empty");
  const heading = $("times-heading");
  wrap.innerHTML = "";

  if (!state.date) {
    heading.textContent = "Elegí un día para ver los horarios.";
    empty.hidden = true;
    return;
  }

  heading.textContent = `Horarios disponibles el ${formatLong(state.date)}`;
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
  $("time-slots").querySelectorAll(".time-slot").forEach((b) => {
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
  $("preview-service").textContent = state.service ? state.service.name : "—";
  $("preview-price").textContent = state.service ? state.service.price : "—";
  $("preview-date").textContent = state.date ? formatLong(state.date) : "—";
  $("preview-time").textContent = state.time ? `${state.time} (hora de Argentina)` : "—";
}

function showError(field, message) {
  const error = $(`error-${field}`);
  error.textContent = message;
  error.hidden = false;
  const input = $(field === "time" ? "time-slots" : field);
  if (input) input.setAttribute("aria-invalid", "true");
}

function hideError(field) {
  const error = $(`error-${field}`);
  if (!error) return;
  error.hidden = true;
  error.textContent = "";
  const input = $(field === "time" ? "time-slots" : field);
  if (input) input.removeAttribute("aria-invalid");
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
      showError("address", "Escribí la dirección del domicilio (mínimo 5 caracteres).");
      ok = false;
    }
  }
  if (!state.service || !state.date || !state.time) {
    $("form-status").textContent = "Faltan datos del turno. Volvé a los pasos anteriores.";
    ok = false;
  } else if (!isDateAllowed(state.date)) {
    $("form-status").textContent = "La fecha elegida ya no está disponible. Elegí otra.";
    ok = false;
  } else {
    const slots = slotsForDate(state.date);
    if (!slots.includes(state.time)) {
      $("form-status").textContent = "Ese horario ya no está disponible. Elegí otro.";
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
    `Servicio: ${state.service.name} (${state.service.place}) — ${state.service.price}, ${state.service.duration}.`,
    `Fecha preferida: ${formatShort(state.date)}`,
    `Hora preferida: ${state.time} (hora de Argentina)`,
    `Nombre: ${$("name").value.trim()}`,
  ];
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
renderCalendar();
renderTimeSlots();
updatePreview();
setStep(1, { focus: false });

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
    showError("date", `Elegí una fecha entre hoy y ${formatLong(addDays(argentinaToday(), config.horizonDays))}.`);
    return;
  }
  hideError("date");
  calendarState.view = new Date(d.getFullYear(), d.getMonth(), 1);
  selectDate(d);
});
