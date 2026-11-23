
export type ScheduledPaymentFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "yearly";

export type ScheduledPaymentAmountType = "fixed" | "variable";

export type ScheduledPaymentStatus =
  | "active"
  | "paused"
  | "cancelled";

export type ScheduledPaymentOccurrenceStatus =
  | "pending"
  | "paid"
  | "skipped";

export interface ScheduledPayment {
  id: string;

  // Información general
  name: string;
  description: string | null;
  category: string;

  // Configuración de recurrencia
  frequency: ScheduledPaymentFrequency;
  amountType: ScheduledPaymentAmountType;

  // Para importes fijos es obligatorio.
  // Para importes variables puede ser null.
  amount: number | null;

  // Configuración de fechas
  firstDueDate: string;
  nextDueDate: string;
  endDate: string | null;

  // Cuenta sugerida para realizar el pago
  defaultAccountId: string | null;

  status: ScheduledPaymentStatus;
  notes: string | null;

  createdAt: string;
  updatedAt: string;

  cancelledAt?: string;
}

export interface ScheduledPaymentOccurrence {
  id: string;
  scheduledPaymentId: string;

  // Fecha en que debe realizarse el pago
  dueDate: string;

  // Importe previsto o importe real confirmado.
  // Puede ser null mientras sea variable y esté pendiente.
  amount: number | null;

  status: ScheduledPaymentOccurrenceStatus;

  // Información del pago confirmado
  paidAmount: number | null;
  paidAt: string | null;
  transactionId: string | null;

  createdAt: string;
  updatedAt: string;
}
