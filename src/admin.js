import { config } from "./config.js";
import {
  addDays, argentinaNow, dateToUTC, formatDate, formatLongDate,
  isValidDate, isValidTime, todayInArgentina,
} from "./date-utils.js";
import {
  isConfigured, rpc, signIn, signOut, getSession, onAuthChange,
  requestPasswordReset, takeEmailLink, acceptEmailLink, updatePassword,
} from "./booking-api.js";

const MODES = Object.freeze({ local: "Local", home: "Domicilio" });
const STATUSES = Object.freeze({
  confirmed: "Confirmado", completed: "Completado",
  cancelled: "Cancelado", no_show: "No asistió",
});
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SETTING_FIELDS = [
  ["break_minutes", "Descanso entre turnos (minutos)", 0],
  ["travel_before_minutes", "Traslado antes del domicilio (minutos)", 0],
  ["travel_after_minutes", "Traslado después del domicilio (minutos)", 0],
  ["slot_step_minutes", "Intervalo entre inicios ofrecidos (minutos)", 1],
  ["horizon_days", "Anticipación máxima de reservas (días)", 1],
];
const priceFormatter = new Intl.NumberFormat(config.locale, { style: "currency", currency: "ARS" });

/** Civil-date arithmetic never uses the device's local timezone. */
export function startOfWeek(date) {
  return addDays(date, -((dateToUTC(date).getUTCDay() + 6) % 7));
}

/** datetime-local is Buenos Aires wall time, explicitly UTC-03, not device time. */
export function buenosAiresISO(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Ingresá una fecha y hora completas de Buenos Aires.");
  }
  const [date, time] = value.split("T");
  if (!isValidDate(date) || !isValidTime(time)) throw new Error("La fecha o la hora no es válida.");
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

export function wholeDayBlock(first, last) {
  if (!isValidDate(first) || !isValidDate(last) || last < first) {
    throw new Error("El último día libre debe ser igual o posterior al primero.");
  }
  return {
    starts_at: buenosAiresISO(`${first}T00:00`),
    ends_at: buenosAiresISO(`${addDays(last, 1)}T00:00`),
  };
}

export function calendarRange(date, view) {
  const from = view === "week" ? startOfWeek(date) : date;
  if (!isValidDate(from)) throw new Error("Elegí una fecha válida para la agenda.");
  return { from, to: view === "week" ? addDays(from, 6) : from };
}

export function snapshotRange(date, view, today = todayInArgentina()) {
  const visible = calendarRange(date, view);
  const weekStart = startOfWeek(today);
  return {
    from: [visible.from, weekStart, today].sort()[0],
    to: [visible.to, addDays(weekStart, 6), today].sort().at(-1),
  };
}

function price(value) {
  return value == null || value === "" ? "Precio sin configurar" : priceFormatter.format(Number(value));
}
function clock(instant) { return argentinaNow(new Date(instant)).time; }
function civil(instant) { return argentinaNow(new Date(instant)).date; }
function when(instant) { return `${formatDate(civil(instant))}, ${clock(instant)}`; }
function interval(start, end) {
  return civil(start) === civil(end) ? `${clock(start)}–${clock(end)}` : `${when(start)} a ${when(end)}`;
}
function chronological(a, b) { return new Date(a.starts_at) - new Date(b.starts_at); }
function daysIn(range) {
  const result = [];
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) result.push(day);
  return result;
}
function overlapsDay(start, end, day) {
  const bounds = wholeDayBlock(day, day);
  return new Date(start) < new Date(bounds.ends_at) && new Date(end) > new Date(bounds.starts_at);
}
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
function button(text, action) {
  const node = el("button", text, "admin-button");
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}
function option(value, text) {
  const node = el("option", text);
  node.value = value;
  return node;
}
function setOptions(select, values, placeholder, previous = select.value) {
  select.replaceChildren(option("", placeholder), ...values.map(([value, text]) => option(value, text)));
  select.value = values.some(([value]) => value === previous) ? previous : "";
}
function field(label, id, type = "text", value = null) {
  const wrapper = el("label", label, "admin-field");
  wrapper.htmlFor = id;
  const input = el(type === "select" ? "select" : "input");
  input.id = id;
  if (type !== "select") input.type = type;
  input.value = value == null ? "" : String(value);
  wrapper.append(input);
  return { wrapper, input };
}
function check(label, id, checked) {
  const wrapper = el("label", null, "admin-check");
  const input = el("input");
  input.id = id;
  input.type = "checkbox";
  input.checked = Boolean(checked);
  wrapper.htmlFor = id;
  wrapper.append(input, el("span", label));
  return { wrapper, input };
}
function nullableNumber(input) { return input.value.trim() === "" ? null : Number(input.value); }
function emptyList(list, message) { list.replaceChildren(el("li", message, "admin-empty")); }

