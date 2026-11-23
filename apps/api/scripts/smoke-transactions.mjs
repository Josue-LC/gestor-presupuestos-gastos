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
  const response = await expectStatus(await call("/api/v1/auth/register", {
    method: "POST",
    body: { email: `transactions-${randomUUID()}@example.test`, password },
  }), 201);
  const user = await response.json();
  userIds.push(user.id);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  return { user, cookie };
}

async function account(cookie, name, openingBalance) {
  const response = await expectStatus(await call("/api/v1/accounts", {
    method: "POST",
    cookie,
    body: {
      name,
      type: "checking",
      openingBalance,
      openingDate: "2026-11-01",
    },
  }), 201);
  return response.json();
}

async function balance(cookie, accountId, date = "2026-11-30") {
  const response = await expectStatus(await call(
    `/api/v1/accounts/${accountId}/balance?asOfDate=${date}`,
    { cookie },
  ), 200);
  return (await response.json()).balance;
}

await db.connect();

try {
  const first = await register();
  const second = await register();
  const source = await account(first.cookie, "Origen", "100.00");
  const destination = await account(first.cookie, "Destino", "0.00");
  const otherAccount = await account(second.cookie, "Cuenta ajena", "500.00");

  await expectStatus(await call("/api/v1/transactions"), 401);
  assert.equal(await balance(first.cookie, source.id), "100.00");

  const income = await (await expectStatus(await call("/api/v1/transactions", {
    method: "POST", cookie: first.cookie,
    body: {
      type: "income", description: "Nómina", category: "salary",
      amount: "50.00", destinationAccountId: source.id,
      operationDate: "2026-11-05",
    },
  }), 201)).json();
  assert.equal(await balance(first.cookie, source.id), "150.00");

  const expense = await (await expectStatus(await call("/api/v1/transactions", {
    method: "POST", cookie: first.cookie,
    body: {
      type: "expense", description: "Supermercado", category: "food",
      amount: "20.00", sourceAccountId: source.id,
      operationDate: "2026-11-06",
    },
  }), 201)).json();

  const transfer = await (await expectStatus(await call("/api/v1/transactions", {
    method: "POST", cookie: first.cookie,
    body: {
      type: "transfer", description: "Ahorro", amount: "30.00",
      sourceAccountId: source.id, destinationAccountId: destination.id,
      operationDate: "2026-11-07",
    },
  }), 201)).json();
  assert.equal(await balance(first.cookie, source.id), "100.00");
  assert.equal(await balance(first.cookie, destination.id), "30.00");
  assert.equal(await balance(first.cookie, source.id, "2026-11-05"), "150.00");

  await expectStatus(await call("/api/v1/transactions", {
    method: "POST", cookie: first.cookie,
    body: {
      type: "transfer", description: "Inválida", amount: "1.00",
      sourceAccountId: source.id, destinationAccountId: source.id,
      operationDate: "2026-11-07",
    },
  }), 400);
  await expectStatus(await call("/api/v1/transactions", {
    method: "POST", cookie: second.cookie,
    body: {
      type: "income", description: "Ajeno", category: "salary",
      amount: "1.00", destinationAccountId: source.id,
      operationDate: "2026-11-07",
    },
  }), 404);
  await expectStatus(await call("/api/v1/transactions", {
    method: "POST", cookie: first.cookie,
    body: {
      type: "income", description: "Antes de apertura", category: "salary",
      amount: "1.00", destinationAccountId: source.id,
      operationDate: "2026-10-31",
    },
  }), 400);

  const firstPage = await (await expectStatus(await call(
    "/api/v1/transactions?limit=2", { cookie: first.cookie },
  ), 200)).json();
  assert.deepEqual(firstPage.items.map((item) => item.id), [transfer.id, expense.id]);
  assert.ok(firstPage.nextCursor);
  const secondPage = await (await expectStatus(await call(
    `/api/v1/transactions?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
    { cookie: first.cookie },
  ), 200)).json();
  assert.deepEqual(secondPage.items.map((item) => item.id), [income.id]);
  assert.equal(secondPage.nextCursor, null);
  await expectStatus(await call("/api/v1/transactions?cursor=bad", { cookie: first.cookie }), 400);
  const destinationItems = await (await call(
    `/api/v1/transactions?accountId=${destination.id}`, { cookie: first.cookie },
  )).json();
  assert.deepEqual(destinationItems.items.map((item) => item.id), [transfer.id]);
  assert.deepEqual((await (await call("/api/v1/transactions", { cookie: second.cookie })).json()).items, []);

  const transactionPath = `/api/v1/transactions/${income.id}`;
  await expectStatus(await call(transactionPath, { cookie: second.cookie }), 404);
  await expectStatus(await call(transactionPath, {
    method: "PATCH", cookie: second.cookie, body: { amount: "60.00" },
  }), 404);
  await expectStatus(await call(`${transactionPath}/cancel`, {
    method: "POST", cookie: second.cookie, body: { reason: "Ajeno" },
  }), 404);
  await expectStatus(await call(`${transactionPath}/restore`, {
    method: "POST", cookie: second.cookie,
  }), 404);
  await expectStatus(await call(`${transactionPath}/audit`, { cookie: second.cookie }), 404);
  await expectStatus(await call(
    `/api/v1/accounts/${source.id}/balance?asOfDate=2026-11-30`,
    { cookie: second.cookie },
  ), 404);
  assert.equal(await balance(second.cookie, otherAccount.id), "500.00");

  const beforeNoop = await (await call(transactionPath, { cookie: first.cookie })).json();
  const noopResponse = await expectStatus(await call(transactionPath, {
    method: "PATCH", cookie: first.cookie, body: { description: "Nómina" },
  }), 200);
  assert.equal((await noopResponse.json()).updatedAt, beforeNoop.updatedAt);

  await expectStatus(await call(transactionPath, {
    method: "PATCH", cookie: first.cookie, body: { amount: "60.00" },
  }), 200);
  assert.equal(await balance(first.cookie, source.id), "110.00");
  await expectStatus(await call(`/api/v1/transactions/${expense.id}/cancel`, {
    method: "POST", cookie: first.cookie, body: { reason: "Duplicado" },
  }), 200);
  assert.equal(await balance(first.cookie, source.id), "130.00");
  await expectStatus(await call(`/api/v1/transactions/${expense.id}/cancel`, {
    method: "POST", cookie: first.cookie, body: { reason: "Otra vez" },
  }), 409);
  await expectStatus(await call(`/api/v1/transactions/${expense.id}/restore`, {
    method: "POST", cookie: first.cookie,
  }), 200);
  assert.equal(await balance(first.cookie, source.id), "110.00");

  const incomeAudit = await (await expectStatus(await call(
    `${transactionPath}/audit`, { cookie: first.cookie },
  ), 200)).json();
  assert.deepEqual(incomeAudit.map((event) => event.action), ["created", "updated"]);
  assert.ok(incomeAudit.every((event) => event.actorUserId === first.user.id));
  const expenseAudit = await (await call(
    `/api/v1/transactions/${expense.id}/audit`, { cookie: first.cookie },
  )).json();
  assert.deepEqual(expenseAudit.map((event) => event.action), ["created", "cancelled", "restored"]);

  const adjustable = await account(first.cookie, "Fecha ajustable", "0.00");
  const earlyMovement = await (await expectStatus(await call("/api/v1/transactions", {
    method: "POST", cookie: first.cookie,
    body: {
      type: "income", description: "Movimiento temprano", category: "salary",
      amount: "1.00", destinationAccountId: adjustable.id,
      operationDate: "2026-11-05",
    },
  }), 201)).json();
  await expectStatus(await call(`/api/v1/transactions/${earlyMovement.id}/cancel`, {
    method: "POST", cookie: first.cookie, body: { reason: "Ajuste" },
  }), 200);
  await expectStatus(await call(`/api/v1/accounts/${adjustable.id}`, {
    method: "PATCH", cookie: first.cookie, body: { openingDate: "2026-11-06" },
  }), 200);
  await expectStatus(await call(`/api/v1/transactions/${earlyMovement.id}/restore`, {
    method: "POST", cookie: first.cookie,
  }), 400);

  await expectStatus(await call(`/api/v1/accounts/${source.id}`, {
    method: "PATCH", cookie: first.cookie, body: { openingBalance: "200.00" },
  }), 409);
  await expectStatus(await call(
    `/api/v1/accounts/${source.id}/balance?asOfDate=2026-10-31`,
    { cookie: first.cookie },
  ), 400);

  console.log("Movimientos HTTP: saldos, auditoría, paginación y aislamiento correctos.");
} finally {
  if (userIds.length > 0) {
    await db.query("DELETE FROM transaction_audit WHERE user_id = ANY($1::uuid[])", [userIds]);
    await db.query("DELETE FROM transactions WHERE user_id = ANY($1::uuid[])", [userIds]);
    await db.query("DELETE FROM accounts WHERE user_id = ANY($1::uuid[])", [userIds]);
    await db.query("DELETE FROM institutions WHERE user_id = ANY($1::uuid[])", [userIds]);
    await db.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
  }
  await db.end();
}
