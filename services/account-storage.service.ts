import type {
  Account,
  Bank,
  BankCard,
  CardPayment,
  CardPaymentAllocation,
  CardPurchase,
  Installment,
  InstallmentInterestType,
  InstallmentPayment,
  InstallmentPlan,
} from "@/types/account";
import type {
  Loan,
  LoanInstallment,
  LoanPayment,
  LoanPaymentAllocation,
} from "@/types/loan.types";
import type {
  CreditLine,
  CreditLineDrawdown,
  CreditLinePayment,
  CreditLineCharge,
} from "@/types/credit-line.types";

import { banksData } from "@/lib/accounts-data";

const STORAGE_KEY = "proyecto-fs:accounts:v1";

export interface AccountStorageData {
  banks: Bank[];
  accounts: Account[];
  cards: BankCard[];
  purchases: CardPurchase[];
  installmentPlans: InstallmentPlan[];
  installments: Installment[];
  cardPayments: CardPayment[];
  cardPaymentAllocations: CardPaymentAllocation[];
  loans: Loan[];
  loanInstallments: LoanInstallment[];
  loanPayments: LoanPayment[];
  loanPaymentAllocations: LoanPaymentAllocation[];
  creditLines: CreditLine[];
  creditLineDrawdowns: CreditLineDrawdown[];
  creditLinePayments: CreditLinePayment[];
  creditLineCharges: CreditLineCharge[];
}

const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "cash",
  "investment",
  "other",
] as const;

const ACCOUNT_STATUSES = ["active", "archived"] as const;
const CARD_TYPES = ["debit", "credit"] as const;
const CARD_STATUSES = ["active", "archived"] as const;
const PURCHASE_TYPES = ["single", "installments"] as const;
const PURCHASE_STATUSES = ["active", "cancelled"] as const;

const INTEREST_TYPES = ["none", "fixed", "annual_rate"] as const;

const PLAN_STATUSES = ["active", "completed", "cancelled"] as const;

const INSTALLMENT_STATUSES = ["pending", "partial", "paid"] as const;

const PAYMENT_METHODS = ["manual", "transaction"] as const;

const CARD_PAYMENT_ALLOCATION_MODES = ["automatic", "manual"] as const;

const CARD_PAYMENT_ALLOCATION_TYPES = [
  "single_purchase",
  "installment",
] as const;

const LOAN_TYPES = ["personal", "auto", "mortgage", "other"] as const;
const LOAN_STATUSES = ["active", "paid", "cancelled"] as const;
const LOAN_INTEREST_TYPES = ["fixed", "variable"] as const;
const LOAN_PAYMENT_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;
const LOAN_AMORTIZATION_TYPES = ["manual", "french", "german", "custom"] as const;
const LOAN_INSTALLMENT_STATUSES = ["pending", "partial", "paid", "overdue"] as const;
const LOAN_PAYMENT_STATUSES = ["completed", "cancelled"] as const;
const LOAN_PAYMENT_METHODS = ["manual", "transaction"] as const;

const CREDIT_LINE_STATUSES = ["active", "suspended", "closed"] as const;
const CREDIT_LINE_INTEREST_TYPES = ["fixed", "variable"] as const;
const CREDIT_LINE_INTEREST_METHODS = [
  "daily_balance",
  "average_balance",
  "manual",
] as const;
const CREDIT_LINE_PAYMENT_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
] as const;
const CREDIT_LINE_DRAWDOWN_DESTINATIONS = ["account", "external"] as const;
const CREDIT_LINE_DRAWDOWN_STATUSES = ["active", "cancelled"] as const;
const CREDIT_LINE_PAYMENT_STATUSES = ["completed", "cancelled"] as const;
const CREDIT_LINE_CHARGE_TYPES = [
  "ordinary_interest",
  "moratory_interest",
  "commission",
  "insurance",
  "other",
] as const;
const CREDIT_LINE_CHARGE_STATUSES = ["active", "cancelled"] as const;

