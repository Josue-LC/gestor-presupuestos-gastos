
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  ScheduledPayment,
  ScheduledPaymentOccurrence,
  ScheduledPaymentStatus,
} from "@/types/scheduled-payment.types";

interface Props {
  payments: ScheduledPayment[];
  occurrences: ScheduledPaymentOccurrence[];
  onEdit: (payment: ScheduledPayment) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRegister: (
    payment: ScheduledPayment,
    occurrence: ScheduledPaymentOccurrence,
  ) => void;
}

type StatusFilter = "all" | ScheduledPaymentStatus;

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const frequencyLabels: Record<ScheduledPayment["frequency"], string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  yearly: "Anual",
};

const statusLabels: Record<ScheduledPaymentStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  cancelled: "Cancelado",
};

const statusStyles: Record<ScheduledPaymentStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600",
  paused: "bg-amber-500/10 text-amber-600",
  cancelled: "bg-muted/10 text-muted",
};

function parseDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: string): string {
  return dateFormatter.format(parseDate(date));
}

function getNextPendingOccurrence(
  payment: ScheduledPayment,
  occurrences: ScheduledPaymentOccurrence[],
): ScheduledPaymentOccurrence | undefined {
  return occurrences
    .filter(
      (occurrence) =>
        occurrence.scheduledPaymentId === payment.id &&
        occurrence.status === "pending",
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
}

function getNextPendingDate(
  payment: ScheduledPayment,
  occurrences: ScheduledPaymentOccurrence[],
): string {
  return (
    getNextPendingOccurrence(payment, occurrences)?.dueDate ??
    payment.nextDueDate
  );
}

function formatAmount(payment: ScheduledPayment): string {
  if (payment.amount === null) return "Por definir";

  const amount = currencyFormatter.format(payment.amount);

  return payment.amountType === "variable"
    ? `Variable · ${amount} estimado`
    : amount;
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

export default function ScheduledPaymentList({
  payments,
  occurrences,
  onEdit,
  onPause,
  onResume,
  onCancel,
  onRegister,
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredPayments = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es-MX");

    return payments
      .filter((payment) => {
        const matchesSearch =
          !normalizedSearch ||
          payment.name.toLocaleLowerCase("es-MX").includes(normalizedSearch) ||
          payment.category
            .toLocaleLowerCase("es-MX")
            .includes(normalizedSearch) ||
          (payment.description ?? "")
            .toLocaleLowerCase("es-MX")
            .includes(normalizedSearch);

        const matchesStatus =
          statusFilter === "all" || payment.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) =>
        getNextPendingDate(a, occurrences).localeCompare(
          getNextPendingDate(b, occurrences),
        ),
      );
  }, [payments, occurrences, search, statusFilter]);

  return (
    <section className="space-y-5">
      {/* ENCABEZADO */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Tus pagos recurrentes
          </h2>

          <p className="mt-1 text-sm text-muted">
            Administra tus servicios y compromisos programados.
          </p>
        </div>

        <div className="w-full lg:max-w-sm">
          <label htmlFor="scheduled-payment-search" className="sr-only">
            Buscar pago recurrente
          </label>

          <input
            id="scheduled-payment-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o categoría..."
            className="w-full rounded-2xl border border-hairline bg-surface-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
          />
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
          label="Activos"
          active={statusFilter === "active"}
          onClick={() => setStatusFilter("active")}
        />

        <FilterButton
          label="Pausados"
          active={statusFilter === "paused"}
          onClick={() => setStatusFilter("paused")}
        />

        <FilterButton
          label="Cancelados"
          active={statusFilter === "cancelled"}
          onClick={() => setStatusFilter("cancelled")}
        />
      </div>

      {/* LISTADO */}
      {filteredPayments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-hairline bg-surface-card px-6 py-12 text-center">
          <h3 className="font-semibold text-foreground">
            {payments.length === 0
              ? "Todavía no tienes pagos recurrentes"
              : "No se encontraron pagos"}
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {payments.length === 0
              ? "Registra servicios, suscripciones y otros compromisos para llevar el control de sus próximos vencimientos."
              : "Prueba con otro término de búsqueda o cambia el filtro de estado."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map((payment) => {
            const nextPendingOccurrence = getNextPendingOccurrence(
              payment,
              occurrences,
            );

            return (
              <article
                key={payment.id}
                className="rounded-3xl border border-hairline bg-surface-card p-5 transition hover:border-primary/30"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                  {/* INFORMACIÓN */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {payment.name}
                      </h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[payment.status]}`}
                      >
                        {statusLabels[payment.status]}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-muted">
                      {payment.category}
                      {payment.description
                        ? ` · ${payment.description}`
                        : ""}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
                      <div>
                        <p className="text-xs text-muted">Frecuencia</p>

                        <p className="mt-1 font-medium text-foreground">
                          {frequencyLabels[payment.frequency]}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted">
                          Próximo vencimiento
                        </p>

                        <p className="mt-1 font-medium text-foreground">
                          {payment.status === "cancelled"
                            ? "Programación cancelada"
                            : formatDate(
                                getNextPendingDate(payment, occurrences),
                              )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted">Importe</p>

                        <p className="mt-1 font-medium text-foreground">
                          {formatAmount(payment)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ACCIONES */}
                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <Link
                      href={`/scheduled-payments/${payment.id}`}
                      className="rounded-full border border-primary/30 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/5"
                    >
                      Ver detalle
                    </Link>

                    {payment.status === "active" &&
                      nextPendingOccurrence && (
                        <button
                          type="button"
                          onClick={() =>
                            onRegister(payment, nextPendingOccurrence)
                          }
                          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                        >
                          Registrar pago
                        </button>
                      )}

                    {payment.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => onEdit(payment)}
                        className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-foreground transition hover:bg-background"
                      >
                        Editar
                      </button>
                    )}

                    {payment.status === "active" && (
                      <button
                        type="button"
                        onClick={() => onPause(payment.id)}
                        className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-foreground transition hover:bg-background"
                      >
                        Pausar
                      </button>
                    )}

                    {payment.status === "paused" && (
                      <button
                        type="button"
                        onClick={() => onResume(payment.id)}
                        className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-foreground transition hover:bg-background"
                      >
                        Reanudar
                      </button>
                    )}

                    {payment.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => onCancel(payment.id)}
                        className="rounded-full px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/10"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
