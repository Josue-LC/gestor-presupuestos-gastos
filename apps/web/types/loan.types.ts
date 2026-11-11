// loan.types.ts
export type LoanType = "personal" | "auto" | "mortgage" | "other";

export type LoanStatus = "active" | "paid" | "cancelled";

export type LoanInterestType = "fixed" | "variable";

export type LoanPaymentFrequency = "weekly" | "biweekly" | "monthly";

export type LoanAmortizationType =
  | "manual"
  | "french"
  | "german"
  | "custom";

export type LoanInstallmentStatus =
  | "pending"
  | "partial"
  | "paid"
  | "overdue";

export type LoanPaymentStatus = "completed" | "cancelled";

export type LoanPaymentMethod = "manual" | "transaction";

export interface Loan {
  id: string;
  name: string;
  institutionId: string;
  type: LoanType;
  status: LoanStatus;
  contractNumber: string | null;
  contractedAmount: number;
  principalAmount: number;
  netDisbursedAmount: number;
  openingCommission: number;
  openingInsurance: number;
  financedCharges: number;
  annualInterestRate: number;
  interestType: LoanInterestType;
  termInMonths: number;
  paymentFrequency: LoanPaymentFrequency;
  amortizationType: LoanAmortizationType;
  contractDate: string;
  disbursementDate: string;
  firstPaymentDate: string;
  endDate: string;
  receivingAccountId: string | null;
  paymentAccountId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  cancelledAt?: string;
}

export interface LoanInstallment {
  id: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  commissionAmount: number;
  insuranceAmount: number;
  totalAmount: number;
  status: LoanInstallmentStatus;
  createdAt: string;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  sourceAccountId: string | null;
  amount: number;
  paidAt: string;
  status: LoanPaymentStatus;
  method: LoanPaymentMethod;
  transactionId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface LoanPaymentAllocation {
  id: string;
  loanPaymentId: string;
  installmentId: string;
  principalAmount: number;
  interestAmount: number;
  commissionAmount: number;
  insuranceAmount: number;
  totalAmount: number;
  createdAt: string;
}
