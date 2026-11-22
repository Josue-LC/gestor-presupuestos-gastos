
import type {
  ScheduledPayment,
  ScheduledPaymentOccurrence,
} from "@/types/scheduled-payment.types";

interface Props {
  payments: ScheduledPayment[];
  occurrences: ScheduledPaymentOccurrence[];
}

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function parseDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getNextPendingDate(
  payment: ScheduledPayment,
  occurrences: ScheduledPaymentOccurrence[],
): string {
  const nextOccurrence = occurrences
    .filter(
      (occurrence) =>
        occurrence.scheduledPaymentId === payment.id &&
        occurrence.status === "pending",
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  return nextOccurrence?.dueDate ?? payment.nextDueDate;
}

function getMonthlyAmount(payment: ScheduledPayment): number {
  if (payment.amountType === "variable" || payment.amount === null) {
    return 0;
  }

  switch (payment.frequency) {
    case "weekly":
      return (payment.amount * 52) / 12;
    case "biweekly":
      return (payment.amount * 26) / 12;
    case "monthly":
      return payment.amount;
    case "bimonthly":
      return payment.amount / 2;
    case "quarterly":
      return payment.amount / 3;
    case "yearly":
      return payment.amount / 12;
    default:
      return 0;
  }
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-3xl border border-hairline bg-surface-card p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-xs text-muted">{description}</p>
    </article>
  );
}

export default function ScheduledPaymentSummary({
  payments,
  occurrences,
}: Props) {
  const activePayments = payments.filter(
    (payment) => payment.status === "active",
  );

  const monthlyEstimate = activePayments.reduce(
    (total, payment) => total + getMonthlyAmount(payment),
    0,
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextThirtyDays = new Date(today);
  nextThirtyDays.setDate(nextThirtyDays.getDate() + 30);

  const upcomingPayments = activePayments.filter((payment) => {
    const nextDate = parseDate(
      getNextPendingDate(payment, occurrences),
    );

    return nextDate >= today && nextDate <= nextThirtyDays;
  });

  const variablePayments = activePayments.filter(
    (payment) => payment.amountType === "variable",
  ).length;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <SummaryCard
        label="Pagos activos"
        value={String(activePayments.length)}
        description="Servicios y compromisos recurrentes"
      />

      <SummaryCard
        label="Próximos vencimientos"
        value={String(upcomingPayments.length)}
        description="Pagos pendientes en los próximos 30 días"
      />

      <SummaryCard
        label="Estimado mensual"
        value={currencyFormatter.format(monthlyEstimate)}
        description={
          variablePayments > 0
            ? `No incluye ${variablePayments} ${
                variablePayments === 1
                  ? "pago variable"
                  : "pagos variables"
              }`
            : "Equivalencia mensual de tus pagos activos"
        }
      />
    </section>
  );
}
