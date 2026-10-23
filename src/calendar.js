import { config } from "./config.js";
import {
  addDays,
  addMonths,
  argentinaNow,
  bookingRange,
  dateToUTC,
  formatDate,
  formatLongDate,
  isValidDate,
} from "./date-utils.js";

const instances = new WeakMap();
const monthFormatter = new Intl.DateTimeFormat(config.locale, {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});
const weekdays = [
  ["L", "lunes"],
  ["M", "martes"],
  ["X", "miércoles"],
  ["J", "jueves"],
  ["V", "viernes"],
  ["S", "sábado"],
  ["D", "domingo"],
];
const monthOf = (date) => `${date.slice(0, 7)}-01`;
const mondayIndex = (date) => (dateToUTC(date).getUTCDay() + 6) % 7;
const clamp = (date, min, max) => (date < min ? min : date > max ? max : date);

export function initCalendar({ input, root, onSelect = () => {} }) {
  if (instances.has(root)) return instances.get(root);
  const document = root.ownerDocument;
  const window = document.defaultView;
  const id = root.id || `${input.id}-calendar`;
  let range = bookingRange();
  let horizonDays = config.bookingHorizonDays;
  let observedValue = input.value;
  let focusedDate = isValidDate(input.value)
    ? clamp(input.value, range.min, range.max)
    : range.min;
  let visibleMonth = monthOf(focusedDate);
  let timer;
  let destroyed = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const header = element("div", "calendar-header");
  const previous = element("button", "calendar-nav", "‹");
  previous.type = "button";
  previous.setAttribute("aria-label", "Mes anterior");
  const next = element("button", "calendar-nav", "›");
  next.type = "button";
  next.setAttribute("aria-label", "Mes siguiente");
  const title = element("h3", "calendar-title");
  title.id = `${id}-title`;
  title.setAttribute("aria-live", "polite");
  title.setAttribute("aria-atomic", "true");
  header.append(previous, title, next);

  const rangeText = element("p", "calendar-range");
  rangeText.id = `${id}-range`;
  const legend = element("p", "calendar-legend");
  legend.append(element("span", "calendar-legend-today", "Hoy"), element("span", "calendar-legend-selected", "Tu fecha"));
  const instructions = element(
    "p",
    "",
    "Usá las flechas para recorrer los días, Inicio/Fin para la semana y Re Pág/Av Pág para el mes. Elegí con Enter o espacio. El día actual está marcado como hoy y la fecha elegida como seleccionada.",
  );
  instructions.id = `${id}-instructions`;
  const grid = element("div");
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-labelledby", title.id);
  grid.setAttribute("aria-describedby", `${rangeText.id} ${instructions.id}`);
  const selectionStatus = element("p");
  selectionStatus.setAttribute("role", "status");
  selectionStatus.setAttribute("aria-live", "polite");
  selectionStatus.setAttribute("aria-atomic", "true");
  root.replaceChildren(
    header,
    instructions,
    grid,
    legend,
    rangeText,
    selectionStatus,
  );

  function updateRange(now = new Date()) {
    range = bookingRange(now);
    range.max = addDays(range.min, horizonDays);
    input.min = range.min;
    input.max = range.max;
    visibleMonth = clamp(visibleMonth, monthOf(range.min), monthOf(range.max));
    focusedDate = clamp(focusedDate, range.min, range.max);
    if (monthOf(focusedDate) !== visibleMonth) {
      focusedDate = clamp(visibleMonth, range.min, range.max);
    }
  }

  function focusDay() {
    grid.querySelector('button[tabindex="0"]')?.focus();
  }

  function render(moveFocus = false) {
    const hadDayFocus = grid.contains(document.activeElement);
    updateRange();
    const monthLabel = monthFormatter.format(dateToUTC(visibleMonth));
    if (title.textContent !== monthLabel) title.textContent = monthLabel;
    rangeText.textContent = `Desde hoy, ${formatDate(range.min)}, hasta el ${formatDate(range.max)}. Los días anteriores no están disponibles.`;
    previous.disabled = visibleMonth <= monthOf(range.min);
    next.disabled = visibleMonth >= monthOf(range.max);

    const fragment = document.createDocumentFragment();
    const weekdayRow = element("div", "calendar-weekdays");
    weekdayRow.setAttribute("role", "row");
    for (const [short, full] of weekdays) {
      const day = element("span", "", short);
      day.setAttribute("role", "columnheader");
      day.setAttribute("aria-label", full);
      weekdayRow.append(day);
    }
    fragment.append(weekdayRow);

    const firstOffset = mondayIndex(visibleMonth);
    const lastDate = addDays(addMonths(visibleMonth, 1), -1);
    const daysInMonth = Number(lastDate.slice(-2));
    const totalCells = Math.ceil((firstOffset + daysInMonth) / 7) * 7;
    let row;
    for (let index = 0; index < totalCells; index += 1) {
      if (index % 7 === 0) {
        row = element("div", "calendar-days");
        row.setAttribute("role", "row");
        fragment.append(row);
      }
      const cell = element("div");
      cell.setAttribute("role", "gridcell");
      row.append(cell);
      const dayNumber = index - firstOffset + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cell.className = "calendar-empty";
        continue;
      }

      const date = addDays(visibleMonth, dayNumber - 1);
      const selected = date === input.value;
      const today = date === range.min;
      const disabled = date < range.min || date > range.max;
      cell.setAttribute("aria-selected", String(selected));
      const button = element(
        "button",
        "calendar-day",
        String(dayNumber),
      );
      button.type = "button";
      button.dataset.date = date;
      button.disabled = disabled;
      button.tabIndex = !disabled && date === focusedDate ? 0 : -1;
      button.classList.toggle("is-today", today);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute(
        "aria-label",
        `${formatLongDate(date)}${today ? ", hoy" : ""}${selected ? ", seleccionada" : ""}${disabled ? ", fuera del rango permitido" : ""}`,
      );
      if (today) button.setAttribute("aria-current", "date");
      cell.append(button);
    }
    grid.replaceChildren(fragment);
    if (
      moveFocus ||
      hadDayFocus ||
      (document.activeElement === previous && previous.disabled) ||
      (document.activeElement === next && next.disabled)
    )
      focusDay();
  }

  function syncInput() {
    if (destroyed) return;
    const previousMin = range.min;
    updateRange();
    const changed = observedValue !== input.value;
    if (changed) {
      observedValue = input.value;
      if (
        isValidDate(input.value) &&
        input.value >= range.min &&
        input.value <= range.max
      ) {
        focusedDate = input.value;
        visibleMonth = monthOf(input.value);
      }
      selectionStatus.textContent = isValidDate(input.value) && input.value < range.min
        ? "Turnos no disponibles. Elegí una fecha desde hoy."
        : isValidDate(input.value)
        ? `Fecha elegida: ${formatLongDate(input.value)}.`
        : "Sin fecha elegida.";
    }
    render();
    if (changed || previousMin !== range.min) onSelect(input.value);
  }

  function changeMonth(amount) {
    updateRange();
    const targetMonth = addMonths(visibleMonth, amount);
    if (targetMonth < monthOf(range.min) || targetMonth > monthOf(range.max))
      return;
    focusedDate = clamp(addMonths(focusedDate, amount), range.min, range.max);
    visibleMonth = targetMonth;
    render();
  }

  function onPrevious() {
    changeMonth(-1);
  }
  function onNext() {
    changeMonth(1);
  }

  function onClick(event) {
    const button = event.target.closest("button[data-date]");
    if (!button || !grid.contains(button)) return;
    updateRange();
    const date = button.dataset.date;
    if (date < range.min || date > range.max) {
      render();
      return;
    }
    focusedDate = date;
    input.value = date;
    // Both native and visual selection follow the same input-event path.
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  }

  function onKeyDown(event) {
    const button = event.target.closest("button[data-date]");
    if (
      !button ||
      !grid.contains(button) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const date = button.dataset.date;
    let target;
    switch (event.key) {
      case "ArrowLeft":
        target = addDays(date, -1);
        break;
      case "ArrowRight":
        target = addDays(date, 1);
        break;
      case "ArrowUp":
        target = addDays(date, -7);
        break;
      case "ArrowDown":
        target = addDays(date, 7);
        break;
      case "Home":
        target = addDays(date, -mondayIndex(date));
        break;
      case "End":
        target = addDays(date, 6 - mondayIndex(date));
        break;
      case "PageUp":
        target = addMonths(date, -1);
        break;
      case "PageDown":
        target = addMonths(date, 1);
        break;
      default:
        return; // Native buttons handle Enter and Space.
    }
    event.preventDefault();
    updateRange();
    focusedDate = clamp(target, range.min, range.max);
    visibleMonth = monthOf(focusedDate);
    render(true);
  }

  function onFocusIn(event) {
    const button = event.target.closest("button[data-date]");
    if (!button || !grid.contains(button)) return;
    focusedDate = button.dataset.date;
    for (const day of grid.querySelectorAll("button[data-date]")) {
      day.tabIndex = day === button ? 0 : -1;
    }
  }

  function scheduleMidnight() {
    window.clearTimeout(timer);
    const now = new Date();
    const { hour, minute, second } = argentinaNow(now);
    const delay =
      ((24 - hour) * 3600 - minute * 60 - second) * 1000 -
      now.getMilliseconds() +
      20;
    timer = window.setTimeout(() => {
      syncInput();
      scheduleMidnight();
    }, delay);
  }

  function onWake() {
    if (document.visibilityState === "hidden") return;
    syncInput();
    scheduleMidnight();
  }

  input.addEventListener("input", syncInput);
  input.addEventListener("change", syncInput);
  previous.addEventListener("click", onPrevious);
  next.addEventListener("click", onNext);
  grid.addEventListener("click", onClick);
  grid.addEventListener("keydown", onKeyDown);
  grid.addEventListener("focusin", onFocusIn);
  window.addEventListener("focus", onWake);
  document.addEventListener("visibilitychange", onWake);
  render();
  scheduleMidnight();

  const api = {
    setHorizon(days) {
      if (!Number.isInteger(days) || days < 1 || days > 366) return;
      horizonDays = days;
      render();
    },
    refresh: syncInput,
    destroy() {
      destroyed = true;
      window.clearTimeout(timer);
      input.removeEventListener("input", syncInput);
      input.removeEventListener("change", syncInput);
      previous.removeEventListener("click", onPrevious);
      next.removeEventListener("click", onNext);
      grid.removeEventListener("click", onClick);
      grid.removeEventListener("keydown", onKeyDown);
      grid.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
      instances.delete(root);
    },
  };
  instances.set(root, api);
  return api;
}
