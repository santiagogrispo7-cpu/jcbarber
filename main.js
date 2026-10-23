const WHATSAPP_NUMBER = '5493329606138';
const ADDRESS_REF = 'AVENIDA SAN MARTIN 743';
const TZ = 'America/Argentina/Buenos_Aires';
const HORIZON_DAYS = 90;
const LOCALE = 'es-AR';

const SERVICES = [
  { id: 'corte-general', name: 'Corte general', price: '$18.000', duration: '30 min', mode: 'local', details: 'Local' },
  { id: 'barba', name: 'Barba', price: '$10.000', duration: '30 min', mode: 'local', details: 'Local' },
  { id: 'perfilado-cejas', name: 'Perfilado de cejas', price: '$8.000', duration: '30 min', mode: 'local', details: 'Local' },
  { id: 'corte-domicilio', name: 'Corte a domicilio', price: '$20.000', duration: '45 min', mode: 'domicilio', details: 'Incluye barba y perfilado de cejas' },
];

let state = {
  service: SERVICES[0],
  date: null,
  time: null,
  nombre: '',
  apellido: '',
  direccion: '',
  localidad: '',
};

const els = {};
function $id(id) { return document.getElementById(id); }
function getEl(id) { if (!els[id]) els[id] = $id(id); return els[id]; }

function init() {
  renderServices();
  initCalendar();
  initTime();
  initStepNav();
}

function renderServices() {
  const grid = getEl('service-grid');
  grid.innerHTML = SERVICES.map((s, i) => `
    <label class="service-card" data-id="${s.id}">
      <input type="radio" class="service-radio" name="service" value="${s.id}" ${i === 0 ? 'checked' : ''} tabindex="-1">
      <span class="name">${s.name}</span>
      <span class="price">${s.price}</span>
      <span class="duration">${s.duration} &#8226; ${s.details}</span>
    </label>
  `).join('');
  grid.querySelectorAll('input[name="service"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.service = SERVICES.find(s => s.id === radio.value);
      state.time = null;
      getEl('time-select').innerHTML = '<option value="">Seleccioná un horario</option>';
      getEl('time-select').disabled = true;
      grid.querySelectorAll('.service-card').forEach(c => c.classList.toggle('selected', c.querySelector('input').checked));
    });
  });
  grid.querySelectorAll('.service-card').forEach(c => c.classList.toggle('selected', c.querySelector('input').checked));
}

function argentinaNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}
function argentinaToday() {
  const d = argentinaNow();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isBeforeDay(a, b) { return a < new Date(b.getFullYear(), b.getMonth(), b.getDate()); }
function isAfterDay(a, b) { return a > new Date(b.getFullYear(), b.getMonth(), b.getDate()); }
function formatISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function parseISO(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2]-1, +m[3]);
}
function pad(n) { return String(n).padStart(2,'0'); }

