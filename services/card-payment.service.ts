// card-payment service
import type {
  CardPayment,
  CardPaymentAllocation,
  CardPaymentAllocationMode,
  CardPaymentAllocationType,
  Installment,
} from "@/types/account";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "@/services/account-storage.service";

import {
  loadTransactionStorage,
} from "@/services/transaction-storage.service";

import {
  applyCardPaymentToInstallment,
} from "@/services/installment-payment.service";

export interface ManualCardPaymentAllocation {
  type: CardPaymentAllocationType;
  purchaseId?: string;
  installmentId?: string;
  amount: number;
}

export interface RegisterCardPaymentData {
  cardId: string;
  transactionId: string;
  paidAt: string;
  allocationMode: CardPaymentAllocationMode;
  allocations?: ManualCardPaymentAllocation[];
}

export interface CardPaymentResult {
  payment: CardPayment;
  allocations: CardPaymentAllocation[];
  allocatedAmount: number;
  unappliedAmount: number;
}

export interface CardPaymentSummary {
  payment: CardPayment;
  allocations: CardPaymentAllocation[];
  allocatedAmount: number;
  unappliedAmount: number;
}

function generateId(): string {
  return crypto.randomUUID();
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function isValidMoney(amount: number): boolean {
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

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseTransferAccount(account: string): {
  sourceAccountId: string;
  destinationAccountId: string;
} {
  const parts = account.split("→").map((part) => part.trim());

  if (
    parts.length !== 2 ||
    !parts[0] ||
    !parts[1]
  ) {
    throw new Error("El formato de la transferencia no es válido.");
  }

  return {
    sourceAccountId: parts[0],
    destinationAccountId: parts[1],
  };
}

function validateCardPaymentTransfer(
  cardId: string,
  transactionId: string,
  amount?: number,
  paidAt?: string,
  existingPaymentId?: string,
): {
  transaction: NonNullable<
    ReturnType<typeof loadTransactionStorage>
  >["transactions"][number];
} {
  const accountStorage = loadAccountStorage();
  const transactionStorage = loadTransactionStorage();

  if (!accountStorage || !transactionStorage) {
    throw new Error("No hay información financiera disponible.");
  }

  const card = accountStorage.cards.find(
    (item) => item.id === cardId,
  );

  if (!card || card.type !== "credit" || card.status !== "active") {
    throw new Error("La tarjeta de crédito no está disponible.");
  }

  const transaction = transactionStorage.transactions.find(
    (item) => item.id === transactionId,
  );

  if (!transaction) {
    throw new Error("No se encontró la transferencia indicada.");
  }

  if (transaction.status === "cancelled") {
    throw new Error("No se puede utilizar una transferencia cancelada.");
  }

  if (transaction.type !== "transfer") {
    throw new Error(
      "El pago de una tarjeta debe estar respaldado por una transferencia.",
    );
  }

  if (
    !Number.isFinite(transaction.amount) ||
    transaction.amount <= 0 ||
    roundMoney(transaction.amount) !== transaction.amount
  ) {
    throw new Error("El importe de la transferencia no es válido.");
  }

  const { sourceAccountId, destinationAccountId } =
    parseTransferAccount(transaction.account);

  if (destinationAccountId !== `card:${card.id}`) {
    throw new Error(
      "La transferencia no tiene como destino la tarjeta seleccionada.",
    );
  }

  const sourceAccount = accountStorage.accounts.find(
    (item) => item.id === sourceAccountId,
  );

  if (!sourceAccount || sourceAccount.status !== "active") {
    throw new Error(
      "La cuenta de origen de la transferencia no está disponible.",
    );
  }
  if (amount !== undefined && roundMoney(transaction.amount) !== amount) {
    throw new Error(
      "El importe del pago global debe coincidir con el importe de la transferencia.",
    );
  }

  if (paidAt !== undefined) {
    if (!isValidDate(paidAt)) {
      throw new Error("La fecha del pago no es válida.");
    }

    if (paidAt > getLocalDateString()) {
      throw new Error("La fecha del pago no puede ser futura.");
    }

    // Las fechas de operación existentes pueden estar localizadas.
    // La comparación se realiza cuando el movimiento utiliza formato ISO.
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(transaction.date) &&
      transaction.date > paidAt
    ) {
      throw new Error(
        "La fecha del pago no puede ser anterior a la transferencia.",
      );
    }
  }

  const duplicatedPayment = accountStorage.cardPayments.some(
    (payment) =>
      payment.transactionId === transactionId &&
      payment.id !== existingPaymentId,
  );

  if (duplicatedPayment) {
    throw new Error(
      "Esta transferencia ya está vinculada a un pago global.",
    );
  }

  const legacyUsage = accountStorage.installments.some(
    (installment) =>
      installment.payments.some(
        (payment) =>
          payment.transactionId === transactionId &&
          !payment.cardPaymentId,
      ),
  );

  if (legacyUsage) {
    throw new Error(
      "Esta transferencia ya fue utilizada en pagos MSI históricos y no puede registrarse nuevamente como pago global.",
    );
  }

  return { transaction };
}

function validateAllocationShape(
  allocation: ManualCardPaymentAllocation,
): void {
  if (!allocation || typeof allocation !== "object") {
    throw new Error("La aplicación indicada no es válida.");
  }

  if (allocation.type === "single_purchase") {
    if (
      typeof allocation.purchaseId !== "string" ||
      !allocation.purchaseId.trim() ||
      allocation.installmentId !== undefined
    ) {
      throw new Error(
        "La aplicación a una compra debe incluir únicamente una referencia de compra válida.",
      );
    }

    return;
  }

  if (allocation.type === "installment") {
    if (
      typeof allocation.installmentId !== "string" ||
      !allocation.installmentId.trim() ||
      allocation.purchaseId !== undefined
    ) {
      throw new Error(
        "La aplicación a una parcialidad debe incluir únicamente una referencia de parcialidad válida.",
      );
    }

    return;
  }

  throw new Error("El tipo de aplicación no es válido.");
}

function validateAllocationList(
  allocations: ManualCardPaymentAllocation[],
): void {
  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw new Error("Debes indicar al menos una aplicación.");
  }

  allocations.forEach(validateAllocationShape);

  const targetKeys = allocations.map((allocation) =>
    allocation.type === "single_purchase"
      ? `purchase:${allocation.purchaseId}`
      : `installment:${allocation.installmentId}`,
  );

  if (new Set(targetKeys).size !== targetKeys.length) {
    throw new Error(
      "No puedes repetir el mismo concepto en las aplicaciones.",
    );
  }
}