const EMPTY_STORAGE: Omit<AccountStorageData, "banks"> = {
  accounts: [],
  cards: [],
  purchases: [],
  installmentPlans: [],
  installments: [],
  cardPayments: [],
  cardPaymentAllocations: [],
  loans: [],
  loanInstallments: [],
  loanPayments: [],
  loanPaymentAllocations: [],
  creditLines: [],
  creditLineDrawdowns: [],
  creditLinePayments: [],
  creditLineCharges: [],
};

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isMoney(value: unknown): value is number {
  return (
    isFiniteNumber(value) &&
    value > 0 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}

function isNonNegativeMoney(value: unknown): value is number {
  return (
    isFiniteNumber(value) &&
    value >= 0 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}

function isValidDate(value: unknown): value is string {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidTimestamp(value: unknown): value is string {
  return (
    isString(value) &&
    value.trim().length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function isValidDay(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 31)
  );
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  values: T,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isMoneyEqual(a: number, b: number): boolean {
  return roundMoney(a) === roundMoney(b);
}

function isUniqueById<T extends { id: string }>(items: T[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isArrayOf<T>(
  value: unknown,
  validator: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(validator);
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE BANCOS
// -----------------------------------------------------------------------------

function isBank(value: unknown): value is Bank {
  if (!isObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    typeof value.isCustom === "boolean" &&
    isValidTimestamp(value.createdAt)
  );
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE CUENTAS
// -----------------------------------------------------------------------------

function isAccount(value: unknown): value is Account {
  if (!isObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNullableString(value.bankId) &&
    isOneOf(value.type, ACCOUNT_TYPES) &&
    value.currency === "MXN" &&
    isFiniteNumber(value.openingBalance) &&
    isValidDate(value.openingDate) &&
    isOneOf(value.status, ACCOUNT_STATUSES) &&
    isValidTimestamp(value.createdAt) &&
    (value.archivedAt === undefined || isValidTimestamp(value.archivedAt))
  );
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE TARJETAS
// -----------------------------------------------------------------------------

function isBankCard(value: unknown): value is BankCard {
  if (!isObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.bankId) &&
    isOneOf(value.type, CARD_TYPES) &&
    isNullableString(value.linkedAccountId) &&
    isNullableString(value.paymentAccountId) &&
    (value.creditLimit === null || isPositiveNumber(value.creditLimit)) &&
    isValidDay(value.cutoffDay) &&
    isValidDay(value.paymentDueDay) &&
    isOneOf(value.status, CARD_STATUSES) &&
    isValidTimestamp(value.createdAt) &&
    (value.archivedAt === undefined || isValidTimestamp(value.archivedAt))
  );
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE CONFIGURACIÓN DE INTERESES
// -----------------------------------------------------------------------------

function isInterestType(value: unknown): value is InstallmentInterestType {
  return isOneOf(value, INTEREST_TYPES);
}

function isValidPurchaseInterestConfiguration(
  value: Record<string, unknown>,
): boolean {
  const interestType = value.interestType;
  const interestAmount = value.interestAmount;
  const annualInterestRate = value.annualInterestRate;

  if (!isInterestType(interestType) || !isNonNegativeMoney(interestAmount)) {
    return false;
  }

  if (interestType === "none") {
    return interestAmount === 0 && annualInterestRate === null;
  }

  if (interestType === "fixed") {
    return (
      isPositiveNumber(interestAmount) &&
      Math.abs(interestAmount * 100 - Math.round(interestAmount * 100)) <
        0.000001 &&
      annualInterestRate === null
    );
  }

  return (
    interestAmount === 0 &&
    isFiniteNumber(annualInterestRate) &&
    annualInterestRate > 0 &&
    annualInterestRate <= 1000
  );
}

function isValidPlanInterestConfiguration(
  value: Record<string, unknown>,
): boolean {
  const interestType = value.interestType;
  const interestAmount = value.interestAmount;
  const annualInterestRate = value.annualInterestRate;

  if (!isInterestType(interestType) || !isNonNegativeMoney(interestAmount)) {
    return false;
  }

  if (interestType === "none") {
    return interestAmount === 0 && annualInterestRate === null;
  }

  if (interestType === "fixed") {
    return interestAmount > 0 && annualInterestRate === null;
  }

  return (
    isNonNegativeMoney(interestAmount) &&
    isFiniteNumber(annualInterestRate) &&
    annualInterestRate > 0 &&
    annualInterestRate <= 1000
  );
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE COMPRAS
// -----------------------------------------------------------------------------

function isCardPurchase(value: unknown): value is CardPurchase {
  if (!isObject(value)) {
    return false;
  }

  const validInstallmentConfiguration =
    value.purchaseType === "installments"
      ? typeof value.installmentCount === "number" &&
        Number.isInteger(value.installmentCount) &&
        value.installmentCount >= 2 &&
        isValidDate(value.firstDueDate)
      : value.purchaseType === "single" &&
        value.installmentCount === null &&
        value.firstDueDate === null;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.cardId) &&
    isNonEmptyString(value.transactionId) &&
    isNonEmptyString(value.description) &&
    isMoney(value.amount) &&
    isValidDate(value.purchaseDate) &&
    isOneOf(value.purchaseType, PURCHASE_TYPES) &&
    validInstallmentConfiguration &&
    isValidPurchaseInterestConfiguration(value) &&
    (value.purchaseType !== "single" ||
      (value.interestType === "none" &&
        value.interestAmount === 0 &&
        value.annualInterestRate === null)) &&
    isOneOf(value.status, PURCHASE_STATUSES) &&
    isNullableString(value.installmentPlanId) &&
    isValidTimestamp(value.createdAt)
  );
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE PLANES DE PARCIALIDADES
// -----------------------------------------------------------------------------

function isInstallmentPlan(value: unknown): value is InstallmentPlan {
  if (!isObject(value)) {
    return false;
  }

  const validAmounts =
    isMoney(value.principalAmount) &&
    isNonNegativeMoney(value.interestAmount) &&
    isMoney(value.totalAmount) &&
    isMoneyEqual(
      value.principalAmount + value.interestAmount,
      value.totalAmount,
    );

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.cardPurchaseId) &&
    validAmounts &&
    isValidPlanInterestConfiguration(value) &&
    typeof value.installmentCount === "number" &&
    Number.isInteger(value.installmentCount) &&
    value.installmentCount >= 2 &&
    isValidDate(value.firstDueDate) &&
    isOneOf(value.status, PLAN_STATUSES) &&
    isValidTimestamp(value.createdAt) &&
    (value.cancelledAt === undefined || isValidTimestamp(value.cancelledAt))
  );
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE PAGOS DE PARCIALIDADES
// -----------------------------------------------------------------------------

function isInstallmentPayment(value: unknown): value is InstallmentPayment {
  if (!isObject(value)) {
    return false;
  }

  const validMethod = isOneOf(value.method, PAYMENT_METHODS);

  const validTransactionReference =
    value.method === "transaction"
      ? isNonEmptyString(value.transactionId)
      : value.method === "manual" && value.transactionId === null;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.installmentId) &&
    isMoney(value.amount) &&
    isValidDate(value.paidAt) &&
    validMethod &&
    validTransactionReference &&
    (value.cardPaymentId === undefined || isNonEmptyString(value.cardPaymentId))
  );
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE PAGOS GLOBALES DE TARJETA
// -----------------------------------------------------------------------------

function isCardPayment(value: unknown): value is CardPayment {
  if (!isObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.cardId) &&
    isNonEmptyString(value.transactionId) &&
    isMoney(value.amount) &&
    isValidDate(value.paidAt) &&
    isOneOf(value.allocationMode, CARD_PAYMENT_ALLOCATION_MODES) &&
    isValidTimestamp(value.createdAt)
  );
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE APLICACIONES DE PAGOS
// -----------------------------------------------------------------------------

function isCardPaymentAllocation(
  value: unknown,
): value is CardPaymentAllocation {
  if (!isObject(value)) {
    return false;
  }

  const validReferences =
    value.type === "single_purchase"
      ? isNonEmptyString(value.purchaseId) && value.installmentId === null
      : value.type === "installment"
        ? value.purchaseId === null && isNonEmptyString(value.installmentId)
        : false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.cardPaymentId) &&
    isOneOf(value.type, CARD_PAYMENT_ALLOCATION_TYPES) &&
    validReferences &&
    isMoney(value.amount) &&
    isValidTimestamp(value.createdAt)
  );
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE PARCIALIDADES
// -----------------------------------------------------------------------------

function isInstallment(value: unknown): value is Installment {
  if (!isObject(value) || !Array.isArray(value.payments)) {
    return false;
  }

  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.planId) ||
    typeof value.installmentNumber !== "number" ||
    !Number.isInteger(value.installmentNumber) ||
    value.installmentNumber < 1 ||
    !isValidDate(value.dueDate) ||
    !isMoney(value.amount) ||
    !isMoney(value.principalAmount) ||
    !isNonNegativeMoney(value.interestAmount) ||
    !isMoneyEqual(value.principalAmount + value.interestAmount, value.amount) ||
    !isNonNegativeMoney(value.paidAmount) ||
    value.paidAmount > value.amount ||
    !isOneOf(value.status, INSTALLMENT_STATUSES) ||
    !isValidTimestamp(value.createdAt)
  ) {
    return false;
  }

  if (
    !value.payments.every(
      (payment: unknown) =>
        isInstallmentPayment(payment) && payment.installmentId === value.id,
    )
  ) {
    return false;
  }

  const paymentsTotal = roundMoney(
    value.payments.reduce(
      (total: number, payment: InstallmentPayment) => total + payment.amount,
      0,
    ),
  );

  if (!isMoneyEqual(paymentsTotal, value.paidAmount)) {
    return false;
  }

  const expectedStatus =
    value.paidAmount >= value.amount
      ? "paid"
      : value.paidAmount > 0
        ? "partial"
        : "pending";

  return value.status === expectedStatus;
}


// -----------------------------------------------------------------------------
// VALIDACIÓN DE PRÉSTAMOS
// -----------------------------------------------------------------------------

function isLoan(value: unknown): value is Loan {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.institutionId) &&
    isOneOf(value.type, LOAN_TYPES) &&
    isOneOf(value.status, LOAN_STATUSES) &&
    isNullableString(value.contractNumber) &&
    isMoney(value.contractedAmount) &&
    isMoney(value.principalAmount) &&
    isNonNegativeMoney(value.netDisbursedAmount) &&
    isNonNegativeMoney(value.openingCommission) &&
    isNonNegativeMoney(value.openingInsurance) &&
    isNonNegativeMoney(value.financedCharges) &&
    isFiniteNumber(value.annualInterestRate) &&
    value.annualInterestRate >= 0 &&
    value.annualInterestRate <= 1000 &&
    isOneOf(value.interestType, LOAN_INTEREST_TYPES) &&
    typeof value.termInMonths === "number" &&
    Number.isInteger(value.termInMonths) &&
    value.termInMonths > 0 &&
    isOneOf(value.paymentFrequency, LOAN_PAYMENT_FREQUENCIES) &&
    isOneOf(value.amortizationType, LOAN_AMORTIZATION_TYPES) &&
    isValidDate(value.contractDate) &&
    isValidDate(value.disbursementDate) &&
    isValidDate(value.firstPaymentDate) &&
    isValidDate(value.endDate) &&
    isNullableString(value.receivingAccountId) &&
    isNullableString(value.paymentAccountId) &&
    isNullableString(value.notes) &&
    isValidTimestamp(value.createdAt) &&
    isValidTimestamp(value.updatedAt) &&
    (value.paidAt === undefined || isValidTimestamp(value.paidAt)) &&
    (value.cancelledAt === undefined || isValidTimestamp(value.cancelledAt))
  );
}

function isLoanInstallment(value: unknown): value is LoanInstallment {
  if (!isObject(value)) return false;

  const amountsValid =
    isNonNegativeMoney(value.principalAmount) &&
    isNonNegativeMoney(value.interestAmount) &&
    isNonNegativeMoney(value.commissionAmount) &&
    isNonNegativeMoney(value.insuranceAmount) &&
    isMoney(value.totalAmount) &&
    isMoneyEqual(
      value.principalAmount +
        value.interestAmount +
        value.commissionAmount +
        value.insuranceAmount,
      value.totalAmount,
    );

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.loanId) &&
    typeof value.installmentNumber === "number" &&
    Number.isInteger(value.installmentNumber) &&
    value.installmentNumber > 0 &&
    isValidDate(value.dueDate) &&
    amountsValid &&
    isOneOf(value.status, LOAN_INSTALLMENT_STATUSES) &&
    isValidTimestamp(value.createdAt)
  );
}

