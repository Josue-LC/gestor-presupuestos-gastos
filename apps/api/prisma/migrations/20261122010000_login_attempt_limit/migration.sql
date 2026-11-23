CREATE TABLE "login_attempts" (
    "identifier_hash" CHAR(64) NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "first_failed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMPTZ(3),
    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("identifier_hash"),
    CONSTRAINT "login_attempts_count_check" CHECK ("failed_count" BETWEEN 0 AND 3)
);