function getPurchaseAllocatedAmount(
  storage: ReturnType<typeof loadAccountStorage>,
  purchaseId: string,
): number {
  if (!storage) return 0;

  return roundMoney(
    storage.cardPaymentAllocations
      .filter(
        (allocation) =>
          allocation.type === "single_purchase" &&
          allocation.purchaseId === purchaseId,
      )
      .reduce((total, allocation) => total + allocation.amount, 0),
  );
}

function getInstallmentRemaining(
  installment: Installment,
): number {
  return Math.max(
    0,
    roundMoney(installment.amount - installment.paidAmount),
  );
}

function getInstallmentPriority(
  dueDate: string,
  today: string,
): number {
  if (dueDate < today) return 0;
  if (dueDate === today) return 1;
  return 2;
}

function allocateToSinglePurchase(
  storage: NonNullable<ReturnType<typeof loadAccountStorage>>,
  payment: CardPayment,
  purchaseId: string,
  amount: number,
): {
  storage: NonNullable<ReturnType<typeof loadAccountStorage>>;
  allocation: CardPaymentAllocation;
} {
  const purchase = storage.purchases.find(
    (item) => item.id === purchaseId,
  );

  if (
    !purchase ||
    purchase.status !== "active" ||
    purchase.purchaseType !== "single" ||
    purchase.cardId !== payment.cardId
  ) {
    throw new Error(
      "La compra seleccionada no es una compra activa de una sola exhibición de esta tarjeta.",
    );
  }

  const alreadyAllocated = getPurchaseAllocatedAmount(
    storage,
    purchase.id,
  );

  const remaining = Math.max(
    0,
    roundMoney(purchase.amount - alreadyAllocated),
  );

  if (remaining <= 0) {
    throw new Error("La compra seleccionada ya está liquidada.");
  }

  if (amount > remaining) {
    throw new Error(
      `El importe supera el saldo pendiente de la compra ($${remaining.toFixed(2)}).`,
    );
  }

  const allocation: CardPaymentAllocation = {
    id: generateId(),
    cardPaymentId: payment.id,
    type: "single_purchase",
    purchaseId: purchase.id,
    installmentId: null,
    amount: roundMoney(amount),
    createdAt: new Date().toISOString(),
  };

  return {
    storage: {
      ...storage,
      cardPaymentAllocations: [
        ...storage.cardPaymentAllocations,
        allocation,
      ],
    },
    allocation,
  };
}

