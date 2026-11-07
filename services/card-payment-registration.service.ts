import type { Transaction } from "@/components/transactions/TransactionList";
import type {
  CardPaymentAllocationMode,
} from "@/types/account";

import {
  loadAccountStorage,
} from "@/services/account-storage.service";

import {
  loadTransactionStorage,
  saveTransactionStorage,
} from "@/services/transaction-storage.service";

import {
  createTransactionAuditEvent,
} from "@/services/transaction-audit.service";

import {
  registerCardPayment,
  type CardPaymentResult,
  type ManualCardPaymentAllocation,
} from "@/services/card-payment.service";

export interface RegisterCardPaymentFromAccountData {
  cardId: string;
  sourceAccountId: string;
  amount: number;
  paidAt: string;
  allocationMode: CardPaymentAllocationMode;
  allocations?: ManualCardPaymentAllocation[];
}

export interface RegisterInstallmentPaymentData {
  cardId: string;
  sourceAccountId: string;
  installmentId: string;
  amount: number;
  paidAt: string;
}

export interface CardPaymentRegistrationResult {
  transaction: Transaction;
  paymentResult: CardPaymentResult;
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function isValidAmount(amount: number): boolean {
  return (
    Number.isFinite(amount) &&
    amount > 0 &&
    roundMoney(amount) === amount
  );
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getLocalDateString(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createPaymentTransaction(
  data: RegisterCardPaymentFromAccountData,
  cardName: string,
): Transaction {
  const now = new Date().toISOString();

  return {
    id: `transaction-${crypto.randomUUID()}`,
    description: `Pago a tarjeta ${cardName}`,
    category: "Pago de tarjeta",
    account: `${data.sourceAccountId} → card:${data.cardId}`,
    date: data.paidAt,
    registeredAt: now,
    amount: roundMoney(data.amount),
    type: "transfer",
    status: "active",
  };
}

/**
 * Registra un pago de tarjeta respaldado por una transferencia.
 *
 * Primero guarda el movimiento y su auditoría.
 * Después registra el pago y sus aplicaciones.
 *
 * Si falla el registro del pago, intenta restaurar
 * el almacenamiento original de movimientos.
 */
export function registerCardPaymentFromAccount(
  data: RegisterCardPaymentFromAccountData,
): CardPaymentRegistrationResult {
  if (!data.cardId.trim()) {
    throw new Error("Debes seleccionar una tarjeta.");
  }

  if (!data.sourceAccountId.trim()) {
    throw new Error("Debes seleccionar una cuenta de origen.");
  }

  if (!isValidAmount(data.amount)) {
    throw new Error(
      "El importe debe ser mayor a cero y tener máximo dos decimales.",
    );
  }

  if (!isValidDate(data.paidAt)) {
    throw new Error("La fecha del pago no es válida.");
  }

  if (data.paidAt > getLocalDateString()) {
    throw new Error("La fecha del pago no puede ser futura.");
  }

  const accountStorage = loadAccountStorage();

  if (!accountStorage) {
    throw new Error("No hay información de cuentas disponible.");
  }

  const card = accountStorage.cards.find(
    (item) => item.id === data.cardId,
  );

  if (
    !card ||
    card.type !== "credit" ||
    card.status !== "active"
  ) {
    throw new Error("La tarjeta de crédito no está disponible.");
  }

  const sourceAccount = accountStorage.accounts.find(
    (item) => item.id === data.sourceAccountId,
  );

  if (!sourceAccount || sourceAccount.status !== "active") {
    throw new Error("La cuenta de origen no está disponible.");
  }

  const originalTransactionStorage = loadTransactionStorage();

  const transaction = createPaymentTransaction(
    data,
    card.name,
  );

  const auditEvent = createTransactionAuditEvent(transaction);

  const updatedTransactionStorage = {
    ...originalTransactionStorage,
    transactions: [
      ...originalTransactionStorage.transactions,
      transaction,
    ],
    auditEvents: [
      ...originalTransactionStorage.auditEvents,
      auditEvent,
    ],
  };

  if (!saveTransactionStorage(updatedTransactionStorage)) {
    throw new Error(
      "No fue posible registrar la transferencia del pago.",
    );
  }

  try {
    const paymentResult = registerCardPayment({
      cardId: data.cardId,
      transactionId: transaction.id,
      paidAt: data.paidAt,
      allocationMode: data.allocationMode,
      allocations: data.allocations,
    });

    return {
      transaction,
      paymentResult,
    };
  } catch (error) {
    const rollbackSucceeded = saveTransactionStorage(
      originalTransactionStorage,
    );

    if (!rollbackSucceeded) {
      throw new Error(
        "El pago no pudo registrarse y tampoco fue posible revertir la transferencia. Revisa los movimientos antes de volver a intentarlo.",
      );
    }

    throw error;
  }
}

/**
 * Registra el pago de una parcialidad concreta.
 *
 * La distribución manual contiene una sola aplicación:
 * la parcialidad seleccionada.
 */
export function registerInstallmentPaymentFromAccount(
  data: RegisterInstallmentPaymentData,
): CardPaymentRegistrationResult {
  if (!data.installmentId.trim()) {
    throw new Error("Debes seleccionar una parcialidad.");
  }

  return registerCardPaymentFromAccount({
    cardId: data.cardId,
    sourceAccountId: data.sourceAccountId,
    amount: data.amount,
    paidAt: data.paidAt,
    allocationMode: "manual",
    allocations: [
      {
        type: "installment",
        installmentId: data.installmentId,
        amount: data.amount,
      },
    ],
  });
}