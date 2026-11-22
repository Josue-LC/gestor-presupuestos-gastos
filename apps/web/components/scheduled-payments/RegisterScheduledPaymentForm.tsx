
"use client";

import { useState } from "react";
import type {
  ScheduledPayment,
  ScheduledPaymentOccurrence,
} from "@/types/scheduled-payment.types";

export interface RegisterScheduledPaymentFormData {
  paymentId: string;
  occurrenceId: string;
  amount: number;
  paidAt: string;
  accountId: string;
}

interface AccountOption {
  id: string;
  name: string;
}

interface Props {
  payment: ScheduledPayment;
  occurrence: ScheduledPaymentOccurrence;
  accounts: AccountOption[];
  onClose: () => void;
  onSubmit: (data: RegisterScheduledPaymentFormData) => void;
}

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const inputClassName =
  "w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-primary disabled:cursor-not-allowed disabled:opacity-60";

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);

  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export default function RegisterScheduledPaymentForm({
  payment,
  occurrence,
  accounts,
  onClose,
  onSubmit,
}: Props) {
  const [amount, setAmount] = useState(
    occurrence.amount?.toString() ?? "",
  );

  const [paidAt, setPaidAt] = useState(getTodayDate());

  const [accountId, setAccountId] = useState(() => {
    const preferredAccount = payment.defaultAccountId;

    return preferredAccount &&
      accounts.some((account) => account.id === preferredAccount)
      ? preferredAccount
      : "";
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isSubmitting) return;

    const normalizedAmount = amount.trim();
    const parsedAmount = Number(normalizedAmount);

    if (
      !normalizedAmount ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(normalizedAmount)
    ) {
      setError(
        "Ingresa un importe mayor a cero y con máximo dos decimales.",
      );
      return;
    }

    if (!paidAt) {
      setError("Selecciona la fecha en la que realizaste el pago.");
      return;
    }

    if (!accountId) {
      setError("Selecciona la cuenta desde la que realizaste el pago.");
      return;
    }

    setIsSubmitting(true);

    try {
      onSubmit({
        paymentId: payment.id,
        occurrenceId: occurrence.id,
        amount: parsedAmount,
        paidAt,
        accountId,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible registrar el pago.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-scheduled-payment-title"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-hairline bg-background shadow-2xl"
      >
        <div className="border-b border-hairline px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Confirmación de pago
              </p>

              <h2
                id="register-scheduled-payment-title"
                className="mt-2 text-xl font-semibold text-foreground"
              >
                Registrar pago
              </h2>

              <p className="mt-1 text-sm text-muted">
                Confirma los datos del movimiento que realizaste.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Cerrar formulario"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-card hover:text-foreground disabled:opacity-50"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-hairline bg-surface-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">
                  {payment.name}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {payment.category}
                </p>
              </div>

              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
                Pendiente
              </span>
            </div>

            <div className="mt-4 border-t border-hairline pt-3">
              <p className="text-xs text-muted">Fecha del vencimiento</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formatDate(occurrence.dueDate)}
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="register-payment-amount"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Importe pagado *
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">
                $
              </span>

              <input
                id="register-payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className={`${inputClassName} pl-8`}
                required
                autoFocus
              />
            </div>

            {payment.amount !== null && (
              <p className="mt-2 text-xs text-muted">
                {payment.amountType === "fixed"
                  ? `Importe programado: ${currencyFormatter.format(payment.amount)}`
                  : `Importe estimado: ${currencyFormatter.format(payment.amount)}`}
              </p>
            )}

            <p className="mt-1 text-xs text-muted">
              Registra el importe que realmente salió de tu cuenta.
            </p>
          </div>

          <div>
            <label
              htmlFor="register-payment-date"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Fecha del pago *
            </label>

            <input
              id="register-payment-date"
              type="date"
              value={paidAt}
              max={getTodayDate()}
              onChange={(event) => setPaidAt(event.target.value)}
              className={inputClassName}
              required
            />
          </div>

          <div>
            <label
              htmlFor="register-payment-account"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Cuenta utilizada *
            </label>

            <select
              id="register-payment-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className={inputClassName}
              required
            >
              <option value="">Selecciona una cuenta</option>

              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>

            {accounts.length === 0 && (
              <p className="mt-2 text-xs text-red-500">
                No hay cuentas activas disponibles para registrar el gasto.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-sm font-medium text-foreground">
              ¿Qué sucederá al confirmar?
            </p>

            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted">
              <li>• Se creará un gasto en tus transacciones.</li>
              <li>• Se marcará este vencimiento como pagado.</li>
              <li>• El movimiento quedará asociado a la cuenta seleccionada.</li>
            </ul>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-hairline pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full border border-hairline px-6 py-3 text-sm font-medium text-foreground transition hover:bg-surface-card disabled:opacity-50"
            >
              Volver
            </button>

            <button
              type="submit"
              disabled={isSubmitting || accounts.length === 0}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Registrando..." : "Confirmar pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
