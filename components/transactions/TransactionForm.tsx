
"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";

import type { Transaction } from "@/components/transactions/TransactionList";
import { getTransactionCategoryNames } from "@/lib/transaction-categories";
import { useAlert } from "@/context/AlertContext";

import {
  getCardPaymentAllocationTargets,
  type CardPaymentAllocationTarget,
  type ManualCardPaymentAllocation,
} from "@/services/card-payment.service";

export type TransactionAccountOption = {
  id: string;
  name: string;
};

type TransactionAccount = string | TransactionAccountOption;

export type NewTransactionData = {
  description: string;
  category: string;
  account: string;
  date: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  cardPayment?: {
    cardId: string;
    allocations: ManualCardPaymentAllocation[];
  };
};

interface TransactionFormProps {
  accounts: TransactionAccount[];
  destinationAccounts?: TransactionAccount[];
  transaction?: Transaction | null;
  initialType?: "income" | "expense" | "transfer";
  initialAccount?: string;
  onSubmit: (data: NewTransactionData) => void;
  onCancel: () => void;
}

const transactionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Escribe una descripción.")
    .max(120, "La descripción no puede superar los 120 caracteres."),

  amount: z
    .number({
      error: "Ingresa un importe válido.",
    })
    .finite("El importe debe ser un número válido.")
    .positive("El importe debe ser mayor que cero."),

  date: z
    .string()
    .min(1, "Selecciona una fecha.")
    .refine((value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

      const parsedDate = new Date(`${value}T00:00:00`);

      return (
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === value
      );
    }, "La fecha de operación no es válida."),

  account: z
    .string()
    .trim()
    .min(1, "Selecciona una cuenta."),

  category: z
    .string()
    .trim()
    .min(1, "Selecciona una categoría."),
});

function getToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - offset)
    .toISOString()
    .slice(0, 10);
}

function getDateInputValue(date: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return getToday();

  const offset = parsed.getTimezoneOffset() * 60_000;

  return new Date(parsed.getTime() - offset)
    .toISOString()
    .slice(0, 10);
}

function getAccountId(account: TransactionAccount): string {
  return typeof account === "string" ? account : account.id;
}

