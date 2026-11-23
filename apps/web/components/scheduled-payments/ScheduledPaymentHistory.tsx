
"use client";

import { useMemo, useState } from "react";

import type {
  ScheduledPayment,
  ScheduledPaymentOccurrence,
  ScheduledPaymentOccurrenceStatus,
} from "@/types/scheduled-payment.types";

import type { Transaction } from "@/components/transactions/TransactionList";

interface Props {
  payments: ScheduledPayment[];
  occurrences: ScheduledPaymentOccurrence[];
  transactions: Transaction[];
  onSkip: (paymentId: string, occurrenceId: string) => void;
}

type StatusFilter = "all" | ScheduledPaymentOccurrenceStatus;

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const statusLabels: Record<ScheduledPaymentOccurrenceStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  skipped: "Omitido",
};

const statusStyles: Record<ScheduledPaymentOccurrenceStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  paid: "bg-emerald-500/10 text-emerald-600",
  skipped: "bg-muted/10 text-muted",
};

const frequencyLabels: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  yearly: "Anual",
};

function parseDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: string | null): string {
  if (!date) return "—";

  return dateFormatter.format(parseDate(date));
}

function formatAmount(amount: number | null): string {
  return amount === null ? "Por definir" : currencyFormatter.format(amount);
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-surface-card text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export default function ScheduledPaymentHistory({
  payments,
  occurrences,
  transactions,
  onSkip,
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const paymentMap = useMemo(
    () => new Map(payments.map((payment) => [payment.id, payment])),
    [payments],
  );

  const transactionMap = useMemo(
    () =>
      new Map(
        transactions.map((transaction) => [transaction.id, transaction]),
      ),
    [transactions],
  );

  const filteredOccurrences = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es-MX");

    return occurrences
      .filter((occurrence) => {
        const payment = paymentMap.get(occurrence.scheduledPaymentId);

        const matchesSearch =
          !normalizedSearch ||
          (payment?.name ?? "")
            .toLocaleLowerCase("es-MX")
            .includes(normalizedSearch) ||
          (payment?.category ?? "")
            .toLocaleLowerCase("es-MX")
            .includes(normalizedSearch);

        const matchesStatus =
          statusFilter === "all" || occurrence.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dateComparison = b.dueDate.localeCompare(a.dueDate);

        if (dateComparison !== 0) return dateComparison;

        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [occurrences, paymentMap, search, statusFilter]);

  const counts = useMemo(
    () => ({
      pending: occurrences.filter((item) => item.status === "pending").length,
      paid: occurrences.filter((item) => item.status === "paid").length,
      skipped: occurrences.filter((item) => item.status === "skipped").length,
    }),
    [occurrences],
  );

  return (
    <section className="space-y-5">
      {/* ENCABEZADO */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Historial de vencimientos
          </h2>

          <p className="mt-1 text-sm text-muted">
            Consulta los pagos programados y el estado de cada vencimiento.
          </p>
        </div>

        <div className="w-full lg:max-w-sm">
          <label htmlFor="scheduled-history-search" className="sr-only">
            Buscar en el historial
          </label>

          <input
            id="scheduled-history-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o categoría..."
            className="w-full rounded-2xl border border-hairline bg-surface-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
          />
        </div>
      </div>

      {/* INDICADORES */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-hairline bg-surface-card p-4">
          <p className="text-sm text-muted">Pendientes</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {counts.pending}
          </p>
        </div>

        <div className="rounded-2xl border border-hairline bg-surface-card p-4">
          <p className="text-sm text-muted">Pagados</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {counts.paid}
          </p>
        </div>

        <div className="rounded-2xl border border-hairline bg-surface-card p-4">
          <p className="text-sm text-muted">Omitidos</p>
          <p className="mt-2 text-2xl font-bold text-muted">
            {counts.skipped}
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap gap-2">
        <FilterButton
          label="Todos"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />

        <FilterButton
          label="Pendientes"
          active={statusFilter === "pending"}
          onClick={() => setStatusFilter("pending")}
        />

        <FilterButton
          label="Pagados"
          active={statusFilter === "paid"}
          onClick={() => setStatusFilter("paid")}
        />

        <FilterButton
          label="Omitidos"
          active={statusFilter === "skipped"}
          onClick={() => setStatusFilter("skipped")}
        />
      </div>

      {/* LISTADO */}
      {filteredOccurrences.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-hairline bg-surface-card px-6 py-12 text-center">
          <h3 className="font-semibold text-foreground">
            {occurrences.length === 0
              ? "Todavía no hay vencimientos"
              : "No se encontraron vencimientos"}
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {occurrences.length === 0
              ? "Cuando tus pagos recurrentes generen vencimientos, aparecerán aquí para que puedas consultar su estado."
              : "Prueba con otro término de búsqueda o cambia el filtro de estado."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOccurrences.map((occurrence) => {
            const payment = paymentMap.get(
              occurrence.scheduledPaymentId,
            );

            const transaction = occurrence.transactionId
              ? transactionMap.get(occurrence.transactionId)
              : undefined;

            const isPaid = occurrence.status === "paid";
            const isPending = occurrence.status === "pending";
            const isSkipped = occurrence.status === "skipped";

            return (
              <article
                key={occurrence.id}
                className="rounded-3xl border border-hairline bg-surface-card p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* INFORMACIÓN DEL PAGO */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {payment?.name ?? "Pago recurrente"}
                      </h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[occurrence.status]}`}
                      >
                        {statusLabels[occurrence.status]}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-muted">
                      {payment?.category ?? "Categoría no disponible"}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted">
                          Fecha de vencimiento
                        </p>

                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatDate(occurrence.dueDate)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted">
                          {isPaid ? "Fecha de pago" : "Importe programado"}
                        </p>

                        <p className="mt-1 text-sm font-medium text-foreground">
                          {isPaid
                            ? formatDate(occurrence.paidAt)
                            : formatAmount(occurrence.amount)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted">
                          {isPaid ? "Importe pagado" : "Frecuencia"}
                        </p>

                        <p className="mt-1 text-sm font-medium text-foreground">
                          {isPaid
                            ? formatAmount(occurrence.paidAmount)
                            : payment
                              ? frequencyLabels[payment.frequency] ?? "—"
                              : "—"}
                        </p>
                      </div>
                    </div>

                    {/* DIFERENCIA ENTRE IMPORTE ESTIMADO Y REAL */}
                    {isPaid &&
                      occurrence.amount !== null &&
                      occurrence.paidAmount !== null &&
                      occurrence.amount !== occurrence.paidAmount && (
                        <p className="mt-3 text-xs text-muted">
                          Importe estimado: {formatAmount(occurrence.amount)}
                        </p>
                      )}

                    {/* INFORMACIÓN DE VENCIMIENTO OMITIDO */}
                    {isSkipped && (
                      <p className="mt-3 text-xs text-muted">
                        Este vencimiento fue omitido. No se generó ningún gasto
                        asociado.
                      </p>
                    )}

                    {/* TRANSACCIÓN ASOCIADA */}
                    {isPaid && (
                      <div className="mt-4 rounded-2xl bg-background px-4 py-3">
                        <p className="text-xs font-semibold text-muted">
                          Movimiento asociado
                        </p>

                        {transaction ? (
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {transaction.description}
                              </p>

                              <p className="mt-1 text-xs text-muted">
                                Cuenta: {transaction.account}
                              </p>
                            </div>

                            {transaction.status === "cancelled" ? (
                              <span className="text-xs font-medium text-red-500">
                                Movimiento cancelado
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-emerald-600">
                                Gasto registrado
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-muted">
                            No se encontró la transacción vinculada.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ACCIONES */}
                  {isPending && (
                    <div className="flex shrink-0 items-center lg:pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onSkip(
                            occurrence.scheduledPaymentId,
                            occurrence.id,
                          )
                        }
                        className="rounded-xl border border-hairline px-4 py-2.5 text-sm font-medium text-muted transition hover:border-red-500/40 hover:bg-red-500/5 hover:text-red-500"
                      >
                        Omitir vencimiento
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
