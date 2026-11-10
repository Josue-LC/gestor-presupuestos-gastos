
import type {
  Loan,
  LoanInstallment,
} from "@/types/loan.types";

// ============================================
// TIPOS
// ============================================

export interface ManualLoanInstallment {
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  commissionAmount?: number;
  insuranceAmount?: number;
}

export interface LoanAmortizationOptions {
  loan: Loan;

  // Para amortización personalizada:
  // capital que se pagará en cada parcialidad.
  customPrincipalAmounts?: number[];

  // Para amortización manual:
  // importes definidos por el usuario.
  manualInstallments?: ManualLoanInstallment[];

  // Cargos recurrentes opcionales.
  commissionPerInstallment?: number;
  insurancePerInstallment?: number;

  // Permiten controlar la generación de registros.
  createdAt?: string;
  createId?: () => string;
}

// ============================================
// CONSTANTES
// ============================================

const PERIODS_PER_YEAR = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
} as const;

// ============================================
// UTILIDADES MONETARIAS
// ============================================

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidMoney(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}

function isMoneyEqual(a: number, b: number): boolean {
  return roundMoney(a) === roundMoney(b);
}

// ============================================
// UTILIDADES DE FECHAS
// ============================================

function parseDate(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Fecha inválida: ${date}`);
  }

  const [year, month, day] = date.split("-").map(Number);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Fecha inválida: ${date}`);
  }

  return parsed;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonthsClamped(date: Date, months: number): Date {
  const originalDay = date.getUTCDate();

  const targetMonth = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      1,
    ),
  );

  const lastDayOfMonth = new Date(
    Date.UTC(
      targetMonth.getUTCFullYear(),
      targetMonth.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();

  targetMonth.setUTCDate(
    Math.min(originalDay, lastDayOfMonth),
  );

  return targetMonth;
}

function calculateDueDate(
  firstPaymentDate: string,
  frequency: Loan["paymentFrequency"],
  installmentIndex: number,
): string {
  const initialDate = parseDate(firstPaymentDate);

  if (frequency === "weekly") {
    initialDate.setUTCDate(
      initialDate.getUTCDate() + installmentIndex * 7,
    );

    return formatDate(initialDate);
  }

  if (frequency === "biweekly") {
    initialDate.setUTCDate(
      initialDate.getUTCDate() + installmentIndex * 14,
    );

    return formatDate(initialDate);
  }

  return formatDate(
    addMonthsClamped(initialDate, installmentIndex),
  );
}

// ============================================
// UTILIDADES DE IDENTIFICADORES
// ============================================

function generateId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `loan-installment-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 11)}`;
}

// ============================================
// VALIDACIÓN DE CONFIGURACIÓN
// ============================================

function validateLoan(loan: Loan): void {
  if (!loan.id) {
    throw new Error("El préstamo no tiene un identificador.");
  }

  if (!isValidMoney(loan.principalAmount) || loan.principalAmount <= 0) {
    throw new Error("El capital del préstamo debe ser mayor a cero.");
  }

  if (
    !Number.isFinite(loan.annualInterestRate) ||
    loan.annualInterestRate < 0 ||
    loan.annualInterestRate > 1000
  ) {
    throw new Error("La tasa de interés anual no es válida.");
  }

  if (
    !Number.isInteger(loan.termInMonths) ||
    loan.termInMonths <= 0
  ) {
    throw new Error("El plazo del préstamo no es válido.");
  }

  if (!loan.paymentFrequency) {
    throw new Error("La frecuencia de pago no es válida.");
  }

  if (
    !["manual", "french", "german", "custom"].includes(
      loan.amortizationType,
    )
  ) {
    throw new Error("El tipo de amortización no es válido.");
  }

  parseDate(loan.firstPaymentDate);
}

function getInstallmentCount(loan: Loan): number {
  const periodsPerYear = PERIODS_PER_YEAR[loan.paymentFrequency];

  return Math.ceil(
    (loan.termInMonths * periodsPerYear) / 12,
  );
}

