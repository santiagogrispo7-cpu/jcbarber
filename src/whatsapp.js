import { config } from "./config.js";
import { formatDate, normalizeBooking } from "./date-utils.js";
import { formatPrice, serviceById } from "./services.js";

export function buildWhatsAppMessage(data) {
  const values = normalizeBooking(data);
  const selected = serviceById(data.service);
  const lines = [
    `Hola ${config.brandName}, quiero solicitar un turno para ${selected ? selected.name.toLocaleLowerCase(config.locale) : `un ${config.service.toLocaleLowerCase(config.locale)}`}.`,
    `Nombre: ${values.name}`,
    `Fecha preferida: ${formatDate(values.date)}`,
    `Hora preferida: ${values.time} (hora de Argentina)`,
  ];
  if (typeof data.phone === "string" && data.phone.trim()) {
    lines.push(`Teléfono: ${data.phone.trim()}`);
  }
  if (selected) {
    lines.push(`Servicio: ${selected.name}`, `Precio: ${formatPrice(selected.price)}`, `Duración: ${selected.duration} minutos`, `Modalidad: ${selected.mode === "home" ? "A domicilio" : "En el local"}`);
    if (selected.description) lines.push(selected.description);
  }
  if (!selected || selected.mode === "home") lines.push(`Domicilio: ${values.address}`);
  else lines.push(`Local: ${config.addressText}, ${config.addressCity}`);
  if (values.comments) lines.push(`Comentarios: ${values.comments}`);
  lines.push("Quedo a la espera de confirmar disponibilidad. ¡Gracias!");
  return lines.join("\n");
}

export function buildWhatsAppUrl(data) {
  const url = new URL(`https://wa.me/${config.whatsappNumber}`);
  url.searchParams.set("text", buildWhatsAppMessage(data));
  return url.href;
}
