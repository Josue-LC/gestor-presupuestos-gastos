
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AccountSummary from "@/components/accounts/AccountSummary";
import AccountList from "@/components/accounts/AccountList";
import AccountForm, {
  type AccountFormData,
} from "@/components/accounts/AccountForm";

import type { Account, AccountType, Bank } from "@/types/account";

import { useAlert } from "@/context/AlertContext";

import {
  getActiveAccounts,
  createAccount,
  updateAccount,
} from "@/services/account.service";

import { getBanks } from "@/services/bank.service";

import {
  getAccountModuleSummary,
  getAllAccountSummaries,
} from "@/services/account-summary.service";

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Cuenta de cheques",
  savings: "Ahorro",
  cash: "Efectivo",
  investment: "Inversión",
  other: "Otra",
};

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------

export default function AccountsPage() {
  const { toast } = useAlert();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);

  const [accountSummaries, setAccountSummaries] = useState<
    ReturnType<typeof getAllAccountSummaries>
  >([]);

  const [moduleSummary, setModuleSummary] = useState<
    ReturnType<typeof getAccountModuleSummary> | null
  >(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AccountType | "all">("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // ---------------------------------------------------------------------------
  // CARGA DE INFORMACIÓN
  // ---------------------------------------------------------------------------

  const loadData = useCallback(() => {
    try {
      const activeAccounts = getActiveAccounts();
      const accountData = getAllAccountSummaries();
      const summary = getAccountModuleSummary();
      const bankData = getBanks();

      setAccounts(activeAccounts);
      setAccountSummaries(accountData);
      setModuleSummary(summary);
      setBanks(bankData);
    } catch (error) {
      console.error("Error al cargar las cuentas:", error);

      toast.error(
        "No fue posible cargar la información de las cuentas.",
        "Error de carga",
      );
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // FILTROS Y MAPAS
  // ---------------------------------------------------------------------------

  const bankMap = useMemo(
    () => new Map(banks.map((bank) => [bank.id, bank.name])),
    [banks],
  );

  const balanceMap = useMemo(
    () =>
      new Map(
        accountSummaries.map((summary) => [
          summary.account.id,
          summary.balance,
        ]),
      ),
    [accountSummaries],
  );

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es-MX");

    return accounts.filter((account) => {
      const bankName = account.bankId
        ? (bankMap.get(account.bankId) ?? "")
        : "";

      const matchesSearch =
        !normalizedSearch ||
        account.name.toLocaleLowerCase("es-MX").includes(normalizedSearch) ||
        bankName.toLocaleLowerCase("es-MX").includes(normalizedSearch);

      const matchesType = typeFilter === "all" || account.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [accounts, search, typeFilter, bankMap]);

  // ---------------------------------------------------------------------------
  // FORMULARIO
  // ---------------------------------------------------------------------------

  function handleCreateAccount() {
    setEditingAccount(null);
    setIsFormOpen(true);
  }

  function handleEditAccount(account: Account) {
    setEditingAccount(account);
    setIsFormOpen(true);
  }

  function handleCloseForm() {
    setIsFormOpen(false);
    setEditingAccount(null);
  }

  function handleSubmitAccount(data: AccountFormData) {
    try {
      if (editingAccount) {
        updateAccount(editingAccount.id, data);

        toast.success(
          "La cuenta se actualizó correctamente.",
          "Cuenta actualizada",
        );
      } else {
        createAccount(data);

        toast.success("La cuenta se registró correctamente.", "Cuenta creada");
      }

      handleCloseForm();
      loadData();
    } catch (error) {
      console.error("Error al guardar la cuenta:", error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8">
      {/* Encabezado */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Gestión financiera
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Cuentas
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Administra tus cuentas, consulta sus saldos y mantén el control de
            tus movimientos financieros.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateAccount}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-neutral-800"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="size-5"
            aria-hidden="true"
          >
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          Nueva cuenta
        </button>
      </section>

      {/* Resumen de cuentas */}
      <AccountSummary
        totalBalance={moduleSummary?.totalAccountsBalance ?? 0}
        income={moduleSummary?.totalIncome ?? 0}
        expenses={moduleSummary?.totalExpenses ?? 0}
        activeAccounts={moduleSummary?.activeAccountsCount ?? 0}
      />

      {/* Listado de cuentas */}
      <section className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Tus cuentas
            </h2>

            <p className="mt-1 text-sm text-muted">
              Consulta y administra tus cuentas registradas.
            </p>
          </div>

          <span className="text-sm text-muted">
            {filteredAccounts.length}{" "}
            {filteredAccounts.length === 1 ? "cuenta" : "cuentas"}
          </span>
        </div>

        {/* Búsqueda y filtros */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted"
              aria-hidden="true"
            >
              <circle
                cx="10.8"
                cy="10.8"
                r="6.8"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="m16 16 4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cuenta o banco..."
              aria-label="Buscar cuentas"
              className="w-full rounded-xl border border-hairline bg-surface-card py-3 pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-foreground"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as AccountType | "all")
            }
            aria-label="Filtrar por tipo de cuenta"
            className="rounded-xl border border-hairline bg-surface-card px-4 py-3 text-sm text-foreground outline-none focus:border-foreground sm:w-56"
          >
            <option value="all">Todos los tipos</option>

            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Contenido */}
        {isLoading ? (
          <div className="rounded-2xl bg-surface-card p-12 text-center shadow-sm">
            <p className="text-sm text-muted">Cargando cuentas...</p>
          </div>
        ) : (
          <AccountList
            accounts={filteredAccounts}
            bankMap={bankMap}
            balanceMap={balanceMap}
            onEdit={handleEditAccount}
            onCreate={handleCreateAccount}
            hasRegisteredAccounts={accounts.length > 0}
          />
        )}
      </section>

      {/* Formulario */}
      {isFormOpen && (
        <AccountForm
          banks={banks}
          account={editingAccount}
          onSubmit={handleSubmitAccount}
          onCancel={handleCloseForm}
        />
      )}
    </div>
  );
}