function getAutomaticAllocationTargets(
  storage: NonNullable<ReturnType<typeof loadAccountStorage>>,
  cardId: string,
): Array<
  | { type: "installment"; installmentId: string; dueDate: string }
  | { type: "single_purchase"; purchaseId: string; dueDate: string }
> {
  const activePlans = new Set(
    storage.installmentPlans
      .filter((plan) => plan.status === "active")
      .map((plan) => plan.id),
  );

  const installmentTargets = storage.installments
    .filter((installment) => {
      if (installment.status === "paid") return false;
      if (!activePlans.has(installment.planId)) return false;

      const plan = storage.installmentPlans.find(
        (item) => item.id === installment.planId,
      );

      const purchase = plan
        ? storage.purchases.find(
            (item) => item.id === plan.cardPurchaseId,
          )
        : undefined;

      return (
        purchase?.cardId === cardId &&
        purchase.status === "active" &&
        getInstallmentRemaining(installment) > 0
      );
    })
    .map((installment) => ({
      type: "installment" as const,
      installmentId: installment.id,
      dueDate: installment.dueDate,
    }));

  const singlePurchaseTargets = storage.purchases
    .filter(
      (purchase) =>
        purchase.cardId === cardId &&
        purchase.status === "active" &&
        purchase.purchaseType === "single" &&
        roundMoney(
          purchase.amount -
            getPurchaseAllocatedAmount(storage, purchase.id),
        ) > 0,
    )
    .map((purchase) => ({
      type: "single_purchase" as const,
      purchaseId: purchase.id,
      dueDate: purchase.purchaseDate,
    }));

  const today = getLocalDateString();

  installmentTargets.sort((a, b) => {
    const priorityDifference =
      getInstallmentPriority(a.dueDate, today) -
      getInstallmentPriority(b.dueDate, today);

    return priorityDifference || a.dueDate.localeCompare(b.dueDate);
  });

  singlePurchaseTargets.sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );

  return [...installmentTargets, ...singlePurchaseTargets];
}

function getPaymentAllocations(
  storage: NonNullable<ReturnType<typeof loadAccountStorage>>,
  paymentId: string,
): CardPaymentAllocation[] {
  return storage.cardPaymentAllocations.filter(
    (allocation) => allocation.cardPaymentId === paymentId,
  );
}

// -----------------------------------------------------------------------------
// REGISTRO DE PAGOS GLOBALES
// -----------------------------------------------------------------------------

