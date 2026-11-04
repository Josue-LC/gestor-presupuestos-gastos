
"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { BankCard } from "@/types/account";
import type { CreateCardPurchaseData } from "@/services/card-purchase.service";

interface CardPurchaseFormProps {
  card: BankCard;
  onSubmit: (data: CreateCardPurchaseData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function getLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateWithClampedDay(
  year: number,
  month: number,
  day: number,
): string {
  const lastDay = new Date(year, month + 1, 0).getDate();

  return formatDateISO(
    new Date(year, month, Math.min(day, lastDay)),
  );
}

function getNextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);

  return formatDateISO(
    new Date(year, month - 1, day + 1),
  );
}

function getSuggestedFirstDueDate(
  purchaseDate: string,
  cutoffDay: number,
  paymentDueDay: number,
): string {
  const [year, month, day] = purchaseDate.split("-").map(Number);

  // Compra en o antes del corte: siguiente ciclo.
  // Compra después del corte: ciclo posterior.
  const monthsToAdd = day <= cutoffDay ? 1 : 2;

  const targetDate = new Date(
    year,
    month - 1 + monthsToAdd,
    1,
  );

  return getDateWithClampedDay(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    paymentDueDay,
  );
}

export default function CardPurchaseForm({
  card,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CardPurchaseFormProps) {
  const today = getLocalDate();

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today);

  const [purchaseType, setPurchaseType] = useState<
    "single" | "installments"
  >("single");

  const [installmentCount, setInstallmentCount] = useState("3");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [error, setError] = useState("");

  const isCreditCard = card.type === "credit";

  const hasBillingConfiguration =
    card.cutoffDay !== null &&
    card.cutoffDay !== undefined &&
    card.paymentDueDay !== null &&
    card.paymentDueDay !== undefined;

  // Actualizar la fecha sugerida cuando cambie la compra
  // o se active la modalidad de meses sin intereses.
  useEffect(() => {
    if (
      !isCreditCard ||
      purchaseType !== "installments" ||
      !purchaseDate ||
      !hasBillingConfiguration
    ) {
      return;
    }

    const suggestedDate = getSuggestedFirstDueDate(
      purchaseDate,
      card.cutoffDay!,
      card.paymentDueDay!,
    );

    setFirstDueDate(suggestedDate);
  }, [
    isCreditCard,
    purchaseType,
    purchaseDate,
    hasBillingConfiguration,
    card.cutoffDay,
    card.paymentDueDay,
  ]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const numericAmount = Number(amount);

    if (!description.trim()) {
      setError("Ingresa una descripción para la compra.");
      return;
    }

    if (!category.trim()) {
      setError("Ingresa una categoría para la compra.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Ingresa un importe válido mayor a cero.");
      return;
    }

    if (!purchaseDate) {
      setError("Selecciona la fecha de compra.");
      return;
    }

    if (
      purchaseType === "installments" &&
      isCreditCard &&
      Number(installmentCount) < 2
    ) {
      setError("El número de parcialidades debe ser como mínimo 2.");
      return;
    }

    if (
      purchaseType === "installments" &&
      isCreditCard &&
      (!firstDueDate || firstDueDate <= purchaseDate)
    ) {
      setError(
        "La primera parcialidad debe ser posterior a la fecha de compra.",
      );
      return;
    }

    onSubmit({
      cardId: card.id,
      description: description.trim(),
      category: category.trim(),
      amount: numericAmount,
      purchaseDate,
      purchaseType: isCreditCard ? purchaseType : "single",
      ...(isCreditCard && purchaseType === "installments"
        ? {
            installmentCount: Number(installmentCount),
            firstDueDate,
          }
        : {}),
    });
  }

  const inputClassName =
    "w-full rounded-xl border border-hairline bg-surface-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-brand-mint";

  const labelClassName =
    "mb-1.5 block text-sm font-medium text-foreground";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="text-sm text-muted">Tarjeta seleccionada</p>

        <p className="mt-1 font-semibold text-foreground">
          {card.name}
        </p>

        <p className="text-xs text-muted">
          {isCreditCard ? "Tarjeta de crédito" : "Tarjeta de débito"}
        </p>
      </div>

      <div>
        <label className={labelClassName}>Descripción</label>

        <input
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ej. Compra de supermercado"
          maxLength={100}
          className={inputClassName}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className={labelClassName}>Categoría</label>

        <input
          type="text"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Ej. Alimentación"
          maxLength={50}
          className={inputClassName}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className={labelClassName}>Importe (MXN)</label>

        <input
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
          min="0.01"
          step="0.01"
          className={inputClassName}
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className={labelClassName}>Fecha de compra</label>

        <input
          type="date"
          value={purchaseDate}
          max={today}
          onChange={(event) => {
            setPurchaseDate(event.target.value);
          }}
          className={inputClassName}
          disabled={isSubmitting}
        />
      </div>

      {isCreditCard && (
        <div>
          <label className={labelClassName}>
            Modalidad de compra
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPurchaseType("single")}
              disabled={isSubmitting}
              className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                purchaseType === "single"
                  ? "border-brand-mint bg-brand-mint/20 text-foreground"
                  : "border-hairline text-muted hover:bg-surface-card"
              }`}
            >
              Una sola exhibición
            </button>

            <button
              type="button"
              onClick={() => setPurchaseType("installments")}
              disabled={isSubmitting}
              className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                purchaseType === "installments"
                  ? "border-brand-mint bg-brand-mint/20 text-foreground"
                  : "border-hairline text-muted hover:bg-surface-card"
              }`}
            >
              Meses sin intereses
            </button>
          </div>
        </div>
      )}

      {isCreditCard && purchaseType === "installments" && (
        <div className="space-y-4 rounded-xl border border-hairline bg-surface-card p-4">
          <div>
            <label className={labelClassName}>
              Número de parcialidades
            </label>

            <select
              value={installmentCount}
              onChange={(event) =>
                setInstallmentCount(event.target.value)
              }
              className={inputClassName}
              disabled={isSubmitting}
            >
              {[3, 6, 9, 12, 18, 24, 36, 48].map((count) => (
                <option key={count} value={count}>
                  {count} meses
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              Fecha de la primera parcialidad
            </label>

            <input
              type="date"
              value={firstDueDate}
              min={getNextDate(purchaseDate)}
              onChange={(event) => setFirstDueDate(event.target.value)}
              className={inputClassName}
              disabled={isSubmitting}
            />

            <p className="mt-1.5 text-xs text-muted">
              {hasBillingConfiguration
                ? "Fecha sugerida según el ciclo de facturación de tu tarjeta. Puedes modificarla si es necesario."
                : "No hay días de corte y pago configurados para esta tarjeta. Selecciona manualmente la fecha de la primera parcialidad."}
            </p>

            <p className="mt-1.5 text-xs text-muted">
              Las siguientes parcialidades se programarán mensualmente a partir de esta fecha.
            </p>
          </div>

          <div className="rounded-lg bg-brand-lavender/20 p-3">
            <p className="text-xs text-muted">
              Importe aproximado por mes
            </p>

            <p className="mt-1 text-lg font-semibold text-foreground">
              {Number(amount) > 0
                ? (Number(amount) / Number(installmentCount)).toLocaleString(
                    "es-MX",
                    {
                      style: "currency",
                      currency: "MXN",
                    },
                  )
                : "$0.00"}
            </p>

            <p className="mt-1 text-xs text-muted">
              El importe se calcula dividiendo el total entre las parcialidades.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-hairline pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-xl border border-hairline px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface-card disabled:opacity-50"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Registrando..." : "Registrar compra"}
        </button>
      </div>
    </form>
  );
}
