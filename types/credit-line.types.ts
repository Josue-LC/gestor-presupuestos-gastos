
export type CreditLineStatus =
  | "active"
  | "suspended"
  | "closed";

export type CreditLineInterestType =
  | "fixed"
  | "variable";

export type CreditLineDrawdownDestination =
  | "account"
  | "external";

export type CreditLineDrawdownStatus =
  | "active"
  | "cancelled";

export type CreditLinePaymentStatus =
  | "completed"
  | "cancelled";

export type CreditLineChargeType =
  | "ordinary_interest"
  | "moratory_interest"
  | "commission"
  | "insurance"
  | "other";

// ============================================
// CREDIT LINE
// ============================================

export interface CreditLine {
  id: string;
  name: string;
  institutionId: string;

  status: CreditLineStatus;

  contractNumber: string | null;

  // Límite autorizado
  creditLimit: number;

  // Intereses
  annualInterestRate: number;
  interestType: CreditLineInterestType;

  // Configuración financiera
  interestCalculationMethod:
    | "daily_balance"
    | "average_balance"
    | "manual";

  paymentFrequency:
    | "weekly"
    | "biweekly"
    | "monthly";

  // Fechas de corte y pago
  cutoffDay: number | null;
  paymentDueDay: number | null;

  openingDate: string;
  expirationDate: string | null;

  // Cuenta bancaria habitual para pagos
  paymentAccountId: string | null;

  notes: string | null;

  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

// ============================================
// CREDIT LINE DRAWDOWN
// ============================================

export interface CreditLineDrawdown {
  id: string;
  creditLineId: string;

  description: string;

  amount: number;
  drawdownDate: string;

  // Destino de la disposición
  destinationType: CreditLineDrawdownDestination;

  // Obligatorio cuando destinationType es account.
  destinationAccountId: string | null;

  // Referencia o descripción del destino externo.
  destinationDescription: string | null;

  // Movimiento bancario generado, si corresponde.
  transactionId: string | null;

  status: CreditLineDrawdownStatus;

  notes: string | null;

  createdAt: string;
}

// ============================================
// CREDIT LINE PAYMENT
// ============================================

export interface CreditLinePayment {
  id: string;
  creditLineId: string;

  sourceAccountId: string | null;

  amount: number;
  paidAt: string;

  principalPaid: number;
  interestPaid: number;
  commissionPaid: number;
  insurancePaid: number;

  status: CreditLinePaymentStatus;

  transactionId: string | null;

  notes: string | null;

  createdAt: string;
}

// ============================================
// CREDIT LINE CHARGE
// ============================================

export interface CreditLineCharge {
  id: string;
  creditLineId: string;

  type: CreditLineChargeType;

  description: string;
  amount: number;

  chargeDate: string;

  // Indica si el cargo incrementa el saldo dispuesto.
  capitalized: boolean;

  status: "active" | "cancelled";

  createdAt: string;
}
