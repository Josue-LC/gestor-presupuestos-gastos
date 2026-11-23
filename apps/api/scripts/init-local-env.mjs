import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env") || existsSync(".db.env")) {
  console.error("Ya existe .env o .db.env; no se sobrescribieron credenciales.");
  process.exitCode = 1;
} else {
  const password = randomBytes(24).toString("hex");
  const database = "gestor_presupuestos";
  const user = "gestor_api";

  writeFileSync(
    ".db.env",
    `POSTGRES_DB=${database}\nPOSTGRES_USER=${user}\nPOSTGRES_PASSWORD=${password}\n`,
    { mode: 0o600 },
  );
  writeFileSync(
    ".env",
    `DATABASE_URL="postgresql://${user}:${password}@localhost:5432/${database}?schema=public"\nWEB_ORIGIN="http://localhost:3000"\nAPI_ORIGIN="http://localhost:3001"\n`,
    { mode: 0o600 },
  );
  console.log("Credenciales locales creadas en .env y .db.env.");
}
