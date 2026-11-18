
export type CalendarEventType =
  | "scheduled-payment"
  | "installment"
  | "loan"
  | "credit-card";

export type CalendarEventStatus =
  | "pending"
  | "paid"
  | "overdue"
  | "skipped";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  amount: number | null;
  type: CalendarEventType;
  status: CalendarEventStatus;
  sourceId: string;
  description?: string | null;
}

export interface CalendarDay {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}
