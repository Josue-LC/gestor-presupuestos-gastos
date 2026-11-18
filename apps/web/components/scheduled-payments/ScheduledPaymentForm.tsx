
"use client";

import { useEffect, useState } from "react";
import type {
  ScheduledPayment,
  ScheduledPaymentAmountType,
  ScheduledPaymentFrequency,
} from "@/types/scheduled-payment.types";

export interface ScheduledPaymentFormData {
  name: string;
  description: string | null;
  category: string;
  frequency: ScheduledPaymentFrequency;
  amountType: ScheduledPaymentAmountType;
  amount: number | null;
  firstDueDate: string;
  endDate: string | null;
  defaultAccountId: string | null;
  notes: string | null;
}

interface AccountOption {
  id: string;
  name: string;
}

interface Props {
  initialData?: ScheduledPayment | null;
  accounts: AccountOption[];
  hasOccurrences?: boolean;
  onClose: () => void;
  onSubmit: (data: ScheduledPaymentFormData) => Promise<void>;
}

const frequencyOptions: {
  value: ScheduledPaymentFrequency;
  label: string;
}[] = [
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
  { value: "bimonthly", label: "Bimestral" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
];

const inputClassName =
  "w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-primary disabled:cursor-not-allowed disabled:opacity-60";

const labelClassName = "mb-2 block text-sm font-medium text-foreground";

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function ScheduledPaymentForm({
  initialData,
  accounts,
  hasOccurrences = false,
  onClose,
  onSubmit,
}: Props) {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? "",
  );
  const [category, setCategory] = useState(
    initialData?.category ?? "",
  );

  const [frequency, setFrequency] =
    useState<ScheduledPaymentFrequency>(
      initialData?.frequency ?? "monthly",
    );

  const [amountType, setAmountType] =
    useState<ScheduledPaymentAmountType>(
      initialData?.amountType ?? "fixed",
    );

  const [amount, setAmount] = useState(
    initialData?.amount?.toString() ?? "",
  );

  const [firstDueDate, setFirstDueDate] = useState(
    initialData?.firstDueDate ?? getTodayDate(),
  );

  const [endDate, setEndDate] = useState(
    initialData?.endDate ?? "",
  );

  const [defaultAccountId, setDefaultAccountId] = useState(
    initialData?.defaultAccountId ?? "",
  );

  const [notes, setNotes] = useState(initialData?.notes ?? "");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (amountType === "variable" && amount === "") {
      return;
    }

    if (amountType === "fixed" && amount === "") {
      setAmount("");
    }
  }, [amountType, amount]);

  const handleAmountTypeChange = (
    nextType: ScheduledPaymentAmountType,
  ) => {
    setAmountType(nextType);
    setError("");

    if (nextType === "variable" && amount === "") {
      return;
    }
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError("");

    const normalizedName = name.trim();
    const normalizedCategory = category.trim();
    const normalizedAmount = amount.trim();

    if (!normalizedName) {
      setError("Ingresa el nombre del pago.");
      return;
    }

    if (!normalizedCategory) {
      setError("Ingresa una categoría.");
      return;
    }

    if (amountType === "fixed" && !normalizedAmount) {
      setError("El importe es obligatorio para pagos fijos.");
      return;
    }

    let parsedAmount: number | null = null;

    if (normalizedAmount) {
      parsedAmount = Number(normalizedAmount);

      if (
        !Number.isFinite(parsedAmount) ||
        parsedAmount <= 0 ||
        !/^\d+(\.\d{1,2})?$/.test(normalizedAmount)
      ) {
        setError(
          "El importe debe ser mayor a cero y tener máximo dos decimales.",
        );
        return;
      }
    }

    if (!firstDueDate) {
      setError("Selecciona la fecha del primer vencimiento.");
      return;
    }

    if (endDate && endDate < firstDueDate) {
      setError(
        "La fecha de finalización no puede ser anterior al primer vencimiento.",
      );
      return;
    }

    const data: ScheduledPaymentFormData = {
      name: normalizedName,
      description: description.trim() || null,
      category: normalizedCategory,
      frequency,
      amountType,
      amount: parsedAmount,
      firstDueDate,
      endDate: endDate || null,
      defaultAccountId: defaultAccountId || null,
      notes: notes.trim() || null,
    };

    try {
      setIsSubmitting(true);
      await onSubmit(data);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar el pago recurrente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-hairline bg-background shadow-2xl">
        <div className="flex items-start justify-between border-b border-hairline px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEditing
                ? "Editar pago recurrente"
                : "Nuevo pago recurrente"}
            </h2>

            <p className="mt-1 text-sm text-muted">
              Configura los detalles y la programación del pago.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar formulario"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-card hover:text-foreground disabled:opacity-50"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 overflow-y-auto px-6 py-6"
        >
          {/* Información general */}
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Información general
              </h3>
              <p className="mt-1 text-xs text-muted">
                Identifica el servicio o compromiso que deseas programar.
              </p>
            </div>

            <div>
              <label htmlFor="scheduled-name" className={labelClassName}>
                Nombre del pago *
              </label>

              <input
                id="scheduled-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Netflix, Internet, Renta..."
                maxLength={100}
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label
                htmlFor="scheduled-description"
                className={labelClassName}
              >
                Descripción
                <span className="ml-1 font-normal text-muted">
                  (opcional)
                </span>
              </label>

              <input
                id="scheduled-description"
                type="text"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Agrega algún detalle del pago..."
                maxLength={200}
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="scheduled-category"
                className={labelClassName}
              >
                Categoría *
              </label>

              <input
                id="scheduled-category"
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Ej. Entretenimiento, Servicios, Vivienda..."
                maxLength={60}
                className={inputClassName}
                required
              />
            </div>
          </section>

          <div className="border-t border-hairline" />

          {/* Importe */}
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Importe del pago
              </h3>
              <p className="mt-1 text-xs text-muted">
                Indica si el importe se mantiene o cambia en cada periodo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleAmountTypeChange("fixed")}
                className={`rounded-2xl border p-4 text-left transition ${
                  amountType === "fixed"
                    ? "border-primary bg-primary/5"
                    : "border-hairline hover:bg-surface-card"
                }`}
              >
                <p className="text-sm font-semibold text-foreground">
                  Importe fijo
                </p>
                <p className="mt-1 text-xs text-muted">
                  Siempre pagas la misma cantidad.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleAmountTypeChange("variable")}
                className={`rounded-2xl border p-4 text-left transition ${
                  amountType === "variable"
                    ? "border-primary bg-primary/5"
                    : "border-hairline hover:bg-surface-card"
                }`}
              >
                <p className="text-sm font-semibold text-foreground">
                  Importe variable
                </p>
                <p className="mt-1 text-xs text-muted">
                  El importe puede cambiar en cada pago.
                </p>
              </button>
            </div>

            <div>
              <label
                htmlFor="scheduled-amount"
                className={labelClassName}
              >
                {amountType === "fixed"
                  ? "Importe *"
                  : "Importe estimado"}
              </label>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">
                  $
                </span>

                <input
                  id="scheduled-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className={`${inputClassName} pl-8`}
                  required={amountType === "fixed"}
                />
              </div>

              {amountType === "variable" && (
                <p className="mt-2 text-xs text-muted">
                  Puedes dejarlo vacío si todavía no conoces el importe.
                  Al registrar el pago indicarás cuánto pagaste realmente.
                </p>
              )}
            </div>
          </section>

          <div className="border-t border-hairline" />

          {/* Programación */}
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Programación
              </h3>
              <p className="mt-1 text-xs text-muted">
                Define cuándo se genera el próximo vencimiento.
              </p>
            </div>

            <div>
              <label
                htmlFor="scheduled-frequency"
                className={labelClassName}
              >
                Frecuencia *
              </label>

              <select
                id="scheduled-frequency"
                value={frequency}
                onChange={(event) =>
                  setFrequency(
                    event.target.value as ScheduledPaymentFrequency,
                  )
                }
                className={inputClassName}
              >
                {frequencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="scheduled-first-date"
                  className={labelClassName}
                >
                  Primer vencimiento *
                </label>

                <input
                  id="scheduled-first-date"
                  type="date"
                  value={firstDueDate}
                  onChange={(event) =>
                    setFirstDueDate(event.target.value)
                  }
                  disabled={isEditing && hasOccurrences}
                  className={inputClassName}
                  required
                />

                {isEditing && hasOccurrences && (
                  <p className="mt-2 text-xs text-muted">
                    No puedes modificar esta fecha porque ya existen
                    vencimientos registrados.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="scheduled-end-date"
                  className={labelClassName}
                >
                  Fecha de finalización
                </label>

                <input
                  id="scheduled-end-date"
                  type="date"
                  value={endDate}
                  min={firstDueDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className={inputClassName}
                />

                <p className="mt-2 text-xs text-muted">
                  Déjala vacía si no tiene fecha de finalización.
                </p>
              </div>
            </div>
          </section>

          <div className="border-t border-hairline" />

          {/* Cuenta asociada */}
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Cuenta asociada
              </h3>
              <p className="mt-1 text-xs text-muted">
                Puedes sugerir una cuenta para cuando registres el pago.
              </p>
            </div>

            <div>
              <label
                htmlFor="scheduled-account"
                className={labelClassName}
              >
                Cuenta predeterminada
              </label>

              <select
                id="scheduled-account"
                value={defaultAccountId}
                onChange={(event) =>
                  setDefaultAccountId(event.target.value)
                }
                className={inputClassName}
              >
                <option value="">Sin cuenta predeterminada</option>

                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>

              {accounts.length === 0 && (
                <p className="mt-2 text-xs text-muted">
                  No tienes cuentas activas disponibles. Puedes continuar
                  sin asociar una cuenta.
                </p>
              )}
            </div>
          </section>

          {/* Notas */}
          <section>
            <label
              htmlFor="scheduled-notes"
              className={labelClassName}
            >
              Notas
              <span className="ml-1 font-normal text-muted">
                (opcional)
              </span>
            </label>

            <textarea
              id="scheduled-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Agrega información adicional..."
              rows={3}
              maxLength={500}
              className={`${inputClassName} resize-none`}
            />
          </section>

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
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Guardando..."
                : isEditing
                  ? "Guardar cambios"
                  : "Crear pago recurrente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
