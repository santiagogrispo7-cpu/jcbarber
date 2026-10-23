import { formatDate, isValidDate } from "./date-utils.js";

/** Presentation only: both booking flows retain their own validation/state. */
export function updateBookingPreview({ service, price, date, time, mode }) {
  const values = {
    service: service || "Sin elegir",
    price: price || "—",
    date: isValidDate(date) ? formatDate(date) : "Sin elegir",
    time: time ? `${time} h` : "Sin elegir",
  };
  for (const [key, value] of Object.entries(values)) {
    const element = document.getElementById(`preview-${key}`);
    if (element && element.textContent !== value) element.textContent = value;
  }
  document.querySelectorAll("[data-service-mode]").forEach((offer) => {
    offer.classList.toggle("is-active", offer.dataset.serviceMode === mode);
  });
}
