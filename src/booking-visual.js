/* Service cards mirror the native selects that own reservation state.
   The calendar owns the date; the visible native select owns the time. */

export function focusBookingField(form, id) {
  const calendarControl = () => form.querySelector('#calendar button[tabindex="0"]:not(:disabled)')
    || form.querySelector("#calendar button:not(:disabled)");
  const control = id === "service" || id === "booking-service" || id === "booking-mode"
    ? form.querySelector('#service-cards .service-card[aria-pressed="true"]:not(:disabled)')
      || form.querySelector("#service-cards .service-card:not(:disabled)")
    : id === "date" ? calendarControl() : form.querySelector(`#${id}`);
  (control?.disabled ? calendarControl() : control)?.focus();
}

export function initBookingVisual(form) {
  if (!form || form.dataset.visualBooking === "true") return;
  form.dataset.visualBooking = "true";

  const serviceCards = form.querySelector("#service-cards");
  let serviceSignature = "";
  let frame = 0;
  const modeSelect = () => form.querySelector("#booking-mode");
  const serviceSelect = () => form.querySelector("#booking-service");

  function commit(select, value) {
    if (!select || select.disabled || select.value === value) return;
    select.value = value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function buildServiceCard(option) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "service-card";
    card.dataset.serviceId = option.value;
    card.dataset.mode = option.dataset.mode;
    card.setAttribute("aria-describedby", "error-service");
    const body = document.createElement("span");
    body.className = "service-card-body";
    const place = document.createElement("span");
    place.className = "service-card-place";
    place.textContent = option.dataset.mode === "home" ? "A domicilio" : "En la barbería";
    const title = document.createElement("span");
    title.className = "service-card-name";
    title.textContent = option.textContent.trim();
    const description = document.createElement("span");
    description.className = "service-card-description";
    description.textContent = option.dataset.description || "";
    const details = document.createElement("span");
    details.className = "service-card-meta";
    if (option.dataset.duration) {
      const duration = document.createElement("span");
      duration.innerHTML = `<svg width="16" height="16" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;vertical-align:-1px;margin-right:6px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${option.dataset.duration} min`;
      details.append(duration);
    }
    if (option.dataset.price) {
      const price = document.createElement("strong");
      price.textContent = option.dataset.price;
      details.append(price);
    }
    body.append(place, title, description, details);
    const dot = document.createElement("span");
    dot.className = "choice-dot";
    dot.setAttribute("aria-hidden", "true");
    dot.textContent = "✓";
    const action = document.createElement("span");
    action.className = "service-card-action";
    action.textContent = "Elegir servicio";
    card.append(body, dot, action);
    return card;
  }

  function syncServices() {
    const select = serviceSelect();
    if (!select || !serviceCards) return;
    const options = [...select.options].filter((option) => option.value !== "");
    // Selection and disabled state never replace buttons: keyboard focus survives.
    const signature = JSON.stringify(options.map((option) => [option.value, option.textContent,
      option.dataset.mode, option.dataset.price, option.dataset.duration, option.dataset.description]));
    if (signature !== serviceSignature) {
      serviceSignature = signature;
      const focusedId = serviceCards.contains(document.activeElement) ? document.activeElement.dataset.serviceId : null;
      serviceCards.replaceChildren(...options.map(buildServiceCard));
      if (focusedId) {
        [...serviceCards.children].find((card) => card.dataset.serviceId === focusedId)?.focus();
      }
    }
    for (const [index, card] of [...serviceCards.children].entries()) {
      const selected = card.dataset.serviceId === select.value;
      card.setAttribute("aria-pressed", String(selected));
      const action = card.querySelector(".service-card-action");
      const label = selected ? "Seleccionado" : "Elegir servicio";
      if (action.textContent !== label) action.textContent = label;
      card.disabled = select.disabled || modeSelect()?.disabled || options[index].disabled;
      if (select.hasAttribute("aria-invalid")) card.setAttribute("aria-invalid", select.getAttribute("aria-invalid"));
      else card.removeAttribute("aria-invalid");
    }
  }

  form.addEventListener("click", (event) => {
    const card = event.target.closest("button[data-service-id]");
    if (!card || !serviceCards?.contains(card) || card.disabled) return;
    // Mode listeners run synchronously and keep the complete option catalog.
    commit(modeSelect(), card.dataset.mode);
    commit(serviceSelect(), card.dataset.serviceId);
    syncServices();
  });
  form.addEventListener("change", (event) => {
    if (event.target.matches("#booking-mode, #booking-service")) syncServices();
  });
  form.addEventListener("reset", () => window.setTimeout(schedule, 0));

  function schedule() {
    if (frame) return;
    frame = window.requestAnimationFrame(() => { frame = 0; sync(); });
  }

  function sync() {
    for (const id of ["booking-mode", "booking-service", "date"]) {
      const control = form.querySelector(`#${id}`);
      if (control) {
        control.classList.add("sr-only");
        control.tabIndex = -1;
      }
    }
    const time = form.querySelector("#time");
    if (time) {
      time.classList.remove("sr-only");
      time.removeAttribute("tabindex");
      time.hidden = false;
    }
    syncServices();
  }

  new MutationObserver((records) => {
    if (records.some((record) => record.type === "childList" || record.target.matches("select, option"))) schedule();
  }).observe(form, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ["disabled", "aria-invalid", "data-mode", "data-price", "data-duration", "data-description"],
  });
  sync();
}
