
"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";

import type { Account, AccountType, Bank } from "@/types/account";
import { useAlert } from "@/context/AlertContext";

export interface AccountFormData {
  name: string;
  bankId: string | null;
  type: AccountType;
  currency: "MXN";
  openingBalance: number;
  openingDate: string;
}

interface AccountFormProps {
  banks: Bank[];
  account?: Account | null;
  onSubmit: (data: AccountFormData) => void;
  onCancel: () => void;
}

const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre de la cuenta es obligatorio.")
    .max(80, "El nombre no puede superar los 80 caracteres."),
  bankId: z.string(),
  type: z.enum(["checking", "savings", "cash", "investment", "other"]),
  openingBalance: z
    .number({ error: "Ingresa un saldo válido." })
    .finite("El saldo debe ser un número válido.")
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
      "El saldo no puede tener más de dos decimales.",
    ),
  openingDate: z
    .string()
    .min(1, "Selecciona una fecha de apertura.")
    .refine((value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

      const parsed = new Date(`${value}T00:00:00`);

      return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
      );
    }, "La fecha de apertura no es válida."),
});

function getToday(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function getDateInputValue(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return getToday();

  const offset = parsed.getTimezoneOffset() * 60_000;

  return new Date(parsed.getTime() - offset).toISOString().slice(0, 10);
}

const accountTypes: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Cuenta de cheques" },
  { value: "savings", label: "Ahorro" },
  { value: "cash", label: "Efectivo" },
  { value: "investment", label: "Inversión" },
  { value: "other", label: "Otra" },
];

export default function AccountForm({
  banks,
  account,
  onSubmit,
  onCancel,
}: AccountFormProps) {
  const { toast } = useAlert();

  const isEditing = Boolean(account);

  const [name, setName] = useState(account?.name ?? "");
  const [bankId, setBankId] = useState(account?.bankId ?? "");
  const [type, setType] = useState<AccountType>(
    account?.type ?? "checking",
  );
  const [openingBalance, setOpeningBalance] = useState(
    account ? String(account.openingBalance) : "0",
  );
  const [openingDate, setOpeningDate] = useState(
    account ? getDateInputValue(account.openingDate) : getToday(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputClassName =
    "mt-1.5 w-full rounded-xl border border-hairline bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-foreground disabled:cursor-not-allowed disabled:opacity-60";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const parsed = accountSchema.safeParse({
      name,
      bankId,
      type,
      openingBalance: Number(openingBalance),
      openingDate,
    });

    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? "Revisa los datos de la cuenta.",
        "Datos incompletos o inválidos",
      );
      return;
    }

    if (
      parsed.data.bankId &&
      !banks.some((bank) => bank.id === parsed.data.bankId)
    ) {
      toast.error(
        "La institución bancaria seleccionada no está disponible.",
        "Banco inválido",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      onSubmit({
        name: parsed.data.name,
        bankId: parsed.data.bankId || null,
        type: parsed.data.type,
        currency: "MXN",
        openingBalance: parsed.data.openingBalance,
        openingDate: parsed.data.openingDate,
      });
    } catch (error) {
      console.error("Error al guardar la cuenta:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "No fue posible guardar la cuenta.",
        "Error al guardar",
      );

      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-form-title"
        className="my-auto w-full max-w-xl rounded-3xl bg-background p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Gestión financiera
            </p>

            <h2
              id="account-form-title"
              className="mt-2 text-2xl font-bold tracking-tight text-foreground"
            >
              {isEditing ? "Editar cuenta" : "Nueva cuenta"}
            </h2>

            <p className="mt-1 text-sm text-muted">
              {isEditing
                ? "Modifica la información de tu cuenta."
                : "Registra una cuenta para organizar tus finanzas."}
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
            <label
              htmlFor="account-name"
              className="text-sm font-semibold text-foreground"
            >
              Nombre de la cuenta
            </label>

            <input
              id="account-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Cuenta principal"
              maxLength={80}
              disabled={isSubmitting}
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="account-bank"
              className="text-sm font-semibold text-foreground"
            >
              Institución bancaria
            </label>

            <select
              id="account-bank"
              value={bankId}
              onChange={(event) => setBankId(event.target.value)}
              disabled={isSubmitting}
              className={inputClassName}
            >
              <option value="">Sin institución bancaria</option>

              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                  {!bank.isCustom ? " (Predeterminado)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="account-type"
              className="text-sm font-semibold text-foreground"
            >
              Tipo de cuenta
            </label>

            <select
              id="account-type"
              value={type}
              onChange={(event) =>
                setType(event.target.value as AccountType)
              }
              disabled={isSubmitting}
              className={inputClassName}
            >
              {accountTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="account-opening-balance"
                className="text-sm font-semibold text-foreground"
              >
                Saldo inicial (MXN)
              </label>

              <input
                id="account-opening-balance"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={openingBalance}
                onChange={(event) => setOpeningBalance(event.target.value)}
                placeholder="0.00"
                disabled={isSubmitting}
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="account-opening-date"
                className="text-sm font-semibold text-foreground"
              >
                Fecha de apertura
              </label>

              <input
                id="account-opening-date"
                type="date"
                value={openingDate}
                onChange={(event) => setOpeningDate(event.target.value)}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </div>
          </div>

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
                  : "Guardar cuenta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
