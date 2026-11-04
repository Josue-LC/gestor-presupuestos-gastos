
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

export type CardPurchaseStatus = "active" | "cancelled";

export type InstallmentPlanStatus =
  | "active"
  | "completed"
  | "cancelled";

export type InstallmentStatus = "pending" | "partial" | "paid";

export type InstallmentPaymentMethod = "manual" | "transaction";

// Modalidad de distribución del pago global.
export type CardPaymentAllocationMode = "automatic" | "manual";

// Tipo de deuda a la que se aplica un pago.
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

  // Para tarjetas de débito.
  linkedAccountId: string | null;

  // Cuenta desde la que normalmente se paga
  // la tarjeta de crédito.
  paymentAccountId: string | null;

  // Propiedades exclusivas de tarjetas de crédito.
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

  // Configuración de MSI.
  // Son null cuando la compra es de una sola exhibición.
  installmentCount: number | null;
  firstDueDate: string | null;

  status: CardPurchaseStatus;

  // Referencia al plan MSI asociado.
  installmentPlanId: string | null;

  createdAt: string;
}

// ============================================
// INSTALLMENT PLAN
// ============================================

export interface InstallmentPlan {
  id: string;
  cardPurchaseId: string;

  totalAmount: number;
  installmentCount: number;

  // Fecha de vencimiento de la primera mensualidad.
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

  // Transferencia que representa la salida real
  // de dinero desde una cuenta hacia la tarjeta.
  transactionId: string;

  amount: number;
  paidAt: string;

  // Cómo se distribuyó el importe entre las deudas.
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

  // Se utiliza cuando el pago cubre una compra
  // de una sola exhibición.
  purchaseId: string | null;

  // Se utiliza cuando el pago cubre una parcialidad MSI.
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
