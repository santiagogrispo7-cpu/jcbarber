import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  addDays, addMonths, argentinaNow, bookingRange, formatDate, formatLongDate,
  isValidDate, isValidTime, normalizeBooking, todayInArgentina, validateBooking,
} from '../../src/date-utils.js';

const now = new Date('2026-10-16T15:00:30.000Z'); // 12:00:30 in Argentina.
const valid = Object.freeze({
  name: 'María Test', date: '2026-10-16', time: '12:01',
  address: 'Calle de Prueba 123', comments: '',
});

test('civil dates reject rollover, malformed values and non-Gregorian leap days', () => {
  for (const date of ['2028-02-29', '2000-02-29', '2026-12-31', '0001-01-01', '0099-12-31']) {
    assert.equal(isValidDate(date), true, date);
  }
  for (const date of [
    '2026-02-29', '1900-02-29', '2100-02-29', '0100-02-29', '2026-04-31',
    '2026-00-10', '2026-13-01', '2026-01-00', '2026-01-32', '0000-01-01',
    '2026-1-01', '26-01-01', '2026-01-01T00:00:00Z', ' 2026-01-01', '', null, 20260101,
  ]) assert.equal(isValidDate(date), false, String(date));
});

test('day arithmetic crosses leap days and years without local-time or low-year coercion', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2028-02-29', 1), '2028-03-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(addDays('0099-12-31', 1), '0100-01-01');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(addDays('2026-10-16', 90), '2027-01-14');
  assert.equal(addDays('2027-12-01', 90), '2028-02-29');
  assert.equal(addDays('2026-10-16', 0), '2026-10-16');
});

test('invalid date arithmetic fails explicitly instead of normalizing impossible dates', () => {
  assert.throws(() => addDays('2026-02-30', 1), RangeError);
  assert.throws(() => addDays('2026-01-01', 0.5), TypeError);
  assert.throws(() => addDays('2026-01-01', '1'), TypeError);
  assert.throws(() => addDays('9999-12-31', 1), RangeError);
  assert.throws(() => addDays('0001-01-01', -1), RangeError);
  assert.throws(() => addDays('2026-01-01', Number.MAX_SAFE_INTEGER), RangeError);
});

test('calendar month jumps clamp the day and cross year boundaries', () => {
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-03-31', -1), '2028-02-29');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(addMonths('2027-01-15', -1), '2026-12-15');
  assert.throws(() => addMonths('2026-02-30', 1), RangeError);
  assert.throws(() => addMonths('2026-01-01', 1.5), TypeError);
  assert.throws(() => addMonths('9999-12-01', 1), RangeError);
});

test('Argentine day changes at 03:00 UTC, including year rollover', () => {
  assert.equal(todayInArgentina(new Date('2026-10-17T02:59:59.999Z')), '2026-10-16');
  assert.equal(todayInArgentina(new Date('2026-10-17T03:00:00.000Z')), '2026-10-17');
  assert.equal(todayInArgentina(new Date('2027-01-01T02:59:59.999Z')), '2026-12-31');
  assert.deepEqual(argentinaNow(new Date('2027-01-01T03:00:00.000Z')), {
    date: '2027-01-01', time: '00:00', hour: 0, minute: 0, second: 0,
  });
});

test('host time zones cannot change Argentine dates, hours or civil-date arithmetic', () => {
  const moduleUrl = new URL('../../src/date-utils.js', import.meta.url).href;
  const script = `
    import { argentinaNow, addDays, formatDate } from ${JSON.stringify(moduleUrl)};
    console.log(JSON.stringify({
      clock: argentinaNow(new Date('2026-10-17T02:30:00.000Z')),
      leap: addDays('2028-02-28', 1),
      display: formatDate('2026-10-16'),
    }));
  `;
  for (const TZ of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, TZ }, encoding: 'utf8',
    });
    assert.deepEqual(JSON.parse(output), {
      clock: { date: '2026-10-16', time: '23:30', hour: 23, minute: 30, second: 0 },
      leap: '2028-02-29', display: '16/10/2026',
    }, TZ);
  }
});

