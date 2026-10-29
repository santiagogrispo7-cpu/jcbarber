import { isConfigured, rpc } from "./supabase.js";

export { isConfigured };

// Catálogo visible aunque la agenda online esté pausada: los precios no deben
// desaparecer del sitio mientras el peluquero no habilita las reservas.
export function fetchSiteCatalog() {
  if (!isConfigured) return Promise.resolve(null);
  return rpc("public_site_catalog");
}

export function fetchBlockedRanges(from, to) {
  if (!isConfigured) return Promise.resolve([]);
  return rpc("public_blocked_ranges", { p_from: from, p_to: to });
}

export function fetchAvailability(serviceId, mode, date) {
  if (!isConfigured || !serviceId) return Promise.resolve([]);
  return rpc("available_slots", {
    p_service: serviceId,
    p_mode: mode,
    p_date: date,
  });
}
