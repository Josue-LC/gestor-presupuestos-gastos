
"use client";

import type { Transaction } from "@/components/transactions/TransactionList";

import type {
  TransactionAuditEvent,
  TransactionAuditField,
} from "@/types/transaction-audit";

interface TransactionDetailsProps {
  transaction: Transaction;
  auditEvents: TransactionAuditEvent[];
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
}

const typeLabels = {
  income: "Ingreso",
  expense: "Gasto",
  transfer: "Transferencia",
};

const fieldLabels: Record<TransactionAuditField, string> = {
  description: "Descripción",
  amount: "Importe",
  type: "Tipo de movimiento",
  category: "Categoría",
  account: "Cuenta",
  date: "Fecha de operación",
  registeredAt: "Fecha de registro",
  status: "Estado",
  cancellationReason: "Motivo de cancelación",
};

const actionLabels = {
  created: "Movimiento creado",
  updated: "Movimiento actualizado",
  cancelled: "Movimiento cancelado",
  restored: "Cancelación revertida",
  removed: "Movimiento retirado",
};

function formatAmount(transaction: Transaction) {
  const amount = Math.abs(transaction.amount).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });

  if (transaction.type === "income") return `+${amount}`;
  if (transaction.type === "expense") return `-${amount}`;

  return amount;
}

function formatRegisteredAt(value?: string | null) {
  if (!value) return "No disponible";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAuditValue(
  field: TransactionAuditField,
  value: string | number | null,
) {
  if (value === null) return "Sin valor";

  if (field === "amount") {
    return Math.abs(Number(value)).toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });
  }

  if (field === "type") {
    return typeLabels[value as keyof typeof typeLabels] ?? String(value);
  }

  if (field === "status") {
    return value === "cancelled" ? "Cancelado" : "Activo";
  }

  if (field === "registeredAt") {
    return formatRegisteredAt(String(value));
  }

  return String(value);
}

function formatAuditDate(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-hairline py-3 last:border-0">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="break-words text-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

function getActionStyles(action: TransactionAuditEvent["action"]) {
  switch (action) {
    case "created":
      return {
        badge: "bg-brand-mint/40 text-success",
        label: "Registro inicial",
        dot: "bg-success",
      };

    case "updated":
      return {
        badge: "bg-brand-peach/40 text-foreground",
        label: "Modificación",
        dot: "bg-foreground",
      };

    case "cancelled":
      return {
        badge: "bg-red-100 text-red-700",
        label: "Cancelación",
        dot: "bg-red-600",
      };

    case "restored":
      return {
        badge: "bg-blue-100 text-blue-700",
        label: "Restauración",
        dot: "bg-blue-600",
      };

    case "removed":
      return {
        badge: "bg-neutral-200 text-neutral-700",
        label: "Retiro",
        dot: "bg-neutral-500",
      };

    default:
      return {
        badge: "bg-surface-card text-muted",
        label: "Actividad",
        dot: "bg-muted",
      };
  }
}

function AuditEventCard({ event }: { event: TransactionAuditEvent }) {
  const styles = getActionStyles(event.action);

  return (
    <article className="relative border-l-2 border-hairline pb-6 pl-5 last:border-l-transparent last:pb-0">
      <span
        className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${styles.dot}`}
      />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-foreground">
            {actionLabels[event.action]}
          </h4>

          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles.badge}`}
          >
            {styles.label}
          </span>
        </div>

        <span className="text-xs text-muted">
          {formatAuditDate(event.timestamp)}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted">Responsable: {event.actor}</p>

      {event.changes.length > 0 && (
        <div className="mt-3 space-y-3">
          {event.changes.map((change, index) => (
            <div
              key={`${event.id}-${change.field}-${index}`}
              className="rounded-xl bg-surface-card p-3"
            >
              <p className="text-xs font-semibold text-foreground">
                {fieldLabels[change.field]}
              </p>

              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                    Valor anterior
                  </p>

                  <p className="mt-1 break-words text-xs text-muted">
                    {formatAuditValue(change.field, change.previousValue)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                    Valor nuevo
                  </p>

                  <p className="mt-1 break-words text-xs font-semibold text-foreground">
                    {formatAuditValue(change.field, change.newValue)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {event.reason && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-800">Motivo</p>
          <p className="mt-1 text-xs leading-5 text-red-700">
            {event.reason}
          </p>
        </div>
      )}
    </article>
  );
}

export default function TransactionDetails({
  transaction,
  auditEvents,
  onClose,
  onEdit,
}: TransactionDetailsProps) {
  const isCancelled = transaction.status === "cancelled";

  const amountColor = isCancelled
    ? "text-muted"
    : transaction.type === "income"
      ? "text-success"
      : transaction.type === "expense"
        ? "text-error"
        : "text-foreground";

  const transactionEvents = auditEvents
    .filter((event) => event.transactionId === transaction.id)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-details-title"
        className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-background p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Detalle del movimiento
            </p>

            <h2
              id="transaction-details-title"
              className="mt-2 text-2xl font-bold tracking-tight text-foreground"
            >
              {transaction.description}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="rounded-full p-2 text-muted transition hover:bg-surface-card hover:text-foreground"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                d="m18 6-12 12M6 6l12 12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-surface-card p-5">
          <p className="text-xs font-medium text-muted">
            Importe del movimiento
          </p>

          <p
            className={`mt-2 text-3xl font-bold tracking-tight ${amountColor}`}
          >
            {formatAmount(transaction)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground">
              {typeLabels[transaction.type]}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isCancelled
                  ? "bg-red-100 text-red-700"
                  : "bg-brand-mint/40 text-success"
              }`}
            >
              {isCancelled ? "Cancelado" : "Activo"}
            </span>
          </div>
        </div>

        <section className="mt-5">
          <h3 className="text-sm font-semibold text-foreground">
            Información del movimiento
          </h3>

          <div className="mt-2">
            <DetailRow label="Descripción" value={transaction.description} />
            <DetailRow label="Categoría" value={transaction.category} />
            <DetailRow label="Cuenta" value={transaction.account} />
            <DetailRow label="Fecha de operación" value={transaction.date} />
            <DetailRow
              label="Fecha de registro"
              value={formatRegisteredAt(transaction.registeredAt)}
            />
            {isCancelled && transaction.cancellationReason && (
              <DetailRow
                label="Motivo de cancelación"
                value={transaction.cancellationReason}
              />
            )}
            <DetailRow label="Identificador" value={transaction.id} />
          </div>
        </section>

        <section className="mt-6 border-t border-hairline pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              Historial de actividad
            </h3>

            <span className="rounded-full bg-surface-card px-2.5 py-1 text-xs font-medium text-muted">
              {transactionEvents.length} eventos
            </span>
          </div>

          {transactionEvents.length > 0 ? (
            <div className="mt-5">
              {transactionEvents.map((event) => (
                <AuditEventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-surface-card px-4 py-5 text-center">
              <p className="text-sm font-medium text-foreground">
                Sin historial de auditoría
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Este movimiento no tiene eventos registrados en el historial.
              </p>
            </div>
          )}
        </section>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-hairline pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-hairline px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-card"
          >
            Cerrar
          </button>

          {!isCancelled && (
            <button
              type="button"
              onClick={() => onEdit(transaction)}
              className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-neutral-800"
            >
              Editar movimiento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
