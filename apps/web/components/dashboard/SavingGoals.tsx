
import { savingsGoals } from "@/lib/dashboard-data";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const progressColors = {
  mint: "bg-brand-mint",
  pink: "bg-brand-pink",
};

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

export default function SavingsGoals() {
  return (
    <section className="rounded-2xl bg-surface-card p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Metas de ahorro
          </h2>

          <p className="mt-1 text-xs text-muted">
            Avance de tus objetivos financieros
          </p>
        </div>

        <span className="flex size-10 items-center justify-center rounded-full bg-surface-soft">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5 text-foreground"
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1" />
          </svg>
        </span>
      </div>

      <div className="space-y-6">
        {savingsGoals.map((goal) => {
          const percentage = Math.round(
            (goal.saved / goal.target) * 100
          );

          const progressColor =
            progressColors[goal.color as keyof typeof progressColors];

          return (
            <article key={goal.id}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {goal.name}
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    {percentage}% completado
                  </p>
                </div>

                <span className="shrink-0 text-sm font-bold text-foreground">
                  {formatCurrency(goal.saved)}
                </span>
              </div>

              <div
                className="h-2.5 overflow-hidden rounded-full bg-surface-container-high"
                role="progressbar"
                aria-label={`Progreso de ${goal.name}`}
                aria-valuenow={Math.min(percentage, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full transition-all ${progressColor}`}
                  style={{
                    width: `${Math.min(percentage, 100)}%`,
                  }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted">
                  Ahorrado
                </span>

                <span className="text-xs text-muted">
                  Objetivo: {formatCurrency(goal.target)}
                </span>
              </div>
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
