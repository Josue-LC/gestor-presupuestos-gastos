
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  ScheduledPayment,
  ScheduledPaymentOccurrence,
} from "@/types/scheduled-payment.types";

import {
  generateScheduledOccurrences,
  getScheduledPayments,
  getScheduledPaymentOccurrences,
} from "@/services/scheduled-payment.service";

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

interface UpcomingPayment {
  payment: ScheduledPayment;
  occurrence: ScheduledPaymentOccurrence;
}

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

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

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);

  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

function getFrequencyLabel(
  frequency: ScheduledPayment["frequency"],
): string {
  const labels: Record<ScheduledPayment["frequency"], string> = {
    weekly: "Semanal",
    biweekly: "Quincenal",
    monthly: "Mensual",
    bimonthly: "Bimestral",
    quarterly: "Trimestral",
    yearly: "Anual",
  };

  return labels[frequency];
}

// -----------------------------------------------------------------------------
// COMPONENTE
// -----------------------------------------------------------------------------

export default function UpcomingScheduledPayments() {
  const [upcomingPayments, setUpcomingPayments] = useState<
    UpcomingPayment[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const today = getLocalDateString();
      const generationLimit = addDays(today, 90);

      // Generar vencimientos para pagos activos.
      // Esta operación no crea transacciones ni modifica saldos.
      const currentPayments = getScheduledPayments();

      currentPayments
        .filter((payment) => payment.status === "active")
        .forEach((payment) => {
          generateScheduledOccurrences(
            payment.id,
            generationLimit,
          );
        });

      // Consultar la información actualizada.
      const payments = getScheduledPayments();
      const occurrences = getScheduledPaymentOccurrences();

      const paymentsMap = new Map(
        payments.map((payment) => [payment.id, payment]),
      );

      const pendingPayments: UpcomingPayment[] = occurrences
        .filter((occurrence) => {
          if (occurrence.status !== "pending") return false;

          const payment = paymentsMap.get(
            occurrence.scheduledPaymentId,
          );

          // No mostrar pagos cancelados.
          return payment !== undefined && payment.status !== "cancelled";
        })
        .map((occurrence) => ({
          payment: paymentsMap.get(
            occurrence.scheduledPaymentId,
          )!,
          occurrence,
        }))
        .sort((a, b) =>
          a.occurrence.dueDate.localeCompare(b.occurrence.dueDate),
        )
        .slice(0, 5);

      setUpcomingPayments(pendingPayments);
    } catch (error) {
      console.error(
        "Error al cargar los próximos pagos recurrentes:",
        error,
      );

      setUpcomingPayments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const today = getLocalDateString();

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-hairline bg-surface-card">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 border-b border-hairline px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-5"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="16"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path
                  d="M16 3v4M8 3v4M3 10h18"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <path
                  d="M8 14h3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div>
              <h2 className="font-semibold text-foreground">
                Próximos pagos
              </h2>

              <p className="mt-0.5 text-xs text-muted">
                Tus próximos vencimientos recurrentes
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/scheduled-payments"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:opacity-75"
        >
          Ver todos

          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="size-4"
            aria-hidden="true"
          >
            <path
              d="M5 12h14m-6-6 6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>

      {/* Contenido */}
      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="size-6 animate-spin rounded-full border-2 border-hairline border-t-primary" />
          </div>
        ) : upcomingPayments.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-container-low text-muted">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-6"
                aria-hidden="true"
              >
                <path
                  d="M8 12.5 10.5 15 16 9.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
            </div>

            <h3 className="mt-4 text-sm font-semibold text-foreground">
              No tienes pagos pendientes
            </h3>

            <p className="mt-1 max-w-xs text-xs leading-5 text-muted">
              Cuando tengas vencimientos recurrentes pendientes,
              aparecerán aquí.
            </p>

            <Link
              href="/scheduled-payments"
              className="mt-4 text-sm font-semibold text-primary hover:opacity-75"
            >
              Administrar pagos recurrentes
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {upcomingPayments.map(({ payment, occurrence }) => {
              const isOverdue = occurrence.dueDate < today;
              const isToday = occurrence.dueDate === today;

              const amount =
                occurrence.amount ?? payment.amount;

              return (
                <Link
                  key={occurrence.id}
                  href={`/scheduled-payments/${payment.id}`}
                  className="group flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        isOverdue
                          ? "bg-red-500/10 text-red-500"
                          : isToday
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-surface-container-low text-muted"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="size-5"
                        aria-hidden="true"
                      >
                        <rect
                          x="3"
                          y="5"
                          width="18"
                          height="16"
                          rx="3"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                        <path
                          d="M16 3v4M8 3v4M3 10h18"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                        {payment.name}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{payment.category}</span>

                        <span aria-hidden="true">·</span>

                        <span>
                          {getFrequencyLabel(payment.frequency)}
                        </span>

                        {payment.status === "paused" && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-600">
                              Pausado
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 pl-[52px] sm:justify-end sm:pl-0">
                    <div className="text-left sm:text-right">
                      <p
                        className={`text-xs font-medium ${
                          isOverdue
                            ? "text-red-500"
                            : isToday
                              ? "text-amber-600"
                              : "text-muted"
                        }`}
                      >
                        {isOverdue
                          ? "Vencido"
                          : isToday
                            ? "Vence hoy"
                            : formatDate(occurrence.dueDate)}
                      </p>

                      <p className="mt-1 text-sm font-bold tabular-nums text-foreground">
                        {amount !== null
                          ? formatCurrency(amount)
                          : "Por definir"}
                      </p>
                    </div>

                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-primary"
                      aria-hidden="true"
                    >
                      <path
                        d="m9 18 6-6-6-6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