function isLoanPayment(value: unknown): value is LoanPayment {
  if (!isObject(value)) return false;

  const validMethod = isOneOf(value.method, LOAN_PAYMENT_METHODS);
  const validTransactionReference =
    value.method === "transaction"
      ? isNonEmptyString(value.transactionId)
      : value.method === "manual" && value.transactionId === null;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.loanId) &&
    isNullableString(value.sourceAccountId) &&
    isMoney(value.amount) &&
    isValidDate(value.paidAt) &&
    isOneOf(value.status, LOAN_PAYMENT_STATUSES) &&
    validMethod &&
    validTransactionReference &&
    isNullableString(value.notes) &&
    isValidTimestamp(value.createdAt)
  );
}

function isLoanPaymentAllocation(
  value: unknown,
): value is LoanPaymentAllocation {
  if (!isObject(value)) return false;

  const amountsValid =
    isNonNegativeMoney(value.principalAmount) &&
    isNonNegativeMoney(value.interestAmount) &&
    isNonNegativeMoney(value.commissionAmount) &&
    isNonNegativeMoney(value.insuranceAmount) &&
    isMoney(value.totalAmount) &&
    isMoneyEqual(
      value.principalAmount +
        value.interestAmount +
        value.commissionAmount +
        value.insuranceAmount,
      value.totalAmount,
    );

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.loanPaymentId) &&
    isNonEmptyString(value.installmentId) &&
    amountsValid &&
    isValidTimestamp(value.createdAt)
  );
}

