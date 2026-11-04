
import { dashboardSummary } from "@/lib/dashboard-data";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

export default function SummaryCards() {
  const { availableBalance, monthlyIncome, monthlyExpenses } =
    dashboardSummary;

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
            {formatCurrency(availableBalance)}
          </p>

          <p className="mt-3 text-xs text-muted">
            Importe ilustrativo · Datos de demostración
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
            {formatCurrency(monthlyIncome)}
          </p>

          <p className="mt-2 text-xs text-body">
            Según los datos de demostración
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
            {formatCurrency(monthlyExpenses)}
          </p>

          <p className="mt-2 text-xs text-body">
            Según los datos de demostración
          </p>
        </article>
      </div>
    </section>
  );
}
