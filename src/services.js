import { argentinaNow, bookingRange, isValidDate } from "./date-utils.js";

export const services = Object.freeze([
  { id: "general", name: "Corte general", mode: "local", price: 18000, duration: 30, description: "Corte de pelo tradicional" },
  { id: "beard", name: "Barba", mode: "local", price: 10000, duration: 10, description: "Arreglo y perfilado de barba" },
  { id: "brows", name: "Perfilado de cejas", mode: "local", price: 8000, duration: 5, description: "Diseño y perfilado de cejas" },
  { id: "home", name: "Corte a domicilio", mode: "home", price: 30000, duration: 45, description: "Incluye barba y perfilado de cejas." },
]);
export const formatPrice = (value) => new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", maximumFractionDigits: 0,
}).format(value);
export const serviceById = (id) => services.find((service) => service.id === id);
const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function requestedSlots(mode, date, now = new Date()) {
  const { min, max } = bookingRange(now);
  if (!["local", "home"].includes(mode) || !isValidDate(date) || date < min || date > max) return [];
  const duration = mode === "local" ? 30 : 45;
  const current = argentinaNow(now);
  const slots = [];
  for (const [start, end] of [[9 * 60, 12 * 60 + 30], [16 * 60 + 30, 20 * 60 + 30]]) {
    for (let minute = start; minute + duration <= end; minute += duration) {
      if (date === current.date && clock(minute) <= current.time) continue;
      slots.push({ time: clock(minute), end: clock(minute + duration) });
    }
  }
  return slots;
}