// -----------------------------------------------------------------------------
// VALIDACIÓN DE LÍNEAS DE CRÉDITO
// -----------------------------------------------------------------------------

function isCreditLine(value: unknown): value is CreditLine {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.institutionId) &&
    isOneOf(value.status, CREDIT_LINE_STATUSES) &&
    isNullableString(value.contractNumber) &&
    isMoney(value.creditLimit) &&
    isFiniteNumber(value.annualInterestRate) &&
    value.annualInterestRate >= 0 &&
    value.annualInterestRate <= 1000 &&
    isOneOf(value.interestType, CREDIT_LINE_INTEREST_TYPES) &&
    isOneOf(value.interestCalculationMethod, CREDIT_LINE_INTEREST_METHODS) &&
    isOneOf(value.paymentFrequency, CREDIT_LINE_PAYMENT_FREQUENCIES) &&
    isValidDay(value.cutoffDay) &&
    isValidDay(value.paymentDueDay) &&
    isValidDate(value.openingDate) &&
    (value.expirationDate === null || isValidDate(value.expirationDate)) &&
    isNullableString(value.paymentAccountId) &&
    isNullableString(value.notes) &&
    isValidTimestamp(value.createdAt) &&
    isValidTimestamp(value.updatedAt) &&
    (value.closedAt === undefined || isValidTimestamp(value.closedAt))
  );
}

function isCreditLineDrawdown(
  value: unknown,
): value is CreditLineDrawdown {
  if (!isObject(value)) return false;

  const validDestination =
    value.destinationType === "account"
      ? isNonEmptyString(value.destinationAccountId) &&
        value.destinationDescription === null
      : value.destinationType === "external"
        ? value.destinationAccountId === null &&
          isNonEmptyString(value.destinationDescription)
        : false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.creditLineId) &&
    isNonEmptyString(value.description) &&
    isMoney(value.amount) &&
    isValidDate(value.drawdownDate) &&
    isOneOf(value.destinationType, CREDIT_LINE_DRAWDOWN_DESTINATIONS) &&
    validDestination &&
    isNullableString(value.transactionId) &&
    isOneOf(value.status, CREDIT_LINE_DRAWDOWN_STATUSES) &&
    isNullableString(value.notes) &&
    isValidTimestamp(value.createdAt)
  );
}

function isCreditLinePayment(
  value: unknown,
): value is CreditLinePayment {
  if (!isObject(value)) return false;

  const amountsValid =
    isNonNegativeMoney(value.principalPaid) &&
    isNonNegativeMoney(value.interestPaid) &&
    isNonNegativeMoney(value.commissionPaid) &&
    isNonNegativeMoney(value.insurancePaid) &&
    isMoney(value.amount) &&
    isMoneyEqual(
      value.principalPaid +
        value.interestPaid +
        value.commissionPaid +
        value.insurancePaid,
      value.amount,
    );

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.creditLineId) &&
    isNullableString(value.sourceAccountId) &&
    isMoney(value.amount) &&
    amountsValid &&
    isValidDate(value.paidAt) &&
    isOneOf(value.status, CREDIT_LINE_PAYMENT_STATUSES) &&
    isNullableString(value.transactionId) &&
    isNullableString(value.notes) &&
    isValidTimestamp(value.createdAt)
  );
}

function isCreditLineCharge(value: unknown): value is CreditLineCharge {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.creditLineId) &&
    isOneOf(value.type, CREDIT_LINE_CHARGE_TYPES) &&
    isNonEmptyString(value.description) &&
    isMoney(value.amount) &&
    isValidDate(value.chargeDate) &&
    typeof value.capitalized === "boolean" &&
    isOneOf(value.status, CREDIT_LINE_CHARGE_STATUSES) &&
    isValidTimestamp(value.createdAt)
  );
}

// -----------------------------------------------------------------------------
// MIGRACIÓN DE PLANES ANTERIORES
// -----------------------------------------------------------------------------

