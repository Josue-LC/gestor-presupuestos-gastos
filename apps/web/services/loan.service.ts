
// loan.service.ts

import type {
  Loan,
  LoanInstallment,
  LoanStatus,
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

import {
  generateLoanAmortizationSchedule,
  getLoanInstallments as filterLoanInstallments,
  type LoanAmortizationOptions,
} from "@/services/loan-amortization.service";

// ============================================
// TIPOS
// ============================================

type LoanAmortizationConfig = Omit<
  LoanAmortizationOptions,
  "loan" | "createdAt" | "createId"
>;

type TransactionStorage = NonNullable<
  ReturnType<typeof loadTransactionStorage>
>;

export type CreateLoanInput = Omit<
  Loan,
  | "id"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "paidAt"
  | "cancelledAt"
  | "disbursementTransactionId"
> & {
  amortizationOptions?: LoanAmortizationConfig;
};

export type UpdateLoanInput = Partial<
  Omit<
    Loan,
    | "id"
    | "status"
    | "createdAt"
    | "updatedAt"
    | "paidAt"
    | "cancelledAt"
    | "disbursementTransactionId"
  >
> & {
  amortizationOptions?: LoanAmortizationConfig;
  regenerateSchedule?: boolean;
};

// ============================================
// UTILIDADES
// ============================================

function generateId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `loan-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 11)}`;
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

function persistStorage(
  storage: ReturnType<typeof loadAccountStorage>,
): void {
  const saved = saveAccountStorage(storage);

  if (!saved) {
    throw new Error(
      "No fue posible guardar los cambios del préstamo. " +
        "El almacenamiento rechazó la operación.",
    );
  }
}

function getEmptyTransactionStorage(): TransactionStorage {
  return {
    transactions: [],
    auditEvents: [],
  };
}

function getLoanOrThrow(
  loans: Loan[],
  loanId: string,
): Loan {
  const loan = loans.find((item) => item.id === loanId);

  if (!loan) {
    throw new Error("No se encontró el préstamo solicitado.");
  }

  return loan;
}

// ============================================
// PERSISTENCIA COORDINADA
// ============================================

/**
 * Guarda el almacenamiento de movimientos y el de préstamos.
 *
 * Si falla el guardado de préstamos, intenta revertir
 * el almacenamiento de movimientos.
 */
function persistLoanWithTransaction(
  accountStorage: ReturnType<typeof loadAccountStorage>,
  previousTransactionStorage: TransactionStorage | null,
  updatedTransactionStorage: TransactionStorage,
): void {
  const transactionSaved = saveTransactionStorage(
    updatedTransactionStorage,
  );

  if (!transactionSaved) {
    throw new Error(
      "No fue posible guardar el movimiento asociado al préstamo.",
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
      "No fue posible guardar el préstamo ni revertir el movimiento asociado. " +
        "Es necesario revisar ambos almacenamientos.",
    );
  }

  throw new Error(
    "No fue posible guardar el préstamo. " +
      "Se revirtió el movimiento de disposición asociado.",
  );
}

// ============================================
// VALIDACIONES
// ============================================

function validateInstitutionAndAccounts(
  loan: Pick<
    Loan,
    "institutionId" | "receivingAccountId" | "paymentAccountId"
  >,
  storage: ReturnType<typeof loadAccountStorage>,
): void {
  const institutionExists = storage.banks.some(
    (bank) => bank.id === loan.institutionId,
  );

  if (!institutionExists) {
    throw new Error(
      "La institución financiera seleccionada no existe.",
    );
  }

  if (
    loan.receivingAccountId !== null &&
    !storage.accounts.some(
      (account) => account.id === loan.receivingAccountId,
    )
  ) {
    throw new Error(
      "La cuenta receptora seleccionada no existe.",
    );
  }

  if (
    loan.paymentAccountId !== null &&
    !storage.accounts.some(
      (account) => account.id === loan.paymentAccountId,
    )
  ) {
    throw new Error(
      "La cuenta de pago seleccionada no existe.",
    );
  }
}

// ============================================
// CALENDARIO DE AMORTIZACIÓN
// ============================================

function createSchedule(
  loan: Loan,
  options?: LoanAmortizationConfig,
  createdAt = getCurrentTimestamp(),
): LoanInstallment[] {
  return generateLoanAmortizationSchedule({
    loan,
    ...options,
    createdAt,
    createId: generateId,
  });
}

function hasScheduleChanges(
  current: Loan,
  updated: Loan,
): boolean {
  return (
    current.principalAmount !== updated.principalAmount ||
    current.annualInterestRate !== updated.annualInterestRate ||
    current.interestType !== updated.interestType ||
    current.termInMonths !== updated.termInMonths ||
    current.paymentFrequency !== updated.paymentFrequency ||
    current.amortizationType !== updated.amortizationType ||
    current.firstPaymentDate !== updated.firstPaymentDate
  );
}

// ============================================
// DISPOSICIÓN DEL PRÉSTAMO
// ============================================

/**
 * Crea la transferencia del dinero recibido.
 *
 * El préstamo funciona como origen y la cuenta bancaria
 * seleccionada como destino.
 */
function createLoanDisbursementTransaction(
  loan: Loan,
  timestamp: string,
): Transaction {
  if (
    !loan.receivingAccountId ||
    loan.netDisbursedAmount <= 0
  ) {
    throw new Error(
      "No se puede generar la disposición sin una cuenta receptora " +
        "y un importe mayor a cero.",
    );
  }

  return {
    id: `transaction-${generateId()}`,
    description: `Disposición del préstamo: ${loan.name}`,
    category: "Disposición de préstamo",
    account: `loan:${loan.id} → ${loan.receivingAccountId}`,
    date: loan.disbursementDate,
    registeredAt: timestamp,
    amount: loan.netDisbursedAmount,
    type: "transfer",
    status: "active",
  };
}

/**
 * Comprueba si el préstamo debe generar una disposición.
 */
function shouldRegisterDisbursement(loan: Loan): boolean {
  return (
    loan.receivingAccountId !== null &&
    loan.netDisbursedAmount > 0
  );
}

// ============================================
// CREAR PRÉSTAMO
// ============================================

export function createLoan(input: CreateLoanInput): Loan {
  const storage = loadAccountStorage();

  const now = getCurrentTimestamp();

  const loan: Loan = {
    id: generateId(),

    name: input.name,
    institutionId: input.institutionId,
    type: input.type,

    status: "active",

    contractNumber: input.contractNumber,

    contractedAmount: input.contractedAmount,
    principalAmount: input.principalAmount,
    netDisbursedAmount: input.netDisbursedAmount,

    openingCommission: input.openingCommission,
    openingInsurance: input.openingInsurance,
    financedCharges: input.financedCharges,

    annualInterestRate: input.annualInterestRate,
    interestType: input.interestType,

    termInMonths: input.termInMonths,
    paymentFrequency: input.paymentFrequency,
    amortizationType: input.amortizationType,

    contractDate: input.contractDate,
    disbursementDate: input.disbursementDate,
    firstPaymentDate: input.firstPaymentDate,
    endDate: input.endDate,

    receivingAccountId: input.receivingAccountId,
    paymentAccountId: input.paymentAccountId,

    notes: input.notes,

    disbursementTransactionId: null,

    createdAt: now,
    updatedAt: now,
  };

  if (storage.loans.some((item) => item.id === loan.id)) {
    throw new Error("Ya existe un préstamo con ese identificador.");
  }

  validateInstitutionAndAccounts(loan, storage);

  // Generamos el calendario antes de modificar el almacenamiento.
  const installments = createSchedule(
    loan,
    input.amortizationOptions,
    now,
  );

  // Si no hay cuenta receptora o importe recibido,
  // guardamos solamente el préstamo y sus parcialidades.
  if (!shouldRegisterDisbursement(loan)) {
    const nextStorage = {
      ...storage,

      loans: [
        ...storage.loans,
        loan,
      ],

      loanInstallments: [
        ...storage.loanInstallments,
        ...installments,
      ],
    };

    persistStorage(nextStorage);

    return loan;
  }

  // Recuperamos el almacenamiento de movimientos.
  const previousTransactionStorage = loadTransactionStorage();

  const transactionStorage =
    previousTransactionStorage ??
    getEmptyTransactionStorage();

  // Creamos la transferencia de disposición.
  const transaction = createLoanDisbursementTransaction(
    loan,
    now,
  );

  // Vinculamos la transferencia al préstamo.
  const loanWithDisbursement: Loan = {
    ...loan,
    disbursementTransactionId: transaction.id,
  };

  const auditEvent = createTransactionAuditEvent(transaction);

  const updatedAccountStorage = {
    ...storage,

    loans: [
      ...storage.loans,
      loanWithDisbursement,
    ],

    loanInstallments: [
      ...storage.loanInstallments,
      ...installments,
    ],
  };

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

  persistLoanWithTransaction(
    updatedAccountStorage,
    previousTransactionStorage,
    updatedTransactionStorage,
  );

  return loanWithDisbursement;
}

// ============================================
// CONSULTAR PRÉSTAMOS
// ============================================

export function getLoans(status?: LoanStatus): Loan[] {
  const storage = loadAccountStorage();

  const loans = status
    ? storage.loans.filter((loan) => loan.status === status)
    : storage.loans;

  return [...loans].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime(),
  );
}

