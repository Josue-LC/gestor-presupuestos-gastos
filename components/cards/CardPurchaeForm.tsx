"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import type {
  BankCard,
  InstallmentInterestType,
} from "@/types/account";

import type {
  CreateCardPurchaseData,
} from "@/services/card-purchase.service";

interface CardPurchaseFormProps {
  card: BankCard;
  onSubmit: (data: CreateCardPurchaseData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function getLocalDate(): string {
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

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function calculatePreview(
  principal: number,
  count: number,
  interestType: InstallmentInterestType,
  fixedInterest: number,
  annualRate: number,
): {
  monthlyPayment: number;
  totalInterest: number;
  totalAmount: number;
} {
  if (
    !Number.isFinite(principal) ||
    principal <= 0 ||
    !Number.isInteger(count) ||
    count < 2
  ) {
    return {
      monthlyPayment: 0,
      totalInterest: 0,
      totalAmount: 0,
    };
  }

  if (interestType === "none") {
    return {
      monthlyPayment: roundMoney(principal / count),
      totalInterest: 0,
      totalAmount: principal,
    };
  }

  if (interestType === "fixed") {
    if (!Number.isFinite(fixedInterest) || fixedInterest <= 0) {
      return {
        monthlyPayment: 0,
        totalInterest: 0,
        totalAmount: 0,
      };
    }

    const normalizedInterest = roundMoney(fixedInterest);
    const totalAmount = roundMoney(principal + normalizedInterest);

    return {
      monthlyPayment: roundMoney(totalAmount / count),
      totalInterest: normalizedInterest,
      totalAmount,
    };
  }

  if (
    !Number.isFinite(annualRate) ||
    annualRate <= 0 ||
    annualRate > 1000
  ) {
    return {
      monthlyPayment: 0,
      totalInterest: 0,
      totalAmount: 0,
    };
  }

  const monthlyRate = annualRate / 100 / 12;
  const discountFactor = Math.pow(1 + monthlyRate, -count);

  // Fórmula de amortización francesa en una forma
  // numéricamente más estable.
  const monthlyPayment = roundMoney(
    (principal * monthlyRate) / (1 - discountFactor),
  );

  // La vista previa es aproximada. El servicio calcula cada periodo
  // y corrige el redondeo de la última mensualidad.
  const totalAmount = roundMoney(monthlyPayment * count);

  return {
    monthlyPayment,
    totalInterest: roundMoney(totalAmount - principal),
    totalAmount,
  };
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

  const [interestType, setInterestType] =
    useState<InstallmentInterestType>("none");

  const [interestAmount, setInterestAmount] = useState("");
  const [annualInterestRate, setAnnualInterestRate] = useState("");

  const [error, setError] = useState("");

  const isCreditCard = card.type === "credit";

  const hasBillingConfiguration =
    card.cutoffDay !== null &&
    card.cutoffDay !== undefined &&
    card.paymentDueDay !== null &&
    card.paymentDueDay !== undefined;

  useEffect(() => {
    if (
      !isCreditCard ||
      purchaseType !== "installments" ||
      !purchaseDate ||
      !hasBillingConfiguration
    ) {
      return;
    }

    setFirstDueDate(
      getSuggestedFirstDueDate(
        purchaseDate,
        card.cutoffDay!,
        card.paymentDueDay!,
      ),
    );
  }, [
    isCreditCard,
    purchaseType,
    purchaseDate,
    hasBillingConfiguration,
    card.cutoffDay,
    card.paymentDueDay,
  ]);

  const preview = useMemo(() => {
    return calculatePreview(
      Number(amount),
      Number(installmentCount),
      interestType,
      Number(interestAmount),
      Number(annualInterestRate),
    );
  }, [
    amount,
    installmentCount,
    interestType,
    interestAmount,
    annualInterestRate,
  ]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const numericAmount = Number(amount);
    const numericInterest = Number(interestAmount);
    const numericRate = Number(annualInterestRate);
    const numericCount = Number(installmentCount);

    if (!description.trim()) {
      setError("Ingresa una descripción para la compra.");
      return;
    }

    if (!category.trim()) {
      setError("Ingresa una categoría para la compra.");
      return;
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      Math.round(numericAmount * 100) !== numericAmount * 100
    ) {
      setError("Ingresa un importe válido con máximo dos decimales.");
      return;
    }

    if (!purchaseDate || purchaseDate > today) {
      setError("Selecciona una fecha de compra válida.");
      return;
    }

    if (isCreditCard && purchaseType === "installments") {
      if (
        !Number.isInteger(numericCount) ||
        numericCount < 2 ||
        numericCount > 120
      ) {
        setError("El número de parcialidades debe estar entre 2 y 120.");
        return;
      }

      if (!firstDueDate || firstDueDate <= purchaseDate) {
        setError(
          "La primera parcialidad debe ser posterior a la fecha de compra.",
        );
        return;
      }

      if (interestType === "fixed") {
        if (
          !Number.isFinite(numericInterest) ||
          numericInterest <= 0 ||
          Math.round(numericInterest * 100) !== numericInterest * 100
        ) {
          setError("Ingresa un importe de intereses válido.");
          return;
        }
      }

      if (interestType === "annual_rate") {
        if (
          !Number.isFinite(numericRate) ||
          numericRate <= 0 ||
          numericRate > 1000
        ) {
          setError("Ingresa una tasa anual mayor a 0 y hasta 1000%.");
          return;
        }
      }
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
            installmentCount: numericCount,
            firstDueDate,
            interestType,
            interestAmount:
              interestType === "fixed" ? roundMoney(numericInterest) : 0,
            annualInterestRate:
              interestType === "annual_rate" ? numericRate : null,
          }
        : {}),
    });
  }

