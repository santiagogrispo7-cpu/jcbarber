import { rpc } from "./booking-api.js";
import { initCalendar } from "./calendar.js";
import { focusBookingField, initBookingVisual } from "./booking-visual.js";
import { addDays, argentinaNow, formatDate, formatLongDate, isValidDate, todayInArgentina } from "./date-utils.js";
import { config } from "./config.js";
import { formatPrice, requestedSlots } from "./services.js";
import { updateBookingPreview } from "./booking-preview.js";

const price = formatPrice;
const modes = { local: "En el local", home: "A domicilio" };
const node = (tag, text) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  return el;
};
const option = (value, text) => Object.assign(node("option", text), { value });

export function initOnlineBooking() {
  const $ = (id) => document.getElementById(id);
  const form = $("booking-form");
  const submit = $("booking-submit");
  const status = $("form-status");
  let catalog;
  let slots = [];
  let sequence = 0;
  let catalogSequence = 0;
  let busy = false;
  let request = null;
  let uncertain = false;
  form.noValidate = false;
  form.removeAttribute("action");
  form.querySelector(".form-intro").textContent = "Completá tus datos para registrar el turno elegido.";
  form.querySelector(".form-footnote").textContent = "Primero guardamos tu turno en la agenda. Después, enviá el mensaje preparado por WhatsApp.";
  document.querySelector("#turnos .section-heading > p").textContent = "Elegí tu servicio y turno. Completá tus datos y continuá por WhatsApp.";
  form.querySelector(".summary-details summary").textContent = "Ver resumen de mi reserva";
  $("online-fields").hidden = false;
  $("phone-field").hidden = false;
  $("phone").required = true;
  $("name").maxLength = 120;
  $("name").minLength = 3;
  document.querySelector('label[for="name"]').textContent = "Nombre y apellido";
  document.querySelector('label[for="date"]').textContent = "Fecha del turno";
  document.querySelector('label[for="time"]').textContent = "Elegí un horario";
  $("address").maxLength = 250;
  $("address").placeholder = "Calle, número, piso y localidad…";
  const time = node("select");
  Object.assign(time, { id: "time", name: "time", required: true, disabled: true });
  time.setAttribute("aria-describedby", "time-hint error-time");
  $("time").replaceWith(time);
  const mode = $("booking-mode");
  const service = $("booking-service");
  const lookup = $("booking-lookup");
  lookup.hidden = false;
  const availability = $("availability-status");
  const receipt = $("booking-receipt");
  const controls = () => [...form.querySelectorAll("input,select,textarea,button")];

  function say(message, error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
  }
  function syncTimesDate() {
    const el = $("times-date");
    if (!el) return;
    el.textContent = isValidDate($("date").value) ? formatLongDate($("date").value) : "";
  }
  function summary() {
    syncTimesDate();
    const selected = catalog?.services.find((item) => item.id === service.value);
    updateBookingPreview({ service: selected?.name, price: selected ? price(selected.price) : "", date: $("date").value, time: time.value ? argentinaNow(new Date(time.value)).time : "", mode: mode.value });
    $("service-detail").textContent = selected ? `${price(selected.price)} · ${selected.duration_minutes} minutos de servicio${mode.value === "home" ? ". Incluye barba y perfilado de cejas." : ""}` : "Elegí un servicio para ver precio y duración.";
    $("booking-summary").textContent = [
      modes[mode.value], selected?.name,
      selected ? `${price(selected.price)} · ${selected.duration_minutes} min` : "",
      isValidDate($("date").value) ? formatDate($("date").value) : "Fecha sin elegir",
      time.value ? `${argentinaNow(new Date(time.value)).time} (Argentina)` : "Horario sin elegir",
      $("name").value.trim(), mode.value === "home" ? $("address").value.trim() : "AVENIDA SAN MARTIN 743",
    ].filter(Boolean).join(" · ");
  }
  function resetSlots(message = "Elegí un servicio y una fecha para consultar horarios.") {
    sequence += 1;
    slots = [];
    time.replaceChildren(option("", "Elegí un horario"));
    time.disabled = true;
    submit.disabled = true;
    availability.textContent = message;
    summary();
  }
  function services() {
    const previous = service.value;
    const available = catalog?.services || [];
    service.replaceChildren(option("", "Elegí un servicio"), ...available.map((item) => {
      const entry = option(item.id, item.name);
      entry.dataset.mode = item.modes.find((value) => value === "local" || value === "home") || "";
      entry.dataset.price = price(item.price);
      entry.dataset.duration = String(item.duration_minutes);
      entry.dataset.description = item.description || (entry.dataset.mode === "home"
        ? "Incluye barba y perfilado de cejas." : "Atención en la barbería.");
      entry.disabled = !entry.dataset.mode;
      return entry;
    }));
    service.value = available.some((item) => item.id === previous && item.modes.includes(mode.value)) ? previous : "";
    changeMode();
  }
  function changeMode() {
    const selected = catalog?.services.find((item) => item.id === service.value);
    if (!selected?.modes.includes(mode.value)) service.value = "";
    $("address").required = mode.value === "home";
    $("address").disabled = mode.value !== "home";
    $("address").closest(".field").hidden = mode.value !== "home";
    resetSlots();
  }
  async function loadSlots(background = false) {
    if (busy || uncertain || !catalog?.enabled || mode.disabled || service.disabled) return;
    const selected = time.value;
    if (!background) resetSlots();
    if (isValidDate($("date").value) && $("date").value < todayInArgentina()) {
      resetSlots("Turnos no disponibles. Elegí una fecha desde hoy.");
      return;
    }
    if (!service.value || !mode.value || !isValidDate($("date").value)) return;
    if (!catalog.services.some((item) => item.id === service.value && item.modes.includes(mode.value))) return;
    const day = $("date").value;
    const today = todayInArgentina();
    if (day < today || day > addDays(today, catalog.horizon_days)) {
      resetSlots(`Turnos no disponibles. Elegí una fecha del ${formatDate(today)} al ${formatDate(addDays(today, catalog.horizon_days))}.`);
      return;
    }
    const current = ++sequence;
    if (!background) availability.textContent = "Consultando horarios disponibles…";
    try {
      const result = await rpc("available_slots", { p_service: service.value, p_mode: mode.value, p_date: day });
      if (current !== sequence || busy || uncertain || form.hidden) return;
      const allowed = requestedSlots(mode.value, day);
      const matching = result.filter((slot) => {
        const start = argentinaNow(new Date(slot.starts_at));
        const end = argentinaNow(new Date(slot.ends_at));
        return start.date === day && end.date === day && allowed.some((item) => item.time === start.time && item.end === end.time);
      });
      if (background && !time.disabled && JSON.stringify(slots) === JSON.stringify(matching)) return;
      const previous = background ? time.value : selected;
      slots = matching;
      time.replaceChildren(option("", "Elegí un horario"), ...slots.map((slot) => option(slot.starts_at, `${argentinaNow(new Date(slot.starts_at)).time}–${argentinaNow(new Date(slot.ends_at)).time}`)));
      time.disabled = slots.length === 0;
      time.value = slots.some((slot) => slot.starts_at === previous) ? previous : "";
      submit.disabled = !time.value;
      summary();
      availability.textContent = slots.length ? "Horarios de Argentina. El servidor vuelve a comprobarlos al confirmar." : "Turnos no disponibles para esta fecha. Elegí otro día o servicio.";
    } catch (error) {
      if (current === sequence && !busy && !uncertain) resetSlots(`${error.message} Usá Actualizar horarios para reintentar.`);
    }
  }
  const calendar = initCalendar({ input: $("date"), root: $("calendar"), onSelect: () => { void loadSlots(); } });
  $("time-hint").textContent = "America/Argentina/Buenos_Aires. Traslados y descansos ya se tienen en cuenta en la disponibilidad.";
  mode.addEventListener("change", () => { changeMode(); void loadSlots(); });
  service.addEventListener("change", () => {
    time.value = "";
    const selected = catalog?.services.find((item) => item.id === service.value);
    if (selected && !selected.modes.includes(mode.value)) {
      mode.value = service.selectedOptions[0].dataset.mode;
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    } else { void loadSlots(); }
  });
  $("date").addEventListener("change", syncTimesDate);
  lookup.addEventListener("click", () => { void loadSlots(); });
  time.addEventListener("change", () => { submit.disabled = !time.value; summary(); });
  form.addEventListener("input", () => {
    $("name").setCustomValidity("");
    summary();
  });
  // Native validation still checks name/phone/address, but hidden state controls
  // hand focus to their visible service card or calendar day.
  let focusingInvalid = false;
  form.addEventListener("invalid", (event) => {
    event.preventDefault();
    const control = event.target;
    control.setAttribute("aria-invalid", "true");
    const error = $(control === mode || control === service ? "error-service" : `error-${control.id}`);
    if (error) { error.textContent = control.validationMessage; error.hidden = false; }
    if (focusingInvalid) return;
    focusingInvalid = true;
    say(`Revisá tus datos. ${control.validationMessage}`, true);
    focusBookingField(form, control.id);
    queueMicrotask(() => { focusingInvalid = false; });
  }, true);
  const clearError = (event) => {
    const control = event.target;
    control.removeAttribute("aria-invalid");
    const error = $(control === mode || control === service ? "error-service" : `error-${control.id}`);
    if (error) { error.textContent = ""; error.hidden = true; }
  };
  form.addEventListener("input", clearError);
  form.addEventListener("change", clearError);
  submit.querySelector("span").textContent = "Reservar y continuar por WhatsApp";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !catalog?.enabled) return;
    const payload = {
      service_id: service.value, mode: mode.value, starts_at: time.value,
      customer_name: $("name").value.trim(), phone: $("phone").value.replace(/[\s()-]/g, ""),
      address: mode.value === "home" ? $("address").value.trim() : "",
      notes: $("notes").value.trim().slice(0, 300),
    };
    if (!/^\S+\s+\S+/.test(payload.customer_name)) {
      $("name").setCustomValidity("Ingresá tu nombre y apellido.");
    }
    if (!form.reportValidity()) return;
    if ($("date").value < todayInArgentina()) { await loadSlots(); return; }
    if (!slots.some((slot) => slot.starts_at === payload.starts_at)) { await loadSlots(); return; }
    const signature = JSON.stringify(payload);
    if (!request || signature !== request.signature) {
      request = { signature, payload: { ...payload, request_id: crypto.randomUUID() } };
    }
    busy = true;
    const previous = controls().map((control) => [control, control.disabled]);
    previous.forEach(([control]) => { control.disabled = true; });
    form.setAttribute("aria-busy", "true");
    say("Guardando tu reserva…");
    let saved = false;
    try {
      const result = await rpc("create_booking", { p_data: request.payload });
      if (!result?.id || result.status !== "confirmed") throw new Error("El servidor no devolvió un comprobante válido. Reintentá con los mismos datos.");
      saved = true;
      uncertain = false;
      receipt.replaceChildren(node("h3", "Tu reserva está confirmada"));
      const when = argentinaNow(new Date(result.starts_at));
      for (const text of [
        `${result.service_name} · ${modes[result.mode]}`,
        `${formatDate(when.date)} a las ${when.time} (hora de Argentina)`,
        `${price(result.price)} · Hasta las ${argentinaNow(new Date(result.ends_at)).time}`,
        result.mode === "home" ? payload.address : "AVENIDA SAN MARTIN 743",
        `Comprobante: ${result.id}`,
        "Guardá este comprobante. Para cancelar o modificar tu turno, contactanos por WhatsApp.",
      ]) receipt.append(node("p", text));
      const whatsapp = node("a", "Confirmar por WhatsApp");
      const url = new URL(`https://wa.me/${config.whatsappNumber}`);
      url.searchParams.set("text", [
        `Hola ${config.brandName}, quiero confirmar por WhatsApp mi turno registrado.`,
        `Nombre: ${payload.customer_name}`, `Servicio: ${result.service_name}`,
        `Modalidad: ${modes[result.mode]}`, `Precio: ${price(result.price)}`,
        `Fecha: ${formatDate(when.date)}`, `Horario: ${when.time} (hora de Argentina)`,
        result.mode === "home" ? `Domicilio: ${payload.address}\nIncluye barba y perfilado de cejas.` : `Local: ${config.addressText}`,
        `Comprobante: ${result.id}`,
      ].join("\n"));
      whatsapp.href = url.href;
      whatsapp.className = "button button-whatsapp";
      receipt.append(whatsapp);
      const again = node("button", "Reservar otro turno");
      again.type = "button";
      again.className = "button";
      again.addEventListener("click", () => {
        receipt.hidden = true;
        form.hidden = false;
        form.reset();
        request = null;
        services();
        calendar.refresh();
        say("");
        focusBookingField(form, "service");
      });
      receipt.append(again);
      form.hidden = true;
      receipt.hidden = false;
      receipt.focus();
      say("");
    } catch (error) {
      uncertain = !error.code || error.code === "NETWORK";
      say(uncertain ? `${error.message} No cambies los datos: volvé a pulsar Reservar y continuar por WhatsApp para recuperar el comprobante sin duplicarla.` : error.message, true);
      if (!uncertain) request = null;
    } finally {
      busy = false;
      form.removeAttribute("aria-busy");
      previous.forEach(([control, disabled]) => { control.disabled = disabled; });
      if (uncertain) {
        // Freeze the intent after an unknown network result. Only the same retry
        // may run until its receipt is recovered; never create a second UUID.
        controls().forEach((control) => { control.disabled = control !== submit; });
      } else if (!saved) await loadSlots();
    }
  });
  async function loadCatalog(background = false) {
    const current = ++catalogSequence;
    if (!background) {
      lookup.disabled = true;
      mode.disabled = true;
      service.disabled = true;
      resetSlots("Cargando servicios…");
    }
    try {
      const next = await rpc("public_catalog");
      if (current !== catalogSequence || busy || uncertain || form.hidden) return;
      if (background && !service.disabled && JSON.stringify(catalog) === JSON.stringify(next)) return;
      catalog = next;
      services();
      if (!catalog.enabled) {
        mode.disabled = service.disabled = lookup.disabled = true;
        availability.textContent = "Las reservas online todavía no están habilitadas. Podés consultar por WhatsApp.";
        return;
      }
      // The same accessible monthly calendar now follows the server's horizon.
      calendar.setHorizon(catalog.horizon_days);
      mode.disabled = false;
      service.disabled = false;
      lookup.disabled = false;
    } catch (error) {
      if (current === catalogSequence && !busy && !uncertain && !form.hidden) {
        mode.disabled = service.disabled = lookup.disabled = true;
        resetSlots(`${error.message} Recargá la página para volver a intentar o contactanos por WhatsApp.`);
      }
    }
  }
  let refreshing = false;
  async function refreshAvailability() {
    if (refreshing || busy || uncertain || document.hidden || form.hidden) return;
    refreshing = true;
    try { await loadCatalog(true); await loadSlots(true); }
    finally { refreshing = false; }
  }
  const refreshTimer = window.setInterval(() => { void refreshAvailability(); }, 15000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void refreshAvailability(); });
  window.addEventListener("focus", () => { void refreshAvailability(); });
  window.addEventListener("pagehide", () => window.clearInterval(refreshTimer));
  window.addEventListener("pageshow", (event) => { if (event.persisted) window.location.reload(); });
  services();
  initBookingVisual(form);
  void loadCatalog();
}
