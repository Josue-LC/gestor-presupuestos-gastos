import type {
  BankCard,
  CardPurchase,
  CardPurchaseType,
  InstallmentInterestType,
  InstallmentPlan,
} from "@/types/account";

import { createInstallmentPlan } from "@/services/installment.service";

import type { Transaction } from "@/components/transactions/TransactionList";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "@/services/account-storage.service";

import {
  loadTransactionStorage,
  saveTransactionStorage,
} from "@/services/transaction-storage.service";

import {
  createTransactionAuditEvent,
  createTransactionCancellationAuditEvent,
} from "@/services/transaction-audit.service";

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
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

function isValidMoney(amount: number): boolean {
  return (
    Number.isFinite(amount) &&
    amount > 0 &&
    Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001
  );
}

function isNonNegativeMoney(amount: number): boolean {
  return (
    Number.isFinite(amount) &&
    amount >= 0 &&
    Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001
  );
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

export interface CreateCardPurchaseData {
  cardId: string;
  description: string;
  category: string;
  amount: number;
  purchaseDate: string;
  purchaseType: CardPurchaseType;

  installmentCount?: number;
  firstDueDate?: string;

  interestType?: InstallmentInterestType;
  interestAmount?: number;
  annualInterestRate?: number | null;
}

// -----------------------------------------------------------------------------
// OBTENER TARJETA
// -----------------------------------------------------------------------------

function getCardById(cardId: string): BankCard {
  if (!isNonEmptyString(cardId)) {
    throw new Error("Debes seleccionar una tarjeta válida.");
  }

  const storage = loadAccountStorage();
  const card = storage.cards.find((item) => item.id === cardId);

  if (!card) {
    throw new Error("La tarjeta seleccionada no existe.");
  }

  if (card.status !== "active") {
    throw new Error("No puedes registrar compras con una tarjeta archivada.");
  }

  return card;
}

// -----------------------------------------------------------------------------
// VALIDAR CONFIGURACIÓN DE INTERESES
// -----------------------------------------------------------------------------

function validateInterestData(data: CreateCardPurchaseData): void {
  const interestType = data.interestType ?? "none";
  const interestAmount = data.interestAmount ?? 0;
  const annualInterestRate = data.annualInterestRate ?? 0;

  if (
    interestType !== "none" &&
    interestType !== "fixed" &&
    interestType !== "annual_rate"
  ) {
    throw new Error("El tipo de interés seleccionado no es válido.");
  }

  if (data.purchaseType === "single") {
    if (
      interestType !== "none" ||
      interestAmount !== 0 ||
      annualInterestRate !== 0
    ) {
      throw new Error(
        "Las compras de una sola exhibición no deben tener configuración de intereses.",
      );
    }

    return;
  }

  if (interestType === "none") {
    if (interestAmount !== 0 || annualInterestRate !== 0) {
      throw new Error(
        "Una compra sin intereses no debe contener importes o tasas de interés.",
      );
    }

    return;
  }

  if (interestType === "fixed") {
    if (!isValidMoney(interestAmount)) {
      throw new Error(
        "El importe total de intereses debe ser mayor que cero y tener máximo dos decimales.",
      );
    }

    if (annualInterestRate !== 0) {
      throw new Error(
        "Un plan con interés fijo no debe contener una tasa anual.",
      );
    }

    return;
  }

  if (interestType === "annual_rate") {
    if (
      !Number.isFinite(annualInterestRate) ||
      annualInterestRate <= 0 ||
      annualInterestRate > 1000
    ) {
      throw new Error(
        "La tasa anual debe ser mayor que cero y no superar el 1000%.",
      );
    }

    if (interestAmount !== 0) {
      throw new Error(
        "Un plan con tasa anual no debe contener un importe de interés fijo.",
      );
    }
  }
}

// -----------------------------------------------------------------------------
// VALIDAR COMPRA
// -----------------------------------------------------------------------------

function validatePurchaseData(
  data: CreateCardPurchaseData,
  card: BankCard,
): void {
  if (!isNonEmptyString(data.description)) {
    throw new Error("La descripción de la compra es obligatoria.");
  }

  if (!isNonEmptyString(data.category)) {
    throw new Error("La categoría de la compra es obligatoria.");
  }

  if (!isValidMoney(data.amount)) {
    throw new Error(
      "El importe debe ser mayor que cero y tener máximo dos decimales.",
    );
  }

  if (!isValidDate(data.purchaseDate)) {
    throw new Error("La fecha de compra no es válida.");
  }

  if (data.purchaseType !== "single" && data.purchaseType !== "installments") {
    throw new Error("El tipo de compra no es válido.");
  }

  validateInterestData(data);

  const accountStorage = loadAccountStorage();

  if (card.type === "debit") {
    if (data.purchaseType === "installments") {
      throw new Error(
        "Las compras a parcialidades solo están disponibles para tarjetas de crédito.",
      );
    }

    if (!card.linkedAccountId) {
      throw new Error(
        "La tarjeta de débito debe estar vinculada a una cuenta bancaria.",
      );
    }

    const linkedAccount = accountStorage.accounts.find(
      (account) => account.id === card.linkedAccountId,
    );

    if (!linkedAccount || linkedAccount.status !== "active") {
      throw new Error(
        "La cuenta vinculada a la tarjeta de débito no existe o está archivada.",
      );
    }
  } else if (card.type === "credit") {
    if (card.linkedAccountId !== null) {
      throw new Error(
        "Una tarjeta de crédito no debe tener una cuenta de débito vinculada.",
      );
    }

    if (data.purchaseType === "installments") {
      if (
        !Number.isInteger(data.installmentCount) ||
        (data.installmentCount ?? 0) < 2
      ) {
        throw new Error(
          "El número de parcialidades debe ser un entero mayor o igual a 2.",
        );
      }

      if (!data.firstDueDate || !isValidDate(data.firstDueDate)) {
        throw new Error(
          "Debes indicar una fecha válida para la primera parcialidad.",
        );
      }

      if (data.firstDueDate <= data.purchaseDate) {
        throw new Error(
          "La primera parcialidad debe tener una fecha posterior a la fecha de compra.",
        );
      }
    } else if (
      data.installmentCount !== undefined ||
      data.firstDueDate !== undefined
    ) {
      throw new Error(
        "Una compra de una sola exhibición no debe contener configuración de parcialidades.",
      );
    }
  } else {
    throw new Error("El tipo de tarjeta no es válido.");
  }
}

// -----------------------------------------------------------------------------
// DETERMINAR CUENTA DE LA TRANSACCIÓN
// -----------------------------------------------------------------------------

function getTransactionAccount(card: BankCard): string {
  if (card.type === "debit") {
    if (!card.linkedAccountId) {
      throw new Error(
        "La tarjeta de débito debe estar vinculada a una cuenta para registrar compras.",
      );
    }

    return card.linkedAccountId;
  }

  if (card.type === "credit") {
    return `card:${card.id}`;
  }

  throw new Error("El tipo de tarjeta no es válido.");
}

// -----------------------------------------------------------------------------
// VALIDAR RELACIÓN COMPRA - TRANSACCIÓN
// -----------------------------------------------------------------------------

function validatePurchaseTransactionRelation(
  purchase: CardPurchase,
  transaction: Transaction,
  card: BankCard,
): void {
  if (transaction.id !== purchase.transactionId) {
    throw new Error("La transacción no corresponde a la compra indicada.");
  }

  if (transaction.type !== "expense") {
    throw new Error("La transacción relacionada no corresponde a un gasto.");
  }

  if (
    roundMoney(Math.abs(transaction.amount)) !== roundMoney(purchase.amount)
  ) {
    throw new Error(
      "El importe del gasto no coincide con el importe de la compra.",
    );
  }

  const expectedTransactionAccount = getTransactionAccount(card);

  if (transaction.account.trim() !== expectedTransactionAccount) {
    throw new Error(
      "El gasto no está asociado a la cuenta o tarjeta correcta.",
    );
  }

  if (transaction.date !== purchase.purchaseDate) {
    throw new Error("La fecha del gasto no coincide con la fecha de compra.");
  }

  if (transaction.description !== purchase.description) {
    throw new Error("La descripción del gasto no coincide con la compra.");
  }
}

// -----------------------------------------------------------------------------
// VALIDAR RELACIONES DEL PLAN DE PARCIALIDADES
// -----------------------------------------------------------------------------

function getInstallmentPlan(
  purchase: CardPurchase,
  accountStorage: ReturnType<typeof loadAccountStorage>,
): InstallmentPlan {
  if (!purchase.installmentPlanId) {
    throw new Error(
      "La compra todavía no tiene un plan de parcialidades asociado. No se puede cancelar hasta completar o corregir su registro.",
    );
  }

  const plan = accountStorage.installmentPlans.find(
    (item) => item.id === purchase.installmentPlanId,
  );

  if (!plan) {
    throw new Error(
      "No se encontró el plan de parcialidades asociado a la compra. Se requiere revisar la integridad de los registros.",
    );
  }

  if (plan.cardPurchaseId !== purchase.id) {
    throw new Error("El plan no corresponde a la compra indicada.");
  }

  const purchaseInterestType = purchase.interestType ?? "none";
  const planInterestType = plan.interestType ?? "none";

  if (
    plan.installmentCount !== purchase.installmentCount ||
    roundMoney(plan.principalAmount) !== roundMoney(purchase.amount) ||
    plan.firstDueDate !== purchase.firstDueDate ||
    planInterestType !== purchaseInterestType ||
    (purchaseInterestType === "fixed" &&
      !isNonNegativeMoney(purchase.interestAmount)) ||
    (purchaseInterestType === "fixed" &&
      roundMoney(plan.interestAmount) !==
        roundMoney(purchase.interestAmount)) ||
    (purchaseInterestType === "annual_rate" &&
      roundMoney(plan.annualInterestRate ?? 0) !==
        roundMoney(purchase.annualInterestRate ?? 0))
  ) {
    throw new Error(
      "La configuración del plan de parcialidades no coincide con la compra.",
    );
  }

  if (
    !isNonNegativeMoney(plan.interestAmount) ||
    !isValidMoney(plan.totalAmount) ||
    roundMoney(plan.principalAmount + plan.interestAmount) !==
      roundMoney(plan.totalAmount)
  ) {
    throw new Error(
      "Los importes de capital, intereses y total del plan no son consistentes.",
    );
  }

  return plan;
}

function validateInstallmentCancellation(
  purchase: CardPurchase,
  accountStorage: ReturnType<typeof loadAccountStorage>,
): InstallmentPlan | null {
  if (purchase.purchaseType !== "installments") {
    if (purchase.installmentPlanId !== null) {
      throw new Error(
        "Una compra de una sola exhibición no debe tener un plan de parcialidades asociado.",
      );
    }

    return null;
  }

  const plan = getInstallmentPlan(purchase, accountStorage);

  if (plan.status !== "active") {
    throw new Error(
      plan.status === "completed"
        ? "No se puede cancelar una compra cuyo plan ya está completado."
        : "El plan ya está cancelado. Revisa la integridad de la compra antes de continuar.",
    );
  }

  const installments = accountStorage.installments.filter(
    (installment) => installment.planId === plan.id,
  );

  if (installments.length !== plan.installmentCount) {
    throw new Error("El número de parcialidades no coincide con el plan.");
  }

  const installmentIds = new Set(installments.map((item) => item.id));

  if (installmentIds.size !== installments.length) {
    throw new Error(
      "El plan contiene identificadores de parcialidad duplicados.",
    );
  }

  const totalInstallments = roundMoney(
    installments.reduce((total, installment) => total + installment.amount, 0),
  );

  const totalPrincipal = roundMoney(
    installments.reduce(
      (total, installment) =>
        total + (installment.principalAmount ?? installment.amount),
      0,
    ),
  );

  const totalInterest = roundMoney(
    installments.reduce(
      (total, installment) => total + (installment.interestAmount ?? 0),
      0,
    ),
  );

  if (totalInstallments !== roundMoney(plan.totalAmount)) {
    throw new Error(
      "La suma de las parcialidades no coincide con el importe total del plan.",
    );
  }

  if (totalPrincipal !== roundMoney(plan.principalAmount)) {
    throw new Error(
      "La suma del capital de las parcialidades no coincide con el capital del plan.",
    );
  }

  if (totalInterest !== roundMoney(plan.interestAmount)) {
    throw new Error(
      "La suma de los intereses de las parcialidades no coincide con los intereses del plan.",
    );
  }

  const hasPayments = installments.some(
    (installment) =>
      installment.paidAmount > 0 ||
      (installment.payments ?? []).length > 0 ||
      installment.status !== "pending",
  );

  if (hasPayments) {
    throw new Error(
      "No se puede cancelar una compra con parcialidades que tiene pagos registrados. Primero deben gestionarse las operaciones de reversión correspondientes.",
    );
  }

  const hasPaymentAllocations = (
    accountStorage.cardPaymentAllocations ?? []
  ).some(
    (allocation) =>
      allocation.type === "installment" &&
      allocation.installmentId !== null &&
      installmentIds.has(allocation.installmentId),
  );

  if (hasPaymentAllocations) {
    throw new Error(
      "No se puede cancelar una compra que tiene aplicaciones de pagos globales. Primero deben revertirse esas aplicaciones mediante el flujo correspondiente.",
    );
  }

  return plan;
}

// -----------------------------------------------------------------------------
// VERIFICAR REVERSIÓN DE ALMACENAMIENTO
// -----------------------------------------------------------------------------

function restoreTransactionStorage(
  originalData: ReturnType<typeof loadTransactionStorage>,
): boolean {
  if (!originalData) {
    return false;
  }

  const saved = saveTransactionStorage(originalData);

  if (!saved) {
    return false;
  }

  const restoredData = loadTransactionStorage();

  if (!restoredData) {
    return false;
  }

  return (
    JSON.stringify(restoredData.transactions) ===
      JSON.stringify(originalData.transactions) &&
    JSON.stringify(restoredData.auditEvents) ===
      JSON.stringify(originalData.auditEvents)
  );
}

function restoreAccountStorage(
  originalData: ReturnType<typeof loadAccountStorage>,
): boolean {
  if (!originalData) {
    return false;
  }

  const saved = saveAccountStorage(originalData);

  if (!saved) {
    return false;
  }

  const restoredData = loadAccountStorage();

  return (
    JSON.stringify(restoredData.purchases) ===
      JSON.stringify(originalData.purchases) &&
    JSON.stringify(restoredData.installmentPlans) ===
      JSON.stringify(originalData.installmentPlans) &&
    JSON.stringify(restoredData.installments) ===
      JSON.stringify(originalData.installments)
  );
}

// -----------------------------------------------------------------------------
// CONSULTAS
// -----------------------------------------------------------------------------

export function getCardPurchases(): CardPurchase[] {
  return loadAccountStorage().purchases;
}

export function getActiveCardPurchases(): CardPurchase[] {
  return getCardPurchases().filter((purchase) => purchase.status === "active");
}

export function getPurchasesByCard(cardId: string): CardPurchase[] {
  return getActiveCardPurchases().filter(
    (purchase) => purchase.cardId === cardId,
  );
}

export function getCardPurchaseById(
  purchaseId: string,
): CardPurchase | undefined {
  return getCardPurchases().find((purchase) => purchase.id === purchaseId);
}

// -----------------------------------------------------------------------------
// REGISTRO DE COMPRAS
// -----------------------------------------------------------------------------

export function createCardPurchase(data: CreateCardPurchaseData): CardPurchase {
  const card = getCardById(data.cardId);

  validatePurchaseData(data, card);

  const accountStorage = loadAccountStorage();
  const transactionStorage = loadTransactionStorage();

  if (!transactionStorage) {
    throw new Error("No se encontró el almacenamiento de transacciones.");
  }

  const purchaseId = generateId();
  const transactionId = generateId();
  const now = new Date().toISOString();

  const amount = roundMoney(data.amount);
  const interestType = data.interestType ?? "none";

  const interestAmount =
    interestType === "fixed" ? roundMoney(data.interestAmount ?? 0) : 0;

  const annualInterestRate =
    interestType === "annual_rate" ? (data.annualInterestRate ?? 0) : null;

  if (
    accountStorage.purchases.some((purchase) => purchase.id === purchaseId) ||
    transactionStorage.transactions.some(
      (transaction) => transaction.id === transactionId,
    )
  ) {
    throw new Error(
      "No fue posible generar identificadores únicos para la compra.",
    );
  }

  // El gasto se registra por el capital original de la compra.
  // Los intereses se gestionan dentro del plan de parcialidades.
  const transaction: Transaction = {
    id: transactionId,
    description: data.description.trim(),
    category: data.category.trim(),
    account: getTransactionAccount(card),
    date: data.purchaseDate,
    registeredAt: now,
    amount,
    type: "expense",
    status: "active",
  };

  const purchase: CardPurchase = {
    id: purchaseId,
    cardId: card.id,
    transactionId: transaction.id,
    description: data.description.trim(),
    amount,
    purchaseDate: data.purchaseDate,
    purchaseType: data.purchaseType,
    installmentCount:
      data.purchaseType === "installments" ? data.installmentCount! : null,
    firstDueDate:
      data.purchaseType === "installments" ? data.firstDueDate! : null,
    interestType: data.purchaseType === "installments" ? interestType : "none",
    interestAmount: data.purchaseType === "installments" ? interestAmount : 0,
    annualInterestRate:
      data.purchaseType === "installments" ? annualInterestRate : null,
    status: "active",
    installmentPlanId: null,
    createdAt: now,
  };

  validatePurchaseTransactionRelation(purchase, transaction, card);

  const auditEvent = createTransactionAuditEvent(transaction);

  // Primero se guarda el gasto y su auditoría.
  const transactionSaved = saveTransactionStorage({
    ...transactionStorage,
    transactions: [...transactionStorage.transactions, transaction],
    auditEvents: [...transactionStorage.auditEvents, auditEvent],
  });

  if (!transactionSaved) {
    throw new Error("No fue posible registrar el gasto de la compra.");
  }

  // Después se guarda la compra.
  const purchaseSaved = saveAccountStorage({
    ...accountStorage,
    purchases: [...accountStorage.purchases, purchase],
  });

  if (!purchaseSaved) {
    const rollbackSaved = restoreTransactionStorage(transactionStorage);

    if (!rollbackSaved) {
      throw new Error(
        "Falló el registro de la compra y también su reversión. Se requiere revisar ambos almacenamientos financieros.",
      );
    }

    throw new Error(
      "No fue posible guardar la compra. Se revirtió el gasto y su auditoría.",
    );
  }

  return purchase;
}

// -----------------------------------------------------------------------------
// REGISTRO COORDINADO DE COMPRAS Y PLANES
// -----------------------------------------------------------------------------

export function createCardPurchaseWithPlan(
  data: CreateCardPurchaseData,
): CardPurchase {
  const originalAccountStorage = loadAccountStorage();
  const originalTransactionStorage = loadTransactionStorage();

  if (!originalAccountStorage) {
    throw new Error("No hay información de cuentas disponible.");
  }

  if (!originalTransactionStorage) {
    throw new Error("No se encontró el almacenamiento de transacciones.");
  }

  try {
    // Registrar primero la compra y su gasto.
    const purchase = createCardPurchase(data);

    // Las compras de una sola exhibición no necesitan un plan.
    if (data.purchaseType === "single") {
      return purchase;
    }

    // Generar el plan y todas sus parcialidades.
    const plan = createInstallmentPlan({
      purchaseId: purchase.id,
    });

    // Verificar que la compra quedó correctamente vinculada.
    const finalAccountStorage = loadAccountStorage();

    if (!finalAccountStorage) {
      throw new Error(
        "No fue posible verificar el almacenamiento de la compra.",
      );
    }

    const persistedPurchase = finalAccountStorage.purchases.find(
      (item) => item.id === purchase.id,
    );

    const persistedPlan = finalAccountStorage.installmentPlans.find(
      (item) => item.id === plan.id,
    );

    const persistedInstallments = finalAccountStorage.installments.filter(
      (item) => item.planId === plan.id,
    );

    if (
      !persistedPurchase ||
      persistedPurchase.installmentPlanId !== plan.id ||
      !persistedPlan ||
      persistedPlan.cardPurchaseId !== purchase.id ||
      persistedInstallments.length !== plan.installmentCount
    ) {
      throw new Error(
        "No fue posible verificar la creación completa del plan de parcialidades.",
      );
    }

    return persistedPurchase;
  } catch (error) {
    // Restaurar ambos almacenamientos.
    const accountRollback = restoreAccountStorage(originalAccountStorage);

    const transactionRollback = restoreTransactionStorage(
      originalTransactionStorage,
    );

    if (!accountRollback || !transactionRollback) {
      throw new Error(
        "Falló el registro de la compra y no fue posible restaurar ambos almacenamientos. Se requiere revisar la integridad de los registros financieros.",
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "No fue posible registrar la compra y su plan. Los datos originales fueron restaurados.",
    );
  }
}

// -----------------------------------------------------------------------------
// CANCELACIÓN LÓGICA
// -----------------------------------------------------------------------------

export function cancelCardPurchase(purchaseId: string): CardPurchase {
  const accountStorage = loadAccountStorage();
  const transactionStorage = loadTransactionStorage();

  if (!transactionStorage) {
    throw new Error("No se encontró el almacenamiento de transacciones.");
  }

  const purchase = accountStorage.purchases.find(
    (item) => item.id === purchaseId,
  );

  if (!purchase) {
    throw new Error("La compra no existe.");
  }

  if (purchase.status === "cancelled") {
    throw new Error("La compra ya está cancelada.");
  }

  const card = accountStorage.cards.find((item) => item.id === purchase.cardId);

  if (!card) {
    throw new Error("No se encontró la tarjeta asociada a la compra.");
  }

  // Validar el plan y comprobar que no existan pagos.
  const installmentPlan = validateInstallmentCancellation(
    purchase,
    accountStorage,
  );

  // Comprobar la transacción asociada.
  const transaction = transactionStorage.transactions.find(
    (item) => item.id === purchase.transactionId,
  );

  if (!transaction) {
    throw new Error("No se encontró el gasto relacionado con la compra.");
  }

  if (transaction.status === "cancelled") {
    throw new Error("El gasto relacionado ya está cancelado.");
  }

  validatePurchaseTransactionRelation(purchase, transaction, card);

  const cancellationReason = "Cancelación de compra con tarjeta";

  const cancelledPurchase: CardPurchase = {
    ...purchase,
    status: "cancelled",
  };

  const cancelledPlan: InstallmentPlan | null = installmentPlan
    ? {
        ...installmentPlan,
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
      }
    : null;

  const cancelledTransaction: Transaction = {
    ...transaction,
    status: "cancelled",
    cancellationReason,
  };

  const auditEvent = createTransactionCancellationAuditEvent(
    transaction,
    cancellationReason,
  );

  // Preparar ambos estados antes de persistir.
  const updatedTransactions = transactionStorage.transactions.map((item) =>
    item.id === transaction.id ? cancelledTransaction : item,
  );

  const updatedPurchases = accountStorage.purchases.map((item) =>
    item.id === purchaseId ? cancelledPurchase : item,
  );

  const updatedInstallmentPlans = cancelledPlan
    ? accountStorage.installmentPlans.map((item) =>
        item.id === cancelledPlan.id ? cancelledPlan : item,
      )
    : accountStorage.installmentPlans;

  // Guardar primero la transacción y su auditoría.
  const transactionSaved = saveTransactionStorage({
    ...transactionStorage,
    transactions: updatedTransactions,
    auditEvents: [...transactionStorage.auditEvents, auditEvent],
  });

  if (!transactionSaved) {
    throw new Error("No fue posible cancelar el gasto relacionado.");
  }

  // Guardar después la compra y su plan cancelados.
  const purchaseSaved = saveAccountStorage({
    ...accountStorage,
    purchases: updatedPurchases,
    installmentPlans: updatedInstallmentPlans,
  });

  if (!purchaseSaved) {
    const rollbackSaved = restoreTransactionStorage(transactionStorage);

    if (!rollbackSaved) {
      throw new Error(
        "Falló la cancelación de la compra y también su reversión. Se requiere revisar ambos almacenamientos financieros.",
      );
    }

    throw new Error(
      "No fue posible cancelar la compra. Se revirtió el gasto y su auditoría.",
    );
  }

  // Verificar que ambos registros reflejen la cancelación.
  const finalAccountStorage = loadAccountStorage();
  const finalTransactionStorage = loadTransactionStorage();

  const persistedPurchase = finalAccountStorage.purchases.find(
    (item) => item.id === purchaseId,
  );

  const persistedPlan = cancelledPlan
    ? finalAccountStorage.installmentPlans.find(
        (item) => item.id === cancelledPlan.id,
      )
    : null;

  const persistedTransaction = finalTransactionStorage?.transactions.find(
    (item) => item.id === transaction.id,
  );

  if (
    persistedPurchase?.status !== "cancelled" ||
    (cancelledPlan !== null && persistedPlan?.status !== "cancelled") ||
    persistedTransaction?.status !== "cancelled"
  ) {
    const accountRollback = restoreAccountStorage(accountStorage);
    const transactionRollback = restoreTransactionStorage(transactionStorage);

    if (!accountRollback || !transactionRollback) {
      throw new Error(
        "La cancelación produjo un estado inconsistente y no fue posible completar ambas reversiones. Se requiere revisar el almacenamiento financiero.",
      );
    }

    throw new Error(
      "No se pudo verificar la cancelación. Los datos originales fueron restaurados.",
    );
  }

  return cancelledPurchase;
}