function migrateInstallmentPlan(value: unknown): unknown {
  if (!isObject(value)) {
    return value;
  }

  const principalAmount = value.principalAmount ?? value.totalAmount;

  const interestAmount = value.interestAmount ?? 0;

  const interestType = value.interestType ?? "none";

  const annualInterestRate = value.annualInterestRate ?? null;

  return {
    ...value,
    principalAmount,
    interestAmount,
    interestType,
    annualInterestRate,
  };
}

// -----------------------------------------------------------------------------
// MIGRACIÓN DE COMPRAS ANTERIORES
// -----------------------------------------------------------------------------

function migrateCardPurchase(
  value: unknown,
  plans: InstallmentPlan[],
): unknown {
  if (!isObject(value)) {
    return value;
  }

  const existingPlan = plans.find((plan) => plan.cardPurchaseId === value.id);

  const installmentCount =
    value.purchaseType === "installments"
      ? (value.installmentCount ?? existingPlan?.installmentCount)
      : null;

  const firstDueDate =
    value.purchaseType === "installments"
      ? (value.firstDueDate ?? existingPlan?.firstDueDate)
      : null;

  const interestType =
    value.interestType ?? existingPlan?.interestType ?? "none";

  const interestAmount =
    value.interestAmount ??
    (interestType === "fixed" ? (existingPlan?.interestAmount ?? 0) : 0);

  const annualInterestRate =
    value.annualInterestRate ?? existingPlan?.annualInterestRate ?? null;

  return {
    ...value,
    installmentCount,
    firstDueDate,
    interestType,
    interestAmount,
    annualInterestRate,
  };
}

// -----------------------------------------------------------------------------
// MIGRACIÓN DE PARCIALIDADES ANTERIORES
// -----------------------------------------------------------------------------

function migrateInstallment(value: unknown): unknown {
  if (!isObject(value)) {
    return value;
  }

  return {
    ...value,
    principalAmount: value.principalAmount ?? value.amount,
    interestAmount: value.interestAmount ?? 0,
  };
}

// -----------------------------------------------------------------------------
// BANCOS
// -----------------------------------------------------------------------------

function mergeBanks(storedBanks: unknown): Bank[] {
  const banksMap = new Map<string, Bank>();

  for (const bank of banksData) {
    banksMap.set(bank.id, bank);
  }

  if (Array.isArray(storedBanks)) {
    for (const item of storedBanks) {
      if (!isBank(item)) {
        continue;
      }

      // Los bancos predeterminados no pueden sobrescribirse.
      if (banksMap.has(item.id)) {
        continue;
      }

      banksMap.set(item.id, item);
    }
  }

  return Array.from(banksMap.values());
}

// -----------------------------------------------------------------------------
// NORMALIZACIÓN
// -----------------------------------------------------------------------------

function createInitialStorage(): AccountStorageData {
  return {
    banks: [...banksData],
    ...EMPTY_STORAGE,
  };
}

function normalizeStorage(parsed: Record<string, unknown>): AccountStorageData {
  // Primero se migran los planes para poder recuperar desde ellos
  // la configuración histórica de las compras.
  const rawPlans = Array.isArray(parsed.installmentPlans)
    ? parsed.installmentPlans
    : [];

  const migratedPlans = rawPlans.map(migrateInstallmentPlan);

  const plans = migratedPlans.filter(isInstallmentPlan);

  const rawPurchases = Array.isArray(parsed.purchases) ? parsed.purchases : [];

  const migratedPurchases = rawPurchases.map((purchase) =>
    migrateCardPurchase(purchase, plans),
  );

  const rawInstallments = Array.isArray(parsed.installments)
    ? parsed.installments
    : [];

  const migratedInstallments = rawInstallments.map(migrateInstallment);

  return {
    banks: mergeBanks(parsed.banks),

    accounts: Array.isArray(parsed.accounts)
      ? parsed.accounts.filter(isAccount)
      : [],

    cards: Array.isArray(parsed.cards) ? parsed.cards.filter(isBankCard) : [],

    purchases: migratedPurchases.filter(isCardPurchase),

    installmentPlans: plans,

    installments: migratedInstallments.filter(isInstallment),

    cardPayments: Array.isArray(parsed.cardPayments)
      ? parsed.cardPayments.filter(isCardPayment)
      : [],

    cardPaymentAllocations: Array.isArray(parsed.cardPaymentAllocations)
      ? parsed.cardPaymentAllocations.filter(isCardPaymentAllocation)
      : [],

    loans: Array.isArray(parsed.loans) ? parsed.loans.filter(isLoan) : [],
    loanInstallments: Array.isArray(parsed.loanInstallments)
      ? parsed.loanInstallments.filter(isLoanInstallment)
      : [],
    loanPayments: Array.isArray(parsed.loanPayments)
      ? parsed.loanPayments.filter(isLoanPayment)
      : [],
    loanPaymentAllocations: Array.isArray(parsed.loanPaymentAllocations)
      ? parsed.loanPaymentAllocations.filter(isLoanPaymentAllocation)
      : [],

    creditLines: Array.isArray(parsed.creditLines)
      ? parsed.creditLines.filter(isCreditLine)
      : [],
    creditLineDrawdowns: Array.isArray(parsed.creditLineDrawdowns)
      ? parsed.creditLineDrawdowns.filter(isCreditLineDrawdown)
      : [],
    creditLinePayments: Array.isArray(parsed.creditLinePayments)
      ? parsed.creditLinePayments.filter(isCreditLinePayment)
      : [],
    creditLineCharges: Array.isArray(parsed.creditLineCharges)
      ? parsed.creditLineCharges.filter(isCreditLineCharge)
      : [],
  };
}

