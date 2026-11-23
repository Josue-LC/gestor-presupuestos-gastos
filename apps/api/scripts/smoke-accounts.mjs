import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const password = `Test-${randomUUID()}!`;
const userIds = [];
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function call(path, { cookie, body, ...options } = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });
}

async function expectStatus(response, expected) {
  assert.equal(response.status, expected, await response.clone().text());
  return response;
}

async function register() {
  const email = `accounts-${randomUUID()}@example.test`;
  const response = await expectStatus(await call("/api/v1/auth/register", {
    method: "POST",
    body: { email, password },
  }), 201);
  const user = await response.json();
  userIds.push(user.id);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  return { user, cookie };
}

await db.connect();

try {
  const first = await register();
  const second = await register();

  await expectStatus(await call("/api/v1/accounts"), 401);
  assert.deepEqual(await (await call("/api/v1/institutions", { cookie: first.cookie })).json(), []);
  assert.deepEqual(await (await call("/api/v1/accounts", { cookie: second.cookie })).json(), []);

  const institutionResponse = await expectStatus(await call("/api/v1/institutions", {
    method: "POST",
    cookie: first.cookie,
    body: { name: "Banco de prueba" },
  }), 201);
  const institution = await institutionResponse.json();
  assert.equal(institution.name, "Banco de prueba");

  await expectStatus(await call("/api/v1/institutions", {
    method: "POST",
    cookie: first.cookie,
    body: { name: "banco de prueba" },
  }), 409);
  await expectStatus(await call("/api/v1/institutions", {
    method: "POST",
    cookie: second.cookie,
    body: { name: "Banco de prueba" },
  }), 201);

  const accountInput = {
    name: "Cuenta principal",
    institutionId: institution.id,
    type: "checking",
    openingBalance: "100.00",
    openingDate: "2026-11-01",
  };

  await expectStatus(await call("/api/v1/accounts", {
    method: "POST",
    cookie: second.cookie,
    body: accountInput,
  }), 404);
  await expectStatus(await call("/api/v1/accounts", {
    method: "POST",
    cookie: first.cookie,
    body: { ...accountInput, userId: second.user.id },
  }), 400);

  const createdResponse = await expectStatus(await call("/api/v1/accounts", {
    method: "POST",
    cookie: first.cookie,
    body: accountInput,
  }), 201);
  const account = await createdResponse.json();
  assert.equal(account.openingBalance, "100.00");
  assert.equal(account.status, "active");

  await expectStatus(await call("/api/v1/accounts", {
    method: "POST",
    cookie: first.cookie,
    body: { ...accountInput, name: "cuenta principal" },
  }), 409);

  assert.equal((await (await call("/api/v1/accounts", { cookie: first.cookie })).json()).length, 1);
  assert.deepEqual(await (await call("/api/v1/accounts", { cookie: second.cookie })).json(), []);
  await expectStatus(await call("/api/v1/accounts?status=unknown", { cookie: first.cookie }), 400);

  const accountPath = `/api/v1/accounts/${account.id}`;
  await expectStatus(await call(accountPath, { cookie: second.cookie }), 404);
  await expectStatus(await call(accountPath, {
    method: "PATCH",
    cookie: second.cookie,
    body: { name: "Robada" },
  }), 404);
  await expectStatus(await call(`${accountPath}/archive`, {
    method: "POST",
    cookie: second.cookie,
  }), 404);
  await expectStatus(await call(`${accountPath}/restore`, {
    method: "POST",
    cookie: second.cookie,
  }), 404);

  const preflight = await expectStatus(await call(accountPath, {
    method: "OPTIONS",
    headers: { "Access-Control-Request-Method": "PATCH" },
  }), 204);
  assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /PATCH/);

  const editedResponse = await expectStatus(await call(accountPath, {
    method: "PATCH",
    cookie: first.cookie,
    body: { name: "Fondo", openingBalance: "120.00" },
  }), 200);
  assert.equal((await editedResponse.json()).openingBalance, "120.00");

  await db.query(
    "INSERT INTO transactions (id, user_id, type, description, category, amount, destination_account_id, operation_date, updated_at) VALUES ($1, $2, 'income', 'Ingreso de prueba', 'salary', 1.00, $3, '2026-11-05', now())",
    [randomUUID(), first.user.id, account.id],
  );
  await expectStatus(await call(accountPath, {
    method: "PATCH",
    cookie: first.cookie,
    body: { openingBalance: "130.00" },
  }), 409);
  await expectStatus(await call(accountPath, {
    method: "PATCH",
    cookie: first.cookie,
    body: { name: "Fondo 2" },
  }), 200);

  const archivedResponse = await expectStatus(await call(`${accountPath}/archive`, {
    method: "POST",
    cookie: first.cookie,
  }), 200);
  assert.equal((await archivedResponse.json()).status, "archived");
  await expectStatus(await call(accountPath, {
    method: "PATCH",
    cookie: first.cookie,
    body: { name: "Otra" },
  }), 409);
  assert.deepEqual(await (await call("/api/v1/accounts?status=active", { cookie: first.cookie })).json(), []);
  assert.equal((await (await call("/api/v1/accounts?status=archived", { cookie: first.cookie })).json()).length, 1);

  await expectStatus(await call("/api/v1/accounts", {
    method: "POST",
    cookie: first.cookie,
    body: { ...accountInput, name: "Fondo 2" },
  }), 201);
  await expectStatus(await call(`${accountPath}/restore`, {
    method: "POST",
    cookie: first.cookie,
  }), 409);

  const activeAccounts = await (await call("/api/v1/accounts?status=active", { cookie: first.cookie })).json();
  await expectStatus(await call(`/api/v1/accounts/${activeAccounts[0].id}/archive`, {
    method: "POST",
    cookie: first.cookie,
  }), 200);
  const restoredResponse = await expectStatus(await call(`${accountPath}/restore`, {
    method: "POST",
    cookie: first.cookie,
  }), 200);
  assert.equal((await restoredResponse.json()).status, "active");

  console.log("Cuentas HTTP: CRUD, archivo, duplicados y aislamiento entre usuarios correctos.");
} finally {
  if (userIds.length > 0) {
    await db.query("DELETE FROM transactions WHERE user_id = ANY($1::uuid[])", [userIds]);
    await db.query("DELETE FROM accounts WHERE user_id = ANY($1::uuid[])", [userIds]);
    await db.query("DELETE FROM institutions WHERE user_id = ANY($1::uuid[])", [userIds]);
    await db.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
  }
  await db.end();
}
