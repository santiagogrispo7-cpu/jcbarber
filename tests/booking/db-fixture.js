import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test as base, expect } from "@playwright/test";
import { PGlite } from "../../supabase/.tools/node_modules/@electric-sql/pglite/dist/index.js";
import { addDays, todayInArgentina } from "../../src/date-utils.js";

export { expect };

// Browser -> intercepted HTTP -> real PostgreSQL RPC, GRANT and RLS checks.
// Auth is a mock. A JS queue on one PGlite connection is NOT a native race test.
const apiPattern = "https://booking.test/**";
const rpcDefinitions = new Map([
  ["public_catalog", {
    keys: [],
    sql: "select public.public_catalog() as result",
  }],
  ["available_slots", {
    keys: ["p_service", "p_mode", "p_date"],
    // Let PostgreSQL encode timestamps/numeric like PostgREST, rather than
    // leaking PGlite's JS Date objects and numeric strings into backend.call().
    sql: `select coalesce(jsonb_agg(to_jsonb(slot) order by slot.starts_at), '[]'::jsonb) as result
      from public.available_slots($1::uuid, $2::text, $3::date) slot`,
  }],
  ["create_booking", {
    keys: ["p_data"],
    sql: "select public.create_booking($1::jsonb) as result",
  }],
  ["admin_snapshot", {
    keys: ["p_from", "p_to"],
    sql: "select public.admin_snapshot($1::date, $2::date) as result",
  }],
  ["admin_save_config", {
    keys: ["p_data"],
    sql: "select public.admin_save_config($1::jsonb) as result",
  }],
  ["admin_booking", {
    keys: ["p_data"],
    sql: "select public.admin_booking($1::jsonb) as result",
  }],
  ["admin_block", {
    keys: ["p_data"],
    sql: "select public.admin_block($1::jsonb) as result",
  }],
  ["admin_confirm_handover", {
    keys: ["p_data"],
    sql: "select public.admin_confirm_handover($1::jsonb) as result",
  }],
]);

const errorMessages = new Map([
  ["22023", "Revisá los datos enviados."],
  ["23P01", "Ese horario se superpone con una reserva o un bloqueo."],
  ["23505", "La solicitud ya fue utilizada con otros datos."],
  ["42501", "Tu usuario no está autorizado para realizar esta operación."],
  ["55000", "La agenda está desactivada o su configuración está incompleta."],
  ["40001", "Reintentá la operación en una transacción READ COMMITTED."],
  ["PGRST202", "La operación o sus argumentos no coinciden con el contrato RPC."],
]);

function safeError(code = "XX000") {
  const status = code === "42501" ? 403
    : ["23P01", "23505", "40001"].includes(code) ? 409
      : code === "PGRST202" ? 404
        : code.startsWith("22") || code === "55000" ? 400 : 500;
  return Object.assign(new Error(errorMessages.get(code) || "No se pudo completar la operación SQL."), {
    code,
    status,
  });
}