function getPeriodicInterestRate(loan: Loan): number {
  const annualRate = loan.annualInterestRate / 100;

  return annualRate / PERIODS_PER_YEAR[loan.paymentFrequency];
}

// ============================================
// VALIDACIÓN DE CARGOS RECURRENTES
// ============================================

function validateRecurringCharges(
  commission: number,
  insurance: number,
): void {
  if (!isValidMoney(commission)) {
    throw new Error("La comisión por parcialidad no es válida.");
  }

  if (!isValidMoney(insurance)) {
    throw new Error("El seguro por parcialidad no es válido.");
  }
}

// ============================================
// CONSTRUCCIÓN DE PARCIALIDADES
// ============================================

function createInstallment(
  options: LoanAmortizationOptions,
  installmentNumber: number,
  dueDate: string,
  principalAmount: number,
  interestAmount: number,
  commissionAmount: number,
  insuranceAmount: number,
): LoanInstallment {
  const totalAmount = roundMoney(
    principalAmount +
      interestAmount +
      commissionAmount +
      insuranceAmount,
  );

  if (!isValidMoney(totalAmount) || totalAmount <= 0) {
    throw new Error(
      `El importe de la parcialidad ${installmentNumber} no es válido.`,
    );
  }

  return {
    id: (options.createId ?? generateId)(),
    loanId: options.loan.id,
    installmentNumber,
    dueDate,
    principalAmount: roundMoney(principalAmount),
    interestAmount: roundMoney(interestAmount),
    commissionAmount: roundMoney(commissionAmount),
    insuranceAmount: roundMoney(insuranceAmount),
    totalAmount,
    status: "pending",
    createdAt: options.createdAt ?? new Date().toISOString(),
  };
}

// ============================================
// AMORTIZACIÓN FRANCESA
// ============================================

function generateFrenchAmortization(
  options: LoanAmortizationOptions,
): LoanInstallment[] {
  const { loan } = options;

  const installmentCount = getInstallmentCount(loan);

  const periodicRate = getPeriodicInterestRate(loan);

  const principal = loan.principalAmount;

  const commission = options.commissionPerInstallment ?? 0;
  const insurance = options.insurancePerInstallment ?? 0;

  validateRecurringCharges(commission, insurance);

  // Cálculo de cuota fija.
  const fixedPayment =
    periodicRate === 0
      ? principal / installmentCount
      : (principal * periodicRate) /
        (1 - Math.pow(1 + periodicRate, -installmentCount));

  const installments: LoanInstallment[] = [];

  let remainingBalance = principal;

  for (let index = 0; index < installmentCount; index++) {
    const interestAmount = roundMoney(
      remainingBalance * periodicRate,
    );

    const isLastInstallment =
      index === installmentCount - 1;

    let principalAmount = isLastInstallment
      ? remainingBalance
      : roundMoney(fixedPayment - interestAmount);

    principalAmount = Math.min(
      principalAmount,
      remainingBalance,
    );

    if (principalAmount <= 0) {
      throw new Error(
        "La amortización francesa no está reduciendo el capital.",
      );
    }

    if (isLastInstallment) {
      principalAmount = remainingBalance;
    }

    const installment = createInstallment(
      options,
      index + 1,
      calculateDueDate(
        loan.firstPaymentDate,
        loan.paymentFrequency,
        index,
      ),
      principalAmount,
      interestAmount,
      commission,
      insurance,
    );

    installments.push(installment);

    remainingBalance = roundMoney(
      remainingBalance - principalAmount,
    );
  }

  return installments;
}

// ============================================
// AMORTIZACIÓN ALEMANA
// ============================================

