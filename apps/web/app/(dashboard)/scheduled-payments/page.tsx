
"use client";

import { useCallback, useEffect, useState } from "react";

import ScheduledPaymentSummary from "@/components/scheduled-payments/ScheduledPaymentSummary";
import ScheduledPaymentList from "@/components/scheduled-payments/ScheduledPaymentList";
import ScheduledPaymentHistory from "@/components/scheduled-payments/ScheduledPaymentHistory";

import ScheduledPaymentForm, {
  type ScheduledPaymentFormData,
} from "@/components/scheduled-payments/ScheduledPaymentForm";

import RegisterScheduledPaymentForm, {
  type RegisterScheduledPaymentFormData,
} from "@/components/scheduled-payments/RegisterScheduledPaymentForm";

import type {
  ScheduledPayment,
  ScheduledPaymentOccurrence,
} from "@/types/scheduled-payment.types";

import type { Transaction } from "@/components/transactions/TransactionList";

import { getActiveAccounts } from "@/services/account.service";

import { loadTransactionStorage } from "@/services/transaction-storage.service";

import { useAlert } from "@/context/AlertContext";

import {
  getScheduledPayments,
  getScheduledPaymentOccurrences,
  createScheduledPayment,
  updateScheduledPayment,
  pauseScheduledPayment,
  resumeScheduledPayment,
  cancelScheduledPayment,
  generateScheduledOccurrences,
  registerScheduledPayment,
  skipScheduledPaymentOccurrence,
} from "@/services/scheduled-payment.service";

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// PÁGINA
// -----------------------------------------------------------------------------

