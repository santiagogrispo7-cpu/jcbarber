// Native PostgreSQL two-connection tests. Requires psql and a disposable, freshly
// migrated database. Uses only Node built-ins; no application packages.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const url = process.env.JC_TEST_DATABASE_URL;
if (!url) throw new Error('Definí JC_TEST_DATABASE_URL para una base de pruebas recién migrada.');
const psql = process.env.PSQL || 'psql';
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${literal(JSON.stringify(value))}::jsonb`;
const runId = randomUUID();
const adminId = randomUUID();
const active = new Set();

function session(sql, name = 'query', keepOpen = false) {
  // Credentials stay in the child environment, not process command-line arguments.
  const child = spawn(psql, ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], {
    env: { ...process.env, PGDATABASE: url, PGAPPNAME: `jc-test-${runId}-${name}` },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  active.add(child);
  let stdout = '', stderr = '', markerResolve, markerReject;
  const marker = new Promise((resolve, reject) => { markerResolve = resolve; markerReject = reject; });
  // Avoid an unhandled rejection for sessions that do not need the lock marker.
  marker.catch(() => {});
  const done = new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.includes('JC_LOCK_HELD')) markerResolve();
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => { markerReject(error); reject(error); active.delete(child); });
    child.on('close', (code) => {
      active.delete(child);
      markerReject(new Error(`La conexión terminó antes del checkpoint (${code}).`));
      resolve({ code, stdout: stdout.trim(), stderr });
    });
  });
  child.stdin.write(`${sql}\n`);
  if (!keepOpen) child.stdin.end();
  return { child, done, marker };
}

async function query(sql) {
  const result = await session(sql).done;
  assert.equal(result.code, 0, result.stderr);
  return result.stdout;
}

const asAdmin = `set role authenticated; select set_config('request.jwt.claim.sub',${literal(adminId)},false);`;
const asAnon = "set role anon; select set_config('request.jwt.claim.sub','',false);";

async function race(label, aSQL, bSQL, expectedCode = null) {
  const a = session(`begin; ${aSQL}\n\\echo JC_LOCK_HELD`, 'writer-a', true);
  const timeout = setTimeout(() => a.child.kill(), 20000);
  let b;
  try {
    await a.marker;
    b = session(bSQL, 'writer-b');
    // Observe B waiting on the real advisory lock before permitting A to commit.
    // No sleep-based assumption that the two operations happened concurrently.
    const deadline = Date.now() + 15000;
    let waiting = false;
    while (Date.now() < deadline) {
      const state = await query(`select exists(select 1 from pg_stat_activity
        where application_name = ${literal(`jc-test-${runId}-writer-b`)}
          and wait_event_type = 'Lock' and wait_event = 'advisory');`);
      if (state === 't') { waiting = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    assert.ok(waiting, `${label}: segunda conexión no esperó el lock`);
    a.child.stdin.end('commit;\n');
    const [ar, br] = await Promise.all([a.done, b.done]);
    assert.equal(ar.code, 0, ar.stderr);
    if (expectedCode) {
      assert.notEqual(br.code, 0, `${label}: debía rechazar el conflicto`);
      assert.match(br.stderr, new RegExp(`\\b${expectedCode}\\b`));
    } else {
      assert.equal(br.code, 0, br.stderr);
    }
    console.log(`PASS ${label} (espera advisory observada)`);
  } finally {
    clearTimeout(timeout);
    if (active.has(a.child)) a.child.kill();
    if (b && active.has(b.child)) b.child.kill();
    await a.done.catch(() => {});
    if (b) await b.done.catch(() => {});
  }
}

let original;
let configured = false;
try {
  const info = JSON.parse(await query(`select jsonb_build_object(
    'empty',(select count(*) = 0 from jc_private.agenda),
    'disabled',(select not enabled from jc_private.settings),
    'settings',(select to_jsonb(s) - 'singleton' from jc_private.settings s),
    'services',(select jsonb_agg(to_jsonb(s)) from jc_private.services s),
    'hours',(select jsonb_agg(to_jsonb(h)) from jc_private.hours h),
    'date',((clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date + 2)::text);`));
  assert.ok(info.empty && info.disabled, 'Usá una base de pruebas nueva, sin reservas y desactivada.');
  original = { settings: info.settings, services: info.services, hours: info.hours };
  const sid = info.services[0].id;
  const config = {
    settings: { ...info.settings, enabled: true, break_minutes: 15, travel_before_minutes: 15, travel_after_minutes: 15 },
    services: [{ ...info.services[0], active: true, price: 1000, duration_minutes: 30, modes: ['local', 'home'] }],
    hours: Array.from({ length: 7 }, (_, weekday) => ['local', 'home'].map((mode) => ({
      id: null, weekday, mode, start_time: '09:00', end_time: '18:00', enabled: true,
    }))).flat(),
  };
  await query(`begin; insert into auth.users(id,email) values (${literal(adminId)},'concurrency@example.invalid');
    insert into jc_private.authorized_admins(user_id) values (${literal(adminId)}); commit;`);
  configured = true;
  const reset = async () => query(`begin;
    delete from jc_private.booking_requests; delete from jc_private.agenda;
    ${asAdmin} select public.admin_save_config(${json(config)}); commit;`);
  const payload = (mode = 'local') => ({
    request_id: randomUUID(), service_id: sid, mode, starts_at: `${info.date}T10:00:00-03:00`,
    customer_name: 'Concurrencia Prueba', phone: '+5493329600000', address: 'Calle Ficticia 123', notes: null,
  });
  const create = (data) => `${asAnon} select public.create_booking(${json(data)});`;
  const block = `${asAdmin} select public.admin_block(${json({ action: 'create',
    starts_at: `${info.date}T10:00:00-03:00`, ends_at: `${info.date}T11:00:00-03:00`, reason: 'Concurrent fixture' })});`;

  await reset();
  await race('dos reservas mismo horario', create(payload()), create(payload()), '23P01');
  await reset();
  await race('reserva local contra domicilio', create(payload()), create(payload('home')), '23P01');
  await reset();
  await race('reserva contra bloqueo', create(payload()), block, '23P01');
  await reset();
  await race('bloqueo contra reserva', block, create(payload()), '23P01');
  await reset();
  const same = payload();
  await race('reintentos simultáneos idénticos', create(same), create(same));
  assert.equal(await query('select count(*) from jc_private.agenda;'), '1');
  assert.equal(await query('select count(*) from jc_private.booking_requests;'), '1');
  await reset();
  await race('misma clave con otro payload', create(same), create({ ...same, phone: '+5493329600001' }), '23505');
  await reset();
  const disabled = { ...config, settings: { ...config.settings, enabled: false } };
  await race('desactivar contra nueva reserva', `${asAdmin} select public.admin_save_config(${json(disabled)});`, create(payload()), '55000');
  await reset();
  const newConfig = { ...config, services: [{ ...config.services[0], price: 2000, duration_minutes: 45 }] };
  await race('configuración contra reserva', `${asAdmin} select public.admin_save_config(${json(newConfig)});`, create(payload()));
  assert.equal(await query('select price = 2000 and duration_minutes = 45 from jc_private.agenda;'), 't');
  await reset();
  await race('reserva conserva snapshot ante configuración concurrente', create(payload()), `${asAdmin} select public.admin_save_config(${json(newConfig)});`);
  assert.equal(await query('select price = 1000 and duration_minutes = 30 from jc_private.agenda;'), 't');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const child of active) child.kill();
  if (configured) {
    try {
      // Restore exactly the original fixtures, including IDs. Trusted test connection only.
      await query(`begin;
        delete from jc_private.booking_requests; delete from jc_private.agenda;
        delete from jc_private.hours; delete from jc_private.services; delete from jc_private.settings;
        insert into jc_private.settings select * from jsonb_populate_record(null::jc_private.settings,${json({ singleton: true, ...original.settings })});
        insert into jc_private.services select * from jsonb_populate_recordset(null::jc_private.services,${json(original.services)});
        insert into jc_private.hours select * from jsonb_populate_recordset(null::jc_private.hours,${json(original.hours)});
        delete from auth.users where id = ${literal(adminId)}; commit;`);
      console.log('PASS restauración de fixtures');
    } catch (error) {
      console.error(`Falló limpieza de la base descartable: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
