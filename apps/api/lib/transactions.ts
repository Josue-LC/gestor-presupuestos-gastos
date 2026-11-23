import { Prisma, type Transaction, type TransactionAudit } from "@/generated/prisma/client";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { dateOnly, decimal } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/http";

const positiveMoney = z.string().regex(/^(?!0\.00$)(?:0|[1-9]\d{0,15})\.\d{2}$/);
const description = z.string().trim().min(1).max(255);
const category = z.string().trim().min(1).max(120);
const id = z.uuid();
const operationDate = z.iso.date();

export const transactionInputSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("income"), description, category, amount: positiveMoney,
    destinationAccountId: id, operationDate,
  }),
  z.strictObject({
    type: z.literal("expense"), description, category, amount: positiveMoney,
    sourceAccountId: id, operationDate,
  }),
  z.strictObject({
    type: z.literal("transfer"), description, amount: positiveMoney,
    sourceAccountId: id, destinationAccountId: id, operationDate,
  }),
]);

export const transactionPatchSchema = z.strictObject({
  description: description.optional(),
  category: category.optional(),
  amount: positiveMoney.optional(),
  sourceAccountId: id.optional(),
  destinationAccountId: id.optional(),
  operationDate: operationDate.optional(),
}).refine((data) => Object.keys(data).length > 0);

export const cancellationSchema = z.strictObject({
  reason: z.string().trim().min(1).max(1000),
});

