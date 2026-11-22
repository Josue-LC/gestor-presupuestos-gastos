
import type {
  CalendarDay,
  CalendarEvent,
} from "@/types/calendar.types";

const WEEK_LENGTH = 7;
const CALENDAR_LENGTH = 42;

/**
 * Convierte una fecha a formato YYYY-MM-DD
 * utilizando la fecha local del navegador.
 */
export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Convierte YYYY-MM-DD a una fecha local.
 * Evita los problemas de zona horaria de new Date("YYYY-MM-DD").
 */
export function parseLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Date(year, month - 1, day);
}

/**
 * Formatea una fecha utilizando la configuración regional es-MX.
 */
export function formatCalendarDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("es-MX", options).format(date);
}

/**
 * Comprueba si dos fechas corresponden al mismo día.
 */
export function isSameCalendarDate(
  firstDate: Date,
  secondDate: Date,
): boolean {
  return getLocalDateKey(firstDate) === getLocalDateKey(secondDate);
}

/**
 * Genera los 42 días que conforman la cuadrícula mensual.
 * La semana comienza en lunes.
 */
export function getMonthDays(
  currentDate: Date,
  events: CalendarEvent[],
): CalendarDay[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);

  // JavaScript: domingo = 0.
  // Calendario: lunes = 0.
  const firstWeekday = (firstDayOfMonth.getDay() + 6) % WEEK_LENGTH;

  const calendarStart = new Date(year, month, 1 - firstWeekday);

  const todayKey = getLocalDateKey(new Date());
  const eventsByDate = getEventsByDate(events);

  return Array.from({ length: CALENDAR_LENGTH }, (_, index) => {
    const date = new Date(
      calendarStart.getFullYear(),
      calendarStart.getMonth(),
      calendarStart.getDate() + index,
    );

    const dateKey = getLocalDateKey(date);

    return {
      date,
      dateKey,
      isCurrentMonth: date.getMonth() === month,
      isToday: dateKey === todayKey,
      events: eventsByDate[dateKey] ?? [],
    };
  });
}

/**
 * Agrupa los compromisos por fecha.
 */
export function getEventsByDate(
  events: CalendarEvent[],
): Record<string, CalendarEvent[]> {
  return events.reduce<Record<string, CalendarEvent[]>>(
    (result, event) => {
      if (!result[event.date]) {
        result[event.date] = [];
      }

      result[event.date].push(event);

      return result;
    },
    {},
  );
}

/**
 * Obtiene los compromisos correspondientes al mes seleccionado.
 */
export function getEventsByMonth(
  events: CalendarEvent[],
  currentDate: Date,
): CalendarEvent[] {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  return events.filter((event) => {
    const eventDate = parseLocalDate(event.date);

    return (
      eventDate.getFullYear() === year &&
      eventDate.getMonth() === month
    );
  });
}

/**
 * Calcula los totales y cantidades según el estado de los compromisos.
 */
export function getEventTotals(events: CalendarEvent[]) {
  const activeEvents = events.filter(
    (event) => event.status !== "skipped",
  );

  const pendingEvents = activeEvents.filter(
    (event) => event.status === "pending",
  );

  const paidEvents = activeEvents.filter(
    (event) => event.status === "paid",
  );

  const overdueEvents = activeEvents.filter(
    (event) => event.status === "overdue",
  );

  const pendingAmount = pendingEvents.reduce(
    (total, event) => total + (event.amount ?? 0),
    0,
  );

  const paidAmount = paidEvents.reduce(
    (total, event) => total + (event.amount ?? 0),
    0,
  );

  const overdueAmount = overdueEvents.reduce(
    (total, event) => total + (event.amount ?? 0),
    0,
  );

  return {
    total: activeEvents.length,
    pending: pendingEvents.length,
    paid: paidEvents.length,
    overdue: overdueEvents.length,
    skipped: events.length - activeEvents.length,
    pendingAmount,
    paidAmount,
    overdueAmount,
    totalAmount: activeEvents.reduce(
      (total, event) => total + (event.amount ?? 0),
      0,
    ),
  };
}

/**
 * Obtiene los siguientes compromisos a partir del día actual.
 */
export function getNextEvents(
  events: CalendarEvent[],
  limit = 5,
): CalendarEvent[] {
  const todayKey = getLocalDateKey(new Date());

  return events
    .filter(
      (event) =>
        event.status !== "skipped" &&
        event.date >= todayKey,
    )
    .sort((first, second) => {
      const dateComparison = first.date.localeCompare(second.date);

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return first.title.localeCompare(second.title);
    })
    .slice(0, limit);
}

/**
 * Obtiene los compromisos de una fecha específica.
 * Incluye los omitidos para poder mostrarlos en el resumen.
 */
export function getEventsForDate(
  events: CalendarEvent[],
  date: Date,
): CalendarEvent[] {
  const dateKey = getLocalDateKey(date);

  return events
    .filter((event) => event.date === dateKey)
    .sort((first, second) => first.title.localeCompare(second.title));
}
