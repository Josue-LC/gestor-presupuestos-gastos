
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  Plus,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CreditCard,
  Landmark,
  Wallet,
} from "lucide-react";

import type { Account, AccountType, Bank } from "@/types/account";
import type { Transaction } from "@/components/transactions/TransactionList";
import TransactionForm, {
  type NewTransactionData,
} from "@/components/transactions/TransactionForm";
import { useAlert } from "@/context/AlertContext";
import {
  getAccountById,
  getAccountBalance,
  getActiveAccounts,
} from "@/services/account.service";
import { getBanks } from "@/services/bank.service";
import {
  loadTransactionStorage,
  saveTransactionStorage,
} from "@/services/transaction-storage.service";
import { createTransactionAuditEvent } from "@/services/transaction-audit.service";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Cuenta de cheques",
  savings: "Ahorro",
  cash: "Efectivo",
  investment: "Inversión",
  other: "Otra",
};

const ACCOUNT_TYPE_ICONS = {
  checking: Landmark,
  savings: Wallet,
  cash: Banknote,
  investment: CreditCard,
  other: Landmark,
};

type AccountData = {
  account: Account;
  bank: Bank | undefined;
  balance: number;
  transactions: Transaction[];
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string): string {
  if (!date) return "—";

  return new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function transactionUsesAccount(
  transaction: Transaction,
  accountId: string,
): boolean {
  if (transaction.type === "transfer") {
    const [sourceAccountId, destinationAccountId] =
      transaction.account.split(" → ").map((value) => value.trim());

    return (
      sourceAccountId === accountId ||
      destinationAccountId === accountId
    );
  }

  return transaction.account === accountId;
}

function getTransferDirection(
  transaction: Transaction,
  accountId: string,
): "in" | "out" | null {
  if (transaction.type !== "transfer") return null;

  const [sourceAccountId, destinationAccountId] =
    transaction.account.split(" → ").map((value) => value.trim());

  if (destinationAccountId === accountId) return "in";
  if (sourceAccountId === accountId) return "out";

  return null;
}

function getMovementPresentation(
  transaction: Transaction,
  accountId: string,
) {
  if (transaction.type === "income") {
    return {
      label: "Ingreso",
      description: "Ingreso recibido",
      icon: ArrowDownLeft,
      color: "text-success",
      background: "bg-brand-mint/30",
      sign: "+",
    };
  }

  if (transaction.type === "expense") {
    return {
      label: "Gasto",
      description: "Gasto realizado",
      icon: ArrowUpRight,
      color: "text-error",
      background: "bg-brand-peach/30",
      sign: "-",
    };
  }

  const direction = getTransferDirection(transaction, accountId);

  if (direction === "in") {
    return {
      label: "Transferencia recibida",
      description: "Dinero recibido",
      icon: ArrowDownLeft,
      color: "text-success",
      background: "bg-brand-mint/30",
      sign: "+",
    };
  }

  return {
    label: "Transferencia enviada",
    description: "Dinero enviado",
    icon: ArrowUpRight,
    color: "text-violet-600",
    background: "bg-violet-500/10",
    sign: "-",
  };
}

function SummaryCard({
  label,
  amount,
  description,
  icon: Icon,
  color,
  background,
}: {
  label: string;
  amount: number;
  description: string;
  icon: typeof ArrowDownLeft;
  color: string;
  background: string;
}) {
  return (
    <article className="rounded-2xl border border-hairline bg-surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className={`mt-3 text-xl font-bold tracking-tight ${color}`}>
            {formatCurrency(amount)}
          </p>
          <p className="mt-1 text-xs text-muted">{description}</p>
        </div>

        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${background}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </article>
  );
}

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const accountId = params.id;

  const [data, setData] = useState<AccountData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formType, setFormType] = useState<"income" | "expense">("expense");
  const { toast } = useAlert();

  const activeAccountOptions = useMemo(
    () =>
      getActiveAccounts().map((item) => ({
        id: item.id,
        name: item.name,
      })),
    [],
  );

  function refreshAccountData() {
    const account = getAccountById(accountId);

    if (!account) {
      setData(null);
      return;
    }

    const bank = getBanks().find((item) => item.id === account.bankId);
    const storage = loadTransactionStorage();
    const transactions = (storage?.transactions ?? []).filter((transaction) =>
      transactionUsesAccount(transaction, accountId),
    );

    setData({
      account,
      bank,
      balance: getAccountBalance(accountId),
      transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
    });
  }

  function handleOpenMovementForm(type: "income" | "expense") {
    if (!data || data.account.status !== "active") return;
    setFormType(type);
    setIsFormOpen(true);
  }

  function handleCreateMovement(formData: NewTransactionData) {
    if (!data || data.account.status !== "active") return;

    try {
      const newTransaction: Transaction = {
        id: `transaction-${crypto.randomUUID()}`,
        ...formData,
        account:
          formData.type === "transfer" ? formData.account : data.account.id,
        date: formData.date,
        registeredAt: new Date().toISOString(),
        status: "active",
      };

      const storage = loadTransactionStorage();
      const auditEvent = createTransactionAuditEvent(newTransaction);
      const saved = saveTransactionStorage({
        transactions: [newTransaction, ...(storage?.transactions ?? [])],
        auditEvents: [auditEvent, ...(storage?.auditEvents ?? [])],
      });

      if (!saved) {
        throw new Error("No fue posible guardar el movimiento.");
      }

      refreshAccountData();
      setIsFormOpen(false);
      toast.success(
        formData.type === "income"
          ? "El ingreso se registró correctamente."
          : "El gasto se registró correctamente.",
        formData.type === "income" ? "Ingreso registrado" : "Gasto registrado",
      );
    } catch (error) {
      console.error("Error al registrar el movimiento:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al registrar el movimiento.",
        "No se pudo guardar",
      );
    }
  }

  useEffect(() => {
    try {
      refreshAccountData();
    } catch (error) {
      console.error("Error al cargar el detalle de la cuenta:", error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  const activeTransactions = useMemo(
    () =>
      data?.transactions.filter(
        (transaction) => transaction.status !== "cancelled",
      ) ?? [],
    [data],
  );

  const cancelledCount = useMemo(
    () =>
      data?.transactions.filter(
        (transaction) => transaction.status === "cancelled",
      ).length ?? 0,
    [data],
  );

  const movements = useMemo(() => {
    return activeTransactions.reduce(
      (summary, transaction) => {
        const amount = Math.abs(transaction.amount);

        if (transaction.date < (data?.account.openingDate ?? "")) {
          return summary;
        }

        if (transaction.type === "income") {
          summary.income += amount;
        } else if (transaction.type === "expense") {
          summary.expenses += amount;
        } else {
          const direction = getTransferDirection(
            transaction,
            data!.account.id,
          );

          if (direction === "in") {
            summary.transfersIn += amount;
          } else if (direction === "out") {
            summary.transfersOut += amount;
          }
        }

        return summary;
      },
      {
        income: 0,
        expenses: 0,
        transfersIn: 0,
        transfersOut: 0,
      },
    );
  }, [activeTransactions, data]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <div className="h-5 w-32 animate-pulse rounded bg-surface-card" />
        <div className="h-32 animate-pulse rounded-2xl bg-surface-card" />
        <div className="h-48 animate-pulse rounded-2xl bg-surface-card" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[1600px] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-card">
          <Landmark className="h-7 w-7 text-muted" />
        </div>

        <h1 className="mt-5 text-xl font-bold text-foreground">
          Cuenta no encontrada
        </h1>

        <p className="mt-2 max-w-md text-sm text-muted">
          No fue posible encontrar la cuenta solicitada. Es posible que haya
          sido eliminada o que el identificador no sea válido.
        </p>

        <Link
          href="/accounts"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a cuentas
        </Link>
      </div>
    );
  }

  const { account, bank, balance, transactions } = data;
  const AccountIcon = ACCOUNT_TYPE_ICONS[account.type];

  return (
    <>
      {isFormOpen && account.status === "active" && (
        <TransactionForm
          accounts={activeAccountOptions}
          initialType={formType}
          initialAccount={account.id}
          onSubmit={handleCreateMovement}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      <div className="mx-auto w-full max-w-[1600px] space-y-8">
      {/* Encabezado */}
      <section className="space-y-5">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a cuentas
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/10">
              <AccountIcon className="h-7 w-7 text-accent" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                Gestión financiera / Cuentas
              </p>

              <h1 className="mt-2 break-words text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {account.name}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span>{bank?.name ?? "Sin institución bancaria"}</span>
                <span aria-hidden="true">·</span>
                <span>{ACCOUNT_TYPE_LABELS[account.type]}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    account.status === "active"
                      ? "font-medium text-success"
                      : "font-medium text-muted"
                  }
                >
                  {account.status === "active" ? "Activa" : "Archivada"}
                </span>
              </div>
            </div>
          </div>

          {account.status === "active" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => handleOpenMovementForm("income")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-sm font-semibold text-white transition-colors hover:brightness-95"
              >
                <Plus className="h-4 w-4" />
                Nuevo ingreso
              </button>

              <button
                type="button"
                onClick={() => handleOpenMovementForm("expense")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-error px-4 py-3 text-sm font-semibold text-white transition-colors hover:brightness-95"
              >
                <Plus className="h-4 w-4" />
                Nuevo gasto
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Saldo principal */}
      <section className="overflow-hidden rounded-2xl border border-hairline bg-surface-card">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted">
                Saldo disponible
              </p>

              <p className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {formatCurrency(balance)}
              </p>

              <p className="mt-3 text-sm text-muted">
                Saldo calculado a partir del saldo inicial y los movimientos
                activos de la cuenta.
              </p>
            </div>

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
              <Wallet className="h-7 w-7 text-accent" />
            </div>
          </div>
        </div>
      </section>

      {/* Resumen de movimientos */}
      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Resumen de movimientos
          </h2>

          <p className="text-xs text-muted">
            Desde {formatDate(account.openingDate)}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Ingresos"
            amount={movements.income}
            description="Total recibido"
            icon={ArrowDownLeft}
            color="text-success"
            background="bg-brand-mint/30"
          />

          <SummaryCard
            label="Gastos"
            amount={movements.expenses}
            description="Total gastado"
            icon={ArrowUpRight}
            color="text-error"
            background="bg-brand-peach/30"
          />

          <SummaryCard
            label="Transferencias recibidas"
            amount={movements.transfersIn}
            description="Entradas desde otras cuentas"
            icon={ArrowDownLeft}
            color="text-success"
            background="bg-brand-mint/30"
          />

          <SummaryCard
            label="Transferencias enviadas"
            amount={movements.transfersOut}
            description="Salidas hacia otras cuentas"
            icon={ArrowUpRight}
            color="text-violet-600"
            background="bg-violet-500/10"
          />
        </div>
      </section>

      {/* Información general */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Información de la cuenta
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-hairline bg-surface-card p-5">
            <div className="flex items-center gap-2 text-muted">
              <Landmark className="h-4 w-4" />
              <span className="text-xs font-medium">Institución</span>
            </div>
            <p className="mt-3 font-semibold text-foreground">
              {bank?.name ?? "No especificada"}
            </p>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-card p-5">
            <div className="flex items-center gap-2 text-muted">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-medium">Tipo de cuenta</span>
            </div>
            <p className="mt-3 font-semibold text-foreground">
              {ACCOUNT_TYPE_LABELS[account.type]}
            </p>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-card p-5">
            <div className="flex items-center gap-2 text-muted">
              <Banknote className="h-4 w-4" />
              <span className="text-xs font-medium">Saldo inicial</span>
            </div>
            <p className="mt-3 font-semibold text-foreground">
              {formatCurrency(account.openingBalance)}
            </p>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-card p-5">
            <div className="flex items-center gap-2 text-muted">
              <CalendarDays className="h-4 w-4" />
              <span className="text-xs font-medium">Fecha de apertura</span>
            </div>
            <p className="mt-3 font-semibold text-foreground">
              {formatDate(account.openingDate)}
            </p>
          </div>
        </div>
      </section>

      {/* Historial de movimientos */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Historial de movimientos
            </h2>

            <p className="mt-1 text-sm text-muted">
              {transactions.length} movimientos registrados
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>
              <span className="font-semibold text-foreground">
                {activeTransactions.length}
              </span>{" "}
              activos
            </span>

            <span>
              <span className="font-semibold text-foreground">
                {cancelledCount}
              </span>{" "}
              cancelados
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-card">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-card">
                <ArrowLeftRight className="h-6 w-6 text-muted" />
              </div>

              <h3 className="mt-4 font-semibold text-foreground">
                Sin movimientos registrados
              </h3>

              <p className="mt-1 max-w-sm text-sm text-muted">
                Los ingresos, gastos y transferencias relacionados con esta
                cuenta aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {transactions.map((transaction) => {
                const isCancelled = transaction.status === "cancelled";
                const presentation = getMovementPresentation(
                  transaction,
                  account.id,
                );
                const MovementIcon = presentation.icon;

                return (
                  <article
                    key={transaction.id}
                    className={`flex flex-col gap-3 px-5 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                      isCancelled ? "opacity-55" : "hover:bg-background/40"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isCancelled
                            ? "bg-neutral-500/10"
                            : presentation.background
                        }`}
                      >
                        <MovementIcon
                          className={`h-5 w-5 ${
                            isCancelled ? "text-muted" : presentation.color
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={`truncate text-sm font-semibold ${
                              isCancelled
                                ? "text-muted line-through"
                                : "text-foreground"
                            }`}
                          >
                            {transaction.description}
                          </p>

                          {isCancelled && (
                            <span className="rounded-full bg-neutral-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                              Cancelado
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                          <span>{transaction.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatDate(transaction.date)}</span>
                        </div>

                        {isCancelled && transaction.cancellationReason && (
                          <p className="mt-1 text-xs text-muted">
                            Motivo: {transaction.cancellationReason}
                          </p>
                        )}

                        {!isCancelled && transaction.type === "transfer" && (
                          <p className="mt-1 text-xs text-muted">
                            {presentation.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                      <span className="text-xs text-muted">
                        {presentation.label}
                      </span>

                      <p
                        className={`text-sm font-bold tabular-nums ${
                          isCancelled ? "text-muted line-through" : presentation.color
                        }`}
                      >
                        {presentation.sign}
                        {formatCurrency(Math.abs(transaction.amount))}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
      </div>
    </>
  );
}
