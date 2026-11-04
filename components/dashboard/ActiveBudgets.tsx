
import { activeBudgets } from "@/lib/dashboard-data";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const progressColors = {
  lavender: "bg-brand-lavender",
  peach: "bg-brand-peach",
  ochre: "bg-brand-ochre",
  pink: "bg-brand-pink",
};

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

export default function ActiveBudgets() {
  return (
    <section className="rounded-2xl bg-surface-card p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Presupuestos activos
          </h2>
          <p className="mt-1 text-xs text-muted">
            Seguimiento de tus límites de gasto
          </p>
        </div>

        <span className="rounded-full bg-surface-soft px-3 py-1.5 text-xs font-medium text-muted">
          Este mes
        </span>
      </div>

      <div className="space-y-6">
        {activeBudgets.map((budget) => {
          const percentage = Math.round(
            (budget.spent / budget.limit) * 100
          );

          const progressColor =
            progressColors[budget.color as keyof typeof progressColors];

          const isExceeded = percentage >= 100;

          return (
            <article key={budget.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {budget.name}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {percentage}% utilizado
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(budget.spent)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    de {formatCurrency(budget.limit)}
                  </p>
                </div>
              </div>

              <div
                className="h-2.5 overflow-hidden rounded-full bg-surface-container-high"
                role="progressbar"
                aria-label={`Presupuesto de ${budget.name}`}
                aria-valuenow={Math.min(percentage, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full transition-all ${progressColor} ${
                    isExceeded ? "opacity-70" : ""
                  }`}
                  style={{
                    width: `${Math.min(percentage, 100)}%`,
                  }}
                />
              </div>

              {isExceeded && (
                <p className="mt-2 text-xs font-medium text-error">
                  Has alcanzado o superado tu límite.
                </p>
              )}
            </article>
          );
        })}
      </div>

      <div className="mt-6 border-t border-hairline pt-4">
        <p className="text-xs text-muted">
          Importes ilustrativos · Datos de demostración
        </p>
      </div>
    </section>
  );
}