export const test = base.extend({
  db: async ({}, use) => {
    const db = new PGlite();
    try {
      await db.exec(await readFile(new URL("../../supabase/tests/bootstrap-local.sql", import.meta.url), "utf8"));
      await db.exec(await readFile(new URL("../../supabase/migrations/202610190001_booking_backend.sql", import.meta.url), "utf8"));
      await db.exec(await readFile(new URL("../../supabase/migrations/202610200001_admin_handover.sql", import.meta.url), "utf8"));
      await use(db);
    } finally {
      await db.close();
    }
  },

  backend: [async ({ db, context }, use) => {
    const adminId = randomUUID();
    const userId = randomUUID();
    // Deliberately use the real runtime clock, never page.clock or a frozen date.
    const date = addDays(todayInArgentina(new Date()), 1);
    const identities = new Map([
      ["anon", { sqlRole: "anon", id: "" }],
      ["admin", { sqlRole: "authenticated", id: adminId }],
      ["user", { sqlRole: "authenticated", id: userId }],
    ]);
    let queue = Promise.resolve();

    function call(name, args = {}, role = "anon") {
      const operation = queue.then(async () => {
        const definition = rpcDefinitions.get(name);
        const identity = identities.get(role);
        if (!identity) throw safeError("22023");
        if (!definition || !args || typeof args !== "object" || Array.isArray(args)
          || Object.keys(args).length !== definition.keys.length
          || definition.keys.some((key) => !Object.hasOwn(args, key) || args[key] === undefined)) {
          throw safeError("PGRST202");
        }
        try {
          const parameters = definition.keys.map((key) => key === "p_data" ? JSON.stringify(args[key]) : args[key]);
          return await db.transaction(async (tx) => {
            // Only these literal roles are possible; identifiers never come from HTTP.
            await tx.exec(identity.sqlRole === "anon" ? "set local role anon" : "set local role authenticated");
            await tx.query(`select set_config('request.jwt.claim.sub', $1, true),
              set_config('request.jwt.claims', $2, true)`, [
              identity.id,
              JSON.stringify({ sub: identity.id || null, role: identity.sqlRole }),
            ]);
            // No admin-name allowlist here: actual GRANTs and auth.uid() decide access.
            const result = await tx.query(definition.sql, parameters);
            return result.rows[0].result;
          }); // PGlite commits on success, rolls back on rejection (including SET LOCAL).
        } catch (error) {
          // Do not attach PostgreSQL detail/context/query/parameters or log PII.
          throw safeError(typeof error.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : "XX000");
        }
      });
      // One failed request must not poison the next transaction in this connection.
      queue = operation.catch(() => {});
      return operation;
    }

    await db.transaction(async (tx) => {
      await tx.query("insert into auth.users(id,email) values ($1::uuid,$2), ($3::uuid,$4)", [
        adminId, "admin@example.test", userId, "user@example.test",
      ]);
      await tx.query("insert into jc_private.authorized_admins(user_id) values ($1::uuid)", [adminId]);
    });
    const snapshot = await call("admin_snapshot", { p_from: date, p_to: date }, "admin");
    const serviceId = snapshot.services[0].id;
    await call("admin_save_config", {
      p_data: {
        settings: {
          ...snapshot.settings,
          enabled: true,
          break_minutes: 5,
          travel_before_minutes: 15,
          travel_after_minutes: 15,
        },
        services: [{
          id: serviceId,
          name: "Corte prueba",
          price: 10000,
          duration_minutes: 30,
          modes: ["local", "home"],
          active: true,
        }],
        hours: snapshot.hours.map((hour) => ({ ...hour, enabled: true })),
      },
    }, "admin");

    const authUsers = new Map([
      ["admin", { id: adminId, email: "admin@example.test", role: "authenticated", aud: "authenticated" }],
      ["user", { id: userId, email: "user@example.test", role: "authenticated", aud: "authenticated" }],
    ]);
    function authSession(role) {
      return {
        access_token: role === "admin" ? "test-admin" : "test-user",
        refresh_token: role === "admin" ? "test-refresh" : "test-user-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: authUsers.get(role),
      };
    }

    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
      "cache-control": "no-store",
    };
    const respond = (route, status, body) => route.fulfill(status === 204
      ? { status, headers }
      : { status, headers, contentType: "application/json", body: JSON.stringify(body) });

    async function handleRoute(route) {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      if (method === "OPTIONS") return respond(route, 204);
      let body = {};
      if (method === "POST" || method === "PUT") {
        try {
          body = request.postDataJSON() ?? {};
          if (typeof body !== "object" || Array.isArray(body)) throw new Error();
        } catch {
          return respond(route, 400, { code: "22023", message: "El cuerpo debe ser un objeto JSON válido." });
        }
      }

      if (url.pathname === "/auth/v1/token" && method === "POST") {
        const grant = url.searchParams.get("grant_type");
        let role;
        if (grant === "password" && body.password === "testing-password") {
          if (body.email === "admin@example.test") role = "admin";
          if (body.email === "user@example.test") role = "user";
        } else if (grant === "refresh_token") {
          if (body.refresh_token === "test-refresh") role = "admin";
          if (body.refresh_token === "test-user-refresh") role = "user";
        }
        return role ? respond(route, 200, authSession(role))
          : respond(route, 400, { code: "invalid_grant", message: "Datos de acceso inválidos." });
      }
      if (url.pathname === "/auth/v1/logout" && method === "POST") return respond(route, 204);
      if (url.pathname === "/auth/v1/recover" && method === "POST") return respond(route, 200, {});
      if (url.pathname === "/auth/v1/verify" && method === "POST") {
        return body.token_hash === "valid-recovery" && ["recovery", "invite"].includes(body.type)
          ? respond(route, 200, authSession("admin"))
          : respond(route, 403, { code: "otp_expired" });
      }

      const authorization = request.headers().authorization;
      const role = !authorization ? "anon"
        : /^Bearer test-admin$/i.test(authorization) ? "admin"
          : /^Bearer test-user$/i.test(authorization) ? "user" : null;
      if (!role) return respond(route, 401, { code: "invalid_token", message: "Sesión inválida." });
      if (url.pathname === "/auth/v1/user" && method === "GET") {
        return role === "anon" ? respond(route, 401, { code: "invalid_token", message: "Iniciá sesión." })
          : respond(route, 200, authUsers.get(role));
      }
      if (url.pathname === "/auth/v1/user" && method === "PUT") {
        return role !== "anon" && body.password?.length >= 12
          ? respond(route, 200, authUsers.get(role)) : respond(route, 422, { code: "weak_password" });
      }
      const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname);
      if (!rpc || method !== "POST") {
        return respond(route, 404, { code: "PGRST202", message: "Endpoint de pruebas no disponible." });
      }
      try {
        return await respond(route, 200, await call(rpc[1], body, role));
      } catch (error) {
        const failure = safeError(error.code);
        return respond(route, failure.status, { code: failure.code, message: failure.message });
      }
    }

    const inFlight = new Set();
    const handler = (route) => {
      const pending = handleRoute(route);
      inFlight.add(pending);
      pending.then(() => inFlight.delete(pending), () => inFlight.delete(pending));
      return pending;
    };
    await context.route(apiPattern, handler);
    try {
      await use({ db, call, serviceId, adminId, userId, date });
    } finally {
      await context.unroute(apiPattern, handler);
      await Promise.allSettled([...inFlight]);
      await queue;
      // The dependent db fixture closes and discards this test's database next.
    }
  }, { auto: true }],
});