export default function ScheduledPaymentsPage() {
  const { toast, confirm } = useAlert();

  const [payments, setPayments] = useState<ScheduledPayment[]>([]);

  const [occurrences, setOccurrences] = useState<
    ScheduledPaymentOccurrence[]
  >([]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [accounts, setAccounts] = useState<
    { id: string; name: string }[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);

  const [editingPayment, setEditingPayment] =
    useState<ScheduledPayment | null>(null);

  // Pago recurrente y vencimiento que se van a registrar.
  const [registrationTarget, setRegistrationTarget] = useState<{
    payment: ScheduledPayment;
    occurrence: ScheduledPaymentOccurrence;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // CARGA Y GENERACIÓN DE VENCIMIENTOS
  // ---------------------------------------------------------------------------

  const loadData = useCallback(() => {
    try {
      const activeAccounts = getActiveAccounts();

      setAccounts(
        activeAccounts.map((account) => ({
          id: account.id,
          name: account.name,
        })),
      );

      // Cargamos los movimientos para relacionarlos con los vencimientos pagados.
      const transactionStorage = loadTransactionStorage();

      setTransactions(transactionStorage?.transactions ?? []);

      // Generamos vencimientos hasta 90 días adelante.
      // El servicio evita duplicados y no crea transacciones.
      const today = getLocalDateString();
      const generationLimit = addDays(today, 90);

      const currentPayments = getScheduledPayments();

      currentPayments
        .filter((payment) => payment.status === "active")
        .forEach((payment) => {
          generateScheduledOccurrences(
            payment.id,
            generationLimit,
          );
        });

      setPayments(getScheduledPayments());
      setOccurrences(getScheduledPaymentOccurrences());
    } catch (error) {
      console.error(
        "Error al cargar los pagos recurrentes:",
        error,
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible cargar los pagos recurrentes.",
        "Error de carga",
      );
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // FORMULARIO DE CREACIÓN Y EDICIÓN
  // ---------------------------------------------------------------------------

  function handleOpenCreateForm() {
    setEditingPayment(null);
    setIsFormOpen(true);
  }

  function handleOpenEditForm(payment: ScheduledPayment) {
    setEditingPayment(payment);
    setIsFormOpen(true);
  }

  function handleCloseForm() {
    setIsFormOpen(false);
    setEditingPayment(null);
  }

  async function handleSubmitPayment(data: ScheduledPaymentFormData) {
    try {
      if (editingPayment) {
        updateScheduledPayment(editingPayment.id, data);

        toast.success(
          "El pago recurrente se actualizó correctamente.",
          "Pago actualizado",
        );
      } else {
        createScheduledPayment(data);

        toast.success(
          "El pago recurrente se registró correctamente.",
          "Pago creado",
        );
      }

      handleCloseForm();
      loadData();
    } catch (error) {
      console.error("Error al guardar el pago recurrente:", error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // REGISTRAR PAGO
  // ---------------------------------------------------------------------------

  function handleOpenRegistration(
    payment: ScheduledPayment,
    occurrence: ScheduledPaymentOccurrence,
  ) {
    setRegistrationTarget({ payment, occurrence });
  }

  function handleCloseRegistration() {
    setRegistrationTarget(null);
  }

  function handleRegisterPayment(
    data: RegisterScheduledPaymentFormData,
  ) {
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

  function handleSkipOccurrence(
    paymentId: string,
    occurrenceId: string,
  ) {
    const payment = payments.find(
      (item) => item.id === paymentId,
    );

    const occurrence = occurrences.find(
      (item) => item.id === occurrenceId,
    );

    if (!payment || !occurrence) {
      toast.error(
        "No se encontró el vencimiento seleccionado.",
        "Error",
      );
      return;
    }

    confirm({
      title: "¿Omitir este vencimiento?",
      description: `Se omitirá el vencimiento de "${payment.name}" correspondiente al ${occurrence.dueDate}. No se generará ningún gasto y esta acción no se podrá deshacer.`,
      confirmText: "Sí, omitir",
      cancelText: "Cancelar",
      type: "warning",
      onConfirm: () => {
        try {
          skipScheduledPaymentOccurrence(
            paymentId,
            occurrenceId,
          );

          toast.success(
            "El vencimiento se omitió correctamente.",
            "Vencimiento omitido",
          );

          loadData();
        } catch (error) {
          console.error("Error al omitir el vencimiento:", error);

          toast.error(
            error instanceof Error
              ? error.message
              : "No fue posible omitir el vencimiento.",
            "Error al omitir",
          );
        }
      },
    });
  }

  // ---------------------------------------------------------------------------
  // PAUSAR Y REANUDAR
  // ---------------------------------------------------------------------------

  function handlePausePayment(paymentId: string) {
    try {
      pauseScheduledPayment(paymentId);

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

  function handleResumePayment(paymentId: string) {
    try {
      resumeScheduledPayment(paymentId);

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
  // CANCELAR
  // ---------------------------------------------------------------------------

  function handleCancelPayment(paymentId: string) {
    const payment = payments.find(
      (item) => item.id === paymentId,
    );

    if (!payment) return;

    confirm({
      title: "Cancelar pago recurrente",
      description: `¿Deseas cancelar "${payment.name}"? Se detendrá la generación de nuevos vencimientos. Los vencimientos y pagos anteriores se conservarán en el historial.`,
      confirmText: "Sí, cancelar",
      cancelText: "Conservar",
      type: "warning",
      onConfirm: () => {
        try {
          cancelScheduledPayment(paymentId);

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
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      {/* ENCABEZADO */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Gestión financiera
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Pagos recurrentes
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Organiza tus servicios, suscripciones y compromisos
            financieros. Consulta sus vencimientos y lleva el control
            de cada pago realizado.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateForm}
          className="flex w-fit items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          <span className="text-lg leading-none">+</span>
          Nuevo pago recurrente
        </button>
      </section>

      {isLoading ? (
        <div className="rounded-3xl border border-hairline bg-surface-card px-6 py-16 text-center">
          <p className="text-sm text-muted">
            Cargando pagos recurrentes...
          </p>
        </div>
      ) : (
        <>
          {/* RESUMEN */}
          <ScheduledPaymentSummary
            payments={payments}
            occurrences={occurrences}
          />

          {/* LISTADO DE PAGOS RECURRENTES */}
          <ScheduledPaymentList
            payments={payments}
            occurrences={occurrences}
            onEdit={handleOpenEditForm}
            onPause={handlePausePayment}
            onResume={handleResumePayment}
            onCancel={handleCancelPayment}
            onRegister={handleOpenRegistration}
          />

          {/* HISTORIAL DE VENCIMIENTOS */}
          <ScheduledPaymentHistory
            payments={payments}
            occurrences={occurrences}
            transactions={transactions}
            onSkip={handleSkipOccurrence}
          />
        </>
      )}

      {/* FORMULARIO DE CREACIÓN Y EDICIÓN */}
      {isFormOpen && (
        <ScheduledPaymentForm
          key={editingPayment?.id ?? "new-scheduled-payment"}
          initialData={editingPayment}
          accounts={accounts}
          hasOccurrences={
            editingPayment
              ? occurrences.some(
                  (occurrence) =>
                    occurrence.scheduledPaymentId === editingPayment.id,
                )
              : false
          }
          onClose={handleCloseForm}
          onSubmit={handleSubmitPayment}
        />
      )}

      {/* FORMULARIO DE REGISTRO DE PAGO */}
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
    </div>
  );
}
