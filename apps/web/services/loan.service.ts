// loan.service.ts
import type {
  Loan,
  LoanInstallment,
  LoanStatus,
} from "@/types/loan.types";

import {
  loadAccountStorage,
  saveAccountStorage,
} from "@/services/account-storage.service";

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

export type CreateLoanInput = Omit<
  Loan,
  | "id"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "paidAt"
  | "cancelledAt"
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

// ============================================
// CAMPOS QUE AFECTAN LA AMORTIZACIÓN
// ============================================

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

    createdAt: now,
    updatedAt: now,
  };

  if (storage.loans.some((item) => item.id === loan.id)) {
    throw new Error("Ya existe un préstamo con ese identificador.");
  }

  validateInstitutionAndAccounts(loan, storage);

  // Generar el calendario antes de modificar el almacenamiento.
  const installments = createSchedule(
    loan,
    input.amortizationOptions,
    now,
  );

  const nextStorage = {
    ...storage,
    loans: [...storage.loans, loan],
    loanInstallments: [
      ...storage.loanInstallments,
      ...installments,
    ],
  };

  persistStorage(nextStorage);

  return loan;
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
      "No se puede impedir la regeneración cuando cambian las condiciones de amortización.",
    );
  }

  if (!shouldRegenerate && amortizationOptions) {
    throw new Error(
      "Para aplicar nuevas opciones de amortización debes solicitar la regeneración del calendario.",
    );
  }

  let updatedInstallments = storage.loanInstallments;

  if (shouldRegenerate) {
    const hasPayments = storage.loanPayments.some(
      (payment) => payment.loanId === loanId,
    );

    if (hasPayments) {
      throw new Error(
        "No se puede regenerar el calendario porque el préstamo ya tiene registros de pago. " +
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

  const nextStorage = {
    ...storage,

    loans: storage.loans.map((loan) =>
      loan.id === loanId ? updatedLoan : loan,
    ),

    loanInstallments: updatedInstallments,
  };

  persistStorage(nextStorage);

  return updatedLoan;
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

  const now = getCurrentTimestamp();

  const cancelledLoan: Loan = {
    ...currentLoan,
    status: "cancelled",
    cancelledAt: now,
    updatedAt: now,
  };

  const nextStorage = {
    ...storage,

    loans: storage.loans.map((loan) =>
      loan.id === loanId ? cancelledLoan : loan,
    ),
  };

  persistStorage(nextStorage);

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
      "No se puede liquidar el préstamo mientras existan parcialidades pendientes.",
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