export const transactionListSchema = z.strictObject({
  accountId: id.optional(),
  type: z.enum(["income", "expense", "transfer"]).optional(),
  status: z.enum(["active", "cancelled"]).optional(),
  from: operationDate.optional(),
  to: operationDate.optional(),
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).refine((value) => !value.from || !value.to || value.from <= value.to);

export type Candidate = {
  type: "income" | "expense" | "transfer";
  description: string;
  category: string | null;
  amount: string;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  operationDate: string;
};

export class DomainError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function candidateFromInput(
  input: z.infer<typeof transactionInputSchema>,
): Candidate {
  return {
    type: input.type,
    description: input.description,
    category: input.type === "transfer" ? null : input.category,
    amount: input.amount,
    sourceAccountId: input.type === "income" ? null : input.sourceAccountId,
    destinationAccountId: input.type === "expense" ? null : input.destinationAccountId,
    operationDate: input.operationDate,
  };
}

export function candidateFromTransaction(transaction: Transaction): Candidate {
  return {
    type: transaction.type,
    description: transaction.description,
    category: transaction.category,
    amount: transaction.amount.toFixed(2),
    sourceAccountId: transaction.sourceAccountId,
    destinationAccountId: transaction.destinationAccountId,
    operationDate: transaction.operationDate.toISOString().slice(0, 10),
  };
}

export function validateCandidate(candidate: Candidate): void {
  if (!description.safeParse(candidate.description).success ||
      !positiveMoney.safeParse(candidate.amount).success ||
      !operationDate.safeParse(candidate.operationDate).success) {
    throw new DomainError(400, "INVALID_INPUT", "Datos de movimiento inválidos.");
  }

  const source = candidate.sourceAccountId;
  const destination = candidate.destinationAccountId;
  if (candidate.type === "income" && (source !== null || !destination || !category.safeParse(candidate.category).success)) {
    throw new DomainError(400, "INVALID_INPUT", "Un ingreso requiere una cuenta de destino y una categoría.");
  }
  if (candidate.type === "expense" && (!source || destination !== null || !category.safeParse(candidate.category).success)) {
    throw new DomainError(400, "INVALID_INPUT", "Un gasto requiere una cuenta de origen y una categoría.");
  }
  if (candidate.type === "transfer" && (!source || !destination || source === destination || candidate.category !== null)) {
    throw new DomainError(400, "INVALID_INPUT", "La transferencia requiere dos cuentas distintas.");
  }
}

export async function validateAccounts(
  tx: Prisma.TransactionClient,
  userId: string,
  candidate: Candidate,
  previous?: Transaction,
): Promise<void> {
  const ids = [...new Set([candidate.sourceAccountId, candidate.destinationAccountId].filter((value): value is string => value !== null))];
  const accounts = await tx.account.findMany({ where: { userId, id: { in: ids } } });

  if (accounts.length !== ids.length) {
    throw new DomainError(404, "ACCOUNT_NOT_FOUND", "Cuenta no encontrada.");
  }

  for (const account of accounts) {
    const newlyLinked = !previous || (
      (account.id === candidate.sourceAccountId && account.id !== previous.sourceAccountId) ||
      (account.id === candidate.destinationAccountId && account.id !== previous.destinationAccountId)
    );
    if (newlyLinked && account.status !== "active") {
      throw new DomainError(409, "ACCOUNT_ARCHIVED", "La cuenta seleccionada está archivada.");
    }
    if (candidate.operationDate < account.openingDate.toISOString().slice(0, 10)) {
      throw new DomainError(400, "DATE_BEFORE_OPENING", "La fecha del movimiento es anterior a la apertura de la cuenta.");
    }
  }
}

export function transactionData(transaction: Transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    description: transaction.description,
    category: transaction.category,
    amount: transaction.amount.toFixed(2),
    sourceAccountId: transaction.sourceAccountId,
    destinationAccountId: transaction.destinationAccountId,
    operationDate: transaction.operationDate.toISOString().slice(0, 10),
    status: transaction.status,
    cancellationReason: transaction.cancellationReason,
    registeredAt: transaction.registeredAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

type Snapshot = Record<string, string | null>;

function snapshot(transaction: Transaction): Snapshot {
  const data = transactionData(transaction);
  return {
    type: data.type,
    description: data.description,
    category: data.category,
    amount: data.amount,
    sourceAccountId: data.sourceAccountId,
    destinationAccountId: data.destinationAccountId,
    operationDate: data.operationDate,
    status: data.status,
    cancellationReason: data.cancellationReason,
  };
}

export function auditChanges(previous: Transaction | null, current: Transaction) {
  const before = previous ? snapshot(previous) : {} as Snapshot;
  const after = snapshot(current);
  return Object.entries(after)
    .filter(([field, value]) => !previous || before[field] !== value)
    .map(([field, value]) => ({
      field,
      previousValue: previous ? before[field] : null,
      newValue: value,
    }));
}

export function auditData(event: TransactionAudit) {
  return {
    id: event.id,
    transactionId: event.transactionId,
    actorUserId: event.actorUserId,
    action: event.action,
    reason: event.reason,
    changes: event.changes,
    occurredAt: event.occurredAt.toISOString(),
  };
}

export function writeData(candidate: Candidate) {
  return {
    type: candidate.type,
    description: candidate.description,
    category: candidate.category,
    amount: decimal(candidate.amount),
    sourceAccountId: candidate.sourceAccountId,
    destinationAccountId: candidate.destinationAccountId,
    operationDate: dateOnly(candidate.operationDate),
  };
}

export async function financialWrite<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10_000,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("La operación financiera no pudo completarse.");
}

export function encodeCursor(transaction: Transaction): string {
  return Buffer.from(JSON.stringify({
    date: transaction.operationDate.toISOString().slice(0, 10),
    id: transaction.id,
  })).toString("base64url");
}

export function decodeCursor(value: string): { date: string; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const item = parsed as Record<string, unknown>;
    if (!operationDate.safeParse(item.date).success || !id.safeParse(item.id).success) return null;
    return { date: item.date as string, id: item.id as string };
  } catch {
    return null;
  }
}

export function transactionFailure(request: NextRequest, error: unknown, action: string) {
  if (error instanceof DomainError) {
    return apiError(request, error.status, error.code, error.message);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    return apiError(request, 409, "CONCURRENT_UPDATE", "La información cambió; vuelve a intentar.");
  }
  console.error(`Falló ${action}:`, error);
  return apiError(request, 500, "INTERNAL_ERROR", "No fue posible completar la operación.");
}