// -----------------------------------------------------------------------------
// VALIDACIÓN COMPLETA DEL ALMACENAMIENTO
// -----------------------------------------------------------------------------

function arePaymentIdsUnique(installments: Installment[]): boolean {
  const paymentIds = installments.flatMap((installment) =>
    installment.payments.map((payment) => payment.id),
  );

  return new Set(paymentIds).size === paymentIds.length;
}



function areLoanRelationsValid(data: AccountStorageData): boolean {
  const bankIds = new Set(data.banks.map((bank) => bank.id));
  const accountIds = new Set(data.accounts.map((account) => account.id));

  const loanMap = new Map(data.loans.map((loan) => [loan.id, loan]));

  const installmentMap = new Map(
    data.loanInstallments.map((installment) => [
      installment.id,
      installment,
    ]),
  );

  const paymentMap = new Map(
    data.loanPayments.map((payment) => [payment.id, payment]),
  );

  // ============================================
  // VALIDACIÓN DE PRÉSTAMOS
  // ============================================

  for (const loan of data.loans) {
    // El banco debe existir.
    if (!bankIds.has(loan.institutionId)) {
      return false;
    }

    // La cuenta receptora debe existir.
    if (
      loan.receivingAccountId !== null &&
      !accountIds.has(loan.receivingAccountId)
    ) {
      return false;
    }

    // La cuenta habitual de pago debe existir.
    if (
      loan.paymentAccountId !== null &&
      !accountIds.has(loan.paymentAccountId)
    ) {
      return false;
    }
  }

  // ============================================
  // VALIDACIÓN DE PARCIALIDADES
  // ============================================

  for (const installment of data.loanInstallments) {
    if (!loanMap.has(installment.loanId)) {
      return false;
    }
  }

  // ============================================
  // VALIDACIÓN DE PAGOS
  // ============================================

  for (const payment of data.loanPayments) {
    if (!loanMap.has(payment.loanId)) {
      return false;
    }

    if (
      payment.sourceAccountId !== null &&
      !accountIds.has(payment.sourceAccountId)
    ) {
      return false;
    }
  }

  // ============================================
  // ACUMULADORES DE ASIGNACIONES
  // ============================================

  const allocatedByPayment = new Map<string, number>();

  const allocatedByInstallment = new Map<
    string,
    {
      principal: number;
      interest: number;
      commission: number;
      insurance: number;
      total: number;
    }
  >();

  // ============================================
  // VALIDACIÓN DE ASIGNACIONES
  // ============================================

  for (const allocation of data.loanPaymentAllocations) {
    const payment = paymentMap.get(allocation.loanPaymentId);

    const installment = installmentMap.get(
      allocation.installmentId,
    );

    // El pago y la parcialidad deben existir.
    if (!payment || !installment) {
      return false;
    }

    // El pago y la parcialidad deben pertenecer
    // al mismo préstamo.
    if (payment.loanId !== installment.loanId) {
      return false;
    }

    // No se permiten asignaciones de pagos cancelados.
    if (payment.status !== "completed") {
      return false;
    }

    // Acumular importe asignado al pago.
    allocatedByPayment.set(
      payment.id,
      roundMoney(
        (allocatedByPayment.get(payment.id) ?? 0) +
          allocation.totalAmount,
      ),
    );

    // Obtener acumulados actuales de la parcialidad.
    const current = allocatedByInstallment.get(installment.id) ?? {
      principal: 0,
      interest: 0,
      commission: 0,
      insurance: 0,
      total: 0,
    };

    // Acumular cada concepto por separado.
    allocatedByInstallment.set(installment.id, {
      principal: roundMoney(
        current.principal + allocation.principalAmount,
      ),

      interest: roundMoney(
        current.interest + allocation.interestAmount,
      ),

      commission: roundMoney(
        current.commission + allocation.commissionAmount,
      ),

      insurance: roundMoney(
        current.insurance + allocation.insuranceAmount,
      ),

      total: roundMoney(
        current.total + allocation.totalAmount,
      ),
    });
  }

  // ============================================
  // VALIDACIÓN DEL IMPORTE DE CADA PAGO
  // ============================================

  for (const [paymentId, total] of allocatedByPayment) {
    const payment = paymentMap.get(paymentId);

    if (!payment || total > payment.amount) {
      return false;
    }
  }

  // ============================================
  // VALIDACIÓN DE IMPORTES POR PARCIALIDAD
  // ============================================

  for (const [installmentId, allocated] of allocatedByInstallment) {
    const installment = installmentMap.get(installmentId);

    if (!installment) {
      return false;
    }

    // El capital asignado no puede superar
    // el capital programado.
    if (allocated.principal > installment.principalAmount) {
      return false;
    }

    // Los intereses asignados no pueden superar
    // los intereses programados.
    if (allocated.interest > installment.interestAmount) {
      return false;
    }

    // Las comisiones asignadas no pueden superar
    // las comisiones programadas.
    if (allocated.commission > installment.commissionAmount) {
      return false;
    }

    // Los seguros asignados no pueden superar
    // los seguros programados.
    if (allocated.insurance > installment.insuranceAmount) {
      return false;
    }

    // La asignación total no puede superar
    // el importe de la parcialidad.
    if (allocated.total > installment.totalAmount) {
      return false;
    }

    // ============================================
    // VALIDACIÓN DEL ESTADO DE LA PARCIALIDAD
    // ============================================

    const isFullyPaid = isMoneyEqual(
      allocated.total,
      installment.totalAmount,
    );

    const hasPartialPayment =
      allocated.total > 0 && !isFullyPaid;

    const hasNoPayment = allocated.total === 0;

    // Si está completamente pagada, debe tener
    // el estado paid.
    if (isFullyPaid && installment.status !== "paid") {
      return false;
    }

    // Si tiene un pago parcial, debe estar
    // partial o overdue.
    if (
      hasPartialPayment &&
      installment.status !== "partial" &&
      installment.status !== "overdue"
    ) {
      return false;
    }

    // Si no tiene pagos, debe estar
    // pending o overdue.
    if (
      hasNoPayment &&
      installment.status !== "pending" &&
      installment.status !== "overdue"
    ) {
      return false;
    }
  }

  // ============================================
  // PARCIALIDADES SIN ASIGNACIONES
  // ============================================

  for (const installment of data.loanInstallments) {
    // Si ya tiene asignaciones, se validó anteriormente.
    if (allocatedByInstallment.has(installment.id)) {
      continue;
    }

    // Una parcialidad sin pagos no puede aparecer
    // como parcial ni como pagada.
    if (
      installment.status !== "pending" &&
      installment.status !== "overdue"
    ) {
      return false;
    }
  }

  return true;
}


