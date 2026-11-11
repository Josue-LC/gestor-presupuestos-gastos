
import { recentTransactions } from "@/lib/dashboard-data";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const categoryIcons: Record<string, string> = {
  "Ingreso de trabajo": "briefcase-business",
  Alimentación: "shopping-basket",
  Servicios: "receipt",
  Movilidad: "car-front",
};

function formatCurrency(amount: number) {
  return currencyFormatter.format(Math.abs(amount));
}

export default function RecentTransactions() {
  return (
    <section className="rounded-2xl bg-surface-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Movimientos recientes
          </h2>

          <p className="mt-1 text-xs text-muted">
            Últimos ingresos y gastos registrados
          </p>
        </div>

        <button
          type="button"
          className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-container-high"
        >
          Ver todos
        </button>
      </div>

      <div className="divide-y divide-hairline">
        {recentTransactions.map((transaction) => {
          const isIncome = transaction.type === "income";

          return (
            <article
              key={transaction.id}
              className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                  isIncome ? "bg-brand-mint/40" : "bg-surface-container-high"
                }`}
              >
                {isIncome ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5 text-success"
                  >
                    <path d="M7 17 17 7M7 7h10v10" />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5 text-muted"
                  >
                    <path d="M12 3v18M5 10l7-7 7 7" />
                  </svg>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {transaction.description}
                </p>

                <p className="mt-1 truncate text-xs text-muted">
                  {transaction.category} · {transaction.account}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    isIncome ? "text-success" : "text-foreground"
                  }`}
                >
                  {isIncome ? "+" : "−"}
                  {formatCurrency(transaction.amount)}
                </p>

                <p className="mt-1 text-xs text-muted">
                  {transaction.date}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 border-t border-hairline pt-4">
        <p className="text-xs text-muted">
          Datos ilustrativos · No representan movimientos reales.
        </p>
      </div>
    </section>
  );
}
