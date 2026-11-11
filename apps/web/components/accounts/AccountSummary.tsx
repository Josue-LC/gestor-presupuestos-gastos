
interface AccountSummaryProps {
  totalBalance: number;
  income: number;
  expenses: number;
  activeAccounts: number;
}

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function SummaryItem({
  label,
  value,
  description,
  color,
  isCurrency = true,
}: {
  label: string;
  value: number;
  description: string;
  color: "mint" | "peach" | "lavender";
  isCurrency?: boolean;
}) {
  const backgrounds = {
    mint: "bg-brand-mint/40",
    peach: "bg-brand-peach/40",
    lavender: "bg-brand-lavender/40",
  };

  return (
    <article className={`rounded-2xl p-5 shadow-sm ${backgrounds[color]}`}>
      <p className="text-sm font-medium text-body">{label}</p>

      <p className="mt-3 break-words text-2xl font-bold tracking-tight text-foreground">
        {isCurrency ? currencyFormatter.format(value) : value}
      </p>

      <p className="mt-2 text-xs text-body">{description}</p>
    </article>
  );
}

export default function AccountSummary({
  totalBalance,
  income,
  expenses,
  activeAccounts,
}: AccountSummaryProps) {
  return (
    <section
      aria-label="Resumen de cuentas"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <SummaryItem
        label="Saldo total"
        value={totalBalance}
        description="Saldo acumulado de cuentas activas"
        color="mint"
      />

      <SummaryItem
        label="Ingresos registrados"
        value={income}
        description="Ingresos de tus cuentas"
        color="peach"
      />

      <SummaryItem
        label="Gastos registrados"
        value={expenses}
        description="Gastos de tus cuentas"
        color="lavender"
      />

      <SummaryItem
        label="Cuentas activas"
        value={activeAccounts}
        description="Cuentas disponibles"
        color="lavender"
        isCurrency={false}
      />
    </section>
  );
}