function areCreditLineRelationsValid(data: AccountStorageData): boolean {
  const bankIds = new Set(data.banks.map((bank) => bank.id));
  const accountIds = new Set(data.accounts.map((account) => account.id));
  const creditLineIds = new Set(data.creditLines.map((line) => line.id));

  for (const line of data.creditLines) {
    if (!bankIds.has(line.institutionId)) return false;
    if (
      line.paymentAccountId !== null &&
      !accountIds.has(line.paymentAccountId)
    ) return false;
  }

  for (const drawdown of data.creditLineDrawdowns) {
    if (!creditLineIds.has(drawdown.creditLineId)) return false;

    if (drawdown.destinationType === "account") {
      const accountId = drawdown.destinationAccountId;
      if (accountId === null || !accountIds.has(accountId)) return false;
    }
  }

  for (const payment of data.creditLinePayments) {
    if (!creditLineIds.has(payment.creditLineId)) return false;
    if (
      payment.sourceAccountId !== null &&
      !accountIds.has(payment.sourceAccountId)
    ) return false;
  }

  for (const charge of data.creditLineCharges) {
    if (!creditLineIds.has(charge.creditLineId)) return false;
  }

  return true;
}

function isValidStorageStructure(data: AccountStorageData): boolean {
  return (
    isArrayOf(data.banks, isBank) &&
    isArrayOf(data.accounts, isAccount) &&
    isArrayOf(data.cards, isBankCard) &&
    isArrayOf(data.purchases, isCardPurchase) &&
    isArrayOf(data.installmentPlans, isInstallmentPlan) &&
    isArrayOf(data.installments, isInstallment) &&
    isArrayOf(data.cardPayments, isCardPayment) &&
    isArrayOf(data.cardPaymentAllocations, isCardPaymentAllocation) &&
    isArrayOf(data.loans, isLoan) &&
    isArrayOf(data.loanInstallments, isLoanInstallment) &&
    isArrayOf(data.loanPayments, isLoanPayment) &&
    isArrayOf(data.loanPaymentAllocations, isLoanPaymentAllocation) &&
    isArrayOf(data.creditLines, isCreditLine) &&
    isArrayOf(data.creditLineDrawdowns, isCreditLineDrawdown) &&
    isArrayOf(data.creditLinePayments, isCreditLinePayment) &&
    isArrayOf(data.creditLineCharges, isCreditLineCharge) &&
    isUniqueById(data.banks) &&
    isUniqueById(data.accounts) &&
    isUniqueById(data.cards) &&
    isUniqueById(data.purchases) &&
    isUniqueById(data.installmentPlans) &&
    isUniqueById(data.installments) &&
    isUniqueById(data.cardPayments) &&
    isUniqueById(data.cardPaymentAllocations) &&
    isUniqueById(data.loans) &&
    isUniqueById(data.loanInstallments) &&
    isUniqueById(data.loanPayments) &&
    isUniqueById(data.loanPaymentAllocations) &&
    isUniqueById(data.creditLines) &&
    isUniqueById(data.creditLineDrawdowns) &&
    isUniqueById(data.creditLinePayments) &&
    isUniqueById(data.creditLineCharges) &&
    arePaymentIdsUnique(data.installments) &&
    areLoanRelationsValid(data) &&
    areCreditLineRelationsValid(data)
  );
}

// -----------------------------------------------------------------------------
// DETECCIÓN DE REGISTROS IRRECUPERABLES
// -----------------------------------------------------------------------------

/**
 * Comprueba que la normalización no esté descartando registros existentes.
 * Evita sobrescribir datos que no puedan recuperarse.
 */
