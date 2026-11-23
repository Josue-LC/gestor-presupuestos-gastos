-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('checking', 'savings', 'cash', 'investment', 'other');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('income', 'expense', 'transfer');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('active', 'cancelled');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('created', 'updated', 'cancelled', 'restored', 'removed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "institution_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "opening_balance" DECIMAL(18,2) NOT NULL,
    "opening_date" DATE NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "category" VARCHAR(120),
    "amount" DECIMAL(18,2) NOT NULL,
    "source_account_id" UUID,
    "destination_account_id" UUID,
    "operation_date" DATE NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'active',
    "cancellation_reason" TEXT,
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_audit" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "reason" TEXT,
    "changes" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_id_user_id_key" ON "institutions"("id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_user_id_name_key" ON "institutions"("user_id", "name");

-- CreateIndex
CREATE INDEX "accounts_user_id_status_idx" ON "accounts"("user_id", "status");

-- CreateIndex
CREATE INDEX "accounts_user_id_institution_id_idx" ON "accounts"("user_id", "institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_id_user_id_key" ON "accounts"("id", "user_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_operation_date_status_idx" ON "transactions"("user_id", "operation_date", "status");

-- CreateIndex
CREATE INDEX "transactions_user_id_source_account_id_idx" ON "transactions"("user_id", "source_account_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_destination_account_id_idx" ON "transactions"("user_id", "destination_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_id_user_id_key" ON "transactions"("id", "user_id");

-- CreateIndex
CREATE INDEX "transaction_audit_user_id_transaction_id_occurred_at_idx" ON "transaction_audit"("user_id", "transaction_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_institution_id_user_id_fkey" FOREIGN KEY ("institution_id", "user_id") REFERENCES "institutions"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_account_id_user_id_fkey" FOREIGN KEY ("source_account_id", "user_id") REFERENCES "accounts"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_destination_account_id_user_id_fkey" FOREIGN KEY ("destination_account_id", "user_id") REFERENCES "accounts"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_audit" ADD CONSTRAINT "transaction_audit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_audit" ADD CONSTRAINT "transaction_audit_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_audit" ADD CONSTRAINT "transaction_audit_transaction_id_user_id_fkey" FOREIGN KEY ("transaction_id", "user_id") REFERENCES "transactions"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas financieras que Prisma Schema Language no expresa como CHECK.
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_currency_mxn_check"
  CHECK ("currency" = 'MXN');
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_name_not_blank_check"
  CHECK (length(btrim("name")) > 0);
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_name_not_blank_check"
  CHECK (length(btrim("name")) > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive_check"
  CHECK ("amount" > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_description_not_blank_check"
  CHECK (length(btrim("description")) > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accounts_by_type_check"
  CHECK (
    ("type" = 'income' AND "source_account_id" IS NULL AND "destination_account_id" IS NOT NULL AND "category" IS NOT NULL AND length(btrim("category")) > 0)
    OR ("type" = 'expense' AND "source_account_id" IS NOT NULL AND "destination_account_id" IS NULL AND "category" IS NOT NULL AND length(btrim("category")) > 0)
    OR ("type" = 'transfer' AND "source_account_id" IS NOT NULL AND "destination_account_id" IS NOT NULL AND "source_account_id" <> "destination_account_id" AND "category" IS NULL)
  );
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cancel_reason_check"
  CHECK (
    ("status" = 'active' AND "cancellation_reason" IS NULL)
    OR ("status" = 'cancelled' AND "cancellation_reason" IS NOT NULL AND length(btrim("cancellation_reason")) > 0)
  );
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expiry_check"
  CHECK ("expires_at" > "created_at");

CREATE UNIQUE INDEX "accounts_user_active_name_key"
  ON "accounts" ("user_id", lower("name")) WHERE "status" = 'active';
