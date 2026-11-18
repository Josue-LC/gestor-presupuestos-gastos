import type {
  ScheduledPayment,
  ScheduledPaymentOccurrence,
  ScheduledPaymentFrequency,
} from "@/types/scheduled-payment.types";

import type { Transaction } from "@/components/transactions/TransactionList";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "@/services/account-storage.service";

import {
  loadTransactionStorage,
  saveTransactionStorage,
  clearTransactionStorage,
} from "@/services/transaction-storage.service";

import { createTransactionAuditEvent } from "@/services/transaction-audit.service";

// -----------------------------------------------------------------------------
// TIPOS PÚBLICOS
// -----------------------------------------------------------------------------

export interface CreateScheduledPaymentData {
  name: string;
  description?: string | null;
  category: string;
  frequency: ScheduledPaymentFrequency;
  amountType: "fixed" | "variable";
  amount?: number | null;
  firstDueDate: string;
  endDate?: string | null;
  defaultAccountId?: string | null;
  notes?: string | null;
}

export type UpdateScheduledPaymentData = Partial<CreateScheduledPaymentData>;

export interface GenerateScheduledOccurrencesResult {
  occurrences: ScheduledPaymentOccurrence[];
  generatedCount: number;
  nextDueDate: string | null;
}

export interface RegisterScheduledPaymentResult {
  occurrence: ScheduledPaymentOccurrence;
  transaction: Transaction;
}

type TransactionStorage = NonNullable<
  ReturnType<typeof loadTransactionStorage>
>;

const MAX_OCCURRENCES_PER_CALL = 500;
const VALID_FREQUENCIES: ScheduledPaymentFrequency[] = [
  "weekly",
  "biweekly",
  "monthly",
  "bimonthly",
  "quarterly",
  "yearly",
];

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID();
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidMoney(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value > 0 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}

function toUtcDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Calcula cada fecha desde la fecha ancla original. Así, un vencimiento
 * mensual del día 31 que cae en febrero no desplaza los meses siguientes
 * permanentemente al día 28.
 */
function getOccurrenceDate(
  anchorDate: string,
  frequency: ScheduledPaymentFrequency,
  index: number,
): string {
  const anchor = toUtcDate(anchorDate);

  if (frequency === "weekly" || frequency === "biweekly") {
    const days = frequency === "weekly" ? 7 : 14;
    anchor.setUTCDate(anchor.getUTCDate() + days * index);
    return formatUtcDate(anchor);
  }

  const monthsByFrequency: Record<
    Exclude<ScheduledPaymentFrequency, "weekly" | "biweekly">,
    number
  > = {
    monthly: 1,
    bimonthly: 2,
    quarterly: 3,
    yearly: 12,
  };

  const monthsToAdd =
    monthsByFrequency[
      frequency as Exclude<ScheduledPaymentFrequency, "weekly" | "biweekly">
    ] * index;

  const targetMonthIndex = anchor.getUTCMonth() + monthsToAdd;
  const targetYear =
    anchor.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = targetMonthIndex % 12;
  const anchorDay = Number(anchorDate.slice(8, 10));
  const targetDay = Math.min(
    anchorDay,
    getDaysInMonth(targetYear, normalizedMonth),
  );

  return formatUtcDate(
    new Date(Date.UTC(targetYear, normalizedMonth, targetDay)),
  );
}

function getFrequencyIndex(
  anchorDate: string,
  frequency: ScheduledPaymentFrequency,
  targetDate: string,
): number {
  // Los límites impiden ciclos infinitos ante datos manipulados.
  for (let index = 0; index <= 100_000; index += 1) {
    const candidate = getOccurrenceDate(anchorDate, frequency, index);
    if (candidate === targetDate) return index;
    if (candidate > targetDate) break;
  }
  return -1;
}

