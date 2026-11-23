import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const email = `smoke-${randomUUID()}@example.test`;
const secondEmail = `smoke-${randomUUID()}@example.test`;
const password = `Test-${randomUUID()}!`;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const userIds = [];

async function call(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Origin: origin,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
}

try {
  const anonymous = await call("/api/v1/auth/me");
  assert.equal(anonymous.status, 401);

  const registration = await call("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert.equal(registration.status, 201);
  const registered = await registration.json();
  userIds.push(registered.id);
  assert.equal(registered.email, email);
  assert.equal("passwordHash" in registered, false);
  const setCookie = registration.headers.get("set-cookie");
  assert.match(setCookie ?? "", /HttpOnly/i);
  assert.match(setCookie ?? "", /SameSite=Lax/i);
  const cookie = setCookie.split(";")[0];

  const current = await call("/api/v1/auth/me", {
    headers: { Cookie: cookie },
  });
  assert.equal(current.status, 200);
  assert.equal((await current.json()).id, registered.id);

  const secondRegistration = await call("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: secondEmail, password }),
  });
  assert.equal(secondRegistration.status, 201);
  const secondUser = await secondRegistration.json();
  userIds.push(secondUser.id);
  const secondCookie = secondRegistration.headers.get("set-cookie")?.split(";")[0];
  assert.ok(secondCookie);
  assert.notEqual(secondCookie, cookie);
  const secondCurrent = await call("/api/v1/auth/me", {
    headers: { Cookie: secondCookie },
  });
  assert.equal((await secondCurrent.json()).id, secondUser.id);

  for (let number = 1; number <= 3; number += 1) {
    const failedLogin = await call("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: secondEmail, password: "Wrong-password-123!" }),
    });
    assert.equal(failedLogin.status, number === 3 ? 429 : 401);
    if (number === 3) {
      const retryAfter = Number(failedLogin.headers.get("retry-after"));
      assert.ok(retryAfter > 0 && retryAfter <= 900);
    }
  }

  const blockedLogin = await call("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: secondEmail, password }),
  });
  assert.equal(blockedLogin.status, 429);

  // Simula el vencimiento del bloqueo sin esperar quince minutos reales.
  const secondIdentifierHash = createHash("sha256")
    .update(`login:${secondEmail}`)
    .digest("hex");
  const expiryDb = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await expiryDb.connect();
    await expiryDb.query(
      "UPDATE login_attempts SET locked_until = now() - interval '1 minute', first_failed_at = now() - interval '16 minutes' WHERE identifier_hash = $1",
      [secondIdentifierHash],
    );
  } finally {
    await expiryDb.end();
  }

  const afterTimeout = await call("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: secondEmail, password }),
  });
  assert.equal(afterTimeout.status, 200);

  const duplicate = await call("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert.equal(duplicate.status, 409);

  const logout = await call("/api/v1/auth/logout", {
    method: "POST",
    headers: { Cookie: cookie },
  });
  assert.equal(logout.status, 204);

  const revoked = await call("/api/v1/auth/me", {
    headers: { Cookie: cookie },
  });
  assert.equal(revoked.status, 401);
  const otherSession = await call("/api/v1/auth/me", {
    headers: { Cookie: secondCookie },
  });
  assert.equal(otherSession.status, 200);

  const invalidLogin = await call("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "Wrong-password-123!" }),
  });
  assert.equal(invalidLogin.status, 401);

  const login = await call("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const newCookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(newCookie);
  assert.notEqual(newCookie, cookie);

  const forgedOrigin = await fetch(`${baseUrl}/api/v1/auth/logout`, {
    method: "POST",
    headers: { Origin: "https://untrusted.example", Cookie: newCookie },
  });
  assert.equal(forgedOrigin.status, 403);

  console.log("Autenticación HTTP: dos usuarios, bloqueo al tercer fallo y reingreso correctos.");
} finally {
  if (userIds.length > 0) {
    await db.connect();
    const identifierHashes = [email, secondEmail].map((value) =>
      createHash("sha256").update(`login:${value}`).digest("hex"),
    );
    await db.query(
      "DELETE FROM login_attempts WHERE identifier_hash = ANY($1::char(64)[])",
      [identifierHashes],
    );
    await db.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    await db.end();
  }
}
