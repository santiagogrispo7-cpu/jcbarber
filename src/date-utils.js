import { config } from "./config.js";

const argentinaClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: config.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const longDateFormatter = new Intl.DateTimeFormat(config.locale, {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const bookingFields = Object.freeze([
  "name",
  "date",
  "time",
  "address",
  "comments",
]);

export const textLimits = Object.freeze({
  name: Object.freeze({ min: 2, max: 80 }),
  address: Object.freeze({ min: 5, max: 180 }),
  comments: Object.freeze({ min: 0, max: 300 }),
});

/** UTC is only a container for civil-date arithmetic, never the visitor's zone. */
function civilDate(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function isValidDate(isoDate) {
  if (typeof isoDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate))
    return false;
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = civilDate(year, month, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function dateToUTC(isoDate) {
  if (!isValidDate(isoDate)) throw new RangeError("Fecha civil inválida.");
  return civilDate(...isoDate.split("-").map(Number));
}

function toISO(date) {
  const year = date.getUTCFullYear();
  if (year < 1 || year > 9999)
    throw new RangeError("Fecha fuera del rango representable.");
  return `${String(year).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(isoDate, amount) {
  if (!Number.isInteger(amount))
    throw new TypeError("La cantidad de días debe ser entera.");
  const date = dateToUTC(isoDate);
  date.setUTCDate(date.getUTCDate() + amount);
  if (Number.isNaN(date.getTime()))
    throw new RangeError("Fecha fuera del rango representable.");
  return toISO(date);
}

/** Preserve the day when possible; Jan 31 + one month becomes Feb 28/29. */
export function addMonths(isoDate, amount) {
  if (!Number.isInteger(amount))
    throw new TypeError("La cantidad de meses debe ser entera.");
  const date = dateToUTC(isoDate);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  if (Number.isNaN(date.getTime()))
    throw new RangeError("Fecha fuera del rango representable.");
  const lastDay = civilDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 2,
    0,
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return toISO(date);
}

export function argentinaNow(now = new Date()) {
  const parts = Object.fromEntries(
    argentinaClock
      .formatToParts(now)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function todayInArgentina(now = new Date()) {
  return argentinaNow(now).date;
}

export function bookingRange(now = new Date()) {
  const min = todayInArgentina(now);
  return { min, max: addDays(min, config.bookingHorizonDays) };
}

export function formatDate(isoDate) {
  if (!isValidDate(isoDate)) throw new RangeError("Fecha civil inválida.");
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function formatLongDate(isoDate) {
  return longDateFormatter.format(dateToUTC(isoDate));
}

export function isValidTime(time) {
  return typeof time === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function normalizeBooking(data = {}) {
  return Object.fromEntries(
    bookingFields.map((field) => {
      const value = typeof data?.[field] === "string" ? data[field] : "";
      return [
        field,
        field === "date" || field === "time" ? value : value.trim(),
      ];
    }),
  );
}

/** Returns field errors without changing the supplied data or consulting the DOM. */
export function validateBooking(data, now = new Date()) {
  const values = normalizeBooking(data);
  const errors = {};
  const labels = {
    name: "El nombre",
    address: "La dirección",
    comments: "Los comentarios",
  };

  for (const [field, { min, max }] of Object.entries(textLimits)) {
    if (values[field].length < min) {
      errors[field] = `${labels[field]} debe tener al menos ${min} caracteres.`;
    } else if (values[field].length > max) {
      errors[field] =
        `${labels[field]} no ${field === "comments" ? "pueden" : "puede"} superar los ${max} caracteres.`;
    }
  }

  const current = argentinaNow(now);
  const lastDate = addDays(current.date, config.bookingHorizonDays);
  if (!isValidDate(values.date)) {
    errors.date = "Elegí una fecha válida.";
  } else if (values.date < current.date || values.date > lastDate) {
    errors.date = `Elegí una fecha entre el ${formatDate(current.date)} y el ${formatDate(lastDate)}.`;
  }

  if (!isValidTime(values.time)) {
    errors.time =
      "Ingresá una hora válida en formato HH:mm (de 00:00 a 23:59).";
  } else if (values.date === current.date && values.time <= current.time) {
    errors.time =
      "Para hoy, elegí una hora posterior a la actual en Argentina.";
  }

  return errors;
}
