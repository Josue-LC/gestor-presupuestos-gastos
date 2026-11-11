// account.ts
export type AccountType =
  | "checking"
  | "savings"
  | "cash"
  | "investment"
  | "other";

export type AccountStatus = "active" | "archived";
export type CardType = "debit" | "credit";
export type CardStatus = "active" | "archived";

export type CardPurchaseType = "single" | "installments";

export type InstallmentInterestType =
  | "none"
  | "fixed"
  | "annual_rate";

export type CardPurchaseStatus = "active" | "cancelled";

export type InstallmentPlanStatus =
  | "active"
  | "completed"
  | "cancelled";

export type InstallmentStatus = "pending" | "partial" | "paid";

export type InstallmentPaymentMethod = "manual" | "transaction";

export type CardPaymentAllocationMode = "automatic" | "manual";

export type CardPaymentAllocationType =
  | "single_purchase"
  | "installment";

// ============================================
// BANK
// ============================================

export interface Bank {
  id: string;
  name: string;
  isCustom: boolean;
  createdAt: string;
}

// ============================================
// ACCOUNT
// ============================================

export interface Account {
  id: string;
  name: string;
  bankId: string | null;
  type: AccountType;
  currency: "MXN";
  openingBalance: number;
  openingDate: string;
  status: AccountStatus;
  createdAt: string;
  archivedAt?: string;
}

// ============================================
// CARD
// ============================================

export interface BankCard {
  id: string;
  name: string;
  bankId: string;
  type: CardType;

  linkedAccountId: string | null;
  paymentAccountId: string | null;

  creditLimit: number | null;
  cutoffDay: number | null;
  paymentDueDay: number | null;

  status: CardStatus;
  createdAt: string;
  archivedAt?: string;
}

// ============================================
// CARD PURCHASE
// ============================================

export interface CardPurchase {
  id: string;
  cardId: string;
  transactionId: string;

  description: string;
  amount: number;
  purchaseDate: string;

  purchaseType: CardPurchaseType;

  installmentCount: number | null;
  firstDueDate: string | null;

  // Configuración de intereses.
  // none: MSI.
  // fixed: importe total de intereses capturado.
  // annual_rate: tasa anual nominal.
  interestType: InstallmentInterestType;
  interestAmount: number;
  annualInterestRate: number | null;

  status: CardPurchaseStatus;
  installmentPlanId: string | null;

  createdAt: string;
}

// ============================================
// INSTALLMENT PLAN
// ============================================

export interface InstallmentPlan {
  id: string;
  cardPurchaseId: string;

  // Configuración de intereses.
  interestType: InstallmentInterestType;
  annualInterestRate: number | null;

  // Importes del financiamiento.
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;

  installmentCount: number;
  firstDueDate: string;

  status: InstallmentPlanStatus;

  createdAt: string;
  cancelledAt?: string;
}

// ============================================
// INSTALLMENT
// ============================================

export interface Installment {
  id: string;
  planId: string;

  installmentNumber: number;
  dueDate: string;

  principalAmount: number;
  interestAmount: number;
  amount: number;

  paidAmount: number;
  status: InstallmentStatus;

  payments: InstallmentPayment[];

  createdAt: string;
}

// ============================================
// CARD PAYMENT
// ============================================

export interface CardPayment {
  id: string;
  cardId: string;
  transactionId: string;

  amount: number;
  paidAt: string;

  allocationMode: CardPaymentAllocationMode;

  createdAt: string;
}

// ============================================
// CARD PAYMENT ALLOCATION
// ============================================

export interface CardPaymentAllocation {
  id: string;
  cardPaymentId: string;

  type: CardPaymentAllocationType;

  purchaseId: string | null;
  installmentId: string | null;

  amount: number;
  createdAt: string;
}

// ============================================
// INSTALLMENT PAYMENT
// ============================================

export interface InstallmentPayment {
  id: string;
  installmentId: string;

  amount: number;
  paidAt: string;

  method: InstallmentPaymentMethod;

  transactionId: string | null;

  cardPaymentId?: string;
}