export function initAdmin() {
  const $ = (id) => document.getElementById(id);
  if (!$("admin-private") || $("admin-private").dataset.initialized) return;
  $("admin-private").dataset.initialized = "true";
  const state = {
    snapshot: null, loadedRange: null, authorized: false, hasSession: false,
    userId: null, epoch: 0, snapshotSeq: 0, calendarSeq: 0,
    slots: new Map(), selectedId: null, bookingTrigger: null, busy: false, busyControls: null, configDirty: false,
    settingsInputs: new Map(), serviceRows: [], hourRows: [],
    manualPicker: null, reschedulePicker: null, request: null,
  };
  let accessPromise = null;
  let authenticating = false;
  let signingOut = false;
  let authSequence = 0;
  let unsubscribe = () => {};
  let emailLink = takeEmailLink();
  let passwordFlow = Boolean(emailLink);
  let passwordSession = false;

  function notice(message = "", error = false) {
    $("admin-status").textContent = error ? "" : message;
    $("admin-error").textContent = error ? message : "";
    if (error && message) $("admin-error").focus();
  }
  function errorMessage(error) {
    return error?.message || "No se pudo completar la operación. Revisá tu conexión y volvé a intentar.";
  }
  function isCurrent(epoch) { return epoch === state.epoch && state.hasSession; }
  function currentView() {
    const date = $("agenda-date").value;
    if (!isValidDate(date)) throw new Error("Elegí una fecha válida para la agenda.");
    return calendarRange(date, $("agenda-view").value);
  }
  function clearPrivate() {
    if (state.busyControls) {
      state.busyControls.forEach(([node, wasDisabled]) => { if (node.isConnected) node.disabled = wasDisabled; });
    }
    state.busyControls = null;
    state.busy = false;
    accessPromise = null;
    state.epoch += 1;
    state.snapshotSeq += 1;
    state.calendarSeq += 1;
    state.authorized = false;
    state.snapshot = null;
    state.loadedRange = null;
    state.selectedId = null;
    state.bookingTrigger = null;
    state.slots.clear();
    state.configDirty = false;
    state.settingsInputs.clear();
    state.serviceRows = [];
    state.hourRows = [];
    state.request = null;
    state.manualPicker?.invalidate();
    state.reschedulePicker?.invalidate();
    state.manualPicker = null;
    state.reschedulePicker = null;
    $("admin-private").hidden = true;
    $("admin-private").removeAttribute("aria-busy");
    $("booking-editor").hidden = true;
    $("login-panel").hidden = false;
    $("login-password").value = "";
    for (const id of ["upcoming-bookings", "calendar-days", "cancelled-bookings", "booking-detail", "blocks-list", "settings-fields", "services-fields", "hours-fields", "manual-picker", "reschedule-picker", "calendar-service", "calendar-mode"]) {
      $(id).replaceChildren();
    }
    for (const id of ["today-count", "today-label", "next-client", "next-client-detail", "week-count", "week-breakdown", "week-label", "snapshot-range", "booking-enabled", "config-dirty", "calendar-status"]) $(id).textContent = "";
    $("manual-form").reset();
    $("block-form").reset();
    updateBlockKind();
    $("manual-address-field").hidden = true;
    $("manual-address").required = false;
  }
  function lock(message, error = false, sessionEnded = false) {
    clearPrivate();
    if (sessionEnded) {
      state.hasSession = false;
      state.userId = null;
    }
    $("account-tools").hidden = !state.hasSession;
    $("login-fields").disabled = authenticating;
    notice(message, error);
  }

  async function loadSnapshot({ resetConfig = false, announce = true, background = false } = {}) {
    if (!state.hasSession) return false;
    const epoch = state.epoch;
    const seq = ++state.snapshotSeq;
    state.calendarSeq += 1;
    let range;
    try {
      range = snapshotRange($("agenda-date").value, $("agenda-view").value);
      if (announce) notice("Cargando agenda y comprobando permisos…");
      $("admin-private").setAttribute("aria-busy", "true");
      const snapshot = await rpc("admin_snapshot", { p_from: range.from, p_to: range.to });
      if (!isCurrent(epoch) || seq !== state.snapshotSeq) return false;
      if (!snapshot?.settings || !Array.isArray(snapshot.bookings) || !Array.isArray(snapshot.services) || !Array.isArray(snapshot.hours) || !Array.isArray(snapshot.blocks)) {
        throw new Error("El servidor no devolvió una agenda válida. Volvé a intentar la carga.");
      }
      const unchanged = JSON.stringify(state.snapshot) === JSON.stringify(snapshot);
      state.snapshot = snapshot;
      state.loadedRange = range;
      state.authorized = true;
      $("login-panel").hidden = true;
      $("admin-private").hidden = false;
      $("account-tools").hidden = false;
      if (background && unchanged) return true;
      renderDashboard();
      renderBlocks();
      if ((!state.configDirty && !background) || resetConfig) renderConfig();
      syncServiceFilters();
      if (!state.manualPicker) {
        state.manualPicker = createSlotPicker($("manual-picker"), "manual", { onMode: updateAddress });
      }
      if (!background) state.manualPicker.setServices(snapshot.services);
      if (state.selectedId && !background) {
        const booking = snapshot.bookings.find((item) => item.id === state.selectedId);
        if (booking) openBooking(booking, false);
        else closeBooking(false);
      }
      state.slots.clear();
      renderCalendar();
      if (announce) notice("Agenda actualizada. Horarios de Buenos Aires.");
      void loadCalendarSlots();
      return true;
    } catch (error) {
      if (isCurrent(epoch) && seq === state.snapshotSeq) {
        // Even a refresh must fail closed: no stale customer data remains visible.
        lock(`No se pudo autorizar o cargar el panel. ${errorMessage(error)} Usá Actualizar agenda para reintentar o cerrá sesión.`, true);
      }
      return false;
    } finally {
      if (seq === state.snapshotSeq) $("admin-private").removeAttribute("aria-busy");
    }
  }

  async function syncAuth(requireSession = false) {
    if (signingOut || passwordFlow) return;
    const sequence = ++authSequence;
    try {
      const session = await getSession();
      if (sequence !== authSequence) return;
      if (!session) {
        if (requireSession) lock("No se pudo obtener una sesión válida. Volvé a ingresar.", true, true);
        else if (!authenticating) lock("Ingresá con tu cuenta de administración.", false, true);
        return;
      }
      const userId = session.user?.id ?? null;
      if (state.hasSession && userId !== state.userId) clearPrivate();
      state.hasSession = true;
      state.userId = userId;
      $("account-tools").hidden = false;
      if (state.authorized) return;
      if (accessPromise?.epoch === state.epoch) return accessPromise.promise;
      const pending = { epoch: state.epoch, promise: loadSnapshot() };
      accessPromise = pending;
      try { await pending.promise; }
      finally { if (accessPromise === pending) accessPromise = null; }
    } catch (error) {
      if (sequence === authSequence) lock(errorMessage(error), true, true);
    }
  }

  /** A failed mutation/slot lookup rechecks authorization before retaining private UI. */
  async function handlePrivateError(error, epoch) {
    if (!isCurrent(epoch)) return;
    try {
      const range = state.loadedRange || snapshotRange($("agenda-date").value, $("agenda-view").value);
      await rpc("admin_snapshot", { p_from: range.from, p_to: range.to });
      if (isCurrent(epoch)) notice(errorMessage(error), true);
    } catch (accessError) {
      if (isCurrent(epoch)) lock(`No se pudo verificar el acceso. ${errorMessage(accessError)}`, true);
    }
  }

  async function mutate(name, data, success, afterSuccess, resetConfig = false) {
    if (!state.authorized || state.busy) return;
    state.busy = true;
    const epoch = state.epoch;
    const disabled = [...$("admin-private").querySelectorAll("button, input, select, textarea")].map((node) => [node, node.disabled]);
    state.busyControls = disabled;
    disabled.forEach(([node]) => { node.disabled = true; });
    $("admin-private").setAttribute("aria-busy", "true");
    notice("Guardando cambios…");
    try {
      await rpc(name, { p_data: data });
      if (!isCurrent(epoch)) return;
      afterSuccess?.();
      if (await loadSnapshot({ resetConfig, announce: false })) notice(success);
    } catch (error) {
      await handlePrivateError(error, epoch);
    } finally {
      if (state.busyControls === disabled) {
        disabled.forEach(([node, wasDisabled]) => { if (node.isConnected) node.disabled = wasDisabled; });
        // Form resets may have changed which controls should be enabled.
        updateBlockKind();
        state.manualPicker?.syncDisabled();
        state.reschedulePicker?.syncDisabled();
        state.busyControls = null;
        state.busy = false;
        $("admin-private").removeAttribute("aria-busy");
      }
    }
  }

  function bookingSummary(booking, withDate = true) {
    const row = el("li", null, "admin-booking-row");
    const copy = el("div");
    copy.append(el("strong", `${withDate ? when(booking.starts_at) : clock(booking.starts_at)} · ${booking.customer_name}`));
    copy.append(el("p", `${booking.service_name} · ${MODES[booking.mode] || booking.mode} · ${STATUSES[booking.status] || booking.status}`));
    const manage = button("Administrar turno", () => openBooking(booking));
    manage.dataset.bookingId = booking.id;
    manage.setAttribute("aria-label", `Administrar turno de ${booking.customer_name}, ${when(booking.starts_at)}`);
    row.append(copy, manage);
    return row;
  }
  function renderDashboard() {
    const today = todayInArgentina();
    const monday = startOfWeek(today);
    const sunday = addDays(monday, 6);
    const bookings = [...state.snapshot.bookings].sort(chronological);
    const counted = bookings.filter((item) => item.status !== "cancelled");
    const week = counted.filter((item) => civil(item.starts_at) >= monday && civil(item.starts_at) <= sunday);
    const next = bookings.filter((item) => item.status === "confirmed" && new Date(item.ends_at) > new Date());
    $("today-label").textContent = formatLongDate(today);
    $("today-count").textContent = counted.filter((item) => civil(item.starts_at) === today).length;
    $("week-count").textContent = week.length;
    $("week-breakdown").textContent = `${week.filter((item) => item.mode === "local").length} en local · ${week.filter((item) => item.mode === "home").length} a domicilio`;
    $("week-label").textContent = `Lunes a domingo: ${formatDate(monday)} al ${formatDate(sunday)}. Sin cancelados.`;
    $("next-client").textContent = next[0]?.customer_name || "Sin próximos turnos";
    $("next-client-detail").textContent = next[0] ? `${when(next[0].starts_at)} · ${MODES[next[0].mode]} · ${next[0].service_name}` : "No hay turnos confirmados por atender en el período cargado. Podés consultar otras fechas en la agenda.";
    $("snapshot-range").textContent = `Período cargado: ${formatDate(state.loadedRange.from)} al ${formatDate(state.loadedRange.to)}.`;
    $("booking-enabled").textContent = state.snapshot.settings.enabled ? "Reservas públicas habilitadas" : "Reservas públicas pausadas";
    const list = $("upcoming-bookings");
    list.replaceChildren(...next.map((item) => bookingSummary(item)));
    if (!next.length) emptyList(list, "No hay próximos turnos en este período. Consultá otra fecha o creá un turno manual.");
  }

  function syncServiceFilters() {
    const services = state.snapshot.services.filter((service) => service.active && service.id);
    setOptions($("calendar-service"), services.map((service) => [service.id, service.name]), "Elegí un servicio");
    syncCalendarModes();
  }
  function syncCalendarModes() {
    const service = state.snapshot?.services.find((item) => item.id === $("calendar-service").value);
    setOptions($("calendar-mode"), (service?.modes || []).map((mode) => [mode, MODES[mode]]), "Elegí modalidad");
  }
  function invalidateCalendar() {
    state.calendarSeq += 1;
    state.slots.clear();
    $("calendar-status").textContent = "Elegí servicio y modalidad y consultá disponibilidad.";
    if (state.authorized) renderCalendar();
  }
  async function loadCalendarSlots() {
    const service = $("calendar-service").value;
    const mode = $("calendar-mode").value;
    if (!state.authorized || !service || !mode) return;
    const epoch = state.epoch;
    const seq = ++state.calendarSeq;
    state.slots.clear();
    renderCalendar();
    $("calendar-status").textContent = "Consultando horarios disponibles…";
    try {
      const days = daysIn(currentView());
      const results = await Promise.all(days.map(async (date) => {
        const slots = await rpc("available_slots", { p_service: service, p_mode: mode, p_date: date });
        if (!Array.isArray(slots)) throw new Error("No se pudo interpretar la disponibilidad. Volvé a consultar.");
        return [date, [...slots].sort(chronological)];
      }));
      if (!isCurrent(epoch) || seq !== state.calendarSeq) return;
      state.slots = new Map(results);
      renderCalendar();
      const count = results.reduce((sum, [, slots]) => sum + slots.length, 0);
      $("calendar-status").textContent = count ? `${count} horarios disponibles para el servicio y modalidad elegidos. Disponibilidad sujeta a la comprobación al guardar.` : "No hay horarios disponibles para esta selección. Revisá otra fecha o las franjas y tiempos configurados.";
    } catch (error) {
      if (!isCurrent(epoch) || seq !== state.calendarSeq) return;
      $("calendar-status").textContent = `No se pudo consultar disponibilidad. ${errorMessage(error)}`;
      await handlePrivateError(error, epoch);
    }
  }
  function renderCalendar() {
    if (!state.snapshot) return;
    const range = currentView();
    const container = $("calendar-days");
    container.dataset.view = $("agenda-view").value;
    container.replaceChildren();
    for (const day of daysIn(range)) {
      const section = el("section", null, "admin-day");
      section.dataset.date = day;
      const heading = el("h3", `${formatLongDate(day)}${day === todayInArgentina() ? " · Hoy" : ""}`);
      heading.id = `day-${day}`;
      section.setAttribute("aria-labelledby", heading.id);
      const list = el("ol", null, "admin-day-events");
      const events = [];
      for (const booking of state.snapshot.bookings) {
        if (booking.status === "cancelled") continue;
        if (!overlapsDay(booking.occupied_start || booking.starts_at, booking.occupied_end || booking.ends_at, day)) continue;
        events.push({ kind: "booking", starts_at: booking.occupied_start || booking.starts_at, item: booking });
      }
      for (const block of state.snapshot.blocks) {
        if (overlapsDay(block.starts_at, block.ends_at, day)) events.push({ kind: "block", starts_at: block.starts_at, item: block });
      }
      for (const slot of state.slots.get(day) || []) events.push({ kind: "slot", starts_at: slot.starts_at, item: slot });
      events.sort(chronological);
      for (const { kind, item } of events) {
        const row = el("li", null, "admin-event");
        row.dataset.kind = kind;
        if (kind === "booking") {
          row.append(el("h4", `${interval(item.starts_at, item.ends_at)} · ${MODES[item.mode]} · ${STATUSES[item.status]}`));
          row.append(el("p", `${item.customer_name} · ${item.service_name} · ${price(item.price)}`));
          row.append(el("p", `Ocupado: ${interval(item.occupied_start || item.starts_at, item.occupied_end || item.ends_at)} (incluye descanso${item.mode === "home" ? " y traslados" : ""}).`, "admin-hint"));
          const actions = el("div", null, "admin-actions");
          const manage = button("Administrar turno", () => openBooking(item));
          manage.dataset.bookingId = item.id;
          manage.setAttribute("aria-label", `Administrar turno de ${item.customer_name}, ${when(item.starts_at)}`);
          actions.append(manage);
          row.append(actions);
        } else if (kind === "block") {
          row.append(el("h4", `Bloqueo · ${interval(item.starts_at, item.ends_at)}`), el("p", item.reason || "Sin motivo indicado"));
        } else {
          row.append(el("h4", `Disponible · ${interval(item.starts_at, item.ends_at)}`));
          row.append(el("p", `${MODES[$("calendar-mode").value]} · ${item.duration_minutes} minutos · ${price(item.price)}`));
          const choose = button("Usar para turno manual", () => {
            state.manualPicker.choose({ service: $("calendar-service").value, mode: $("calendar-mode").value, date: day, slot: item });
            $("manual-name").focus();
            $("manual-section").scrollIntoView({ block: "start" });
          });
          row.append(choose);
        }
        list.append(row);
      }
      if (!events.length) list.append(el("li", "Sin turnos ni bloqueos. Consultá disponibilidad para ver horarios libres.", "admin-empty"));
      section.append(heading, list);
      container.append(section);
    }
    const cancelled = state.snapshot.bookings.filter((item) => item.status === "cancelled" && civil(item.starts_at) >= range.from && civil(item.starts_at) <= range.to).sort(chronological);
    $("cancelled-bookings").replaceChildren(...cancelled.map((item) => bookingSummary(item)));
    if (!cancelled.length) emptyList($("cancelled-bookings"), "No hay turnos cancelados en los días visibles.");
  }

  function createSlotPicker(root, prefix, { booking = null, onMode = () => {} } = {}) {
    root.replaceChildren();
    let sequence = 0;
    let services = [];
    let slots = [];
    let loading = false;
    const filters = el("div", null, "admin-toolbar");
    const service = field("Servicio", `${prefix}-service`, "select");
    const mode = field("Modalidad", `${prefix}-mode`, "select");
    const date = field("Fecha en Buenos Aires", `${prefix}-date`, "date", booking ? civil(booking.starts_at) : todayInArgentina());
    const selection = field("Horario disponible", `${prefix}-slot`, "select");
    service.input.required = mode.input.required = date.input.required = selection.input.required = true;
    const status = el("p", "Elegí servicio, modalidad y fecha para consultar horarios.", "admin-message");
    status.id = `${prefix}-slot-status`;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    selection.input.setAttribute("aria-describedby", status.id);
    const lookup = button("Consultar horarios", lookupSlots);
    lookup.id = `${prefix}-lookup`;
    filters.append(service.wrapper, mode.wrapper, date.wrapper, lookup);
    root.append(filters, status, selection.wrapper);
    function invalidate() {
      sequence += 1;
      slots = [];
      loading = false;
      setOptions(selection.input, [], "Consultá los horarios");
      selection.input.disabled = true;
      lookup.disabled = false;
      status.textContent = "Consultá horarios para esta selección.";
    }
    function syncModes(previous = mode.input.value) {
      const modes = booking ? [booking.mode] : services.find((item) => item.id === service.input.value)?.modes || [];
      setOptions(mode.input, modes.map((value) => [value, MODES[value]]), "Elegí modalidad", previous);
      if (booking) mode.input.value = booking.mode;
      onMode(mode.input.value);
    }
    function setServices(values) {
      services = values.filter((item) => item.active && item.id);
      const choices = booking ? [[booking.service_id, booking.service_name]] : services.map((item) => [item.id, item.name]);
      setOptions(service.input, choices, "Elegí un servicio", booking?.service_id || service.input.value);
      service.input.disabled = Boolean(booking);
      syncModes();
      mode.input.disabled = Boolean(booking);
      invalidate();
    }
    async function lookupSlots() {
      if (!state.authorized || state.busy) return;
      if (!service.input.value || !mode.input.value || !isValidDate(date.input.value)) {
        status.textContent = "Completá servicio, modalidad y fecha antes de consultar.";
        (!service.input.value ? service.input : !mode.input.value ? mode.input : date.input).focus();
        return;
      }
      invalidate();
      const seq = sequence;
      const epoch = state.epoch;
      loading = true;
      lookup.disabled = true;
      status.textContent = "Cargando horarios disponibles…";
      try {
        const result = await rpc("available_slots", { p_service: service.input.value, p_mode: mode.input.value, p_date: date.input.value });
        if (!isCurrent(epoch) || seq !== sequence) return;
        if (!Array.isArray(result)) throw new Error("El servidor no devolvió horarios válidos.");
        slots = [...result].sort(chronological);
        setOptions(selection.input, slots.map((slot) => [slot.starts_at, `${interval(slot.starts_at, slot.ends_at)} · ${slot.duration_minutes} min · ${price(slot.price)}`]), "Elegí un horario");
        selection.input.disabled = slots.length === 0;
        status.textContent = slots.length ? `${slots.length} horarios disponibles. Elegí uno; se verifica nuevamente al guardar.` : "Sin horarios disponibles. Probá otra fecha o revisá la configuración de franjas y tiempos.";
      } catch (error) {
        if (!isCurrent(epoch) || seq !== sequence) return;
        status.textContent = `No se pudieron cargar los horarios. ${errorMessage(error)}`;
        await handlePrivateError(error, epoch);
      } finally {
        if (seq === sequence) {
          loading = false;
          lookup.disabled = false;
        }
      }
    }
    function value() {
      const slot = slots.find((item) => item.starts_at === selection.input.value);
      if (!slot || civil(slot.starts_at) !== date.input.value || !service.input.value || !mode.input.value) {
        throw new Error("Consultá disponibilidad y elegí un horario antes de guardar.");
      }
      return { service_id: service.input.value, mode: mode.input.value, starts_at: slot.starts_at };
    }
    function choose({ service: serviceId, mode: modeValue, date: day, slot }) {
      service.input.value = serviceId;
      syncModes(modeValue);
      date.input.value = day;
      invalidate();
      slots = [slot];
      setOptions(selection.input, [[slot.starts_at, `${interval(slot.starts_at, slot.ends_at)} · ${slot.duration_minutes} min · ${price(slot.price)}`]], "Elegí un horario", slot.starts_at);
      selection.input.disabled = false;
      status.textContent = "Horario elegido desde la agenda. Se vuelve a comprobar al guardar.";
      onMode(modeValue);
    }
    service.input.addEventListener("change", () => { syncModes(""); invalidate(); });
    mode.input.addEventListener("change", () => { onMode(mode.input.value); invalidate(); });
    date.input.addEventListener("change", invalidate);
    date.input.addEventListener("input", invalidate);
    function syncDisabled() {
      service.input.disabled = Boolean(booking);
      mode.input.disabled = Boolean(booking);
      selection.input.disabled = slots.length === 0;
      lookup.disabled = loading;
    }
    setServices(state.snapshot.services);
    return { setServices, invalidate, value, choose, syncDisabled };
  }
  function updateAddress(mode) {
    $("manual-address-field").hidden = mode !== "home";
    $("manual-address").required = mode === "home";
    if (mode !== "home") $("manual-address").value = "";
  }
  function openBooking(booking, focus = true) {
    // Keep the exact origin element so closing restores focus to it, even when
    // the same booking also appears earlier in the upcoming list.
    if (focus) {
      const active = document.activeElement;
      state.bookingTrigger = active instanceof HTMLElement && active.dataset.bookingId === booking.id ? active : null;
    }
    state.selectedId = booking.id;
    state.reschedulePicker?.invalidate();
    const detail = $("booking-detail");
    detail.replaceChildren(
      el("h3", booking.customer_name),
      el("p", `${booking.service_name} · ${MODES[booking.mode]} · ${STATUSES[booking.status]}`),
      el("p", `${when(booking.starts_at)} a ${when(booking.ends_at)} · ${price(booking.price)}`),
      el("p", `Ocupación guardada: ${when(booking.occupied_start || booking.starts_at)} a ${when(booking.occupied_end || booking.ends_at)}.`),
      el("p", `Teléfono: ${booking.phone || "No informado"}`),
    );
    const digits = String(booking.phone || "").replace(/\D/g, "");
    if (digits) {
      const contact = el("a", "Contactar por WhatsApp");
      contact.href = `https://wa.me/${digits}`;
      contact.target = "_blank";
      contact.rel = "noopener noreferrer";
      detail.append(contact);
    }
    if (booking.mode === "home") detail.append(el("p", `Domicilio: ${booking.address || "No informado"}`));
    if (booking.notes) detail.append(el("p", `Notas: ${booking.notes}`));
    $("booking-status").value = booking.status;
    $("booking-editor").hidden = false;
    state.reschedulePicker = createSlotPicker($("reschedule-picker"), "reschedule", { booking });
    if (focus) {
      $("reschedule-section").open = false;
      $("booking-editor").focus();
      $("booking-editor").scrollIntoView({ block: "start" });
    }
  }
  function closeBooking(focus = true) {
    const id = state.selectedId;
    const stored = state.bookingTrigger;
    state.selectedId = null;
    state.bookingTrigger = null;
    state.reschedulePicker?.invalidate();
    state.reschedulePicker = null;
    $("reschedule-picker").replaceChildren();
    $("booking-detail").replaceChildren();
    $("booking-editor").hidden = true;
    if (focus) {
      const stillOrigin = stored?.isConnected && stored.dataset.bookingId === id
        ? stored
        : [...document.querySelectorAll("[data-booking-id]")].find((node) => node.dataset.bookingId === id);
      (stillOrigin || $("agenda-date")).focus();
    }
  }

  function updateBlockKind() {
    const days = $("block-kind").value === "days";
    $("block-hour-fields").hidden = days;
    $("block-day-fields").hidden = !days;
    for (const id of ["block-start", "block-end"]) { $(id).disabled = days; $(id).required = !days; }
    for (const id of ["block-first-day", "block-last-day"]) { $(id).disabled = !days; $(id).required = days; }
  }
  function renderBlocks() {
    const blocks = [...state.snapshot.blocks].sort(chronological);
    const list = $("blocks-list");
    list.replaceChildren();
    for (const block of blocks) {
      const row = el("li", null, "admin-booking-row");
      const copy = el("div");
      copy.append(el("strong", block.reason || "Bloqueo"), el("p", `${when(block.starts_at)} a ${when(block.ends_at)} (fin exclusivo)`));
      const remove = button("Eliminar bloqueo", () => mutate("admin_block", { action: "delete", id: block.id }, "Bloqueo eliminado. La disponibilidad se actualizó."));
      remove.dataset.blockId = block.id;
      remove.setAttribute("aria-label", `Eliminar bloqueo: ${block.reason || "sin motivo"}, ${when(block.starts_at)}`);
      row.append(copy, remove);
      list.append(row);
    }
    if (!blocks.length) emptyList(list, "No hay bloqueos en el período cargado. Elegí otra fecha en Agenda para consultar bloqueos futuros o anteriores.");
  }

  function markConfigDirty() {
    state.configDirty = true;
    $("config-dirty").textContent = "Tenés cambios sin guardar. Actualizar la agenda conserva este borrador; cerrar o recargar la página lo descarta.";
  }
  function renderConfig() {
    state.configDirty = false;
    $("config-dirty").textContent = "Configuración cargada. Los cambios sólo se aplican al guardar.";
    state.settingsInputs.clear();
    state.serviceRows = [];
    state.hourRows = [];
    const settings = state.snapshot.settings;
    const settingsRoot = $("settings-fields");
    const enabled = check("Habilitar reservas públicas", "settings-enabled", settings.enabled);
    state.settingsInputs.set("enabled", enabled.input);
    const grid = el("div", null, "admin-form-grid");
    for (const [name, label, min] of SETTING_FIELDS) {
      const control = field(label, `settings-${name}`, "number", settings[name]);
      control.input.min = String(min);
      control.input.step = "1";
      state.settingsInputs.set(name, control.input);
      grid.append(control.wrapper);
    }
    settingsRoot.replaceChildren(enabled.wrapper, el("p", `Zona horaria: ${settings.timezone || config.timeZone}. Todos los horarios de este panel corresponden a Buenos Aires.`, "admin-hint"), grid);
    $("services-fields").replaceChildren();
    for (const service of state.snapshot.services) addServiceRow(service);
    if (!state.snapshot.services.length) $("services-fields").append(el("p", "Todavía no hay servicios. Agregá uno y completá sus datos reales.", "admin-empty"));
    $("hours-fields").replaceChildren();
    for (const weekday of [1, 2, 3, 4, 5, 6, 0]) {
      const day = el("section", null, "admin-hours-day");
      const heading = el("h3", WEEKDAYS[weekday]);
      heading.id = `hours-day-${weekday}`;
      day.setAttribute("aria-labelledby", heading.id);
      day.append(heading);
      const hours = state.snapshot.hours.filter((row) => row.weekday === weekday).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)) || a.mode.localeCompare(b.mode));
      for (const hour of hours) {
        const index = state.hourRows.length;
        const row = el("div", null, "admin-hours-row");
        const active = check(`Franja ${hours.indexOf(hour) + 1} habilitada`, `hour-${index}-enabled`, hour.enabled);
        const mode = field("Modalidad", `hour-${index}-mode`, "select");
        mode.input.replaceChildren(...Object.entries(MODES).map(([value, label]) => option(value, label)));
        mode.input.value = hour.mode;
        const start = field("Inicio", `hour-${index}-start`, "time", hour.start_time?.slice(0, 5));
        const end = field("Fin (incluye tiempos)", `hour-${index}-end`, "time", hour.end_time?.slice(0, 5));
        start.input.required = end.input.required = true;
        row.append(active.wrapper, mode.wrapper, start.wrapper, end.wrapper);
        day.append(row);
        state.hourRows.push({ original: hour, enabled: active.input, mode: mode.input, start: start.input, end: end.input });
      }
      if (!hours.length) day.append(el("p", "Sin franjas cargadas por el servidor para este día.", "admin-empty"));
      $("hours-fields").append(day);
    }
  }
  function addServiceRow(service = { id: null, name: "", price: null, duration_minutes: null, modes: [], active: false }) {
    $("services-fields").querySelector(":scope > .admin-empty")?.remove();
    const index = state.serviceRows.length;
    const section = el("section", null, "admin-service");
    const title = el("h3", `Servicio ${index + 1}`);
    title.id = `service-title-${index}`;
    section.setAttribute("aria-labelledby", title.id);
    const grid = el("div", null, "admin-form-grid");
    const name = field("Nombre", `service-${index}-name`, "text", service.name);
    name.input.maxLength = 120;
    name.input.required = true;
    const amount = field("Precio (ARS)", `service-${index}-price`, "number", service.price);
    amount.input.min = "0";
    amount.input.step = "0.01";
    const duration = field("Duración de atención (minutos)", `service-${index}-duration`, "number", service.duration_minutes);
    duration.input.min = "1";
    duration.input.step = "1";
    grid.append(name.wrapper, amount.wrapper, duration.wrapper);
    const toggles = el("div", null, "admin-actions");
    const active = check("Servicio activo", `service-${index}-active`, service.active);
    const local = check("Atención en local", `service-${index}-local`, service.modes?.includes("local"));
    const home = check("Atención a domicilio", `service-${index}-home`, service.modes?.includes("home"));
    toggles.append(active.wrapper, local.wrapper, home.wrapper);
    section.append(title, grid, toggles, el("p", "Desmarcá Servicio activo para dejar de ofrecerlo. Sus reservas anteriores se conservan.", "admin-hint"));
    const row = { original: service, name: name.input, price: amount.input, duration: duration.input, active: active.input, local: local.input, home: home.input, section };
    state.serviceRows.push(row);
    if (!service.id) {
      section.append(button("Quitar servicio sin guardar", () => {
        section.remove();
        // Keep stable input IDs for other unsaved rows.
        row.removed = true;
        markConfigDirty();
      }));
    }
    $("services-fields").append(section);
    return name.input;
  }
  function configData() {
    const settings = { ...state.snapshot.settings };
    settings.enabled = state.settingsInputs.get("enabled").checked;
    for (const [key] of SETTING_FIELDS) settings[key] = nullableNumber(state.settingsInputs.get(key));
    const services = state.serviceRows.filter((row) => !row.removed).map((row) => ({
      id: row.original.id ?? null, name: row.name.value.trim(), price: nullableNumber(row.price),
      duration_minutes: nullableNumber(row.duration), active: row.active.checked,
      modes: [row.local.checked ? "local" : null, row.home.checked ? "home" : null].filter(Boolean),
    }));
    const hours = state.hourRows.map((row) => ({
      id: row.original.id, weekday: row.original.weekday, mode: row.mode.value,
      start_time: row.start.value || null, end_time: row.end.value || null, enabled: row.enabled.checked,
    }));
    if (services.some((service) => !service.name)) throw new Error("Completá el nombre de cada servicio o quitá los servicios nuevos vacíos.");
    // SQL requires 1–2 modes on every saved row, active or draft alike.
    if (services.some((service) => !service.modes.length)) throw new Error("Elegí al menos una modalidad (local o domicilio) en cada servicio.");
    if (hours.some((hour) => hour.enabled && (!hour.start_time || !hour.end_time || hour.start_time >= hour.end_time))) {
      throw new Error("Revisá las franjas habilitadas: el inicio debe ser anterior al fin del mismo día.");
    }
    if (settings.enabled) {
      if (SETTING_FIELDS.some(([key]) => settings[key] == null)) throw new Error("Antes de habilitar reservas, completá descanso, ambos traslados, intervalo y anticipación. Usá cero sólo cuando corresponda.");
      const active = services.filter((service) => service.active);
      if (!active.length || active.some((service) => service.price == null || service.duration_minutes == null || !service.modes.length)) {
        throw new Error("Para habilitar reservas necesitás al menos un servicio activo. Completá precio, duración y modalidades de cada servicio activo.");
      }
      if (!hours.some((hour) => hour.enabled)) throw new Error("Habilitá al menos una franja de atención antes de activar las reservas públicas.");
    }
    return { settings, services, hours };
  }

  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isConfigured) { notice("Falta configurar Supabase. Seguí docs/RESERVAS.md y reiniciá el servidor o reconstruí el despliegue.", true); return; }
    if (authenticating) return;
    signingOut = false;
    authenticating = true;
    $("login-fields").disabled = true;
    notice("Ingresando y comprobando acceso de administración…");
    let password = $("login-password").value;
    $("login-password").value = "";
    try {
      await signIn($("login-email").value.trim(), password);
      password = "";
      await syncAuth(true);
    } catch (error) {
      lock(errorMessage(error), true, true);
    } finally {
      password = "";
      $("login-password").value = "";
      authenticating = false;
      $("login-fields").disabled = false;
    }
  });
  $("signout").addEventListener("click", async () => {
    signingOut = true;
    authSequence += 1;
    lock("Cerrando sesión…", false, true);
    $("login-fields").disabled = true;
    try { await signOut(); notice("Sesión cerrada. Los datos del panel se limpiaron."); }
    catch (error) { notice(`El panel se cerró. ${errorMessage(error)} Recargá la página para descartar la sesión en memoria.`, true); }
    finally { $("login-fields").disabled = false; }
    $("login-email").focus();
  });
  $("recovery-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("recovery-submit").disabled = true;
    try {
      await requestPasswordReset($("recovery-email").value.trim());
      notice("Si el correo tiene una cuenta, recibirá un enlace para recuperar el acceso. Revisá también spam.");
    } catch (error) { notice(errorMessage(error), true); }
    finally { $("recovery-submit").disabled = false; }
  });
  $("confirm-password").addEventListener("input", () => $("confirm-password").setCustomValidity(""));
  $("new-password").addEventListener("input", () => $("confirm-password").setCustomValidity(""));
  $("password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if ($("new-password").value !== $("confirm-password").value) {
      $("confirm-password").setCustomValidity("Las contraseñas no coinciden.");
      $("confirm-password").reportValidity();
      return;
    }
    $("password-submit").disabled = true;
    try {
      if (!passwordSession) {
        if (!emailLink || emailLink.error) throw new Error("Solicitá un enlace nuevo.");
        await acceptEmailLink(emailLink);
        passwordSession = true;
        emailLink = null;
      }
      await updatePassword($("new-password").value);
      await signOut();
      passwordFlow = false;
      passwordSession = false;
      $("password-panel").hidden = true;
      lock("Contraseña guardada. Ingresá con tu correo y la nueva contraseña.", false, true);
      $("login-email").focus();
    } catch (error) { notice(errorMessage(error), true); }
    finally { $("password-form").reset(); $("password-submit").disabled = false; }
  });
  $("confirm-handover").addEventListener("click", () => {
    void mutate("admin_confirm_handover", {}, "Acceso del destinatario comprobado. El responsable ya puede finalizar la transferencia desde Supabase.");
  });
  $("refresh-admin").addEventListener("click", () => { if (!state.busy) void loadSnapshot(); });
  async function changeCalendar() {
    if (state.busy || !state.hasSession) return;
    if (!$("agenda-date").reportValidity()) return;
    invalidateCalendar();
    await loadSnapshot();
  }
  $("agenda-date").value = todayInArgentina();
  $("agenda-date").addEventListener("change", changeCalendar);
  $("agenda-view").addEventListener("change", changeCalendar);
  for (const [id, direction] of [["agenda-previous", -1], ["agenda-next", 1]]) {
    $(id).addEventListener("click", () => {
      if (!isValidDate($("agenda-date").value)) return;
      $("agenda-date").value = addDays($("agenda-date").value, direction * ($("agenda-view").value === "week" ? 7 : 1));
      void changeCalendar();
    });
  }
  $("agenda-today").addEventListener("click", () => { $("agenda-date").value = todayInArgentina(); void changeCalendar(); });
  $("calendar-service").addEventListener("change", () => { syncCalendarModes(); invalidateCalendar(); });
  $("calendar-mode").addEventListener("change", invalidateCalendar);
  $("calendar-filter").addEventListener("submit", (event) => { event.preventDefault(); void loadCalendarSlots(); });
  $("close-editor").addEventListener("click", () => closeBooking());
  $("booking-status-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.selectedId) return;
    void mutate("admin_booking", { action: "update", id: state.selectedId, status: $("booking-status").value }, "Estado del turno actualizado.");
  });
  $("reschedule-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      if (!state.selectedId || !state.reschedulePicker) return;
      const { starts_at } = state.reschedulePicker.value();
      void mutate("admin_booking", { action: "update", id: state.selectedId, starts_at }, "Turno reprogramado. La agenda se actualizó.");
    } catch (error) { notice(errorMessage(error), true); }
  });
  $("manual-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      if (!state.manualPicker) return;
      const selected = state.manualPicker.value();
      const data = {
        action: "create", ...selected, customer_name: $("manual-name").value.trim(),
        phone: $("manual-phone").value.replace(/[\s()-]/g, ""), address: selected.mode === "home" ? $("manual-address").value.trim() : null,
        notes: $("manual-notes").value.trim() || null,
      };
      if (data.customer_name.length < 2 || !/\d{6,}/.test(data.phone.replace(/\D/g, "")) || (data.mode === "home" && !data.address)) {
        throw new Error("Revisá nombre, teléfono con código de país y dirección para atención a domicilio.");
      }
      // Reuse the request UUID only for an identical retry (e.g. lost response).
      const fingerprint = JSON.stringify(data);
      if (state.request?.fingerprint !== fingerprint) state.request = { fingerprint, id: crypto.randomUUID() };
      data.request_id = state.request.id;
      void mutate("admin_booking", data, "Turno creado y confirmado. Ya aparece en la agenda de su fecha.", () => {
        state.request = null;
        $("agenda-date").value = civil(data.starts_at);
        $("manual-form").reset();
        state.manualPicker.invalidate();
        updateAddress("");
      });
    } catch (error) { notice(errorMessage(error), true); }
  });
  $("block-kind").addEventListener("change", updateBlockKind);
  $("block-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const range = $("block-kind").value === "days" ? wholeDayBlock($("block-first-day").value, $("block-last-day").value) : {
        starts_at: buenosAiresISO($("block-start").value), ends_at: buenosAiresISO($("block-end").value),
      };
      if (new Date(range.ends_at) <= new Date(range.starts_at)) throw new Error("El fin del bloqueo debe ser posterior al inicio.");
      const reason = $("block-reason").value.trim();
      if (!reason) throw new Error("Completá el motivo del bloqueo.");
      void mutate("admin_block", { action: "create", ...range, reason }, "Bloqueo creado. Los horarios afectados ya no están disponibles.", () => {
        $("agenda-date").value = civil(range.starts_at);
        $("block-form").reset();
        updateBlockKind();
      });
    } catch (error) { notice(errorMessage(error), true); }
  });
  $("config-form").addEventListener("input", markConfigDirty);
  $("config-form").addEventListener("change", markConfigDirty);
  $("add-service").addEventListener("click", () => { addServiceRow().focus(); markConfigDirty(); });
  $("config-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try { void mutate("admin_save_config", configData(), "Configuración guardada. Las reservas existentes conservan sus datos.", null, true); }
    catch (error) { notice(errorMessage(error), true); }
  });
  async function autoRefresh() {
    if (!state.authorized || state.busy || document.hidden || $("admin-private").getAttribute("aria-busy") === "true") return;
    await loadSnapshot({ announce: false, background: true });
  }
  const refreshTimer = window.setInterval(() => { void autoRefresh(); }, 15000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void autoRefresh(); });
  window.addEventListener("focus", () => { void autoRefresh(); });
  window.addEventListener("pagehide", () => {
    // Clear sensitive DOM before a potential back/forward cache restore.
    unsubscribe();
    window.clearInterval(refreshTimer);
    emailLink = null;
    $("password-form").reset();
    authSequence += 1;
    clearPrivate();
    state.hasSession = false;
  });
  window.addEventListener("pageshow", (event) => { if (event.persisted) window.location.reload(); });

  if (!isConfigured) {
    lock("La conexión de reservas todavía no está configurada. El responsable del sistema debe completar la configuración de Supabase para habilitar el acceso.", false, true);
  } else {
    $("login-fields").disabled = false;
    unsubscribe = onAuthChange(() => { void syncAuth(); });
    void syncAuth();
  }
  if (emailLink) {
    $("login-panel").hidden = true;
    $("password-panel").hidden = false;
    $("password-submit").disabled = Boolean(emailLink.error) || !isConfigured;
    notice(emailLink.error || "Elegí tu contraseña para completar la recuperación o invitación.", Boolean(emailLink.error));
  }
}

if (typeof document !== "undefined") initAdmin();
