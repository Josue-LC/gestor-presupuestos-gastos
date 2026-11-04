
"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";

import type { Transaction } from "@/components/transactions/TransactionList";
import { getTransactionCategoryNames } from "@/lib/transaction-categories";
import { useAlert } from "@/context/AlertContext";

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

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
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
    initialAccounts[0] || initialAccount || accountOptions[0]?.id || "",
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

  const availableCategories =
    type === "transfer" ? [] : getTransactionCategoryNames(type);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const parsed = transactionSchema.safeParse({
      description,
      amount: Number(amount),
      date,
      account,
      category: type === "transfer" ? "Transferencia propia" : category,
    });

    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? "Revisa los datos del movimiento.",
        "Datos incompletos o inválidos",
      );
      return;
    }

    const availableAccountIds = accountOptions.map((item) => item.id);

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

      const availableDestinationIds = destinationAccountOptions.map(
        (item) => item.id,
      );

      if (!availableDestinationIds.includes(destinationAccount)) {
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
    };

    setIsSubmitting(true);

    try {
      onSubmit(transactionData);
    } catch (error) {
      console.error("Error al guardar el movimiento:", error);

      toast.error(
        "No fue posible guardar el movimiento. Inténtalo nuevamente.",
        "Error al guardar",
      );

      setIsSubmitting(false);
    }
  }

  const inputClassName =
    "mt-1.5 w-full rounded-xl border border-hairline bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-foreground";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-form-title"
        className="my-auto w-full max-w-xl rounded-3xl bg-background p-5 shadow-2xl sm:p-7"
      >
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
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ej. Nómina, supermercado, ahorro..."
              maxLength={120}
              disabled={isSubmitting}
              className={inputClassName}
            />
          </div>

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
                onChange={(event) => setAmount(event.target.value)}
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
                onChange={(event) => setCategory(event.target.value)}
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