function validateScheduledPaymentData(
  data: CreateScheduledPaymentData,
  accountIdBeingUpdated?: string,
): void {
  const storage = loadAccountStorage();

  if (!data.name.trim()) {
    throw new Error("El nombre del pago recurrente es obligatorio.");
  }
  if (!data.category.trim()) {
    throw new Error("La categoría del pago recurrente es obligatoria.");
  }
  if (!VALID_FREQUENCIES.includes(data.frequency)) {
    throw new Error("La frecuencia seleccionada no es válida.");
  }
  if (!isValidDate(data.firstDueDate)) {
    throw new Error("La fecha del primer vencimiento no es válida.");
  }
  if (data.endDate && !isValidDate(data.endDate)) {
    throw new Error("La fecha final no es válida.");
  }
  if (data.endDate && data.endDate < data.firstDueDate) {
    throw new Error(
      "La fecha final no puede ser anterior al primer vencimiento.",
    );
  }

  if (data.amountType === "fixed") {
    if (
      data.amount === null ||
      data.amount === undefined ||
      !isValidMoney(data.amount)
    ) {
      throw new Error("Un pago de importe fijo debe tener un importe válido.");
    }
  } else if (data.amountType === "variable") {
    if (
      data.amount !== null &&
      data.amount !== undefined &&
      !isValidMoney(data.amount)
    ) {
      throw new Error(
        "El importe estimado debe ser mayor a cero y tener máximo dos decimales.",
      );
    }
  } else {
    throw new Error("El tipo de importe no es válido.");
  }

  if (data.defaultAccountId) {
    const account = storage.accounts.find(
      (item) => item.id === data.defaultAccountId,
    );
    if (!account || account.status !== "active") {
      throw new Error("La cuenta predeterminada no existe o no está activa.");
    }
  }

  const duplicatedName = storage.scheduledPayments.some(
    (item) =>
      item.id !== accountIdBeingUpdated &&
      item.status !== "cancelled" &&
      item.name.trim().toLocaleLowerCase() ===
        data.name.trim().toLocaleLowerCase(),
  );
  if (duplicatedName) {
    throw new Error("Ya existe un pago recurrente activo con ese nombre.");
  }
}

function getScheduledPaymentOrThrow(
  paymentId: string,
  payments: ScheduledPayment[],
): ScheduledPayment {
  const payment = payments.find((item) => item.id === paymentId);
  if (!payment) throw new Error("No se encontró el pago recurrente.");
  return payment;
}

function persistAccountStorage(
  storage: ReturnType<typeof loadAccountStorage>,
): void {
  if (!saveAccountStorage(storage)) {
    throw new Error("No fue posible guardar los cambios del pago recurrente.");
  }
}

function restoreTransactionStorage(
  original: TransactionStorage | null,
): boolean {
  if (original) return saveTransactionStorage(original);
  clearTransactionStorage();
  return true;
}

// -----------------------------------------------------------------------------
// CONSULTAS
// -----------------------------------------------------------------------------

export function getScheduledPayments(): ScheduledPayment[] {
  return loadAccountStorage().scheduledPayments;
}

export function getActiveScheduledPayments(): ScheduledPayment[] {
  return getScheduledPayments().filter((item) => item.status === "active");
}

export function getScheduledPaymentById(
  paymentId: string,
): ScheduledPayment | undefined {
  return getScheduledPayments().find((item) => item.id === paymentId);
}

