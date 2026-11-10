
import type {
  CreditLine,
  CreditLineDrawdown,
  CreditLineDrawdownDestination,
} from "../types/credit-line.types";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "./account-storage.service";

const MONEY_EPSILON = 0.000001;

export interface CreateCreditLineDrawdownInput {
  creditLineId: string;
  description: string;
  amount: number;
  drawdownDate?: string;
  destinationType: CreditLineDrawdownDestination;
  destinationAccountId?: string | null;
  destinationDescription?: string | null;
  notes?: string | null;
}

export interface CreditLineDrawdownResult {
  drawdown: CreditLineDrawdown;
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

function isValidAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function persistStorage(
  storage: ReturnType<typeof loadAccountStorage>,
): void {
  if (!saveAccountStorage(storage)) {
    throw new Error(
      "No fue posible guardar los cambios de la disposición.",
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

function validateDate(
  value: string,
  fieldName: string,
): void {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error(`${fieldName} no es una fecha válida.`);
  }
}

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

function validateDestination(
  input: CreateCreditLineDrawdownInput,
  storage: ReturnType<typeof loadAccountStorage>,
): {
  destinationAccountId: string | null;
  destinationDescription: string | null;
} {
  if (input.destinationType === "account") {
    if (!input.destinationAccountId) {
      throw new Error(
        "Debes seleccionar la cuenta que recibirá el dinero.",
      );
    }

    const account = storage.accounts.find(
      (item) => item.id === input.destinationAccountId,
    );

    if (!account) {
      throw new Error(
        "La cuenta de destino no existe.",
      );
    }

    if (account.status !== "active") {
      throw new Error(
        "No puedes utilizar una cuenta archivada como destino.",
      );
    }

    return {
      destinationAccountId: account.id,
      destinationDescription: null,
    };
  }

  if (input.destinationType === "external") {
    const description = input.destinationDescription?.trim();

    if (!description) {
      throw new Error(
        "Debes describir el destino externo del dinero.",
      );
    }

    return {
      destinationAccountId: null,
      destinationDescription: description,
    };
  }

  throw new Error("El tipo de destino no es válido.");
}

/**
 * Registra una disposición de una línea de crédito.
 *
 * El importe no puede superar el crédito disponible.
 * Todavía no modifica el saldo de la cuenta de destino.
 */
export function createCreditLineDrawdown(
  input: CreateCreditLineDrawdownInput,
): CreditLineDrawdownResult {
  const storage = loadAccountStorage();

  if (!input.creditLineId) {
    throw new Error(
      "Debes indicar la línea de crédito.",
    );
  }

  if (!input.description.trim()) {
    throw new Error(
      "La descripción de la disposición es obligatoria.",
    );
  }

  if (!isValidAmount(input.amount)) {
    throw new Error(
      "El importe de la disposición debe ser mayor a cero.",
    );
  }

  const creditLine = getCreditLineOrThrow(
    input.creditLineId,
    storage.creditLines,
  );

  if (creditLine.status !== "active") {
    throw new Error(
      "Solo puedes realizar disposiciones en líneas de crédito activas.",
    );
  }

  const drawdownDate =
    input.drawdownDate ?? getCurrentTimestamp();

  validateDate(
    drawdownDate,
    "La fecha de disposición",
  );

  if (
    new Date(drawdownDate).getTime() <
    new Date(creditLine.openingDate).getTime()
  ) {
    throw new Error(
      "La fecha de disposición no puede ser anterior a la apertura de la línea.",
    );
  }

  if (
    creditLine.expirationDate &&
    new Date(drawdownDate).getTime() >
      new Date(creditLine.expirationDate).getTime()
  ) {
    throw new Error(
      "La fecha de disposición no puede ser posterior al vencimiento de la línea.",
    );
  }

  const destination = validateDestination(
    input,
    storage,
  );

  const usedAmount = calculateUsedAmount(
    creditLine.id,
    storage,
  );

  const availableAmount = roundMoney(
    Math.max(0, creditLine.creditLimit - usedAmount),
  );

  if (
    roundMoney(input.amount) >
    availableAmount + MONEY_EPSILON
  ) {
    throw new Error(
      `La disposición supera el crédito disponible ($${availableAmount.toFixed(2)}).`,
    );
  }

  const timestamp = getCurrentTimestamp();

  const drawdown: CreditLineDrawdown = {
    id: generateId(),
    creditLineId: creditLine.id,
    description: input.description.trim(),
    amount: roundMoney(input.amount),
    drawdownDate: new Date(drawdownDate).toISOString(),
    destinationType: input.destinationType,
    destinationAccountId: destination.destinationAccountId,
    destinationDescription: destination.destinationDescription,
    transactionId: null,
    status: "active",
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
    creditLineDrawdowns: [
      ...storage.creditLineDrawdowns,
      drawdown,
    ],
  };

  persistStorage(updatedStorage);

  const newUsedAmount = roundMoney(
    usedAmount + drawdown.amount,
  );

  return {
    drawdown,
    creditLine: updatedCreditLine,
    usedAmount: newUsedAmount,
    availableAmount: roundMoney(
      Math.max(
        0,
        creditLine.creditLimit - newUsedAmount,
      ),
    ),
  };
}

/**
 * Obtiene todas las disposiciones de una línea de crédito.
 */
export function getCreditLineDrawdowns(
  creditLineId: string,
  status?: CreditLineDrawdown["status"],
): CreditLineDrawdown[] {
  const storage = loadAccountStorage();

  return storage.creditLineDrawdowns
    .filter(
      (item) =>
        item.creditLineId === creditLineId &&
        (!status || item.status === status),
    )
    .sort(
      (a, b) =>
        new Date(b.drawdownDate).getTime() -
        new Date(a.drawdownDate).getTime(),
    );
}

/**
 * Obtiene una disposición por su identificador.
 */
export function getCreditLineDrawdownById(
  drawdownId: string,
): CreditLineDrawdown | null {
  const storage = loadAccountStorage();

  return (
    storage.creditLineDrawdowns.find(
      (item) => item.id === drawdownId,
    ) ?? null
  );
}

/**
 * Cancela una disposición que todavía no tiene una transacción asociada.
 *
 * Se conservan los datos históricos y se libera el crédito utilizado.
 */
export function cancelCreditLineDrawdown(
  drawdownId: string,
): CreditLineDrawdown {
  const storage = loadAccountStorage();

  const drawdown = storage.creditLineDrawdowns.find(
    (item) => item.id === drawdownId,
  );

  if (!drawdown) {
    throw new Error(
      "No se encontró la disposición.",
    );
  }

  if (drawdown.status === "cancelled") {
    throw new Error(
      "Esta disposición ya está cancelada.",
    );
  }

  if (drawdown.transactionId) {
    throw new Error(
      "No puedes cancelar directamente una disposición asociada a una transacción. Primero debe revertirse el movimiento financiero.",
    );
  }

  const hasCompletedPayments =
    storage.creditLinePayments.some(
      (payment) =>
        payment.creditLineId === drawdown.creditLineId &&
        payment.status === "completed",
    );

  if (hasCompletedPayments) {
    throw new Error(
      "No se puede cancelar la disposición porque la línea ya tiene pagos registrados. Se necesita una lógica de reversión de capital para conservar la trazabilidad.",
    );
  }

  const creditLine = getCreditLineOrThrow(
    drawdown.creditLineId,
    storage.creditLines,
  );

  const timestamp = getCurrentTimestamp();

  const cancelledDrawdown: CreditLineDrawdown = {
    ...drawdown,
    status: "cancelled",
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
    creditLineDrawdowns: storage.creditLineDrawdowns.map(
      (item) =>
        item.id === drawdown.id
          ? cancelledDrawdown
          : item,
    ),
  };

  persistStorage(updatedStorage);

  return cancelledDrawdown;
}

/**
 * Obtiene el total dispuesto de una línea de crédito.
 */
export function getCreditLineTotalDrawn(
  creditLineId: string,
): number {
  const storage = loadAccountStorage();

  return roundMoney(
    storage.creditLineDrawdowns
      .filter(
        (item) =>
          item.creditLineId === creditLineId &&
          item.status === "active",
      )
      .reduce(
        (total, item) => total + item.amount,
        0,
      ),
  );
}

/**
 * Obtiene el crédito disponible de una línea.
 */
export function getCreditLineAvailableAmount(
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
    Math.max(0, creditLine.creditLimit - usedAmount),
  );
}