export function registerCardPayment(
  data: RegisterCardPaymentData,
): CardPaymentResult {
  const storage = loadAccountStorage();

  if (!storage) {
    throw new Error("No hay información de cuentas disponible.");
  }

  if (!data.cardId.trim()) {
    throw new Error("Debes seleccionar una tarjeta.");
  }

  if (!data.transactionId.trim()) {
    throw new Error("Debes seleccionar una transferencia.");
  }

  if (!isValidDate(data.paidAt)) {
    throw new Error("La fecha del pago no es válida.");
  }

  if (data.paidAt > getLocalDateString()) {
    throw new Error("La fecha del pago no puede ser futura.");
  }

  if (
    data.allocationMode !== "automatic" &&
    data.allocationMode !== "manual"
  ) {
    throw new Error("El modo de distribución no es válido.");
  }

  const { transaction } = validateCardPaymentTransfer(
    data.cardId,
    data.transactionId,
    undefined,
    data.paidAt,
  );

  const payment: CardPayment = {
    id: generateId(),
    cardId: data.cardId,
    transactionId: data.transactionId,
    amount: roundMoney(transaction.amount),
    paidAt: data.paidAt,
    allocationMode: data.allocationMode,
    createdAt: new Date().toISOString(),
  };

  let workingStorage = {
    ...storage,
    cardPayments: [...storage.cardPayments, payment],
  };

  if (data.allocationMode === "manual") {
    if (!data.allocations) {
      throw new Error(
        "Debes indicar al menos una aplicación para la distribución manual.",
      );
    }

    validateAllocationList(data.allocations);

    for (const allocationData of data.allocations) {
      if (!isValidMoney(allocationData.amount)) {
        throw new Error(
          "Cada importe aplicado debe ser válido y tener máximo dos decimales.",
        );
      }

      const alreadyAllocated = roundMoney(
        workingStorage.cardPaymentAllocations
          .filter((item) => item.cardPaymentId === payment.id)
          .reduce((total, item) => total + item.amount, 0),
      );

      const available = roundMoney(payment.amount - alreadyAllocated);

      if (allocationData.amount > available) {
        throw new Error(
          `Las aplicaciones superan el importe del pago. Disponible: $${available.toFixed(2)}.`,
        );
      }

      if (allocationData.type === "single_purchase") {
        if (!allocationData.purchaseId) {
          throw new Error("Debes indicar la compra que deseas liquidar.");
        }

        const result = allocateToSinglePurchase(
          workingStorage,
          payment,
          allocationData.purchaseId,
          allocationData.amount,
        );

        workingStorage = result.storage;
      } else if (allocationData.type === "installment") {
        if (!allocationData.installmentId) {
          throw new Error("Debes indicar la parcialidad MSI.");
        }

        const result = applyCardPaymentToInstallment(
          workingStorage,
          {
            installmentId: allocationData.installmentId,
            cardPaymentId: payment.id,
            amount: allocationData.amount,
          },
        );

        workingStorage = result.storage;
      } else {
        throw new Error("El tipo de aplicación no es válido.");
      }
    }
  } else {
    const targets = getAutomaticAllocationTargets(
      workingStorage,
      payment.cardId,
    );

    let remainingAmount = payment.amount;

    for (const target of targets) {
      if (remainingAmount <= 0) break;

      if (target.type === "installment") {
        const installment = workingStorage.installments.find(
          (item) => item.id === target.installmentId,
        );

        if (!installment) continue;

        const amount = Math.min(
          remainingAmount,
          getInstallmentRemaining(installment),
        );

        if (amount <= 0) continue;

        const result = applyCardPaymentToInstallment(
          workingStorage,
          {
            installmentId: installment.id,
            cardPaymentId: payment.id,
            amount: roundMoney(amount),
          },
        );

        workingStorage = result.storage;
        remainingAmount = roundMoney(remainingAmount - amount);
      } else {
        const purchase = workingStorage.purchases.find(
          (item) => item.id === target.purchaseId,
        );

        if (!purchase) continue;

        const remainingPurchase = Math.max(
          0,
          roundMoney(
            purchase.amount -
              getPurchaseAllocatedAmount(
                workingStorage,
                purchase.id,
              ),
          ),
        );

        const amount = Math.min(
          remainingAmount,
          remainingPurchase,
        );

        if (amount <= 0) continue;

        const result = allocateToSinglePurchase(
          workingStorage,
          payment,
          purchase.id,
          roundMoney(amount),
        );

        workingStorage = result.storage;
        remainingAmount = roundMoney(remainingAmount - amount);
      }
    }
  }

  const allocations = getPaymentAllocations(
    workingStorage,
    payment.id,
  );

  const allocatedAmount = roundMoney(
    allocations.reduce(
      (total, allocation) => total + allocation.amount,
      0,
    ),
  );

  if (allocatedAmount > payment.amount) {
    throw new Error(
      "Las aplicaciones superan el importe del pago global.",
    );
  }

  const unappliedAmount = roundMoney(
    payment.amount - allocatedAmount,
  );

  if (!saveAccountStorage(workingStorage)) {
    throw new Error(
      "No fue posible guardar el pago global y sus aplicaciones.",
    );
  }

  return {
    payment,
    allocations,
    allocatedAmount,
    unappliedAmount,
  };
}

// -----------------------------------------------------------------------------
// CONSULTAS
// -----------------------------------------------------------------------------

/**
 * Distribuye posteriormente el saldo no aplicado de un pago global.
 * Útil cuando el usuario dejó dinero sin asignar al registrar el pago.
 */
