// account-summary.service.ts
import type {
  Account,
  BankCard,
  CardPayment,
  CardPaymentAllocation,
  CardPurchase,
  Installment,
  InstallmentPlan,
} from "@/types/account";

import { loadAccountStorage } from "@/services/account-storage.service";

import { loadTransactionStorage } from "@/services/transaction-storage.service";

import { calculateAccountBalance } from "@/services/account.service";

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

export interface AccountMovementSummary {
  income: number;
  expenses: number;
  transfersIn: number;
  transfersOut: number;
  netMovement: number;
}

export interface AccountSummary {
  account: Account;
  balance: number;
  movements: AccountMovementSummary;
}

export interface CardSummary {
  card: BankCard;
  totalPurchases: number;
  totalSinglePurchases: number;
  outstandingSinglePurchases: number;
  totalSinglePurchasesPaid: number;
  totalInstallmentPurchases: number;
  outstandingInstallments: number;
  totalInstallmentsPaid: number;
  totalCardPayments: number;
  totalCardPaymentsApplied: number;
  unappliedCardPayments: number;
  nextDueDate: string | null;
  nextDueAmount: number;
}

export interface UpcomingInstallment {
  installment: Installment;
  plan: InstallmentPlan;
  purchase: CardPurchase;
  card: BankCard;
  remainingAmount: number;
}

export interface AccountModuleSummary {
  totalAccountsBalance: number;
  totalIncome: number;
  totalExpenses: number;
  totalTransfersIn: number;
  totalTransfersOut: number;
  totalCreditCardDebt: number;
  totalInstallmentDebt: number;
  totalUnappliedCardPayments: number;
  activeAccountsCount: number;
  activeCardsCount: number;
  upcomingInstallments: UpcomingInstallment[];
}

export interface AccountSummaryFilters {
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
}

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);

  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

function validateDateFilters(filters: AccountSummaryFilters): void {
  if (filters.startDate && !isValidDate(filters.startDate)) {
    throw new Error("La fecha inicial del resumen no es válida.");
  }

  if (filters.endDate && !isValidDate(filters.endDate)) {
    throw new Error("La fecha final del resumen no es válida.");
  }

  if (filters.asOfDate && !isValidDate(filters.asOfDate)) {
    throw new Error("La fecha de corte del resumen no es válida.");
  }

  if (
    filters.startDate &&
    filters.endDate &&
    filters.startDate > filters.endDate
  ) {
    throw new Error(
      "La fecha inicial no puede ser posterior a la fecha final.",
    );
  }
}

function getActiveTransactions() {
  const storage = loadTransactionStorage();

  return (storage?.transactions ?? []).filter(
    (transaction) => transaction.status !== "cancelled",
  );
}

function getActiveAccounts(): Account[] {
  const storage = loadAccountStorage();

  return (storage?.accounts ?? []).filter(
    (account) => account.status === "active",
  );
}

