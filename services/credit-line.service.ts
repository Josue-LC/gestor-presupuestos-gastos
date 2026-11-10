
import type {
  CreditLine,
  CreditLineCharge,
  CreditLineDrawdown,
  CreditLinePayment,
  CreditLineStatus,
} from "../types/credit-line.types";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "./account-storage.service";

const MONEY_EPSILON = 0.000001;

export interface CreateCreditLineInput {
  name: string;
  institutionId: string;
  contractNumber?: string | null;
  creditLimit: number;
  annualInterestRate: number;
  interestType: CreditLine["interestType"];
  interestCalculationMethod: CreditLine["interestCalculationMethod"];
  paymentFrequency: CreditLine["paymentFrequency"];
  cutoffDay?: number | null;
  paymentDueDay?: number | null;
  openingDate: string;
  expirationDate?: string | null;
  paymentAccountId?: string | null;
  notes?: string | null;
}

export type UpdateCreditLineInput = Partial<
  Omit<
    CreditLine,
    | "id"
    | "status"
    | "createdAt"
    | "updatedAt"
    | "closedAt"
  >
>;

export interface CreditLineFinancialSummary {
  creditLimit: number;
  usedAmount: number;
  availableAmount: number;
  utilizationPercentage: number;
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
      "No fue posible guardar los cambios de la línea de crédito.",
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

function validateDay(
  value: number | null,
  fieldName: string,
): void {
  if (value === null) {
    return;
  }

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 31
  ) {
    throw new Error(
      `${fieldName} debe ser un día entre 1 y 31.`,
    );
  }
}

function validateDate(
  value: string,
  fieldName: string,
): void {
  if (
    !value ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new Error(`${fieldName} no es una fecha válida.`);
  }
}

function validateInstitutionAndAccount(
  institutionId: string,
  paymentAccountId: string | null,
  storage: ReturnType<typeof loadAccountStorage>,
): void {
  if (
    !storage.banks.some(
      (bank) => bank.id === institutionId,
    )
  ) {
    throw new Error(
      "La institución financiera seleccionada no existe.",
    );
  }

  if (paymentAccountId === null) {
    return;
  }

  const account = storage.accounts.find(
    (item) => item.id === paymentAccountId,
  );

  if (!account) {
    throw new Error(
      "La cuenta asociada al pago no existe.",
    );
  }

  if (account.status !== "active") {
    throw new Error(
      "No puedes asociar una cuenta archivada a la línea de crédito.",
    );
  }
}

function validateCreditLineData(
  creditLine: CreateCreditLineInput | CreditLine,
  storage: ReturnType<typeof loadAccountStorage>,
): void {
  if (!creditLine.name.trim()) {
    throw new Error(
      "El nombre de la línea de crédito es obligatorio.",
    );
  }

  if (!creditLine.institutionId) {
    throw new Error(
      "Debes seleccionar una institución financiera.",
    );
  }

  if (
    !isValidMoney(creditLine.creditLimit) ||
    creditLine.creditLimit <= 0
  ) {
    throw new Error(
      "El límite de crédito debe ser mayor a cero.",
    );
  }

  if (!isValidMoney(creditLine.annualInterestRate)) {
    throw new Error(
      "La tasa de interés anual no es válida.",
    );
  }

  validateDate(
    creditLine.openingDate,
    "La fecha de apertura",
  );

  if (creditLine.expirationDate) {
    validateDate(
      creditLine.expirationDate,
      "La fecha de vencimiento",
    );

    if (
      new Date(creditLine.expirationDate).getTime() <
      new Date(creditLine.openingDate).getTime()
    ) {
      throw new Error(
        "La fecha de vencimiento no puede ser anterior a la fecha de apertura.",
      );
    }
  }

  validateDay(
    creditLine.cutoffDay ?? null,
    "El día de corte",
  );

  validateDay(
    creditLine.paymentDueDay ?? null,
    "El día límite de pago",
  );

  validateInstitutionAndAccount(
    creditLine.institutionId,
    creditLine.paymentAccountId ?? null,
    storage,
  );
}

