"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import type {
  ScheduledPayment,
  ScheduledPaymentOccurrence,
  ScheduledPaymentOccurrenceStatus,
} from "@/types/scheduled-payment.types";

import type { Transaction } from "@/components/transactions/TransactionList";

import {
  getScheduledPaymentById,
  getScheduledPaymentOccurrences,
  generateScheduledOccurrences,
  updateScheduledPayment,
  pauseScheduledPayment,
  resumeScheduledPayment,
  cancelScheduledPayment,
  registerScheduledPayment,
  skipScheduledPaymentOccurrence,
} from "@/services/scheduled-payment.service";

import { getActiveAccounts } from "@/services/account.service";
import { loadTransactionStorage } from "@/services/transaction-storage.service";
import { useAlert } from "@/context/AlertContext";

import ScheduledPaymentForm, {
  type ScheduledPaymentFormData,
} from "@/components/scheduled-payments/ScheduledPaymentForm";

import RegisterScheduledPaymentForm, {
  type RegisterScheduledPaymentFormData,
} from "@/components/scheduled-payments/RegisterScheduledPaymentForm";

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
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

const paymentStatusLabels = {
  active: "Activo",
  paused: "Pausado",
  cancelled: "Cancelado",
} as const;

const paymentStatusStyles = {
  active: "bg-emerald-500/10 text-emerald-600",
  paused: "bg-amber-500/10 text-amber-600",
  cancelled: "bg-muted/10 text-muted",
} as const;

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  date.setDate(date.getDate() + days);

  return getLocalDateString(date);
}

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

function getAmountDescription(payment: ScheduledPayment): string {
  if (payment.amount === null) {
    return "Importe por definir";
  }

  if (payment.amountType === "variable") {
    return `${currencyFormatter.format(payment.amount)} estimado`;
  }

  return currencyFormatter.format(payment.amount);
}

