interface LoanSummaryProps {
  outstandingBalance: number;
  contractedAmount: number;
  activeLoansCount: number;
}

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function LoanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden="true">
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3 10h18M7 15h3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AmountIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden="true">
      <path
        d="M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ActiveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden="true">
      <path
        d="m5 12 4 4L19 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LoanSummary({
  outstandingBalance,
  contractedAmount,
  activeLoansCount,
}: LoanSummaryProps) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {/* Deuda pendiente */}
      <article className="rounded-2xl border border-hairline bg-surface-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted">Deuda pendiente</p>

          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <LoanIcon />
          </div>
        </div>

        <p className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {formatCurrency(outstandingBalance)}
        </p>

        <p className="mt-2 text-xs text-muted">
          Saldo pendiente de préstamos activos
        </p>
      </article>

      {/* Monto contratado */}
      <article className="rounded-2xl border border-hairline bg-surface-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted">Monto contratado</p>

          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <AmountIcon />
          </div>
        </div>

        <p className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {formatCurrency(contractedAmount)}
        </p>

        <p className="mt-2 text-xs text-muted">
          Importe original de préstamos activos
        </p>
      </article>

      {/* Préstamos activos */}
      <article className="rounded-2xl border border-hairline bg-surface-card p-5 shadow-sm sm:col-span-2 xl:col-span-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted">Préstamos activos</p>

          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ActiveIcon />
          </div>
        </div>

        <p className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {activeLoansCount}
        </p>

        <p className="mt-2 text-xs text-muted">
          {activeLoansCount === 1
            ? "Préstamo vigente"
            : "Préstamos vigentes"}
        </p>
      </article>
    </section>
  );
}