export function getLoanById(
  loanId: string,
): Loan | undefined {
  const storage = loadAccountStorage();

  return storage.loans.find(
    (loan) => loan.id === loanId,
  );
}

// ============================================
// CONSULTAR PARCIALIDADES
// ============================================

export function getLoanSchedule(
  loanId: string,
): LoanInstallment[] {
  const storage = loadAccountStorage();

  const loanExists = storage.loans.some(
    (loan) => loan.id === loanId,
  );

  if (!loanExists) {
    throw new Error("No se encontró el préstamo solicitado.");
  }

  return filterLoanInstallments(
    storage.loanInstallments,
    loanId,
  );
}

export function getLoanInstallmentById(
  installmentId: string,
): LoanInstallment | undefined {
  const storage = loadAccountStorage();

  return storage.loanInstallments.find(
    (installment) => installment.id === installmentId,
  );
}

// ============================================
// ACTUALIZAR PRÉSTAMO
// ============================================

export function updateLoan(
  loanId: string,
  updates: UpdateLoanInput,
): Loan {
  const storage = loadAccountStorage();

  const currentLoan = getLoanOrThrow(
    storage.loans,
    loanId,
  );

  if (currentLoan.status !== "active") {
    throw new Error(
      "Solamente se pueden modificar préstamos activos.",
    );
  }

  const {
    amortizationOptions,
    regenerateSchedule,
    ...loanChanges
  } = updates;

  // No permitimos alterar los datos de una disposición
  // que ya fue registrada.
  if (
    currentLoan.disbursementTransactionId &&
    (
      (
        updates.netDisbursedAmount !== undefined &&
        updates.netDisbursedAmount !== currentLoan.netDisbursedAmount
      ) ||
      (
        updates.disbursementDate !== undefined &&
        updates.disbursementDate !== currentLoan.disbursementDate
      ) ||
      (
        updates.receivingAccountId !== undefined &&
        updates.receivingAccountId !== currentLoan.receivingAccountId
      )
    )
  ) {
    throw new Error(
      "No puedes modificar el importe, la fecha o la cuenta " +
        "de una disposición que ya fue registrada. " +
        "Es necesario conservar el movimiento financiero original.",
    );
  }

  const updatedLoan: Loan = {
    ...currentLoan,
    ...loanChanges,
    updatedAt: getCurrentTimestamp(),
  };

  validateInstitutionAndAccounts(updatedLoan, storage);

  const scheduleChanged = hasScheduleChanges(
    currentLoan,
    updatedLoan,
  );

  const shouldRegenerate =
    scheduleChanged || regenerateSchedule === true;

  if (shouldRegenerate && regenerateSchedule === false) {
    throw new Error(
      "No se puede impedir la regeneración cuando cambian " +
        "las condiciones de amortización.",
    );
  }

  if (!shouldRegenerate && amortizationOptions) {
    throw new Error(
      "Para aplicar nuevas opciones de amortización debes " +
        "solicitar la regeneración del calendario.",
    );
  }

  let updatedInstallments = storage.loanInstallments;

  if (shouldRegenerate) {
    const hasPayments = storage.loanPayments.some(
      (payment) => payment.loanId === loanId,
    );

    if (hasPayments) {
      throw new Error(
        "No se puede regenerar el calendario porque el préstamo " +
          "ya tiene registros de pago. " +
          "Se debe conservar su historial financiero.",
      );
    }

    const newInstallments = createSchedule(
      updatedLoan,
      amortizationOptions,
      getCurrentTimestamp(),
    );

    updatedInstallments = [
      ...storage.loanInstallments.filter(
        (installment) => installment.loanId !== loanId,
      ),
      ...newInstallments,
    ];
  }

  // Si todavía no existía una disposición y ahora el préstamo
  // tiene cuenta receptora e importe, generamos el movimiento.
  const needsDisbursement =
    !currentLoan.disbursementTransactionId &&
    shouldRegisterDisbursement(updatedLoan);

  const previousTransactionStorage = needsDisbursement
    ? loadTransactionStorage()
    : null;

  let finalLoan = updatedLoan;

  let updatedTransactionStorage: TransactionStorage | null = null;

  if (needsDisbursement) {
    const transactionStorage =
      previousTransactionStorage ??
      getEmptyTransactionStorage();

    const transaction = createLoanDisbursementTransaction(
      updatedLoan,
      updatedLoan.updatedAt,
    );

    finalLoan = {
      ...updatedLoan,
      disbursementTransactionId: transaction.id,
    };

    const auditEvent = createTransactionAuditEvent(transaction);

    updatedTransactionStorage = {
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
  }

  const nextAccountStorage = {
    ...storage,

    loans: storage.loans.map((loan) =>
      loan.id === loanId ? finalLoan : loan,
    ),

    loanInstallments: updatedInstallments,
  };

  if (updatedTransactionStorage) {
    persistLoanWithTransaction(
      nextAccountStorage,
      previousTransactionStorage,
      updatedTransactionStorage,
    );
  } else {
    persistStorage(nextAccountStorage);
  }

  return finalLoan;
}

// ============================================
// CANCELAR PRÉSTAMO
// ============================================

export function cancelLoan(loanId: string): Loan {
  const storage = loadAccountStorage();

  const currentLoan = getLoanOrThrow(
    storage.loans,
    loanId,
  );

  if (currentLoan.status !== "active") {
    throw new Error(
      "Solamente se pueden cancelar préstamos activos.",
    );
  }

  // No permitimos cancelar préstamos que ya tengan pagos completados.
  const hasCompletedPayments = storage.loanPayments.some(
    (payment) =>
      payment.loanId === loanId &&
      payment.status === "completed",
  );

  if (hasCompletedPayments) {
    throw new Error(
      "No puedes cancelar un préstamo que ya tiene pagos registrados. " +
        "Primero debes resolver su historial de pagos.",
    );
  }

  const now = getCurrentTimestamp();

  const cancelledLoan: Loan = {
    ...currentLoan,
    status: "cancelled",
    cancelledAt: now,
    updatedAt: now,
  };

  const nextAccountStorage = {
    ...storage,

    loans: storage.loans.map((loan) =>
      loan.id === loanId ? cancelledLoan : loan,
    ),
  };

  // Si no hubo disposición, solamente cancelamos el préstamo.
  if (!currentLoan.disbursementTransactionId) {
    persistStorage(nextAccountStorage);
    return cancelledLoan;
  }

  const previousTransactionStorage = loadTransactionStorage();

  if (!previousTransactionStorage) {
    throw new Error(
      "No fue posible recuperar el almacenamiento de movimientos. " +
        "No se canceló el préstamo.",
    );
  }

  const disbursementTransaction =
    previousTransactionStorage.transactions.find(
      (transaction) =>
        transaction.id === currentLoan.disbursementTransactionId,
    );

  if (!disbursementTransaction) {
    throw new Error(
      "No se encontró el movimiento de disposición asociado. " +
        "No se canceló el préstamo.",
    );
  }

  if (disbursementTransaction.status === "cancelled") {
    throw new Error(
      "El movimiento de disposición ya está cancelado. " +
        "Es necesario revisar la relación entre ambos registros.",
    );
  }

  const reason = "Cancelación del préstamo.";

  const cancelledTransaction: Transaction = {
    ...disbursementTransaction,
    status: "cancelled",
    cancellationReason: reason,
  };

  const auditEvent = createTransactionCancellationAuditEvent(
    disbursementTransaction,
    reason,
  );

  const updatedTransactionStorage: TransactionStorage = {
    ...previousTransactionStorage,

    transactions: previousTransactionStorage.transactions.map(
      (transaction) =>
        transaction.id === disbursementTransaction.id
          ? cancelledTransaction
          : transaction,
    ),

    auditEvents: [
      auditEvent,
      ...previousTransactionStorage.auditEvents,
    ],
  };

  persistLoanWithTransaction(
    nextAccountStorage,
    previousTransactionStorage,
    updatedTransactionStorage,
  );

  return cancelledLoan;
}

// ============================================
// MARCAR PRÉSTAMO COMO PAGADO
// ============================================

export function completeLoan(loanId: string): Loan {
  const storage = loadAccountStorage();

  const currentLoan = getLoanOrThrow(
    storage.loans,
    loanId,
  );

  if (currentLoan.status !== "active") {
    throw new Error(
      "Solamente se pueden liquidar préstamos activos.",
    );
  }

  const installments = filterLoanInstallments(
    storage.loanInstallments,
    loanId,
  );

  if (installments.length === 0) {
    throw new Error(
      "El préstamo no tiene parcialidades registradas.",
    );
  }

  const allInstallmentsPaid = installments.every(
    (installment) => installment.status === "paid",
  );

  if (!allInstallmentsPaid) {
    throw new Error(
      "No se puede liquidar el préstamo mientras existan " +
        "parcialidades pendientes.",
    );
  }

  const now = getCurrentTimestamp();

  const completedLoan: Loan = {
    ...currentLoan,
    status: "paid",
    paidAt: now,
    updatedAt: now,
  };

  const nextStorage = {
    ...storage,

    loans: storage.loans.map((loan) =>
      loan.id === loanId ? completedLoan : loan,
    ),
  };

  persistStorage(nextStorage);

  return completedLoan;
}

// ============================================
// ELIMINAR PRÉSTAMO
// ============================================

// No se implementa eliminación física.
// Los préstamos representan compromisos financieros
// y deben conservar su historial.
// Para finalizar un préstamo se utiliza cancelLoan()
// o completeLoan().