function getAccountLabel(account: TransactionAccount): string {
  return typeof account === "string" ? account : account.name;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TransactionForm({
  accounts,
  destinationAccounts,
  transaction,
  initialType,
  initialAccount,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const { toast } = useAlert();

  const isEditing = Boolean(transaction);

  const initialAccounts =
    transaction?.type === "transfer"
      ? transaction.account.split(" → ")
      : [transaction?.account ?? ""];

  const effectiveInitialType =
    transaction?.type ?? initialType ?? "expense";

  const accountOptions = accounts.map((item) => ({
    id: getAccountId(item),
    name: getAccountLabel(item),
  }));

  const destinationAccountOptions = (
    destinationAccounts ?? accounts
  ).map((item) => ({
    id: getAccountId(item),
    name: getAccountLabel(item),
  }));

  const [type, setType] = useState<
    "income" | "expense" | "transfer"
  >(effectiveInitialType);

  const [description, setDescription] = useState(
    transaction?.description ?? "",
  );

  const [amount, setAmount] = useState(
    transaction ? String(Math.abs(transaction.amount)) : "",
  );

  const [date, setDate] = useState(
    transaction ? getDateInputValue(transaction.date) : getToday(),
  );

  const [account, setAccount] = useState(
    initialAccounts[0] ||
      initialAccount ||
      accountOptions[0]?.id ||
      "",
  );

  const [category, setCategory] = useState(() => {
    if (effectiveInitialType === "transfer") return "";

    const initialCategories = getTransactionCategoryNames(
      effectiveInitialType,
    );

    return initialCategories.includes(transaction?.category ?? "")
      ? transaction?.category ?? ""
      : "";
  });

  const [destinationAccount, setDestinationAccount] = useState(
    initialAccounts[1] || destinationAccountOptions[1]?.id || "",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // ASIGNACIÓN MANUAL DE PAGOS A TARJETAS
  // ---------------------------------------------------------------------------

  const [allocationTargets, setAllocationTargets] = useState<
    CardPaymentAllocationTarget[]
  >([]);

  const [allocationAmounts, setAllocationAmounts] = useState<
    Record<string, string>
  >({});

  const selectedCardId = destinationAccount.startsWith("card:")
    ? destinationAccount.replace("card:", "")
    : null;

  const isCreditCardTransfer =
    type === "transfer" && Boolean(selectedCardId);

  const availableCategories =
    type === "transfer" ? [] : getTransactionCategoryNames(type);

  const manualAllocations = useMemo<ManualCardPaymentAllocation[]>(
    () => {
      return allocationTargets.flatMap((target) => {
        const amount = Number(allocationAmounts[target.id]);

        if (!Number.isFinite(amount) || amount <= 0) {
          return [];
        }

        return [
          {
            type: target.type,
            ...(target.type === "single_purchase"
              ? { purchaseId: target.id }
              : { installmentId: target.id }),
            amount: Math.round(amount * 100) / 100,
          },
        ];
      });
    },
    [allocationTargets, allocationAmounts],
  );

  const totalAllocated = useMemo(
    () =>
      Math.round(
        manualAllocations.reduce(
          (total, allocation) => total + allocation.amount,
          0,
        ) * 100,
      ) / 100,
    [manualAllocations],
  );

  const transferAmount = Number(amount) || 0;

  const unappliedAmount = Math.max(
    0,
    Math.round((transferAmount - totalAllocated) * 100) / 100,
  );

  // Consultar los conceptos pendientes cuando se selecciona una tarjeta.
  useEffect(() => {
    if (!isCreditCardTransfer || !selectedCardId) {
      setAllocationTargets([]);
      setAllocationAmounts({});
      return;
    }

    try {
      const targets = getCardPaymentAllocationTargets(selectedCardId);

      setAllocationTargets(targets);
      setAllocationAmounts({});
    } catch (error) {
      console.error(
        "Error al consultar los conceptos pendientes:",
        error,
      );

      setAllocationTargets([]);
      setAllocationAmounts({});

      toast.error(
        "No fue posible consultar los conceptos pendientes de la tarjeta.",
      );
    }
  }, [isCreditCardTransfer, selectedCardId]);

  // Controlar los importes asignados a cada concepto.
  function handleAllocationChange(
    target: CardPaymentAllocationTarget,
    value: string,
  ) {
    if (value !== "" && !/^\d*\.?\d{0,2}$/.test(value)) {
      return;
    }

    const parsedAmount = Number(value);

    if (
      value !== "" &&
      (!Number.isFinite(parsedAmount) ||
        parsedAmount > target.remainingAmount)
    ) {
      toast.error(
        `El importe máximo para este concepto es ${formatCurrency(
          target.remainingAmount,
        )}.`,
      );
      return;
    }

    const previousAmount =
      Number(allocationAmounts[target.id]) || 0;

    const newTotal =
      Math.round(
        (totalAllocated - previousAmount + parsedAmount) * 100,
      ) / 100;

    if (value !== "" && newTotal > transferAmount) {
      toast.error(
        "La distribución no puede superar el importe de la transferencia.",
      );
      return;
    }

    setAllocationAmounts((previous) => ({
      ...previous,
      [target.id]: value,
    }));
  }

  // ---------------------------------------------------------------------------
  // ENVÍO DEL FORMULARIO
  // ---------------------------------------------------------------------------

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const parsed = transactionSchema.safeParse({
      description,
      amount: Number(amount),
      date,
      account,
      category:
        type === "transfer"
          ? "Transferencia propia"
          : category,
    });

    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ??
          "Revisa los datos del movimiento.",
        "Datos incompletos o inválidos",
      );
      return;
    }

    const availableAccountIds = accountOptions.map(
      (item) => item.id,
    );

    if (!availableAccountIds.includes(parsed.data.account)) {
      toast.error(
        "La cuenta seleccionada no existe o ya no está disponible.",
        "Cuenta inválida",
      );
      return;
    }

    if (
      type !== "transfer" &&
      !availableCategories.includes(parsed.data.category)
    ) {
      toast.error(
        "Selecciona una categoría válida para este tipo de movimiento.",
        "Categoría inválida",
      );
      return;
    }

    if (type === "transfer") {
      if (!destinationAccount) {
        toast.error("Selecciona la cuenta de destino.");
        return;
      }

      const availableDestinationIds =
        destinationAccountOptions.map((item) => item.id);

      if (
        !availableDestinationIds.includes(destinationAccount)
      ) {
        toast.error(
          "La cuenta de destino no existe o ya no está disponible.",
          "Cuenta inválida",
        );
        return;
      }

      if (account === destinationAccount) {
        toast.error(
          "La cuenta de origen y destino deben ser diferentes.",
          "Transferencia inválida",
        );
        return;
      }
    }

    // Validaciones específicas de pagos a tarjetas de crédito.
    if (isCreditCardTransfer && selectedCardId) {
      if (date > getToday()) {
        toast.error(
          "La fecha de pago a tarjeta no puede ser futura.",
          "Fecha inválida",
        );
        return;
      }

      if (manualAllocations.length === 0) {
        toast.error(
          "Debes asignar al menos un importe a una compra o parcialidad.",
          "Distribución pendiente",
        );
        return;
      }

      if (totalAllocated > parsed.data.amount) {
        toast.error(
          "Las asignaciones superan el importe de la transferencia.",
        );
        return;
      }

      const hasInvalidAllocation = manualAllocations.some(
        (allocation) => {
          const target = allocationTargets.find((item) =>
            item.type === "single_purchase"
              ? item.id === allocation.purchaseId
              : item.id === allocation.installmentId,
          );

          return (
            !target ||
            allocation.amount <= 0 ||
            allocation.amount > target.remainingAmount
          );
        },
      );

      if (hasInvalidAllocation) {
        toast.error(
          "Uno o más importes asignados ya no son válidos. Revisa los conceptos.",
        );
        return;
      }
    }

    const transactionData: NewTransactionData = {
      description: parsed.data.description,
      category:
        type === "transfer"
          ? "Transferencia propia"
          : parsed.data.category,
      account:
        type === "transfer"
          ? `${account} → ${destinationAccount}`
          : account,
      date: parsed.data.date,
      amount:
        type === "expense"
          ? -Math.abs(parsed.data.amount)
          : Math.abs(parsed.data.amount),
      type,

      ...(isCreditCardTransfer && selectedCardId
        ? {
            cardPayment: {
              cardId: selectedCardId,
              allocations: manualAllocations,
            },
          }
        : {}),
    };

    setIsSubmitting(true);

    try {
      onSubmit(transactionData);
    } catch (error) {
      console.error("Error al guardar el movimiento:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible guardar el movimiento. Inténtalo nuevamente.",
        "Error al guardar",
      );

      setIsSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // ESTILOS
  // ---------------------------------------------------------------------------

  const inputClassName =
    "mt-1.5 w-full rounded-xl border border-hairline bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-foreground disabled:cursor-not-allowed disabled:opacity-50";

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-form-title"
        className="my-auto w-full max-w-xl rounded-3xl bg-background p-5 shadow-2xl sm:p-7"
      >
        {/* ENCABEZADO */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Gestión financiera
            </p>

            <h2
              id="transaction-form-title"
              className="mt-2 text-2xl font-bold tracking-tight text-foreground"
            >
              {isEditing ? "Editar transacción" : "Nueva transacción"}
            </h2>

            <p className="mt-1 text-sm text-muted">
              {isEditing
                ? "Modifica los datos del movimiento seleccionado."
                : "Registra un movimiento en tus cuentas."}
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
          {/* TIPO DE MOVIMIENTO */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
              Tipo de movimiento
            </label>

            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "income", label: "Ingreso" },
                { value: "expense", label: "Gasto" },
                { value: "transfer", label: "Transferencia" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    const newType = option.value as typeof type;

                    setType(newType);
                    setCategory("");
                  }}
                  className={`rounded-xl border px-2 py-3 text-xs font-semibold transition sm:text-sm disabled:opacity-50 ${
                    type === option.value
                      ? "border-foreground bg-foreground text-white"
                      : "border-hairline bg-surface-card text-muted hover:border-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* DESCRIPCIÓN */}
          <div>
            <label
              htmlFor="transaction-description"
              className="text-sm font-semibold text-foreground"
            >
              Descripción
            </label>

            <input
              id="transaction-description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Ej. Nómina, supermercado, ahorro..."
              maxLength={120}
              disabled={isSubmitting}
              className={inputClassName}
            />
          </div>

          {/* IMPORTE Y FECHA */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="transaction-amount"
                className="text-sm font-semibold text-foreground"
              >
                Importe (MXN)
              </label>

              <input
                id="transaction-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                placeholder="0.00"
                disabled={isSubmitting}
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="transaction-date"
                className="text-sm font-semibold text-foreground"
              >
                Fecha de operación
              </label>

              <input
                id="transaction-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </div>
          </div>

          {/* CUENTA DE ORIGEN */}
          <div>
            <label
              htmlFor="transaction-account"
              className="text-sm font-semibold text-foreground"
            >
              {type === "transfer" ? "Cuenta de origen" : "Cuenta"}
            </label>

            <select
              id="transaction-account"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              disabled={isSubmitting}
              className={inputClassName}
            >
              <option value="">Selecciona una cuenta</option>

              {accountOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          {/* DESTINO O CATEGORÍA */}
          {type === "transfer" ? (
            <div>
              <label
                htmlFor="transaction-destination"
                className="text-sm font-semibold text-foreground"
              >
                Cuenta de destino
              </label>

              <select
                id="transaction-destination"
                value={destinationAccount}
                onChange={(event) =>
                  setDestinationAccount(event.target.value)
                }
                disabled={isSubmitting}
                className={inputClassName}
              >
                <option value="">Selecciona una cuenta</option>

                {destinationAccountOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label
                htmlFor="transaction-category"
                className="text-sm font-semibold text-foreground"
              >
                Categoría
              </label>

              <select
                id="transaction-category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
                disabled={isSubmitting}
                className={inputClassName}
              >
                <option value="">Selecciona una categoría</option>

                {availableCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* DISTRIBUCIÓN MANUAL DE PAGO A TARJETA */}
          {isCreditCardTransfer && (
            <div className="space-y-4 rounded-2xl border border-hairline bg-surface-card p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Distribución del pago
                </h3>

                <p className="mt-1 text-xs text-muted">
                  Selecciona cuánto deseas aplicar a cada compra o
                  parcialidad.
                </p>
              </div>

              {allocationTargets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-hairline p-4 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No hay conceptos pendientes
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    Esta tarjeta no tiene compras de contado ni
                    parcialidades con saldo pendiente.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allocationTargets.map((target) => (
                    <div
                      key={target.id}
                      className="rounded-xl border border-hairline bg-background p-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {target.description}
                          </p>

                          <p className="mt-1 text-xs text-muted">
                            {target.type === "single_purchase"
                              ? "Compra de contado"
                              : "Parcialidad MSI"}
                          </p>

                          <p className="mt-1 text-xs text-muted">
                            Fecha: {target.dueDate}
                          </p>

                          <p className="mt-1 text-xs text-muted">
                            Pendiente:{" "}
                            {formatCurrency(target.remainingAmount)}
                          </p>
                        </div>

                        <div className="w-full sm:w-36">
                          <label
                            htmlFor={`allocation-${target.id}`}
                            className="text-xs font-medium text-muted"
                          >
                            Importe a aplicar
                          </label>

                          <input
                            id={`allocation-${target.id}`}
                            type="number"
                            min="0"
                            max={target.remainingAmount}
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={allocationAmounts[target.id] ?? ""}
                            onChange={(event) =>
                              handleAllocationChange(
                                target,
                                event.target.value,
                              )
                            }
                            disabled={isSubmitting}
                            className={inputClassName}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* RESUMEN DE DISTRIBUCIÓN */}
              <div className="space-y-2 border-t border-hairline pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">
                    Importe de transferencia
                  </span>

                  <span className="font-medium text-foreground">
                    {formatCurrency(transferAmount)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted">
                    Total aplicado
                  </span>

                  <span className="font-medium text-foreground">
                    {formatCurrency(totalAllocated)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted">
                    Sin aplicar
                  </span>

                  <span className="font-semibold text-foreground">
                    {formatCurrency(unappliedAmount)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* BOTONES */}
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
              disabled={isSubmitting}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "Guardando..."
                : isEditing
                  ? "Guardar cambios"
                  : "Guardar movimiento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
