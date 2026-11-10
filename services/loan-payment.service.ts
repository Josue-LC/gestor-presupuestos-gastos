// loan-payment.service.ts
import type {
  Loan,
  LoanInstallment,
  LoanInstallmentStatus,
  LoanPayment,
  LoanPaymentAllocation,
} from "@/types/loan.types";

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

import {
  createTransactionAuditEvent,
  createTransactionCancellationAuditEvent,
} from "@/services/transaction-audit.service";

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

type AllocationConcept =
  | "interest"
  | "commission"
  | "insurance"
  | "principal";

export interface RegisterLoanPaymentInput {
  loanId: string;
  amount: number;
  paidAt?: string;
  sourceAccountId?: string | null;
  notes?: string | null;
  allocationPriority?: AllocationConcept[];
}

export interface LoanPaymentResult {
  payment: LoanPayment;
  transaction: Transaction;
  allocations: LoanPaymentAllocation[];
  updatedInstallments: LoanInstallment[];
  loan: Loan;
}

type TransactionStorage = NonNullable<
  ReturnType<typeof loadTransactionStorage>
>;

// -----------------------------------------------------------------------------
// CONSTANTES
// -----------------------------------------------------------------------------

const DEFAULT_ALLOCATION_PRIORITY: AllocationConcept[] = [
  "interest",
  "commission",
  "insurance",
  "principal",
];

