
"use client";

import { useEffect, useState } from "react";

import {
  CreditCard,
  Wallet,
  X,
} from "lucide-react";

import type {
  Account,
  Bank,
  BankCard,
  CardType,
} from "@/types/account";

import type { CardData } from "@/services/card.service";

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

export interface CardFormData extends CardData {}

interface CardFormProps {
  banks: Bank[];
  accounts: Account[];
  card: BankCard | null;
  onSubmit: (data: CardFormData) => void;
  onCancel: () => void;
}

// -----------------------------------------------------------------------------
// COMPONENTE
// -----------------------------------------------------------------------------

export default function CardForm({
  banks,
  accounts,
  card,
  onSubmit,
  onCancel,
}: CardFormProps) {
  const [name, setName] = useState("");
  const [bankId, setBankId] = useState("");
  const [type, setType] = useState<CardType>("credit");

  const [linkedAccountId, setLinkedAccountId] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");

  const [creditLimit, setCreditLimit] = useState("");
  const [cutoffDay, setCutoffDay] = useState("");
  const [paymentDueDay, setPaymentDueDay] = useState("");

  const [error, setError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeAccounts = accounts.filter(
    (account) => account.status === "active",
  );

  const isEditing = card !== null;

  // ---------------------------------------------------------------------------
  // CARGA INICIAL
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (card) {
      setName(card.name);
      setBankId(card.bankId);
      setType(card.type);

      setLinkedAccountId(card.linkedAccountId ?? "");
      setPaymentAccountId(card.paymentAccountId ?? "");

      setCreditLimit(
        card.creditLimit !== null
          ? String(card.creditLimit)
          : "",
      );

      setCutoffDay(
        card.cutoffDay !== null
          ? String(card.cutoffDay)
          : "",
      );

      setPaymentDueDay(
        card.paymentDueDay !== null
          ? String(card.paymentDueDay)
          : "",
      );
    } else {
      setName("");
      setBankId("");
      setType("credit");

      setLinkedAccountId("");
      setPaymentAccountId("");

      setCreditLimit("");
      setCutoffDay("");
      setPaymentDueDay("");
    }

    setError("");
  }, [card]);

  // ---------------------------------------------------------------------------
  // CAMBIO DE TIPO
  // ---------------------------------------------------------------------------

  function handleTypeChange(newType: CardType) {
    setType(newType);

    setLinkedAccountId("");
    setPaymentAccountId("");

    setCreditLimit("");
    setCutoffDay("");
    setPaymentDueDay("");

    setError("");
  }

  // ---------------------------------------------------------------------------
  // VALIDACIONES
  // ---------------------------------------------------------------------------

  function validateForm(): string | null {
    if (!name.trim()) {
      return "El nombre de la tarjeta es obligatorio.";
    }

    if (!bankId) {
      return "Selecciona una institución bancaria.";
    }

    if (type === "debit" && !linkedAccountId) {
      return "Selecciona la cuenta vinculada a la tarjeta.";
    }

    if (type === "credit") {
      if (!creditLimit.trim()) {
        return "El límite de crédito es obligatorio.";
      }

      const parsedLimit = Number(creditLimit);

      if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
        return "El límite de crédito debe ser mayor que cero.";
      }

      if (!cutoffDay) {
        return "El día de corte es obligatorio.";
      }

      if (!paymentDueDay) {
        return "El día límite de pago es obligatorio.";
      }

      const parsedCutoffDay = Number(cutoffDay);
      const parsedPaymentDueDay = Number(paymentDueDay);

      if (
        !Number.isInteger(parsedCutoffDay) ||
        parsedCutoffDay < 1 ||
        parsedCutoffDay > 31
      ) {
        return "El día de corte debe estar entre 1 y 31.";
      }

      if (
        !Number.isInteger(parsedPaymentDueDay) ||
        parsedPaymentDueDay < 1 ||
        parsedPaymentDueDay > 31
      ) {
        return "El día límite de pago debe estar entre 1 y 31.";
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // ENVÍO
  // ---------------------------------------------------------------------------

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const data: CardFormData = {
      name: name.trim(),
      bankId,
      type,

      linkedAccountId:
        type === "debit" ? linkedAccountId || null : null,

      paymentAccountId:
        type === "credit" ? paymentAccountId || null : null,

      creditLimit:
        type === "credit" ? Number(creditLimit) : null,

      cutoffDay:
        type === "credit" ? Number(cutoffDay) : null,

      paymentDueDay:
        type === "credit" ? Number(paymentDueDay) : null,
    };

    try {
      setIsSubmitting(true);
      setError("");

      onSubmit(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible guardar la tarjeta.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // ESTILOS
  // ---------------------------------------------------------------------------

  const inputClassName =
    "w-full rounded-xl border border-hairline bg-background px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-foreground";

  const labelClassName =
    "mb-2 block text-sm font-medium text-foreground";

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-form-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface-card shadow-xl"
      >
        {/* Encabezado */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-surface-card px-6 py-5">
          <div>
            <h2
              id="card-form-title"
              className="text-xl font-bold tracking-tight text-foreground"
            >
              {isEditing ? "Editar tarjeta" : "Nueva tarjeta"}
            </h2>

            <p className="mt-1 text-sm text-muted">
              {isEditing
                ? "Actualiza la información de tu tarjeta."
                : "Registra una tarjeta para administrar tus compras y pagos."}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar formulario"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-background hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Tipo de tarjeta */}
          <section>
            <label className={labelClassName}>
              Tipo de tarjeta
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange("debit")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-4 text-sm font-semibold transition ${
                  type === "debit"
                    ? "border-foreground bg-brand-mint/30 text-foreground"
                    : "border-hairline bg-background text-muted hover:bg-surface-card"
                }`}
              >
                <Wallet className="h-5 w-5" />
                Débito
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange("credit")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-4 text-sm font-semibold transition ${
                  type === "credit"
                    ? "border-foreground bg-brand-lavender/30 text-foreground"
                    : "border-hairline bg-background text-muted hover:bg-surface-card"
                }`}
              >
                <CreditCard className="h-5 w-5" />
                Crédito
              </button>
            </div>
          </section>

          {/* Información general */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-foreground">
              Información general
            </h3>

            <div>
              <label htmlFor="card-name" className={labelClassName}>
                Nombre de la tarjeta
              </label>

              <input
                id="card-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Nu, BBVA Azul, Santander..."
                maxLength={60}
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label htmlFor="card-bank" className={labelClassName}>
                Institución bancaria
              </label>

              <select
                id="card-bank"
                value={bankId}
                onChange={(event) => setBankId(event.target.value)}
                className={inputClassName}
                required
              >
                <option value="">Selecciona un banco</option>

                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Configuración de débito */}
          {type === "debit" && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-foreground">
                Cuenta vinculada
              </h3>

              <div>
                <label
                  htmlFor="linked-account"
                  className={labelClassName}
                >
                  Cuenta asociada
                </label>

                <select
                  id="linked-account"
                  value={linkedAccountId}
                  onChange={(event) =>
                    setLinkedAccountId(event.target.value)
                  }
                  className={inputClassName}
                  required
                >
                  <option value="">Selecciona una cuenta</option>

                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs text-muted">
                  Los movimientos realizados con esta tarjeta se
                  asociarán a la cuenta seleccionada.
                </p>
              </div>
            </section>
          )}

          {/* Configuración de crédito */}
          {type === "credit" && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-foreground">
                Configuración de crédito
              </h3>

              <div>
                <label
                  htmlFor="credit-limit"
                  className={labelClassName}
                >
                  Límite de crédito
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">
                    $
                  </span>

                  <input
                    id="credit-limit"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={creditLimit}
                    onChange={(event) =>
                      setCreditLimit(event.target.value)
                    }
                    placeholder="0.00"
                    className={`${inputClassName} pl-8`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="cutoff-day"
                    className={labelClassName}
                  >
                    Día de corte
                  </label>

                  <input
                    id="cutoff-day"
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={cutoffDay}
                    onChange={(event) =>
                      setCutoffDay(event.target.value)
                    }
                    placeholder="Ej. 15"
                    className={inputClassName}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="payment-due-day"
                    className={labelClassName}
                  >
                    Día límite de pago
                  </label>

                  <input
                    id="payment-due-day"
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={paymentDueDay}
                    onChange={(event) =>
                      setPaymentDueDay(event.target.value)
                    }
                    placeholder="Ej. 5"
                    className={inputClassName}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="payment-account"
                  className={labelClassName}
                >
                  Cuenta habitual de pago
                  <span className="ml-1 font-normal text-muted">
                    (opcional)
                  </span>
                </label>

                <select
                  id="payment-account"
                  value={paymentAccountId}
                  onChange={(event) =>
                    setPaymentAccountId(event.target.value)
                  }
                  className={inputClassName}
                >
                  <option value="">Sin cuenta asignada</option>

                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs text-muted">
                  Puedes asignar una cuenta desde la que normalmente
                  realizas los pagos de esta tarjeta.
                </p>
              </div>
            </section>
          )}

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-col-reverse gap-3 border-t border-hairline pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-full border border-hairline px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-background disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "Guardando..."
                : isEditing
                  ? "Guardar cambios"
                  : "Registrar tarjeta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
