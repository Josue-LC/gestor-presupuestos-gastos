
interface TransactionSummaryProps {
  income: number;
  expenses: number;
  netBalance: number;
}

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function SummaryItem({
  label,
  amount,
  description,
  color,
}: {
  label: string;
  amount: number;
  description: string;
  color: "mint" | "peach" | "lavender";
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
        {currencyFormatter.format(amount)}
      </p>

      <p className="mt-2 text-xs text-body">{description}</p>
    </article>
  );
}

export default function TransactionSummary({
  income,
  expenses,
  netBalance,
}: TransactionSummaryProps) {
  return (
    <section
      aria-label="Resumen de movimientos"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <SummaryItem
        label="Ingresos"
        amount={income}
        description="Total de ingresos del periodo"
        color="mint"
      />

      <SummaryItem
        label="Gastos"
        amount={expenses}
        description="Total de gastos del periodo"
        color="peach"
      />

      <SummaryItem
        label="Balance neto"
        amount={netBalance}
        description="Ingresos menos gastos"
        color="lavender"
      />
    </section>
  );
}
