
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import SummaryCards from "@/components/dashboard/SummaryCards";
import ActiveBudgets from "@/components/dashboard/ActiveBudgets";
import CashFlowChart from "@/components/charts/CashFlowChart";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import SavingsGoals from "@/components/dashboard/SavingGoals";

import { getActiveAccounts } from "@/services/account.service";

import type { Account } from "@/types/account";

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      setAccounts(getActiveAccounts());
    } catch (error) {
      console.error("Error al consultar las cuentas activas:", error);
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasActiveAccounts = accounts.length > 0;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="rounded-2xl border border-hairline bg-surface-card px-6 py-16 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-hairline border-t-primary" />

          <p className="mt-4 text-sm text-muted">
            Preparando tu información financiera...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // ESTADO INICIAL: SIN CUENTAS ACTIVAS
  // ---------------------------------------------------------------------------

  if (!hasActiveAccounts) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8">
        {/* Encabezado */}
        <section className="pt-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Tablero personal
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Comencemos a organizar tu dinero.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Configura tu primera cuenta para comenzar a registrar tus
            ingresos, gastos, transferencias y administrar tus finanzas
            personales.
          </p>
        </section>

        {/* Estado inicial */}
        <section className="relative overflow-hidden rounded-3xl border border-hairline bg-surface-card p-6 sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
            {/* Icono */}
            <div className="flex size-16 items-center justify-center rounded-2xl bg-surface-container-low text-foreground">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-8"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="15"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M3 9h18M16 14h2M7 5V3h10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <span className="mt-6 rounded-full bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-muted">
              Configuración inicial
            </span>

            <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Todavía no tienes cuentas registradas
            </h2>

            <p className="mt-3 text-sm leading-6 text-muted">
              Tu información financiera aparecerá aquí una vez que registres
              tu primera cuenta. Puedes comenzar con una cuenta bancaria,
              una cuenta de ahorro o incluso efectivo.
            </p>

            <Link
              href="/accounts"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-neutral-800 sm:w-auto"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-5"
                aria-hidden="true"
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>

              Crear mi primera cuenta
            </Link>

            <p className="mt-4 text-xs text-muted">
              Podrás modificar tus cuentas y configuración posteriormente.
            </p>
          </div>
        </section>

        {/* Pasos iniciales */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-hairline bg-surface-card p-5">
            <span className="text-xs font-bold text-muted">01</span>

            <h3 className="mt-3 font-semibold text-foreground">
              Registra tus cuentas
            </h3>

            <p className="mt-2 text-sm leading-6 text-muted">
              Agrega tus cuentas bancarias y define sus saldos iniciales.
            </p>
          </article>

          <article className="rounded-2xl border border-hairline bg-surface-card p-5">
            <span className="text-xs font-bold text-muted">02</span>

            <h3 className="mt-3 font-semibold text-foreground">
              Registra tus movimientos
            </h3>

            <p className="mt-2 text-sm leading-6 text-muted">
              Organiza tus ingresos, gastos y transferencias entre cuentas.
            </p>
          </article>

          <article className="rounded-2xl border border-hairline bg-surface-card p-5">
            <span className="text-xs font-bold text-muted">03</span>

            <h3 className="mt-3 font-semibold text-foreground">
              Consulta tus finanzas
            </h3>

            <p className="mt-2 text-sm leading-6 text-muted">
              Visualiza tus saldos, flujo de efectivo, presupuestos y metas.
            </p>
          </article>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // DASHBOARD: CON CUENTAS ACTIVAS
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      {/* Encabezado */}
      <section className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Tablero personal
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Tu dinero, en perspectiva.
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Consulta tus saldos y entiende cómo se distribuyen tus ingresos
            y gastos.
          </p>
        </div>

        <span className="w-fit rounded-full bg-surface-card px-4 py-2 text-xs font-medium text-muted">
          {accounts.length} {accounts.length === 1 ? "cuenta activa" : "cuentas activas"}
        </span>
      </section>

      {/* Resumen financiero */}
      <SummaryCards />

      {/* Flujo de efectivo y presupuestos */}
      <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <CashFlowChart />
        </div>

        <div className="min-w-0">
          <ActiveBudgets />
        </div>
      </section>

      {/* Movimientos recientes y metas de ahorro */}
      <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <RecentTransactions />
        </div>

        <div className="min-w-0">
          <SavingsGoals />
        </div>
      </section>
    </div>
  );
}
