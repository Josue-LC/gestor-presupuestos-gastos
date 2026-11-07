import type {
  Installment,
  InstallmentInterestType,
  InstallmentPlan,
} from "@/types/account";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "@/services/account-storage.service";

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

export interface CreateInstallmentPlanData {
  purchaseId: string;
}

interface InstallmentAmounts {
  principalAmount: number;
  interestAmount: number;
  amount: number;
}

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
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

// -----------------------------------------------------------------------------
// CÁLCULO DE PARCIALIDADES IGUALES
// -----------------------------------------------------------------------------

function calculateEqualInstallments(
  principalAmount: number,
  interestAmount: number,
  installmentCount: number,
): InstallmentAmounts[] {
  const principalCents = toCents(principalAmount);
  const interestCents = toCents(interestAmount);

  const totalCents = principalCents + interestCents;

  const baseCents = Math.floor(totalCents / installmentCount);
  const remainderCents = totalCents % installmentCount;

  const principalBase = Math.floor(principalCents / installmentCount);

  const principalRemainder = principalCents % installmentCount;

  return Array.from({ length: installmentCount }, (_, index) => {
    const principalCentsForInstallment =
      principalBase + (index < principalRemainder ? 1 : 0);

    const amountCents = baseCents + (index < remainderCents ? 1 : 0);

    const interestCentsForInstallment =
      amountCents - principalCentsForInstallment;

    return {
      principalAmount: principalCentsForInstallment / 100,
      interestAmount: interestCentsForInstallment / 100,
      amount: amountCents / 100,
    };
  });
}

// -----------------------------------------------------------------------------
// AMORTIZACIÓN FRANCESA
// -----------------------------------------------------------------------------

/**
 * Genera un calendario de amortización francesa.
 *
 * La mensualidad se mantiene constante, mientras que:
 * - Los intereses disminuyen.
 * - El capital amortizado aumenta.
 * - El último pago absorbe los ajustes de redondeo.
 */
function calculateFrenchAmortization(
  principalAmount: number,
  annualInterestRate: number,
  installmentCount: number,
): InstallmentAmounts[] {
  const monthlyRate = annualInterestRate / 100 / 12;

  if (monthlyRate <= 0) {
    return calculateEqualInstallments(principalAmount, 0, installmentCount);
  }

  const principalCents = toCents(principalAmount);
  const principal = principalCents / 100;

  const discountFactor = Math.pow(1 + monthlyRate, -installmentCount);

  const monthlyPayment = (principal * monthlyRate) / (1 - discountFactor);

  if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) {
    throw new Error("No fue posible calcular la mensualidad.");
  }

  let outstandingPrincipal = principalCents;

  const result: InstallmentAmounts[] = [];

  for (let index = 0; index < installmentCount; index++) {
    const isLastInstallment = index === installmentCount - 1;

    const interestCents = Math.round(outstandingPrincipal * monthlyRate);

    let principalCentsForInstallment: number;

    if (isLastInstallment) {
      principalCentsForInstallment = outstandingPrincipal;
    } else {
      const paymentCents = Math.round(monthlyPayment * 100);

      principalCentsForInstallment = Math.min(
        outstandingPrincipal,
        paymentCents - interestCents,
      );
    }

    if (principalCentsForInstallment <= 0) {
      throw new Error(
        "La tasa de interés genera una mensualidad insuficiente para amortizar el capital.",
      );
    }

    const amountCents = principalCentsForInstallment + interestCents;

    result.push({
      principalAmount: principalCentsForInstallment / 100,
      interestAmount: interestCents / 100,
      amount: amountCents / 100,
    });

    outstandingPrincipal -= principalCentsForInstallment;
  }

  if (outstandingPrincipal !== 0) {
    throw new Error("No fue posible liquidar el capital al finalizar el plan.");
  }

  return result;
}

// -----------------------------------------------------------------------------
// ESTADOS
// -----------------------------------------------------------------------------

function getInstallmentStatus(
  amount: number,
  paidAmount: number,
): Installment["status"] {
  if (paidAmount >= amount) return "paid";
  if (paidAmount > 0) return "partial";

  return "pending";
}

// -----------------------------------------------------------------------------
// VALIDACIONES
// -----------------------------------------------------------------------------

function validateInstallmentCount(installmentCount: number): void {
  if (
    !Number.isInteger(installmentCount) ||
    installmentCount < 2 ||
    installmentCount > 120
  ) {
    throw new Error("El número de parcialidades debe estar entre 2 y 120.");
  }
}

function validateInterestConfiguration(
  interestType: InstallmentInterestType,
  interestAmount: number,
  annualInterestRate: number | null,
): void {
  if (!isNonNegativeMoney(interestAmount)) {
    throw new Error("El importe de intereses no es válido.");
  }

  if (interestType === "none") {
    if (interestAmount !== 0 || annualInterestRate !== null) {
      throw new Error(
        "Una compra sin intereses no debe contener una tasa anual ni intereses fijos.",
      );
    }

    return;
  }

  if (interestType === "fixed") {
    if (!isValidMoney(interestAmount)) {
      throw new Error("El importe de intereses fijos debe ser mayor que cero.");
    }

    if (annualInterestRate !== null) {
      throw new Error(
        "Una compra con interés fijo no debe incluir una tasa anual.",
      );
    }

    return;
  }

  if (interestType === "annual_rate") {
    if (
      interestAmount !== 0 ||
      annualInterestRate === null ||
      !Number.isFinite(annualInterestRate) ||
      annualInterestRate <= 0 ||
      annualInterestRate > 1000
    ) {
      throw new Error(
        "La tasa anual debe ser mayor a 0 y menor o igual a 1000%.",
      );
    }

    return;
  }

  throw new Error("El tipo de interés no es válido.");
}

