import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '../../src/whatsapp.js';

const request = Object.freeze({
  name: 'María Test', date: '2028-02-29', time: '09:05',
  address: 'Calle de Prueba 123', comments: '',
});

test('WhatsApp targets the exact confirmed number and decodes to the full expected request', () => {
  const url = new URL(buildWhatsAppUrl(request));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/5493329606138');
  assert.equal(url.hash, '');
  assert.deepEqual([...url.searchParams.keys()], ['text']);
  assert.equal(url.searchParams.get('text'), [
    'Hola JC Barberhouse, quiero solicitar un turno para un corte de pelo a domicilio.',
    'Nombre: María Test',
    'Fecha preferida: 29/02/2028',
    'Hora preferida: 09:05 (hora de Argentina)',
    'Domicilio: Calle de Prueba 123',
    'Quedo a la espera de confirmar disponibilidad. ¡Gracias!',
  ].join('\n'));
});

test('special characters, HTML-looking text, emoji and line breaks survive exactly one URL decoding', () => {
  const data = {
    ...request,
    name: 'Ana & José + #2',
    address: 'Pasaje <Prueba> 123 & piso +2 #B',
    comments: 'Timbre: A&B + #2\n<img src=x onerror=alert(1)> 💈 100% %26 ?text=otro',
  };
  const rawUrl = buildWhatsAppUrl(data);
  const url = new URL(rawUrl);
  const message = url.searchParams.get('text');
  assert.equal(message, buildWhatsAppMessage(data));
  assert.ok(message.includes(`Nombre: ${data.name}\n`));
  assert.ok(message.includes(`Domicilio: ${data.address}\n`));
  assert.ok(message.includes(`Comentarios: ${data.comments}\n`));
  assert.ok(!message.includes('Localidad:'));
  assert.equal(url.searchParams.size, 1);
  assert.equal(url.hash, '');
  assert.ok(!rawUrl.includes('<img'));
});

test('empty, omitted and whitespace comments create no blank comments line or undefined text', () => {
  for (const comments of ['', ' \n\t ', undefined, null]) {
    const message = new URL(buildWhatsAppUrl({ ...request, comments })).searchParams.get('text');
    assert.ok(!message.includes('Comentarios:'));
    assert.ok(!message.includes('undefined'));
    assert.ok(!message.includes('\n\n'));
  }
});

test('message fields are trimmed without mutating data or depending on the current date', () => {
  const data = Object.freeze({ ...request, name: '  María Test  ', comments: '  Dato de prueba  ' });
  const message = buildWhatsAppMessage(data);
  assert.ok(message.includes('Nombre: María Test\n'));
  assert.ok(message.includes('Comentarios: Dato de prueba\n'));
  assert.equal(data.name, '  María Test  ');
  assert.ok(buildWhatsAppMessage({ ...data, date: '2000-01-01' }).includes('Fecha preferida: 01/01/2000'));
  assert.throws(() => buildWhatsAppUrl({ ...request, date: '2028-02-30' }), RangeError);
});

test('local service message shows the shop address with city and never the customer address', () => {
  const message = buildWhatsAppMessage({
    ...request, service: 'beard', address: 'Calle del cliente 999',
  });
  assert.ok(message.includes('Local: AVENIDA SAN MARTIN 743, Baradero'));
  assert.ok(!message.includes('Calle del cliente 999'));
  assert.ok(!message.includes('Domicilio:'));
  assert.ok(!message.includes('Localidad:'));
});