export function allocateCardPayment(
  paymentId: string,
  allocations: ManualCardPaymentAllocation[],
): CardPaymentResult {
  const storage = loadAccountStorage();

  if (!storage) {
    throw new Error("No hay información de cuentas disponible.");
  }

  const payment = storage.cardPayments.find(
    (item) => item.id === paymentId,
  );

  if (!payment) {
    throw new Error("No se encontró el pago global indicado.");
  }

  validateAllocationList(allocations);

  // Revalidar la transferencia original antes de distribuir saldo pendiente.
  // Se permite únicamente el pago global que ya está vinculado a esa transferencia.
  validateCardPaymentTransfer(
    payment.cardId,
    payment.transactionId,
    payment.amount,
    payment.paidAt,
    payment.id,
  );

  let workingStorage = storage;

  for (const allocationData of allocations) {
    if (!isValidMoney(allocationData.amount)) {
      throw new Error(
        "Cada importe aplicado debe ser válido y tener máximo dos decimales.",
      );
    }

    const allocatedSoFar = roundMoney(
      workingStorage.cardPaymentAllocations
        .filter((item) => item.cardPaymentId === payment.id)
        .reduce((total, item) => total + item.amount, 0),
    );

    const available = roundMoney(
      payment.amount - allocatedSoFar,
    );

    if (allocationData.amount > available) {
      throw new Error(
        `Las aplicaciones superan el saldo sin distribuir ($${available.toFixed(2)}).`,
      );
    }

    if (allocationData.type === "single_purchase") {
      if (!allocationData.purchaseId) {
        throw new Error("Debes indicar la compra que deseas liquidar.");
      }

      const result = allocateToSinglePurchase(
        workingStorage,
        payment,
        allocationData.purchaseId,
        allocationData.amount,
      );

      workingStorage = result.storage;
    } else if (allocationData.type === "installment") {
      if (!allocationData.installmentId) {
        throw new Error("Debes indicar la parcialidad MSI.");
      }

      const result = applyCardPaymentToInstallment(
        workingStorage,
        {
          installmentId: allocationData.installmentId,
          cardPaymentId: payment.id,
          amount: allocationData.amount,
        },
      );

      workingStorage = result.storage;
    } else {
      throw new Error("El tipo de aplicación no es válido.");
    }
  }

  const paymentAllocations = getPaymentAllocations(
    workingStorage,
    payment.id,
  );

  const allocatedAmount = roundMoney(
    paymentAllocations.reduce(
      (total, allocation) => total + allocation.amount,
      0,
    ),
  );

  if (allocatedAmount > payment.amount) {
    throw new Error(
      "Las aplicaciones registradas superan el importe del pago global.",
    );
  }

  if (!saveAccountStorage(workingStorage)) {
    throw new Error(
      "No fue posible guardar las aplicaciones del pago global.",
    );
  }

  return {
    payment,
    allocations: paymentAllocations,
    allocatedAmount,
    unappliedAmount: roundMoney(
      payment.amount - allocatedAmount,
    ),
  };
}

export function getCardPayments(
  cardId: string,
): CardPayment[] {
  const storage = loadAccountStorage();

  if (!storage) return [];

  return storage.cardPayments
    .filter((payment) => payment.cardId === cardId)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

export function getCardPaymentSummary(
  paymentId: string,
): CardPaymentSummary | null {
  const storage = loadAccountStorage();

  if (!storage) return null;

  const payment = storage.cardPayments.find(
    (item) => item.id === paymentId,
  );

  if (!payment) return null;

  const allocations = getPaymentAllocations(storage, payment.id);

  const allocatedAmount = roundMoney(
    allocations.reduce(
      (total, allocation) => total + allocation.amount,
      0,
    ),
  );

  return {
    payment,
    allocations,
    allocatedAmount,
    unappliedAmount: roundMoney(
      payment.amount - allocatedAmount,
    ),
  };
}

export function getCardPaymentUnappliedAmount(
  paymentId: string,
): number {
  return getCardPaymentSummary(paymentId)?.unappliedAmount ?? 0;
}

export function getCardUnappliedPaymentsTotal(
  cardId: string,
): number {
  const storage = loadAccountStorage();

  if (!storage) return 0;

  return roundMoney(
    storage.cardPayments
      .filter((payment) => payment.cardId === cardId)
      .reduce((total, payment) => {
        const allocatedAmount = storage.cardPaymentAllocations
          .filter(
            (allocation) =>
              allocation.cardPaymentId === payment.id,
          )
          .reduce(
            (sum, allocation) => sum + allocation.amount,
            0,
          );

        return total + Math.max(
          0,
          roundMoney(payment.amount - allocatedAmount),
        );
      }, 0),
  );
}

export function getCardPaymentAllocations(
  paymentId: string,
): CardPaymentAllocation[] {
  const storage = loadAccountStorage();

  if (!storage) return [];

  return getPaymentAllocations(storage, paymentId);
}
