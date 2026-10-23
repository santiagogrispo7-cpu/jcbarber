import { config } from "./config.js";
import { initBooking } from "./booking.js";
import { isConfigured } from "./booking-api.js";
import { initOnlineBooking } from "./online-booking.js";
import "./online-booking.css";

document.querySelectorAll("[data-whatsapp]").forEach((link) => {
  link.href = `https://wa.me/${config.whatsappNumber}`;
});
document.querySelectorAll("[data-instagram]").forEach((link) => {
  link.href = config.instagramUrl;
});
document.querySelectorAll("[data-tiktok]").forEach((link) => {
  link.href = config.tiktokUrl;
});
document.querySelectorAll("[data-phone]").forEach((node) => {
  node.textContent = config.whatsappDisplay;
});
document.querySelectorAll("[data-address]").forEach((node) => {
  node.textContent = config.addressText;
});
document.querySelectorAll("[data-city]").forEach((node) => {
  node.textContent = config.addressCity;
});
document.querySelectorAll("[data-maps]").forEach((link) => {
  link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${config.addressText}, ${config.addressCity}`)}`;
});
document.getElementById("year").textContent = new Intl.DateTimeFormat("en", {
  year: "numeric",
  timeZone: config.timeZone,
}).format(new Date());

const menuButton = document.querySelector(".menu-toggle");
const nav = document.getElementById("main-nav");
menuButton.hidden = false;
nav.classList.add("is-enhanced");
function closeMenu(returnFocus = false) {
  menuButton.setAttribute("aria-expanded", "false");
  nav.classList.remove("is-open");
  if (returnFocus) menuButton.focus();
}
menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  nav.classList.toggle("is-open", open);
});
nav.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && nav.classList.contains("is-open"))
    closeMenu(true);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-header")) closeMenu();
});
matchMedia("(min-width: 761px)").addEventListener("change", () => closeMenu());

const dialog = document.getElementById("photo-dialog");
const fullPhoto = document.getElementById("photo-full");
let photoOpener;
document.querySelectorAll(".gallery-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      typeof dialog.showModal !== "function"
    )
      return;
    event.preventDefault();
    photoOpener = link;
    fullPhoto.src = link.href;
    fullPhoto.alt = link.querySelector("img").alt;
    document.getElementById("photo-caption").textContent = link.dataset.caption;
    dialog.showModal();
    document.body.classList.add("dialog-open");
  });
});
dialog
  .querySelector(".dialog-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  const box = dialog.getBoundingClientRect();
  if (
    event.target === dialog &&
    (event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom)
  )
    dialog.close();
});
dialog.addEventListener("close", () => {
  document.body.classList.remove("dialog-open");
  photoOpener?.focus();
});

if (isConfigured && location.protocol !== "file:") {
  document.getElementById("online-availability").hidden = false;
  initOnlineBooking();
} else {
  // Preserve the working WhatsApp flow until the real backend is configured.
  initBooking();
}