function initCalendar() {
  const monthEl = getEl('calendar-month');
  const body = getEl('calendar-body');
  const dateInput = getEl('date-input');
  const prev = $id('calendar-prev');
  const next = $id('calendar-next');
  let view = argentinaToday();
  view.setDate(1);

  function render() {
    const year = view.getFullYear();
    const month = view.getMonth();
    const labels = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
    const thead = $id('calendar').querySelector('thead tr');
    thead.innerHTML = labels.map(l => `<th>${l}</th>`).join('');

    const first = new Date(year, month, 1);
    const startOffset = ((first.getDay() + 6) % 7);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = argentinaToday();
    const max = addDays(today, HORIZON_DAYS);
    const selected = state.date;

    monthEl.textContent = first.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' }).replace(/^(\w)/, c => c.toUpperCase());

    let html = '';
    let day = 1 - startOffset;
    for (let week = 0; week < 6; week++) {
      html += '<tr>';
      for (let col = 0; col < 7; col++, day++) {
        const d = new Date(year, month, day);
        const inMonth = d.getMonth() === month;
        const disabled = !inMonth || isBeforeDay(d, today) || isAfterDay(d, max);
        const isSelected = inMonth && selected && sameDay(d, selected);
        const isToday = inMonth && sameDay(d, today);
        let cls = 'day';
        if (!inMonth) cls += ' out';
        if (disabled) cls += ' disabled';
        if (isSelected) cls += ' selected';
        if (isToday) cls += ' today';
        if (inMonth && !disabled) {
          html += `<td><button type="button" class="${cls}" data-iso="${formatISO(d)}">${day}</button></td>`;
        } else {
          html += `<td><button type="button" class="${cls}" disabled>${inMonth ? day : ''}</button></td>`;
        }
      }
      html += '</tr>';
      if (day > daysInMonth + (7 - startOffset % 7)) break;
    }
    body.innerHTML = html;
    body.querySelectorAll('button.day:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = parseISO(btn.dataset.iso);
        selectDate(d);
        dateInput.value = formatISO(d);
      });
    });
  }

  prev.addEventListener('click', () => { view = addMonths(view, -1); render(); });
  next.addEventListener('click', () => { view = addMonths(view, 1); render(); });
  dateInput.addEventListener('change', () => {
    const d = parseISO(dateInput.value);
    if (d && !isBeforeDay(d, argentinaToday()) && !isAfterDay(d, addDays(argentinaToday(), HORIZON_DAYS))) {
      selectDate(d);
      render();
    }
  });

  render();
}

function addMonths(d, n) {
  const r = new Date(d); r.setMonth(r.getMonth() + n); return r;
}

function selectDate(d) {
  state.date = d;
  state.time = null;
  const sel = getEl('time-select');
  sel.innerHTML = '<option value="">Seleccioná un horario</option>';
  sel.disabled = true;
  fillTimeOptions(d);
  renderCalendarSelected();
}

function renderCalendarSelected() {
  getEl('calendar-body').querySelectorAll('button.day').forEach(btn => {
    const iso = btn.dataset.iso;
    if (!iso) return;
    const d = parseISO(iso);
    btn.classList.toggle('selected', state.date && sameDay(d, state.date));
  });
}

function initTime() {
  const sel = getEl('time-select');
  sel.addEventListener('change', () => { state.time = sel.value || null; });
}

function fillTimeOptions(d) {
  const sel = getEl('time-select');
  const mode = (state.service && state.service.mode) || 'domicilio';
  const slots = mode === 'domicilio'
    ? generateSlots('09:00', '12:30', 45).concat(generateSlots('16:30', '20:30', 45))
    : generateSlots('09:00', '12:30', 30).concat(generateSlots('16:30', '20:30', 30));
  const today = argentinaToday();
  const now = argentinaNow();
  const disabledToday = sameDay(d, today);
  let added = false;
  slots.forEach(s => {
    const [h, m] = s.split(':').map(Number);
    const slotDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
    let disabled = disabledToday && slotDate <= now;
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    opt.disabled = disabled;
    sel.appendChild(opt);
    if (!disabled) added = true;
  });
  sel.disabled = !added;
  state.time = null;
}

function generateSlots(start, end, stepMin) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const out = [];
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur + stepMin <= endMin) {
    out.push(pad(Math.floor(cur / 60)) + ':' + pad(cur % 60));
    cur += stepMin;
  }
  return out;
}

function initStepNav() {
  document.querySelectorAll('.btn-next').forEach(btn => {
    btn.addEventListener('click', () => {
      const from = btn.dataset.from;
      if (from === '1') goto(2);
      else if (from === '2') { if (validateBooking()) goto(3); }
      else if (from === '3') { if (validateData()) goto('summary'); }
    });
  });
  document.querySelectorAll('.btn-prev').forEach(btn => {
    btn.addEventListener('click', () => {
      const from = btn.dataset.from;
      if (from === '2') goto(1);
      if (from === '3') goto(2);
      if (from === 'summary') goto(3);
    });
  });
  getEl('btn-whatsapp').addEventListener('click', () => {
    if (!validateSummary()) return;
    openWhatsApp();
  });
}