// -----------------------------------------------------------------------------
// CALCULAR PLAN
// -----------------------------------------------------------------------------

function calculatePlanAmounts(
  principalAmount: number,
  interestType: InstallmentInterestType,
  interestAmount: number,
  annualInterestRate: number | null,
  installmentCount: number,
): InstallmentAmounts[] {
  if (interestType === "none") {
    return calculateEqualInstallments(principalAmount, 0, installmentCount);
  }

  if (interestType === "fixed") {
    return calculateEqualInstallments(
      principalAmount,
      interestAmount,
      installmentCount,
    );
  }

  if (interestType === "annual_rate") {
    if (annualInterestRate === null) {
      throw new Error("No se encontró la tasa anual del plan.");
    }

    return calculateFrenchAmortization(
      principalAmount,
      annualInterestRate,
      installmentCount,
    );
  }

  throw new Error("El tipo de interés no es válido.");
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
// CREACIÓN DE PLANES
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
    throw new Error(
      "La compra no está configurada para pagarse en parcialidades.",
    );
  }

  if (
    purchase.installmentPlanId !== null ||
    storage.installmentPlans.some((plan) => plan.cardPurchaseId === purchase.id)
  ) {
    throw new Error("Esta compra ya tiene un plan asociado.");
  }

  const installmentCount = purchase.installmentCount;
  const firstDueDate = purchase.firstDueDate;

  if (installmentCount === null) {
    throw new Error("La compra no tiene un número de parcialidades.");
  }

  validateInstallmentCount(installmentCount);

  if (!firstDueDate || !isValidDate(firstDueDate)) {
    throw new Error("La fecha de la primera parcialidad no es válida.");
  }

  if (!isValidDate(purchase.purchaseDate)) {
    throw new Error("La fecha de compra no es válida.");
  }

  if (firstDueDate <= purchase.purchaseDate) {
    throw new Error(
      "La primera fecha de pago debe ser posterior a la fecha de compra.",
    );
  }

  if (!isValidMoney(purchase.amount)) {
    throw new Error("El importe de la compra no es válido.");
  }

  const interestType = purchase.interestType ?? "none";

  const interestAmount = purchase.interestAmount ?? 0;

  const annualInterestRate = purchase.annualInterestRate ?? null;

  validateInterestConfiguration(
    interestType,
    interestAmount,
    annualInterestRate,
  );

  // Calcular capital, intereses y total de cada parcialidad.
  const amounts = calculatePlanAmounts(
    purchase.amount,
    interestType,
    interestAmount,
    annualInterestRate,
    installmentCount,
  );

  const principalTotal = roundMoney(
    amounts.reduce((total, item) => total + item.principalAmount, 0),
  );

  const interestTotal = roundMoney(
    amounts.reduce((total, item) => total + item.interestAmount, 0),
  );

  const totalAmount = roundMoney(principalTotal + interestTotal);

  if (principalTotal !== roundMoney(purchase.amount)) {
    throw new Error(
      "El capital amortizado no coincide con el importe original.",
    );
  }

  if (interestType === "none" && interestTotal !== 0) {
    throw new Error("Un plan sin intereses no puede generar intereses.");
  }

  if (
    interestType === "fixed" &&
    interestTotal !== roundMoney(interestAmount)
  ) {
    throw new Error(
      "El interés calculado no coincide con el importe fijo configurado.",
    );
  }

  const planId = generateId();
  const createdAt = new Date().toISOString();

  const plan: InstallmentPlan = {
    id: planId,
    cardPurchaseId: purchase.id,

    principalAmount: principalTotal,
    interestAmount: interestTotal,
    totalAmount,

    interestType,
    annualInterestRate,

    installmentCount,
    firstDueDate,

    status: "active",
    createdAt,
  };

  const installments: Installment[] = amounts.map((item, index) => ({
    id: generateId(),
    planId,
    installmentNumber: index + 1,
    dueDate: addMonthsClamped(firstDueDate, index),

    principalAmount: item.principalAmount,
    interestAmount: item.interestAmount,
    amount: item.amount,

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

  return roundMoney(
    getInstallmentsByPlan(planId).reduce(
      (total, installment) =>
        total + getInstallmentRemainingAmount(installment),
      0,
    ),
  );
}

export function getPlanPaidAmount(planId: string): number {
  return roundMoney(
    getInstallmentsByPlan(planId).reduce(
      (sum, installment) => sum + installment.paidAmount,
      0,
    ),
  );
}

export function getPlanProgress(planId: string): number {
  const plan = getInstallmentPlanById(planId);

  if (!plan || plan.totalAmount <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round((getPlanPaidAmount(planId) / plan.totalAmount) * 100),
  );
}

// -----------------------------------------------------------------------------
// CANCELACIÓN DE PLANES
// -----------------------------------------------------------------------------

/**
 * La cancelación debe coordinarse con la compra y la transacción relacionada.
 * Utiliza cancelCardPurchase() desde card-purchase.service.ts.
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
    "La cancelación debe realizarse junto con su compra y transacción. Utiliza cancelCardPurchase() con el ID de la compra asociada.",
  );
}
