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

const EMPTY_STORAGE: Omit<AccountStorageData, "banks"> = {
  accounts: [],
  cards: [],
  purchases: [],
  installmentPlans: [],
  installments: [],
  cardPayments: [],
  cardPaymentAllocations: [],
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
    isUniqueById(data.banks) &&
    isUniqueById(data.accounts) &&
    isUniqueById(data.cards) &&
    isUniqueById(data.purchases) &&
    isUniqueById(data.installmentPlans) &&
    isUniqueById(data.installments) &&
    isUniqueById(data.cardPayments) &&
    isUniqueById(data.cardPaymentAllocations) &&
    arePaymentIdsUnique(data.installments)
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
