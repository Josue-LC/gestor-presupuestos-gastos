
import type { TransactionType } from "@/components/transactions/TransactionList";

export type TransactionAuditAction =
  | "created"
  | "updated"
  | "cancelled"
  | "restored"
  | "removed";

export type TransactionAuditField =
  | "description"
  | "amount"
  | "type"
  | "category"
  | "account"
  | "date"
  | "registeredAt"
  | "status"
  | "cancellationReason";

export interface TransactionAuditChange {
  field: TransactionAuditField;
  previousValue: string | number | null;
  newValue: string | number | null;
}

export interface TransactionAuditEvent {
  id: string;
  transactionId: string;
  action: TransactionAuditAction;
  timestamp: string;
  actor: string;
  reason?: string;
  changes: TransactionAuditChange[];
}

export interface TransactionAuditSnapshot {
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  account: string;
  date: string;
  registeredAt: string | null;
  status: "active" | "cancelled";
  cancellationReason: string | null;
}
