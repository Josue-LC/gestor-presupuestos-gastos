
"use client";

import { useRouter } from "next/navigation";

import {
  Landmark,
  PiggyBank,
  Wallet,
  TrendingUp,
  CircleHelp,
  Pencil,
  Eye,
} from "lucide-react";

import type { Account, AccountType } from "@/types/account";

// -----------------------------------------------------------------------------
// TIPOS
// -----------------------------------------------------------------------------

interface AccountListProps {
  accounts: Account[];
  bankMap: Map<string, string>;
  balanceMap: Map<string, number>;
  onEdit: (account: Account) => void;
  onCreate?: () => void;
  hasRegisteredAccounts: boolean;
}

// -----------------------------------------------------------------------------
// CONFIGURACIÓN
// -----------------------------------------------------------------------------

const ACCOUNT_TYPE_CONFIG: Record<
  AccountType,
  {
    label: string;
    icon: typeof Landmark;
    iconStyle: string;
    badgeStyle: string;
  }
> = {
  checking: {
    label: "Cuenta de cheques",
    icon: Landmark,
    iconStyle: "bg-brand-lavender/40 text-foreground",
    badgeStyle: "bg-brand-lavender/30 text-foreground",
  },
  savings: {
    label: "Ahorro",
    icon: PiggyBank,
    iconStyle: "bg-brand-mint/40 text-success",
    badgeStyle: "bg-brand-mint/30 text-success",
  },
  cash: {
    label: "Efectivo",
    icon: Wallet,
    iconStyle: "bg-brand-peach/40 text-error",
    badgeStyle: "bg-brand-peach/30 text-error",
  },
  investment: {
    label: "Inversión",
    icon: TrendingUp,
    iconStyle: "bg-brand-lavender/40 text-foreground",
    badgeStyle: "bg-brand-lavender/30 text-foreground",
  },
  other: {
    label: "Otra",
    icon: CircleHelp,
    iconStyle: "bg-background text-muted",
    badgeStyle: "bg-background text-muted",
  },
};

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatBalance(balance: number): string {
  return currencyFormatter.format(balance);
}

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------

export default function AccountList({
  accounts,
  bankMap,
  balanceMap,
  onEdit,
  onCreate,
  hasRegisteredAccounts,
}: AccountListProps) {
  const router = useRouter();

  function handleViewAccount(account: Account) {
    router.push(`/accounts/${account.id}`);
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-card px-5 py-12 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-lavender/30 text-foreground">
          <Wallet className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
        </div>

        <p className="mt-4 text-sm font-semibold text-foreground">
          {hasRegisteredAccounts
            ? "No se encontraron cuentas"
            : "Todavía no tienes cuentas"}
        </p>

        <p className="mt-1 text-sm text-muted">
          {hasRegisteredAccounts
            ? "Prueba modificando los filtros de búsqueda."
            : "Registra tu primera cuenta para comenzar a organizar tus finanzas."}
        </p>

        {!hasRegisteredAccounts && onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-neutral-800"
          >
            Crear primera cuenta
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-card shadow-sm">
      {/* Encabezados */}
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-4 border-b border-hairline px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted md:grid">
        <span>Cuenta</span>
        <span>Institución</span>
        <span>Tipo</span>
        <span className="text-right">Saldo actual</span>
        <span className="w-20 text-right">Acciones</span>
      </div>

      {/* Cuentas */}
      <div className="divide-y divide-hairline">
        {accounts.map((account) => {
          const config = ACCOUNT_TYPE_CONFIG[account.type];
          const Icon = config.icon;

          const bankName = account.bankId
            ? bankMap.get(account.bankId) ?? "Banco no disponible"
            : "Sin institución bancaria";

          const balance = balanceMap.get(account.id) ?? 0;

          return (
            <article
              key={account.id}
              className="grid grid-cols-1 items-center gap-3 px-4 py-4 transition-colors hover:bg-background/50 sm:px-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:gap-4"
            >
              {/* Cuenta */}
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.iconStyle}`}
                >
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => handleViewAccount(account)}
                    className="block max-w-full truncate text-left text-sm font-semibold text-foreground transition hover:text-primary hover:underline"
                    aria-label={`Ver detalles de la cuenta ${account.name}`}
                  >
                    {account.name}
                  </button>

                  <p className="mt-1 truncate text-xs text-muted md:hidden">
                    {bankName}
                  </p>
                </div>
              </div>

              {/* Institución */}
              <div className="hidden min-w-0 md:block">
                <p className="truncate text-sm text-body">{bankName}</p>
              </div>

              {/* Tipo de cuenta */}
              <div className="hidden md:block">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${config.badgeStyle}`}
                >
                  {config.label}
                </span>
              </div>

              {/* Saldo */}
              <div className="flex items-center justify-between gap-3 md:block md:text-right">
                <div className="min-w-0 md:hidden">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${config.badgeStyle}`}
                  >
                    {config.label}
                  </span>
                </div>

                <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                  {formatBalance(balance)}
                </p>
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => handleViewAccount(account)}
                  aria-label={`Consultar cuenta ${account.name}`}
                  title="Ver detalles"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-background hover:text-foreground"
                >
                  <Eye
                    className="h-4 w-4"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => onEdit(account)}
                  aria-label={`Editar cuenta ${account.name}`}
                  title="Editar cuenta"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-background hover:text-foreground"
                >
                  <Pencil
                    className="h-4 w-4"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