  const inputClassName =
    "w-full rounded-xl border border-hairline bg-surface-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-brand-mint";

  const labelClassName =
    "mb-1.5 block text-sm font-medium text-foreground";

  const formatCurrency = (value: number) =>
    value.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="text-sm text-muted">Tarjeta seleccionada</p>
        <p className="mt-1 font-semibold text-foreground">{card.name}</p>
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
        <label className={labelClassName}>Importe de compra (MXN)</label>
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
          onChange={(event) => setPurchaseDate(event.target.value)}
          className={inputClassName}
          disabled={isSubmitting}
        />
      </div>

      {isCreditCard && (
        <div>
          <label className={labelClassName}>Modalidad de compra</label>

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
              Parcialidades
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
              onChange={(event) => setInstallmentCount(event.target.value)}
              className={inputClassName}
              disabled={isSubmitting}
            >
              {[3, 6, 9, 12, 18, 24, 36, 48, 60, 72, 84, 96, 120].map(
                (count) => (
                  <option key={count} value={count}>
                    {count} meses
                  </option>
                ),
              )}
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
                ? "Fecha sugerida según el ciclo de facturación de tu tarjeta. Puedes modificarla."
                : "Selecciona manualmente la fecha de la primera parcialidad."}
            </p>
          </div>

          <div>
            <label className={labelClassName}>Tipo de interés</label>

            <select
              value={interestType}
              onChange={(event) =>
                setInterestType(
                  event.target.value as InstallmentInterestType,
                )
              }
              className={inputClassName}
              disabled={isSubmitting}
            >
              <option value="none">Meses sin intereses</option>
              <option value="fixed">Interés fijo total</option>
              <option value="annual_rate">Tasa anual nominal</option>
            </select>
          </div>

          {interestType === "fixed" && (
            <div>
              <label className={labelClassName}>
                Importe total de intereses (MXN)
              </label>

              <input
                type="number"
                value={interestAmount}
                onChange={(event) => setInterestAmount(event.target.value)}
                min="0.01"
                step="0.01"
                placeholder="Ej. 1500.00"
                className={inputClassName}
                disabled={isSubmitting}
              />

              <p className="mt-1 text-xs text-muted">
                Captura el importe total de intereses que pagarás durante
                todo el financiamiento.
              </p>
            </div>
          )}

          {interestType === "annual_rate" && (
            <div>
              <label className={labelClassName}>
                Tasa anual nominal (%)
              </label>

              <input
                type="number"
                value={annualInterestRate}
                onChange={(event) =>
                  setAnnualInterestRate(event.target.value)
                }
                min="0.01"
                max="1000"
                step="0.01"
                placeholder="Ej. 24.00"
                className={inputClassName}
                disabled={isSubmitting}
              />

              <p className="mt-1 text-xs text-muted">
                Se calculará mediante amortización francesa. No se agrega
                IVA automáticamente.
              </p>
            </div>
          )}

          <div className="rounded-lg bg-brand-lavender/20 p-4">
            <p className="text-xs font-medium text-muted">
              Resumen estimado del financiamiento
            </p>

            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted">Capital</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(Number(amount) || 0)}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-muted">Intereses</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(preview.totalInterest)}
                </span>
              </div>

              <div className="flex justify-between gap-3 border-t border-hairline pt-2">
                <span className="font-semibold text-foreground">
                  Total financiado
                </span>
                <span className="font-bold text-foreground">
                  {formatCurrency(preview.totalAmount)}
                </span>
              </div>
            </div>

            <div className="mt-4 border-t border-hairline pt-3">
              <p className="text-xs text-muted">
                Mensualidad aproximada
              </p>

              <p className="mt-1 text-xl font-bold text-foreground">
                {formatCurrency(preview.monthlyPayment)}
              </p>

              <p className="mt-1 text-xs text-muted">
                El calendario definitivo se calcula al registrar la compra.
                La última mensualidad puede tener una diferencia por redondeo.
              </p>
            </div>
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