// Tolerancia para operaciones monetarias.
const MONEY_EPSILON = 0.000001;

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function generateId(): string {
  return crypto.randomUUID();
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

function getDateOnly(value: string): string {
  return value.slice(0, 10);
}

function getEmptyTransactionStorage(): TransactionStorage {
  return {
    transactions: [],
    auditEvents: [],
  };
}

// -----------------------------------------------------------------------------
// PERSISTENCIA
// -----------------------------------------------------------------------------

function persistAccountStorage(
  storage: ReturnType<typeof loadAccountStorage>,
): void {
  if (!saveAccountStorage(storage)) {
    throw new Error(
      "No fue posible guardar los cambios del pago del préstamo.",
    );
  }
}

/**
 * Guarda el almacenamiento de movimientos y el de cuentas.
 *
 * Si falla el guardado de cuentas, intenta revertir el almacenamiento
 * de movimientos para evitar dejar una transferencia sin pago asociado.
 */
function persistPaymentWithTransaction(
  accountStorage: ReturnType<typeof loadAccountStorage>,
  previousTransactionStorage: TransactionStorage | null,
  updatedTransactionStorage: TransactionStorage,
): void {
  const transactionSaved = saveTransactionStorage(
    updatedTransactionStorage,
  );

  if (!transactionSaved) {
    throw new Error(
      "No fue posible guardar el movimiento asociado al pago.",
    );
  }

  const accountSaved = saveAccountStorage(accountStorage);

  if (accountSaved) {
    return;
  }

  let rollbackSuccessful = false;

  if (previousTransactionStorage) {
    rollbackSuccessful = saveTransactionStorage(
      previousTransactionStorage,
    );
  } else {
    clearTransactionStorage();
    rollbackSuccessful = true;
  }

  if (!rollbackSuccessful) {
    throw new Error(
      "No fue posible guardar el pago ni revertir el movimiento asociado. Es necesario revisar ambos almacenamientos.",
    );
  }

  throw new Error(
    "No fue posible guardar el pago del préstamo. Se revirtió el movimiento asociado.",
  );
}

// -----------------------------------------------------------------------------
// CONSULTAS INTERNAS
// -----------------------------------------------------------------------------

function getLoanOrThrow(
  loanId: string,
  loans: Loan[],
): Loan {
  const loan = loans.find((item) => item.id === loanId);

  if (!loan) {
    throw new Error("No se encontró el préstamo.");
  }

  return loan;
}

function getActiveAllocations(
  paymentAllocations: LoanPaymentAllocation[],
  payments: LoanPayment[],
  loanId: string,
): LoanPaymentAllocation[] {
  const completedPaymentIds = new Set(
    payments
      .filter(
        (payment) =>
          payment.loanId === loanId &&
          payment.status === "completed",
      )
      .map((payment) => payment.id),
  );

  return paymentAllocations.filter((allocation) =>
    completedPaymentIds.has(allocation.loanPaymentId),
  );
}

// -----------------------------------------------------------------------------
// CÁLCULO DE IMPORTES ASIGNADOS
// -----------------------------------------------------------------------------

function getAllocatedAmounts(
  installmentId: string,
  allocations: LoanPaymentAllocation[],
) {
  const installmentAllocations = allocations.filter(
    (allocation) => allocation.installmentId === installmentId,
  );

  return {
    principal: roundMoney(
      installmentAllocations.reduce(
        (total, item) => total + item.principalAmount,
        0,
      ),
    ),

    interest: roundMoney(
      installmentAllocations.reduce(
        (total, item) => total + item.interestAmount,
        0,
      ),
    ),

    commission: roundMoney(
      installmentAllocations.reduce(
        (total, item) => total + item.commissionAmount,
        0,
      ),
    ),

    insurance: roundMoney(
      installmentAllocations.reduce(
        (total, item) => total + item.insuranceAmount,
        0,
      ),
    ),

    total: roundMoney(
      installmentAllocations.reduce(
        (total, item) => total + item.totalAmount,
        0,
      ),
    ),
  };
}

function getInstallmentRemainingAmounts(
  installment: LoanInstallment,
  allocations: LoanPaymentAllocation[],
) {
  const allocated = getAllocatedAmounts(
    installment.id,
    allocations,
  );

  return {
    principal: roundMoney(
      Math.max(
        0,
        installment.principalAmount - allocated.principal,
      ),
    ),

    interest: roundMoney(
      Math.max(
        0,
        installment.interestAmount - allocated.interest,
      ),
    ),

    commission: roundMoney(
      Math.max(
        0,
        installment.commissionAmount - allocated.commission,
      ),
    ),

    insurance: roundMoney(
      Math.max(
        0,
        installment.insuranceAmount - allocated.insurance,
      ),
    ),

    total: roundMoney(
      Math.max(
        0,
        installment.totalAmount - allocated.total,
      ),
    ),
  };
}

function calculateLoanOutstanding(
  installments: LoanInstallment[],
  allocations: LoanPaymentAllocation[],
): number {
  return roundMoney(
    installments.reduce((total, installment) => {
      const remaining = getInstallmentRemainingAmounts(
        installment,
        allocations,
      );

      return total + remaining.total;
    }, 0),
  );
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE PRIORIDADES
// -----------------------------------------------------------------------------

function validateAllocationPriority(
  priority: AllocationConcept[],
): void {
  const validConcepts: AllocationConcept[] = [
    "principal",
    "interest",
    "commission",
    "insurance",
  ];

  if (
    priority.length !== validConcepts.length ||
    new Set(priority).size !== validConcepts.length ||
    !priority.every((concept) =>
      validConcepts.includes(concept),
    )
  ) {
    throw new Error(
      "La prioridad de distribución debe incluir una sola vez cada concepto.",
    );
  }
}

// -----------------------------------------------------------------------------
// CREACIÓN DE ASIGNACIONES
// -----------------------------------------------------------------------------

function createAllocation(
  paymentId: string,
  installmentId: string,
  amounts: {
    principal: number;
    interest: number;
    commission: number;
    insurance: number;
  },
  createdAt: string,
): LoanPaymentAllocation {
  const principalAmount = roundMoney(amounts.principal);
  const interestAmount = roundMoney(amounts.interest);
  const commissionAmount = roundMoney(amounts.commission);
  const insuranceAmount = roundMoney(amounts.insurance);

  const totalAmount = roundMoney(
    principalAmount +
      interestAmount +
      commissionAmount +
      insuranceAmount,
  );

  return {
    id: generateId(),
    loanPaymentId: paymentId,
    installmentId,
    principalAmount,
    interestAmount,
    commissionAmount,
    insuranceAmount,
    totalAmount,
    createdAt,
  };
}

// -----------------------------------------------------------------------------
// DISTRIBUCIÓN DEL PAGO
// -----------------------------------------------------------------------------

function distributePayment(
  paymentId: string,
  amount: number,
  installments: LoanInstallment[],
  existingAllocations: LoanPaymentAllocation[],
  allocationPriority: AllocationConcept[],
  createdAt: string,
): LoanPaymentAllocation[] {
  let remainingPayment = roundMoney(amount);

  const newAllocations: LoanPaymentAllocation[] = [];

  // Primero se atienden las parcialidades más antiguas.
  const orderedInstallments = [...installments].sort(
    (a, b) => a.installmentNumber - b.installmentNumber,
  );

  for (const installment of orderedInstallments) {
    if (remainingPayment <= MONEY_EPSILON) {
      break;
    }

    const remainingConcepts = getInstallmentRemainingAmounts(
      installment,
      [...existingAllocations, ...newAllocations],
    );

    if (remainingConcepts.total <= MONEY_EPSILON) {
      continue;
    }

    const amounts = {
      principal: 0,
      interest: 0,
      commission: 0,
      insurance: 0,
    };

    // Se distribuye según la prioridad configurada.
    for (const concept of allocationPriority) {
      if (remainingPayment <= MONEY_EPSILON) {
        break;
      }

      const available = remainingConcepts[concept];

      if (available <= MONEY_EPSILON) {
        continue;
      }

      const applied = roundMoney(
        Math.min(remainingPayment, available),
      );

      amounts[concept] = applied;

      remainingPayment = roundMoney(
        remainingPayment - applied,
      );
    }

    const allocationTotal = roundMoney(
      amounts.principal +
        amounts.interest +
        amounts.commission +
        amounts.insurance,
    );

    if (allocationTotal > MONEY_EPSILON) {
      newAllocations.push(
        createAllocation(
          paymentId,
          installment.id,
          amounts,
          createdAt,
        ),
      );
    }
  }

  // No se permiten importes sobrantes ni anticipos a capital
  // hasta que exista un modelo específico para ellos.
  if (remainingPayment > MONEY_EPSILON) {
    throw new Error(
      "El importe del pago supera el saldo pendiente del calendario de amortización.",
    );
  }

  return newAllocations;
}

// -----------------------------------------------------------------------------
// RECÁLCULO DE ESTADOS
// -----------------------------------------------------------------------------

function recalculateInstallmentStatuses(
  loanId: string,
  installments: LoanInstallment[],
  allocations: LoanPaymentAllocation[],
  referenceDate = new Date(),
): LoanInstallment[] {
  const today = getDateOnly(referenceDate.toISOString());

  return installments.map((installment) => {
    if (installment.loanId !== loanId) {
      return installment;
    }

    const allocated = getAllocatedAmounts(
      installment.id,
      allocations,
    );

    let status: LoanInstallmentStatus;

    if (
      allocated.total >=
      installment.totalAmount - MONEY_EPSILON
    ) {
      status = "paid";
    } else if (getDateOnly(installment.dueDate) < today) {
      status = "overdue";
    } else if (allocated.total > MONEY_EPSILON) {
      status = "partial";
    } else {
      status = "pending";
    }

    return {
      ...installment,
      status,
    };
  });
}

function updateLoanStatus(
  loan: Loan,
  installments: LoanInstallment[],
  timestamp: string,
): Loan {
  const loanInstallments = installments.filter(
    (installment) => installment.loanId === loan.id,
  );

  const allPaid =
    loanInstallments.length > 0 &&
    loanInstallments.every(
      (installment) => installment.status === "paid",
    );

  if (allPaid) {
    return {
      ...loan,
      status: "paid",
      paidAt: loan.paidAt ?? timestamp,
      updatedAt: timestamp,
    };
  }

  if (loan.status === "paid") {
    const updatedLoan: Loan = {
      ...loan,
      status: "active",
      updatedAt: timestamp,
    };

    delete updatedLoan.paidAt;

    return updatedLoan;
  }

  return {
    ...loan,
    updatedAt: timestamp,
  };
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DEL PAGO
// -----------------------------------------------------------------------------

function validatePaymentInput(
  input: RegisterLoanPaymentInput,
  storage: ReturnType<typeof loadAccountStorage>,
  sourceAccountId: string,
): void {
  if (!input.loanId) {
    throw new Error("Debes indicar el préstamo.");
  }

  if (!isValidAmount(input.amount)) {
    throw new Error(
      "El importe del pago debe ser mayor a cero.",
    );
  }

  const sourceAccount = storage.accounts.find(
    (account) => account.id === sourceAccountId,
  );

  if (!sourceAccount) {
    throw new Error("La cuenta de origen no existe.");
  }

  if (sourceAccount.status !== "active") {
    throw new Error(
      "No puedes registrar un pago desde una cuenta archivada.",
    );
  }

  if (input.paidAt && Number.isNaN(Date.parse(input.paidAt))) {
    throw new Error("La fecha del pago no es válida.");
  }
}

// -----------------------------------------------------------------------------
// CREACIÓN DEL MOVIMIENTO
// -----------------------------------------------------------------------------

function createLoanPaymentTransaction(
  loan: Loan,
  payment: LoanPayment,
  sourceAccountId: string,
  timestamp: string,
): Transaction {
  return {
    id: `transaction-${generateId()}`,
    description: `Pago de préstamo: ${loan.name}`,
    category: "Pago de préstamo",

    // El destino no es una cuenta bancaria.
    // Se utiliza un identificador propio del préstamo.
    account: `${sourceAccountId} → loan:${loan.id}`,

    date: getDateOnly(payment.paidAt),
    registeredAt: timestamp,
    amount: payment.amount,
    type: "transfer",
    status: "active",
  };
}

// -----------------------------------------------------------------------------
// REGISTRAR PAGO
// -----------------------------------------------------------------------------

/**
 * Registra un pago de préstamo.
 *
 * El servicio:
 * 1. Valida el préstamo y la cuenta de origen.
 * 2. Distribuye el pago entre las parcialidades pendientes.
 * 3. Actualiza los estados de las parcialidades.
 * 4. Actualiza el estado del préstamo.
 * 5. Crea una transferencia vinculada al préstamo.
 * 6. Registra el evento de auditoría.
 */
export function registerLoanPayment(
  input: RegisterLoanPaymentInput,
): LoanPaymentResult {
  const storage = loadAccountStorage();

  const loan = getLoanOrThrow(
    input.loanId,
    storage.loans,
  );

  if (loan.status !== "active") {
    throw new Error(
      "Solo puedes registrar pagos en préstamos activos.",
    );
  }

  // Si no se indica una cuenta, utilizamos la cuenta
  // configurada como predeterminada en el préstamo.
  const sourceAccountId =
    input.sourceAccountId ?? loan.paymentAccountId;

  if (!sourceAccountId) {
    throw new Error(
      "Debes seleccionar una cuenta bancaria para registrar el pago.",
    );
  }

  validatePaymentInput(
    input,
    storage,
    sourceAccountId,
  );

  const loanInstallments = storage.loanInstallments.filter(
    (installment) => installment.loanId === loan.id,
  );

  if (loanInstallments.length === 0) {
    throw new Error(
      "El préstamo no tiene parcialidades registradas.",
    );
  }

  const priority =
    input.allocationPriority ?? DEFAULT_ALLOCATION_PRIORITY;

  validateAllocationPriority(priority);

  const activeAllocations = getActiveAllocations(
    storage.loanPaymentAllocations,
    storage.loanPayments,
    loan.id,
  );

  const outstanding = calculateLoanOutstanding(
    loanInstallments,
    activeAllocations,
  );

  const paymentAmount = roundMoney(input.amount);

  if (paymentAmount > outstanding + MONEY_EPSILON) {
    throw new Error(
      `El importe supera el saldo pendiente del préstamo ($${outstanding.toFixed(2)}).`,
    );
  }

  const timestamp = getCurrentTimestamp();
  const paymentId = generateId();

  const paidAt = input.paidAt
    ? new Date(input.paidAt).toISOString()
    : timestamp;

  // ---------------------------------------------------------------------------
  // REGISTRO DEL PAGO
  // ---------------------------------------------------------------------------

  const payment: LoanPayment = {
    id: paymentId,
    loanId: loan.id,
    sourceAccountId,
    amount: paymentAmount,
    paidAt,
    status: "completed",
    method: "transaction",
    transactionId: null,
    notes: input.notes?.trim() || null,
    createdAt: timestamp,
  };

  // ---------------------------------------------------------------------------
  // DISTRIBUCIÓN DEL PAGO
  // ---------------------------------------------------------------------------

  const allocations = distributePayment(
    payment.id,
    payment.amount,
    loanInstallments,
    activeAllocations,
    priority,
    timestamp,
  );

  const updatedAllocations = [
    ...storage.loanPaymentAllocations,
    ...allocations,
  ];

  const updatedInstallments = recalculateInstallmentStatuses(
    loan.id,
    storage.loanInstallments,
    updatedAllocations,
  );

  const updatedLoan = updateLoanStatus(
    loan,
    updatedInstallments,
    timestamp,
  );

  // ---------------------------------------------------------------------------
  // CREACIÓN DE TRANSFERENCIA
  // ---------------------------------------------------------------------------

  const previousTransactionStorage =
    loadTransactionStorage();

  const transactionStorage =
    previousTransactionStorage ??
    getEmptyTransactionStorage();

  const transaction = createLoanPaymentTransaction(
    loan,
    payment,
    sourceAccountId,
    timestamp,
  );

  // Vinculamos el pago con el movimiento generado.
  const linkedPayment: LoanPayment = {
    ...payment,
    transactionId: transaction.id,
  };

  const auditEvent =
    createTransactionAuditEvent(transaction);

  // ---------------------------------------------------------------------------
  // ACTUALIZACIÓN DE ALMACENAMIENTO DE CUENTAS
  // ---------------------------------------------------------------------------

  const updatedAccountStorage = {
    ...storage,

    loans: storage.loans.map((item) =>
      item.id === loan.id ? updatedLoan : item,
    ),

    loanPayments: [
      ...storage.loanPayments,
      linkedPayment,
    ],

    loanPaymentAllocations: updatedAllocations,

    loanInstallments: updatedInstallments,
  };

  // ---------------------------------------------------------------------------
  // ACTUALIZACIÓN DE ALMACENAMIENTO DE MOVIMIENTOS
  // ---------------------------------------------------------------------------

  const updatedTransactionStorage: TransactionStorage = {
    ...transactionStorage,

    transactions: [
      transaction,
      ...transactionStorage.transactions,
    ],

    auditEvents: [
      auditEvent,
      ...transactionStorage.auditEvents,
    ],
  };

  // Ambos almacenamientos se guardan de forma coordinada.
  persistPaymentWithTransaction(
    updatedAccountStorage,
    previousTransactionStorage,
    updatedTransactionStorage,
  );

  return {
    payment: linkedPayment,
    transaction,
    allocations,

    updatedInstallments: updatedInstallments.filter(
      (item) => item.loanId === loan.id,
    ),

    loan: updatedLoan,
  };
}

// -----------------------------------------------------------------------------
// CANCELAR PAGO
// -----------------------------------------------------------------------------

/**
 * Cancela un pago y su transferencia asociada.
 *
 * El pago permanece en el historial con estado cancelled.
 * Sus asignaciones dejan de afectar el saldo pendiente.
 */
export function cancelLoanPayment(
  paymentId: string,
): LoanPayment {
  const storage = loadAccountStorage();

  const payment = storage.loanPayments.find(
    (item) => item.id === paymentId,
  );

  if (!payment) {
    throw new Error("No se encontró el pago.");
  }

  if (payment.status === "cancelled") {
    throw new Error("Este pago ya está cancelado.");
  }

  const loan = getLoanOrThrow(
    payment.loanId,
    storage.loans,
  );

  const timestamp = getCurrentTimestamp();

  const cancelledPayment: LoanPayment = {
    ...payment,
    status: "cancelled",
  };

  const updatedPayments = storage.loanPayments.map((item) =>
    item.id === payment.id ? cancelledPayment : item,
  );

  // Las asignaciones del pago cancelado se retiran.
  const updatedAllocations =
    storage.loanPaymentAllocations.filter(
      (allocation) =>
        allocation.loanPaymentId !== payment.id,
    );

  const updatedInstallments = recalculateInstallmentStatuses(
    loan.id,
    storage.loanInstallments,
    updatedAllocations,
  );

  const updatedLoan = updateLoanStatus(
    loan,
    updatedInstallments,
    timestamp,
  );

  const updatedAccountStorage = {
    ...storage,

    loans: storage.loans.map((item) =>
      item.id === loan.id ? updatedLoan : item,
    ),

    loanPayments: updatedPayments,
    loanPaymentAllocations: updatedAllocations,
    loanInstallments: updatedInstallments,
  };

  // ---------------------------------------------------------------------------
  // CANCELACIÓN DE LA TRANSFERENCIA
  // ---------------------------------------------------------------------------

  if (payment.transactionId) {
    const previousTransactionStorage =
      loadTransactionStorage();

    if (!previousTransactionStorage) {
      throw new Error(
        "No fue posible recuperar el almacenamiento de movimientos. No se canceló el pago.",
      );
    }

    const transaction =
      previousTransactionStorage.transactions.find(
        (item) => item.id === payment.transactionId,
      );

    if (!transaction) {
      throw new Error(
        "No se encontró la transferencia asociada al pago. No se cancelaron los registros.",
      );
    }

    if (transaction.status === "cancelled") {
      throw new Error(
        "La transferencia ya está cancelada. Es necesario revisar la relación entre el pago y el movimiento.",
      );
    }

    const reason = "Cancelación del pago del préstamo.";

    const cancelledTransaction: Transaction = {
      ...transaction,
      status: "cancelled",
      cancellationReason: reason,
    };

    const auditEvent =
      createTransactionCancellationAuditEvent(
        transaction,
        reason,
      );

    const updatedTransactionStorage: TransactionStorage = {
      ...previousTransactionStorage,

      transactions: previousTransactionStorage.transactions.map(
        (item) =>
          item.id === transaction.id
            ? cancelledTransaction
            : item,
      ),

      auditEvents: [
        auditEvent,
        ...previousTransactionStorage.auditEvents,
      ],
    };

    persistPaymentWithTransaction(
      updatedAccountStorage,
      previousTransactionStorage,
      updatedTransactionStorage,
    );
  } else {
    // Compatibilidad con pagos históricos manuales
    // que todavía no tienen una transferencia asociada.
    persistAccountStorage(updatedAccountStorage);
  }

  return cancelledPayment;
}

// -----------------------------------------------------------------------------
// CONSULTAS
// -----------------------------------------------------------------------------

/**
 * Obtiene los pagos de un préstamo.
 */
export function getLoanPayments(
  loanId: string,
): LoanPayment[] {
  const storage = loadAccountStorage();

  return storage.loanPayments
    .filter((payment) => payment.loanId === loanId)
    .sort(
      (a, b) =>
        new Date(b.paidAt).getTime() -
        new Date(a.paidAt).getTime(),
    );
}

/**
 * Obtiene un pago por su identificador.
 */
export function getLoanPaymentById(
  paymentId: string,
): LoanPayment | null {
  const storage = loadAccountStorage();

  return (
    storage.loanPayments.find(
      (payment) => payment.id === paymentId,
    ) ?? null
  );
}

/**
 * Obtiene las asignaciones de un pago.
 */
export function getLoanPaymentAllocations(
  paymentId: string,
): LoanPaymentAllocation[] {
  const storage = loadAccountStorage();

  return storage.loanPaymentAllocations.filter(
    (allocation) => allocation.loanPaymentId === paymentId,
  );
}

/**
 * Obtiene el saldo pendiente de un préstamo.
 */
export function getLoanOutstandingBalance(
  loanId: string,
): number {
  const storage = loadAccountStorage();

  const installments = storage.loanInstallments.filter(
    (installment) => installment.loanId === loanId,
  );

  const allocations = getActiveAllocations(
    storage.loanPaymentAllocations,
    storage.loanPayments,
    loanId,
  );

  return calculateLoanOutstanding(
    installments,
    allocations,
  );
}

/**
 * Obtiene las parcialidades de un préstamo con sus estados actuales.
 */
export function getLoanInstallmentsWithCurrentStatus(
  loanId: string,
): LoanInstallment[] {
  const storage = loadAccountStorage();

  const allocations = getActiveAllocations(
    storage.loanPaymentAllocations,
    storage.loanPayments,
    loanId,
  );

  const installments = storage.loanInstallments.filter(
    (installment) => installment.loanId === loanId,
  );

  return recalculateInstallmentStatuses(
    loanId,
    installments,
    allocations,
  ).sort(
    (a, b) => a.installmentNumber - b.installmentNumber,
  );
}