function getActiveCards(): BankCard[] {
  const storage = loadAccountStorage();

  return (storage?.cards ?? []).filter((card) => card.status === "active");
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isWithinDateRange(
  date: string,
  filters: AccountSummaryFilters,
): boolean {
  if (filters.startDate && date < filters.startDate) {
    return false;
  }

  if (filters.endDate && date > filters.endDate) {
    return false;
  }

  if (filters.asOfDate && date > filters.asOfDate) {
    return false;
  }

  return true;
}

function getRemainingInstallmentAmount(installment: Installment): number {
  return Math.max(0, roundMoney(installment.amount - installment.paidAmount));
}

function getInstallmentPaidAmount(
  installment: Installment,
  asOfDate?: string,
): number {
  const payments = installment.payments ?? [];

  const paidAmount = payments
    .filter((payment) => !asOfDate || payment.paidAt <= asOfDate)
    .reduce((total, payment) => total + payment.amount, 0);

  return roundMoney(paidAmount);
}

function getRemainingInstallmentAmountAtDate(
  installment: Installment,
  asOfDate?: string,
): number {
  const paidAmount = asOfDate
    ? getInstallmentPaidAmount(installment, asOfDate)
    : installment.paidAmount;

  return Math.max(0, roundMoney(installment.amount - paidAmount));
}

function getActivePurchases(
  purchases: CardPurchase[],
  cardId: string,
  asOfDate?: string,
): CardPurchase[] {
  return purchases.filter(
    (purchase) =>
      purchase.cardId === cardId &&
      purchase.status === "active" &&
      (!asOfDate || purchase.purchaseDate <= asOfDate),
  );
}

function getPaymentForAllocation(
  payments: CardPayment[],
  allocation: CardPaymentAllocation,
): CardPayment | undefined {
  return payments.find((payment) => payment.id === allocation.cardPaymentId);
}

function getSinglePurchaseAllocatedAmount(
  purchaseId: string,
  allocations: CardPaymentAllocation[],
  payments: CardPayment[],
  asOfDate?: string,
): number {
  return roundMoney(
    allocations
      .filter(
        (allocation) =>
          allocation.type === "single_purchase" &&
          allocation.purchaseId === purchaseId,
      )
      .reduce((total, allocation) => {
        const payment = getPaymentForAllocation(payments, allocation);

        if (!payment || (asOfDate && payment.paidAt > asOfDate)) {
          return total;
        }

        return total + allocation.amount;
      }, 0),
  );
}

function getCardPaymentTotals(
  cardId: string,
  payments: CardPayment[],
  allocations: CardPaymentAllocation[],
  asOfDate?: string,
): {
  totalPayments: number;
  totalApplied: number;
  unapplied: number;
} {
  const cardPayments = payments.filter(
    (payment) =>
      payment.cardId === cardId && (!asOfDate || payment.paidAt <= asOfDate),
  );

  const paymentIds = new Set(cardPayments.map((payment) => payment.id));

  const totalPayments = roundMoney(
    cardPayments.reduce((total, payment) => total + payment.amount, 0),
  );

  const totalApplied = roundMoney(
    allocations
      .filter((allocation) => paymentIds.has(allocation.cardPaymentId))
      .reduce((total, allocation) => total + allocation.amount, 0),
  );

  return {
    totalPayments,
    totalApplied,
    unapplied: roundMoney(Math.max(0, totalPayments - totalApplied)),
  };
}

// -----------------------------------------------------------------------------
// MOVIMIENTOS DE CUENTAS
// -----------------------------------------------------------------------------

export function getAccountMovementSummary(
  accountId: string,
  filters: AccountSummaryFilters = {},
): AccountMovementSummary {
  validateDateFilters(filters);

  const transactions = getActiveTransactions();

  const summary: AccountMovementSummary = {
    income: 0,
    expenses: 0,
    transfersIn: 0,
    transfersOut: 0,
    netMovement: 0,
  };

  for (const transaction of transactions) {
    if (!isWithinDateRange(transaction.date, filters)) {
      continue;
    }

    if (transaction.type === "income") {
      if (transaction.account === accountId) {
        summary.income += Math.abs(transaction.amount);
      }

      continue;
    }

    if (transaction.type === "expense") {
      if (transaction.account === accountId) {
        summary.expenses += Math.abs(transaction.amount);
      }

      continue;
    }

    if (transaction.type === "transfer") {
      const transferParts = transaction.account.split(" → ");

      if (transferParts.length !== 2) {
        continue;
      }

      const [sourceAccountId, destinationAccountId] = transferParts.map(
        (part) => part.trim(),
      );

      if (!sourceAccountId || !destinationAccountId) {
        continue;
      }

      if (sourceAccountId === accountId) {
        summary.transfersOut += Math.abs(transaction.amount);
      }

      if (destinationAccountId === accountId) {
        summary.transfersIn += Math.abs(transaction.amount);
      }
    }
  }

  summary.income = roundMoney(summary.income);
  summary.expenses = roundMoney(summary.expenses);
  summary.transfersIn = roundMoney(summary.transfersIn);
  summary.transfersOut = roundMoney(summary.transfersOut);

  summary.netMovement = roundMoney(
    summary.income -
      summary.expenses +
      summary.transfersIn -
      summary.transfersOut,
  );

  return summary;
}

// -----------------------------------------------------------------------------
// RESUMEN INDIVIDUAL DE CUENTAS
// -----------------------------------------------------------------------------

export function getAccountSummary(
  accountId: string,
  asOfDate?: string,
): AccountSummary | null {
  if (asOfDate && !isValidDate(asOfDate)) {
    throw new Error("La fecha de corte del resumen no es válida.");
  }

  const account = getActiveAccounts().find((item) => item.id === accountId);

  if (!account) {
    return null;
  }

  const transactions = getActiveTransactions().filter(
    (transaction) => !asOfDate || transaction.date <= asOfDate,
  );

  const balance = calculateAccountBalance(account, transactions);

  const movements = getAccountMovementSummary(accountId, {
    startDate: account.openingDate,
    asOfDate,
  });

  return {
    account,
    balance: roundMoney(balance),
    movements,
  };
}

export function getAllAccountSummaries(asOfDate?: string): AccountSummary[] {
  return getActiveAccounts().map((account) => {
    return getAccountSummary(account.id, asOfDate)!;
  });
}

// -----------------------------------------------------------------------------
// UTILIDADES DE TARJETAS Y PLANES
// -----------------------------------------------------------------------------

function getCardInstallmentPlans(
  cardId: string,
  asOfDate?: string,
): InstallmentPlan[] {
  const storage = loadAccountStorage();

  if (!storage) {
    return [];
  }

  const purchases = getActivePurchases(storage.purchases, cardId, asOfDate);

  const purchaseIds = new Set(
    purchases
      .filter((purchase) => purchase.purchaseType === "installments")
      .map((purchase) => purchase.id),
  );

  return storage.installmentPlans.filter(
    (plan) => plan.status === "active" && purchaseIds.has(plan.cardPurchaseId),
  );
}

function getPlanInstallments(planIds: Set<string>): Installment[] {
  const storage = loadAccountStorage();

  if (!storage) {
    return [];
  }

  return storage.installments.filter((installment) =>
    planIds.has(installment.planId),
  );
}

function getInstallmentDebt(
  installments: Installment[],
  asOfDate?: string,
): number {
  return roundMoney(
    installments.reduce(
      (total, installment) =>
        total + getRemainingInstallmentAmountAtDate(installment, asOfDate),
      0,
    ),
  );
}

// -----------------------------------------------------------------------------
// RESUMEN INDIVIDUAL DE TARJETAS
// -----------------------------------------------------------------------------

export function getCardSummary(
  cardId: string,
  asOfDate?: string,
): CardSummary | null {
  if (asOfDate && !isValidDate(asOfDate)) {
    throw new Error("La fecha de corte del resumen no es válida.");
  }

  const storage = loadAccountStorage();

  if (!storage) {
    return null;
  }

  const card = storage.cards.find(
    (item) => item.id === cardId && item.status === "active",
  );

  if (!card) {
    return null;
  }

  const purchases = getActivePurchases(storage.purchases, cardId, asOfDate);

  const singlePurchases = purchases.filter(
    (purchase) => purchase.purchaseType === "single",
  );

  const installmentPurchases = purchases.filter(
    (purchase) => purchase.purchaseType === "installments",
  );

  const plans = getCardInstallmentPlans(cardId, asOfDate);

  const planIds = new Set(plans.map((plan) => plan.id));

  const installments = getPlanInstallments(planIds);

  const pendingInstallments = installments
    .map((installment) => ({
      installment,
      remainingAmount: getRemainingInstallmentAmountAtDate(
        installment,
        asOfDate,
      ),
    }))
    .filter((item) => item.remainingAmount > 0)
    .sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate));

  const totalPurchases = roundMoney(
    purchases.reduce((total, purchase) => total + purchase.amount, 0),
  );

  const totalSinglePurchases = roundMoney(
    singlePurchases.reduce((total, purchase) => total + purchase.amount, 0),
  );

  const singlePurchasesPaid = roundMoney(
    singlePurchases.reduce((total, purchase) => {
      const allocated = getSinglePurchaseAllocatedAmount(
        purchase.id,
        storage.cardPaymentAllocations,
        storage.cardPayments,
        asOfDate,
      );

      return total + Math.min(purchase.amount, allocated);
    }, 0),
  );

  const outstandingSinglePurchases = roundMoney(
    singlePurchases.reduce((total, purchase) => {
      const allocated = getSinglePurchaseAllocatedAmount(
        purchase.id,
        storage.cardPaymentAllocations,
        storage.cardPayments,
        asOfDate,
      );

      return total + Math.max(0, roundMoney(purchase.amount - allocated));
    }, 0),
  );

  const cardPaymentTotals = getCardPaymentTotals(
    cardId,
    storage.cardPayments,
    storage.cardPaymentAllocations,
    asOfDate,
  );

  const totalInstallmentPurchases = roundMoney(
    installmentPurchases.reduce(
      (total, purchase) => total + purchase.amount,
      0,
    ),
  );

  const outstandingInstallments = getInstallmentDebt(installments, asOfDate);

  const totalInstallmentsPaid = roundMoney(
    installments.reduce(
      (total, installment) =>
        total + getInstallmentPaidAmount(installment, asOfDate),
      0,
    ),
  );

  return {
    card,
    totalPurchases,
    totalSinglePurchases,
    outstandingSinglePurchases,
    totalSinglePurchasesPaid: singlePurchasesPaid,
    totalInstallmentPurchases,
    outstandingInstallments,
    totalInstallmentsPaid,
    totalCardPayments: cardPaymentTotals.totalPayments,
    totalCardPaymentsApplied: cardPaymentTotals.totalApplied,
    unappliedCardPayments: cardPaymentTotals.unapplied,
    nextDueDate: pendingInstallments[0]?.installment.dueDate ?? null,
    nextDueAmount: pendingInstallments[0]?.remainingAmount ?? 0,
  };
}

