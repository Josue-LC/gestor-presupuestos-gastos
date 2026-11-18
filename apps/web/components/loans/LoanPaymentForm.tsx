
"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";

import type { Loan } from "@/types/loan.types";
import type { Account } from "@/types/account";

import type { RegisterLoanPaymentInput } from "@/services/loan-payment.service";
import { useAlert } from "@/context/AlertContext";

interface LoanPaymentFormProps {
  loan: Loan;
  accounts: Account[];
  outstandingBalance: number;
  onSubmit: (data: RegisterLoanPaymentInput) => void;
  onCancel: () => void;
}

const paymentSchema = z.object({
  amount: z
    .number({ error: "Ingresa un importe válido." })
    .finite("El importe no es válido.")
    .positive("El importe debe ser mayor a cero.")
    .refine(
      (value) =>
        Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
      "El importe no puede tener más de dos decimales.",
    ),
  paidAt: z
    .string()
    .min(1, "Selecciona la fecha del pago.")
    .refine((value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

      const date = new Date(`${value}T00:00:00`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "La fecha del pago no es válida."),
  sourceAccountId: z
    .string()
    .min(1, "Selecciona la cuenta desde la que realizaste el pago."),
  notes: z
    .string()
    .max(500, "Las notas no pueden superar los 500 caracteres."),
});

function getToday(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export default function LoanPaymentForm({
  loan,
  accounts,
  outstandingBalance,
  onSubmit,
  onCancel,
}: LoanPaymentFormProps) {
  const { toast } = useAlert();

  const defaultAccountId = accounts.some(
    (account) => account.id === loan.paymentAccountId,
  )
    ? loan.paymentAccountId!
    : accounts[0]?.id ?? "";

  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(getToday());
  const [sourceAccountId, setSourceAccountId] =
    useState(defaultAccountId);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputClassName =
    "mt-1.5 w-full rounded-xl border border-hairline bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-foreground disabled:cursor-not-allowed disabled:opacity-60";

  const parsedAmount = Number(amount);

  const amountIsValid =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    Math.abs(parsedAmount * 100 - Math.round(parsedAmount * 100)) <
      0.000001;

  const exceedsBalance =
    amountIsValid && parsedAmount > outstandingBalance + 0.000001;

  const remainingAfterPayment = amountIsValid
    ? Math.max(0, outstandingBalance - parsedAmount)
    : outstandingBalance;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const parsed = paymentSchema.safeParse({
      amount: Number(amount),
      paidAt,
      sourceAccountId,
      notes,
    });

    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ??
          "Revisa los datos del pago.",
        "Datos incompletos o inválidos",
      );
      return;
    }

    if (parsed.data.amount > outstandingBalance + 0.000001) {
      toast.error(
        `El importe no puede superar el saldo pendiente de ${formatCurrency(
          outstandingBalance,
        )}.`,
        "Importe superior al saldo",
      );
      return;
    }

    if (!accounts.some((account) => account.id === parsed.data.sourceAccountId)) {
      toast.error(
        "La cuenta seleccionada ya no está disponible.",
        "Cuenta no disponible",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      onSubmit({
        loanId: loan.id,
        amount: parsed.data.amount,
        paidAt: parsed.data.paidAt,
        sourceAccountId: parsed.data.sourceAccountId,
        notes: parsed.data.notes.trim() || null,
      });
    } catch (error) {
      console.error("Error al registrar el pago:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible registrar el pago.",
        "Error al registrar el pago",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loan-payment-title"
        className="my-auto w-full max-w-xl rounded-3xl bg-background p-5 shadow-2xl sm:p-7"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Gestión financiera
            </p>

            <h2
              id="loan-payment-title"
              className="mt-2 text-2xl font-bold tracking-tight text-foreground"
            >
              Registrar pago
            </h2>

            <p className="mt-1 text-sm text-muted">
              Registra el importe que realmente pagaste a este préstamo.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar formulario"
            disabled={isSubmitting}
            className="rounded-full p-2 text-muted transition hover:bg-surface-card hover:text-foreground disabled:opacity-40"
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Loan balance */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-muted">Saldo pendiente del préstamo</p>

            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(outstandingBalance)}
            </p>

            <p className="mt-1 text-xs text-muted">{loan.name}</p>
          </div>

          {/* Amount */}
          <div>
            <label
              htmlFor="loan-payment-amount"
              className="text-sm font-semibold text-foreground"
            >
              Importe pagado (MXN)
            </label>

            <input
              id="loan-payment-amount"
              type="number"
              min="0.01"
              max={outstandingBalance}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              disabled={isSubmitting || outstandingBalance <= 0}
              className={inputClassName}
            />

            {exceedsBalance && (
              <p className="mt-2 text-xs font-medium text-red-500">
                El importe supera el saldo pendiente.
              </p>
            )}

            {amountIsValid && !exceedsBalance && (
              <p className="mt-2 text-xs text-muted">
                Saldo restante después del pago:{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(remainingAfterPayment)}
                </span>
              </p>
            )}
          </div>

          {/* Payment date */}
          <div>
            <label
              htmlFor="loan-payment-date"
              className="text-sm font-semibold text-foreground"
            >
              Fecha del pago
            </label>

            <input
              id="loan-payment-date"
              type="date"
              value={paidAt}
              max={getToday()}
              onChange={(event) => setPaidAt(event.target.value)}
              disabled={isSubmitting}
              className={inputClassName}
            />
          </div>

          {/* Source account */}
          <div>
            <label
              htmlFor="loan-payment-account"
              className="text-sm font-semibold text-foreground"
            >
              Cuenta de origen
            </label>

            <select
              id="loan-payment-account"
              value={sourceAccountId}
              onChange={(event) => setSourceAccountId(event.target.value)}
              disabled={isSubmitting || accounts.length === 0}
              className={inputClassName}
            >
              <option value="">Selecciona una cuenta</option>

              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                  {account.id === loan.paymentAccountId
                    ? " (Cuenta configurada)"
                    : ""}
                </option>
              ))}
            </select>

            {accounts.length === 0 && (
              <p className="mt-2 text-xs text-red-500">
                Necesitas al menos una cuenta activa para registrar un pago.
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="loan-payment-notes"
              className="text-sm font-semibold text-foreground"
            >
              Notas{" "}
              <span className="font-normal text-muted">(Opcional)</span>
            </label>

            <textarea
              id="loan-payment-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ej. Pago realizado desde la aplicación bancaria."
              rows={3}
              maxLength={500}
              disabled={isSubmitting}
              className={`${inputClassName} resize-none`}
            />

            <p className="mt-1 text-right text-xs text-muted">
              {notes.length}/500
            </p>
          </div>

          {/* Allocation information */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 3v18M3 12h18" />
                </svg>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">
                  Aplicación automática del pago
                </p>

                <p className="mt-1 text-xs leading-5 text-muted">
                  El importe se distribuirá comenzando por las parcialidades
                  más antiguas, aplicándose primero a intereses, comisiones,
                  seguros y finalmente capital.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-hairline pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-full border border-hairline px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                accounts.length === 0 ||
                outstandingBalance <= 0 ||
                !amountIsValid ||
                exceedsBalance
              }
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Registrando..." : "Registrar pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