test('booking range is inclusive today through today plus 90 civil days', () => {
  assert.deepEqual(bookingRange(now), { min: '2026-10-16', max: '2027-01-14' });
  assert.deepEqual(validateBooking(valid, now), {});
  assert.deepEqual(validateBooking({ ...valid, date: '2027-01-14', time: '00:00' }, now), {});
  assert.ok(validateBooking({ ...valid, date: '2026-10-15' }, now).date);
  assert.ok(validateBooking({ ...valid, date: '2027-01-15' }, now).date);
  assert.ok(validateBooking({ ...valid, date: '2026-11-31' }, now).date);
});

test('hour validation accepts only a complete 24-hour HH:mm value', () => {
  for (const time of ['00:00', '09:05', '12:00', '23:59']) assert.equal(isValidTime(time), true);
  for (const time of ['', '9:05', '09:5', '24:00', '12:60', '-1:00', '12:00:00', '12:00 PM', ' 12:00', null]) {
    assert.equal(isValidTime(time), false, String(time));
    assert.ok(validateBooking({ ...valid, date: '2026-10-17', time }, now).time);
  }
});

test('today requires a strictly future minute, but tomorrow permits midnight', () => {
  assert.ok(validateBooking({ ...valid, time: '11:59' }, now).time);
  assert.ok(validateBooking({ ...valid, time: '12:00' }, now).time);
  assert.deepEqual(validateBooking({ ...valid, time: '12:01' }, now), {});
  assert.deepEqual(validateBooking({ ...valid, date: '2026-10-17', time: '00:00' }, now), {});
  assert.ok(validateBooking({ ...valid, time: '12:00' }, new Date('2026-10-16T15:00:00Z')).time);
});

test('a previously valid request expires as time passes and as the Argentine day changes', () => {
  const request = { ...valid, time: '23:59' };
  assert.deepEqual(validateBooking(request, new Date('2026-10-17T02:58:59Z')), {});
  assert.ok(validateBooking(request, new Date('2026-10-17T02:59:00Z')).time);
  assert.ok(validateBooking(request, new Date('2026-10-17T03:00:00Z')).date);
  assert.deepEqual(bookingRange(new Date('2026-10-17T03:00:00Z')), {
    min: '2026-10-17', max: '2027-01-15',
  });
});

test('required fields reject blank and whitespace-only data; comments remain optional', () => {
  assert.deepEqual(Object.keys(validateBooking(undefined, now)).sort(), ['address', 'date', 'name', 'time']);
  for (const field of ['name', 'address']) {
    assert.ok(validateBooking({ ...valid, [field]: ' \t\n ' }, now)[field]);
  }
  assert.deepEqual(validateBooking({ ...valid, comments: undefined }, now), {});
  assert.deepEqual(validateBooking({ ...valid, comments: ' \n ' }, now), {});
});

test('text lengths enforce both exact edges after trimming', () => {
  for (const [field, min, max] of [['name', 2, 80], ['address', 5, 180], ['comments', 0, 300]]) {
    assert.deepEqual(validateBooking({ ...valid, [field]: `  ${'á'.repeat(min)}  ` }, now), {}, `${field} minimum`);
    assert.deepEqual(validateBooking({ ...valid, [field]: 'á'.repeat(max) }, now), {}, `${field} maximum`);
    if (min) assert.ok(validateBooking({ ...valid, [field]: 'á'.repeat(min - 1) }, now)[field]);
    assert.ok(validateBooking({ ...valid, [field]: 'á'.repeat(max + 1) }, now)[field]);
  }
});

test('normalization preserves real names, special text and internal line breaks without mutation', () => {
  const data = Object.freeze({
    ...valid, name: '  Ana María O’Connor  ', comments: '  Timbre A&B + #2\n<script>texto</script>  ',
  });
  const normalized = normalizeBooking(data);
  assert.equal(normalized.name, 'Ana María O’Connor');
  assert.equal(normalized.comments, 'Timbre A&B + #2\n<script>texto</script>');
  assert.equal(data.name, '  Ana María O’Connor  ');
  assert.deepEqual(validateBooking(data, now), {});
  assert.equal(normalizeBooking({ name: 42 }).name, '');
  assert.ok(validateBooking({ ...valid, date: ' 2026-10-16 ' }, now).date);
});

test('date labels retain the selected civil day and reject impossible dates', () => {
  assert.equal(formatDate('2028-02-29'), '29/02/2028');
  assert.equal(formatDate('0001-01-01'), '01/01/0001');
  assert.match(formatLongDate('2026-10-16'), /viernes.*16.*octubre.*2026/i);
  assert.throws(() => formatDate('2026-02-29'), RangeError);
});