// -----------------------------------------------------------------------------
// COMPONENTES AUXILIARES
// -----------------------------------------------------------------------------

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>

      <p className="mt-1 break-words text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  valueClassName = "text-foreground",
}: {
  label: string;
  value: number;
  description: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-3xl border border-hairline bg-surface-card p-5">
      <p className="text-sm text-muted">{label}</p>

      <p className={`mt-3 text-3xl font-bold ${valueClassName}`}>{value}</p>

      <p className="mt-1 text-xs text-muted">{description}</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// PÁGINA
// -----------------------------------------------------------------------------

export default function ScheduledPaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const paymentId = params.id;

  const { toast, confirm } = useAlert();

  const [payment, setPayment] = useState<ScheduledPayment | null>(null);

  const [occurrences, setOccurrences] = useState<ScheduledPaymentOccurrence[]>(
    [],
  );

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);

  const [accountName, setAccountName] = useState("Sin cuenta predeterminada");

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);

  const [registrationTarget, setRegistrationTarget] = useState<{
    payment: ScheduledPayment;
    occurrence: ScheduledPaymentOccurrence;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // CARGA DE INFORMACIÓN
  // ---------------------------------------------------------------------------

  const loadData = useCallback(() => {
    try {
      setIsLoading(true);
      setHasError(false);

      let currentPayment = getScheduledPaymentById(paymentId);

      if (!currentPayment) {
        setPayment(null);
        setOccurrences([]);
        setHasError(true);
        return;
      }

      // Generamos vencimientos futuros solamente si la programación
      // permanece activa. Esto no genera transacciones.
      if (currentPayment.status === "active") {
        generateScheduledOccurrences(
          paymentId,
          addDays(getLocalDateString(), 90),
        );

        currentPayment = getScheduledPaymentById(paymentId);
      }

      if (!currentPayment) {
        setPayment(null);
        setOccurrences([]);
        setHasError(true);
        return;
      }

      const paymentOccurrences = getScheduledPaymentOccurrences(paymentId);

      const activeAccounts = getActiveAccounts();

      const account = activeAccounts.find(
        (item) => item.id === currentPayment?.defaultAccountId,
      );

      const transactionStorage = loadTransactionStorage();

      setPayment(currentPayment);
      setOccurrences(paymentOccurrences);
      setTransactions(transactionStorage?.transactions ?? []);

      setAccounts(
        activeAccounts.map((item) => ({
          id: item.id,
          name: item.name,
        })),
      );

      setAccountName(
        currentPayment.defaultAccountId
          ? (account?.name ?? "Cuenta inactiva o no disponible")
          : "Sin cuenta predeterminada",
      );
    } catch (error) {
      console.error("Error al cargar el detalle del pago recurrente:", error);

      setHasError(true);

      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible cargar el detalle del pago.",
        "Error de carga",
      );
    } finally {
      setIsLoading(false);
    }
  }, [paymentId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // INFORMACIÓN DERIVADA
  // ---------------------------------------------------------------------------

  const nextPendingOccurrence = useMemo(() => {
    return occurrences
      .filter((item) => item.status === "pending")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  }, [occurrences]);

  const counts = useMemo(
    () => ({
      pending: occurrences.filter((item) => item.status === "pending").length,
      paid: occurrences.filter((item) => item.status === "paid").length,
      skipped: occurrences.filter((item) => item.status === "skipped").length,
    }),
    [occurrences],
  );

  const transactionMap = useMemo(
    () =>
      new Map(transactions.map((transaction) => [transaction.id, transaction])),
    [transactions],
  );

  // ---------------------------------------------------------------------------
  // EDITAR PROGRAMACIÓN
  // ---------------------------------------------------------------------------

  function handleEditPayment() {
    setIsFormOpen(true);
  }

  function handleCloseForm() {
    setIsFormOpen(false);
  }

  async function handleSubmitPayment(
    data: ScheduledPaymentFormData,
  ): Promise<void> {
    try {
      updateScheduledPayment(paymentId, data);

      setIsFormOpen(false);

      toast.success(
        "El pago recurrente se actualizó correctamente.",
        "Pago actualizado",
      );

      loadData();
    } catch (error) {
      console.error("Error al actualizar el pago recurrente:", error);

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // PAUSAR PROGRAMACIÓN
  // ---------------------------------------------------------------------------

  function handlePausePayment() {
    if (!payment) return;

    try {
      pauseScheduledPayment(payment.id);

      toast.success(
        "La generación de nuevos vencimientos se ha detenido.",
        "Pago pausado",
      );

      loadData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible pausar el pago.",
        "Error",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // REANUDAR PROGRAMACIÓN
  // ---------------------------------------------------------------------------

  function handleResumePayment() {
    if (!payment) return;

    try {
      resumeScheduledPayment(payment.id);

      toast.success(
        "El pago recurrente volverá a generar vencimientos.",
        "Pago reanudado",
      );

      loadData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible reanudar el pago.",
        "Error",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // CANCELAR PROGRAMACIÓN
  // ---------------------------------------------------------------------------

  function handleCancelPayment() {
    if (!payment) return;

    confirm({
      title: "Cancelar pago recurrente",
      description: `¿Deseas cancelar "${payment.name}"? Se detendrá la generación de nuevos vencimientos. Los vencimientos y pagos anteriores se conservarán en el historial.`,
      confirmText: "Sí, cancelar",
      cancelText: "Conservar",
      type: "warning",
      onConfirm: () => {
        try {
          cancelScheduledPayment(payment.id);

          toast.success(
            "El pago recurrente fue cancelado. Su historial se conserva.",
            "Pago cancelado",
          );

          loadData();
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "No fue posible cancelar el pago.",
            "Error",
          );
        }
      },
    });
  }

  // ---------------------------------------------------------------------------
  // REGISTRAR PAGO
  // ---------------------------------------------------------------------------

  function handleOpenRegistration(occurrence: ScheduledPaymentOccurrence) {
    if (!payment || payment.status === "cancelled") return;
    if (occurrence.status !== "pending") return;

    setRegistrationTarget({
      payment,
      occurrence,
    });
  }

  function handleCloseRegistration() {
    setRegistrationTarget(null);
  }

  function handleRegisterPayment(data: RegisterScheduledPaymentFormData) {
    try {
      registerScheduledPayment({
        paymentId: data.paymentId,
        occurrenceId: data.occurrenceId,
        amount: data.amount,
        paidAt: data.paidAt,
        accountId: data.accountId,
      });

      setRegistrationTarget(null);

      toast.success(
        "El gasto fue registrado y el vencimiento se marcó como pagado.",
        "Pago registrado",
      );

      loadData();
    } catch (error) {
      console.error("Error al registrar el pago recurrente:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible registrar el pago.",
        "Error al registrar el pago",
      );

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // OMITIR VENCIMIENTO
  // ---------------------------------------------------------------------------

  function handleSkipOccurrence(occurrence: ScheduledPaymentOccurrence) {
    if (!payment) return;
    if (occurrence.status !== "pending") return;

    confirm({
      title: "Omitir vencimiento",
      description: `¿Deseas omitir el vencimiento del ${formatDate(
        occurrence.dueDate,
      )} correspondiente a "${payment.name}"? Esta acción no generará ningún movimiento financiero y no se podrá revertir.`,
      confirmText: "Sí, omitir",
      cancelText: "Conservar pendiente",
      type: "warning",
      onConfirm: () => {
        try {
          skipScheduledPaymentOccurrence(payment.id, occurrence.id);

          toast.success(
            "El vencimiento fue omitido. No se generó ningún movimiento financiero.",
            "Vencimiento omitido",
          );

          loadData();
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "No fue posible omitir el vencimiento.",
            "Error",
          );
        }
      },
    });
  }

  // ---------------------------------------------------------------------------
  // RENDER: CARGANDO
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="rounded-3xl border border-hairline bg-surface-card px-6 py-16 text-center">
          <p className="text-sm text-muted">
            Cargando información del pago recurrente...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: NO ENCONTRADO
  // ---------------------------------------------------------------------------

  if (hasError || !payment) {
    return (
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="rounded-3xl border border-hairline bg-surface-card px-6 py-16 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-background">
            <span className="text-2xl">!</span>
          </div>

          <h1 className="mt-5 text-xl font-semibold text-foreground">
            No encontramos este pago recurrente
          </h1>

          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Es posible que el registro no exista o que haya sido eliminado.
          </p>

          <Link
            href="/scheduled-payments"
            className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Volver a pagos recurrentes
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: DETALLE
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="mx-auto w-full max-w-[1600px] space-y-8">
        {/* NAVEGACIÓN */}
        <Link
          href="/scheduled-payments"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-primary"
        >
          <span aria-hidden="true">←</span>
          Volver a pagos recurrentes
        </Link>

        {/* ENCABEZADO */}
        <section className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {payment.name}
              </h1>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusStyles[payment.status]}`}
              >
                {paymentStatusLabels[payment.status]}
              </span>
            </div>

            <p className="mt-2 text-sm text-muted">
              {payment.category}
              {payment.description ? ` · ${payment.description}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {payment.status !== "cancelled" && (
              <button
                type="button"
                onClick={handleEditPayment}
                className="inline-flex items-center justify-center rounded-full border border-hairline px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-card"
              >
                Editar
              </button>
            )}

            {payment.status === "active" && (
              <button
                type="button"
                onClick={handlePausePayment}
                className="inline-flex items-center justify-center rounded-full border border-hairline px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-card"
              >
                Pausar
              </button>
            )}

            {payment.status === "paused" && (
              <button
                type="button"
                onClick={handleResumePayment}
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Reanudar
              </button>
            )}

            {payment.status !== "cancelled" && (
              <button
                type="button"
                onClick={handleCancelPayment}
                className="inline-flex items-center justify-center rounded-full border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-500/5"
              >
                Cancelar
              </button>
            )}
          </div>
        </section>

        {/* PRÓXIMO VENCIMIENTO */}
        <section className="rounded-3xl border border-hairline bg-surface-card p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted">
                Próximo vencimiento
              </p>

              {nextPendingOccurrence ? (
                <>
                  <h2 className="mt-2 text-2xl font-bold text-foreground">
                    {formatDate(nextPendingOccurrence.dueDate)}
                  </h2>

                  <p className="mt-1 text-sm text-muted">
                    {nextPendingOccurrence.amount === null
                      ? "El importe todavía está por definir."
                      : `Importe programado: ${formatAmount(nextPendingOccurrence.amount)}`}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-2 text-2xl font-bold text-foreground">
                    Sin vencimientos pendientes
                  </h2>

                  <p className="mt-1 text-sm text-muted">
                    No hay vencimientos pendientes registrados para esta
                    programación.
                  </p>
                </>
              )}
            </div>

            {nextPendingOccurrence && payment.status !== "cancelled" && (
              <button
                type="button"
                onClick={() => handleOpenRegistration(nextPendingOccurrence)}
                className="inline-flex w-fit items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Registrar pago
              </button>
            )}
          </div>
        </section>

        {/* RESUMEN DE VENCIMIENTOS */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Resumen de vencimientos
            </h2>

            <p className="mt-1 text-sm text-muted">
              Estado general de los vencimientos generados.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Pagados"
              value={counts.paid}
              description="Vencimientos registrados como pagados"
              valueClassName="text-emerald-600"
            />

            <SummaryCard
              label="Pendientes"
              value={counts.pending}
              description="Vencimientos que todavía no se atienden"
              valueClassName="text-amber-600"
            />

            <SummaryCard
              label="Omitidos"
              value={counts.skipped}
              description="Vencimientos que decidiste omitir"
              valueClassName="text-muted"
            />
          </div>
        </section>

        {/* INFORMACIÓN GENERAL */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Información general
            </h2>

            <p className="mt-1 text-sm text-muted">
              Configuración y características de esta programación.
            </p>
          </div>

          <div className="rounded-3xl border border-hairline bg-surface-card p-6">
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Nombre" value={payment.name} />

              <DetailField label="Categoría" value={payment.category} />

              <DetailField
                label="Frecuencia"
                value={frequencyLabels[payment.frequency]}
              />

              <DetailField
                label="Tipo de importe"
                value={payment.amountType === "fixed" ? "Fijo" : "Variable"}
              />

              <DetailField
                label="Importe"
                value={getAmountDescription(payment)}
              />

              <DetailField label="Cuenta predeterminada" value={accountName} />

              <DetailField
                label="Primer vencimiento"
                value={formatDate(payment.firstDueDate)}
              />

              <DetailField
                label="Fecha final"
                value={
                  payment.endDate
                    ? formatDate(payment.endDate)
                    : "Sin fecha de finalización"
                }
              />

              <DetailField
                label="Estado"
                value={paymentStatusLabels[payment.status]}
              />
            </div>

            {payment.notes && (
              <div className="mt-6 border-t border-hairline pt-5">
                <p className="text-xs text-muted">Notas</p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {payment.notes}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* HISTORIAL */}
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Historial de vencimientos
            </h2>

            <p className="mt-1 text-sm text-muted">
              Consulta y administra los vencimientos correspondientes a esta
              programación.
            </p>
          </div>

          {occurrences.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-hairline bg-surface-card px-6 py-12 text-center">
              <h3 className="font-semibold text-foreground">
                Todavía no hay vencimientos
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                Cuando se generen vencimientos para esta programación,
                aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {occurrences
                .slice()
                .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
                .map((occurrence) => {
                  const transaction = occurrence.transactionId
                    ? transactionMap.get(occurrence.transactionId)
                    : undefined;

                  const isPaid = occurrence.status === "paid";
                  const isSkipped = occurrence.status === "skipped";
                  const isPending = occurrence.status === "pending";

                  return (
                    <article
                      key={occurrence.id}
                      className="rounded-3xl border border-hairline bg-surface-card p-5"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-foreground">
                                Vencimiento del {formatDate(occurrence.dueDate)}
                              </h3>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[occurrence.status]}`}
                              >
                                {statusLabels[occurrence.status]}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                              <DetailField
                                label="Importe programado"
                                value={formatAmount(occurrence.amount)}
                              />

                              {isPaid && (
                                <>
                                  <DetailField
                                    label="Fecha de pago"
                                    value={formatDate(occurrence.paidAt)}
                                  />

                                  <DetailField
                                    label="Importe pagado"
                                    value={formatAmount(occurrence.paidAmount)}
                                  />
                                </>
                              )}
                            </div>
                          </div>

                          {/* ACCIONES DEL VENCIMIENTO */}
                          {isPending && (
                            <div className="flex shrink-0 flex-wrap gap-2">
                              {payment.status !== "cancelled" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenRegistration(occurrence)
                                  }
                                  className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                                >
                                  Registrar pago
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleSkipOccurrence(occurrence)}
                                className="inline-flex items-center justify-center rounded-full border border-hairline px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-background hover:text-foreground"
                              >
                                Omitir vencimiento
                              </button>
                            </div>
                          )}
                        </div>

                        {/* MOVIMIENTO ASOCIADO */}
                        {isPaid && transaction && (
                          <div className="rounded-2xl bg-background p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-xs font-semibold text-muted">
                                  Movimiento asociado
                                </p>

                                <p className="mt-1 text-sm font-medium text-foreground">
                                  {transaction.description}
                                </p>

                                <p className="mt-1 text-xs text-muted">
                                  Cuenta: {transaction.account}
                                </p>
                              </div>

                              <span
                                className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
                                  transaction.status === "cancelled"
                                    ? "bg-red-500/10 text-red-500"
                                    : "bg-emerald-500/10 text-emerald-600"
                                }`}
                              >
                                {transaction.status === "cancelled"
                                  ? "Movimiento cancelado"
                                  : "Movimiento activo"}
                              </span>
                            </div>
                          </div>
                        )}

                        {isPaid && !transaction && (
                          <p className="rounded-2xl bg-background p-4 text-xs text-muted">
                            No se encontró el movimiento asociado a este
                            vencimiento.
                          </p>
                        )}

                        {isSkipped && (
                          <p className="rounded-2xl bg-background p-4 text-xs text-muted">
                            Este vencimiento fue omitido y no generó ningún
                            movimiento financiero.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </section>
      </div>

      {/* MODAL: EDITAR PROGRAMACIÓN */}
      {isFormOpen && (
        <ScheduledPaymentForm
          key={payment.id}
          initialData={payment}
          accounts={accounts}
          hasOccurrences={occurrences.length > 0}
          onClose={handleCloseForm}
          onSubmit={handleSubmitPayment}
        />
      )}

      {/* MODAL: REGISTRAR PAGO */}
      {registrationTarget && (
        <RegisterScheduledPaymentForm
          key={registrationTarget.occurrence.id}
          payment={registrationTarget.payment}
          occurrence={registrationTarget.occurrence}
          accounts={accounts}
          onClose={handleCloseRegistration}
          onSubmit={handleRegisterPayment}
        />
      )}
    </>
  );
}
