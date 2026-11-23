import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 3;

export function identifierHashForEmail(email: string): string {
  return createHash("sha256").update(`login:${email}`).digest("hex");
}

export function retryAfterSeconds(lockedUntil: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1_000));
}

export async function getLoginLock(email: string): Promise<Date | null> {
  const attempt = await prisma.loginAttempt.findUnique({
    where: { identifierHash: identifierHashForEmail(email) },
  });

  return attempt?.lockedUntil && attempt.lockedUntil > new Date()
    ? attempt.lockedUntil
    : null;
}

export async function recordLoginFailure(email: string): Promise<Date | null> {
  const key = identifierHashForEmail(email);

  // El UPSERT incrementa de forma atómica aunque lleguen intentos simultáneos.
  // Al vencer la ventana o el bloqueo, el siguiente fallo empieza una ventana nueva.
  const rows = await prisma.$queryRaw<Array<{ locked_until: Date | null }>>`
    INSERT INTO "login_attempts"
      ("identifier_hash", "failed_count", "first_failed_at", "locked_until")
    VALUES (${key}, 1, CURRENT_TIMESTAMP, NULL)
    ON CONFLICT ("identifier_hash") DO UPDATE SET
      "failed_count" = CASE
        WHEN "login_attempts"."locked_until" > CURRENT_TIMESTAMP
          THEN "login_attempts"."failed_count"
        WHEN "login_attempts"."first_failed_at" <= CURRENT_TIMESTAMP - (${WINDOW_MINUTES} * INTERVAL '1 minute')
          OR "login_attempts"."locked_until" <= CURRENT_TIMESTAMP
          THEN 1
        ELSE LEAST("login_attempts"."failed_count" + 1, ${MAX_FAILURES})
      END,
      "first_failed_at" = CASE
        WHEN "login_attempts"."locked_until" > CURRENT_TIMESTAMP
          THEN "login_attempts"."first_failed_at"
        WHEN "login_attempts"."first_failed_at" <= CURRENT_TIMESTAMP - (${WINDOW_MINUTES} * INTERVAL '1 minute')
          OR "login_attempts"."locked_until" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP
        ELSE "login_attempts"."first_failed_at"
      END,
      "locked_until" = CASE
        WHEN "login_attempts"."locked_until" > CURRENT_TIMESTAMP
          THEN "login_attempts"."locked_until"
        WHEN "login_attempts"."first_failed_at" <= CURRENT_TIMESTAMP - (${WINDOW_MINUTES} * INTERVAL '1 minute')
          OR "login_attempts"."locked_until" <= CURRENT_TIMESTAMP
          THEN NULL
        WHEN "login_attempts"."failed_count" + 1 >= ${MAX_FAILURES}
          THEN CURRENT_TIMESTAMP + (${WINDOW_MINUTES} * INTERVAL '1 minute')
        ELSE NULL
      END
    RETURNING "locked_until"
  `;

  return rows[0]?.locked_until ?? null;
}

