// installment service
import type { Installment, InstallmentPlan } from "@/types/account";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "@/services/account-storage.service";

export interface CreateInstallmentPlanData {
  purchaseId: string;
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

function addMonthsClamped(date: string, months: number): string {
  if (!isValidDate(date) || !Number.isInteger(months) || months < 0) {
    throw new Error("No fue posible calcular la fecha de la parcialidad.");
  }

  const [year, month, day] = date.split("-").map(Number);

  const targetMonth = month - 1 + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;

  const lastDayOfMonth = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0),
  ).getUTCDate();

  const targetDay = Math.min(day, lastDayOfMonth);

  return [
    targetYear,
    String(normalizedMonth + 1).padStart(2, "0"),
    String(targetDay).padStart(2, "0"),
  ].join("-");
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function calculateInstallmentAmounts(
  totalAmount: number,
  installmentCount: number,
): number[] {
  const totalCents = Math.round(totalAmount * 100);

  if (
    !Number.isSafeInteger(totalCents) ||
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > totalCents
  ) {
    throw new Error(
      "La cantidad de parcialidades no es válida para el importe de la compra.",
    );
  }

  const baseAmount = Math.floor(totalCents / installmentCount);
  const remainder = totalCents % installmentCount;

  return Array.from({ length: installmentCount }, (_, index) => {
    const cents = baseAmount + (index < remainder ? 1 : 0);

    return cents / 100;
  });
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

// -----------------------------------------------------------------------------
// CONSULTAS DE PLANES
// -----------------------------------------------------------------------------

export function getInstallmentPlans(): InstallmentPlan[] {
  return loadAccountStorage()?.installmentPlans ?? [];
}

export function getActiveInstallmentPlans(): InstallmentPlan[] {
  return getInstallmentPlans().filter((plan) => plan.status === "active");
}

export function getInstallmentPlanById(
  planId: string,
): InstallmentPlan | undefined {
  return getInstallmentPlans().find((plan) => plan.id === planId);
}

export function getInstallmentPlanByPurchaseId(
  purchaseId: string,
): InstallmentPlan | undefined {
  return getInstallmentPlans().find(
    (plan) => plan.cardPurchaseId === purchaseId,
  );
}

// -----------------------------------------------------------------------------
// CONSULTAS DE PARCIALIDADES
// -----------------------------------------------------------------------------

export function getInstallments(): Installment[] {
  return loadAccountStorage()?.installments ?? [];
}

export function getInstallmentsByPlan(planId: string): Installment[] {
  return getInstallments()
    .filter((installment) => installment.planId === planId)
    .sort((a, b) => a.installmentNumber - b.installmentNumber);
}

export function getInstallmentById(
  installmentId: string,
): Installment | undefined {
  return getInstallments().find(
    (installment) => installment.id === installmentId,
  );
}
export function getPendingInstallments(): Installment[] {
  return getInstallments().filter(
    (installment) => installment.status === "pending",
  );
}

export function getPartialInstallments(): Installment[] {
  return getInstallments().filter(
    (installment) => installment.status === "partial",
  );
}

export function getPaidInstallments(): Installment[] {
  return getInstallments().filter(
    (installment) => installment.status === "paid",
  );
}

export function getInstallmentRemainingAmount(
  installment: Installment,
): number {
  return Math.max(0, roundMoney(installment.amount - installment.paidAmount));
}

// -----------------------------------------------------------------------------
// CREACIÓN DE PLANES MSI
// -----------------------------------------------------------------------------

export function createInstallmentPlan(
  data: CreateInstallmentPlanData,
): InstallmentPlan {
  const storage = loadAccountStorage();

  if (!storage) {
    throw new Error("No hay información de cuentas disponible.");
  }

  const purchase = storage.purchases.find(
    (item) => item.id === data.purchaseId,
  );

  if (!purchase) {
    throw new Error("No se encontró la compra con tarjeta.");
  }

  if (purchase.status !== "active") {
    throw new Error("No se puede generar un plan para una compra cancelada.");
  }

  if (purchase.purchaseType !== "installments") {
    throw new Error("La compra no está registrada como meses sin intereses.");
  }

  if (
    purchase.installmentPlanId !== null ||
    storage.installmentPlans.some((plan) => plan.cardPurchaseId === purchase.id)
  ) {
    throw new Error("Esta compra ya tiene un plan de parcialidades asociado.");
  }

  const installmentCount = purchase.installmentCount;
  const firstDueDate = purchase.firstDueDate;

  if (
    installmentCount === null ||
    !Number.isInteger(installmentCount) ||
    installmentCount < 2
  ) {
    throw new Error(
      "La compra MSI debe tener al menos 2 parcialidades configuradas.",
    );
  }

  if (!firstDueDate || !isValidDate(firstDueDate)) {
    throw new Error(
      "La compra MSI debe tener una fecha de primera parcialidad válida.",
    );
  }

  if (!isValidDate(purchase.purchaseDate)) {
    throw new Error("La fecha de compra no es válida.");
  }

  if (firstDueDate <= purchase.purchaseDate) {
    throw new Error(
      "La primera fecha de pago debe ser posterior a la fecha de compra.",
    );
  }

  if (
    !Number.isFinite(purchase.amount) ||
    purchase.amount <= 0 ||
    roundMoney(purchase.amount) !== purchase.amount ||
    !Number.isSafeInteger(Math.round(purchase.amount * 100))
  ) {
    throw new Error("El importe de la compra no es válido.");
  }

  const planId = generateId();
  const createdAt = new Date().toISOString();

  const plan: InstallmentPlan = {
    id: planId,
    cardPurchaseId: purchase.id,
    totalAmount: purchase.amount,
    installmentCount,
    firstDueDate,
    status: "active",
    createdAt,
  };

  const amounts = calculateInstallmentAmounts(
    purchase.amount,
    installmentCount,
  );

  const installments: Installment[] = amounts.map((amount, index) => ({
    id: generateId(),
    planId,
    installmentNumber: index + 1,
    dueDate: addMonthsClamped(firstDueDate, index),
    amount,
    paidAmount: 0,
    status: "pending",
    payments: [],
    createdAt,
  }));

  const updatedPurchase = {
    ...purchase,
    installmentPlanId: planId,
  };

  const updatedStorage = {
    ...storage,
    purchases: storage.purchases.map((item) =>
      item.id === purchase.id ? updatedPurchase : item,
    ),
    installmentPlans: [...storage.installmentPlans, plan],
    installments: [...storage.installments, ...installments],
  };

  if (!saveAccountStorage(updatedStorage)) {
    throw new Error("No fue posible guardar el plan de parcialidades.");
  }

  return plan;
}

// -----------------------------------------------------------------------------
// SALDOS PENDIENTES
// -----------------------------------------------------------------------------

export function getPlanOutstandingAmount(planId: string): number {
  const plan = getInstallmentPlanById(planId);

  if (!plan || plan.status !== "active") {
    return 0;
  }

  const outstanding = getInstallmentsByPlan(planId).reduce(
    (total, installment) => total + getInstallmentRemainingAmount(installment),
    0,
  );

  return roundMoney(outstanding);
}

export function getPlanPaidAmount(planId: string): number {
  const total = getInstallmentsByPlan(planId).reduce(
    (sum, installment) => sum + installment.paidAmount,
    0,
  );

  return roundMoney(total);
}

export function getPlanProgress(planId: string): number {
  const plan = getInstallmentPlanById(planId);

  if (!plan || plan.totalAmount <= 0) {
    return 0;
  }

  const paidAmount = getPlanPaidAmount(planId);

  return Math.min(100, Math.round((paidAmount / plan.totalAmount) * 100));
}

// -----------------------------------------------------------------------------
// CANCELACIÓN DE PLANES
// -----------------------------------------------------------------------------

/**
 * La cancelación de un plan MSI debe coordinarse con la cancelación de su
 * compra y de la transacción financiera relacionada.
 *
 * Utiliza cancelCardPurchase() desde card-purchase.service.ts. Esta función
 * se conserva temporalmente para ofrecer un error explícito a cualquier
 * consumidor anterior y evitar una cancelación parcial del estado financiero.
 *
 * @deprecated Utiliza cancelCardPurchase(purchaseId).
 */
export function cancelInstallmentPlan(planId: string): InstallmentPlan {
  const storage = loadAccountStorage();

  if (!storage) {
    throw new Error("No hay información de cuentas disponible.");
  }

  const plan = storage.installmentPlans.find((item) => item.id === planId);

  if (!plan) {
    throw new Error("No se encontró el plan de parcialidades.");
  }

  throw new Error(
    "La cancelación de un plan MSI debe realizarse junto con su compra y transacción. Utiliza cancelCardPurchase() con el ID de la compra asociada.",
  );
}
