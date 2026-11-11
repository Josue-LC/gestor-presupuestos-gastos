
"use client";

import { useEffect, useState } from "react";

import { getActiveAccounts } from "@/services/account.service";

import {
  getAccountModuleSummary,
  getAccountMovementSummary,
} from "@/services/account-summary.service";

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

interface SummaryData {
  availableBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
}

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

function getLocalDateString(date: Date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 10);
}

function getInitialSummary(): SummaryData {
  return {
    availableBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
  };
}

// -----------------------------------------------------------------------------
// COMPONENTE
// -----------------------------------------------------------------------------

export default function SummaryCards() {
  const [summary, setSummary] = useState<SummaryData>(
    getInitialSummary,
  );

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function loadSummary() {
      try {
        const today = getLocalDateString();
        const currentDate = new Date(`${today}T12:00:00`);

        const firstDay = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1,
        );

        const startDate = getLocalDateString(firstDay);

        // Saldo actual de todas las cuentas activas.
        const accountSummary = getAccountModuleSummary(today);

        // Ingresos y gastos registrados durante el mes actual.
        const activeAccounts = getActiveAccounts();

        const monthlyMovements = activeAccounts.reduce(
          (totals, account) => {
            const movements = getAccountMovementSummary(
              account.id,
              {
                startDate,
                endDate: today,
                asOfDate: today,
              },
            );

            totals.income += movements.income;
            totals.expenses += movements.expenses;

            return totals;
          },
          {
            income: 0,
            expenses: 0,
          },
        );

        setSummary({
          availableBalance: accountSummary.totalAccountsBalance,
          monthlyIncome: monthlyMovements.income,
          monthlyExpenses: monthlyMovements.expenses,
        });
      } catch (error) {
        console.error(
          "Error al cargar el resumen financiero:",
          error,
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadSummary();
  }, []);

  const {
    availableBalance,
    monthlyIncome,
    monthlyExpenses,
  } = summary;

  return (
    <section
      aria-label="Resumen financiero"
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
    >
      {/* Saldo disponible */}
      <article className="relative flex min-h-52 flex-col justify-between overflow-hidden rounded-2xl bg-surface-card p-6 shadow-sm md:col-span-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">
              Saldo disponible
            </p>

            <p className="mt-2 text-sm text-body">
              Total de cuentas propias
            </p>
          </div>

          <span className="flex size-11 items-center justify-center rounded-full bg-surface-soft text-foreground">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              <rect x="3" y="5" width="18" height="15" rx="3" />
              <path d="M3 9h18M16 14h2" />
            </svg>
          </span>
        </div>

        <div className="relative z-10">
          <p className="break-words text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {isLoading ? "Cargando..." : formatCurrency(availableBalance)}
          </p>

          <p className="mt-3 text-xs text-muted">
            Saldo actual de tus cuentas activas
          </p>
        </div>

        <div
          aria-hidden="true"
          className="absolute -bottom-14 -right-8 size-40 rounded-full bg-brand-mint/30 blur-2xl"
        />
      </article>

      <div className="grid grid-cols-1 gap-4">
        {/* Ingresos */}
        <article className="flex flex-col justify-between rounded-2xl bg-brand-mint/40 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-body">
              Ingresos del mes
            </p>

            <span className="flex size-9 items-center justify-center rounded-full bg-surface/80 text-success">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
              >
                <path d="M7 17 17 7M7 7h10v10" />
              </svg>
            </span>
          </div>

          <p className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            {isLoading ? "Cargando..." : formatCurrency(monthlyIncome)}
          </p>

          <p className="mt-2 text-xs text-body">
            Ingresos registrados este mes
          </p>
        </article>

        {/* Gastos */}
        <article className="flex flex-col justify-between rounded-2xl bg-brand-peach/40 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-body">
              Gastos del mes
            </p>

            <span className="flex size-9 items-center justify-center rounded-full bg-surface/80 text-brand-coral">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
              >
                <path d="M7 7 17 17M7 17h10V7" />
              </svg>
            </span>
          </div>

          <p className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            {isLoading ? "Cargando..." : formatCurrency(monthlyExpenses)}
          </p>

          <p className="mt-2 text-xs text-body">
            Gastos registrados este mes
          </p>
        </article>
      </div>
    </section>
  );
}
