
interface CardSummaryProps {
  activeCards: number;
  totalDebt: number;
  availableCredit: number;
  upcomingInstallmentsAmount: number;
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
    <article
      className={`rounded-2xl p-5 shadow-sm ${backgrounds[color]}`}
    >
      <p className="text-sm font-medium text-body">{label}</p>

      <p className="mt-3 break-words text-2xl font-bold tracking-tight text-foreground">
        {isCurrency
          ? currencyFormatter.format(value)
          : value}
      </p>

      <p className="mt-2 text-xs text-body">{description}</p>
    </article>
  );
}

export default function CardSummary({
  activeCards,
  totalDebt,
  availableCredit,
  upcomingInstallmentsAmount,
}: CardSummaryProps) {
  return (
    <section
      aria-label="Resumen de tarjetas"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <SummaryItem
        label="Tarjetas activas"
        value={activeCards}
        description="Tarjetas registradas y disponibles"
        color="mint"
        isCurrency={false}
      />

      <SummaryItem
        label="Deuda total"
        value={totalDebt}
        description="Deuda pendiente en tarjetas de crédito"
        color="peach"
      />

      <SummaryItem
        label="Crédito disponible"
        value={availableCredit}
        description="Límite disponible de tus tarjetas"
        color="lavender"
      />

      <SummaryItem
        label="Próximos pagos MSI"
        value={upcomingInstallmentsAmount}
        description="Importe pendiente de próximos vencimientos"
        color="mint"
      />
    </section>
  );
}
