
import type {
  CalendarEvent,
  CalendarEventStatus,
} from "@/types/calendar.types";

import {
  getScheduledPayments,
  getScheduledPaymentOccurrences,
  generateScheduledOccurrences,
} from "@/services/scheduled-payment.service";

const GENERATION_DAYS = 90;

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  date.setDate(date.getDate() + days);

  return getLocalDateString(date);
}

export function getCalendarEvents(): CalendarEvent[] {
  const today = getLocalDateString();
  const generationLimit = addDays(today, GENERATION_DAYS);

  // Generar vencimientos solamente para programaciones activas.
  // El servicio evita duplicados y no crea transacciones.
  const payments = getScheduledPayments();

  payments
    .filter((payment) => payment.status === "active")
    .forEach((payment) => {
      generateScheduledOccurrences(payment.id, generationLimit);
    });

  // Volver a consultar después de generar las ocurrencias.
  const currentPayments = getScheduledPayments();
  const occurrences = getScheduledPaymentOccurrences();

  const paymentsById = new Map(
    currentPayments.map((payment) => [payment.id, payment]),
  );

  return occurrences
    .map((occurrence): CalendarEvent | null => {
      const payment = paymentsById.get(occurrence.scheduledPaymentId);

      if (!payment) return null;

      let status: CalendarEventStatus = occurrence.status;

      // Un vencimiento pendiente anterior a hoy se considera vencido.
      if (status === "pending" && occurrence.dueDate < today) {
        status = "overdue";
      }

      return {
        id: occurrence.id,
        title: payment.name,
        date: occurrence.dueDate,
        amount: occurrence.amount ?? payment.amount,
        type: "scheduled-payment",
        status,
        sourceId: payment.id,
        description: payment.description,
      };
    })
    .filter((event): event is CalendarEvent => event !== null);
}
