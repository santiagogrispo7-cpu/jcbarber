import { config } from "./config.js";
import { initCalendar } from "./calendar.js";
import { focusBookingField, initBookingVisual } from "./booking-visual.js";
import { bookingFields, formatDate, formatLongDate, isValidDate, validateBooking } from "./date-utils.js";
import { formatPrice, requestedSlots, serviceById, services } from "./services.js";
import { buildWhatsAppUrl } from "./whatsapp.js";
import { updateBookingPreview } from "./booking-preview.js";

export function initBooking() {
  const $ = (id) => document.getElementById(id);
  const form = $("booking-form");
  const mode = $("booking-mode");
  const service = $("booking-service");
  const date = $("date");
  const time = $("time");
  const status = $("form-status");
  const availability = $("availability-status");
  const fields = bookingFields.filter((field) => field !== "comments");
  let attempted = false;
  const touched = new Set();
  const option = (value, text) => Object.assign(document.createElement("option"), { value, textContent: text });
  form.noValidate = true;

  function data() {
    return {
      ...Object.fromEntries(fields.map((field) => [field, $(field).value])),
      service: service.value,
      comments: $("notes").value,
      phone: $("phone").value,
    };
  }

  function errorsFor(values, now = new Date()) {
    const errors = validateBooking(values, now);
    if (errors.comments) {
      errors.notes = errors.comments;
      delete errors.comments;
    }
    const selected = serviceById(values.service);
    if (!selected || selected.mode !== mode.value) errors.service = "Elegí un servicio.";
    if (!/^\S+\s+\S+/.test(values.name.trim())) errors.name = "Ingresá tu nombre y apellido.";
    if (selected?.mode !== "home") delete errors.address;
    if (!errors.time && !requestedSlots(selected?.mode, values.date, now).some((slot) => slot.time === values.time)) {
      errors.time = "Turnos no disponibles. Elegí otro horario de la lista.";
    }
    if (isValidDate(values.date) && values.date < date.min) errors.date = "Turnos no disponibles. Elegí una fecha desde hoy.";
    return errors;
  }

  function updateSummary() {
    const values = data();
    const selected = serviceById(values.service);
    updateBookingPreview({ service: selected?.name, price: selected ? formatPrice(selected.price) : "", date: values.date, time: values.time, mode: mode.value });
    $("service-detail").textContent = selected
      ? `${selected.name} · ${formatPrice(selected.price)} · ${selected.duration} minutos. ${selected.description || "Atención en la barbería."}`
      : "Elegí el servicio que buscás.";
    $("booking-summary").textContent = [
      selected ? `${selected.name} · ${formatPrice(selected.price)}` : "Servicio sin elegir",
      selected?.mode === "home" ? "A domicilio" : "En el local",
      isValidDate(values.date) ? formatDate(values.date) : "Fecha sin elegir",
      values.time ? `${values.time} (hora de Argentina)` : "Horario sin elegir",
      values.name.trim(),
      selected?.mode === "home" ? values.address.trim() : config.addressText,
      "La disponibilidad se confirma por WhatsApp.",
    ].filter(Boolean).join(" · ");
    const timesDate = form.querySelector("#times-date");
    if (timesDate) timesDate.textContent = isValidDate(date.value) ? formatLongDate(date.value) : "";
    const errors = errorsFor(values);
    for (const field of [...fields, "service", "notes"]) {
      const control = field === "service" ? service : $(field);
      const message = attempted || touched.has(field) ? errors[field] : "";
      $(`error-${field}`).textContent = message || "";
      $(`error-${field}`).hidden = !message;
      if (message) control.setAttribute("aria-invalid", "true");
      else control.removeAttribute("aria-invalid");
    }
  }

  function refreshSlots() {
    const previous = time.value;
    const selected = serviceById(service.value);
    const slots = requestedSlots(selected?.mode, date.value);
    time.replaceChildren(option("", "Elegí un horario"), ...slots.map((slot) => option(slot.time, `${slot.time}–${slot.end}`)));
    time.disabled = slots.length === 0;
    time.value = slots.some((slot) => slot.time === previous) ? previous : "";
    availability.textContent = date.value && (date.value < date.min || date.value > date.max)
      ? "Turnos no disponibles. Elegí una fecha desde hoy dentro del rango del calendario."
      : !selected || !date.value ? "Elegí el servicio y una fecha para ver los turnos."
        : slots.length ? `Turnos de ${selected.duration} minutos. Confirmamos disponibilidad por WhatsApp.`
          : "Turnos no disponibles para esta fecha. Elegí otro día.";
    updateSummary();
  }

  function populateServices() {
    service.replaceChildren(option("", "Elegí un servicio"), ...services.map((item) => {
      const entry = option(item.id, item.name);
      entry.dataset.mode = item.mode;
      entry.dataset.price = formatPrice(item.price);
      entry.dataset.duration = String(item.duration);
      entry.dataset.description = item.description || "Atención en la barbería.";
      return entry;
    }));
  }
  function changeMode() {
    if (serviceById(service.value)?.mode !== mode.value) service.value = "";
    $("address").required = mode.value === "home";
    $("address").disabled = mode.value !== "home";
    $("address").closest(".field").hidden = mode.value !== "home";
    time.value = "";
    refreshSlots();
  }
  const calendar = initCalendar({ input: date, root: $("calendar"), onSelect: refreshSlots });
  mode.addEventListener("change", changeMode);
  service.addEventListener("change", () => {
    const selected = serviceById(service.value);
    if (selected && mode.value !== selected.mode) {
      mode.value = selected.mode;
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    } else { time.value = ""; refreshSlots(); }
  });
  form.addEventListener("input", updateSummary);
  form.addEventListener("change", updateSummary);
  form.addEventListener("blur", (event) => {
    touched.add(event.target === service ? "service" : event.target.id);
    updateSummary();
  }, true);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    calendar.refresh();
    const values = data();
    const errors = errorsFor(values);
    attempted = true;
    updateSummary();
    const first = ["service", "date", "time", "name", "address", "notes"].find((field) => errors[field]);
    if (first) {
      status.textContent = `Revisá tus datos. ${errors[first]}`;
      refreshSlots();
      focusBookingField(form, first);
      return;
    }
    status.textContent = "Se abrirá WhatsApp con tu mensaje preparado. Envialo allí para confirmar disponibilidad.";
    window.location.assign(buildWhatsAppUrl(values));
  });
  const refresh = () => { if (!document.hidden) { calendar.refresh(); refreshSlots(); } };
  const timer = window.setInterval(refresh, 30000);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("pagehide", () => window.clearInterval(timer));
  window.addEventListener("pageshow", (event) => { if (event.persisted) window.location.reload(); });
  form.addEventListener("reset", () => window.setTimeout(() => {
    attempted = false; touched.clear(); status.textContent = ""; calendar.refresh(); changeMode();
  }, 0));
  populateServices();
  changeMode();
  initBookingVisual(form);
  $("booking-submit").disabled = false;
  return { calendar };
}
