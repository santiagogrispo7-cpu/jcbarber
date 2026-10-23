// Optional isolated PostgreSQL/WASM verification; no application dependencies.
import { readFile } from 'node:fs/promises';
import { PGlite } from '../.tools/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
try {
  const version = await db.query('select version()');
  console.log(version.rows[0].version);
  for (const path of [
    './bootstrap-local.sql',
    '../migrations/202610190001_booking_backend.sql',
    '../migrations/202610200001_admin_handover.sql',
    './booking.sql',
    '../migrations/202610210001_customer_services.sql',
    './customer-services.sql',
  ]) {
    await db.exec(await readFile(new URL(path, import.meta.url), 'utf8'));
    console.log(`PASS ${path}`);
  }
} catch (error) {
  // Do not print query payloads; failures may contain customer data outside fixtures.
  console.error({ code: error.code, message: error.message, where: error.where, detail: error.detail });
  process.exitCode = 1;
} finally {
  await db.close();
}