export function getAllCardSummaries(asOfDate?: string): CardSummary[] {
  return getActiveCards().map((card) => {
    return getCardSummary(card.id, asOfDate)!;
  });
}

// -----------------------------------------------------------------------------
// DEUDA TOTAL DE TARJETAS
// -----------------------------------------------------------------------------

export function getCreditCardDebt(cardId: string, asOfDate?: string): number {
  if (asOfDate && !isValidDate(asOfDate)) {
    throw new Error("La fecha de corte del resumen no es válida.");
  }

  const storage = loadAccountStorage();

  if (!storage) {
    return 0;
  }

  const card = storage.cards.find(
    (item) => item.id === cardId && item.status === "active",
  );

  if (!card || card.type !== "credit") {
    return 0;
  }

  const purchases = getActivePurchases(storage.purchases, cardId, asOfDate);

  const singlePurchaseDebt = roundMoney(
    purchases
      .filter((purchase) => purchase.purchaseType === "single")
      .reduce((total, purchase) => {
        const allocated = getSinglePurchaseAllocatedAmount(
          purchase.id,
          storage.cardPaymentAllocations,
          storage.cardPayments,
          asOfDate,
        );

        return total + Math.max(0, roundMoney(purchase.amount - allocated));
      }, 0),
  );

  const plans = getCardInstallmentPlans(cardId, asOfDate);

  const planIds = new Set(plans.map((plan) => plan.id));

  const installments = getPlanInstallments(planIds);

  const installmentDebt = getInstallmentDebt(installments, asOfDate);

  return roundMoney(singlePurchaseDebt + installmentDebt);
}

