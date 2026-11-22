
"use client";

import { useMemo, useState } from "react";
import type {
  CalendarEvent,
  CalendarEventStatus,
  CalendarEventType,
} from "@/types/calendar.types";
import {
  formatCalendarDate,
  getEventsByMonth,
  getEventsForDate,
  getEventTotals,
  getLocalDateKey,
  getMonthDays,
  getNextEvents,
  parseLocalDate,
} from "./utils/calendar.utils";
import styles from "./calendar.module.scss";

interface CalendarViewProps {
  events?: CalendarEvent[];
}

const EMPTY_EVENTS: CalendarEvent[] = [];

const WEEK_DAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  "scheduled-payment": "Gasto recurrente",
  installment: "Compra a MSI",
  loan: "Préstamo",
  "credit-card": "Tarjeta de crédito",
};

const EVENT_STATUS_LABELS: Record<CalendarEventStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  overdue: "Vencido",
  skipped: "Omitido",
};

const EVENT_TYPE_STYLES: Record<CalendarEventType, string> = {
  "scheduled-payment": styles.eventRecurring,
  installment: styles.eventInstallment,
  loan: styles.eventLoan,
  "credit-card": styles.eventCreditCard,
};

const EVENT_STATUS_STYLES: Record<CalendarEventStatus, string> = {
  pending: styles.statusPending,
  paid: styles.statusPaid,
  overdue: styles.statusOverdue,
  skipped: styles.statusSkipped,
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return formatCalendarDate(date, options);
}

function getEventTypeLabel(type: CalendarEventType): string {
  return EVENT_TYPE_LABELS[type];
}

function getEventStatusLabel(status: CalendarEventStatus): string {
  return EVENT_STATUS_LABELS[status];
}