export function getScheduledPaymentOccurrences(
  paymentId?: string,
): ScheduledPaymentOccurrence[] {
  const occurrences = loadAccountStorage().scheduledPaymentOccurrences;
  return paymentId
    ? occurrences
        .filter((item) => item.scheduledPaymentId === paymentId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    : occurrences.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// -----------------------------------------------------------------------------
// CREAR Y ACTUALIZAR
// -----------------------------------------------------------------------------

export function createScheduledPayment(
  data: CreateScheduledPaymentData,
): ScheduledPayment {
  validateScheduledPaymentData(data);
  const storage = loadAccountStorage();
  const timestamp = getTimestamp();

  const payment: ScheduledPayment = {
    id: generateId(),
    name: data.name.trim(),
    description: data.description?.trim() || null,
    category: data.category.trim(),
    frequency: data.frequency,
    amountType: data.amountType,
    amount: data.amount ?? null,
    firstDueDate: data.firstDueDate,
    nextDueDate: data.firstDueDate,
    endDate: data.endDate || null,
    defaultAccountId: data.defaultAccountId || null,
    status: "active",
    notes: data.notes?.trim() || null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  persistAccountStorage({
    ...storage,
    scheduledPayments: [...storage.scheduledPayments, payment],
  });
  return payment;
}

export function updateScheduledPayment(
  paymentId: string,
  changes: UpdateScheduledPaymentData,
): ScheduledPayment {
  const storage = loadAccountStorage();
  const current = getScheduledPaymentOrThrow(
    paymentId,
    storage.scheduledPayments,
  );

  if (current.status === "cancelled") {
    throw new Error("No puedes modificar un pago recurrente cancelado.");
  }

  const hasOccurrences = storage.scheduledPaymentOccurrences.some(
    (item) => item.scheduledPaymentId === paymentId,
  );

  if (
    hasOccurrences &&
    changes.firstDueDate &&
    changes.firstDueDate !== current.firstDueDate
  ) {
    throw new Error(
      "No puedes cambiar el primer vencimiento después de generar vencimientos. Crea un nuevo pago recurrente para iniciar otra programación.",
    );
  }

  const updatedData: CreateScheduledPaymentData = {
    name: changes.name ?? current.name,
    description:
      changes.description !== undefined
        ? changes.description
        : current.description,
    category: changes.category ?? current.category,
    frequency: changes.frequency ?? current.frequency,
    amountType: changes.amountType ?? current.amountType,
    amount: changes.amount !== undefined ? changes.amount : current.amount,
    firstDueDate: changes.firstDueDate ?? current.firstDueDate,
    endDate: changes.endDate !== undefined ? changes.endDate : current.endDate,
    defaultAccountId:
      changes.defaultAccountId !== undefined
        ? changes.defaultAccountId
        : current.defaultAccountId,
    notes: changes.notes !== undefined ? changes.notes : current.notes,
  };

  validateScheduledPaymentData(updatedData, paymentId);

  // Si cambia la frecuencia, se conserva el próximo vencimiento pendiente y
  // la nueva cadencia comienza desde esa fecha, sin alterar el historial.
  const frequencyChanged = updatedData.frequency !== current.frequency;
  const updated: ScheduledPayment = {
    ...current,
    ...updatedData,
    name: updatedData.name.trim(),
    description: updatedData.description?.trim() || null,
    category: updatedData.category.trim(),
    amount: updatedData.amount ?? null,
    endDate: updatedData.endDate || null,
    defaultAccountId: updatedData.defaultAccountId || null,
    notes: updatedData.notes?.trim() || null,
    firstDueDate:
      frequencyChanged && hasOccurrences
        ? current.nextDueDate
        : updatedData.firstDueDate,
    nextDueDate: current.nextDueDate,
    updatedAt: getTimestamp(),
  };

  persistAccountStorage({
    ...storage,
    scheduledPayments: storage.scheduledPayments.map((item) =>
      item.id === paymentId ? updated : item,
    ),
  });
  return updated;
}

// -----------------------------------------------------------------------------
// ESTADOS
// -----------------------------------------------------------------------------

export function pauseScheduledPayment(paymentId: string): ScheduledPayment {
  return changeScheduledPaymentStatus(paymentId, "paused");
}

export function resumeScheduledPayment(paymentId: string): ScheduledPayment {
  return changeScheduledPaymentStatus(paymentId, "active");
}

function changeScheduledPaymentStatus(
  paymentId: string,
  status: "active" | "paused",
): ScheduledPayment {
  const storage = loadAccountStorage();
  const payment = getScheduledPaymentOrThrow(
    paymentId,
    storage.scheduledPayments,
  );
  if (payment.status === "cancelled") {
    throw new Error("No puedes reactivar un pago recurrente cancelado.");
  }
  if (payment.status === status) {
    throw new Error(
      status === "paused"
        ? "El pago recurrente ya está pausado."
        : "El pago recurrente ya está activo.",
    );
  }

  const updated: ScheduledPayment = {
    ...payment,
    status,
    updatedAt: getTimestamp(),
  };
  persistAccountStorage({
    ...storage,
    scheduledPayments: storage.scheduledPayments.map((item) =>
      item.id === paymentId ? updated : item,
    ),
  });
  return updated;
}

export function cancelScheduledPayment(paymentId: string): ScheduledPayment {
  const storage = loadAccountStorage();
  const payment = getScheduledPaymentOrThrow(
    paymentId,
    storage.scheduledPayments,
  );
  if (payment.status === "cancelled") {
    throw new Error("El pago recurrente ya está cancelado.");
  }

  const timestamp = getTimestamp();
  const cancelled: ScheduledPayment = {
    ...payment,
    status: "cancelled",
    cancelledAt: timestamp,
    updatedAt: timestamp,
  };
  persistAccountStorage({
    ...storage,
    scheduledPayments: storage.scheduledPayments.map((item) =>
      item.id === paymentId ? cancelled : item,
    ),
  });
  return cancelled;
}

/**
 * Omite un vencimiento pendiente sin generar una transacción.
 * Conserva el registro para mantener el historial del pago recurrente.
 */
export function skipScheduledPaymentOccurrence(
  paymentId: string,
  occurrenceId: string,
): ScheduledPaymentOccurrence {
  const storage = loadAccountStorage();

  // Verificar que exista el pago recurrente.
  const payment = getScheduledPaymentOrThrow(
    paymentId,
    storage.scheduledPayments,
  );

  // Buscar el vencimiento asociado al pago.
  const occurrence = storage.scheduledPaymentOccurrences.find(
    (item) => item.id === occurrenceId && item.scheduledPaymentId === paymentId,
  );

  if (!occurrence) {
    throw new Error("No se encontró el vencimiento seleccionado.");
  }

  // Solo se pueden omitir vencimientos pendientes.
  if (occurrence.status !== "pending") {
    throw new Error("Este vencimiento ya fue atendido y no puede omitirse.");
  }

  const updatedOccurrence: ScheduledPaymentOccurrence = {
    ...occurrence,
    status: "skipped",
    paidAmount: null,
    paidAt: null,
    transactionId: null,
    updatedAt: getTimestamp(),
  };

  persistAccountStorage({
    ...storage,
    scheduledPaymentOccurrences: storage.scheduledPaymentOccurrences.map(
      (item) => (item.id === occurrenceId ? updatedOccurrence : item),
    ),
  });

  return updatedOccurrence;
}

// -----------------------------------------------------------------------------
// GENERACIÓN DE VENCIMIENTOS
// -----------------------------------------------------------------------------

/**
 * Genera vencimientos hasta `throughDate` (incluida). Es idempotente:
 * nunca duplica la combinación pago recurrente + fecha de vencimiento.
 * No registra transacciones ni modifica saldos.
 */
export function generateScheduledOccurrences(
  paymentId: string,
  throughDate = getLocalDateString(),
): GenerateScheduledOccurrencesResult {
  if (!isValidDate(throughDate)) {
    throw new Error("La fecha límite para generar vencimientos no es válida.");
  }

  const storage = loadAccountStorage();
  const payment = getScheduledPaymentOrThrow(
    paymentId,
    storage.scheduledPayments,
  );

  if (payment.status !== "active") {
    return {
      occurrences: storage.scheduledPaymentOccurrences.filter(
        (item) => item.scheduledPaymentId === paymentId,
      ),
      generatedCount: 0,
      nextDueDate: payment.nextDueDate,
    };
  }

  const existingDates = new Set(
    storage.scheduledPaymentOccurrences
      .filter((item) => item.scheduledPaymentId === paymentId)
      .map((item) => item.dueDate),
  );

  let index = getFrequencyIndex(
    payment.firstDueDate,
    payment.frequency,
    payment.nextDueDate,
  );

  // Compatibilidad con fechas nextDueDate ajustadas manualmente.
  let anchorDate = payment.firstDueDate;
  if (index < 0) {
    anchorDate = payment.nextDueDate;
    index = 0;
  }

  const timestamp = getTimestamp();
  const generated: ScheduledPaymentOccurrence[] = [];
  let nextDueDate = payment.nextDueDate;
  for (let count = 0; count < MAX_OCCURRENCES_PER_CALL; count += 1) {
    const dueDate = getOccurrenceDate(anchorDate, payment.frequency, index);

    if (dueDate > throughDate) break;
    if (payment.endDate && dueDate > payment.endDate) break;

    if (!existingDates.has(dueDate)) {
      generated.push({
        id: generateId(),
        scheduledPaymentId: payment.id,
        dueDate,
        amount: payment.amount,
        status: "pending",
        paidAmount: null,
        paidAt: null,
        transactionId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      existingDates.add(dueDate);
    }

    index += 1;
    nextDueDate = getOccurrenceDate(anchorDate, payment.frequency, index);
  }

  // Si se alcanzó el máximo de fechas procesadas, nextDueDate queda
  // apuntando a la siguiente fecha para continuar en la próxima ejecución.
  const updatedPayment: ScheduledPayment = {
    ...payment,
    firstDueDate: anchorDate,
    nextDueDate,
    updatedAt: timestamp,
  };

  persistAccountStorage({
    ...storage,
    scheduledPayments: storage.scheduledPayments.map((item) =>
      item.id === paymentId ? updatedPayment : item,
    ),
    scheduledPaymentOccurrences: [
      ...storage.scheduledPaymentOccurrences,
      ...generated,
    ],
  });

  return {
    occurrences: [...storage.scheduledPaymentOccurrences, ...generated]
      .filter((item) => item.scheduledPaymentId === paymentId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    generatedCount: generated.length,
    nextDueDate: updatedPayment.nextDueDate,
  };
}

// -----------------------------------------------------------------------------
// REGISTRAR UN PAGO REAL
// -----------------------------------------------------------------------------

export interface RegisterScheduledPaymentInput {
  paymentId: string;
  occurrenceId: string;
  amount: number;
  paidAt?: string;
  accountId?: string | null;
}

/**
 * Confirma el pago de una ocurrencia y crea el gasto correspondiente.
 * La transacción y la ocurrencia se guardan coordinadamente con rollback.
 */
export function registerScheduledPayment(
  input: RegisterScheduledPaymentInput,
): RegisterScheduledPaymentResult {
  if (!isValidMoney(input.amount)) {
    throw new Error(
      "El importe pagado debe ser mayor a cero y tener máximo dos decimales.",
    );
  }

  const paidAt = input.paidAt ?? getLocalDateString();
  if (!isValidDate(paidAt)) {
    throw new Error("La fecha del pago no es válida.");
  }

  const accountStorage = loadAccountStorage();
  const payment = getScheduledPaymentOrThrow(
    input.paymentId,
    accountStorage.scheduledPayments,
  );
  if (payment.status === "cancelled") {
    throw new Error("No puedes registrar pagos de una programación cancelada.");
  }

  const occurrence = accountStorage.scheduledPaymentOccurrences.find(
    (item) =>
      item.id === input.occurrenceId &&
      item.scheduledPaymentId === input.paymentId,
  );
  if (!occurrence)
    throw new Error("No se encontró el vencimiento seleccionado.");
  if (occurrence.status !== "pending") {
    throw new Error("Este vencimiento ya fue atendido y no admite otro pago.");
  }

  const accountId = input.accountId ?? payment.defaultAccountId;
  if (!accountId) {
    throw new Error("Selecciona la cuenta desde la que se realizó el pago.");
  }
  const account = accountStorage.accounts.find(
    (item) => item.id === accountId && item.status === "active",
  );
  if (!account)
    throw new Error("La cuenta seleccionada no existe o no está activa.");

  const previousTransactionStorage = loadTransactionStorage();
  const transactionStorage: TransactionStorage = previousTransactionStorage ?? {
    transactions: [],
    auditEvents: [],
  };

  const timestamp = getTimestamp();
  const transaction: Transaction = {
    id: generateId(),
    description: payment.description?.trim() || payment.name,
    category: payment.category,
    account: account.id,
    date: paidAt,
    registeredAt: timestamp,
    amount: input.amount,
    type: "expense",
    status: "active",
  };

  const updatedOccurrence: ScheduledPaymentOccurrence = {
    ...occurrence,
    amount: occurrence.amount,
    status: "paid",
    paidAmount: input.amount,
    paidAt,
    transactionId: transaction.id,
    updatedAt: timestamp,
  };

  const auditEvent = createTransactionAuditEvent(transaction);
  const transactionSaved = saveTransactionStorage({
    ...transactionStorage,
    transactions: [transaction, ...transactionStorage.transactions],
    auditEvents: [auditEvent, ...transactionStorage.auditEvents],
  });
  if (!transactionSaved) {
    throw new Error("No fue posible registrar el gasto del pago recurrente.");
  }

  const accountSaved = saveAccountStorage({
    ...accountStorage,
    scheduledPaymentOccurrences: accountStorage.scheduledPaymentOccurrences.map(
      (item) => (item.id === occurrence.id ? updatedOccurrence : item),
    ),
  });

  if (!accountSaved) {
    const rollbackSuccessful = restoreTransactionStorage(
      previousTransactionStorage,
    );
    if (!rollbackSuccessful) {
      throw new Error(
        "No se pudo guardar el vencimiento y tampoco revertir el gasto. Es necesario revisar ambos almacenamientos.",
      );
    }
    throw new Error(
      "No se pudo confirmar el pago. El gasto asociado fue revertido.",
    );
  }

  return { occurrence: updatedOccurrence, transaction };
}