export function getTotalCreditCardDebt(asOfDate?: string): number {
  const creditCards = getActiveCards().filter((card) => card.type === "credit");

  return roundMoney(
    creditCards.reduce(
      (total, card) => total + getCreditCardDebt(card.id, asOfDate),
      0,
    ),
  );
}

// -----------------------------------------------------------------------------
// PRÓXIMOS VENCIMIENTOS MSI
// -----------------------------------------------------------------------------

export function getUpcomingInstallments(
  asOfDate: string = getLocalDateString(),
  limit = 10,
): UpcomingInstallment[] {
  if (!isValidDate(asOfDate)) {
    throw new Error("La fecha de consulta de vencimientos no es válida.");
  }

  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(
      "El límite de vencimientos debe ser un entero igual o mayor a cero.",
    );
  }

  if (limit === 0) {
    return [];
  }

  const storage = loadAccountStorage();

  if (!storage) {
    return [];
  }

  const results: UpcomingInstallment[] = [];

  for (const installment of storage.installments) {
    const remainingAmount = getRemainingInstallmentAmountAtDate(
      installment,
      asOfDate,
    );

    if (remainingAmount <= 0 || installment.dueDate < asOfDate) {
      continue;
    }

    const plan = storage.installmentPlans.find(
      (item) => item.id === installment.planId && item.status === "active",
    );

    if (!plan) {
      continue;
    }

    const purchase = storage.purchases.find(
      (item) =>
        item.id === plan.cardPurchaseId &&
        item.status === "active" &&
        item.purchaseType === "installments",
    );

    if (!purchase || purchase.installmentPlanId !== plan.id) {
      continue;
    }

    const card = storage.cards.find(
      (item) =>
        item.id === purchase.cardId &&
        item.status === "active" &&
        item.type === "credit",
    );

    if (!card) {
      continue;
    }

    results.push({
      installment,
      plan,
      purchase,
      card,
      remainingAmount,
    });
  }

  return results
    .sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate))
    .slice(0, limit);
}