function goto(page) {
  document.querySelectorAll('.page').forEach(p => p.hidden = true);
  const target = $id('page-' + page);
  if (!target) return;
  target.hidden = false;
  updateStepper(page);
  if (page === '2') {
    if (state.date) {
      getEl('date-input').value = formatISO(state.date);
      fillTimeOptions(state.date);
    }
  }
  if (page === '3') {
    $id('nombre').value = state.nombre;
    $id('apellido').value = state.apellido;
    $id('direccion').value = state.direccion;
    $id('localidad').value = state.localidad;
  }
  if (page === 'summary') updateSummary();
}

function updateStepper(page) {
  document.querySelectorAll('.step').forEach(step => {
    const n = step.dataset.step;
    step.classList.toggle('active', n <= String(page));
  });
}

function validateBooking() {
  const err = $id('booking-error');
  err.textContent = '';
  if (!state.date) { err.textContent = 'Seleccioná una fecha válida.'; return false; }
  if (!state.time) { err.textContent = 'Seleccioná un horario.'; return false; }
  return true;
}

function validateData() {
  const err = $id('data-error');
  err.textContent = '';
  state.nombre = trim($id('nombre').value);
  state.apellido = trim($id('apellido').value);
  state.direccion = trim($id('direccion').value);
  state.localidad = trim($id('localidad').value);
  let bad = false;
  if (state.nombre.length < 2 || state.nombre.length > 80) { showFieldError('nombre', 'Nombre inválido.'); bad = true; }
  if (state.apellido.length < 2 || state.apellido.length > 80) { showFieldError('apellido', 'Apellido inválido.'); bad = true; }
  if (state.direccion.length < 5 || state.direccion.length > 180) { showFieldError('direccion', 'Dirección inválida.'); bad = true; }
  if (state.localidad.length < 2 || state.localidad.length > 100) { showFieldError('localidad', 'Localidad inválida.'); bad = true; }
  return !bad;
}

function showFieldError(id, msg) {
  $id('error-' + id).textContent = msg;
}

function validateSummary() {
  const err = $id('summary-error');
  err.textContent = '';
  if (!state.service || !state.date || !state.time || !state.nombre || !state.direccion || !state.localidad) {
    err.textContent = 'Completá todos los pasos antes de continuar.';
    return false;
  }
  return true;
}

function updateSummary() {
  const fmtDate = state.date ? state.date.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
  $id('sum-servicio').textContent = state.service ? state.service.name + ' (' + state.service.duration + ')' : '';
  $id('sum-fecha').textContent = fmtDate;
  $id('sum-hora').textContent = state.time || '';
  $id('sum-nombre').textContent = (state.nombre || '') + ' ' + (state.apellido || '');
  $id('sum-direccion').textContent = state.direccion || '';
  $id('sum-localidad').textContent = state.localidad || '';
}

function buildMessage() {
  const fd = state.date;
  const dd = String(fd.getDate()).padStart(2,'0');
  const mm = String(fd.getMonth()+1).padStart(2,'0');
  const yyyy = fd.getFullYear();
  return [
    'Hola JC BARBER, quiero solicitar un turno para un corte de pelo a domicilio.',
    'Nombre: ' + state.nombre + ' ' + state.apellido,
    'Fecha preferida: ' + dd + '/' + mm + '/' + yyyy,
    'Hora preferida: ' + state.time + ' (hora de Argentina)',
    'Domicilio: ' + state.direccion,
    'Localidad: ' + state.localidad,
    'Quedo a la espera de confirmar disponibilidad. ¡Gracias!',
  ].join('\n');
}

function openWhatsApp() {
  const text = encodeURIComponent(buildMessage());
  window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + text, '_blank', 'noopener,noreferrer');
}

function trim(s) { return String(s || '').trim(); }

document.addEventListener('DOMContentLoaded', init);