function generateGermanAmortization(
  options: LoanAmortizationOptions,
): LoanInstallment[] {
  const { loan } = options;

  const installmentCount = getInstallmentCount(loan);

  const periodicRate = getPeriodicInterestRate(loan);

  const commission = options.commissionPerInstallment ?? 0;
  const insurance = options.insurancePerInstallment ?? 0;

  validateRecurringCharges(commission, insurance);

  const fixedPrincipal = roundMoney(
    loan.principalAmount / installmentCount,
  );

  const installments: LoanInstallment[] = [];

  let remainingBalance = loan.principalAmount;

  for (let index = 0; index < installmentCount; index++) {
    const isLastInstallment =
      index === installmentCount - 1;

    const principalAmount = isLastInstallment
      ? remainingBalance
      : Math.min(fixedPrincipal, remainingBalance);

    const interestAmount = roundMoney(
      remainingBalance * periodicRate,
    );

    const installment = createInstallment(
      options,
      index + 1,
      calculateDueDate(
        loan.firstPaymentDate,
        loan.paymentFrequency,
        index,
      ),
      principalAmount,
      interestAmount,
      commission,
      insurance,
    );

    installments.push(installment);

    remainingBalance = roundMoney(
      remainingBalance - principalAmount,
    );
  }

  return installments;
}

// ============================================
// AMORTIZACIÓN PERSONALIZADA
// ============================================

function generateCustomAmortization(
  options: LoanAmortizationOptions,
): LoanInstallment[] {
  const { loan, customPrincipalAmounts } = options;

  if (!customPrincipalAmounts) {
    throw new Error(
      "Debes proporcionar los importes de capital de cada parcialidad.",
    );
  }

  const installmentCount = getInstallmentCount(loan);

  if (customPrincipalAmounts.length !== installmentCount) {
    throw new Error(
      `Se esperaban ${installmentCount} importes de capital.`,
    );
  }

  const principalTotal = roundMoney(
    customPrincipalAmounts.reduce(
      (total, amount) => total + amount,
      0,
    ),
  );

  if (!isMoneyEqual(principalTotal, loan.principalAmount)) {
    throw new Error(
      "La suma del capital personalizado debe coincidir con el capital del préstamo.",
    );
  }

  const periodicRate = getPeriodicInterestRate(loan);

  const commission = options.commissionPerInstallment ?? 0;
  const insurance = options.insurancePerInstallment ?? 0;

  validateRecurringCharges(commission, insurance);

  const installments: LoanInstallment[] = [];

  let remainingBalance = loan.principalAmount;

  customPrincipalAmounts.forEach((customPrincipal, index) => {
    if (
      !isValidMoney(customPrincipal) ||
      customPrincipal <= 0
    ) {
      throw new Error(
        `El capital de la parcialidad ${index + 1} no es válido.`,
      );
    }

    if (customPrincipal > remainingBalance) {
      throw new Error(
        `El capital de la parcialidad ${index + 1} supera el saldo pendiente.`,
      );
    }

    const principalAmount = roundMoney(customPrincipal);

    const interestAmount = roundMoney(
      remainingBalance * periodicRate,
    );

    const installment = createInstallment(
      options,
      index + 1,
      calculateDueDate(
        loan.firstPaymentDate,
        loan.paymentFrequency,
        index,
      ),
      principalAmount,
      interestAmount,
      commission,
      insurance,
    );

    installments.push(installment);

    remainingBalance = roundMoney(
      remainingBalance - principalAmount,
    );
  });

  if (remainingBalance !== 0) {
    throw new Error(
      "El calendario personalizado no liquida completamente el capital.",
    );
  }

  return installments;
}

// ============================================
// AMORTIZACIÓN MANUAL
// ============================================