// -----------------------------------------------------------------------------
// RESUMEN GENERAL DEL MÓDULO
// -----------------------------------------------------------------------------

export function getAccountModuleSummary(
  asOfDate?: string,
): AccountModuleSummary {
  if (asOfDate && !isValidDate(asOfDate)) {
    throw new Error("La fecha de corte del resumen no es válida.");
  }

  const accounts = getActiveAccounts();
  const cards = getActiveCards();

  const accountSummaries = accounts.map((account) =>
    getAccountSummary(account.id, asOfDate),
  );

  const movements = accountSummaries.reduce(
    (summary, accountSummary) => {
      if (!accountSummary) {
        return summary;
      }

      summary.totalIncome += accountSummary.movements.income;
      summary.totalExpenses += accountSummary.movements.expenses;
      summary.totalTransfersIn += accountSummary.movements.transfersIn;
      summary.totalTransfersOut += accountSummary.movements.transfersOut;

      return summary;
    },
    {
      totalIncome: 0,
      totalExpenses: 0,
      totalTransfersIn: 0,
      totalTransfersOut: 0,
    },
  );

  const totalAccountsBalance = roundMoney(
    accountSummaries.reduce(
      (total, summary) => total + (summary?.balance ?? 0),
      0,
    ),
  );

  const totalInstallmentDebt = roundMoney(
    cards.reduce((total, card) => {
      const summary = getCardSummary(card.id, asOfDate);

      return total + (summary?.outstandingInstallments ?? 0);
    }, 0),
  );

  return {
    totalAccountsBalance,
    totalIncome: roundMoney(movements.totalIncome),
    totalExpenses: roundMoney(movements.totalExpenses),
    totalTransfersIn: roundMoney(movements.totalTransfersIn),
    totalTransfersOut: roundMoney(movements.totalTransfersOut),
    totalCreditCardDebt: getTotalCreditCardDebt(asOfDate),
    totalInstallmentDebt,
    totalUnappliedCardPayments: roundMoney(
      cards.reduce((total, card) => {
        const summary = getCardSummary(card.id, asOfDate);
        return total + (summary?.unappliedCardPayments ?? 0);
      }, 0),
    ),
    activeAccountsCount: accounts.length,
    activeCardsCount: cards.length,
    upcomingInstallments: getUpcomingInstallments(
      asOfDate ?? getLocalDateString(),
    ),
  };
}