/**
 * Calcula el saldo utilizado de una línea de crédito.
 *
 * Se consideran:
 * - Disposiciones activas.
 * - Cargos activos capitalizados.
 * - Pagos completados aplicados a capital.
 */
function calculateUsedAmount(
  creditLineId: string,
  drawdowns: CreditLineDrawdown[],
  payments: CreditLinePayment[],
  charges: CreditLineCharge[],
): number {
  const totalDrawdowns = drawdowns
    .filter(
      (item) =>
        item.creditLineId === creditLineId &&
        item.status === "active",
    )
    .reduce(
      (total, item) => total + item.amount,
      0,
    );

  const totalCapitalizedCharges = charges
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

  const totalPrincipalPaid = payments
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

/**
 * Crea una nueva línea de crédito.
 */
export function createCreditLine(
  input: CreateCreditLineInput,
): CreditLine {
  const storage = loadAccountStorage();

  const normalizedInput = {
    ...input,
    name: input.name.trim(),
    paymentAccountId: input.paymentAccountId ?? null,
    expirationDate: input.expirationDate ?? null,
    cutoffDay: input.cutoffDay ?? null,
    paymentDueDay: input.paymentDueDay ?? null,
    contractNumber: input.contractNumber?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  validateCreditLineData(normalizedInput, storage);

  const timestamp = getCurrentTimestamp();

  const creditLine: CreditLine = {
    id: generateId(),
    ...normalizedInput,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const updatedStorage = {
    ...storage,
    creditLines: [
      ...storage.creditLines,
      creditLine,
    ],
  };

  persistStorage(updatedStorage);

  return creditLine;
}

/**
 * Obtiene todas las líneas de crédito.
 *
 * Se puede filtrar por estado.
 */
export function getCreditLines(
  status?: CreditLineStatus,
): CreditLine[] {
  const storage = loadAccountStorage();

  return storage.creditLines
    .filter(
      (creditLine) =>
        !status || creditLine.status === status,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );
}

/**
 * Obtiene una línea de crédito por su identificador.
 */
export function getCreditLineById(
  creditLineId: string,
): CreditLine | null {
  const storage = loadAccountStorage();

  return (
    storage.creditLines.find(
      (item) => item.id === creditLineId,
    ) ?? null
  );
}

/**
 * Obtiene el saldo utilizado y disponible de una línea.
 */
export function getCreditLineFinancialSummary(
  creditLineId: string,
): CreditLineFinancialSummary {
  const storage = loadAccountStorage();

  const creditLine = getCreditLineOrThrow(
    creditLineId,
    storage.creditLines,
  );

  const usedAmount = calculateUsedAmount(
    creditLine.id,
    storage.creditLineDrawdowns,
    storage.creditLinePayments,
    storage.creditLineCharges,
  );

  const availableAmount = roundMoney(
    Math.max(0, creditLine.creditLimit - usedAmount),
  );

  const utilizationPercentage =
    creditLine.creditLimit > 0
      ? roundMoney(
          (usedAmount / creditLine.creditLimit) * 100,
        )
      : 0;

  return {
    creditLimit: creditLine.creditLimit,
    usedAmount,
    availableAmount,
    utilizationPercentage,
  };
}

/**
 * Actualiza las condiciones de una línea de crédito.
 *
 * No permite modificar líneas cerradas.
 * El límite no puede quedar por debajo del saldo utilizado.
 */
export function updateCreditLine(
  creditLineId: string,
  updates: UpdateCreditLineInput,
): CreditLine {
  const storage = loadAccountStorage();

  const currentCreditLine = getCreditLineOrThrow(
    creditLineId,
    storage.creditLines,
  );

  if (currentCreditLine.status === "closed") {
    throw new Error(
      "No puedes modificar una línea de crédito cerrada.",
    );
  }

  const normalizedUpdates: UpdateCreditLineInput = {
    ...updates,
  };

  if (updates.name !== undefined) {
    normalizedUpdates.name = updates.name.trim();
  }

  if (updates.contractNumber !== undefined) {
    normalizedUpdates.contractNumber =
      updates.contractNumber?.trim() || null;
  }

  if (updates.notes !== undefined) {
    normalizedUpdates.notes =
      updates.notes?.trim() || null;
  }

  const updatedCreditLine: CreditLine = {
    ...currentCreditLine,
    ...normalizedUpdates,
    updatedAt: getCurrentTimestamp(),
  };

  validateCreditLineData(updatedCreditLine, storage);

  const usedAmount = calculateUsedAmount(
    creditLineId,
    storage.creditLineDrawdowns,
    storage.creditLinePayments,
    storage.creditLineCharges,
  );

  if (
    updatedCreditLine.creditLimit <
    usedAmount - MONEY_EPSILON
  ) {
    throw new Error(
      `El límite no puede ser menor al saldo utilizado ($${usedAmount.toFixed(2)}).`,
    );
  }

  const updatedStorage = {
    ...storage,
    creditLines: storage.creditLines.map((item) =>
      item.id === creditLineId
        ? updatedCreditLine
        : item,
    ),
  };

  persistStorage(updatedStorage);

  return updatedCreditLine;
}

/**
 * Suspende temporalmente una línea de crédito.
 *
 * Una línea suspendida no podrá recibir nuevas disposiciones.
 */
export function suspendCreditLine(
  creditLineId: string,
): CreditLine {
  const storage = loadAccountStorage();

  const creditLine = getCreditLineOrThrow(
    creditLineId,
    storage.creditLines,
  );

  if (creditLine.status !== "active") {
    throw new Error(
      "Solo puedes suspender una línea de crédito activa.",
    );
  }

  const updatedCreditLine: CreditLine = {
    ...creditLine,
    status: "suspended",
    updatedAt: getCurrentTimestamp(),
  };

  const updatedStorage = {
    ...storage,
    creditLines: storage.creditLines.map((item) =>
      item.id === creditLineId
        ? updatedCreditLine
        : item,
    ),
  };

  persistStorage(updatedStorage);

  return updatedCreditLine;
}

/**
 * Reactiva una línea de crédito suspendida.
 */
export function reactivateCreditLine(
  creditLineId: string,
): CreditLine {
  const storage = loadAccountStorage();

  const creditLine = getCreditLineOrThrow(
    creditLineId,
    storage.creditLines,
  );

  if (creditLine.status !== "suspended") {
    throw new Error(
      "Solo puedes reactivar una línea de crédito suspendida.",
    );
  }

  const updatedCreditLine: CreditLine = {
    ...creditLine,
    status: "active",
    updatedAt: getCurrentTimestamp(),
  };

  const updatedStorage = {
    ...storage,
    creditLines: storage.creditLines.map((item) =>
      item.id === creditLineId
        ? updatedCreditLine
        : item,
    ),
  };

  persistStorage(updatedStorage);

  return updatedCreditLine;
}

/**
 * Cierra definitivamente una línea de crédito.
 *
 * Solo se permite cerrar cuando el saldo utilizado es cero.
 * El registro y su historial se conservan.
 */
export function closeCreditLine(
  creditLineId: string,
): CreditLine {
  const storage = loadAccountStorage();

  const creditLine = getCreditLineOrThrow(
    creditLineId,
    storage.creditLines,
  );

  if (creditLine.status === "closed") {
    throw new Error(
      "La línea de crédito ya está cerrada.",
    );
  }

  const usedAmount = calculateUsedAmount(
    creditLineId,
    storage.creditLineDrawdowns,
    storage.creditLinePayments,
    storage.creditLineCharges,
  );

  if (usedAmount > MONEY_EPSILON) {
    throw new Error(
      `No puedes cerrar la línea mientras tenga un saldo utilizado de $${usedAmount.toFixed(2)}.`,
    );
  }

  const timestamp = getCurrentTimestamp();

  const updatedCreditLine: CreditLine = {
    ...creditLine,
    status: "closed",
    closedAt: timestamp,
    updatedAt: timestamp,
  };

  const updatedStorage = {
    ...storage,
    creditLines: storage.creditLines.map((item) =>
      item.id === creditLineId
        ? updatedCreditLine
        : item,
    ),
  };

  persistStorage(updatedStorage);

  return updatedCreditLine;
}
