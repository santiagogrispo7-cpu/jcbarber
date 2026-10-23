import test from "node:test";
import assert from "node:assert/strict";
import { requestedSlots } from "../../src/services.js";
import { buildWhatsAppMessage } from "../../src/whatsapp.js";

const now = new Date("2026-10-21T11:00:00Z"); // 08:00 Argentina
test("local: bloques completos de 30 minutos y pausa al mediodía", () => {
  const slots = requestedSlots("local", "2026-10-22", now);
  assert.deepEqual(slots.map((slot) => slot.time), ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"]);
  assert.equal(slots[6].end, "12:30");
  assert.equal(slots.at(-1).end, "20:30");
});
test("domicilio: bloques de 45 minutos sin sobrepasar cierres", () => {
  const slots = requestedSlots("home", "2026-10-22", now);
  assert.deepEqual(slots.map((slot) => slot.time), ["09:00", "09:45", "10:30", "11:15", "16:30", "17:15", "18:00", "18:45", "19:30"]);
  assert.equal(slots[3].end, "12:00");
  assert.equal(slots.at(-1).end, "20:15");
});
test("rechaza fechas pasadas, inválidas, fuera de rango y horas vencidas", () => {
  for (const date of ["2026-10-20", "2026-02-30", "", "2027-02-01"]) assert.deepEqual(requestedSlots("local", date, now), []);
  assert.deepEqual(requestedSlots("", "2026-10-22", now), []);
  assert.equal(requestedSlots("local", "2026-10-21", new Date("2026-10-21T12:00:00Z"))[0].time, "09:30");
  assert.deepEqual(requestedSlots("home", "2026-10-21", new Date("2026-10-21T23:31:00Z")), []);
  assert.deepEqual(requestedSlots("local", "2026-10-21", new Date("2026-10-22T03:00:00Z")), []);
});
test("WhatsApp local incluye servicio y precio, sin datos de domicilio residuales", () => {
  const message = buildWhatsAppMessage({ service: "beard", name: "Ana Prueba", date: "2026-10-22", time: "09:00", address: "Domicilio anterior 123" });
  assert.match(message, /Servicio: Barba/);
  assert.match(message, /10\.000/);
  assert.match(message, /10 minutos/);
  assert.match(message, /Local: AVENIDA SAN MARTIN 743, Baradero/);
  assert.doesNotMatch(message, /Domicilio anterior|Domicilio:|Localidad:|Comentarios:/);
});
test("WhatsApp domicilio usa $30.000 e incluye barba y perfilado de cejas", () => {
  const message = buildWhatsAppMessage({ service: "home", name: "Ana Prueba", date: "2026-10-22", time: "09:00", address: "Calle de Prueba 123, Baradero" });
  assert.match(message, /Servicio: Corte a domicilio/);
  assert.match(message, /Precio: \$\s?30\.000/);
  assert.match(message, /45 minutos/);
  assert.match(message, /Incluye barba y perfilado de cejas\./);
  assert.match(message, /Domicilio: Calle de Prueba 123, Baradero/);
  assert.doesNotMatch(message, /20\.000|Local:/);
});
