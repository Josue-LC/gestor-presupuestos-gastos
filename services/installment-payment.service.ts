// installment-payment service
import type {
  CardPaymentAllocation,
  Installment,
  InstallmentPayment,
} from "@/types/account";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "@/services/account-storage.service";

import type { AccountStorageData } from "@/services/account-storage.service";

import { loadTransactionStorage } from "@/services/transaction-storage.service";

export interface RegisterInstallmentPaymentData {
  installmentId: string;
  amount: number;
  paidAt: string;
  method: InstallmentPayment["method"];
  transactionId?: string | null;
  /**
   * Identificador del pago global que origina este abono.
   * Es obligatorio para los nuevos pagos.
   */
  cardPaymentId?: string;
}

function generateId(): string {
  return crypto.randomUUID();
}

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function isValidMoney(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && roundMoney(amount) === amount;
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getInstallmentStatus(
  amount: number,
  paidAmount: number,
): Installment["status"] {
  if (paidAmount >= amount) {
    return "paid";
  }

  if (paidAmount > 0) {
    return "partial";
  }

  return "pending";
}

function validateInstallmentPayments(installment: Installment): void {
  if (
    !Number.isFinite(installment.amount) ||
    installment.amount <= 0 ||
    roundMoney(installment.amount) !== installment.amount ||
    !Number.isFinite(installment.paidAmount) ||
    installment.paidAmount < 0 ||
    roundMoney(installment.paidAmount) !== installment.paidAmount
  ) {
    throw new Error(
      "La información financiera de la parcialidad no es válida.",
    );
  }

  const payments = installment.payments ?? [];

  for (const payment of payments) {
    if (
      payment.installmentId !== installment.id ||
      !isValidMoney(payment.amount) ||
      !isValidDate(payment.paidAt) ||
      (payment.method !== "manual" && payment.method !== "transaction") ||
      (payment.method === "manual" && payment.transactionId != null) ||
      (payment.method === "transaction" &&
        (typeof payment.transactionId !== "string" ||
          !payment.transactionId.trim()))
    ) {
      throw new Error(
        "El historial de pagos de la parcialidad contiene información no válida.",
      );
    }
  }

  const paymentsTotal = roundMoney(
    payments.reduce((total, payment) => total + payment.amount, 0),
  );

  if (paymentsTotal !== roundMoney(installment.paidAmount)) {
    throw new Error(
      "El saldo pagado no coincide con los pagos registrados en la parcialidad.",
    );
  }

  if (installment.paidAmount > installment.amount) {
    throw new Error(
      "La parcialidad tiene un importe pagado superior al importe establecido.",
    );
  }

  const expectedStatus = getInstallmentStatus(
    installment.amount,
    installment.paidAmount,
  );

  if (installment.status !== expectedStatus) {
    throw new Error(
      "El estado de la parcialidad no coincide con su importe pagado.",
    );
  }
}

// -----------------------------------------------------------------------------
// CONSULTAS
// -----------------------------------------------------------------------------

export function getInstallmentPayments(
  installmentId: string,
): InstallmentPayment[] {
  const storage = loadAccountStorage();

  const installment = storage?.installments.find(
    (item) => item.id === installmentId,
  );

  return installment?.payments ?? [];
}

export function getInstallmentTotalPaid(installmentId: string): number {
  const payments = getInstallmentPayments(installmentId);

  return roundMoney(
    payments.reduce((total, payment) => total + payment.amount, 0),
  );
}

export function getInstallmentRemaining(installmentId: string): number {
  const storage = loadAccountStorage();

  const installment = storage?.installments.find(
    (item) => item.id === installmentId,
  );

  if (!installment) {
    return 0;
  }

  return Math.max(0, roundMoney(installment.amount - installment.paidAmount));
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE RELACIONES FINANCIERAS
// -----------------------------------------------------------------------------

function validateInstallmentRelations(
  installment: Installment,
  accountStorage: AccountStorageData = loadAccountStorage(),
): void {
  if (!accountStorage) {
    throw new Error("No hay información de cuentas disponible.");
  }

  const plan = accountStorage.installmentPlans.find(
    (item) => item.id === installment.planId,
  );

  if (!plan || plan.status !== "active") {
    throw new Error("El plan de parcialidades no está activo.");
  }

  const purchase = accountStorage.purchases.find(
    (item) => item.id === plan.cardPurchaseId,
  );

  if (!purchase || purchase.status !== "active") {
    throw new Error("No se encontró la compra asociada al plan.");
  }

  if (
    purchase.purchaseType !== "installments" ||
    purchase.installmentPlanId !== plan.id
  ) {
    throw new Error(
      "La relación entre la compra y el plan de parcialidades no es válida.",
    );
  }

  if (
    purchase.installmentCount !== plan.installmentCount ||
    purchase.firstDueDate !== plan.firstDueDate ||
    roundMoney(purchase.amount) !== roundMoney(plan.totalAmount)
  ) {
    throw new Error("La configuración del plan no coincide con la compra MSI.");
  }

  const card = accountStorage.cards.find((item) => item.id === purchase.cardId);

  if (!card || card.type !== "credit") {
    throw new Error("La tarjeta de crédito asociada a la compra no es válida.");
  }

  const planInstallments = accountStorage.installments
    .filter((item) => item.planId === plan.id)
    .sort((a, b) => a.installmentNumber - b.installmentNumber);

  if (planInstallments.length !== plan.installmentCount) {
    throw new Error(
      "El número de parcialidades registradas no coincide con el plan.",
    );
  }

  const currentInstallment = planInstallments.find(
    (item) => item.id === installment.id,
  );

  if (!currentInstallment) {
    throw new Error("La parcialidad no pertenece al plan indicado.");
  }
}

// -----------------------------------------------------------------------------
// APLICACIÓN DE UN PAGO GLOBAL A UNA PARCIALIDAD MSI
// -----------------------------------------------------------------------------

export interface ApplyCardPaymentToInstallmentData {
  installmentId: string;
  cardPaymentId: string;
  amount: number;
}

/**
 * Aplica una parte de un pago global a una parcialidad MSI.
 *
 * Esta función NO persiste información. Devuelve un nuevo snapshot para que
 * card-payment.service.ts pueda guardar el pago global, la aplicación y el
 * historial MSI en una sola operación de almacenamiento.
 */
export function applyCardPaymentToInstallment(
  storage: AccountStorageData,
  data: ApplyCardPaymentToInstallmentData,
): {
  storage: AccountStorageData;
  payment: InstallmentPayment;
  allocation: CardPaymentAllocation;
} {
  if (!storage) {
    throw new Error("No hay información de cuentas disponible.");
  }

  if (!isValidMoney(data.amount)) {
    throw new Error(
      "El importe aplicado debe ser válido y tener máximo dos decimales.",
    );
  }

  const cardPayment = storage.cardPayments.find(
    (item) => item.id === data.cardPaymentId,
  );

  if (!cardPayment) {
    throw new Error("No se encontró el pago global indicado.");
  }

  const installment = storage.installments.find(
    (item) => item.id === data.installmentId,
  );

  if (!installment) {
    throw new Error("No se encontró la parcialidad indicada.");
  }

  validateInstallmentRelations(installment, storage);
  validateInstallmentPayments(installment);

  const plan = storage.installmentPlans.find(
    (item) => item.id === installment.planId,
  );

  const purchase = plan
    ? storage.purchases.find((item) => item.id === plan.cardPurchaseId)
    : undefined;

  if (!plan || !purchase) {
    throw new Error("No se encontró la compra o el plan MSI asociado.");
  }

  if (cardPayment.cardId !== purchase.cardId) {
    throw new Error(
      "El pago global no corresponde a la tarjeta de esta parcialidad.",
    );
  }

  if (cardPayment.paidAt > getLocalDateString()) {
    throw new Error("La fecha del pago global no puede ser futura.");
  }

  if (cardPayment.paidAt < purchase.purchaseDate) {
    throw new Error(
      "La fecha del pago no puede ser anterior a la fecha de compra.",
    );
  }

  if (
    (installment.payments ?? []).some(
      (item) => item.cardPaymentId === cardPayment.id,
    )
  ) {
    throw new Error(
      "Este pago global ya tiene una aplicación registrada a esta parcialidad.",
    );
  }

  const transactionStorage = loadTransactionStorage();

  if (!transactionStorage) {
    throw new Error("No hay información de transacciones disponible.");
  }

  const transaction = transactionStorage.transactions.find(
    (item) => item.id === cardPayment.transactionId,
  );

  if (!transaction || transaction.status === "cancelled") {
    throw new Error(
      "La transferencia asociada al pago global no está disponible.",
    );
  }

  if (transaction.type !== "transfer") {
    throw new Error(
      "El pago global debe estar respaldado por una transferencia.",
    );
  }

  const transferParts =
    typeof transaction.account === "string"
      ? transaction.account.split("→").map((part) => part.trim())
      : [];

  if (transferParts.length !== 2) {
    throw new Error("El formato de la transferencia no es válido.");
  }

  const [sourceAccountId, destinationAccountId] = transferParts;

  if (destinationAccountId !== `card:${cardPayment.cardId}`) {
    throw new Error(
      "La transferencia no corresponde a la tarjeta del pago global.",
    );
  }

  const card = storage.cards.find((item) => item.id === cardPayment.cardId);

  if (!card || card.type !== "credit" || card.status !== "active") {
    throw new Error("La tarjeta de crédito no está disponible.");
  }

  const sourceAccount = storage.accounts.find(
    (item) => item.id === sourceAccountId,
  );

  if (!sourceAccount || sourceAccount.status !== "active") {
    throw new Error(
      "La cuenta de origen de la transferencia no está disponible.",
    );
  }

  if (card.paymentAccountId && card.paymentAccountId !== sourceAccountId) {
    throw new Error(
      "La cuenta de origen no coincide con la cuenta de pago configurada.",
    );
  }

  if (
    (/^\d{4}-\d{2}-\d{2}$/.test(transaction.date) &&
      transaction.date > cardPayment.paidAt) ||
    (/^\d{4}-\d{2}-\d{2}$/.test(transaction.date) &&
      transaction.date > getLocalDateString())
  ) {
    throw new Error(
      "La fecha del pago no puede ser anterior a la transferencia ni posterior al día actual.",
    );
  }

  if (
    !Number.isFinite(transaction.amount) ||
    transaction.amount <= 0 ||
    roundMoney(transaction.amount) !== roundMoney(cardPayment.amount)
  ) {
    throw new Error(
      "El importe de la transferencia no coincide con el importe del pago global.",
    );
  }

  // Un movimiento bancario respalda un solo pago global.
  const duplicatedGlobalPayment = storage.cardPayments.some(
    (item) =>
      item.transactionId === cardPayment.transactionId &&
      item.id !== cardPayment.id,
  );

  if (duplicatedGlobalPayment) {
    throw new Error("Esta transferencia ya está vinculada a otro pago global.");
  }

  const alreadyAllocated = roundMoney(
    storage.cardPaymentAllocations
      .filter((item) => item.cardPaymentId === cardPayment.id)
      .reduce((total, item) => total + item.amount, 0),
  );

  const remainingGlobalPayment = roundMoney(
    cardPayment.amount - alreadyAllocated,
  );

  if (data.amount > remainingGlobalPayment) {
    throw new Error(
      `El importe supera el saldo sin distribuir del pago global ($${remainingGlobalPayment.toFixed(2)}).`,
    );
  }

  const remainingInstallment = roundMoney(
    installment.amount - installment.paidAmount,
  );

  if (data.amount > remainingInstallment) {
    throw new Error(
      `El importe supera el saldo pendiente de la parcialidad ($${remainingInstallment.toFixed(2)}).`,
    );
  }

  const payment: InstallmentPayment = {
    id: generateId(),
    installmentId: installment.id,
    amount: roundMoney(data.amount),
    paidAt: cardPayment.paidAt,
    method: "transaction",
    transactionId: cardPayment.transactionId,
    cardPaymentId: cardPayment.id,
  };

  const allocation: CardPaymentAllocation = {
    id: generateId(),
    cardPaymentId: cardPayment.id,
    type: "installment",
    purchaseId: null,
    installmentId: installment.id,
    amount: roundMoney(data.amount),
    createdAt: new Date().toISOString(),
  };

  const newPaidAmount = roundMoney(installment.paidAmount + payment.amount);

  const updatedInstallment: Installment = {
    ...installment,
    paidAmount: newPaidAmount,
    status: getInstallmentStatus(installment.amount, newPaidAmount),
    payments: [...(installment.payments ?? []), payment],
  };

  const updatedInstallments = storage.installments.map((item) =>
    item.id === installment.id ? updatedInstallment : item,
  );

  const allPlanInstallments = updatedInstallments.filter(
    (item) => item.planId === plan.id,
  );

  const planCompleted =
    allPlanInstallments.length === plan.installmentCount &&
    allPlanInstallments.every((item) => item.status === "paid");

  const updatedPlans = storage.installmentPlans.map((item) =>
    item.id === plan.id && planCompleted
      ? { ...item, status: "completed" as const }
      : item,
  );

  return {
    storage: {
      ...storage,
      installments: updatedInstallments,
      installmentPlans: updatedPlans,
      cardPaymentAllocations: [...storage.cardPaymentAllocations, allocation],
    },
    payment,
    allocation,
  };
}

// -----------------------------------------------------------------------------
// REGISTRO DE PAGOS
// -----------------------------------------------------------------------------

export function registerInstallmentPayment(
  data: RegisterInstallmentPaymentData,
): InstallmentPayment {
  if (!data.cardPaymentId) {
    throw new Error(
      "Los nuevos pagos MSI deben originarse desde un pago global de tarjeta.",
    );
  }

  if (data.method !== "transaction") {
    throw new Error(
      "Los nuevos pagos manuales MSI están deshabilitados. Registra el pago mediante una transferencia y un pago global de tarjeta.",
    );
  }

  const storage = loadAccountStorage();

  if (!storage) {
    throw new Error("No hay información de cuentas disponible.");
  }

  const cardPayment = storage.cardPayments.find(
    (item) => item.id === data.cardPaymentId,
  );

  if (!cardPayment) {
    throw new Error("No se encontró el pago global indicado.");
  }

  if (data.transactionId && data.transactionId !== cardPayment.transactionId) {
    throw new Error(
      "La transferencia indicada no coincide con la transferencia del pago global.",
    );
  }

  if (data.paidAt !== cardPayment.paidAt) {
    throw new Error(
      "La fecha del abono debe coincidir con la fecha del pago global.",
    );
  }

  const result = applyCardPaymentToInstallment(storage, {
    installmentId: data.installmentId,
    cardPaymentId: data.cardPaymentId,
    amount: data.amount,
  });

  if (!saveAccountStorage(result.storage)) {
    throw new Error(
      "No fue posible guardar la aplicación del pago a la parcialidad.",
    );
  }

  return result.payment;
}