function hasUnrecoverableStoredRecords(
  parsed: Record<string, unknown>,
): boolean {
  const collections: Array<{
    key: keyof AccountStorageData;
    validator: (value: unknown) => boolean;
  }> = [
    { key: "accounts", validator: isAccount },
    { key: "cards", validator: isBankCard },
    { key: "cardPayments", validator: isCardPayment },
    {
      key: "cardPaymentAllocations",
      validator: isCardPaymentAllocation,
    },
    { key: "loans", validator: isLoan },
    { key: "loanInstallments", validator: isLoanInstallment },
    { key: "loanPayments", validator: isLoanPayment },
    { key: "loanPaymentAllocations", validator: isLoanPaymentAllocation },
    { key: "creditLines", validator: isCreditLine },
    { key: "creditLineDrawdowns", validator: isCreditLineDrawdown },
    { key: "creditLinePayments", validator: isCreditLinePayment },
    { key: "creditLineCharges", validator: isCreditLineCharge },
  ];

  for (const collection of collections) {
    const raw = parsed[collection.key];

    if (raw === undefined) {
      continue;
    }

    if (!Array.isArray(raw) || !raw.every(collection.validator)) {
      return true;
    }
  }

  // Los planes antiguos se migran antes de validarse.
  const rawPlans = parsed.installmentPlans;

  const migratedPlans = Array.isArray(rawPlans)
    ? rawPlans.map(migrateInstallmentPlan)
    : [];

  if (
    rawPlans !== undefined &&
    (!Array.isArray(rawPlans) || !migratedPlans.every(isInstallmentPlan))
  ) {
    return true;
  }

  const validPlans = migratedPlans.filter(isInstallmentPlan);

  // Las compras antiguas pueden recuperar sus datos del plan.
  const rawPurchases = parsed.purchases;

  if (rawPurchases !== undefined) {
    if (!Array.isArray(rawPurchases)) {
      return true;
    }

    for (const rawPurchase of rawPurchases) {
      const migrated = migrateCardPurchase(rawPurchase, validPlans);

      if (!isCardPurchase(migrated)) {
        return true;
      }
    }
  }

  // Las parcialidades antiguas se interpretan como capital sin intereses.
  const rawInstallments = parsed.installments;

  if (rawInstallments !== undefined) {
    if (!Array.isArray(rawInstallments)) {
      return true;
    }

    const migratedInstallments = rawInstallments.map(migrateInstallment);

    if (!migratedInstallments.every(isInstallment)) {
      return true;
    }
  }

  return false;
}

// -----------------------------------------------------------------------------
// CARGA
// -----------------------------------------------------------------------------

export function loadAccountStorage(): AccountStorageData {
  if (typeof window === "undefined") {
    return createInitialStorage();
  }

  try {
    const rawData = localStorage.getItem(STORAGE_KEY);

    if (!rawData) {
      return createInitialStorage();
    }

    const parsed: unknown = JSON.parse(rawData);

    if (!isObject(parsed)) {
      console.error(
        "El almacenamiento de cuentas tiene una estructura inválida. " +
          "Los datos originales se conservaron.",
      );

      return createInitialStorage();
    }

    // No entregar una versión parcial si hay registros irrecuperables.
    if (hasUnrecoverableStoredRecords(parsed)) {
      console.error(
        "Se detectaron registros financieros que no pudieron " +
          "recuperarse completamente. El almacenamiento no se cargó " +
          "para evitar operar con información parcial.",
      );

      return createInitialStorage();
    }

    const normalizedStorage = normalizeStorage(parsed);

    if (!isValidStorageStructure(normalizedStorage)) {
      console.error(
        "El almacenamiento de cuentas contiene datos inválidos, " +
          "identificadores duplicados o relaciones estructurales inconsistentes. " +
          "Los datos originales se conservaron.",
      );

      return createInitialStorage();
    }

    return normalizedStorage;
  } catch (error) {
    console.error("Error al cargar los datos de cuentas:", error);

    return createInitialStorage();
  }
}

// -----------------------------------------------------------------------------
// GUARDADO
// -----------------------------------------------------------------------------

export function saveAccountStorage(data: AccountStorageData): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    // No sobrescribir datos antiguos que no puedan recuperarse.
    const existingRaw = localStorage.getItem(STORAGE_KEY);

    if (existingRaw) {
      const parsed: unknown = JSON.parse(existingRaw);

      if (
        !isObject(parsed) ||
        hasUnrecoverableStoredRecords(parsed) ||
        !isValidStorageStructure(normalizeStorage(parsed))
      ) {
        console.error(
          "No se guardaron los datos de cuentas: el almacenamiento " +
            "existente contiene registros inválidos, identificadores " +
            "duplicados o información que requiere recuperación.",
        );

        return false;
      }
    }

    const normalizedStorage: AccountStorageData = {
      banks: mergeBanks(data.banks),
      accounts: data.accounts,
      cards: data.cards,
      purchases: data.purchases,
      installmentPlans: data.installmentPlans,
      installments: data.installments,
      cardPayments: data.cardPayments,
      cardPaymentAllocations: data.cardPaymentAllocations,
      loans: data.loans,
      loanInstallments: data.loanInstallments,
      loanPayments: data.loanPayments,
      loanPaymentAllocations: data.loanPaymentAllocations,
      creditLines: data.creditLines,
      creditLineDrawdowns: data.creditLineDrawdowns,
      creditLinePayments: data.creditLinePayments,
      creditLineCharges: data.creditLineCharges,
    };

    if (!isValidStorageStructure(normalizedStorage)) {
      console.error(
        "No se puede guardar el almacenamiento: existen registros " +
          "inválidos o identificadores duplicados.",
      );

      return false;
    }

    const serializedData = JSON.stringify(normalizedStorage);

    localStorage.setItem(STORAGE_KEY, serializedData);

    return true;
  } catch (error) {
    console.error("Error al guardar los datos de cuentas:", error);

    return false;
  }
}

// -----------------------------------------------------------------------------
// LIMPIEZA
// -----------------------------------------------------------------------------

export function clearAccountStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error al limpiar los datos de cuentas:", error);
  }
}
