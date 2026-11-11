
import type {
  CreditLine,
  CreditLinePayment,
} from "../types/credit-line.types";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "./account-storage.service";

const MONEY_EPSILON = 0.000001;

export interface CreateCreditLinePaymentInput {
  creditLineId: string;
  amount: number;
  principalPaid?: number;
  interestPaid?: number;
  commissionPaid?: number;
  insurancePaid?: number;
  paidAt?: string;
  sourceAccountId?: string | null;
  transactionId?: string | null;
  notes?: string | null;
}

export interface CreditLinePaymentSummary {
  totalPaid: number;
  principalPaid: number;
  interestPaid: number;
  commissionPaid: number;
  insurancePaid: number;
  paymentCount: number;
}

export interface CreditLinePaymentResult {
  payment: CreditLinePayment;
  creditLine: CreditLine;
  usedAmount: number;
  availableAmount: number;
}

function generateId(): string {
  return crypto.randomUUID();
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidMoney(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function persistStorage(
  storage: ReturnType<typeof loadAccountStorage>,
): void {
  if (!saveAccountStorage(storage)) {
    throw new Error(
      "No fue posible guardar los cambios del pago de la línea de crédito.",
    );
  }
}

function getCreditLineOrThrow(
  creditLineId: string,
  creditLines: CreditLine[],
): CreditLine {
  const creditLine = creditLines.find(
    (item) => item.id === creditLineId,
  );

  if (!creditLine) {
    throw new Error("No se encontró la línea de crédito.");
  }

  return creditLine;
}

/**
 * Calcula el saldo utilizado:
 * disposiciones activas + cargos capitalizados activos
 * - capital pagado en pagos completados.
 */
function calculateUsedAmount(
  creditLineId: string,
  storage: ReturnType<typeof loadAccountStorage>,
): number {
  const totalDrawdowns = storage.creditLineDrawdowns
    .filter(
      (item) =>
        item.creditLineId === creditLineId &&
        item.status === "active",
    )
    .reduce(
      (total, item) => total + item.amount,
      0,
    );

  const totalCapitalizedCharges = storage.creditLineCharges
    .filter(
      (item) =>
        item.creditLineId === creditLineId &&
        item.status === "active" &&
        item.capitalized,
    )
    .reduce(
      (total, item) => total + item.amount,
      0,
    );

  const totalPrincipalPaid = storage.creditLinePayments
    .filter(
      (item) =>
        item.creditLineId === creditLineId &&
        item.status === "completed",
    )
    .reduce(
      (total, item) => total + item.principalPaid,
      0,
    );

  return roundMoney(
    Math.max(
      0,
      totalDrawdowns +
        totalCapitalizedCharges -
        totalPrincipalPaid,
    ),
  );
}

function validatePaymentDate(
  paidAt: string,
  creditLine: CreditLine,
): void {
  if (!paidAt || Number.isNaN(Date.parse(paidAt))) {
    throw new Error("La fecha del pago no es válida.");
  }

  if (
    new Date(paidAt).getTime() <
    new Date(creditLine.openingDate).getTime()
  ) {
    throw new Error(
      "La fecha del pago no puede ser anterior a la apertura de la línea.",
    );
  }
}

function validateSourceAccount(
  sourceAccountId: string | null | undefined,
  storage: ReturnType<typeof loadAccountStorage>,
): void {
  if (
    sourceAccountId === undefined ||
    sourceAccountId === null
  ) {
    return;
  }

  const account = storage.accounts.find(
    (item) => item.id === sourceAccountId,
  );

  if (!account) {
    throw new Error("La cuenta de origen no existe.");
  }

  if (account.status !== "active") {
    throw new Error(
      "No puedes registrar el pago desde una cuenta archivada.",
    );
  }
}

function validatePaymentBreakdown(
  input: CreateCreditLinePaymentInput,
): {
  amount: number;
  principalPaid: number;
  interestPaid: number;
  commissionPaid: number;
  insurancePaid: number;
} {
  const amount = roundMoney(input.amount);
  const principalPaid = roundMoney(input.principalPaid ?? amount);
  const interestPaid = roundMoney(input.interestPaid ?? 0);
  const commissionPaid = roundMoney(input.commissionPaid ?? 0);
  const insurancePaid = roundMoney(input.insurancePaid ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "El importe total del pago debe ser mayor a cero.",
    );
  }

  const concepts = [
    principalPaid,
    interestPaid,
    commissionPaid,
    insurancePaid,
  ];

  if (!concepts.every(isValidMoney)) {
    throw new Error(
      "Los importes de capital, intereses, comisiones y seguros deben ser válidos y no negativos.",
    );
  }

  const breakdownTotal = roundMoney(
    principalPaid +
      interestPaid +
      commissionPaid +
      insurancePaid,
  );

  if (
    Math.abs(breakdownTotal - amount) > MONEY_EPSILON
  ) {
    throw new Error(
      "La suma de capital, intereses, comisiones y seguros debe coincidir con el importe total del pago.",
    );
  }

  return {
    amount,
    principalPaid,
    interestPaid,
    commissionPaid,
    insurancePaid,
  };
}

/**
 * Registra un pago de una línea de crédito.
 *
 * La distribución entre capital, intereses, comisiones y seguros
 * debe indicarse explícitamente.
 *
 * Solo el capital pagado reduce el saldo utilizado.
 */
export function createCreditLinePayment(
  input: CreateCreditLinePaymentInput,
): CreditLinePaymentResult {
  const storage = loadAccountStorage();

  if (!input.creditLineId) {
    throw new Error(
      "Debes indicar la línea de crédito.",
    );
  }

  const creditLine = getCreditLineOrThrow(
    input.creditLineId,
    storage.creditLines,
  );

  if (creditLine.status === "closed") {
    throw new Error(
      "No puedes registrar pagos en una línea de crédito cerrada.",
    );
  }

  const breakdown = validatePaymentBreakdown(input);

  const paidAt = input.paidAt ?? getCurrentTimestamp();

  validatePaymentDate(paidAt, creditLine);

  validateSourceAccount(
    input.sourceAccountId,
    storage,
  );

  const usedAmount = calculateUsedAmount(
    creditLine.id,
    storage,
  );

  if (
    breakdown.principalPaid >
    usedAmount + MONEY_EPSILON
  ) {
    throw new Error(
      `El capital pagado supera el saldo utilizado ($${usedAmount.toFixed(2)}).`,
    );
  }

  const timestamp = getCurrentTimestamp();

  const payment: CreditLinePayment = {
    id: generateId(),
    creditLineId: creditLine.id,
    sourceAccountId: input.sourceAccountId ?? null,
    amount: breakdown.amount,
    paidAt: new Date(paidAt).toISOString(),
    principalPaid: breakdown.principalPaid,
    interestPaid: breakdown.interestPaid,
    commissionPaid: breakdown.commissionPaid,
    insurancePaid: breakdown.insurancePaid,
    status: "completed",
    transactionId: input.transactionId?.trim() || null,
    notes: input.notes?.trim() || null,
    createdAt: timestamp,
  };

  const updatedCreditLine: CreditLine = {
    ...creditLine,
    updatedAt: timestamp,
  };

  const updatedStorage = {
    ...storage,
    creditLines: storage.creditLines.map((item) =>
      item.id === creditLine.id
        ? updatedCreditLine
        : item,
    ),
    creditLinePayments: [
      ...storage.creditLinePayments,
      payment,
    ],
  };

  persistStorage(updatedStorage);

  const newUsedAmount = calculateUsedAmount(
    creditLine.id,
    updatedStorage,
  );

  const availableAmount = roundMoney(
    Math.max(
      0,
      creditLine.creditLimit - newUsedAmount,
    ),
  );

  return {
    payment,
    creditLine: updatedCreditLine,
    usedAmount: newUsedAmount,
    availableAmount,
  };
}

/**
 * Cancela un pago y revierte su efecto sobre el capital utilizado.
 *
 * El registro permanece en el historial con status "cancelled".
 */
export function cancelCreditLinePayment(
  paymentId: string,
): CreditLinePayment {
  const storage = loadAccountStorage();

  const payment = storage.creditLinePayments.find(
    (item) => item.id === paymentId,
  );

  if (!payment) {
    throw new Error("No se encontró el pago.");
  }

  if (payment.status === "cancelled") {
    throw new Error("Este pago ya está cancelado.");
  }

  if (payment.transactionId) {
    throw new Error(
      "Este pago está asociado a una transacción. Primero debe revertirse el movimiento financiero.",
    );
  }

  const creditLine = getCreditLineOrThrow(
    payment.creditLineId,
    storage.creditLines,
  );

  const cancelledPayment: CreditLinePayment = {
    ...payment,
    status: "cancelled",
  };

  const timestamp = getCurrentTimestamp();

  const updatedCreditLine: CreditLine = {
    ...creditLine,
    updatedAt: timestamp,
  };

  const updatedStorage = {
    ...storage,
    creditLines: storage.creditLines.map((item) =>
      item.id === creditLine.id
        ? updatedCreditLine
        : item,
    ),
    creditLinePayments: storage.creditLinePayments.map(
      (item) =>
        item.id === payment.id
          ? cancelledPayment
          : item,
    ),
  };

  persistStorage(updatedStorage);

  return cancelledPayment;
}

/**
 * Obtiene todos los pagos de una línea de crédito.
 *
 * Se pueden consultar todos o filtrar por estado.
 */
export function getCreditLinePayments(
  creditLineId: string,
  status?: CreditLinePayment["status"],
): CreditLinePayment[] {
  const storage = loadAccountStorage();

  return storage.creditLinePayments
    .filter(
      (item) =>
        item.creditLineId === creditLineId &&
        (!status || item.status === status),
    )
    .sort(
      (a, b) =>
        new Date(b.paidAt).getTime() -
        new Date(a.paidAt).getTime(),
    );
}

/**
 * Obtiene un pago por su identificador.
 */
export function getCreditLinePaymentById(
  paymentId: string,
): CreditLinePayment | null {
  const storage = loadAccountStorage();

  return (
    storage.creditLinePayments.find(
      (item) => item.id === paymentId,
    ) ?? null
  );
}

/**
 * Calcula el resumen histórico de pagos completados.
 */
export function getCreditLinePaymentSummary(
  creditLineId: string,
): CreditLinePaymentSummary {
  const storage = loadAccountStorage();

  const payments = storage.creditLinePayments.filter(
    (item) =>
      item.creditLineId === creditLineId &&
      item.status === "completed",
  );

  return {
    totalPaid: roundMoney(
      payments.reduce(
        (total, item) => total + item.amount,
        0,
      ),
    ),
    principalPaid: roundMoney(
      payments.reduce(
        (total, item) => total + item.principalPaid,
        0,
      ),
    ),
    interestPaid: roundMoney(
      payments.reduce(
        (total, item) => total + item.interestPaid,
        0,
      ),
    ),
    commissionPaid: roundMoney(
      payments.reduce(
        (total, item) => total + item.commissionPaid,
        0,
      ),
    ),
    insurancePaid: roundMoney(
      payments.reduce(
        (total, item) => total + item.insurancePaid,
        0,
      ),
    ),
    paymentCount: payments.length,
  };
}

/**
 * Obtiene el saldo utilizado actual de una línea.
 */
export function getCreditLinePaymentOutstanding(
  creditLineId: string,
): number {
  const storage = loadAccountStorage();

  getCreditLineOrThrow(
    creditLineId,
    storage.creditLines,
  );

  return calculateUsedAmount(
    creditLineId,
    storage,
  );
}

/**
 * Obtiene el crédito disponible después de considerar
 * las disposiciones, cargos capitalizados y pagos de capital.
 */
export function getCreditLinePaymentAvailableAmount(
  creditLineId: string,
): number {
  const storage = loadAccountStorage();

  const creditLine = getCreditLineOrThrow(
    creditLineId,
    storage.creditLines,
  );

  const usedAmount = calculateUsedAmount(
    creditLineId,
    storage,
  );

  return roundMoney(
    Math.max(
      0,
      creditLine.creditLimit - usedAmount,
    ),
  );
}