export default function CalendarView({
  events = EMPTY_EVENTS,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const days = useMemo(
    () => getMonthDays(currentDate, events),
    [currentDate, events],
  );

  const monthEvents = useMemo(
    () => getEventsByMonth(events, currentDate),
    [events, currentDate],
  );

  const monthTotals = useMemo(
    () => getEventTotals(monthEvents),
    [monthEvents],
  );

  const selectedEvents = useMemo(
    () => getEventsForDate(events, selectedDate),
    [events, selectedDate],
  );

  const selectedTotals = useMemo(
    () => getEventTotals(selectedEvents),
    [selectedEvents],
  );

  const nextEvents = useMemo(
    () => getNextEvents(events, 5),
    [events],
  );

  const calendarTitle = formatDate(currentDate, {
    month: "long",
    year: "numeric",
  });

  const selectedDateLabel = formatDate(selectedDate, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const goToPreviousMonth = () => {
    setCurrentDate(
      (previousDate) =>
        new Date(
          previousDate.getFullYear(),
          previousDate.getMonth() - 1,
          1,
        ),
    );
  };

  const goToNextMonth = () => {
    setCurrentDate(
      (previousDate) =>
        new Date(
          previousDate.getFullYear(),
          previousDate.getMonth() + 1,
          1,
        ),
    );
  };

  const goToToday = () => {
    const today = new Date();

    setCurrentDate(today);
    setSelectedDate(today);
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);

    if (
      date.getMonth() !== currentDate.getMonth() ||
      date.getFullYear() !== currentDate.getFullYear()
    ) {
      setCurrentDate(
        new Date(date.getFullYear(), date.getMonth(), 1),
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Calendario
        </h1>

        <p className="mt-1 text-sm text-muted">
          Visualiza y organiza tus próximos compromisos financieros.
        </p>
      </div>

      {/* Resumen general */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Compromisos del mes"
          value={String(monthTotals.total)}
          description="Pagos programados"
          icon="calendar"
        />

        <SummaryCard
          label="Por pagar"
          value={formatCurrency(
            monthTotals.pendingAmount + monthTotals.overdueAmount,
          )}
          description={`${monthTotals.pending + monthTotals.overdue} compromisos pendientes`}
          icon="wallet"
        />

        <SummaryCard
          label="Pagos realizados"
          value={String(monthTotals.paid)}
          description={`De ${monthTotals.total} compromisos`}
          icon="check"
        />
      </div>

      {/* Calendario y panel lateral */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-hairline bg-surface-card">
          {/* Toolbar */}
          <div className="flex flex-col gap-4 border-b border-hairline p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={goToPreviousMonth}
                  aria-label="Mes anterior"
                  className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-container-high hover:text-foreground"
                >
                  <ChevronLeft />
                </button>

                <button
                  type="button"
                  onClick={goToNextMonth}
                  aria-label="Mes siguiente"
                  className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-container-high hover:text-foreground"
                >
                  <ChevronRight />
                </button>
              </div>

              <h2 className="min-w-[180px] text-lg font-bold capitalize text-foreground">
                {calendarTitle}
              </h2>

              <button
                type="button"
                onClick={goToToday}
                className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-container-high"
              >
                Hoy
              </button>
            </div>

            <div className="text-xs font-medium text-muted">
              {monthTotals.total} compromisos este mes
            </div>
          </div>

          {/* Cuadrícula */}
          <div className={styles.calendarWrapper}>
            <div className={styles.weekdays}>
              {WEEK_DAYS.map((day) => (
                <div key={day} className={styles.weekday}>
                  {day}
                </div>
              ))}
            </div>

            <div className={styles.daysGrid}>
              {days.map((day) => {
                const isSelected =
                  getLocalDateKey(selectedDate) === day.dateKey;

                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => selectDate(day.date)}
                    aria-label={formatDate(day.date, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    aria-pressed={isSelected}
                    className={[
                      styles.dayCell,
                      !day.isCurrentMonth ? styles.otherMonth : "",
                      day.isToday ? styles.today : "",
                      isSelected ? styles.selectedDay : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className={styles.dayNumber}>
                      {day.date.getDate()}
                    </span>

                    <div className={styles.dayEvents}>
                      {day.events.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className={[
                            styles.event,
                            EVENT_TYPE_STYLES[event.type],
                            event.status === "skipped"
                              ? styles.eventSkipped
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          title={`${event.title} · ${getEventStatusLabel(event.status)}`}
                        >
                          <span className={styles.eventTitle}>
                            {event.title}
                          </span>
                        </span>
                      ))}

                      {day.events.length > 3 && (
                        <span className={styles.moreEvents}>
                          +{day.events.length - 3} más
                        </span>
                      )}
                    </div>

                    {day.events.length > 0 && (
                      <span className={styles.mobileEventCount}>
                        {day.events.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Panel lateral */}
        <aside className="flex min-w-0 flex-col gap-4">
          {/* Resumen del día */}
          <section className="rounded-2xl border border-hairline bg-surface-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-foreground">
                Resumen del día
              </h3>

              <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-medium text-muted">
                {formatDate(selectedDate, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>

            <p className="mt-2 text-sm capitalize text-muted">
              {selectedDateLabel}
            </p>

            <div className="mt-5 rounded-xl bg-surface-container-low p-4">
              <p className="text-xs font-medium text-muted">
                Importe pendiente
              </p>

              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatCurrency(
                  selectedTotals.pendingAmount +
                    selectedTotals.overdueAmount,
                )}
              </p>

              <p className="mt-1 text-xs text-muted">
                {selectedTotals.pending + selectedTotals.overdue} pagos por
                atender
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <SummaryRow
                label="Pendientes"
                value={selectedTotals.pending}
              />

              <SummaryRow
                label="Realizados"
                value={selectedTotals.paid}
              />

              <SummaryRow
                label="Vencidos"
                value={selectedTotals.overdue}
              />

              {selectedTotals.skipped > 0 && (
                <SummaryRow
                  label="Omitidos"
                  value={selectedTotals.skipped}
                />
              )}
            </div>

            <div className="mt-5 border-t border-hairline pt-4">
              <h4 className="mb-3 text-sm font-semibold text-foreground">
                Compromisos del día
              </h4>

              {selectedEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedEvents.map((event) => (
                    <EventDetail key={event.id} event={event} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Sin compromisos"
                  description="No tienes pagos programados para este día."
                />
              )}
            </div>
          </section>

          {/* Próximos compromisos */}
          <section className="rounded-2xl border border-hairline bg-surface-card p-5">
            <h3 className="font-bold text-foreground">
              Próximos compromisos
            </h3>

            <p className="mt-1 text-xs text-muted">
              Tus siguientes fechas de pago.
            </p>

            {nextEvents.length > 0 ? (
              <div className="mt-4 space-y-4">
                {nextEvents.map((event) => {
                  const eventDate = parseLocalDate(event.date);

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => selectDate(eventDate)}
                      className={styles.nextEvent}
                    >
                      <span
                        className={[
                          styles.nextEventIndicator,
                          EVENT_TYPE_STYLES[event.type],
                        ].join(" ")}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {event.title}
                        </span>

                        <span className="mt-1 block text-xs capitalize text-muted">
                          {formatDate(eventDate, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </span>

                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold text-foreground">
                          {event.amount !== null
                            ? formatCurrency(event.amount)
                            : "—"}
                        </span>

                        <span
                          className={[
                            "mt-1 block text-[11px]",
                            EVENT_STATUS_STYLES[event.status],
                          ].join(" ")}
                        >
                          {getEventStatusLabel(event.status)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Sin compromisos próximos"
                description="Cuando conectemos tus módulos financieros, aparecerán aquí tus próximos pagos."
              />
            )}
          </section>

          {/* Leyenda */}
          <section className="rounded-2xl border border-hairline bg-surface-card p-5">
            <h3 className="font-bold text-foreground">
              Tipos de compromisos
            </h3>

            <div className="mt-4 space-y-3">
              <LegendItem
                color="bg-emerald-500"
                label="Gastos recurrentes"
              />

              <LegendItem
                color="bg-blue-500"
                label="Compras a MSI"
              />

              <LegendItem
                color="bg-violet-500"
                label="Préstamos"
              />

              <LegendItem
                color="bg-orange-500"
                label="Tarjetas de crédito"
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: "calendar" | "wallet" | "check";
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>

        <span className="flex size-10 items-center justify-center rounded-xl bg-surface-container-low text-muted">
          {icon === "calendar" && <CalendarIcon />}
          {icon === "wallet" && <WalletIcon />}
          {icon === "check" && <CheckIcon />}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>

      <p className="mt-1 text-xs text-muted">{description}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>

      <span className="text-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

function EventDetail({ event }: { event: CalendarEvent }) {
  return (
    <div className={styles.eventDetail}>
      <div
        className={[
          styles.eventDetailIndicator,
          EVENT_TYPE_STYLES[event.type],
        ].join(" ")}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {event.title}
        </p>

        <p className="mt-1 text-xs text-muted">
          {getEventTypeLabel(event.type)}
        </p>

        {event.description && (
          <p className="mt-1 text-xs text-muted">
            {event.description}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-foreground">
          {event.amount !== null ? formatCurrency(event.amount) : "—"}
        </p>

        <span
          className={[
            "mt-1 block text-[11px] font-medium",
            EVENT_STATUS_STYLES[event.status],
          ].join(" ")}
        >
          {getEventStatusLabel(event.status)}
        </span>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-7 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-container-low text-muted">
        <CalendarIcon />
      </span>

      <p className="text-sm font-medium text-foreground">{title}</p>

      <p className="mt-1 max-w-[230px] text-xs text-muted">
        {description}
      </p>
    </div>
  );
}

function LegendItem({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`size-2.5 rounded-full ${color}`} />
      <span className="text-sm text-body">{label}</span>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-5"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-5"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <rect x="3" y="6" width="18" height="15" rx="3" />
      <path d="M3 10h18M16 15h2M7 6V4h11" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}
