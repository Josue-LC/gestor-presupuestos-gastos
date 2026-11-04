// transaction-audit service
import type { Transaction } from "@/components/transactions/TransactionList";

import type {
  TransactionAuditAction,
  TransactionAuditChange,
  TransactionAuditEvent,
  TransactionAuditSnapshot,
} from "@/types/transaction-audit";

const DEMO_ACTOR = "Usuario de demostración";

function createAuditId(): string {
  return `audit-${crypto.randomUUID()}`;
}

function getSnapshot(transaction: Transaction): TransactionAuditSnapshot {
  return {
    description: transaction.description,
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category,
    account: transaction.account,
    date: transaction.date,
    registeredAt: transaction.registeredAt ?? null,
    status: transaction.status === "cancelled" ? "cancelled" : "active",
    cancellationReason: transaction.cancellationReason ?? null,
  };
}

function createAuditEvent(
  transactionId: string,
  action: TransactionAuditAction,
  changes: TransactionAuditChange[],
  reason?: string,
): TransactionAuditEvent {
  return {
    id: createAuditId(),
    transactionId,
    action,
    timestamp: new Date().toISOString(),
    actor: DEMO_ACTOR,
    reason,
    changes,
  };
}

export function createTransactionAuditEvent(
  transaction: Transaction,
): TransactionAuditEvent {
  const snapshot = getSnapshot(transaction);

  const changes: TransactionAuditChange[] = (
    Object.keys(snapshot) as Array<keyof TransactionAuditSnapshot>
  ).map((field) => ({
    field,
    previousValue: null,
    newValue: snapshot[field],
  }));

  const event = createAuditEvent(transaction.id, "created", changes);

  return {
    ...event,
    timestamp: transaction.registeredAt ?? event.timestamp,
  };
}

export function createTransactionUpdateAuditEvent(
  previousTransaction: Transaction,
  updatedTransaction: Transaction,
): TransactionAuditEvent | null {
  const previous = getSnapshot(previousTransaction);
  const updated = getSnapshot(updatedTransaction);

  const fields = Object.keys(previous) as Array<keyof TransactionAuditSnapshot>;

  const changes: TransactionAuditChange[] = fields
    .filter((field) => previous[field] !== updated[field])
    .map((field) => ({
      field,
      previousValue: previous[field],
      newValue: updated[field],
    }));

  if (changes.length === 0) return null;

  return createAuditEvent(updatedTransaction.id, "updated", changes);
}

export function createTransactionCancellationAuditEvent(
  transaction: Transaction,
  reason: string,
): TransactionAuditEvent {
  if (transaction.status === "cancelled") {
    throw new Error("No se puede cancelar un movimiento que ya está cancelado.");
  }

  const normalizedReason = reason.trim();

  if (!normalizedReason) {
    throw new Error("El motivo de cancelación es obligatorio.");
  }

  return createAuditEvent(
    transaction.id,
    "cancelled",
    [
      {
        field: "status",
        previousValue: "active",
        newValue: "cancelled",
      },
      {
        field: "cancellationReason",
        previousValue: null,
        newValue: normalizedReason,
      },
    ],
    normalizedReason,
  );
}

export function createTransactionRestoreAuditEvent(
  transaction: Transaction,
): TransactionAuditEvent {
  if (transaction.status !== "cancelled") {
    throw new Error("Solo se pueden restaurar movimientos cancelados.");
  }

  const previousReason = transaction.cancellationReason ?? null;

  return createAuditEvent(
    transaction.id,
    "restored",
    [
      {
        field: "status",
        previousValue: "cancelled",
        newValue: "active",
      },
      {
        field: "cancellationReason",
        previousValue: previousReason,
        newValue: null,
      },
    ],
    "Se revirtió la cancelación del movimiento.",
  );
}

export function createTransactionRemovalAuditEvent(
  transaction: Transaction,
): TransactionAuditEvent {
  if (transaction.status !== "cancelled") {
    throw new Error("Solo se pueden retirar movimientos cancelados.");
  }

  const snapshot = getSnapshot(transaction);

  const changes: TransactionAuditChange[] = (
    Object.keys(snapshot) as Array<keyof TransactionAuditSnapshot>
  ).map((field) => ({
    field,
    previousValue: snapshot[field],
    newValue: null,
  }));

  return createAuditEvent(
    transaction.id,
    "removed",
    changes,
    "Se retiró de la lista un movimiento previamente cancelado.",
  );
}