function generateManualAmortization(
  options: LoanAmortizationOptions,
): LoanInstallment[] {
  const { loan, manualInstallments } = options;

  if (!manualInstallments || manualInstallments.length === 0) {
    throw new Error(
      "Debes proporcionar las parcialidades manuales.",
    );
  }

  const installmentCount = getInstallmentCount(loan);

  if (manualInstallments.length !== installmentCount) {
    throw new Error(
      `Se esperaban ${installmentCount} parcialidades manuales.`,
    );
  }

  const defaultCommission =
    options.commissionPerInstallment ?? 0;

  const defaultInsurance =
    options.insurancePerInstallment ?? 0;

  validateRecurringCharges(
    defaultCommission,
    defaultInsurance,
  );

  const principalTotal = roundMoney(
    manualInstallments.reduce(
      (total, installment) =>
        total + installment.principalAmount,
      0,
    ),
  );

  if (!isMoneyEqual(principalTotal, loan.principalAmount)) {
    throw new Error(
      "La suma del capital manual debe coincidir con el capital del préstamo.",
    );
  }

  let previousDate: Date | null = null;

  return manualInstallments.map((manual, index) => {
    const dueDate = parseDate(manual.dueDate);

    if (
      previousDate &&
      dueDate.getTime() <= previousDate.getTime()
    ) {
      throw new Error(
        "Las fechas de las parcialidades deben estar en orden ascendente.",
      );
    }

    previousDate = dueDate;

    const commissionAmount =
      manual.commissionAmount ?? defaultCommission;

    const insuranceAmount =
      manual.insuranceAmount ?? defaultInsurance;

    if (
      !isValidMoney(manual.principalAmount) ||
      !isValidMoney(manual.interestAmount) ||
      !isValidMoney(commissionAmount) ||
      !isValidMoney(insuranceAmount)
    ) {
      throw new Error(
        `Los importes de la parcialidad ${index + 1} no son válidos.`,
      );
    }

    if (
      manual.principalAmount <= 0 &&
      manual.interestAmount +
        commissionAmount +
        insuranceAmount <=
        0
    ) {
      throw new Error(
        `La parcialidad ${index + 1} debe tener un importe mayor a cero.`,
      );
    }

    return createInstallment(
      options,
      index + 1,
      manual.dueDate,
      manual.principalAmount,
      manual.interestAmount,
      commissionAmount,
      insuranceAmount,
    );
  });
}

// ============================================
// SERVICIO PRINCIPAL
// ============================================

export function generateLoanAmortizationSchedule(
  options: LoanAmortizationOptions,
): LoanInstallment[] {
  validateLoan(options.loan);

  switch (options.loan.amortizationType) {
    case "french":
      return generateFrenchAmortization(options);

    case "german":
      return generateGermanAmortization(options);

    case "custom":
      return generateCustomAmortization(options);

    case "manual":
      return generateManualAmortization(options);

    default:
      throw new Error(
        "El tipo de amortización no está soportado.",
      );
  }
}

// ============================================
// CONSULTAS Y RESÚMENES
// ============================================

export function calculateAmortizationSummary(
  installments: LoanInstallment[],
) {
  return {
    installmentCount: installments.length,

    totalPrincipal: roundMoney(
      installments.reduce(
        (total, item) => total + item.principalAmount,
        0,
      ),
    ),

    totalInterest: roundMoney(
      installments.reduce(
        (total, item) => total + item.interestAmount,
        0,
      ),
    ),

    totalCommissions: roundMoney(
      installments.reduce(
        (total, item) => total + item.commissionAmount,
        0,
      ),
    ),

    totalInsurance: roundMoney(
      installments.reduce(
        (total, item) => total + item.insuranceAmount,
        0,
      ),
    ),

    totalToPay: roundMoney(
      installments.reduce(
        (total, item) => total + item.totalAmount,
        0,
      ),
    ),
  };
}

export function getLoanInstallment(
  installments: LoanInstallment[],
  installmentId: string,
): LoanInstallment | undefined {
  return installments.find(
    (installment) => installment.id === installmentId,
  );
}

export function getLoanInstallments(
  installments: LoanInstallment[],
  loanId: string,
): LoanInstallment[] {
  return installments
    .filter((installment) => installment.loanId === loanId)
    .sort(
      (a, b) => a.installmentNumber - b.installmentNumber,
    );
}
